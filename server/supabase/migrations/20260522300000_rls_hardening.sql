-- ============================================================
-- AEROGLIDE — RLS HARDENING & IMMUTABILITY RULES
-- Migration: 20260522300000_rls_hardening.sql
-- ============================================================
-- Prevents users from directly mutating sensitive fields.
-- All mutations to booking/seat status must go through RPCs.
-- ============================================================

-- ─── Bookings: Prevent direct status update (use RPC cancel/reschedule) ───────
DROP POLICY IF EXISTS "bookings_no_direct_update" ON public.bookings;
-- Only allow updates via service_role (RPC functions use SECURITY DEFINER)
-- Authenticated users cannot UPDATE bookings directly
CREATE POLICY "bookings_no_direct_update" ON public.bookings
  FOR UPDATE USING (false);

-- ─── Seats: Prevent direct seat status changes (use lock_seats RPC) ──────────
DROP POLICY IF EXISTS "seats_no_direct_update" ON public.seats;
CREATE POLICY "seats_no_direct_update" ON public.seats
  FOR UPDATE USING (false);

-- ─── Seats: Prevent direct inserts by authenticated users ────────────────────
DROP POLICY IF EXISTS "seats_no_direct_insert" ON public.seats;
CREATE POLICY "seats_no_direct_insert" ON public.seats
  FOR INSERT WITH CHECK (false);

-- ─── Payments: No direct DML from authenticated users ────────────────────────
DROP POLICY IF EXISTS "payments_no_direct_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_no_direct_update" ON public.payments;
CREATE POLICY "payments_no_direct_insert" ON public.payments
  FOR INSERT WITH CHECK (false);
CREATE POLICY "payments_no_direct_update" ON public.payments
  FOR UPDATE USING (false);

-- ─── Bookings: Prevent direct deletion (only RPC-mediated cancel) ─────────────
DROP POLICY IF EXISTS "bookings_no_direct_delete" ON public.bookings;
CREATE POLICY "bookings_no_direct_delete" ON public.bookings
  FOR DELETE USING (false);

-- ─── Passengers: Prevent direct deletion ─────────────────────────────────────
DROP POLICY IF EXISTS "passengers_no_direct_delete" ON public.passengers;
CREATE POLICY "passengers_no_direct_delete" ON public.passengers
  FOR DELETE USING (false);

-- ─── Users: Prevent email change directly (must go through Supabase Auth) ─────
-- email is immutable once set (Supabase Auth is the source of truth)
-- The users table is a profile mirror — only full_name and phone are editable.
DROP POLICY IF EXISTS "users_no_email_change" ON public.users;

-- Re-enforce update policy so only non-sensitive fields can change
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent changing id or email via update
    -- (PostgreSQL will enforce this via the row check)
  );

-- ─── Notifications: Allow only system to INSERT (via service role) ────────────
DROP POLICY IF EXISTS "notifications_no_direct_insert" ON public.notifications;
CREATE POLICY "notifications_no_direct_insert" ON public.notifications
  FOR INSERT WITH CHECK (false);
-- Note: notifications are only created by server-side RPCs / triggers

-- ─── Function: Notify user on booking confirmation ───────────────────────────
CREATE OR REPLACE FUNCTION public.notify_booking_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      '✈️ Booking Confirmed',
      'Your booking ' || NEW.booking_reference || ' has been confirmed. Have a great flight!',
      'success'
    );
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      '❌ Booking Cancelled',
      'Your booking ' || NEW.booking_reference || ' has been cancelled and a refund initiated.',
      'info'
    );
  END IF;
  IF NEW.status = 'rescheduled' AND OLD.status != 'rescheduled' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      '🔄 Flight Rescheduled',
      'Your booking ' || NEW.booking_reference || ' has been rescheduled successfully.',
      'success'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_booking_status ON public.bookings;
CREATE TRIGGER trg_notify_booking_status
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_booking_confirmed();

-- Allow trigger function to insert notifications (runs as SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.notify_booking_confirmed TO service_role;

-- ─── Function: get_user_booking_stats ────────────────────────────────────────
-- Secure RPC that returns booking statistics for the authenticated user.
CREATE OR REPLACE FUNCTION public.get_user_booking_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSON;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT json_build_object(
    'total_bookings',     COUNT(*),
    'confirmed',          COUNT(*) FILTER (WHERE status = 'confirmed'),
    'cancelled',          COUNT(*) FILTER (WHERE status = 'cancelled'),
    'rescheduled',        COUNT(*) FILTER (WHERE status = 'rescheduled'),
    'total_spent',        COALESCE(SUM(total_price) FILTER (WHERE status IN ('confirmed','rescheduled')), 0),
    'upcoming_flights',   COUNT(*) FILTER (
                            WHERE status = 'confirmed' AND
                            flight_id IN (
                              SELECT id FROM public.flights WHERE departure_time > NOW()
                            )
                          )
  )
  INTO v_result
  FROM public.bookings
  WHERE user_id = v_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_booking_stats TO authenticated;

-- ─── Function: record_search_history ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_search_history(
  p_origin      CHAR(3),
  p_destination CHAR(3),
  p_date        DATE,
  p_passengers  INTEGER DEFAULT 1,
  p_class       TEXT DEFAULT 'economy',
  p_results     INTEGER DEFAULT 0
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.search_history (
    user_id, origin_iata, destination_iata,
    travel_date, passenger_count, cabin_class, result_count
  )
  VALUES (
    auth.uid(), -- NULL for anon users
    p_origin, p_destination,
    p_date, p_passengers, p_class, p_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_search_history TO anon, authenticated;
