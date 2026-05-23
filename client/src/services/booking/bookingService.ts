/**
 * ============================================================
 * BOOKING SERVICE — AeroGlide Platform (Client-Side)
 * ============================================================
 * Production booking operations via Supabase RPCs.
 * All mutations use SECURITY DEFINER stored procedures
 * to enforce business rules server-side.
 * ============================================================
 */

import { getSupabaseClient, isSupabaseConfigured, queryWithRetry } from '../../lib/supabaseClient';
import type { Booking, Passenger } from '../../types';

export interface CreateBookingParams {
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
}

export const bookingService = {
  /**
   * Create a new booking via RPC (atomic transaction).
   * Validates seat locks, creates booking + passengers + payment in one call.
   */
  async createBooking(params: CreateBookingParams): Promise<{
    success: boolean;
    booking_reference?: string;
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('create_booking_transaction', {
        p_flight_id: params.flight_id,
        p_user_id: params.user_id,
        p_contact_email: params.contact_email,
        p_contact_phone: params.contact_phone,
        p_total_price: params.total_price,
        p_passengers: params.passengers,
        p_lock_session: params.lock_session,
      });

      if (error) {
        console.error('❌ Booking creation failed:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, booking_reference: data as string };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Cancel a booking via RPC (atomic: frees seats + refunds payment).
   */
  async cancelBooking(
    bookingId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('cancel_booking_transaction', {
        p_booking_id: bookingId,
        p_user_id: userId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: data === true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Reschedule a booking via RPC (atomic: moves seats + updates flight).
   */
  async rescheduleBooking(
    bookingId: string,
    newFlightId: string,
    newSeatIds: string[],
    lockSession: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('reschedule_booking_transaction', {
        p_booking_id: bookingId,
        p_new_flight_id: newFlightId,
        p_new_seat_ids: newSeatIds,
        p_lock_session: lockSession,
        p_user_id: userId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: data === true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch all bookings for the authenticated user (with flight data join).
   */
  async getUserBookings(userId: string): Promise<{
    bookings: Booking[];
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      return { bookings: [], error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const result = await queryWithRetry(async () =>
        client
          .from('bookings')
          .select(`
            *,
            flights:flight_id (
              id, flight_number, airline, origin_iata, destination_iata,
              departure_time, arrival_time, duration_minutes, base_price, status
            ),
            passengers (
              id, first_name, last_name, passport_number,
              seats:seat_id ( id, seat_code, cabin_class, status, price_modifier )
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      );

      if (result.error) {
        return { bookings: [], error: result.error.message };
      }

      // Map the nested Supabase join structure to our Booking type
      const bookings: Booking[] = (result.data || []).map((b: any) => ({
        id: b.id,
        booking_reference: b.booking_reference,
        flight_id: b.flight_id,
        user_id: b.user_id,
        contact_email: b.contact_email,
        contact_phone: b.contact_phone,
        total_price: b.total_price,
        status: b.status,
        created_at: b.created_at,
        flight: b.flights
          ? {
              id: b.flights.id,
              flight_number: b.flights.flight_number,
              airline: b.flights.airline,
              origin: b.flights.origin_iata,
              destination: b.flights.destination_iata,
              departure_time: b.flights.departure_time,
              arrival_time: b.flights.arrival_time,
              base_price: b.flights.base_price,
              status: b.flights.status,
              aircraft_type: '',
              duration_minutes: b.flights.duration_minutes,
            }
          : undefined,
        passengers: b.passengers || [],
      }));

      return { bookings };
    } catch (err: any) {
      return { bookings: [], error: err.message };
    }
  },

  /**
   * Lookup a booking by reference code and email.
   */
  async getBookingByReference(
    reference: string,
    email: string
  ): Promise<{ booking: Booking | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { booking: null, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('bookings')
        .select(`
          *,
          flights:flight_id (
            id, flight_number, airline, origin_iata, destination_iata,
            departure_time, arrival_time, base_price, status
          ),
          passengers ( id, first_name, last_name, seat_id )
        `)
        .eq('booking_reference', reference.toUpperCase())
        .eq('contact_email', email.toLowerCase())
        .single();

      if (error) {
        return { booking: null, error: 'Booking not found.' };
      }

      return { booking: data as unknown as Booking };
    } catch (err: any) {
      return { booking: null, error: err.message };
    }
  },

  /**
   * Get booking statistics for the current user.
   */
  async getUserStats(): Promise<{
    stats: any | null;
    error?: string;
  }> {
    if (!isSupabaseConfigured) return { stats: null };
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('get_user_booking_stats');
      if (error) return { stats: null, error: error.message };
      return { stats: data };
    } catch (err: any) {
      return { stats: null, error: err.message };
    }
  },
};
