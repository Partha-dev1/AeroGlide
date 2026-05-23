/**
 * ============================================================
 * PRODUCTION SUPABASE CLIENT — AeroGlide Flight Platform
 * ============================================================
 * Single source of truth for all Supabase interactions.
 * No mock auth fallback — real auth enforced at all times.
 * Uses PKCE flow for secure session management.
 * ============================================================
 */

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// ─── Environment Validation ───────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.warn(
    '⚠️ [AeroGlide] Supabase credentials not configured.\n' +
    'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to client/.env.local'
  );
}

// ─── Singleton Client ─────────────────────────────────────────────────────────
let _supabaseClient: SupabaseClient<any> | null = null;

export function getSupabaseClient(): SupabaseClient<any> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.'
    );
  }
  if (!_supabaseClient) {
    _supabaseClient = createClient<any>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'aeroglide-auth-session',
      },
      global: {
        headers: {
          'x-app-name': 'aeroglide-flight-platform',
        },
      },
    });
  }
  return _supabaseClient;
}

// ─── Convenience Export ───────────────────────────────────────────────────────
// For backward compatibility — components that import `supabase` directly.
export const supabase = isSupabaseConfigured ? getSupabaseClient() : null;

// ─── Type Re-exports ──────────────────────────────────────────────────────────
export type { Session, User };

// ─── Retry Utility ───────────────────────────────────────────────────────────
/**
 * Executes a Supabase query with exponential backoff on network errors.
 * Does NOT retry on auth errors (400/401/403) — those should fail immediately.
 */
export async function queryWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  retries = 3,
  delayMs = 800
): Promise<{ data: T | null; error: any }> {
  try {
    const res = await queryFn();

    // Auth errors — fail immediately, no retry
    const isAuthError =
      res.error?.status === 400 ||
      res.error?.status === 401 ||
      res.error?.status === 403;

    if (res.error && !isAuthError) throw res.error;
    return res;
  } catch (err: any) {
    const isNetworkError =
      (typeof window !== 'undefined' && !window.navigator.onLine) ||
      err?.message?.includes('Failed to fetch') ||
      err?.message?.includes('NetworkError') ||
      err?.message?.includes('network');

    if (retries > 0 && isNetworkError) {
      console.warn(`📡 Network issue. Retrying in ${delayMs}ms… (${retries} left)`);
      await new Promise((r) => setTimeout(r, delayMs));
      return queryWithRetry(queryFn, retries - 1, delayMs * 2);
    }

    return { data: null, error: err };
  }
}
