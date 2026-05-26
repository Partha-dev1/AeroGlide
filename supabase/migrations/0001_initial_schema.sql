-- ============================================================
-- AEROGLIDE COMPLETE DATABASE SCHEMA (ROOT MIGRATION)
-- Location: /supabase/migrations/0001_initial_schema.sql
-- ============================================================

-- ─── 1. EXTENSIONS ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 2. TABLES ──────────────────────────────────────────────

-- A. AIRPORTS TABLE
CREATE TABLE IF NOT EXISTS public.airports (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  iata              TEXT         NOT NULL UNIQUE,
  icao              TEXT         NOT NULL,
  name              TEXT         NOT NULL,
  airport_name      TEXT         NOT NULL,
  city              TEXT         NOT NULL,
  country           TEXT         NOT NULL,
  latitude          NUMERIC      NOT NULL,
  longitude         NUMERIC      NOT NULL,
  timezone          TEXT         NOT NULL,
  is_international  BOOLEAN      NOT NULL DEFAULT true,
  airport_type      TEXT         NOT NULL DEFAULT 'international',
  popularity        INTEGER      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- B. FLIGHTS TABLE
CREATE TABLE IF NOT EXISTS public.flights (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_number     TEXT          NOT NULL,
  airline           TEXT          NOT NULL,
  origin_iata       TEXT          NOT NULL REFERENCES public.airports(iata) ON DELETE RESTRICT,
  destination_iata  TEXT          NOT NULL REFERENCES public.airports(iata) ON DELETE RESTRICT,
  departure_time    TIMESTAMPTZ   NOT NULL,
  arrival_time      TIMESTAMPTZ   NOT NULL,
  duration_minutes  INTEGER       NOT NULL CHECK (duration_minutes >= 0),
  aircraft_type     TEXT          NOT NULL,
  status            TEXT          NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'boarding', 'departed', 'landed', 'cancelled', 'delayed')),
  base_price        NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT flights_arrival_after_departure CHECK (arrival_time > departure_time),
  CONSTRAINT flights_different_cities CHECK (origin_iata != destination_iata)
);

-- C. SEATS TABLE
CREATE TABLE IF NOT EXISTS public.seats (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id        UUID          NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  seat_code        TEXT          NOT NULL,
  cabin_class      TEXT          NOT NULL DEFAULT 'economy' CHECK (cabin_class IN ('economy', 'premium_economy', 'business', 'first')),
  status           TEXT          NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'locked', 'booked', 'blocked')),
  price_modifier   NUMERIC(10,2) NOT NULL DEFAULT 1.00 CHECK (price_modifier >= 0),
  lock_session     TEXT,
  lock_expires_at  TIMESTAMPTZ,
  features         JSONB,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT seats_unique_per_flight UNIQUE (flight_id, seat_code)
);

-- D. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference  TEXT           NOT NULL UNIQUE,
  user_id            UUID           NOT NULL,
  flight_id          UUID           NOT NULL REFERENCES public.flights(id) ON DELETE RESTRICT,
  contact_email      TEXT           NOT NULL,
  contact_phone      TEXT           NOT NULL,
  total_price        NUMERIC(10,2)  NOT NULL CHECK (total_price >= 0),
  status             TEXT           NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled')),
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- E. PASSENGERS TABLE
CREATE TABLE IF NOT EXISTS public.passengers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  seat_id          UUID        NOT NULL REFERENCES public.seats(id) ON DELETE RESTRICT,
  first_name       TEXT        NOT NULL,
  last_name        TEXT        NOT NULL,
  passport_number  TEXT,
  date_of_birth    DATE,
  nationality      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- F. RESCHEDULES TABLE
CREATE TABLE IF NOT EXISTS public.reschedules (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID          NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  old_flight_id     UUID          NOT NULL REFERENCES public.flights(id) ON DELETE RESTRICT,
  new_flight_id     UUID          NOT NULL REFERENCES public.flights(id) ON DELETE RESTRICT,
  old_seat_ids      UUID[]        NOT NULL,
  new_seat_ids      UUID[]        NOT NULL,
  price_difference  NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (price_difference >= 0),
  status            TEXT          NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- G. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID          NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency        TEXT          NOT NULL DEFAULT 'INR',
  status          TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method  TEXT,
  transaction_id  TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- H. TRACKING LOGS TABLE
CREATE TABLE IF NOT EXISTS public.tracking_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id     UUID        NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,
  details       JSONB,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- I. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. INDEX OPTIMIZATIONS ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_airports_iata      ON public.airports(iata);
CREATE INDEX IF NOT EXISTS idx_flights_number     ON public.flights(flight_number);
CREATE INDEX IF NOT EXISTS idx_flights_route      ON public.flights(origin_iata, destination_iata);
CREATE INDEX IF NOT EXISTS idx_flights_departs    ON public.flights(departure_time);
CREATE INDEX IF NOT EXISTS idx_seats_flight       ON public.seats(flight_id);
CREATE INDEX IF NOT EXISTS idx_seats_status       ON public.seats(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user      ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_flight    ON public.bookings(flight_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status    ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_ref       ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_passengers_booking  ON public.passengers(booking_id);
CREATE INDEX IF NOT EXISTS idx_reschedules_book   ON public.reschedules(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking   ON public.payments(booking_id);

-- ─── 4. ROW LEVEL SECURITY (RLS) POLICIES ───────────────────
ALTER TABLE public.airports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passengers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reschedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- A. Airports Policies (Read-only for all)
CREATE POLICY "airports_read_all" ON public.airports FOR SELECT USING (true);

-- B. Flights Policies (Read-only for all)
CREATE POLICY "flights_read_all" ON public.flights FOR SELECT USING (true);

-- C. Seats Policies (Read-only for all)
CREATE POLICY "seats_read_all" ON public.seats FOR SELECT USING (true);

-- D. Bookings Policies (Scoped by auth.uid())
CREATE POLICY "bookings_select_own" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookings_insert_own" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_update_own" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bookings_delete_own" ON public.bookings FOR DELETE USING (auth.uid() = user_id);

-- E. Passengers Policies (Joined via booking ownership check)
CREATE POLICY "passengers_select_own" ON public.passengers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = passengers.booking_id AND bookings.user_id = auth.uid())
);
CREATE POLICY "passengers_insert_own" ON public.passengers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = passengers.booking_id AND bookings.user_id = auth.uid())
);
CREATE POLICY "passengers_update_own" ON public.passengers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = passengers.booking_id AND bookings.user_id = auth.uid())
);
CREATE POLICY "passengers_delete_own" ON public.passengers FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = passengers.booking_id AND bookings.user_id = auth.uid())
);

-- F. Reschedules Policies (Joined via booking ownership check)
CREATE POLICY "reschedules_select_own" ON public.reschedules FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = reschedules.booking_id AND bookings.user_id = auth.uid())
);
CREATE POLICY "reschedules_insert_own" ON public.reschedules FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = reschedules.booking_id AND bookings.user_id = auth.uid())
);

-- G. Payments Policies (Joined via booking ownership check)
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = payments.booking_id AND bookings.user_id = auth.uid())
);

-- H. Notifications Policies (Scoped by auth.uid())
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- ─── 5. STORED PROCEDURES / RPC FUNCTIONS ───────────────────

-- A. PNR Generator Helper
CREATE OR REPLACE FUNCTION public.generate_pnr_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN upper(substr(md5(random()::text), 1, 6));
END;
$$;

-- B. Release Seat RPC
CREATE OR REPLACE FUNCTION public.release_seat(
  p_seat_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.seats
  SET status = 'available',
      lock_session = NULL,
      lock_expires_at = NULL,
      updated_at = NOW()
  WHERE id = p_seat_id;
  RETURN TRUE;
END;
$$;

-- C. Lock Seats RPC
CREATE OR REPLACE FUNCTION public.lock_seats(
  p_flight_id     UUID,
  p_seat_ids      UUID[],
  p_lock_session  TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seats_count INT;
BEGIN
  -- Verify all target seats are available (or already locked by the same session)
  SELECT COUNT(*) INTO v_seats_count
  FROM public.seats
  WHERE flight_id = p_flight_id
    AND id = ANY(p_seat_ids)
    AND (
      status = 'available'
      OR (status = 'locked' AND lock_session = p_lock_session)
      OR (status = 'locked' AND lock_expires_at < NOW())
    )
  FOR UPDATE;

  IF v_seats_count IS NULL OR v_seats_count != array_length(p_seat_ids, 1) THEN
    RETURN FALSE;
  END IF;

  -- Lock them
  UPDATE public.seats
  SET status = 'locked',
      lock_session = p_lock_session,
      lock_expires_at = NOW() + INTERVAL '10 minutes',
      updated_at = NOW()
  WHERE flight_id = p_flight_id
    AND id = ANY(p_seat_ids);

  RETURN TRUE;
END;
$$;

-- D. Cleanup Expired Seat Locks RPC
CREATE OR REPLACE FUNCTION public.cleanup_expired_seat_locks()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.seats
  SET status = 'available',
      lock_session = NULL,
      lock_expires_at = NULL,
      updated_at = NOW()
  WHERE status = 'locked' AND lock_expires_at < NOW();
END;
$$;

-- E. Create Booking Transaction RPC (Atomic Multi-Passenger Checkout)
CREATE OR REPLACE FUNCTION public.create_booking_transaction(
  p_flight_id      UUID,
  p_user_id        UUID,
  p_contact_email  TEXT,
  p_contact_phone  TEXT,
  p_total_price    NUMERIC,
  p_passengers     JSONB,
  p_lock_session   TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking_id        UUID;
  v_booking_ref       TEXT;
  v_passenger         JSONB;
  v_seats_locked_cnt  INT;
  v_passenger_cnt     INT;
  v_seat_ids          UUID[];
BEGIN
  -- Extract seat IDs from passengers JSONB array
  SELECT array_agg((val->>'seat_id')::UUID) INTO v_seat_ids
  FROM jsonb_array_elements(p_passengers) AS val;

  v_passenger_cnt := array_length(v_seat_ids, 1);

  -- 1. Verify seat locks match the session
  SELECT COUNT(*) INTO v_seats_locked_cnt
  FROM public.seats
  WHERE flight_id = p_flight_id
    AND id = ANY(v_seat_ids)
    AND status = 'locked'
    AND lock_session = p_lock_session
  FOR UPDATE;

  IF v_seats_locked_cnt != v_passenger_cnt THEN
    RAISE EXCEPTION 'Seat locks are invalid or expired. Please lock seats again.';
  END IF;

  -- 2. Generate Booking Reference
  v_booking_ref := public.generate_pnr_code();

  -- 3. Create Booking
  INSERT INTO public.bookings (booking_reference, user_id, flight_id, contact_email, contact_phone, total_price, status, created_at, updated_at)
  VALUES (v_booking_ref, p_user_id, p_flight_id, p_contact_email, p_contact_phone, p_total_price, 'confirmed', NOW(), NOW())
  RETURNING id INTO v_booking_id;

  -- 4. Insert passengers & update seats status to booked
  FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers) LOOP
    INSERT INTO public.passengers (booking_id, seat_id, first_name, last_name, passport_number, date_of_birth, nationality, created_at)
    VALUES (
      v_booking_id,
      (v_passenger->>'seat_id')::UUID,
      v_passenger->>'first_name',
      v_passenger->>'last_name',
      v_passenger->>'passport_number',
      (v_passenger->>'date_of_birth')::DATE,
      v_passenger->>'nationality',
      NOW()
    );

    UPDATE public.seats
    SET status = 'booked',
        lock_session = NULL,
        lock_expires_at = NULL,
        updated_at = NOW()
    WHERE id = (v_passenger->>'seat_id')::UUID;
  END LOOP;

  -- 5. Insert payment
  INSERT INTO public.payments (booking_id, amount, currency, status, payment_method, created_at, updated_at)
  VALUES (v_booking_id, p_total_price, 'INR', 'completed', 'card', NOW(), NOW());

  RETURN json_build_object(
    'booking_id', v_booking_id,
    'booking_reference', v_booking_ref
  );
END;
$$;

-- F. Reschedule Booking Transaction RPC
CREATE OR REPLACE FUNCTION public.reschedule_booking_transaction(
  p_booking_id       UUID,
  p_user_id          UUID,
  p_new_flight_id    UUID,
  p_passenger_seats  JSONB,
  p_new_total_price  NUMERIC,
  p_fee              NUMERIC,
  p_reason           TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_flight_id UUID;
  v_old_seat_ids  UUID[];
  v_new_seat_ids  UUID[];
  v_ps            JSONB;
  v_old_origin    TEXT;
  v_old_dest      TEXT;
  v_new_origin    TEXT;
  v_new_dest      TEXT;
BEGIN
  -- 1. Ownership & Booking extraction
  SELECT flight_id INTO v_old_flight_id
  FROM public.bookings
  WHERE id = p_booking_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or access denied.';
  END IF;

  -- 2. Verify route parity
  SELECT origin_iata, destination_iata INTO v_old_origin, v_old_dest FROM public.flights WHERE id = v_old_flight_id;
  SELECT origin_iata, destination_iata INTO v_new_origin, v_new_dest FROM public.flights WHERE id = p_new_flight_id;

  IF v_old_origin != v_new_origin OR v_old_dest != v_new_dest THEN
    RAISE EXCEPTION 'Flight routes must match the original scheduled hubs for rescheduling.';
  END IF;

  -- Get old seat IDs for this booking
  SELECT array_agg(seat_id) INTO v_old_seat_ids
  FROM public.passengers
  WHERE booking_id = p_booking_id;

  -- Extract new seat IDs
  SELECT array_agg((val->>'seat_id')::UUID) INTO v_new_seat_ids
  FROM jsonb_array_elements(p_passenger_seats) AS val;

  -- 3. Free old seats
  UPDATE public.seats
  SET status = 'available',
      lock_session = NULL,
      lock_expires_at = NULL,
      updated_at = NOW()
  WHERE id = ANY(v_old_seat_ids);

  -- 4. Update passengers with new seats & set new seats as booked
  FOR v_ps IN SELECT * FROM jsonb_array_elements(p_passenger_seats) LOOP
    UPDATE public.passengers
    SET seat_id = (v_ps->>'seat_id')::UUID
    WHERE id = (v_ps->>'passenger_id')::UUID;

    UPDATE public.seats
    SET status = 'booked',
        lock_session = NULL,
        lock_expires_at = NULL,
        updated_at = NOW()
    WHERE id = (v_ps->>'seat_id')::UUID;
  END LOOP;

  -- 5. Update Booking status & price
  UPDATE public.bookings
  SET flight_id = p_new_flight_id,
      status = 'rescheduled',
      total_price = p_new_total_price,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- 6. Log Reschedule
  INSERT INTO public.reschedules (booking_id, old_flight_id, new_flight_id, old_seat_ids, new_seat_ids, price_difference, status, created_at)
  VALUES (p_booking_id, v_old_flight_id, p_new_flight_id, v_old_seat_ids, v_new_seat_ids, p_fee, 'confirmed', NOW());

  RETURN TRUE;
END;
$$;

-- G. Cancel Booking Transaction RPC
CREATE OR REPLACE FUNCTION public.cancel_booking_transaction(
  p_booking_id UUID,
  p_user_id    UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seat_ids UUID[];
  v_seat_id  UUID;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings WHERE id = p_booking_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Booking not found or access denied.';
  END IF;

  -- Get all seat IDs for the passengers of this booking
  SELECT array_agg(seat_id) INTO v_seat_ids
  FROM public.passengers
  WHERE booking_id = p_booking_id;

  -- Update booking status
  UPDATE public.bookings
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- Release seats
  FOREACH v_seat_id IN ARRAY v_seat_ids LOOP
    UPDATE public.seats
    SET status = 'available',
        lock_session = NULL,
        lock_expires_at = NULL,
        updated_at = NOW()
    WHERE id = v_seat_id;
  END LOOP;

  -- Refund payment (update payment table)
  UPDATE public.payments
  SET status = 'refunded',
      updated_at = NOW()
  WHERE booking_id = p_booking_id;

  RETURN TRUE;
END;
$$;

-- ─── 6. CANCELLATION RESTRICTION (2-HOUR DB LEVEL TRIGGER) ────
CREATE OR REPLACE FUNCTION public.enforce_cancellation_rule()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_departs_at TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Verify flight departure time
    SELECT departure_time INTO v_departs_at
    FROM public.flights
    WHERE id = OLD.flight_id;

    IF v_departs_at < NOW() + INTERVAL '2 hours' THEN
      RAISE EXCEPTION 'Cancellations within 2 hours of flight departure are strictly prohibited.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cancellation ON public.bookings;
CREATE TRIGGER trg_enforce_cancellation
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_cancellation_rule();
