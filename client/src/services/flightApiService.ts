/**
 * API Service Client for backend integration
 */

import { APP_CONFIG } from '../config/appConfig';
import { Flight, Seat, Booking, OfflineBookingDraft, Passenger, Airport, LiveFlightStatus, Profile } from '../types';

class FlightApiService {
  private baseUrl = APP_CONFIG.API_URL;
  private token: string | null = null;

  setAuthToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    let activeToken = this.token;

    // 1. Dynamically retrieve a fresh token from Supabase Client active session if available
    try {
      const { getSupabaseClient, isSupabaseConfigured } = require('../lib/supabaseClient');
      if (isSupabaseConfigured) {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          activeToken = session.access_token;
          this.token = activeToken; // Update local cache
        }
      }
    } catch (supabaseErr) {
      // Bypassed if Supabase library is not fully initialized or in fallback sandbox
    }

    // 2. Fallback to Zustand Store token if Supabase has not fully loaded
    if (!activeToken) {
      try {
        const { useStore } = require('../store');
        const storeToken = useStore.getState().authToken;
        if (storeToken) {
          activeToken = storeToken;
          this.token = activeToken;
        }
      } catch (storeErr) {
        // Zustand store not initialized yet
      }
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
      ...(options?.headers || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    // 3. Handle Unauthorized (401) errors automatically (Self-Healing session boundary)
    if (res.status === 401) {
      this.token = null;
      try {
        const { useStore } = require('../store');
        useStore.getState().logoutUser();
      } catch (storeErr) {
        console.warn('⚠️ API Client failed to trigger automated logout:', storeErr);
      }
      throw new Error('Your session has expired. Please sign in again.');
    }

    if (!res.ok) {
      let errorMsg = 'An error occurred';
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch {
        errorMsg = res.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return res.json() as Promise<T>;
  }

  // 1. Search Flights
  async searchFlights(origin: string, destination: string, date: string): Promise<Flight[]> {
    return this.request<Flight[]>(`/api/flights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(date)}`, {
      method: 'GET',
    });
  }

  // 2. Get Seats for a Flight
  async getFlightSeats(flightId: string): Promise<Seat[]> {
    return this.request<Seat[]>(`/api/flights/${flightId}/seats`, {
      method: 'GET',
    });
  }

  // 3. Lock Seats
  async lockSeats(flightId: string, seatIds: string[], lockSession: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/bookings/lock-seats`, {
      method: 'POST',
      body: JSON.stringify({
        flight_id: flightId,
        seat_ids: seatIds,
        lock_session: lockSession,
      }),
    });
  }

  // 4. Create Booking
  async createBooking(bookingData: {
    flight_id: string;
    user_id: string | null;
    contact_email: string;
    contact_phone: string;
    total_price: number;
    passengers: Passenger[];
    lock_session: string;
  }): Promise<{ success: boolean; booking_id: string; booking_reference: string }> {
    return this.request<{ success: boolean; booking_id: string; booking_reference: string }>(`/api/bookings`, {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  // 5. Look up Booking
  async lookupBooking(reference: string, email: string): Promise<Booking> {
    return this.request<Booking>(`/api/bookings/lookup?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`, {
      method: 'GET',
    });
  }

  // 6. Get User Bookings
  async getUserBookings(userId: string): Promise<Booking[]> {
    return this.request<Booking[]>(`/api/bookings/user/${userId}`, {
      method: 'GET',
    });
  }

  // 7. Cancel Booking
  async cancelBooking(bookingId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/bookings/cancel`, {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId }),
    });
  }

  // 8. Reschedule Booking
  async rescheduleBooking(
    bookingId: string,
    newFlightId: string,
    newSeatIds: string[],
    lockSession: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/bookings/reschedule`, {
      method: 'POST',
      body: JSON.stringify({
        booking_id: bookingId,
        new_flight_id: newFlightId,
        new_seat_ids: newSeatIds,
        lock_session: lockSession,
      }),
    });
  }

  // 9. Sync Offline Booking Drafts
  async syncOfflineDrafts(
    drafts: OfflineBookingDraft[],
    lockSession: string
  ): Promise<{
    success: boolean;
    synced: Array<{
      temp_ref: string;
      success: boolean;
      booking_id?: string;
      booking_reference?: string;
      error?: string;
    }>;
  }> {
    return this.request<{
      success: boolean;
      synced: Array<{
        temp_ref: string;
        success: boolean;
        booking_id?: string;
        booking_reference?: string;
        error?: string;
      }>;
    }>(`/api/bookings/offline-sync`, {
      method: 'POST',
      body: JSON.stringify({
        drafts,
        lock_session: lockSession,
      }),
    });
  }
  // 10. Search Airports Autocomplete
  async searchAirports(query: string): Promise<Airport[]> {
    return this.request<Airport[]>(`/api/airports/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  }

  // 11. Get Live Flight Status & Tracking
  async getFlightStatus(flightNumber: string, date?: string): Promise<LiveFlightStatus> {
    const dateParam = date ? `&date=${encodeURIComponent(date)}` : '';
    return this.request<LiveFlightStatus>(`/api/flights/status?flight_number=${encodeURIComponent(flightNumber)}${dateParam}`, {
      method: 'GET',
    });
  }

  // 12. Get User Profile
  async getProfile(): Promise<Profile> {
    return this.request<Profile>(`/api/profile`, {
      method: 'GET',
    });
  }

  // 13. Update User Profile
  async updateProfile(profileData: Partial<Profile>): Promise<Profile> {
    return this.request<Profile>(`/api/profile`, {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }
}

export const flightApiService = new FlightApiService();
