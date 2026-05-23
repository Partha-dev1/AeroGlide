/**
 * ============================================================
 * PROFILE SERVICE — AeroGlide Platform (Client-Side Supabase)
 * ============================================================
 * User profile CRUD against the public.users table.
 * The users table mirrors auth.users via trigger sync.
 * Only full_name and phone are user-editable.
 * ============================================================
 */

import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabaseClient';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export const profileService = {
  /**
   * Get user profile from public.users table.
   */
  async getProfile(userId: string): Promise<{
    profile: UserProfile | null;
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      return { profile: null, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return { profile: null, error: error.message };
      }

      return { profile: data as UserProfile };
    } catch (err: any) {
      return { profile: null, error: err.message };
    }
  },

  /**
   * Update user profile (full_name and phone only).
   * Email changes must go through Supabase Auth.
   */
  async updateProfile(
    userId: string,
    updates: { full_name?: string; phone?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('users')
        .update({
          full_name: updates.full_name,
          phone: updates.phone,
        })
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Also update auth metadata so it stays in sync
      await client.auth.updateUser({
        data: {
          full_name: updates.full_name,
        },
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
