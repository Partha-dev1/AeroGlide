import { Flight, Airport, LiveFlightStatus, FlightSearchParams } from '../types/serverTypes';
import { AviationApiAdapter } from './AviationApiAdapter';
import { airportsDatabase } from '../repositories/airportsDatabase';
import { getDeterministicUuid } from '../utils/uuid';

export class AviationFallbackAdapter implements AviationApiAdapter {
  
  // 1. Search Airports using Levenshtein Fuzzy search
  async searchAirports(query: string): Promise<Airport[]> {
    if (!query) return [];
    return airportsDatabase.search(query);
  }

  // 2. Search Flights with Live-Simulation Engine
  async searchFlights(params: FlightSearchParams): Promise<Flight[]> {
    const origin = params.origin?.trim().toUpperCase() || 'JFK';
    const destination = params.destination?.trim().toUpperCase() || 'LHR';
    const dateStr = params.date || new Date().toISOString().split('T')[0];

    const originAirport = airportsDatabase.getByIata(origin);
    const destAirport = airportsDatabase.getByIata(destination);

    if (!originAirport || !destAirport) {
      return [];
    }

    // Calculate real flight coordinates distance using basic Earth-surface math
    const distanceKm = this.calculateDistance(
      originAirport.latitude, originAirport.longitude,
      destAirport.latitude, destAirport.longitude
    );

    // Assume 850 km/h cruising speed
    const durationMinutes = Math.max(45, Math.round((distanceKm / 850) * 60));

    // Choose aircraft type by distance
    let aircraftType = 'Airbus A320-200';
    if (distanceKm > 4000) {
      aircraftType = distanceKm > 8000 ? 'Airbus A350-900' : 'Boeing 777-300ER';
    } else if (distanceKm > 1500) {
      aircraftType = 'Boeing 737 MAX 9';
    }

    const searchDate = new Date(dateStr);
    const isToday = searchDate.toDateString() === new Date().toDateString();
    
    // Seed 4 consistent flights for the day
    const airlines = [
      { name: 'IndiGo', prefix: '6E' },
      { name: 'Air India', prefix: 'AI' },
      { name: 'SpiceJet', prefix: 'SG' },
      { name: 'Akasa Air', prefix: 'QP' }
    ];

    const flights: Flight[] = [];
    const baseHourOffsets = [8, 12, 16, 20]; // 8 AM, 12 PM, 4 PM, 8 PM

    baseHourOffsets.forEach((hour, idx) => {
      const departure = new Date(searchDate);
      departure.setHours(hour, 0, 0, 0);

      const arrival = new Date(departure.getTime() + durationMinutes * 60 * 1000);
      const flightNumber = `${airlines[idx].prefix}${100 + idx * 25}`;

      const now = Date.now();
      let status: Flight['status'] = 'scheduled';
      let progress_percent = 0;
      let delay_minutes = 0;

      // Simulate a small delay sometimes (10% chance or index match)
      if (idx === 1 && isToday) {
        status = 'delayed';
        delay_minutes = 15;
        departure.setMinutes(departure.getMinutes() + 15);
        arrival.setMinutes(arrival.getMinutes() + 15);
      }

      if (isToday) {
        if (now > arrival.getTime()) {
          status = 'completed';
          progress_percent = 100;
        } else if (now > departure.getTime()) {
          status = 'in-air';
          const totalDuration = arrival.getTime() - departure.getTime();
          const elapsed = now - departure.getTime();
          progress_percent = Math.min(99, Math.floor((elapsed / totalDuration) * 100));
        } else if (departure.getTime() - now < 30 * 60 * 1000) {
          status = 'boarding';
        }
      }

      // Calculate realistic pricing in INR (Indian Rupees)
      const isDomestic = originAirport.country === 'India' && destAirport.country === 'India';
      const basePrice = isDomestic
        ? Math.round((distanceKm * 4.5) + 2200 + (idx * 400))
        : Math.round((distanceKm * 7.0) + 14000 + (idx * 2500));

      flights.push({
        id: getDeterministicUuid(`${flightNumber}-${dateStr}`),
        flight_number: flightNumber,
        airline: airlines[idx].name,
        origin,
        destination,
        departure_time: departure.toISOString(),
        arrival_time: arrival.toISOString(),
        base_price: basePrice,
        status,
        aircraft_type: aircraftType,
        gate: `Gate ${String.fromCharCode(65 + idx)}${1 + idx * 3}`,
        terminal: `Terminal ${idx % 2 === 0 ? '1' : '3'}`,
        delay_minutes: delay_minutes || undefined,
        progress_percent: progress_percent || undefined,
        stops: 0,
        duration_minutes: durationMinutes
      });
    });

    let results = flights;
    if (params.airline) {
      results = results.filter(f => f.airline.toLowerCase().includes(params.airline!.toLowerCase()));
    }
    if (params.sortBy === 'price') {
      results.sort((a, b) => a.base_price - b.base_price);
    } else if (params.sortBy === 'duration') {
      results.sort((a, b) => a.duration_minutes! - b.duration_minutes!);
    } else if (params.sortBy === 'departure') {
      results.sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
    }

    return results;
  }

  // 3. Get Active Flight Status with Interpolated Tracking Details
  async getFlightStatus(flightNumber: string, date: string): Promise<LiveFlightStatus> {
    const parts = flightNumber.split('-');
    const pureFlightNo = parts[0];
    
    // Find flight route details by mapping prefix of Indian carriers
    let origin = 'DEL';
    let destination = 'BOM';
    if (pureFlightNo.startsWith('6E')) {
      origin = 'DEL';
      destination = 'BLR';
    } else if (pureFlightNo.startsWith('AI')) {
      origin = 'BOM';
      destination = 'DXB';
    } else if (pureFlightNo.startsWith('QP')) {
      origin = 'MAA';
      destination = 'DEL';
    } else if (pureFlightNo.startsWith('SG')) {
      origin = 'CCU';
      destination = 'BOM';
    }

    const originAirport = airportsDatabase.getByIata(origin) || airportsDatabase.getAll()[0];
    const destAirport = airportsDatabase.getByIata(destination) || airportsDatabase.getAll()[5];

    const mockResults = await this.searchFlights({ origin, destination, date });
    const match = mockResults.find(f => f.flight_number === pureFlightNo) || mockResults[0];

    const now = Date.now();
    const depTime = new Date(match.departure_time).getTime();
    const arrTime = new Date(match.arrival_time).getTime();

    let progress = 0;
    let latitude = originAirport.latitude;
    let longitude = originAirport.longitude;
    let altitude = 0;
    let speed = 0;

    if (now > arrTime) {
      progress = 100;
      latitude = destAirport.latitude;
      longitude = destAirport.longitude;
    } else if (now > depTime) {
      const total = arrTime - depTime;
      const elapsed = now - depTime;
      progress = Math.min(99, Math.floor((elapsed / total) * 100));

      // Interpolate GPS coordinates based on progress percentage
      const ratio = progress / 100;
      latitude = originAirport.latitude + (destAirport.latitude - originAirport.latitude) * ratio;
      longitude = originAirport.longitude + (destAirport.longitude - originAirport.longitude) * ratio;
      
      // Altitude profile: climb first, cruise, then descent
      if (progress < 15) {
        altitude = Math.round((progress / 15) * 35000);
        speed = Math.round(250 + (progress / 15) * 230);
      } else if (progress > 85) {
        altitude = Math.round(((100 - progress) / 15) * 35000);
        speed = Math.round(180 + ((100 - progress) / 15) * 300);
      } else {
        altitude = 35000 + Math.round((Math.sin(progress) * 500)); // small wave fluctuations
        speed = 480;
      }
    }

    return {
      flight_number: pureFlightNo,
      airline: match.airline,
      origin,
      destination,
      status: match.status,
      gate: match.gate,
      terminal: match.terminal,
      delay_minutes: match.delay_minutes,
      progress_percent: progress,
      latitude,
      longitude,
      altitude: altitude || undefined,
      speed: speed || undefined
    };
  }

  // ====================================================
  // Helper Math: basic distance math
  // ====================================================
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
export const fallbackAviationAdapter = new AviationFallbackAdapter();
