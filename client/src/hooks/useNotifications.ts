'use client';

/**
 * ============================================================
 * useNotifications — Realtime notification subscription
 * ============================================================
 * Subscribes to new notifications for the authenticated user.
 * Provides unread count and list of recent notifications.
 * ============================================================
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);

  // ── Fetch initial notifications ────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) return;
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  }, [userId]);

  // ── Mark notification as read ──────────────────────────────────────────────
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const client = getSupabaseClient();
      await client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  }, []);

  // ── Mark all as read ───────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) return;
    try {
      const client = getSupabaseClient();
      await client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all notifications as read:', err);
    }
  }, [userId]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;

    fetchNotifications();

    const client = getSupabaseClient();
    const channelName = `notifications_${userId}`;

    // Clean up existing channel
    if (channelRef.current) {
      client.removeChannel(channelRef.current);
    }

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((c) => c + 1);
          console.log(`🔔 New notification: ${newNotification.title}`);
        }
      )
      .subscribe((subStatus: string) => {
        setIsConnected(subStatus === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [userId]); // Only re-subscribe when userId changes, NOT when fetchNotifications reference changes.
  // fetchNotifications is stable for the same userId — including it in deps caused
  // the realtime channel to teardown/reconnect on every TOKEN_REFRESHED event.

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
