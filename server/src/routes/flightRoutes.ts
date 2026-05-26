import { Router, Request, Response } from 'express';
import { flightController } from '../controllers/flightController';
import { authMiddleware } from '../middleware/authMiddleware';
import { seatsDb, bookingsDb, passengersDb, reschedulesDb } from '../repositories/inMemoryDatabase';

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

// ─── DEV-ONLY: Test reset endpoint ───────────────────────────────────────────
// Resets all in-memory seat locks and test bookings for repeatable test runs.
// Only active in non-production environments.
if (process.env.NODE_ENV !== 'production') {
  router.post('/test/reset', (_req: Request, res: Response) => {
    // Reset all locked seats back to available
    let seatsReset = 0;
    seatsDb.forEach(seat => {
      if (seat.status === 'locked' || seat.status === 'occupied') {
        seat.status = 'available';
        seat.locked_by = null;
        seat.locked_at = null;
        seatsReset++;
      }
    });

    // Remove all test bookings (bookings with mock user IDs or test emails)
    const removedBookings: string[] = [];
    for (let i = bookingsDb.length - 1; i >= 0; i--) {
      const b = bookingsDb[i];
      if (
        (b as any).contact_email?.includes('@domain.in') ||
        (b as any).user_id?.startsWith('mock-') ||
        (b as any).user_id?.startsWith('4e768e8c') // known test UUID
      ) {
        removedBookings.push(b.id);
        bookingsDb.splice(i, 1);
      }
    }

    // Remove related passengers
    for (let i = passengersDb.length - 1; i >= 0; i--) {
      if (removedBookings.includes(passengersDb[i].booking_id)) {
        passengersDb.splice(i, 1);
      }
    }

    // Remove related reschedules
    for (let i = reschedulesDb.length - 1; i >= 0; i--) {
      if (removedBookings.includes((reschedulesDb[i] as any).booking_id)) {
        reschedulesDb.splice(i, 1);
      }
    }

    console.log(`🧹 [TEST RESET] Reset ${seatsReset} seats, removed ${removedBookings.length} bookings.`);
    res.json({
      success: true,
      message: `Reset complete: ${seatsReset} seats unlocked, ${removedBookings.length} test bookings removed.`,
      seatsReset,
      bookingsRemoved: removedBookings.length,
    });
  });
}

export default router;


