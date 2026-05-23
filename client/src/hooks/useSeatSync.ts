'use client';

/**
 * ============================================================
 * useSeatSync — Realtime seat availability subscription
 * ============================================================
 * Subscribes to Supabase Realtime for seat status changes.
 * Prevents duplicate subscriptions via channelRef.
 * Handles reconnection and memory leaks properly.
 * Falls back to SSE if Supabase is not configured.
 * ============================================================
 */

import { useEffect, useRef } from 'react';
import { useAeroStore } from '../store';
import { APP_CONFIG } from '../config/appConfig';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { Seat } from '../types';

export const useSeatSync = (flightId: string | undefined) => {
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!flightId) return;
    isMountedRef.current = true;

    // Retrieve store actions dynamically to isolate effect dependencies
    const { updateSeatsFromRealtime, setSseConnected } = useAeroStore.getState();

    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      const channelName = `seats_flight_${flightId}`;

      // ── Prevent duplicate subscriptions ──────────────────────────────────
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      console.log(`🔌 Subscribing to seat realtime: ${channelName}`);

      const channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'seats',
            filter: `flight_id=eq.${flightId}`,
          },
          (payload: any) => {
            if (!isMountedRef.current) return;

            const currentSeats = useAeroStore.getState().activeFlightSeats;
            let updatedSeats: Seat[] = [...currentSeats];

            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const changedSeat = payload.new as Seat;
              const index = updatedSeats.findIndex(s => s.id === changedSeat.id);
              if (index >= 0) {
                updatedSeats[index] = changedSeat;
              } else {
                updatedSeats.push(changedSeat);
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedSeat = payload.old as { id: string };
              updatedSeats = updatedSeats.filter(s => s.id !== deletedSeat.id);
            }

            updateSeatsFromRealtime(flightId, updatedSeats);
          }
        )
        .subscribe((status: string) => {
          if (!isMountedRef.current) return;

          if (status === 'SUBSCRIBED') {
            console.log('📡 Seat realtime channel subscribed.');
            setSseConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.warn(`📡 Seat channel status: ${status}`);
            setSseConnected(false);
          } else if (status === 'TIMED_OUT') {
            console.warn('📡 Seat channel timed out — will auto-reconnect.');
            setSseConnected(false);
          }
        });

      channelRef.current = channel;

      return () => {
        isMountedRef.current = false;
        if (channelRef.current) {
          console.log('🔌 Closing seat realtime channel.');
          client.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        setSseConnected(false);
      };
    } else {
      // ── Fallback: SSE stream ─────────────────────────────────────────────
      const url = `${APP_CONFIG.API_URL}/api/flights/${flightId}/seats/stream`;
      console.log(`🔌 Initializing fallback SSE: ${url}`);

      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        if (isMountedRef.current) setSseConnected(true);
      };

      eventSource.addEventListener('seats', (event: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.seats && Array.isArray(data.seats)) {
            updateSeatsFromRealtime(flightId, data.seats);
          }
        } catch (err) {
          console.error('Failed to parse SSE seat data:', err);
        }
      });

      eventSource.onerror = () => {
        if (isMountedRef.current) setSseConnected(false);
      };

      return () => {
        isMountedRef.current = false;
        eventSource.close();
        setSseConnected(false);
      };
    }
  }, [flightId]);
};

