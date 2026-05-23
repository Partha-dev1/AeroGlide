'use client';

/**
 * ============================================================
 * useBookingSync — Realtime booking status subscription
 * ============================================================
 * Subscribes to booking status updates for the authenticated user.
 * Triggers re-fetch when bookings are confirmed/cancelled/rescheduled.
 * ============================================================
 */

import { useEffect, useRef } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAeroStore } from '../store';

export function useBookingSync(userId: string | null) {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;

    const client = getSupabaseClient();
    const channelName = `bookings_${userId}`;

    // Clean up existing channel
    if (channelRef.current) {
      client.removeChannel(channelRef.current);
    }

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          console.log(`📦 Booking update detected:`, payload.eventType, payload.new?.booking_reference);

          // Re-fetch all user bookings from Supabase on any change
          // This ensures consistency vs. trying to patch local state
          const fetchFn = useAeroStore.getState().fetchUserBookings;
          if (fetchFn) {
            fetchFn();
          }
        }
      )
      .subscribe((subStatus: string) => {
        if (subStatus === 'SUBSCRIBED') {
          console.log('📡 Booking realtime channel subscribed.');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);
}
