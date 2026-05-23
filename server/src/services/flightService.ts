import { v4 as uuidv4 } from 'uuid';
import { supabase, useSupabase } from '../config/serverConfig';
import { getAdminClient } from '../config/supabase';
import { getDeterministicUuid } from '../utils/uuid';
import { 
  flightsDb, 
  seatsDb, 
  bookingsDb, 
  passengersDb, 
  reschedulesDb, 
  profilesDb,
  cleanupInMemoryLocks,
  getOrInitSeatsForFlight
} from '../repositories/inMemoryDatabase';
import { Flight, Seat, Booking, Passenger, Reschedule, FlightSearchParams, LiveFlightStatus, Airport, Profile } from '../types/serverTypes';
import { amadeusAdapter } from '../adapters/AmadeusAdapter';
import { fallbackAviationAdapter } from '../adapters/AviationFallbackAdapter';
import { airportsDatabase } from '../repositories/airportsDatabase';
import { aviationCache } from '../cache/AviationCache';
import { seatRealtimeServer } from '../realtime/SeatRealtimeServer';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveFlightId(flightId: string): string {
  if (uuidRegex.test(flightId)) {
    return flightId;
  }
  return getDeterministicUuid(flightId);
}

export class FlightService {
  
  // 1. Search Global Airports (Cached for 1 hour)
  async searchAirports(query: string): Promise<Airport[]> {
    if (!query || query.trim().length < 1) return [];
    
    const cacheKey = `airports:${query.trim().toLowerCase()}`;
    const oneHourMs = 60 * 60 * 1000;

    return aviationCache.getOrFetch<Airport[]>(cacheKey, oneHourMs, async () => {
      return amadeusAdapter.searchAirports(query);
    });
  }

  // 1b. Search Nearby Airports using Geolocation
  async searchNearbyAirports(lat: number, lon: number, limit = 5): Promise<Airport[]> {
    const cacheKey = `airports:nearby:${lat}:${lon}:${limit}`;
    const tenMinutesMs = 10 * 60 * 1000;

    return aviationCache.getOrFetch<Airport[]>(cacheKey, tenMinutesMs, async () => {
      return airportsDatabase.getNearby(lat, lon, limit);
    });
  }

  // 1c. Simulates live airport disruption parameters for real-time SSE stream
  generateAirportDisruption(iata: string) {
    const airport = airportsDatabase.getByIata(iata);
    if (!airport) {
      return {
        iata,
        status: 'operational',
        weather: 'clear',
        windSpeed: 8,
        delayMinutes: 0,
        visibility: 10,
        activeRunways: ['09'],
        timestamp: new Date().toISOString(),
        message: 'Airport status normal.'
      };
    }

    const weathers = ['clear', 'fog', 'storm', 'snow', 'windy'];
    const statuses = ['operational', 'delayed', 'weather-disruption', 'maintenance'];
    
    // Choose weather deterministically or semi-randomly using hash logic
    const timeSec = Math.floor(Date.now() / 60000); // changes every minute
    const sumAscii = iata.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + timeSec;
    
    const weatherIndex = sumAscii % weathers.length;
    const weather = weathers[weatherIndex];
    
    let status = 'operational';
    let delayMinutes = 0;
    let visibility = 10;
    let windSpeed = 5 + (sumAscii % 25);
    let message = 'Skies are clear. Operations normal.';

    if (weather === 'fog') {
      status = 'delayed';
      delayMinutes = 15 + (sumAscii % 30);
      visibility = 1 + (sumAscii % 3);
      message = 'Dense morning fog layer - minor flow control delays reported.';
    } else if (weather === 'storm') {
      status = sumAscii % 3 === 0 ? 'weather-disruption' : 'delayed';
      delayMinutes = 40 + (sumAscii % 60);
      visibility = 2 + (sumAscii % 4);
      windSpeed = 25 + (sumAscii % 20);
      message = status === 'weather-disruption'
        ? 'Heavy thunderstorm cell - landing holds in effect.'
        : 'Active wind shear warning - gate delays up to 45 minutes.';
    } else if (weather === 'snow') {
      status = 'delayed';
      delayMinutes = 20 + (sumAscii % 45);
      visibility = 3 + (sumAscii % 4);
      message = 'Active runway de-icing operations ongoing - minor taxi delays.';
    } else if (weather === 'windy') {
      status = sumAscii % 4 === 0 ? 'delayed' : 'operational';
      delayMinutes = status === 'delayed' ? 10 + (sumAscii % 20) : 0;
      message = `High crosswinds (${windSpeed} knots) - active operations shift.`;
    }

    // Active runway scheduling logic
    const runwaySeed = sumAscii % 3;
    const activeRunways = runwaySeed === 0 
      ? [`${1 + (sumAscii % 30)}R`, `${1 + ((sumAscii + 18) % 30)}L`]
      : [`${1 + (sumAscii % 30)}L`];

    return {
      iata: airport.iata,
      name: airport.name,
      status,
      weather,
      windSpeed,
      delayMinutes,
      visibility,
      activeRunways,
      timestamp: new Date().toISOString(),
      message
    };
  }

  // 2. Search Flights (Cached for 5 minutes)
  async searchFlights(params: FlightSearchParams): Promise<Flight[]> {
    const origin = params.origin?.trim().toUpperCase() || 'JFK';
    const destination = params.destination?.trim().toUpperCase() || 'LHR';
    const date = params.date || new Date().toISOString().split('T')[0];

    const cacheKey = `flights:${origin}:${destination}:${date}:${params.airline || 'all'}:${params.sortBy || 'default'}`;
    const fiveMinutesMs = 5 * 60 * 1000;

    const results = await aviationCache.getOrFetch<Flight[]>(cacheKey, fiveMinutesMs, async () => {
      return amadeusAdapter.searchFlights(params);
    });

    // Share fetched flight models in memory repository so checkout lookups succeed
    results.forEach((flight) => {
      if (!flightsDb.some(f => f.id === flight.id)) {
        flightsDb.push(flight);
      }
    });

    return results;
  }

  // 3. Get Cabin Seats (Dynamic aircraft-based configuration)
  async getCabinSeats(flightIdStr: string): Promise<Seat[]> {
    const flightId = resolveFlightId(flightIdStr);
    if (useSupabase) {
      try {
        const admin = getAdminClient();
        await admin.rpc('cleanup_expired_seat_locks');
        await this.ensureFlightInSupabase(flightId);

        const { data, error } = await admin
          .from('seats')
          .select('*')
          .eq('flight_id', flightId)
          .order('seat_code');

        if (error) throw error;

        // Map to frontend/application Seat shape
        return (data || []).map((s: any) => ({
          id: s.id,
          flight_id: s.flight_id,
          seat_code: s.seat_code,
          class: s.cabin_class,
          price_multiplier: Number(s.price_modifier),
          status: s.status === 'booked' ? 'occupied' : s.status,
          locked_by: s.lock_session,
          locked_at: s.lock_expires_at ? new Date(s.lock_expires_at).toISOString() : null
        }));
      } catch (err: any) {
        console.warn('Supabase seats fetch failed, falling back to In-Memory:', err.message);
      }
    }

    // Fallback in-memory dynamic seat generation
    cleanupInMemoryLocks();

    // Look up flight to fetch aircraft model
    let flight = flightsDb.find(f => f.id === flightId);
    if (!flight) {
      // Create a temporary flight to initialize seats if not cached
      const parts = flightId.split('-');
      const flightNumber = parts[0] || 'AG100';
      const date = parts[1] || new Date().toISOString().split('T')[0];
      flight = {
        id: flightId,
        flight_number: flightNumber,
        airline: 'AeroGlide Express',
        origin: 'JFK',
        destination: 'LHR',
        departure_time: new Date().toISOString(),
        arrival_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        base_price: 350.00,
        status: 'scheduled',
        aircraft_type: 'Boeing 737 MAX 9'
      };
      flightsDb.push(flight);
    }

    return getOrInitSeatsForFlight(flight);
  }

  // 4. Lock Seats atomically and broadcast updates
  async lockSeats(flightIdStr: string, seatIds: string[], lockSession: string): Promise<{ success: boolean; message: string }> {
    const flightId = resolveFlightId(flightIdStr);
    if (useSupabase) {
      try {
        const admin = getAdminClient();
        await this.ensureFlightInSupabase(flightId);
        const { data, error } = await admin.rpc('lock_seats', {
          p_flight_id: flightId,
          p_seat_ids: seatIds,
          p_lock_session: lockSession
        });
        if (error) throw error;

        if (data) {
          return { success: true, message: 'Seats locked successfully.' };
        } else {
          throw new Error('Failed to lock seats. Some seats might already be locked or occupied.');
        }
      } catch (err: any) {
        console.warn('Supabase lock RPC failed, falling back to In-Memory:', err.message);
      }
    }

    // Fallback in-memory
    cleanupInMemoryLocks();
    
    const flightSeats = seatsDb.filter(s => s.flight_id === flightId);
    const targetSeats = flightSeats.filter(s => seatIds.includes(s.id));

    if (targetSeats.length !== seatIds.length) {
      throw new Error('Some seat IDs were not found for this flight cabin.');
    }

    const isLockable = targetSeats.every(s => s.status === 'available' || (s.status === 'locked' && s.locked_by === lockSession));
    if (!isLockable) {
      throw new Error('Failed to lock seats. One or more seats are already locked or occupied.');
    }

    // Lock atomically
    targetSeats.forEach(s => {
      s.status = 'locked';
      s.locked_by = lockSession;
      s.locked_at = new Date().toISOString();
    });

    // Real-time broadcast updated seat matrix to watching clients
    const updatedSeats = seatsDb.filter(s => s.flight_id === flightId);
    seatRealtimeServer.broadcastSeatsUpdate(flightId, updatedSeats);

    return { success: true, message: 'Seats locked successfully (In-Memory).' };
  }

  // 5. Create Booking checkout and occupied seat changes
  async createBooking(
    flightIdStr: string, 
    userId: string, 
    contactEmail: string, 
    contactPhone: string, 
    totalPrice: number, 
    passengers: any[], 
    lockSession: string
  ): Promise<{ booking_id: string; booking_reference: string; message: string }> {
    const flightId = resolveFlightId(flightIdStr);
    if (!userId) {
      throw new Error('Authentication required for booking checkout.');
    }
    
    if (useSupabase) {
      try {
        const admin = getAdminClient();
        await this.ensureFlightInSupabase(flightId);
        const { data, error } = await admin.rpc('create_booking_transaction', {
          p_flight_id: flightId,
          p_user_id: userId || null,
          p_contact_email: contactEmail,
          p_contact_phone: contactPhone,
          p_total_price: totalPrice,
          p_passengers: passengers,
          p_lock_session: lockSession
        });
        
        if (error) throw error;
        return {
          booking_id: data.booking_id,
          booking_reference: data.booking_reference,
          message: 'Booking created successfully.'
        };
      } catch (err: any) {
        console.warn('Supabase booking creation RPC failed, falling back to In-Memory:', err.message);
        if (err.message.includes('not locked by session') || err.message.includes('already taken')) {
          throw err;
        }
      }
    }

    // Fallback in-memory
    cleanupInMemoryLocks();

    const seatIds = passengers.map(p => p.seat_id);
    const targetSeats = seatsDb.filter(s => s.flight_id === flightId && seatIds.includes(s.id));

    const validLocks = targetSeats.every(s => s.status === 'locked' && s.locked_by === lockSession);
    if (!validLocks || targetSeats.length !== seatIds.length) {
      throw new Error('Seat locks expired or invalid. Please select seats and check out again.');
    }

    // Generate reference
    let ref = '';
    do {
      ref = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (bookingsDb.some(b => b.booking_reference === ref));

    const newBookingId = uuidv4();
    const newBooking: Booking = {
      id: newBookingId,
      booking_reference: ref,
      flight_id: flightId,
      user_id: userId,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      total_price: totalPrice,
      status: 'confirmed',
      created_at: new Date().toISOString()
    };

    bookingsDb.push(newBooking);

    // Save travelers and occupy seats
    passengers.forEach(p => {
      const newPassenger: Passenger = {
        id: uuidv4(),
        booking_id: newBookingId,
        first_name: p.first_name,
        last_name: p.last_name,
        passport_number: p.passport_number,
        seat_id: p.seat_id
      };
      passengersDb.push(newPassenger);

      const seat = seatsDb.find(s => s.id === p.seat_id);
      if (seat) {
        seat.status = 'occupied';
        seat.locked_by = null;
        seat.locked_at = null;
      }
    });

    // Real-time broadcast updated seat matrix
    const updatedSeats = seatsDb.filter(s => s.flight_id === flightId);
    seatRealtimeServer.broadcastSeatsUpdate(flightId, updatedSeats);

    return {
      booking_id: newBookingId,
      booking_reference: ref,
      message: 'Booking created successfully (In-Memory).'
    };
  }


  // 6. Look up Booking Details
  async lookupBooking(reference: string, email: string, userId: string): Promise<any> {
    if (useSupabase && supabase) {
      try {
        let query = supabase
          .from('bookings')
          .select(`
            *,
            flight:flights(*),
            passengers(*, seat:seats(*))
          `)
          .eq('booking_reference', reference.toUpperCase())
          .eq('contact_email', email);

        // Only scope by user_id when an authenticated userId is provided
        if (userId) {
          query = query.eq('user_id', userId);
        }

        const { data: bookings, error: bError } = await query.maybeSingle();

        if (bError) throw bError;
        if (bookings) return bookings;
      } catch (err: any) {
        console.warn('Supabase booking lookup failed, falling back to In-Memory:', err.message);
      }
    }

    // Fallback in-memory
    const booking = bookingsDb.find(
      b => b.booking_reference === reference.toUpperCase() && 
           b.contact_email.toLowerCase() === email.toLowerCase() &&
           // Only filter by userId when provided (guest lookup omits this check)
           (!userId || b.user_id === userId)
    );

    if (!booking) {
      throw new Error('No booking found with this reference and email.');
    }

    const flight = flightsDb.find(f => f.id === booking.flight_id);
    const passengers = passengersDb
      .filter(p => p.booking_id === booking.id)
      .map(p => {
        const seat = seatsDb.find(s => s.id === p.seat_id);
        return { ...p, seat };
      });

    return {
      ...booking,
      flight,
      passengers
    };
  }

  // 7. Fetch Bookings by User ID
  async getUserBookings(userId: string): Promise<any[]> {
    if (useSupabase && supabase) {
      try {
        const admin = getAdminClient();
        const { data, error } = await admin
          .from('bookings')
          .select(`
            *,
            flight:flights(*),
            passengers(*, seat:seats(*))
          `)
          .eq('user_id', userId);
        
        if (error) throw error;
        return data || [];
      } catch (err: any) {
        console.warn('Supabase user bookings fetch failed, falling back to In-Memory:', err.message);
      }
    }

    // Fallback in-memory
    const userBookings = bookingsDb.filter(b => b.user_id === userId);
    return userBookings.map(booking => {
      const flight = flightsDb.find(f => f.id === booking.flight_id);
      const passengers = passengersDb
        .filter(p => p.booking_id === booking.id)
        .map(p => {
          const seat = seatsDb.find(s => s.id === p.seat_id);
          return { ...p, seat };
        });
      return { ...booking, flight, passengers };
    });
  }

  // 8. Live Flight tracking progress coordinator
  async getFlightStatus(flightNumber: string, date: string): Promise<LiveFlightStatus> {
    return amadeusAdapter.getFlightStatus(flightNumber, date);
  }

  // 9. Cancel Booking and release seats
  async cancelBooking(bookingId: string, userId: string): Promise<{ success: boolean; message: string }> {
    if (useSupabase && supabase) {
      try {
        const admin = getAdminClient();
        const { data, error } = await admin.rpc('cancel_booking_transaction', {
          p_booking_id: bookingId,
          p_user_id: userId
        });

        if (error) {
          if (error.message.includes('Cancellation is not allowed')) {
            throw new Error(error.message);
          }
          throw error;
        }

        if (!data) {
          throw new Error('Failed to cancel booking or access denied.');
        }

        return { success: true, message: 'Booking cancelled successfully.' };
      } catch (err: any) {
        console.warn('Supabase booking cancellation failed, falling back to In-Memory:', err.message);
        if (err.message.includes('not allowed') || err.message.includes('access denied') || err.message.includes('not found')) {
          throw err;
        }
      }
    }

    // Fallback in-memory
    const booking = bookingsDb.find(b => b.id === bookingId && b.user_id === userId);
    if (!booking) throw new Error('Booking not found or access denied.');
    if (booking.status === 'cancelled') throw new Error('Booking is already cancelled.');

    const flight = flightsDb.find(f => f.id === booking.flight_id);
    if (!flight) throw new Error('Associated flight not found.');

    // Enforce 2-hour late cancellation block
    const departure = new Date(flight.departure_time).getTime();
    const timeDifference = departure - Date.now();
    const twoHoursInMs = 2 * 60 * 60 * 1000;

    if (timeDifference < twoHoursInMs) {
      throw new Error('Cancellation is not allowed within 2 hours of flight departure time.');
    }

    booking.status = 'cancelled';
    const bookingPassengers = passengersDb.filter(p => p.booking_id === bookingId);
    bookingPassengers.forEach(p => {
      const seat = seatsDb.find(s => s.id === p.seat_id);
      if (seat) {
        seat.status = 'available';
        seat.locked_by = null;
        seat.locked_at = null;
      }
    });

    // Realtime broadcast updated seat releases
    const updatedSeats = seatsDb.filter(s => s.flight_id === booking.flight_id);
    seatRealtimeServer.broadcastSeatsUpdate(booking.flight_id, updatedSeats);

    return { success: true, message: 'Booking cancelled successfully (In-Memory).' };
  }

  // 10. Reschedule ticket booking to new flight dates
  async rescheduleBooking(
    bookingId: string, 
    newFlightIdStr: string, 
    newSeatIds: string[], 
    lockSession: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const newFlightId = resolveFlightId(newFlightIdStr);
    if (useSupabase && supabase) {
      try {
        const admin = getAdminClient();
        await this.ensureFlightInSupabase(newFlightIdStr);
        const { data: booking, error: bErr } = await admin
          .from('bookings')
          .select('*, passengers(id, seat_id)')
          .eq('id', bookingId)
          .eq('user_id', userId)
          .single();
        if (bErr || !booking) throw new Error('Booking not found or access denied.');

        // Check if seats are already locked by the current lock session or are available
        const { data: seatsData, error: seatsErr } = await admin
          .from('seats')
          .select('id, status, lock_session')
          .in('id', newSeatIds);
        
        if (seatsErr) throw seatsErr;
        
        const canLockAll = (seatsData || []).every(
          (s: any) => s.status === 'available' || (s.status === 'locked' && s.lock_session === lockSession)
        );
        
        if (!canLockAll) {
          throw new Error('New seats are not available or locking session expired.');
        }
        
        // Lock only the seats that are currently 'available'
        const availableSeatIds = (seatsData || [])
          .filter((s: any) => s.status === 'available')
          .map((s: any) => s.id);
          
        if (availableSeatIds.length > 0) {
          const { data: lockSuccess, error: lockErr } = await admin.rpc('lock_seats', {
            p_flight_id: newFlightId,
            p_seat_ids: availableSeatIds,
            p_lock_session: lockSession
          });
          if (lockErr) throw lockErr;
          if (!lockSuccess) {
            throw new Error('New seats are not available or locking session expired.');
          }
        }

        const passengerSeats = booking.passengers.map((p: any, idx: number) => ({
          passenger_id: p.id,
          seat_id: newSeatIds[idx]
        }));

        // Fetch seat price multipliers to calculate new fare
        const { data: seatRows } = await admin
          .from('seats')
          .select('price_multiplier')
          .in('id', newSeatIds);

        const { data: flightRow } = await admin
          .from('flights')
          .select('base_price')
          .eq('id', newFlightId)
          .single();

        const basePrice = Number(flightRow?.base_price || 0);
        const newSeatsCost = (seatRows || []).reduce((acc: number, s: any) => acc + basePrice * Number(s.price_multiplier || 1), 0);
        const fee = 1500.00; // Flat INR 1500 reschedule fee (approx 18 USD)
        const newTotalPrice = newSeatsCost + fee;

        const { data: rescheduleSuccess, error: rpcErr } = await admin.rpc('reschedule_booking_transaction', {
          p_booking_id: bookingId,
          p_user_id: userId,
          p_new_flight_id: newFlightId,
          p_passenger_seats: passengerSeats,
          p_new_total_price: newTotalPrice,
          p_fee: fee,
          p_reason: 'Passenger requested flight rescheduling.'
        });

        if (rpcErr) throw rpcErr;
        if (!rescheduleSuccess) throw new Error('Rescheduling transaction failed.');

        return { success: true, message: 'Booking rescheduled successfully.' };
      } catch (err: any) {
        console.warn('Supabase rescheduling transaction failed, falling back to In-Memory:', err.message);
        if (err.message.includes('not found') || err.message.includes('access denied') || err.message.includes('not available')) {
          throw err;
        }
      }
    }

    // Fallback in-memory
    cleanupInMemoryLocks();

    const booking = bookingsDb.find(b => b.id === bookingId && b.user_id === userId);
    if (!booking) throw new Error('Booking not found or access denied.');

    const oldFlightId = booking.flight_id;
    const newFlight = flightsDb.find(f => f.id === newFlightId);
    if (!newFlight) throw new Error('New flight not found.');

    const newSeats = seatsDb.filter(s => s.flight_id === newFlightId && newSeatIds.includes(s.id));
    const validLocks = newSeats.every(s => s.status === 'locked' && s.locked_by === lockSession);

    if (!validLocks || newSeats.length !== newSeatIds.length) {
      throw new Error('New seat selections expired. Please reselect.');
    }

    // Free old seats
    const bookingPassengers = passengersDb.filter(p => p.booking_id === bookingId);
    bookingPassengers.forEach(p => {
      const oldSeat = seatsDb.find(s => s.id === p.seat_id);
      if (oldSeat) {
        oldSeat.status = 'available';
        oldSeat.locked_by = null;
        oldSeat.locked_at = null;
      }
    });

    // Assign new seats
    bookingPassengers.forEach((p, idx) => {
      const newSeatId = newSeatIds[idx];
      p.seat_id = newSeatId;

      const newSeat = seatsDb.find(s => s.id === newSeatId);
      if (newSeat) {
        newSeat.status = 'occupied';
        newSeat.locked_by = null;
        newSeat.locked_at = null;
      }
    });

    const fee = 1500.00;
    reschedulesDb.push({
      id: uuidv4(),
      booking_id: bookingId,
      old_flight_id: oldFlightId,
      new_flight_id: newFlightId,
      fee,
      reason: 'Passenger requested flight rescheduling.',
      created_at: new Date().toISOString()
    });

    booking.flight_id = newFlightId;
    booking.status = 'rescheduled';
    
    // Calculate new total price in fallback
    const seatRows = seatsDb.filter(s => newSeatIds.includes(s.id));
    const basePrice = newFlight.base_price;
    const newSeatsCost = seatRows.reduce((acc, s) => acc + basePrice * s.price_multiplier, 0);
    booking.total_price = newSeatsCost + fee;

    // Realtime broadcast dynamic seat shifts to both old and new flight cabins
    const oldSeatsUpdated = seatsDb.filter(s => s.flight_id === oldFlightId);
    const newSeatsUpdated = seatsDb.filter(s => s.flight_id === newFlightId);
    seatRealtimeServer.broadcastSeatsUpdate(oldFlightId, oldSeatsUpdated);
    seatRealtimeServer.broadcastSeatsUpdate(newFlightId, newSeatsUpdated);

    return { success: true, message: 'Booking rescheduled successfully (In-Memory).' };
  }

  // 11. Reconcile/sync offline passenger checkout drafts
  async syncOfflineDrafts(drafts: any[], lockSession: string): Promise<any[]> {
    const results: any[] = [];

    for (const draft of drafts) {
      const { temp_ref, flight_id: rawFlightId, user_id, contact_email, contact_phone, total_price, passengers } = draft;
      const flight_id = resolveFlightId(rawFlightId);
      const seatIds = passengers.map((p: any) => p.seat_id);

      try {
        let syncSuccess = false;
        let bookingData: any = null;

        if (useSupabase && supabase) {
          const admin = getAdminClient();
          await this.ensureFlightInSupabase(rawFlightId);
          const { data: isLocked } = await admin.rpc('lock_seats', {
            p_flight_id: flight_id,
            p_seat_ids: seatIds,
            p_lock_session: lockSession
          });

          if (isLocked) {
            const { data: txData, error: txError } = await admin.rpc('create_booking_transaction', {
              p_flight_id: flight_id,
              p_user_id: user_id || null,
              p_contact_email: contact_email,
              p_contact_phone: contact_phone,
              p_total_price: total_price,
              p_passengers: passengers,
              p_lock_session: lockSession
            });

            if (!txError && txData) {
              syncSuccess = true;
              bookingData = txData;
            } else {
              throw new Error(txError?.message || 'Transaction error during sync.');
            }
          } else {
            throw new Error('Failed to lock seats during synchronization.');
          }
        } else {
          // Fallback in-memory
          cleanupInMemoryLocks();
          const targetSeats = seatsDb.filter(s => s.flight_id === flight_id && seatIds.includes(s.id));
          const allAvailable = targetSeats.length === seatIds.length && targetSeats.every(s => s.status === 'available');

          if (allAvailable) {
            let ref = '';
            do {
              ref = Math.random().toString(36).substring(2, 8).toUpperCase();
            } while (bookingsDb.some(b => b.booking_reference === ref));

            const newBookingId = uuidv4();
            bookingsDb.push({
              id: newBookingId,
              booking_reference: ref,
              flight_id,
              user_id: user_id || null,
              contact_email,
              contact_phone,
              total_price,
              status: 'confirmed',
              created_at: new Date().toISOString()
            });

            passengers.forEach((p: any) => {
              passengersDb.push({
                id: uuidv4(),
                booking_id: newBookingId,
                first_name: p.first_name,
                last_name: p.last_name,
                passport_number: p.passport_number,
                seat_id: p.seat_id
              });

              const seat = seatsDb.find(s => s.id === p.seat_id);
              if (seat) seat.status = 'occupied';
            });

            syncSuccess = true;
            bookingData = { booking_id: newBookingId, booking_reference: ref };
          } else {
            throw new Error('One or more seats have already been taken by another passenger.');
          }
        }

        // Realtime broadcast updated seat holdings
        const updatedSeats = seatsDb.filter(s => s.flight_id === flight_id);
        seatRealtimeServer.broadcastSeatsUpdate(flight_id, updatedSeats);

        results.push({ temp_ref, success: true, booking: bookingData });
      } catch (err: any) {
        results.push({ temp_ref, success: false, error: err.message || 'Sync failed.' });
      }
    }

    return results;
  }

  // 12. Lazy-load/ensure flight exists in Supabase
  async ensureFlightInSupabase(flightIdStr: string): Promise<void> {
    const flightId = resolveFlightId(flightIdStr);
    try {
      const admin = getAdminClient();
      // Check if flight exists in database
      const { data: flight, error } = await admin
        .from('flights')
        .select('id')
        .eq('id', flightId)
        .maybeSingle();

      if (error) throw error;
      if (flight) {
        // Flight already exists
        return;
      }

      // If it doesn't exist, we must fetch details and insert it
      let flightDetail = flightsDb.find(f => f.id === flightId);
      if (!flightDetail) {
        // Create a default/fallback flight using the original flightIdStr if it's compound
        let flightNumber = 'AG100';
        let date = new Date().toISOString().split('T')[0];
        if (flightIdStr && flightIdStr.includes('-') && flightIdStr.length > 10 && !flightIdStr.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i)) {
          const parts = flightIdStr.split('-');
          flightNumber = parts[0] || 'AG100';
          date = parts.slice(1).join('-');
        }
        
        flightDetail = {
          id: flightId,
          flight_number: flightNumber,
          airline: 'AeroGlide Express',
          origin: 'JFK',
          destination: 'LHR',
          departure_time: new Date(date).toISOString(),
          arrival_time: new Date(new Date(date).getTime() + 6 * 60 * 60 * 1000).toISOString(),
          base_price: 350.00,
          status: 'scheduled',
          aircraft_type: 'Boeing 737 MAX 9'
        };
      }
      
      // Before inserting, check if origin and destination airports exist in the database
      await this.ensureAirportInSupabase(flightDetail.origin);
      await this.ensureAirportInSupabase(flightDetail.destination);

      // Map simulated/external flight status to database-compatible flight_status enum
      const validStatusMap: Record<string, string> = {
        'scheduled': 'scheduled',
        'boarding': 'boarding',
        'departed': 'departed',
        'landed': 'landed',
        'cancelled': 'cancelled',
        'delayed': 'delayed',
        'completed': 'landed' // Map local completed state to db landed state
      };
      const dbStatus = validStatusMap[flightDetail.status] || 'scheduled';

      // Insert flight
      const { error: insertErr } = await admin
        .from('flights')
        .insert({
          id: flightDetail.id,
          flight_number: flightDetail.flight_number,
          airline: flightDetail.airline,
          origin_iata: flightDetail.origin,
          destination_iata: flightDetail.destination,
          departure_time: flightDetail.departure_time,
          arrival_time: flightDetail.arrival_time,
          duration_minutes: Math.max(1, Math.round((new Date(flightDetail.arrival_time).getTime() - new Date(flightDetail.departure_time).getTime()) / 60000)),
          base_price: flightDetail.base_price,
          status: dbStatus,
          aircraft_type: flightDetail.aircraft_type
        });

      if (insertErr) throw insertErr;

      // Seed seats for the new flight
      await this.seedSeatsInSupabase(flightDetail);

    } catch (err: any) {
      console.error('Error in ensureFlightInSupabase:', err.message);
      throw err;
    }
  }

  // 13. Lazy-seed seats for a flight in Supabase
  async seedSeatsInSupabase(flight: Flight): Promise<void> {
    try {
      const admin = getAdminClient();
      const type = (flight.aircraft_type || 'Boeing 737 MAX 9').toUpperCase();
      const isWideBody = type.includes('777') || type.includes('350') || type.includes('DREAMLINER');
      const rowsCount = isWideBody ? 40 : 30;

      const seatsToInsert = [];

      for (let r = 1; r <= rowsCount; r++) {
        let seatClass = 'economy';
        let multiplier = 1.00;

        if (r <= (isWideBody ? 4 : 2)) {
          seatClass = 'first';
          multiplier = 3.00;
        } else if (r <= (isWideBody ? 10 : 5)) {
          seatClass = 'business';
          multiplier = 1.80;
        }

        const columns = isWideBody 
          ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K']
          : ['A', 'B', 'C', 'D', 'E', 'F'];

        for (const col of columns) {
          const sumAscii = r + col.charCodeAt(0);
          const isOccupied = sumAscii % 9 === 0;

          seatsToInsert.push({
            id: getDeterministicUuid(`${flight.id}-${r}${col}`), // Deterministic UUID so seats are stable
            flight_id: flight.id,
            seat_code: `${r}${col}`,
            cabin_class: seatClass,
            price_modifier: multiplier,
            status: isOccupied ? 'booked' : 'available'
          });
        }
      }

      // Bulk insert in chunks of 100 to avoid query size limits
      for (let i = 0; i < seatsToInsert.length; i += 100) {
        const chunk = seatsToInsert.slice(i, i + 100);
        const { error } = await admin
          .from('seats')
          .insert(chunk);

        if (error && error.code !== '23505' && !error.message.includes('duplicate key')) {
          throw error;
        }
      }
    } catch (err: any) {
      console.error('Error in seedSeatsInSupabase:', err.message);
      throw err;
    }
  }

  // 14. Ensure airport exists in Supabase to satisfy foreign keys
  async ensureAirportInSupabase(iataCode: string): Promise<void> {
    try {
      const admin = getAdminClient();
      const { data: airport, error } = await admin
        .from('airports')
        .select('iata')
        .eq('iata', iataCode.toUpperCase())
        .maybeSingle();

      if (error) throw error;
      if (airport) return;

      // Fetch details from local database if available
      const details = airportsDatabase.getByIata(iataCode);
      const name = details?.name || `${iataCode} Airport`;
      const city = details?.city || 'Unknown City';
      const country = details?.country || 'Unknown Country';
      const lat = details?.latitude || 0;
      const lon = details?.longitude || 0;
      const tz = details?.timezone || 'UTC';
      const icao = details?.icao || iataCode; // Fallback

      const { error: insertErr } = await admin
        .from('airports')
        .insert({
          iata: iataCode.toUpperCase(),
          name,
          airport_name: name,
          icao,
          city,
          country,
          latitude: lat,
          longitude: lon,
          timezone: tz,
          is_international: true,
          airport_type: 'international'
        });

      if (insertErr) throw insertErr;
    } catch (err: any) {
      console.error(`Error ensuring airport ${iataCode} in database:`, err.message);
    }
  }

  // 13b. Get User Profile
  async getProfile(userId: string): Promise<Profile> {
    if (!useSupabase) {
      let profile = profilesDb.find(p => p.id === userId);
      if (!profile) {
        profile = {
          id: userId,
          full_name: 'Passenger',
          gender: 'unspecified'
        };
        profilesDb.push(profile);
      }
      return profile;
    }

    try {
      const admin = getAdminClient();
      let { data, error } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
      
      if (error) throw error;

      if (!data) {
        // Auto-create user profile if missing in Supabase (self-healing boundary)
        const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
        const fullName = userData?.user?.user_metadata?.full_name || userData?.user?.email?.split('@')[0] || 'Passenger';
        
        const { data: newProfile, error: insErr } = await admin
          .from('profiles')
          .upsert({ id: userId, full_name: fullName }, { onConflict: 'id' })
          .select('*')
          .single();
        
        if (insErr) throw insErr;
        return newProfile;
      }
      
      return data;
    } catch (err: any) {
      console.error(`❌ Failed to retrieve user profile for ${userId}:`, err.message);
      throw err;
    }
  }

  // 13c. Update User Profile
  async updateProfile(userId: string, profileData: Partial<Profile>): Promise<Profile> {
    if (!useSupabase) {
      let profile = profilesDb.find(p => p.id === userId);
      if (!profile) {
        profile = { id: userId, full_name: 'Passenger' };
        profilesDb.push(profile);
      }
      Object.assign(profile, profileData);
      return profile;
    }

    try {
      const admin = getAdminClient();
      const cleanData = { ...profileData };
      delete (cleanData as any).id;
      delete (cleanData as any).created_at;
      delete (cleanData as any).updated_at;

      const { data, error } = await admin
        .from('profiles')
        .update({
          ...cleanData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error(`❌ Failed to update user profile for ${userId}:`, err.message);
      throw err;
    }
  }

  // 14. Auto-confirm signed up user email
  async confirmUser(userId: string): Promise<{ success: boolean; message: string }> {
    if (!useSupabase) {
      return { success: true, message: 'User email confirmed (in-memory fallback).' };
    }
    try {
      const admin = getAdminClient();
      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        email_confirm: true
      });
      if (error) throw error;
      return { success: true, message: 'User email confirmed via admin client.' };
    } catch (err: any) {
      console.error('❌ Supabase admin confirmation failed:', err.message);
      return { success: false, message: `Failed to confirm email: ${err.message}` };
    }
  }
}

export const flightService = new FlightService();
