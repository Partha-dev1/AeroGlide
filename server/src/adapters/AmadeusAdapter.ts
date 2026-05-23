import { Flight, Airport, LiveFlightStatus, FlightSearchParams } from '../types/serverTypes';
import { AviationApiAdapter } from './AviationApiAdapter';
import { fallbackAviationAdapter } from './AviationFallbackAdapter';
import { getDeterministicUuid } from '../utils/uuid';

export class AmadeusAdapter implements AviationApiAdapter {
  private clientId = process.env.AMADEUS_API_KEY || process.env.AMADEUS_CLIENT_ID || '';
  private clientSecret = process.env.AMADEUS_API_SECRET || process.env.AMADEUS_CLIENT_SECRET || '';
  
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  // 1. Fetch OAuth2 Token
  private async getAuthToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Amadeus credentials not configured.');
    }

    const tokenUrl = 'https://test.api.amadeus.com/v1/security/oauth2/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!res.ok) {
      throw new Error(`Amadeus auth token exchange failed: ${res.statusText}`);
    }

    const data = await res.json() as any;
    this.accessToken = data.access_token;
    // Expire 2 minutes early for safety margin (expires_in is in seconds)
    this.tokenExpiry = Date.now() + (data.expires_in - 120) * 1000;
    
    return this.accessToken!;
  }

  // 2. Search Airports
  async searchAirports(query: string): Promise<Airport[]> {
    if (!this.clientId || !this.clientSecret) {
      console.log('⚠️ Amadeus credentials not set. Falling back to local engine search.');
      return fallbackAviationAdapter.searchAirports(query);
    }

    try {
      const token = await this.getAuthToken();
      const url = `https://test.api.amadeus.com/v1/reference-data/locations?subType=AIRPORT&keyword=${encodeURIComponent(query)}&page[limit]=10`;
      
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`Amadeus airport search error: ${res.statusText}`);
      
      const responseBody = await res.json() as any;
      const rawLocations = responseBody.data || [];

      return rawLocations.map((loc: any) => ({
        iata: loc.iataCode || '',
        icao: '', // Amadeus returns IATA
        name: loc.name || '',
        city: loc.address?.cityName || '',
        country: loc.address?.countryName || '',
        timezone: loc.timeZoneOffset || 'UTC',
        latitude: loc.geoCode?.latitude || 0,
        longitude: loc.geoCode?.longitude || 0
      }));
    } catch (err: any) {
      console.warn('⚠️ Amadeus Search failed. Failover to local search.', err.message);
      return fallbackAviationAdapter.searchAirports(query);
    }
  }

  // 3. Search Flights
  async searchFlights(params: FlightSearchParams): Promise<Flight[]> {
    if (!this.clientId || !this.clientSecret) {
      console.log('⚠️ Amadeus credentials not set. Falling back to local flights generator.');
      return fallbackAviationAdapter.searchFlights(params);
    }

    try {
      const token = await this.getAuthToken();
      const adults = params.passengerCount || 1;
      const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${params.origin}&destinationLocationCode=${params.destination}&departureDate=${params.date}&adults=${adults}&max=15`;

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`Amadeus flight offers error: ${res.statusText}`);

      const responseBody = await res.json() as any;
      const rawOffers = responseBody.data || [];

      return rawOffers.map((offer: any, idx: number) => {
        // Map Amadeus response structure to AeroGlide Flight structure
        const firstSegment = offer.itineraries?.[0]?.segments?.[0];
        const lastSegment = offer.itineraries?.[0]?.segments?.[offer.itineraries[0].segments.length - 1];
        
        const airlineCode = firstSegment?.carrierCode || 'AG';
        const flightNo = `${airlineCode}${firstSegment?.number || (100 + idx * 15)}`;
        
        const depTime = firstSegment?.departure?.at || new Date().toISOString();
        const arrTime = lastSegment?.arrival?.at || new Date().toISOString();
        
        const basePrice = Number(offer.price?.grandTotal || (200 + idx * 45));
        const durationStr = offer.itineraries?.[0]?.duration || 'PT2H30M';
        const durationMinutes = this.parseDuration(durationStr);

        return {
          id: getDeterministicUuid(`${flightNo}-${params.date}`),
          flight_number: flightNo,
          airline: this.resolveAirlineName(airlineCode),
          origin: params.origin || 'JFK',
          destination: params.destination || 'LHR',
          departure_time: depTime,
          arrival_time: arrTime,
          base_price: basePrice,
          status: 'scheduled',
          aircraft_type: 'Boeing 737 MAX 9',
          gate: `Gate ${String.fromCharCode(65 + (idx % 4))}${1 + idx}`,
          terminal: firstSegment?.departure?.terminal || 'Terminal 1',
          stops: (offer.itineraries?.[0]?.segments?.length || 1) - 1,
          duration_minutes: durationMinutes
        };
      });
    } catch (err: any) {
      console.warn('⚠️ Amadeus Search failed. Failover to local flights generator.', err.message);
      return fallbackAviationAdapter.searchFlights(params);
    }
  }

  // 4. Get Live Flight tracking Status
  async getFlightStatus(flightNumber: string, date: string): Promise<LiveFlightStatus> {
    // Standard Amadeus developer sandbox lacks real-time GPS tracking.
    // So we use fallbackAviationAdapter to compute live flight positions dynamically
    return fallbackAviationAdapter.getFlightStatus(flightNumber, date);
  }

  // ====================================================
  // Helper Parsers
  // ====================================================
  private parseDuration(isoDuration: string): number {
    // e.g. PT2H30M -> 150 minutes
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 180;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    return hours * 60 + minutes;
  }

  private resolveAirlineName(code: string): string {
    const airlines: Record<string, string> = {
      'AA': 'American Airlines',
      'DL': 'Delta Air Lines',
      'UA': 'United Airlines',
      'LH': 'Lufthansa',
      'BA': 'British Airways',
      'AF': 'Air France',
      'EK': 'Emirates',
      'SQ': 'Singapore Airlines',
      'JL': 'Japan Airlines',
      'QR': 'Qatar Airways'
    };
    return airlines[code] || `${code} Airways`;
  }
}
export const amadeusAdapter = new AmadeusAdapter();
