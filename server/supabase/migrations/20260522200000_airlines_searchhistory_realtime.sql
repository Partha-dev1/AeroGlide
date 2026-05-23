-- ============================================================
-- AEROGLIDE — AIRLINES, SEARCH_HISTORY, REALTIME SETUP
-- Migration: 20260522200000_airlines_searchhistory_realtime.sql
-- ============================================================
-- Safe: Uses IF NOT EXISTS / OR REPLACE — idempotent on re-run.
-- Adds:
--   ✅ airlines table (IATA, name, logo, country)
--   ✅ search_history table (per-user query log)
--   ✅ Realtime REPLICA IDENTITY FULL on subscribed tables
--   ✅ pg_cron seat lock cleanup (every 5 min)
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ─── 11. AIRLINES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.airlines (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  iata        CHAR(2) NOT NULL UNIQUE,
  icao        CHAR(3),
  name        TEXT    NOT NULL,
  country     TEXT    NOT NULL DEFAULT 'India',
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airlines_iata_format CHECK (iata ~ '^[A-Z0-9]{2}$')
);

CREATE INDEX IF NOT EXISTS idx_airlines_iata   ON public.airlines(iata);
CREATE INDEX IF NOT EXISTS idx_airlines_name   ON public.airlines(name);
CREATE INDEX IF NOT EXISTS idx_airlines_active ON public.airlines(is_active);

-- ─── 12. SEARCH HISTORY ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,       -- NULL for anonymous searches
  origin_iata     CHAR(3)     NOT NULL,
  destination_iata CHAR(3)   NOT NULL,
  travel_date     DATE        NOT NULL,
  return_date     DATE,
  passenger_count INTEGER     NOT NULL DEFAULT 1 CHECK (passenger_count BETWEEN 1 AND 9),
  cabin_class     TEXT        NOT NULL DEFAULT 'economy'
                              CHECK (cabin_class IN ('economy', 'premium_economy', 'business', 'first')),
  result_count    INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_search_history_user FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_search_history_origin FOREIGN KEY (origin_iata)
    REFERENCES public.airports(iata) ON UPDATE CASCADE,
  CONSTRAINT fk_search_history_dest FOREIGN KEY (destination_iata)
    REFERENCES public.airports(iata) ON UPDATE CASCADE,
  CONSTRAINT search_different_airports CHECK (origin_iata != destination_iata)
);

CREATE INDEX IF NOT EXISTS idx_search_history_user    ON public.search_history(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_history_route   ON public.search_history(origin_iata, destination_iata);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON public.search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_date    ON public.search_history(travel_date);

-- ─── RLS: Airlines — Public Read ─────────────────────────────────────────────
ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "airlines_public_read" ON public.airlines;
CREATE POLICY "airlines_public_read" ON public.airlines
  FOR SELECT USING (true);

-- ─── RLS: Search History — Own Rows Only ─────────────────────────────────────
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_history_select_own" ON public.search_history;
DROP POLICY IF EXISTS "search_history_insert_own" ON public.search_history;
DROP POLICY IF EXISTS "search_history_delete_own" ON public.search_history;

CREATE POLICY "search_history_select_own" ON public.search_history
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "search_history_insert_own" ON public.search_history
  FOR INSERT WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "search_history_delete_own" ON public.search_history
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Grant Table Access ───────────────────────────────────────────────────────
GRANT SELECT ON public.airlines TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.search_history TO authenticated;
GRANT SELECT ON public.search_history TO anon;

-- ─── Realtime: REPLICA IDENTITY FULL ─────────────────────────────────────────
-- Required for Supabase Realtime to broadcast old + new row data on UPDATE/DELETE
ALTER TABLE public.seats          REPLICA IDENTITY FULL;
ALTER TABLE public.flights        REPLICA IDENTITY FULL;
ALTER TABLE public.bookings       REPLICA IDENTITY FULL;
ALTER TABLE public.notifications  REPLICA IDENTITY FULL;
ALTER TABLE public.tracking_logs  REPLICA IDENTITY FULL;

-- ─── Realtime: Enable publication on required tables ─────────────────────────
-- Supabase automatically creates supabase_realtime publication.
-- We add our tables to it for realtime subscriptions.
DO $$
BEGIN
  -- Add seats if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'seats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seats;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'flights'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.flights;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tracking_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_logs;
  END IF;
END $$;

-- ─── pg_cron: Auto-cleanup expired seat locks every 5 minutes ─────────────────
-- Note: pg_cron requires superuser to schedule. In Supabase, use the Dashboard
-- Extensions > pg_cron OR run this after enabling the extension.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-expired-seat-locks';
SELECT cron.schedule(
  'cleanup-expired-seat-locks',
  '*/5 * * * *',
  $$SELECT public.cleanup_expired_seat_locks()$$
);

-- ─── Airlines Seed Data (Major Indian Airlines) ───────────────────────────────
INSERT INTO public.airlines (iata, icao, name, country, is_active) VALUES
  ('AI', 'AIC', 'Air India',            'India', true),
  ('6E', 'IGO', 'IndiGo',               'India', true),
  ('SG', 'SEJ', 'SpiceJet',             'India', true),
  ('UK', 'VTI', 'Vistara',              'India', true),
  ('G8', 'GOW', 'Go First',             'India', false),
  ('I5', 'IAD', 'AirAsia India',        'India', true),
  ('QP', 'ABB', 'Akasa Air',            'India', true),
  ('IX', 'AXB', 'Air India Express',    'India', true),
  ('S5', 'SSW', 'Star Air',             'India', true),
  ('2T', 'TRU', 'TruJet',              'India', true)
ON CONFLICT (iata) DO NOTHING;
