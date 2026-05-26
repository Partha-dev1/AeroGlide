import { Request, Response, NextFunction } from 'express';
import { flightService } from '../services/flightService';
import { seatRealtimeServer } from '../realtime/SeatRealtimeServer';
import { airportRealtimeServer } from '../realtime/AirportRealtimeServer';


export class FlightController {
  
  // 1. Get Flights Search Results
  async getFlights(req: Request, res: Response, next: NextFunction) {
    try {
      const { origin, destination, date, airline, sortBy } = req.query;
      const results = await flightService.searchFlights({
        origin: origin as string,
        destination: destination as string,
        date: date as string,
        airline: airline as string,
        sortBy: sortBy as 'price' | 'duration' | 'departure' | undefined
      });
      return res.json(results);
    } catch (error) {
      next(error);
    }
  }

  // 2. Get Cabin Seats
  async getFlightSeats(req: Request, res: Response, next: NextFunction) {
    try {
      const flightId = req.params.id;
      const seats = await flightService.getCabinSeats(flightId);
      return res.json(seats);
    } catch (error) {
      next(error);
    }
  }

  // 3. Atomically Lock Seats
  async lockSeats(req: Request, res: Response, next: NextFunction) {
    try {
      const { flight_id, seat_ids, lock_session } = req.body;
      if (!flight_id || !seat_ids || !Array.isArray(seat_ids) || !lock_session) {
        return res.status(400).json({ error: 'Missing flight_id, seat_ids, or lock_session parameters.' });
      }

      const result = await flightService.lockSeats(flight_id, seat_ids, lock_session);
      return res.json(result);
    } catch (error: any) {
      // Return 409 Conflict if lock fails due to seat occupancy or availability
      return res.status(409).json({ error: error.message || 'Seat lock failed.' });
    }
  }

  // 4. Create Booking Transaction
  async createBooking(req: any, res: Response, next: NextFunction) {
    try {
      const { flight_id, user_id, contact_email, contact_phone, total_price, passengers, lock_session } = req.body;
      
      if (!flight_id || !contact_email || !contact_phone || !passengers || !Array.isArray(passengers) || !lock_session) {
        return res.status(400).json({ error: 'Missing mandatory checkout parameters.' });
      }

      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const result = await flightService.createBooking(
        flight_id,
        authenticatedUserId,
        contact_email,
        contact_phone,
        Number(total_price),
        passengers,
        lock_session
      );
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(409).json({ error: error.message || 'Booking checkout failed.' });
    }
  }

  // 5. Lookup Booking by reference & email (PUBLIC — no auth required for guests)
  async lookupBooking(req: any, res: Response, next: NextFunction) {
    try {
      const { reference, email } = req.query;
      if (!reference || !email) {
        return res.status(400).json({ error: 'Both reference and email are required for booking lookup.' });
      }

      // Optional: if authenticated user's token is valid, scope the lookup to their userId.
      // If no auth, pass empty string so flightService skips the user_id filter.
      const authenticatedUserId = req.user?.id || '';

      const booking = await flightService.lookupBooking(reference as string, email as string, authenticatedUserId);
      return res.json(booking);
    } catch (error: any) {
      return res.status(404).json({ error: error.message || 'Booking not found.' });
    }
  }

  // 6. Get Bookings by User ID
  async getUserBookings(req: any, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId;
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId || authenticatedUserId !== userId) {
        return res.status(403).json({ error: 'Access denied. You cannot view bookings for other users.' });
      }

      const bookings = await flightService.getUserBookings(userId);
      return res.json(bookings);
    } catch (error) {
      next(error);
    }
  }

  // 7. Cancel Booking Flow
  async cancelBooking(req: any, res: Response, next: NextFunction) {
    try {
      const { booking_id } = req.body;
      if (!booking_id) {
        return res.status(400).json({ error: 'Missing booking_id.' });
      }

      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const result = await flightService.cancelBooking(booking_id, authenticatedUserId);
      return res.json(result);
    } catch (error: any) {
      // 403 Forbidden for cancellation within 2 hours or invalid state
      return res.status(403).json({ error: error.message || 'Cancellation rejected.' });
    }
  }

  // 8. Reschedule Booking Flow
  async rescheduleBooking(req: any, res: Response, next: NextFunction) {
    try {
      const { booking_id, new_flight_id, new_seat_ids, lock_session } = req.body;
      if (!booking_id || !new_flight_id || !new_seat_ids || !Array.isArray(new_seat_ids) || !lock_session) {
        return res.status(400).json({ error: 'Missing reschedule parameters.' });
      }

      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const result = await flightService.rescheduleBooking(booking_id, new_flight_id, new_seat_ids, lock_session, authenticatedUserId);
      return res.json(result);
    } catch (error: any) {
      return res.status(409).json({ error: error.message || 'Rescheduling rejected.' });
    }
  }

  // 9. Sync/Reconcile Offline Bookings
  async syncOfflineDrafts(req: Request, res: Response, next: NextFunction) {
    try {
      const { drafts, lock_session } = req.body;
      if (!drafts || !Array.isArray(drafts) || !lock_session) {
        return res.status(400).json({ error: 'Invalid sync payload structure or missing lock_session.' });
      }

      const results = await flightService.syncOfflineDrafts(drafts, lock_session);
      return res.json({ synced: results });
    } catch (error) {
      next(error);
    }
  }

  // 10. Search Airports Autocomplete
  async searchAirports(req: Request, res: Response, next: NextFunction) {
    try {
      // Accept both 'q' and 'query' as the search term for backward compatibility
      const searchTerm = (req.query.q as string) || (req.query.query as string);
      if (!searchTerm) {
        return res.status(400).json({ error: 'Search query parameter "q" or "query" is required.' });
      }
      const results = await flightService.searchAirports(searchTerm);
      return res.json(results);
    } catch (error) {
      next(error);
    }
  }

  // 10b. Search Nearby Airports using Geolocation Coordinates
  async searchNearbyAirports(req: Request, res: Response, next: NextFunction) {
    try {
      const { lat, lon, limit } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ error: 'Parameters "lat" and "lon" are required.' });
      }
      const results = await flightService.searchNearbyAirports(
        Number(lat),
        Number(lon),
        limit ? Number(limit) : 5
      );
      return res.json(results);
    } catch (error) {
      next(error);
    }
  }

  // 10c. Stream Airport Real-time Weather, delays, and runway updates using Server-Sent Events (SSE)
  async streamAirportRealtime(req: Request, res: Response, next: NextFunction) {
    try {
      const { iata } = req.params;
      if (!iata) {
        return res.status(400).json({ error: 'Parameter "iata" is required.' });
      }
      
      const client = airportRealtimeServer.addClient(res, iata);
      req.on('close', () => {
        airportRealtimeServer.removeClient(client);
      });
    } catch (error) {
      next(error);
    }
  }

  // 11. Get Live Flight Status & Tracking Info
  async getFlightStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { flight_number, date } = req.query;
      if (!flight_number) {
        return res.status(400).json({ error: 'Flight number query parameter "flight_number" is required.' });
      }
      const statusDate = (date as string) || new Date().toISOString().split('T')[0];
      const status = await flightService.getFlightStatus(flight_number as string, statusDate);
      return res.json(status);
    } catch (error) {
      next(error);
    }
  }

  // 12. Real-Time Seats Updates SSE Stream
  async streamSeats(req: Request, res: Response, next: NextFunction) {
    try {
      const flightId = req.params.id;
      const client = seatRealtimeServer.addClient(res, flightId);
      req.on('close', () => {
        seatRealtimeServer.removeClient(client);
      });
    } catch (error) {
      next(error);
    }
  }

  // 14. Get User Profile (Protected)
  async getProfile(req: any, res: Response, next: NextFunction) {
    try {
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      const profile = await flightService.getProfile(authenticatedUserId);
      return res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  // 15. Update User Profile (Protected)
  async updateProfile(req: any, res: Response, next: NextFunction) {
    try {
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      const updated = await flightService.updateProfile(authenticatedUserId, req.body);
      return res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // 13. Auto-confirm signed up user email (bypasses verification)
  async confirmUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId.' });
      }
      const result = await flightService.confirmUser(userId);
      if (!result.success) {
        return res.status(500).json(result);
      }
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to auto-confirm user.' });
    }
  }
}

export const flightController = new FlightController();

