import { Flight, Airport, LiveFlightStatus, FlightSearchParams } from '../types/serverTypes';

export interface AviationApiAdapter {
  /**
   * Search global airports by typing text matching city, country, or IATA/ICAO code.
   */
  searchAirports(query: string): Promise<Airport[]>;

  /**
   * Fetch live flight listings between origin and destination with specific query filters.
   */
  searchFlights(params: FlightSearchParams): Promise<Flight[]>;

  /**
   * Retrieve live flight progress details, including tracking vectors and delay gates.
   */
  getFlightStatus(flightNumber: string, date: string): Promise<LiveFlightStatus>;
}
