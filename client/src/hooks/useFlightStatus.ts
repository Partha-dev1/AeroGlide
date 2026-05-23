'use client';

/**
 * ============================================================
 * useFlightStatus — Realtime flight status subscription
 * ============================================================
 * Subscribes to Supabase Realtime for a specific flight's
 * status changes (delayed, cancelled, boarding, departed, landed).
 * ============================================================
 */

import { useEffect, useState, useRef } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

export interface FlightStatusUpdate {
  id: string;
  status: string;
  flight_number: string;
  departure_time: string;
  arrival_time: string;
  updated_at: string;
}

export function useFlightStatus(flightId: string | undefined) {
  const [status, setStatus] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<FlightStatusUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!flightId || !isSupabaseConfigured) return;

    const client = getSupabaseClient();
    const channelName = `flight_status_${flightId}`;

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'flights',
          filter: `id=eq.${flightId}`,
        },
        (payload: any) => {
          const updated = payload.new as FlightStatusUpdate;
          setStatus(updated.status);
          setLastUpdate(updated);
          console.log(`✈️ Flight ${updated.flight_number} status → ${updated.status}`);
        }
      )
      .subscribe((subStatus: string) => {
        setIsConnected(subStatus === 'SUBSCRIBED');
        if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
          console.warn(`📡 Flight status channel error: ${subStatus}`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [flightId]);

  return { status, lastUpdate, isConnected };
}
