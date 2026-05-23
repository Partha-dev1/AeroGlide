/**
 * ============================================================
 * FLIGHT SERVICE — AeroGlide Platform (Client-Side Supabase)
 * ============================================================
 * Queries flights directly from Supabase when configured.
 * Falls back to Express API when Supabase is not available.
 * ============================================================
 */

import { getSupabaseClient, isSupabaseConfigured, queryWithRetry } from '../../lib/supabaseClient';
import type { Flight } from '../../types';

export const flightService = {
  /**
   * Search flights by origin, destination, and date.
   * Uses Supabase when configured, Express API as fallback.
   */
  async searchFlights(
    origin: string,
    destination: string,
    date: string
  ): Promise<{ flights: Flight[]; error?: string }> {
    if (!isSupabaseConfigured) {
      return { flights: [], error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();

      // Parse date to get start/end of day for range filter
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const result = await queryWithRetry(async () =>
        client
          .from('flights')
          .select('*')
          .eq('origin_iata', origin.toUpperCase())
          .eq('destination_iata', destination.toUpperCase())
          .gte('departure_time', dayStart.toISOString())
          .lte('departure_time', dayEnd.toISOString())
          .neq('status', 'cancelled')
          .order('departure_time', { ascending: true })
      );

      if (result.error) {
        return { flights: [], error: result.error.message };
      }

      const flights: Flight[] = (result.data || []).map((f: any) => ({
        id: f.id,
        flight_number: f.flight_number,
        airline: f.airline,
        origin: f.origin_iata,
        destination: f.destination_iata,
        departure_time: f.departure_time,
        arrival_time: f.arrival_time,
        base_price: parseFloat(f.base_price),
        status: f.status,
        aircraft_type: f.aircraft_type || '',
        duration_minutes: f.duration_minutes,
      }));

      return { flights };
    } catch (err: any) {
      return { flights: [], error: err.message };
    }
  },

  /**
   * Get a single flight by ID with seat availability counts.
   */
  async getFlightById(flightId: string): Promise<{
    flight: Flight | null;
    availableSeats: number;
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      return { flight: null, availableSeats: 0, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();

      // Fetch flight and count available seats in parallel
      const [flightResult, seatCountResult] = await Promise.all([
        client.from('flights').select('*').eq('id', flightId).single(),
        client
          .from('seats')
          .select('id', { count: 'exact', head: true })
          .eq('flight_id', flightId)
          .eq('status', 'available'),
      ]);

      if (flightResult.error) {
        return { flight: null, availableSeats: 0, error: 'Flight not found.' };
      }

      const f = flightResult.data;
      const flight: Flight = {
        id: f.id,
        flight_number: f.flight_number,
        airline: f.airline,
        origin: f.origin_iata,
        destination: f.destination_iata,
        departure_time: f.departure_time,
        arrival_time: f.arrival_time,
        base_price: parseFloat(f.base_price),
        status: f.status,
        aircraft_type: f.aircraft_type || '',
        duration_minutes: f.duration_minutes,
      };

      return {
        flight,
        availableSeats: seatCountResult.count || 0,
      };
    } catch (err: any) {
      return { flight: null, availableSeats: 0, error: err.message };
    }
  },

  /**
   * Get all seats for a flight, filtering out expired locks.
   */
  async getFlightSeats(
    flightId: string,
    cabinClass?: string
  ): Promise<{ seats: any[]; error?: string }> {
    if (!isSupabaseConfigured) {
      return { seats: [], error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();

      // First, clean up expired locks via RPC
      await client.rpc('cleanup_expired_seat_locks');

      let query = client
        .from('seats')
        .select('*')
        .eq('flight_id', flightId)
        .order('seat_code', { ascending: true });

      if (cabinClass) {
        query = query.eq('cabin_class', cabinClass);
      }

      const { data, error } = await query;

      if (error) {
        return { seats: [], error: error.message };
      }

      // Map to frontend Seat shape
      const seats = (data || []).map((s: any) => ({
        id: s.id,
        flight_id: s.flight_id,
        seat_code: s.seat_code,
        class: s.cabin_class,
        price_multiplier: parseFloat(s.price_modifier),
        status: s.status === 'booked' ? 'occupied' : s.status,
        locked_by: s.lock_session,
        locked_at: s.lock_expires_at,
      }));

      return { seats };
    } catch (err: any) {
      return { seats: [], error: err.message };
    }
  },

  /**
   * Get live flight status.
   */
  async getFlightStatus(
    flightNumber: string
  ): Promise<{ flight: Flight | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { flight: null, error: 'Supabase not configured' };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('flights')
        .select('*')
        .eq('flight_number', flightNumber.toUpperCase())
        .order('departure_time', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        return { flight: null, error: 'Flight not found.' };
      }

      return {
        flight: {
          id: data.id,
          flight_number: data.flight_number,
          airline: data.airline,
          origin: data.origin_iata,
          destination: data.destination_iata,
          departure_time: data.departure_time,
          arrival_time: data.arrival_time,
          base_price: parseFloat(data.base_price),
          status: data.status,
          aircraft_type: data.aircraft_type || '',
          duration_minutes: data.duration_minutes,
        },
      };
    } catch (err: any) {
      return { flight: null, error: err.message };
    }
  },
};
