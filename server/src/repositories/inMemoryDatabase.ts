import { v4 as uuidv4 } from 'uuid';
import { Flight, Seat, Booking, Passenger, Reschedule, Profile } from '../types/serverTypes';

export let flightsDb: Flight[] = [];
export let seatsDb: Seat[] = [];
export let bookingsDb: Booking[] = [];
export let passengersDb: Passenger[] = [];
export let reschedulesDb: Reschedule[] = [];
export let profilesDb: Profile[] = [];

/**
 * Dynamically initializes seats for a flight based on its aircraft type if not already populated.
 */
export const getOrInitSeatsForFlight = (flight: Flight): Seat[] => {
  const existing = seatsDb.filter(s => s.flight_id === flight.id);
  if (existing.length > 0) return existing;

  const newSeats: Seat[] = [];
  const type = flight.aircraft_type.toUpperCase();
  const isWideBody = type.includes('777') || type.includes('350') || type.includes('DREAMLINER');

  const rowsCount = isWideBody ? 40 : 30;

  for (let r = 1; r <= rowsCount; r++) {
    let seatClass: Seat['class'] = 'economy';
    let multiplier = 1.00;

    if (r <= (isWideBody ? 4 : 2)) {
      seatClass = 'first';
      multiplier = 3.00;
    } else if (r <= (isWideBody ? 10 : 5)) {
      seatClass = 'business';
      multiplier = 1.80;
    }

    const columns = isWideBody 
      ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'] // Wide-body 3x4x3
      : ['A', 'B', 'C', 'D', 'E', 'F'];                    // Narrow-body 3x3

    columns.forEach((col) => {
      // Simulate occupancy for 10% of seats randomly using seat index math
      const sumAscii = r + col.charCodeAt(0);
      const isOccupied = sumAscii % 9 === 0;

      newSeats.push({
        id: uuidv4(),
        flight_id: flight.id,
        seat_code: `${r}${col}`,
        class: seatClass,
        price_multiplier: multiplier,
        status: isOccupied ? 'occupied' : 'available',
        locked_by: null,
        locked_at: null
      });
    });
  }

  // Push into database
  seatsDb.push(...newSeats);
  return newSeats;
};

// Helper to clear expired in-memory seat locks (10 min duration)
export const cleanupInMemoryLocks = () => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  seatsDb.forEach((seat) => {
    if (seat.status === 'locked' && seat.locked_at && new Date(seat.locked_at).getTime() < tenMinutesAgo) {
      seat.status = 'available';
      seat.locked_by = null;
      seat.locked_at = null;
    }
  });
};
