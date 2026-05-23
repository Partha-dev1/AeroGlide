import { useState, useEffect } from 'react';
import { Airport } from '../types';
import { airportSearchService } from '../services/airportSearchService';

export function useNearbyAirports(limit = 4) {
  const [nearbyAirports, setNearbyAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported by this browser.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const results = await airportSearchService.getNearby(lat, lon, limit);
          setNearbyAirports(results);
          setError(null);
        } catch (e: any) {
          setError(e.message || 'Failed to fetch nearby airports.');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        setError(`Location access denied or unavailable: ${err.message}`);
        
        // Graceful fallback: fetch nearest to New York JFK coordinates
        fetchFallbackAirports();
      },
      { timeout: 10000 }
    );

    async function fetchFallbackAirports() {
      try {
        setLoading(true);
        // Fallback JFK GPS coordinates: 40.6397, -73.7789
        const results = await airportSearchService.getNearby(40.6397, -73.7789, limit);
        setNearbyAirports(results);
      } catch (e) {
        console.error('Proximity fallback fetch failed:', e);
      } finally {
        setLoading(false);
      }
    }
  }, [limit]);

  return { nearbyAirports, loading, error };
}
