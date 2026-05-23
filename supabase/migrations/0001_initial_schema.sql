-- ============================================================
-- AEROGLIDE COMPLETE DATABASE SCHEMA (ROOT MIGRATION)
-- Location: /supabase/migrations/0001_initial_schema.sql
-- ============================================================

-- ─── 1. EXTENSIONS ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 2. TABLES ──────────────────────────────────────────────

-- A. FLIGHTS TABLE
CREATE TABLE IF NOT EXISTS public.flights (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_no      TEXT          NOT NULL,
  origin         TEXT          NOT NULL,
  destination    TEXT          NOT NULL,
  departs_at     TIMESTAMPTZ   NOT NULL,
  arrives_at     TIMESTAMPTZ   NOT NULL,
  aircraft_type  TEXT          NOT NULL,
  status         TEXT          NOT NULL DEFAULT 'scheduled',
  base_price     NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT flights_arrival_after_departure CHECK (arrives_at > departs_at),
  CONSTRAINT flights_different_cities CHECK (origin != destination)
);

-- B. SEATS TABLE
CREATE TABLE IF NOT EXISTS public.seats (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id      UUID          NOT NULL,
  seat_number    TEXT          NOT NULL,
  class          TEXT          NOT NULL CHECK (class IN ('economy', 'business', 'first')),
  is_available   BOOLEAN       NOT NULL DEFAULT true,
  extra_fee      NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (extra_fee >= 0),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_seats_flight FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON DELETE CASCADE,
  CONSTRAINT seats_unique_per_flight UNIQUE (flight_id, seat_number)
);

-- C. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID           NOT NULL,
  flight_id      UUID           NOT NULL,
  seat_id        UUID           NOT NULL,
  status         TEXT           NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'rescheduled', 'cancelled')),
  booked_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  total_price    NUMERIC(10,2)  NOT NULL CHECK (total_price >= 0),
  pnr_code       TEXT           NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_bookings_flight FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_seat   FOREIGN KEY (seat_id)   REFERENCES public.seats(id)    ON DELETE RESTRICT
);

-- D. PASSENGERS TABLE
CREATE TABLE IF NOT EXISTS public.passengers (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID        NOT NULL,
  full_name      TEXT        NOT NULL,
  passport_no    TEXT        NOT NULL,
  nationality    TEXT        NOT NULL,
  dob            DATE        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_passengers_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE
);

-- E. RESCHEDULES TABLE
CREATE TABLE IF NOT EXISTS public.reschedules (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID          NOT NULL,
  old_flight_id  UUID          NOT NULL,
  new_flight_id  UUID          NOT NULL,
  requested_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  fee_charged    NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (fee_charged >= 0),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_reschedules_booking    FOREIGN KEY (booking_id)    REFERENCES public.bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_reschedules_old_flight FOREIGN KEY (old_flight_id) REFERENCES public.flights(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_reschedules_new_flight FOREIGN KEY (new_flight_id) REFERENCES public.flights(id)  ON DELETE RESTRICT
);

-- ─── 3. INDEX OPTIMIZATIONS ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_flights_no        ON public.flights(flight_no);
CREATE INDEX IF NOT EXISTS idx_flights_route     ON public.flights(origin, destination);
CREATE INDEX IF NOT EXISTS idx_flights_departs   ON public.flights(departs_at);
CREATE INDEX IF NOT EXISTS idx_seats_flight      ON public.seats(flight_id);
CREATE INDEX IF NOT EXISTS idx_seats_available   ON public.seats(is_available);
CREATE INDEX IF NOT EXISTS idx_bookings_user     ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_flight   ON public.bookings(flight_id);
CREATE INDEX IF NOT EXISTS idx_bookings_seat     ON public.bookings(seat_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status   ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_pnr      ON public.bookings(pnr_code);
CREATE INDEX IF NOT EXISTS idx_passengers_booking ON public.passengers(booking_id);
CREATE INDEX IF NOT EXISTS idx_reschedules_book  ON public.reschedules(booking_id);

-- ─── 4. ROW LEVEL SECURITY (RLS) POLICIES ───────────────────
ALTER TABLE public.flights     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passengers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reschedules ENABLE ROW LEVEL SECURITY;

-- A. Flights Policies (Read-only for all, write-only for authenticated admins)
CREATE POLICY "flights_read_all" ON public.flights FOR SELECT USING (true);

-- B. Seats Policies (Read-only for all)
CREATE POLICY "seats_read_all" ON public.seats FOR SELECT USING (true);

-- C. Bookings Policies (Scoped by auth.uid())
CREATE POLICY "bookings_select_own" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookings_insert_own" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings_update_own" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "bookings_delete_own" ON public.bookings
  FOR DELETE USING (auth.uid() = user_id);

-- D. Passengers Policies (Joined via booking ownership check)
CREATE POLICY "passengers_select_own" ON public.passengers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.id = passengers.booking_id AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "passengers_insert_own" ON public.passengers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.id = passengers.booking_id AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "passengers_update_own" ON public.passengers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.id = passengers.booking_id AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "passengers_delete_own" ON public.passengers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.id = passengers.booking_id AND bookings.user_id = auth.uid()
    )
  );

-- E. Reschedules Policies (Joined via booking ownership check)
CREATE POLICY "reschedules_select_own" ON public.reschedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.id = reschedules.booking_id AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "reschedules_insert_own" ON public.reschedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.id = reschedules.booking_id AND bookings.user_id = auth.uid()
    )
  );

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
  SET is_available = TRUE
  WHERE id = p_seat_id;
  RETURN TRUE;
END;
$$;

-- C. Reserve Seat RPC (Atomic transaction with Row-level Locking)
CREATE OR REPLACE FUNCTION public.reserve_seat(
  p_flight_id      UUID,
  p_seat_id        UUID,
  p_user_id        UUID,
  p_total_price    NUMERIC,
  p_passengers     JSONB
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking_id  UUID;
  v_pnr         TEXT;
  v_passenger   JSONB;
  v_available   BOOLEAN;
BEGIN
  -- 1. Row locking & seat availability verification
  SELECT is_available INTO v_available
  FROM public.seats
  WHERE id = p_seat_id AND flight_id = p_flight_id
  FOR UPDATE;

  IF v_available IS NOT TRUE THEN
    RAISE EXCEPTION 'Selected seat is already reserved or occupied.';
  END IF;

  -- 2. Mark seat as occupied
  UPDATE public.seats
  SET is_available = FALSE, updated_at = NOW()
  WHERE id = p_seat_id;

  -- 3. Generate PNR
  v_pnr := public.generate_pnr_code();

  -- 4. Create booking atomically
  INSERT INTO public.bookings (user_id, flight_id, seat_id, status, booked_at, total_price, pnr_code)
  VALUES (p_user_id, p_flight_id, p_seat_id, 'confirmed', NOW(), p_total_price, v_pnr)
  RETURNING id INTO v_booking_id;

  -- 5. Insert passengers
  FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers) LOOP
    INSERT INTO public.passengers (booking_id, full_name, passport_no, nationality, dob)
    VALUES (
      v_booking_id,
      v_passenger->>'full_name',
      v_passenger->>'passport_no',
      v_passenger->>'nationality',
      (v_passenger->>'dob')::DATE
    );
  END LOOP;

  RETURN json_build_object(
    'booking_id', v_booking_id,
    'pnr_code', v_pnr
  );
END;
$$;

-- D. Reschedule Booking RPC (Atomic route-matched transaction)
CREATE OR REPLACE FUNCTION public.reschedule_booking(
  p_booking_id      UUID,
  p_new_flight_id   UUID,
  p_new_seat_id     UUID,
  p_user_id         UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_flight_id  UUID;
  v_old_seat_id    UUID;
  v_old_price      NUMERIC;
  v_new_price      NUMERIC;
  v_old_origin     TEXT;
  v_old_dest       TEXT;
  v_new_origin     TEXT;
  v_new_dest       TEXT;
  v_seat_available BOOLEAN;
  v_fee            NUMERIC := 1500.00; -- Flat INR 1500 Reschedule Fee
  v_price_diff     NUMERIC;
BEGIN
  -- 1. Ownership & Booking extraction
  SELECT flight_id, seat_id, total_price INTO v_old_flight_id, v_old_seat_id, v_old_price
  FROM public.bookings
  WHERE id = p_booking_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or access denied.';
  END IF;

  -- 2. Verify route parity
  SELECT origin, destination INTO v_old_origin, v_old_dest FROM public.flights WHERE id = v_old_flight_id;
  SELECT origin, destination INTO v_new_origin, v_new_dest FROM public.flights WHERE id = p_new_flight_id;

  IF v_old_origin != v_new_origin OR v_old_dest != v_new_dest THEN
    RAISE EXCEPTION 'Flight routes must match the original scheduled hubs for rescheduling.';
  END IF;

  -- 3. Row lock and new seat availability validation
  SELECT is_available, (extra_fee + (SELECT base_price FROM public.flights WHERE id = p_new_flight_id))
  INTO v_seat_available, v_new_price
  FROM public.seats
  WHERE id = p_new_seat_id AND flight_id = p_new_flight_id
  FOR UPDATE;

  IF v_seat_available IS NOT TRUE THEN
    RAISE EXCEPTION 'Selected reschedule seat is already reserved or unavailable.';
  END IF;

  -- 4. Free old seat
  UPDATE public.seats SET is_available = TRUE, updated_at = NOW() WHERE id = v_old_seat_id;

  -- 5. Reserve new seat
  UPDATE public.seats SET is_available = FALSE, updated_at = NOW() WHERE id = p_new_seat_id;

  -- 6. Calculate fee structure
  IF v_new_price > v_old_price THEN
    v_price_diff := (v_new_price - v_old_price) + v_fee;
  ELSE
    v_price_diff := v_fee;
  END IF;

  -- 7. Perform Booking Switch
  UPDATE public.bookings
  SET flight_id = p_new_flight_id,
      seat_id = p_new_seat_id,
      status = 'rescheduled',
      total_price = v_old_price + v_price_diff,
      booked_at = NOW(),
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- 8. Log Reschedule
  INSERT INTO public.reschedules (booking_id, old_flight_id, new_flight_id, requested_at, fee_charged)
  VALUES (p_booking_id, v_old_flight_id, p_new_flight_id, NOW(), v_price_diff);

  RETURN TRUE;
END;
$$;

-- E. Cancel Booking RPC (Atomic state transition)
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id UUID,
  p_user_id    UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seat_id UUID;
BEGIN
  -- 1. Ownership validation
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings WHERE id = p_booking_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Booking not found or access denied.';
  END IF;

  -- 2. Obtain seat reference
  SELECT seat_id INTO v_seat_id
  FROM public.bookings
  WHERE id = p_booking_id;

  -- 3. Transition booking status (Triggers 2-hour departure restriction check)
  UPDATE public.bookings
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_booking_id;

  -- 4. Release locked seat
  UPDATE public.seats
  SET is_available = TRUE, updated_at = NOW()
  WHERE id = v_seat_id;

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
    SELECT departs_at INTO v_departs_at
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
