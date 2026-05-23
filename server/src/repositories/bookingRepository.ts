/**
 * ============================================================
 * BOOKING REPOSITORY — AeroGlide Server
 * ============================================================
 * Server-side booking operations using supabaseAdmin (service_role).
 * Bypasses RLS for server-mediated operations.
 * ============================================================
 */

import { getAdminClient, isSupabaseAdminConfigured } from '../config/supabase';

export const bookingRepository = {
  /**
   * Create booking via RPC (server-side, bypasses RLS).
   */
  async createBooking(params: {
    flight_id: string;
    user_id: string;
    contact_email: string;
    contact_phone: string;
    total_price: number;
    passengers: Array<{
      seat_id: string;
      first_name: string;
      last_name: string;
      passport_number?: string;
    }>;
    lock_session: string;
  }): Promise<{ booking_reference: string | null; error?: string }> {
    if (!isSupabaseAdminConfigured) {
      return { booking_reference: null, error: 'Admin client not configured' };
    }

    try {
      const admin = getAdminClient();
      const { data, error } = await admin.rpc('create_booking_transaction', {
        p_flight_id: params.flight_id,
        p_user_id: params.user_id,
        p_contact_email: params.contact_email,
        p_contact_phone: params.contact_phone,
        p_total_price: params.total_price,
        p_passengers: params.passengers,
        p_lock_session: params.lock_session,
      });

      if (error) return { booking_reference: null, error: error.message };
      return { booking_reference: data as string };
    } catch (err: any) {
      return { booking_reference: null, error: err.message };
    }
  },

  /**
   * Cancel booking via RPC (server-side).
   */
  async cancelBooking(
    bookingId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseAdminConfigured) {
      return { success: false, error: 'Admin client not configured' };
    }

    try {
      const admin = getAdminClient();
      const { data, error } = await admin.rpc('cancel_booking_transaction', {
        p_booking_id: bookingId,
        p_user_id: userId,
      });

      if (error) return { success: false, error: error.message };
      return { success: data === true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get all bookings for a user (server-side, bypasses RLS).
   */
  async getUserBookings(userId: string): Promise<{
    bookings: any[];
    error?: string;
  }> {
    if (!isSupabaseAdminConfigured) {
      return { bookings: [], error: 'Admin client not configured' };
    }

    try {
      const admin = getAdminClient();
      const { data, error } = await admin
        .from('bookings')
        .select(`
          *,
          flights:flight_id (
            id, flight_number, airline, origin_iata, destination_iata,
            departure_time, arrival_time, duration_minutes, base_price, status
          ),
          passengers ( id, first_name, last_name, seat_id )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return { bookings: [], error: error.message };
      return { bookings: data || [] };
    } catch (err: any) {
      return { bookings: [], error: err.message };
    }
  },

  /**
   * Lookup booking by reference and email (server-side).
   */
  async lookupBooking(
    reference: string,
    email: string
  ): Promise<{ booking: any | null; error?: string }> {
    if (!isSupabaseAdminConfigured) {
      return { booking: null, error: 'Admin client not configured' };
    }

    try {
      const admin = getAdminClient();
      const { data, error } = await admin
        .from('bookings')
        .select(`
          *,
          flights:flight_id ( * ),
          passengers ( * )
        `)
        .eq('booking_reference', reference.toUpperCase())
        .eq('contact_email', email.toLowerCase())
        .single();

      if (error) return { booking: null, error: 'Booking not found.' };
      return { booking: data };
    } catch (err: any) {
      return { booking: null, error: err.message };
    }
  },

  /**
   * Lock seats via RPC (server-side).
   */
  async lockSeats(
    flightId: string,
    seatIds: string[],
    lockSession: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseAdminConfigured) {
      return { success: false, error: 'Admin client not configured' };
    }

    try {
      const admin = getAdminClient();
      const { data, error } = await admin.rpc('lock_seats', {
        p_flight_id: flightId,
        p_seat_ids: seatIds,
        p_lock_session: lockSession,
      });

      if (error) return { success: false, error: error.message };
      return { success: data === true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Reschedule booking via RPC (server-side).
   */
  async rescheduleBooking(params: {
    booking_id: string;
    new_flight_id: string;
    new_seat_ids: string[];
    lock_session: string;
    user_id: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseAdminConfigured) {
      return { success: false, error: 'Admin client not configured' };
    }

    try {
      const admin = getAdminClient();
      const { data, error } = await admin.rpc('reschedule_booking_transaction', {
        p_booking_id: params.booking_id,
        p_new_flight_id: params.new_flight_id,
        p_new_seat_ids: params.new_seat_ids,
        p_lock_session: params.lock_session,
        p_user_id: params.user_id,
      });

      if (error) return { success: false, error: error.message };
      return { success: data === true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
