import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { AuthState, createAuthSlice } from './slices/authStoreSlice';
import { SearchState, createSearchSlice } from './slices/searchStoreSlice';
import { BookingState, createBookingSlice } from './slices/bookingStoreSlice';
import { RealtimeState, createRealtimeSlice } from './slices/realtimeStoreSlice';
import { CacheState, createCacheSlice } from './slices/cacheStoreSlice';
import { TrackingState, createTrackingSlice } from './slices/trackingStoreSlice';
import { flightApiService } from '../services/flightApiService';

export type CombinedState = AuthState & SearchState & BookingState & RealtimeState & CacheState & TrackingState;

// Define interfaces for exports so client TypeScript is perfectly type-safe
export type FlightState = CombinedState;
export type UserState = CombinedState;

// SSR-safe localStorage adapter.
// Cast via unknown: Zustand's createJSONStorage only calls getItem/setItem/removeItem,
// so the partial no-op object is safe. TypeScript requires the double-cast because
// the object is missing length/clear/key from the full Storage interface.
const safeStorage = typeof window !== 'undefined'
  ? localStorage
  : (({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown) as Storage);


// Create the single unified store combining the 6 slices
export const useStore = create<CombinedState>()(
  persist(
    (set, get, store) => ({
      ...createAuthSlice(set, get, store),
      ...createSearchSlice(set, get, store),
      ...createBookingSlice(set, get, store),
      ...createRealtimeSlice(set, get, store),
      ...createCacheSlice(set, get, store),
      ...createTrackingSlice(set, get, store)
    }),
    {
      name: 'aeroglide-unified-storage',
      storage: createJSONStorage(() => safeStorage),

      // GDPR Compliance and Security:
      // Omit passport entries, SSE flags, search loaders, and realtime timers
      partialize: (state) => ({
        userId: state.userId,
        userName: state.userName,
        userEmail: state.userEmail,
        // Persist authToken so page reloads can re-sync the Bearer token into flightApiService
        authToken: state.authToken,
        userProfile: state.userProfile,
        searchQuery: state.searchQuery,
        searchResults: state.searchResults,
        activeFlight: state.activeFlight,
        selectedSeats: state.selectedSeats,
        lockSession: state.lockSession,
        passengers: state.passengers,
        contactEmail: state.contactEmail,
        contactPhone: state.contactPhone,
        lastCreatedBooking: state.lastCreatedBooking,
        myBookings: state.myBookings,
        bookingHistoryCache: state.bookingHistoryCache,
        offlineDrafts: state.offlineDrafts,
        processedCodes: state.processedCodes,
      }),

      // ✅ CRITICAL FIX: Re-sync the Bearer token into flightApiService after store rehydration.
      //
      // Root cause of "Booking not found or access denied" on page reload:
      //   1. Zustand restores the store state from localStorage (userId, authToken, etc.)
      //   2. BUT flightApiService.token is a plain class property — it's NOT in the store.
      //   3. So after a page reload, flightApiService.token === null even though
      //      the store has a valid token.
      //   4. All protected API calls send requests WITHOUT the Authorization header.
      //   5. The server authMiddleware rejects them with 401/403.
      //   6. The service throws "Booking not found or access denied."
      //
      // Fix: onRehydrateStorage fires once after the store is restored from localStorage.
      // We immediately push the restored token back into flightApiService.
      onRehydrateStorage: () => (state) => {
        if (state?.authToken) {
          flightApiService.setAuthToken(state.authToken);
        }
      }
    }
  )
);

// Backward Compatibility Aliases:
// Instead of modifying dozens of imports, useFlightStore and useUserStore tap into the unified store.
export const useFlightStore = useStore;
export const useUserStore = useStore;
export { useStore as useAeroStore };
