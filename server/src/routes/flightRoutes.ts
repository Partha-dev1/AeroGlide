import { Router } from 'express';
import { flightController } from '../controllers/flightController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Flights search, status, and seats retrieval
router.get('/flights', flightController.getFlights);
router.get('/flights/status', flightController.getFlightStatus);
router.get('/flights/:id/seats', flightController.getFlightSeats);
router.get('/flights/:id/seats/stream', flightController.streamSeats);

// Airport Autocomplete, Proximity and Real-time searches
router.get('/airports/search', flightController.searchAirports);
router.get('/airports/nearby', flightController.searchNearbyAirports);
router.get('/airports/:iata/realtime', flightController.streamAirportRealtime);

// Seating locks and checkouts (Protected)
router.post('/bookings/lock-seats', authMiddleware, flightController.lockSeats);
router.post('/bookings', authMiddleware, flightController.createBooking);

// Booking lookups
// Guest lookup — public (uses reference + email, no auth needed)
router.get('/bookings/lookup', flightController.lookupBooking);
// User-scoped bookings — protected
router.get('/bookings/user/:userId', authMiddleware, flightController.getUserBookings);

// Booking shifts & cancelations (Protected)
router.post('/bookings/cancel', authMiddleware, flightController.cancelBooking);
router.post('/bookings/reschedule', authMiddleware, flightController.rescheduleBooking);

// Offline sync reconciliation (Protected)
router.post('/bookings/offline-sync', authMiddleware, flightController.syncOfflineDrafts);

// Profile management (Protected)
router.get('/profile', authMiddleware, flightController.getProfile);
router.post('/profile', authMiddleware, flightController.updateProfile);

// Public Auth confirmation route (bypasses email verification)
router.post('/auth/confirm', flightController.confirmUser);

export default router;


