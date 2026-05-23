import { APP_CONFIG } from '../config/appConfig';
import { Airport } from '../types';

class AirportSearchService {
  private baseUrl = APP_CONFIG.API_URL;

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = 'An error occurred fetching airport data';
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    return res.json() as Promise<T>;
  }

  // 1. Instantly queries fuzzy debounced matches
  async search(query: string): Promise<Airport[]> {
    if (!query || query.trim().length < 1) return [];
    return this.request<Airport[]>(`/api/airports/search?q=${encodeURIComponent(query.trim())}`);
  }

  // 2. Fetch nearest runways based on geographic coordinates
  async getNearby(lat: number, lon: number, limit = 5): Promise<Airport[]> {
    return this.request<Airport[]>(`/api/airports/nearby?lat=${lat}&lon=${lon}&limit=${limit}`);
  }
}

export const airportSearchService = new AirportSearchService();
