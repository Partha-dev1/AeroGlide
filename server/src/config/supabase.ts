import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from './env';

// ─── Availability Flags ───────────────────────────────────────────────────────
export const isSupabaseConfigured = !!(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);
export const isSupabaseAdminConfigured = !!(ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY);
export const useSupabase = isSupabaseConfigured;

// ─── Anon Client (respects RLS — for user-scoped queries) ────────────────────
export let supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log('📡 Supabase anon client initialized.');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase anon client:', error);
  }
} else {
  console.log('⚠️ Supabase credentials missing. In-memory fallback mode active.');
}

// ─── Admin Client (bypasses RLS — server-side operations only) ───────────────
// NEVER expose this client to the browser/frontend.
export let supabaseAdmin: SupabaseClient | null = null;

if (isSupabaseAdminConfigured) {
  try {
    supabaseAdmin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('🔐 Supabase admin (service_role) client initialized.');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase admin client:', error);
  }
} else {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set. Admin operations disabled.');
}

/**
 * Returns the admin client or throws if not configured.
 * Use only in server-side routes/repositories — never in client code.
 */
export function getAdminClient(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Ensure SUPABASE_SERVICE_ROLE_KEY is set in server/.env');
  }
  return supabaseAdmin;
}

/**
 * Validates connection to Supabase database by querying airports table.
 */
export async function validateSupabaseConnection(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('airports').select('id').limit(1);
    if (error) {
      console.warn('⚠️ Supabase validation query error:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('⚠️ Supabase connection validation failed:', err.message);
    return false;
  }
}
