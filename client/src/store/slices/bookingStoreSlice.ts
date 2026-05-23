import { StateCreator } from 'zustand';
import { Flight, Seat, Passenger } from '../../types';
import { flightApiService } from '../../services/flightApiService';
import { uuidv4Client } from '../../utils';
import { CombinedState } from '../index';

export interface BookingState {
  activeFlight: Flight | null;
  activeFlightSeats: Seat[];
  isLoadingSeats: boolean;
  selectedSeats: Seat[];
  lockSession: string | null;
  passengers: Omit<Passenger, 'passport_number'>[];
  passportEntries: Record<string, string>; // In-memory ONLY
  contactEmail: string;
  contactPhone: string;
  isSubmittingBooking: boolean;
  bookingError: string | null;
  lastCreatedBooking: { booking_id: string; booking_reference: string } | null;

  // Actions
  setActiveFlight: (flight: Flight | null) => void;
  fetchSeats: (flightId: string) => Promise<void>;
  toggleSeatSelection: (seat: Seat) => void;
  clearSelectedSeats: () => void;
  initLockSession: () => void;
  lockSelectedSeats: () => Promise<boolean>;
  updateContactDetails: (email: string, phone: string) => void;
  updatePassengerDetails: (passengersList: Omit<Passenger, 'passport_number'>[]) => void;
  setPassportInMemory: (seatId: string, passportNumber: string) => void;
  clearPassportInMemory: () => void;
  createBooking: (userId: string | null) => Promise<boolean>;
  resetBookingFlow: () => void;
}

export const createBookingSlice: StateCreator<
  CombinedState,
  [],
  [],
  BookingState
> = (set, get) => ({
  activeFlight: null,
  activeFlightSeats: [],
  isLoadingSeats: false,
  selectedSeats: [],
  lockSession: null,
  passengers: [],
  passportEntries: {},
  contactEmail: '',
  contactPhone: '',
  isSubmittingBooking: false,
  bookingError: null,
  lastCreatedBooking: null,

  setActiveFlight: (flight) => {
    set({
      activeFlight: flight,
      activeFlightSeats: [],
      selectedSeats: [],
      passengers: [],
      passportEntries: {},
      bookingError: null,
      holdTimeRemaining: 0 // Reset realtime hold timer on flight shift
    });
    if (flight) {
      get().fetchSeats(flight.id);
    }
  },

  fetchSeats: async (flightId) => {
    set({ isLoadingSeats: true, bookingError: null });
    try {
      const seats = await flightApiService.getFlightSeats(flightId);
      set({ activeFlightSeats: seats, isLoadingSeats: false });
    } catch (err: any) {
      set({ bookingError: err.message || 'Failed to fetch flight seats.', isLoadingSeats: false });
    }
  },

  toggleSeatSelection: (seat) => {
    const { selectedSeats } = get();
    const exists = selectedSeats.some(s => s.id === seat.id);
    if (exists) {
      set({ selectedSeats: selectedSeats.filter(s => s.id !== seat.id) });
    } else {
      set({ selectedSeats: [...selectedSeats, seat] });
    }
  },

  clearSelectedSeats: () => set({ selectedSeats: [] }),

  initLockSession: () => {
    if (!get().lockSession) {
      set({ lockSession: uuidv4Client() });
    }
  },

  lockSelectedSeats: async () => {
    const { activeFlight, selectedSeats, lockSession } = get();
    if (!activeFlight || selectedSeats.length === 0 || !lockSession) return false;

    try {
      await flightApiService.lockSeats(activeFlight.id, selectedSeats.map(s => s.id), lockSession);
      
      // Start hold timer on successfully locking seats: 10 minutes (600s)
      get().setHoldTimeRemaining(600);
      return true;
    } catch (err: any) {
      set({ bookingError: err.message || 'Failed to lock selected seats.' });
      return false;
    }
  },

  updateContactDetails: (email, phone) => set({ contactEmail: email, contactPhone: phone }),

  updatePassengerDetails: (passengersList) => set({ passengers: passengersList }),

  setPassportInMemory: (seatId, passportNumber) => {
    set((state) => ({
      passportEntries: {
        ...state.passportEntries,
        [seatId]: passportNumber
      }
    }));
  },

  clearPassportInMemory: () => set({ passportEntries: {} }),

  createBooking: async (userId) => {
    const { activeFlight, selectedSeats, lockSession, passengers, passportEntries, contactEmail, contactPhone } = get();
    if (!activeFlight || selectedSeats.length === 0 || !lockSession) {
      set({ bookingError: 'Booking flow state is invalid.' });
      return false;
    }

    set({ isSubmittingBooking: true, bookingError: null });

    // Map passengers combining base details with sensitive passport details in-memory
    const fullPassengers = passengers.map(p => {
      const passport = passportEntries[p.seat_id] || '';
      return {
        ...p,
        passport_number: passport
      } as Passenger;
    });

    // Verify we have passports for everyone
    if (fullPassengers.some(p => !p.passport_number)) {
      set({ bookingError: 'Please enter passport numbers for all passengers.', isSubmittingBooking: false });
      return false;
    }

    try {
      const totalPrice = selectedSeats.reduce((acc, curr) => acc + (activeFlight.base_price * curr.price_multiplier), 0);
      const result = await flightApiService.createBooking({
        flight_id: activeFlight.id,
        user_id: userId,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        total_price: totalPrice,
        passengers: fullPassengers,
        lock_session: lockSession
      });

      set({
        lastCreatedBooking: {
          booking_id: result.booking_id,
          booking_reference: result.booking_reference
        },
        isSubmittingBooking: false,
        holdTimeRemaining: 0 // Reset countdown on completion
      });

      // Fetch bookings list again to reflect this booking in dashboard
      if (userId) {
        get().fetchUserBookings();
      }

      return true;
    } catch (err: any) {
      set({ bookingError: err.message || 'Booking submission failed.', isSubmittingBooking: false });
      return false;
    }
  },

  resetBookingFlow: () => set({
    activeFlight: null,
    activeFlightSeats: [],
    selectedSeats: [],
    lockSession: null,
    passengers: [],
    passportEntries: {},
    contactEmail: '',
    contactPhone: '',
    bookingError: null,
    lastCreatedBooking: null,
    holdTimeRemaining: 0
  })
});
