/**
 * ============================================================
 * FLIGHT REPOSITORY — AeroGlide Server
 * ============================================================
 * Server-side flight queries using supabaseAdmin.
 * Provides caching layer for frequently accessed data.
 * ============================================================
 */

import { getAdminClient, isSupabaseAdminConfigured, supabase } from '../config/supabase';

// Simple in-memory cache for flight data
const flightCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 60_000; // 1 minute

export const flightRepository = {
  /**
   * Search flights by route and date.
   */
  async searchFlights(
    origin: string,
    destination: string,
    date: string
  ): Promise<{ flights: any[]; error?: string }> {
    const client = supabase;
    if (!client) return { flights: [], error: 'Supabase not configured' };

    try {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const { data, error } = await client
        .from('flights')
        .select('*')
        .eq('origin_iata', origin.toUpperCase())
        .eq('destination_iata', destination.toUpperCase())
        .gte('departure_time', dayStart.toISOString())
        .lte('departure_time', dayEnd.toISOString())
        .neq('status', 'cancelled')
        .order('departure_time', { ascending: true });

      if (error) return { flights: [], error: error.message };
      return { flights: data || [] };
    } catch (err: any) {
      return { flights: [], error: err.message };
    }
  },

  /**
   * Get flight by ID with caching.
   */
  async getFlightById(flightId: string): Promise<{
    flight: any | null;
    error?: string;
  }> {
    // Check cache
    const cacheKey = `flight_${flightId}`;
    const cached = flightCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { flight: cached.data };
    }

    const client = supabase;
    if (!client) return { flight: null, error: 'Supabase not configured' };

    try {
      const { data, error } = await client
        .from('flights')
        .select('*')
        .eq('id', flightId)
        .single();

      if (error) return { flight: null, error: error.message };

      // Cache result
      flightCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + CACHE_TTL,
      });

      return { flight: data };
    } catch (err: any) {
      return { flight: null, error: err.message };
    }
  },

  /**
   * Get seats for a flight.
   */
  async getFlightSeats(flightId: string): Promise<{
    seats: any[];
    error?: string;
  }> {
    const client = supabase;
    if (!client) return { seats: [], error: 'Supabase not configured' };

    try {
      // Clean expired locks first
      if (isSupabaseAdminConfigured) {
        const admin = getAdminClient();
        await admin.rpc('cleanup_expired_seat_locks');
      }

      const { data, error } = await client
        .from('seats')
        .select('*')
        .eq('flight_id', flightId)
        .order('seat_code', { ascending: true });

      if (error) return { seats: [], error: error.message };
      return { seats: data || [] };
    } catch (err: any) {
      return { seats: [], error: err.message };
    }
  },

  /**
   * Get flight status by flight number.
   */
  async getFlightStatus(flightNumber: string): Promise<{
    flight: any | null;
    error?: string;
  }> {
    const client = supabase;
    if (!client) return { flight: null, error: 'Supabase not configured' };

    try {
      const { data, error } = await client
        .from('flights')
        .select('*')
        .eq('flight_number', flightNumber.toUpperCase())
        .order('departure_time', { ascending: false })
        .limit(1)
        .single();

      if (error) return { flight: null, error: 'Flight not found.' };
      return { flight: data };
    } catch (err: any) {
      return { flight: null, error: err.message };
    }
  },

  /**
   * Invalidate flight cache entry.
   */
  invalidateCache(flightId?: string) {
    if (flightId) {
      flightCache.delete(`flight_${flightId}`);
    } else {
      flightCache.clear();
    }
  },
};
