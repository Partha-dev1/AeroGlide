'use client';

/**
 * ============================================================
 * AUTH PROVIDER — AeroGlide Platform
 * ============================================================
 * SINGLE SOURCE OF TRUTH for Supabase auth lifecycle.
 *
 * Architecture decision:
 *   AuthProvider is the SOLE owner of the Supabase auth listener.
 *   Zustand store (initializeAuth) is a no-op — auth is synced here
 *   by calling loginWithSupabase / logoutUser directly.
 *
 * Infinite loop fixes applied:
 *   1. isBootstrappedRef — prevents React 18 Strict Mode double-mount
 *      from registering two listeners (which caused every auth event
 *      to fire twice → double fetchUserBookings, double fetchUserProfile,
 *      eventually 429 rate limit errors).
 *   2. Supabase client singleton + single onAuthStateChange call.
 *   3. Duplicate-state guard: loginWithSupabase only called when the
 *      token or userId actually changes.
 * ============================================================
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { authService, AuthResult } from '../services/auth/authService';
import type { Session, User } from '../lib/supabaseClient';
import { useStore } from '../store';
import { flightApiService } from '../services/flightApiService';

// ─── Context Types ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

// ─── Default Context ───────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  signUp: async () => ({ success: false, error: 'AuthProvider not mounted' }),
  signIn: async () => ({ success: false, error: 'AuthProvider not mounted' }),
  signOut: async () => {},
  resetPassword: async () => ({ success: false }),
  updatePassword: async () => ({ success: false }),
  clearError: () => {},
});

// ─── Provider Component ────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Mount guards ──────────────────────────────────────────────────────────
  // isBootstrappedRef: Prevents React 18 Strict Mode from registering
  // two auth listeners on double-mount. Without this guard, every
  // auth state change (TOKEN_REFRESHED, SIGNED_IN etc.) fires twice,
  // causing double API calls and eventual 429 rate limit errors.
  const isBootstrappedRef = useRef(false);
  const mountedRef = useRef(true);

  // Zustand store sync — read actions once at mount, never in dep arrays
  const loginWithSupabase = useStore((s) => s.loginWithSupabase);
  const logoutUser = useStore((s) => s.logoutUser);

  // ── Session Bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // CRITICAL: Prevent double-registration under React 18 Strict Mode.
    // React 18 intentionally mounts → unmounts → remounts components in dev.
    // Without this guard, two onAuthStateChange listeners are registered,
    // causing every auth event to fire loginWithSupabase twice.
    if (isBootstrappedRef.current) return;
    isBootstrappedRef.current = true;

    // 1. Restore existing session immediately from Supabase local storage
    authService.getSession().then(({ session: existing }) => {
      if (!mountedRef.current) return;

      if (existing) {
        setSession(existing);
        setUser(existing.user);

        const u = existing.user;
        const name = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Passenger';
        const nextToken = (existing as any).access_token ?? '';

        // Deduplicate: only call loginWithSupabase if state actually changed
        const currentStore = useStore.getState();
        if (currentStore.authToken !== nextToken || currentStore.userId !== u.id) {
          loginWithSupabase(u.email ?? '', name, nextToken, u.id);
        }
      }

      setIsLoading(false);
      const store = useStore.getState();
      store.setSessionLoaded(true);
      store.setAuthReady(true);
      store.setAuthInitialized(true);
    });

    // 2. Subscribe to live auth state changes ONCE.
    //    This handles: token refresh, sign-in/out across tabs, PKCE callback.
    const unsubscribe = authService.onAuthStateChange((event, newSession) => {
      if (!mountedRef.current) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);

      const store = useStore.getState();
      store.setSessionLoaded(true);
      store.setAuthReady(true);
      store.setAuthInitialized(true);

      if (newSession?.user) {
        const u = newSession.user;
        const name = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Passenger';
        const nextToken = (newSession as any).access_token ?? '';

        // Deduplicate: skip if token + userId are identical to current store state.
        // TOKEN_REFRESHED fires frequently — without this guard it spams
        // fetchUserBookings and fetchUserProfile on every silent refresh.
        const currentStore = useStore.getState();
        if (currentStore.authToken === nextToken && currentStore.userId === u.id) {
          return;
        }

        loginWithSupabase(u.email ?? '', name, nextToken, u.id);
      }

      if (event === 'SIGNED_OUT') {
        setError(null);
        // Safely clear session state if store still holds one.
        // We do NOT call logoutUser() which calls authService.signOut() again (recursive loop).
        const currentStore = useStore.getState();
        if (currentStore.userId !== null) {
          flightApiService.setAuthToken(null);
          currentStore.resetAllStoreState();
        }
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      // Reset bootstrap flag on actual unmount so future remounts (e.g.
      // navigating away and back to a page that re-mounts the layout)
      // can re-bootstrap correctly. Note: in practice Next.js App Router
      // keeps the layout mounted for the full session.
      isBootstrappedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, fullName: string): Promise<AuthResult> => {
    setError(null);
    const result = await authService.signUp(email, password, fullName);
    if (!result.success && result.error) {
      setError(result.error);
    } else if (result.session) {
      setSession(result.session);
      setUser(result.user ?? null);
      
      const u = result.user ?? result.session.user;
      if (u) {
        const name = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Passenger';
        const nextToken = (result.session as any).access_token ?? '';
        loginWithSupabase(u.email ?? '', name, nextToken, u.id);
      }
    }
    return result;
  }, [loginWithSupabase]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setError(null);
    const result = await authService.signIn(email, password);
    if (!result.success && result.error) {
      setError(result.error);
    } else if (result.session) {
      setSession(result.session);
      setUser(result.user ?? null);

      const u = result.user ?? result.session.user;
      if (u) {
        const name = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Passenger';
        const nextToken = (result.session as any).access_token ?? '';
        loginWithSupabase(u.email ?? '', name, nextToken, u.id);
      }
    }
    return result;
  }, [loginWithSupabase]);

  const signOut = useCallback(async () => {
    setError(null);
    await authService.signOut();
    setSession(null);
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const result = await authService.resetPassword(email);
    if (!result.success && result.error) setError(result.error);
    return result;
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setError(null);
    const result = await authService.updatePassword(newPassword);
    if (!result.success && result.error) setError(result.error);
    return result;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // ── Context Value ──────────────────────────────────────────────────────────
  const value: AuthContextValue = {
    user,
    session,
    isAuthenticated: !!session?.user,
    isLoading,
    error,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return ctx;
}
