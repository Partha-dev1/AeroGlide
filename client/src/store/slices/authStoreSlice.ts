/**
 * ============================================================
 * AUTH STORE SLICE — AeroGlide Platform
 * ============================================================
 * Zustand slice for authentication state.
 *
 * Auth listener architecture:
 *   - loginWithSupabase: called by AuthProvider after SIGNED_IN / TOKEN_REFRESHED
 *   - logoutUser: calls authService.signOut, clears all state
 *   - initializeAuth: NO-OP — auth lifecycle is owned by AuthProvider
 *
 * Do NOT add onAuthStateChange here. A second listener causes every
 * auth event to fire twice, leading to 429 rate limit errors.
 * ============================================================
 */

import { StateCreator } from 'zustand';
import { authService } from '../../services/auth/authService';
import { CombinedState } from '../index';
import { flightApiService } from '../../services/flightApiService';
import { Profile } from '../../types';

export interface AuthState {
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  authToken: string | null;
  userProfile: Profile | null;
  isLoadingProfile: boolean;
  profileError: string | null;

  // New Auth loop / Hydration state flags
  authReady: boolean;
  authInitialized: boolean;
  callbackProcessed: boolean;
  sessionLoaded: boolean;
  processedCodes: string[];

  // Actions
  loginWithSupabase: (email: string, name: string, token: string, userId: string) => void;
  logoutUser: () => Promise<void>;
  initializeAuth: () => void;
  resetAllStoreState: () => void;
  fetchUserProfile: () => Promise<Profile | null>;
  updateUserProfile: (profileData: Partial<Profile>) => Promise<boolean>;

  // Setter Actions for flags
  setAuthReady: (ready: boolean) => void;
  setAuthInitialized: (initialized: boolean) => void;
  setCallbackProcessed: (processed: boolean) => void;
  setSessionLoaded: (loaded: boolean) => void;
  addProcessedCode: (code: string) => void;
}

// Guard kept as a module-level variable to prevent accidental future misuse.
let isAuthListenerRegistered = false;

export const createAuthSlice: StateCreator<
  CombinedState,
  [],
  [],
  AuthState
> = (set, get) => ({
  userId: null,
  userName: null,
  userEmail: null,
  authToken: null,
  userProfile: null,
  isLoadingProfile: false,
  profileError: null,

  // Default flags
  authReady: false,
  authInitialized: false,
  callbackProcessed: false,
  sessionLoaded: false,
  processedCodes: [],

  setAuthReady: (ready) => set({ authReady: ready }),
  setAuthInitialized: (initialized) => set({ authInitialized: initialized }),
  setCallbackProcessed: (processed) => set({ callbackProcessed: processed }),
  setSessionLoaded: (loaded) => set({ sessionLoaded: loaded }),
  addProcessedCode: (code) => {
    const codes = get().processedCodes || [];
    if (!codes.includes(code)) {
      set({ processedCodes: [...codes, code] });
    }
  },

  /**
   * Called by AuthProvider after a successful SIGNED_IN or TOKEN_REFRESHED event.
   * Syncs auth token into flightApiService and triggers data loading.
   */
  loginWithSupabase: (email, name, token, userId) => {
    flightApiService.setAuthToken(token);
    set({
      userId,
      userEmail: email,
      userName: name,
      authToken: token,
      bookingsError: null,
    });
    // Load user's bookings after login
    get().fetchUserBookings?.();
    // Load user's profile after login
    get().fetchUserProfile?.();
  },

  /**
   * Signs out from Supabase and clears all local user state.
   */
  logoutUser: async () => {
    await authService.signOut();
    flightApiService.setAuthToken(null);
    get().resetAllStoreState();
  },

  /**
   * NO-OP — Auth lifecycle is owned exclusively by AuthProvider.
   *
   * Architecture note:
   *   AuthProvider (src/providers/AuthProvider.tsx) registers the single
   *   Supabase onAuthStateChange listener and calls loginWithSupabase /
   *   logoutUser directly.
   *
   *   Adding onAuthStateChange here creates a SECOND listener. Every auth
   *   event (SIGNED_IN, TOKEN_REFRESHED) then fires twice, doubling
   *   fetchUserBookings + fetchUserProfile calls and causing Supabase 429
   *   rate limit errors.
   *
   *   Kept as a no-op for backward compatibility (NavbarHeader, AuthGuard
   *   call it — they are safe to do so, they just get a no-op).
   */
  initializeAuth: () => {
    if (isAuthListenerRegistered) return;
    isAuthListenerRegistered = true;
    // Intentional no-op. Do NOT add any auth subscription here.
  },

  /**
   * Fetches the user profile details from the backend.
   * If the fetch fails (e.g. offline, database connection loss), falls back gracefully
   * to the local storage cached profile while flagging the connection error.
   */
  fetchUserProfile: async () => {
    const token = get().authToken;
    const userId = get().userId;
    if (!token || !userId) return null;

    set({ isLoadingProfile: true, profileError: null });
    try {
      const profile = await flightApiService.getProfile();
      set({ userProfile: profile, isLoadingProfile: false });
      return profile;
    } catch (err: any) {
      console.warn('⚠️ Network or database connection loss while fetching profile. Using cached data:', err.message);
      const cachedProfile = get().userProfile;
      set({ 
        profileError: err.message || 'Database connection loss', 
        isLoadingProfile: false 
      });
      return cachedProfile;
    }
  },

  /**
   * Updates user emergency contact, passport details, nationality, etc.
   * Uses optimistic updates: writes to the local store (and thus localStorage) immediately,
   * then attempts to sync with the server. If the sync fails (offline/network error),
   * the local changes are retained and a warning is displayed.
   */
  updateUserProfile: async (profileData) => {
    const token = get().authToken;
    const userId = get().userId;
    if (!token || !userId) return false;

    // Save previous state for fallback/comparison
    const previousProfile = get().userProfile;

    // 1. Optimistic Update: Update Zustand store immediately so it writes to localStorage
    const optimisticProfile = {
      ...(previousProfile || { id: userId, full_name: 'Passenger' }),
      ...profileData,
      updated_at: new Date().toISOString(),
    } as Profile;

    set({
      userProfile: optimisticProfile,
      userName: optimisticProfile.full_name || get().userName,
      isLoadingProfile: true,
      profileError: null,
    });

    try {
      const updated = await flightApiService.updateProfile(profileData);
      // Sync with the actual server-returned data
      set({
        userProfile: updated,
        userName: updated.full_name,
        isLoadingProfile: false,
        profileError: null,
      });
      return true;
    } catch (err: any) {
      // 2. Offline Boundary Resilience: Keep local changes but flag the sync error
      console.warn('⚠️ Network or database connection loss while saving profile. Retaining offline cache:', err.message);
      set({
        isLoadingProfile: false,
        profileError: `Offline: Saved locally. Failed to sync with server (${err.message || 'Connection lost'}).`,
      });
      return true;
    }
  },

  /**
   * Central reset action: clears all user-related state on logout or session expiry.
   */
  resetAllStoreState: () => {
    set({
      // Auth Slice
      userId: null,
      userName: null,
      userEmail: null,
      authToken: null,
      userProfile: null,
      isLoadingProfile: false,
      profileError: null,
      callbackProcessed: false,
      processedCodes: [],

      // Search Slice
      searchQuery: null,
      searchResults: [],

      // Booking Slice
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

      // Realtime Slice
      holdTimeRemaining: 0,

      // Cache Slice
      myBookings: [],
      bookingActionError: null,
    });
  },
});
