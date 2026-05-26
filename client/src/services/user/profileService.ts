/**
 * ============================================================
 * PROFILE SERVICE — AeroGlide Platform (Client-Side Supabase)
 * ============================================================
 * User profile CRUD against the public.profiles table.
 * ============================================================
 */

import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Profile } from '../../types';

export const profileService = {
  /**
   * Get user profile from public.profiles table.
   */
  async getProfile(userId: string): Promise<{
    profile: Profile | null;
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      return { profile: null, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return { profile: null, error: error.message };
      }

      return { profile: data as Profile };
    } catch (err: any) {
      return { profile: null, error: err.message };
    }
  },

  /**
   * Update user profile.
   * Email changes must go through Supabase Auth.
   */
  async updateProfile(
    userId: string,
    updates: Partial<Profile>
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      
      const cleanData = { ...updates };
      delete (cleanData as any).id;
      delete (cleanData as any).created_at;
      delete (cleanData as any).updated_at;

      const { error } = await client
        .from('profiles')
        .update(cleanData)
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Also update auth metadata so it stays in sync
      if (updates.full_name) {
        await client.auth.updateUser({
          data: {
            full_name: updates.full_name,
          },
        });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

