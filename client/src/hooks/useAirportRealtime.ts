import { useState, useEffect } from 'react';
import { airportRealtimeService, AirportRealtimeUpdate } from '../services/airportRealtimeService';

export function useAirportRealtime(iata: string | null) {
  const [realtimeUpdate, setRealtimeUpdate] = useState<AirportRealtimeUpdate | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!iata) {
      setRealtimeUpdate(null);
      setError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    // Subscribe to SSE updates
    const unsubscribe = airportRealtimeService.subscribe(
      iata,
      (data) => {
        setRealtimeUpdate(data);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );

    // Return the cleanup handle
    return () => {
      unsubscribe();
    };
  }, [iata]);

  return { realtimeUpdate, error, loading };
}
