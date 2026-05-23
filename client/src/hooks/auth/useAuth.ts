/**
 * ============================================================
 * useAuth HOOK — AeroGlide Platform
 * ============================================================
 * Wraps authService with React state management.
 * Provides: user, session, loading, error, signIn, signUp, signOut
 * Used by AuthModal and any component needing auth state.
 * ============================================================
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { authService, AuthResult } from '../../services/auth/authService';
import type { Session, User } from '../../lib/supabaseClient';

export interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // ── Session Initialization ────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // 1. Try to restore existing session immediately
    authService.getSession().then(({ session: existingSession }) => {
      if (!mountedRef.current) return;
      if (existingSession) {
        setSession(existingSession);
        setUser(existingSession.user);
      }
      setIsLoading(false);
    });

    // 2. Subscribe to auth state changes (token refresh, sign-in, sign-out)
    const unsubscribe = authService.onAuthStateChange((event, newSession) => {
      if (!mountedRef.current) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        setError(null);
      }
      if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Session token refreshed.');
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  // ── Sign Up ───────────────────────────────────────────────────────────────
  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<AuthResult> => {
      setError(null);
      const result = await authService.signUp(email, password, fullName);
      if (!result.success && result.error) {
        setError(result.error);
      } else if (result.session) {
        setSession(result.session);
        setUser(result.user ?? null);
      }
      return result;
    },
    []
  );

  // ── Sign In ───────────────────────────────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      setError(null);
      const result = await authService.signIn(email, password);
      if (!result.success && result.error) {
        setError(result.error);
      } else if (result.session) {
        setSession(result.session);
        setUser(result.user ?? null);
      }
      return result;
    },
    []
  );

  // ── Sign Out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    setError(null);
    await authService.signOut();
    setSession(null);
    setUser(null);
  }, []);

  // ── Clear Error ───────────────────────────────────────────────────────────
  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    session,
    isAuthenticated: !!session?.user,
    isLoading,
    error,
    signUp,
    signIn,
    signOut,
    clearError,
  };
}
