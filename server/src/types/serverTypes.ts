export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
  terminals: string[];
  airlines: string[];
  type: 'international' | 'domestic' | 'regional' | 'private' | 'cargo' | 'military' | 'heliport';
  elevation: number; // in feet
  flag: string; // emoji or ISO code
  nearby: string[]; // nearby IATA codes
  popularity: number; // 0-100 search weight
  images?: string[];
}

export interface Flight {
  id: string;
  flight_number: string;
  airline: string;
  origin: string; // IATA Code (e.g. JFK)
  destination: string; // IATA Code (e.g. LHR)
  departure_time: string;
  arrival_time: string;
  base_price: number;
  status: 'scheduled' | 'delayed' | 'cancelled' | 'completed' | 'boarding' | 'in-air';
  aircraft_type: string;
  gate?: string;
  terminal?: string;
  delay_minutes?: number;
  progress_percent?: number; // In-air tracking percentage (0-100)
  stops?: number; // 0 = non-stop, 1 = 1-stop layover
  duration_minutes?: number;
  latitude?: number; // active flight coordinates
  longitude?: number;
  altitude?: number; // active flight feet altitude
  speed?: number; // active flight knots speed
}

export interface Seat {
  id: string;
  flight_id: string;
  seat_code: string;
  class: 'economy' | 'business' | 'first';
  price_multiplier: number;
  status: 'available' | 'locked' | 'occupied';
  locked_by: string | null;
  locked_at: string | null;
}

export interface Booking {
  id: string;
  booking_reference: string;
  flight_id: string;
  user_id: string | null;
  contact_email: string;
  contact_phone: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'rescheduled';
  created_at: string;
}

export interface Passenger {
  id: string;
  booking_id: string;
  first_name: string;
  last_name: string;
  passport_number: string;
  seat_id: string;
}

export interface Reschedule {
  id: string;
  booking_id: string;
  old_flight_id: string;
  new_flight_id: string;
  fee: number;
  reason: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone_number?: string;
  nationality?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  passport_details?: string;
  emergency_contact?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FlightSearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  returnDate?: string;
  passengerCount?: number;
  seatClass?: 'economy' | 'business' | 'first';
  airline?: string;
  layover?: string; // e.g. "non-stop", "1-stop"
  sortBy?: 'price' | 'duration' | 'departure';
}

export interface LiveFlightStatus {
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  status: Flight['status'];
  gate?: string;
  terminal?: string;
  delay_minutes?: number;
  progress_percent?: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed?: number;
}
