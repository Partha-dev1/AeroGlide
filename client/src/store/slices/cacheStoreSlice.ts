import { StateCreator } from 'zustand';
import { Booking, OfflineBookingDraft } from '../../types';
import { flightApiService } from '../../services/flightApiService';
import { uuidv4Client } from '../../utils';
import { CombinedState } from '../index';

export interface CacheState {
  myBookings: Booking[];
  bookingHistoryCache: Record<string, Booking>;
  isLoadingBookings: boolean;
  bookingsError: string | null;
  /** Error from a cancel/reschedule action — shown in the confirmation modal */
  bookingActionError: string | null;
  offlineDrafts: OfflineBookingDraft[];
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncErrorMessage: string | null;

  // Actions
  fetchUserBookings: () => Promise<void>;
  lookupBookingAndCache: (reference: string, email: string) => Promise<Booking | null>;
  cancelBooking: (bookingId: string) => Promise<boolean>;
  rescheduleBooking: (bookingId: string, newFlightId: string, newSeatIds: string[], lockSession: string) => Promise<boolean>;
  clearBookingActionError: () => void;
  saveBookingAsOfflineDraft: (userId: string | null) => void;
  syncOfflineDrafts: (reenteredPassports: Record<string, string>) => Promise<boolean>;
  removeOfflineDraft: (tempRef: string) => void;
}

export const createCacheSlice: StateCreator<
  CombinedState,
  [],
  [],
  CacheState
> = (set, get) => ({
  myBookings: [],
  bookingHistoryCache: {},
  isLoadingBookings: false,
  bookingsError: null,
  bookingActionError: null,
  offlineDrafts: [],
  syncStatus: 'idle',
  syncErrorMessage: null,

  fetchUserBookings: async () => {
    const userId = get().userId;
    const token = get().authToken;
    if (!userId || !token) return;

    set({ isLoadingBookings: true, bookingsError: null });
    try {
      const data = await flightApiService.getUserBookings(userId);
      
      // Seed the lookup cache for offline availability
      const newCache = { ...get().bookingHistoryCache };
      data.forEach((b: Booking) => {
        newCache[`${b.booking_reference}_${b.contact_email.toLowerCase()}`] = b;
      });

      set({ myBookings: data, bookingHistoryCache: newCache, isLoadingBookings: false });
    } catch (err: any) {
      set({ bookingsError: err.message || 'Network error.', isLoadingBookings: false });
    }
  },

  lookupBookingAndCache: async (reference, email) => {
    const cacheKey = `${reference.toUpperCase()}_${email.toLowerCase()}`;
    try {
      const booking = await flightApiService.lookupBooking(reference, email);

      // Store in cache for offline retrieval
      set(state => ({
        bookingHistoryCache: {
          ...state.bookingHistoryCache,
          [cacheKey]: booking
        }
      }));

      return booking;
    } catch (err) {
      console.warn('Booking lookup API failed, checking local storage cache:', err);
      const cached = get().bookingHistoryCache[cacheKey];
      if (cached) return cached;
      return null;
    }
  },

  cancelBooking: async (bookingId) => {
    set({ bookingActionError: null });
    try {
      await flightApiService.cancelBooking(bookingId);

      // Trigger central store reset upon booking cancellation
      get().resetAllStoreState();

      // Refresh server list
      get().fetchUserBookings();
      return true;
    } catch (err: any) {
      // ✅ FIX: Never re-throw — set error state instead to prevent unhandled runtime crash
      const msg = err?.message || 'Cancellation failed. Please try again.';
      console.error('❌ Cancellation failed:', msg);
      set({ bookingActionError: msg });
      return false;
    }
  },

  rescheduleBooking: async (bookingId, newFlightId, newSeatIds, lockSession) => {
    set({ bookingActionError: null });
    try {
      await flightApiService.rescheduleBooking(bookingId, newFlightId, newSeatIds, lockSession);

      // Refresh server list
      get().fetchUserBookings();
      return true;
    } catch (err: any) {
      // ✅ FIX: Never re-throw — set error state instead to prevent unhandled runtime crash
      const msg = err?.message || 'Rescheduling failed. Please try again.';
      console.error('❌ Rescheduling failed:', msg);
      set({ bookingActionError: msg });
      return false;
    }
  },

  clearBookingActionError: () => set({ bookingActionError: null }),

  saveBookingAsOfflineDraft: (userId) => {
    const { activeFlight, selectedSeats, passengers, contactEmail, contactPhone } = get();
    if (!activeFlight || selectedSeats.length === 0) return;

    const tempRef = `OFFLINE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const total = selectedSeats.reduce((acc, curr) => acc + (activeFlight.base_price * curr.price_multiplier), 0);

    const newDraft: OfflineBookingDraft = {
      temp_ref: tempRef,
      flight_id: activeFlight.id,
      user_id: userId,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      total_price: total,
      passengers, // Safe to save, does not contain passport numbers!
      flight_number: activeFlight.flight_number,
      route: `${activeFlight.origin} ➔ ${activeFlight.destination}`,
      departure_time: activeFlight.departure_time
    };

    set(state => ({
      offlineDrafts: [...state.offlineDrafts, newDraft]
    }));
  },

  syncOfflineDrafts: async (reenteredPassports) => {
    const { offlineDrafts } = get();
    if (offlineDrafts.length === 0) return true;

    set({ syncStatus: 'syncing', syncErrorMessage: null });
    const syncSession = uuidv4Client();

    // Hydrate drafts with newly entered passport numbers
    const fullyHydratedDrafts = offlineDrafts.map(draft => {
      const hydratedPassengers = draft.passengers.map(p => ({
        ...p,
        passport_number: reenteredPassports[p.seat_id] || ''
      }));
      return {
        ...draft,
        passengers: hydratedPassengers
      } as any;
    });

    // Check if any passport is missing
    const missingPassports = fullyHydratedDrafts.some(d => d.passengers.some((p: any) => !p.passport_number));
    if (missingPassports) {
      set({ syncStatus: 'error', syncErrorMessage: 'Please provide passport numbers for all synchronizing draft bookings.' });
      return false;
    }

    try {
      const result = await flightApiService.syncOfflineDrafts(fullyHydratedDrafts, syncSession);
      const results = result.synced || [];

      const failed = results.filter((r: any) => !r.success);
      if (failed.length > 0) {
        const errMsgs = failed.map((f: any) => `${f.temp_ref}: ${f.error}`).join(' | ');
        const successfulRefs = results.filter((r: any) => r.success).map((r: any) => r.temp_ref);
        set(state => ({
          offlineDrafts: state.offlineDrafts.filter(d => !successfulRefs.includes(d.temp_ref)),
          syncStatus: 'error',
          syncErrorMessage: `Some sync bookings failed: ${errMsgs}`
        }));
        return false;
      }

      // Fully successful sync
      set({ offlineDrafts: [], syncStatus: 'success' });
      setTimeout(() => set({ syncStatus: 'idle' }), 3000);
      
      // Refresh user bookings to pull down newly synced bookings from server
      get().fetchUserBookings();
      return true;
    } catch (err: any) {
      set({ syncStatus: 'error', syncErrorMessage: err.message || 'Sync failed.' });
      return false;
    }
  },

  removeOfflineDraft: (tempRef) => {
    set(state => ({
      offlineDrafts: state.offlineDrafts.filter(d => d.temp_ref !== tempRef)
    }));
  }
});
