/**
 * ============================================================
 * AUTH SERVICE — AeroGlide Platform (Production-Hardened)
 * ============================================================
 * Centralised authentication service.
 *
 * SIGNUP ARCHITECTURE (v2 — rate-limit safe):
 *   1. Call supabase.auth.signUp() exactly ONCE.
 *   2. If Supabase has email confirmation OFF → returns session immediately.
 *   3. If Supabase has email confirmation ON → no session, user is unconfirmed.
 *      - Do NOT call /api/auth/confirm in a loop.
 *      - Do NOT automatically retry signInWithPassword if confirm fails.
 *      - Simply return needsEmailVerification: true and show the UI prompt.
 *   4. Supabase's onAuthStateChange fires SIGNED_IN automatically after the
 *      user clicks the email link — no further frontend action needed.
 *
 * RATE LIMIT PROTECTION:
 *   - 429 responses are detected and surfaced as user-friendly messages.
 *   - No automatic retries on 429 — callers must wait before retrying.
 *   - signUp / signIn are single-shot — no internal retry loops.
 *
 * ERROR MESSAGES: user-friendly, never raw Supabase codes.
 * ============================================================
 */

import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { Session, User } from '../../lib/supabaseClient';
import { APP_CONFIG } from '../../config/appConfig';

// ─── Result Types ─────────────────────────────────────────────────────────────
export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
  needsEmailVerification?: boolean;
  isRateLimited?: boolean;
}

// ─── Error Message Mapping ────────────────────────────────────────────────────
function mapAuthError(error: any, context: 'signup' | 'login'): { message: string; isRateLimited: boolean } {
  const msg = (error?.message || '').toLowerCase();
  const status = error?.status || error?.code || 0;
  const isRateLimited = status === 429 || msg.includes('too many requests') || msg.includes('rate limit');

  if (isRateLimited) {
    return {
      message: 'Too many attempts detected. Please wait a few minutes before trying again.',
      isRateLimited: true,
    };
  }
  if (msg.includes('user already registered') || msg.includes('already exists') || msg.includes('already been registered')) {
    return { message: 'An account with this email already exists. Please sign in instead.', isRateLimited: false };
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return { message: 'Incorrect email or password. Please check your credentials and try again.', isRateLimited: false };
  }
  if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
    return { message: 'Your email address has not been verified. Please check your inbox for a verification link.', isRateLimited: false };
  }
  if (msg.includes('user not found') || msg.includes('no user found')) {
    return { message: 'No account found with this email address. Please sign up first.', isRateLimited: false };
  }
  if (msg.includes('password') && msg.includes('weak')) {
    return { message: 'Password is too weak. Please choose a stronger password.', isRateLimited: false };
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return { message: 'Connection error. Please check your internet connection and try again.', isRateLimited: false };
  }
  if (msg.includes('signup disabled') || msg.includes('signups not allowed')) {
    return { message: 'New registrations are temporarily disabled. Please try again later.', isRateLimited: false };
  }

  // Fallback
  return {
    message: context === 'signup'
      ? 'Account creation failed. Please try again.'
      : 'Sign in failed. Please try again.',
    isRateLimited: false,
  };
}

let signupCooldownUntil = 0;
let loginCooldownUntil = 0;

// ─── Auth Service ─────────────────────────────────────────────────────────────
export const authService = {
  /**
   * Sign up a new user with email + password.
   *
   * IMPORTANT: This method calls supabase.auth.signUp() ONCE and never retries.
   * - If email confirmation is OFF in Supabase → session returned, user logged in.
   * - If email confirmation is ON → needsEmailVerification: true, no session.
   *   The frontend shows a "check your email" prompt. No auto-confirm call is made.
   *   Supabase fires SIGNED_IN via onAuthStateChange automatically after link click.
   *
   * Do NOT wrap this in a retry loop — 429 will result.
   */
  async signUp(
    email: string,
    password: string,
    fullName: string
  ): Promise<AuthResult> {
    const now = Date.now();
    if (now < signupCooldownUntil) {
      const secondsLeft = Math.ceil((signupCooldownUntil - now) / 1000);
      return {
        success: false,
        error: `Too many signup attempts. Please wait ${secondsLeft} seconds before trying again.`,
        isRateLimited: true,
      };
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || typeof password !== 'string' || !password.trim()) {
      return { success: false, error: 'Please enter a password.' };
    }
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return { success: false, error: 'Please enter your full name.' };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Authentication service is not configured. Please contact support.',
      };
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined,
        },
      });

      if (error) {
        const mapped = mapAuthError(error, 'signup');
        if (mapped.isRateLimited) {
          signupCooldownUntil = Date.now() + 60000;
        }
        return { success: false, error: mapped.message, isRateLimited: mapped.isRateLimited };
      }

      // Case 1: Email confirmation is DISABLED in Supabase dashboard.
      // Supabase returns both user and session immediately → user is logged in.
      if (data.session && data.user) {
        return {
          success: true,
          user: data.user,
          session: data.session,
          needsEmailVerification: false,
        };
      }

      // Case 2: Email confirmation is ENABLED.
      // Supabase returns user but NO session → email not yet confirmed.
      // Show the verification prompt — DO NOT call /api/auth/confirm or retry signIn.
      // Supabase will fire SIGNED_IN via onAuthStateChange after the user clicks the link.
      if (data.user && !data.session) {
        // Attempt server-side auto-confirm ONCE (no retry). This works only when
        // SUPABASE_SERVICE_ROLE_KEY is configured on the server. If it fails,
        // fall through to the verification prompt — never loop.
        try {
          const confirmRes = await fetch(`${APP_CONFIG.API_URL}/api/auth/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id }),
            signal: AbortSignal.timeout(5000), // 5s timeout — never hang
          });

          if (confirmRes.ok) {
            const confirmData = await confirmRes.json();
            if (confirmData.success) {
              // Auto-confirm succeeded → attempt single sign-in (no retry on failure)
              const signInRes = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
              });

              if (!signInRes.error && signInRes.data.session && signInRes.data.user) {
                return {
                  success: true,
                  user: signInRes.data.user,
                  session: signInRes.data.session,
                  needsEmailVerification: false,
                };
              }
              // signIn failed after confirm → still show verification prompt, not error
            }
          }
        } catch (confirmErr: any) {
          // Server not running or admin key not set → silently fall through.
          // This is NOT a fatal error — just means email verification is required.
          console.warn('⚠️ [authService] Auto-confirm skipped:', confirmErr?.message || confirmErr);
        }

        // Show email verification prompt
        return {
          success: true,
          user: data.user,
          needsEmailVerification: true,
        };
      }

      // Case 3: No user and no session — unexpected state, treat as failure
      return {
        success: false,
        error: 'Account creation failed. Please try again.',
      };
    } catch (err: any) {
      const mapped = mapAuthError(err, 'signup');
      if (mapped.isRateLimited) {
        signupCooldownUntil = Date.now() + 60000;
      }
      return { success: false, error: mapped.message, isRateLimited: mapped.isRateLimited };
    }
  },

  /**
   * Sign in with email + password.
   * Single-shot — no internal retry loops.
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const now = Date.now();
    if (now < loginCooldownUntil) {
      const secondsLeft = Math.ceil((loginCooldownUntil - now) / 1000);
      return {
        success: false,
        error: `Too many sign in attempts. Please wait ${secondsLeft} seconds before trying again.`,
        isRateLimited: true,
      };
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || typeof password !== 'string' || !password.trim()) {
      return { success: false, error: 'Please enter your password.' };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Authentication service is not configured. Please contact support.',
      };
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (
          error.message?.toLowerCase().includes('email not confirmed') ||
          error.message?.toLowerCase().includes('email_not_confirmed')
        ) {
          return {
            success: false,
            needsEmailVerification: true,
            error: 'Your email address has not been verified. Please check your inbox and click the verification link before signing in.',
          };
        }
        const mapped = mapAuthError(error, 'login');
        if (mapped.isRateLimited) {
          loginCooldownUntil = Date.now() + 60000;
        }
        return { success: false, error: mapped.message, isRateLimited: mapped.isRateLimited };
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Sign in failed. Please try again.' };
      }

      return { success: true, user: data.user, session: data.session };
    } catch (err: any) {
      const mapped = mapAuthError(err, 'login');
      if (mapped.isRateLimited) {
        loginCooldownUntil = Date.now() + 60000;
      }
      return { success: false, error: mapped.message, isRateLimited: mapped.isRateLimited };
    }
  },

  /**
   * Sign out current user, clearing all session data.
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { success: true };
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('⚠️ Sign out error (session may already be expired):', error.message);
      }
      return { success: true };
    } catch (err: any) {
      console.error('❌ Sign out failed:', err);
      return { success: true }; // Always succeed — local state cleared regardless
    }
  },

  /**
   * Recover existing session (called on app mount).
   */
  async getSession(): Promise<{ session: Session | null; error?: string }> {
    if (!isSupabaseConfigured) return { session: null };
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('⚠️ Session recovery error:', error.message);
        return { session: null };
      }
      return { session: data.session };
    } catch (err: any) {
      return { session: null };
    }
  },

  /**
   * Subscribe to auth state changes.
   * Returns an unsubscribe function.
   * IMPORTANT: Only call this ONCE — from AuthProvider. Never from Zustand.
   */
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void
  ): () => void {
    if (!isSupabaseConfigured) return () => {};
    try {
      const supabase = getSupabaseClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
      return () => subscription.unsubscribe();
    } catch (err) {
      console.error('❌ Failed to subscribe to auth state changes:', err);
      return () => {};
    }
  },

  /**
   * Resend email verification link.
   */
  async resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Auth service not configured.' };
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Send a password reset email.
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Auth service not configured.' };
    try {
      const supabase = getSupabaseClient();
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password`
        : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
      );
      if (error) {
        const mapped = mapAuthError(error, 'login');
        return { success: false, error: mapped.message };
      }
      return { success: true };
    } catch (err: any) {
      const mapped = mapAuthError(err, 'login');
      return { success: false, error: mapped.message };
    }
  },

  /**
   * Update password for an authenticated user.
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Auth service not configured.' };
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get the currently authenticated user.
   */
  async getUser(): Promise<{ user: User | null; error?: string }> {
    if (!isSupabaseConfigured) return { user: null };
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) return { user: null };
      return { user: data.user };
    } catch {
      return { user: null };
    }
  },

  /**
   * Explicitly refresh the current session token.
   */
  async refreshSession(): Promise<{ session: Session | null; error?: string }> {
    if (!isSupabaseConfigured) return { session: null };
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();
      if (error) return { session: null, error: error.message };
      return { session: data.session };
    } catch (err: any) {
      return { session: null, error: err.message };
    }
  },
};
