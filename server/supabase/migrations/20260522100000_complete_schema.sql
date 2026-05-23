-- ============================================================
-- AEROGLIDE COMPLETE DATABASE SCHEMA
-- Migration: 20260522100000_complete_schema.sql
-- ============================================================
-- Safe: Uses IF NOT EXISTS — idempotent on re-run.
-- Covers all 10 required tables with:
--   ✅ Foreign keys & constraints
--   ✅ Indexes for query performance
--   ✅ Row Level Security (RLS) policies
--   ✅ Proper enums & defaults
--   ✅ Audit timestamps (created_at, updated_at)
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fast text search on airports/flights

-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE seat_status     AS ENUM ('available', 'locked', 'booked', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cabin_class     AS ENUM ('economy', 'premium_economy', 'business', 'first');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status  AS ENUM ('pending', 'confirmed', 'cancelled', 'rescheduled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE flight_status   AS ENUM ('scheduled', 'boarding', 'departed', 'landed', 'cancelled', 'delayed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status  AS ENUM ('pending', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. USERS ─────────────────────────────────────────────────────────────────
-- Mirrors Supabase auth.users (via trigger sync or direct profile table).
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  full_name   TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_format CHECK (email ~* '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Auto-sync profile from Supabase Auth on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── 2. AIRPORTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.airports (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  iata             CHAR(3) NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  city             TEXT    NOT NULL,
  country          TEXT    NOT NULL,
  latitude         NUMERIC(9,6),
  longitude        NUMERIC(9,6),
  timezone         TEXT,
  is_international BOOLEAN NOT NULL DEFAULT true,
  popularity       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airports_iata_format CHECK (iata ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS idx_airports_iata       ON public.airports(iata);
CREATE INDEX IF NOT EXISTS idx_airports_city       ON public.airports USING gin(city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_airports_name       ON public.airports USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_airports_popularity ON public.airports(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_airports_coords     ON public.airports(latitude, longitude);

-- ─── 3. FLIGHTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flights (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_number    TEXT          NOT NULL,
  airline          TEXT          NOT NULL,
  origin_iata      CHAR(3)       NOT NULL,
  destination_iata CHAR(3)       NOT NULL,
  departure_time   TIMESTAMPTZ   NOT NULL,
  arrival_time     TIMESTAMPTZ   NOT NULL,
  duration_minutes INTEGER       NOT NULL CHECK (duration_minutes > 0),
  base_price       NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  status           flight_status NOT NULL DEFAULT 'scheduled',
  aircraft_type    TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_flights_origin      FOREIGN KEY (origin_iata)      REFERENCES public.airports(iata) ON UPDATE CASCADE,
  CONSTRAINT fk_flights_destination FOREIGN KEY (destination_iata) REFERENCES public.airports(iata) ON UPDATE CASCADE,
  CONSTRAINT flights_arrival_after_departure CHECK (arrival_time > departure_time),
  CONSTRAINT flights_different_airports CHECK (origin_iata != destination_iata)
);

CREATE INDEX IF NOT EXISTS idx_flights_route    ON public.flights(origin_iata, destination_iata);
CREATE INDEX IF NOT EXISTS idx_flights_depart   ON public.flights(departure_time);
CREATE INDEX IF NOT EXISTS idx_flights_status   ON public.flights(status);
CREATE INDEX IF NOT EXISTS idx_flights_number   ON public.flights(flight_number);
CREATE INDEX IF NOT EXISTS idx_flights_airline  ON public.flights(airline);

-- ─── 4. SEATS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seats (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id        UUID          NOT NULL,
  seat_code        TEXT          NOT NULL,
  cabin_class      cabin_class   NOT NULL DEFAULT 'economy',
  status           seat_status   NOT NULL DEFAULT 'available',
  price_modifier   NUMERIC(5,2)  NOT NULL DEFAULT 1.0 CHECK (price_modifier >= 0),
  lock_session     TEXT,
  lock_expires_at  TIMESTAMPTZ,
  features         JSONB,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_seats_flight FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON DELETE CASCADE,
  CONSTRAINT seats_unique_code_per_flight UNIQUE (flight_id, seat_code)
);

CREATE INDEX IF NOT EXISTS idx_seats_flight_id   ON public.seats(flight_id);
CREATE INDEX IF NOT EXISTS idx_seats_status      ON public.seats(status);
CREATE INDEX IF NOT EXISTS idx_seats_lock_exp    ON public.seats(lock_expires_at) WHERE lock_expires_at IS NOT NULL;

-- ─── 5. BOOKINGS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT           NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
  user_id           UUID           NOT NULL,
  flight_id         UUID           NOT NULL,
  contact_email     TEXT           NOT NULL,
  contact_phone     TEXT           NOT NULL,
  total_price       NUMERIC(10,2)  NOT NULL CHECK (total_price >= 0),
  status            booking_status NOT NULL DEFAULT 'confirmed',
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_bookings_user   FOREIGN KEY (user_id)   REFERENCES public.users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_bookings_flight FOREIGN KEY (flight_id) REFERENCES public.flights(id)  ON DELETE RESTRICT,
  CONSTRAINT bookings_email_format CHECK (contact_email ~* '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_bookings_user      ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_flight    ON public.bookings(flight_id);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_email     ON public.bookings(contact_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status    ON public.bookings(status);

-- ─── 6. PASSENGERS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.passengers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID        NOT NULL,
  seat_id         UUID        NOT NULL,
  first_name      TEXT        NOT NULL,
  last_name       TEXT        NOT NULL,
  passport_number TEXT,
  date_of_birth   DATE,
  nationality     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_passengers_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_passengers_seat    FOREIGN KEY (seat_id)    REFERENCES public.seats(id)    ON DELETE RESTRICT,
  CONSTRAINT passengers_passport_format CHECK (
    passport_number IS NULL OR
    passport_number ~ '^[A-Z0-9]{6,9}$'
  ),
  CONSTRAINT passengers_first_name_alpha CHECK (first_name ~ '^[a-zA-Z ]+$'),
  CONSTRAINT passengers_last_name_alpha  CHECK (last_name  ~ '^[a-zA-Z ]+$')
);

CREATE INDEX IF NOT EXISTS idx_passengers_booking ON public.passengers(booking_id);
CREATE INDEX IF NOT EXISTS idx_passengers_seat    ON public.passengers(seat_id);

-- ─── 7. PAYMENTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID           NOT NULL,
  amount         NUMERIC(10,2)  NOT NULL CHECK (amount >= 0),
  currency       CHAR(3)        NOT NULL DEFAULT 'INR',
  status         payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT           UNIQUE,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status  ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_tx_id   ON public.payments(transaction_id) WHERE transaction_id IS NOT NULL;

-- ─── 8. RESCHEDULES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reschedules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID        NOT NULL,
  old_flight_id    UUID        NOT NULL,
  new_flight_id    UUID        NOT NULL,
  old_seat_ids     UUID[]      NOT NULL,
  new_seat_ids     UUID[]      NOT NULL,
  price_difference NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'confirmed'
                               CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_reschedules_booking    FOREIGN KEY (booking_id)    REFERENCES public.bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_reschedules_old_flight FOREIGN KEY (old_flight_id) REFERENCES public.flights(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_reschedules_new_flight FOREIGN KEY (new_flight_id) REFERENCES public.flights(id)  ON DELETE RESTRICT,
  CONSTRAINT reschedules_different_flights CHECK (old_flight_id != new_flight_id)
);

CREATE INDEX IF NOT EXISTS idx_reschedules_booking ON public.reschedules(booking_id);

-- ─── 9. TRACKING LOGS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracking_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id   UUID        NOT NULL,
  event_type  TEXT        NOT NULL,
  details     JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tracking_flight FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracking_flight_id ON public.tracking_logs(flight_id);
CREATE INDEX IF NOT EXISTS idx_tracking_recorded  ON public.tracking_logs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_event     ON public.tracking_logs(event_type);

-- ─── 10. NOTIFICATIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID              NOT NULL,
  title      TEXT              NOT NULL,
  message    TEXT              NOT NULL,
  type       notification_type NOT NULL DEFAULT 'info',
  is_read    BOOLEAN           NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- ─── Updated_at Trigger Function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to tables with updated_at
DO $$ DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','flights','seats','bookings','payments'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;
       CREATE TRIGGER trg_set_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ─── RLS: Enable Row Level Security ───────────────────────────────────────────
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passengers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reschedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;

-- ─── RLS: Airports — Public Read ─────────────────────────────────────────────
DROP POLICY IF EXISTS "airports_public_read"  ON public.airports;
CREATE POLICY "airports_public_read" ON public.airports
  FOR SELECT USING (true);

-- ─── RLS: Flights — Public Read ──────────────────────────────────────────────
DROP POLICY IF EXISTS "flights_public_read"   ON public.flights;
CREATE POLICY "flights_public_read" ON public.flights
  FOR SELECT USING (true);

-- ─── RLS: Seats — Public Read ────────────────────────────────────────────────
DROP POLICY IF EXISTS "seats_public_read"     ON public.seats;
CREATE POLICY "seats_public_read" ON public.seats
  FOR SELECT USING (true);

-- ─── RLS: Tracking logs — Public Read ────────────────────────────────────────
DROP POLICY IF EXISTS "tracking_public_read"  ON public.tracking_logs;
CREATE POLICY "tracking_public_read" ON public.tracking_logs
  FOR SELECT USING (true);

-- ─── RLS: Users — Own Row Only ────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own"  ON public.users;
DROP POLICY IF EXISTS "users_update_own"  ON public.users;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ─── RLS: Bookings — Own Rows Only ───────────────────────────────────────────
DROP POLICY IF EXISTS "bookings_select_own"  ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_own"  ON public.bookings;

CREATE POLICY "bookings_select_own" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookings_insert_own" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── RLS: Passengers — Via booking ownership ─────────────────────────────────
DROP POLICY IF EXISTS "passengers_select_own"  ON public.passengers;
DROP POLICY IF EXISTS "passengers_insert_own"  ON public.passengers;

CREATE POLICY "passengers_select_own" ON public.passengers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = passengers.booking_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "passengers_insert_own" ON public.passengers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = passengers.booking_id AND b.user_id = auth.uid()
    )
  );

-- ─── RLS: Payments — Via booking ownership ───────────────────────────────────
DROP POLICY IF EXISTS "payments_select_own"  ON public.payments;

CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = payments.booking_id AND b.user_id = auth.uid()
    )
  );

-- ─── RLS: Reschedules — Via booking ownership ────────────────────────────────
DROP POLICY IF EXISTS "reschedules_select_own"  ON public.reschedules;

CREATE POLICY "reschedules_select_own" ON public.reschedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = reschedules.booking_id AND b.user_id = auth.uid()
    )
  );

-- ─── RLS: Notifications — Own Only ───────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_select_own"  ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own"  ON public.notifications;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Stored Procedure: lock_seats ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lock_seats(
  p_flight_id   UUID,
  p_seat_ids    UUID[],
  p_lock_session TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_locked INT;
BEGIN
  -- Clean up expired locks first
  UPDATE public.seats
  SET status = 'available', lock_session = NULL, lock_expires_at = NULL
  WHERE status = 'locked' AND lock_expires_at < NOW();

  UPDATE public.seats
  SET
    status          = 'locked',
    lock_session    = p_lock_session,
    lock_expires_at = NOW() + INTERVAL '10 minutes',
    updated_at      = NOW()
  WHERE
    id = ANY(p_seat_ids)
    AND flight_id = p_flight_id
    AND status = 'available';

  GET DIAGNOSTICS v_locked = ROW_COUNT;
  RETURN v_locked = array_length(p_seat_ids, 1);
END;
$$;

-- ─── Stored Procedure: cleanup_expired_seat_locks ────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_seat_locks()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.seats
  SET status = 'available', lock_session = NULL, lock_expires_at = NULL, updated_at = NOW()
  WHERE status = 'locked' AND lock_expires_at < NOW();
END;
$$;

-- ─── Stored Procedure: create_booking_transaction ────────────────────────────
CREATE OR REPLACE FUNCTION public.create_booking_transaction(
  p_flight_id     UUID,
  p_user_id       UUID,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_total_price   NUMERIC,
  p_passengers    JSONB,
  p_lock_session  TEXT
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking_id  UUID;
  v_reference   TEXT;
  v_passenger   JSONB;
BEGIN
  -- Generate booking
  INSERT INTO public.bookings (user_id, flight_id, contact_email, contact_phone, total_price, status)
  VALUES (p_user_id, p_flight_id, p_contact_email, p_contact_phone, p_total_price, 'confirmed')
  RETURNING id, booking_reference INTO v_booking_id, v_reference;

  -- Insert passengers
  FOR v_passenger IN SELECT * FROM jsonb_array_elements(p_passengers) LOOP
    INSERT INTO public.passengers (booking_id, seat_id, first_name, last_name, passport_number)
    VALUES (
      v_booking_id,
      (v_passenger->>'seat_id')::UUID,
      v_passenger->>'first_name',
      v_passenger->>'last_name',
      v_passenger->>'passport_number'
    );

    -- Mark seat as booked
    UPDATE public.seats
    SET status = 'booked', lock_session = NULL, lock_expires_at = NULL, updated_at = NOW()
    WHERE id = (v_passenger->>'seat_id')::UUID AND lock_session = p_lock_session;
  END LOOP;

  -- Create payment record (pending)
  INSERT INTO public.payments (booking_id, amount, currency, status)
  VALUES (v_booking_id, p_total_price, 'INR', 'completed');

  RETURN v_reference;
END;
$$;

-- ─── Stored Procedure: cancel_booking_transaction ────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_booking_transaction(
  p_booking_id UUID,
  p_user_id    UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_depart TIMESTAMPTZ;
BEGIN
  -- Ownership check
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings WHERE id = p_booking_id AND user_id = p_user_id
  ) THEN RETURN FALSE; END IF;

  -- Time window check (2 hours before departure)
  SELECT f.departure_time INTO v_depart
  FROM public.bookings b JOIN public.flights f ON f.id = b.flight_id
  WHERE b.id = p_booking_id;

  IF v_depart < NOW() + INTERVAL '2 hours' THEN
    RAISE EXCEPTION 'Cancellation not allowed within 2 hours of departure.';
  END IF;

  -- Free seats
  UPDATE public.seats SET status = 'available', lock_session = NULL, updated_at = NOW()
  WHERE id IN (
    SELECT seat_id FROM public.passengers WHERE booking_id = p_booking_id
  );

  -- Cancel booking
  UPDATE public.bookings SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_booking_id;

  -- Refund payment
  UPDATE public.payments SET status = 'refunded', updated_at = NOW()
  WHERE booking_id = p_booking_id;

  RETURN TRUE;
END;
$$;

-- ─── Stored Procedure: reschedule_booking_transaction ────────────────────────
CREATE OR REPLACE FUNCTION public.reschedule_booking_transaction(
  p_booking_id    UUID,
  p_new_flight_id UUID,
  p_new_seat_ids  UUID[],
  p_lock_session  TEXT,
  p_user_id       UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_flight_id UUID;
  v_old_seat_ids  UUID[];
  v_new_price     NUMERIC;
  v_old_price     NUMERIC;
BEGIN
  -- Ownership check
  SELECT flight_id, total_price INTO v_old_flight_id, v_old_price
  FROM public.bookings
  WHERE id = p_booking_id AND user_id = p_user_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Collect old seat IDs
  SELECT array_agg(seat_id) INTO v_old_seat_ids
  FROM public.passengers WHERE booking_id = p_booking_id;

  -- Get new total price
  SELECT SUM(f.base_price * s.price_modifier)
  INTO v_new_price
  FROM public.seats s
  JOIN public.flights f ON f.id = s.flight_id
  WHERE s.id = ANY(p_new_seat_ids);

  -- Free old seats
  UPDATE public.seats SET status = 'available', lock_session = NULL, updated_at = NOW()
  WHERE id = ANY(v_old_seat_ids);

  -- Book new seats
  UPDATE public.seats SET status = 'booked', lock_session = NULL, updated_at = NOW()
  WHERE id = ANY(p_new_seat_ids) AND lock_session = p_lock_session;

  -- Update passengers to new seats (basic 1:1 mapping)
  UPDATE public.passengers
  SET seat_id = p_new_seat_ids[ordinality]
  FROM unnest(v_old_seat_ids) WITH ORDINALITY AS old_seats(id, ordinality)
  WHERE public.passengers.seat_id = old_seats.id
    AND public.passengers.booking_id = p_booking_id;

  -- Update booking
  UPDATE public.bookings
  SET flight_id = p_new_flight_id, status = 'rescheduled',
      total_price = COALESCE(v_new_price, v_old_price), updated_at = NOW()
  WHERE id = p_booking_id;

  -- Record reschedule log
  INSERT INTO public.reschedules
    (booking_id, old_flight_id, new_flight_id, old_seat_ids, new_seat_ids, price_difference, status)
  VALUES
    (p_booking_id, v_old_flight_id, p_new_flight_id, v_old_seat_ids, p_new_seat_ids,
     COALESCE(v_new_price, v_old_price) - v_old_price, 'confirmed');

  RETURN TRUE;
END;
$$;

-- ─── Grant Execution to Authenticated Users ───────────────────────────────────
GRANT EXECUTE ON FUNCTION public.lock_seats              TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_seat_locks TO authenticated, service_role;

-- Grant read on public tables to anon (for airport/flight search)
GRANT SELECT ON public.airports      TO anon, authenticated;
GRANT SELECT ON public.flights       TO anon, authenticated;
GRANT SELECT ON public.seats         TO anon, authenticated;
GRANT SELECT ON public.tracking_logs TO anon, authenticated;

-- Grant full access on user-owned tables to authenticated
GRANT ALL ON public.users         TO authenticated;
GRANT ALL ON public.bookings      TO authenticated;
GRANT ALL ON public.passengers    TO authenticated;
GRANT ALL ON public.payments      TO authenticated;
GRANT ALL ON public.reschedules   TO authenticated;
GRANT ALL ON public.notifications TO authenticated;

-- ─── 13. AIRPORT SEARCH CACHE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.airport_search_cache (
  query VARCHAR(255) PRIMARY KEY,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.airport_search_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_cache_public_read" ON public.airport_search_cache;
CREATE POLICY "search_cache_public_read" ON public.airport_search_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "search_cache_public_write" ON public.airport_search_cache;
CREATE POLICY "search_cache_public_write" ON public.airport_search_cache
  FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.airport_search_cache TO anon, authenticated, service_role;

-- ─── Distance & Proximity Helpers ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  r DOUBLE PRECISION := 6371; -- Earth radius in km
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_nearby_airports(
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  iata VARCHAR,
  icao VARCHAR,
  name VARCHAR,
  city VARCHAR,
  country VARCHAR,
  timezone VARCHAR,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  elevation INTEGER,
  flag VARCHAR,
  type VARCHAR,
  popularity INTEGER,
  image_url VARCHAR,
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.iata::VARCHAR, 
    a.iata::VARCHAR as icao, -- fallback
    a.name, a.city, a.country, a.timezone, 
    a.latitude::DOUBLE PRECISION, a.longitude::DOUBLE PRECISION, 
    0::INTEGER as elevation, -- fallback
    ''::VARCHAR as flag, -- fallback
    CASE WHEN a.is_international THEN 'international'::VARCHAR ELSE 'domestic'::VARCHAR END as type,
    a.popularity, 
    ''::VARCHAR as image_url, -- fallback
    public.calculate_distance(p_lat, p_lon, a.latitude::DOUBLE PRECISION, a.longitude::DOUBLE PRECISION) AS distance
  FROM public.airports a
  ORDER BY distance ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.increment_airport_popularity(p_iata VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE public.airports
  SET popularity = popularity + 1
  WHERE iata = p_iata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Data Seeding Helper ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_airport_data(
  p_airports jsonb,
  p_airlines jsonb,
  p_terminals jsonb
) RETURNS boolean AS $$
DECLARE
  v_airport jsonb;
  v_airline jsonb;
BEGIN
  -- Seed airports
  FOR v_airport IN SELECT * FROM jsonb_array_elements(p_airports) LOOP
    INSERT INTO public.airports (iata, name, city, country, latitude, longitude, timezone, is_international, popularity)
    VALUES (
      v_airport->>'iata',
      v_airport->>'name',
      v_airport->>'city',
      v_airport->>'country',
      (v_airport->>'latitude')::numeric,
      (v_airport->>'longitude')::numeric,
      v_airport->>'timezone',
      COALESCE((v_airport->>'is_international')::boolean, true),
      (v_airport->>'popularity')::integer
    )
    ON CONFLICT (iata) DO UPDATE SET
      name = EXCLUDED.name,
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      timezone = EXCLUDED.timezone,
      is_international = EXCLUDED.is_international,
      popularity = EXCLUDED.popularity;
  END LOOP;

  -- Seed airlines
  FOR v_airline IN SELECT * FROM jsonb_array_elements(p_airlines) LOOP
    INSERT INTO public.airlines (iata, name)
    VALUES (
      v_airline->>'iata',
      v_airline->>'name'
    )
    ON CONFLICT (iata) DO UPDATE SET
      name = EXCLUDED.name;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.upsert_search_cache(
  p_query varchar,
  p_results jsonb,
  p_expires_at timestamp with time zone
) RETURNS void AS $$
BEGIN
  INSERT INTO public.airport_search_cache (query, results, expires_at, created_at)
  VALUES (p_query, p_results, p_expires_at, now())
  ON CONFLICT (query) DO UPDATE
  SET results = EXCLUDED.results,
      expires_at = EXCLUDED.expires_at,
      created_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION public.calculate_distance TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_airports TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_airport_popularity TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_airport_data TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_search_cache TO anon, authenticated, service_role;

