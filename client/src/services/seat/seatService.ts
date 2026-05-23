/**
 * ============================================================
 * SEAT SERVICE — AeroGlide Platform (Client-Side Supabase)
 * ============================================================
 * Seat reservation operations via Supabase RPCs.
 * Lock/release/check operations for the booking flow.
 * ============================================================
 */

import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabaseClient';

export const seatService = {
  /**
   * Lock seats for a booking session.
   * Calls the lock_seats RPC which atomically checks availability
   * and sets locks with a 10-minute expiry.
   */
  async lockSeats(
    flightId: string,
    seatIds: string[],
    lockSession: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('lock_seats', {
        p_flight_id: flightId,
        p_seat_ids: seatIds,
        p_lock_session: lockSession,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data !== true) {
        return {
          success: false,
          error: 'Some seats are no longer available. Please select different seats.',
        };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get available seats for a flight.
   * Automatically filters out expired locks.
   */
  async getAvailableSeats(flightId: string): Promise<{
    seats: any[];
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      return { seats: [], error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();

      // Clean expired locks first
      await client.rpc('cleanup_expired_seat_locks');

      const { data, error } = await client
        .from('seats')
        .select('*')
        .eq('flight_id', flightId)
        .eq('status', 'available')
        .order('seat_code', { ascending: true });

      if (error) {
        return { seats: [], error: error.message };
      }

      return { seats: data || [] };
    } catch (err: any) {
      return { seats: [], error: err.message };
    }
  },

  /**
   * Get seat counts by status for a flight (for UI indicators).
   */
  async getSeatSummary(flightId: string): Promise<{
    available: number;
    locked: number;
    booked: number;
    total: number;
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      return { available: 0, locked: 0, booked: 0, total: 0, error: 'Not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('seats')
        .select('status')
        .eq('flight_id', flightId);

      if (error) {
        return { available: 0, locked: 0, booked: 0, total: 0, error: error.message };
      }

      const seats = data || [];
      return {
        available: seats.filter((s: any) => s.status === 'available').length,
        locked: seats.filter((s: any) => s.status === 'locked').length,
        booked: seats.filter((s: any) => s.status === 'booked').length,
        total: seats.length,
      };
    } catch (err: any) {
      return { available: 0, locked: 0, booked: 0, total: 0, error: err.message };
    }
  },

  /**
   * Trigger cleanup of expired seat locks.
   * Called periodically or before seat operations.
   */
  async cleanupExpiredLocks(): Promise<{ success: boolean }> {
    if (!isSupabaseConfigured) return { success: false };
    try {
      const client = getSupabaseClient();
      await client.rpc('cleanup_expired_seat_locks');
      return { success: true };
    } catch {
      return { success: false };
    }
  },
};
