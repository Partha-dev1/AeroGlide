-- ============================================================
-- AEROGLIDE — DATABASE SCHEMA FIXES & RPC ALIGNMENT
-- Migration: 20260523000000_schema_fixes.sql
-- ============================================================

-- 1. Alter airports table to support all required columns
ALTER TABLE public.airports ADD COLUMN IF NOT EXISTS icao VARCHAR(4);
ALTER TABLE public.airports ADD COLUMN IF NOT EXISTS airport_name TEXT;
ALTER TABLE public.airports ADD COLUMN IF NOT EXISTS airport_type TEXT;
ALTER TABLE public.airports ADD COLUMN IF NOT EXISTS elevation INTEGER DEFAULT 0;
ALTER TABLE public.airports ADD COLUMN IF NOT EXISTS flag VARCHAR(10) DEFAULT '';

-- 2. Drop existing functions to allow altering return types/parameters cleanly
DROP FUNCTION IF EXISTS public.get_nearby_airports(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.seed_airport_data(jsonb, jsonb, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.create_booking_transaction(UUID, UUID, TEXT, TEXT, NUMERIC, JSONB, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.reschedule_booking_transaction(UUID, UUID, UUID[], TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.reschedule_booking_transaction(UUID, UUID, UUID, JSONB, NUMERIC, NUMERIC, TEXT) CASCADE;

-- 3. Re-create get_nearby_airports with clean VARCHAR casts matching structure
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
    COALESCE(a.icao, a.iata)::VARCHAR as icao, 
    COALESCE(a.airport_name, a.name)::VARCHAR as name, 
    a.city::VARCHAR, 
    a.country::VARCHAR, 
    a.timezone::VARCHAR, 
    a.latitude::DOUBLE PRECISION, 
    a.longitude::DOUBLE PRECISION, 
    COALESCE(a.elevation, 0)::INTEGER as elevation, 
    COALESCE(a.flag, '')::VARCHAR as flag, 
    COALESCE(a.airport_type, CASE WHEN a.is_international THEN 'international'::VARCHAR ELSE 'domestic'::VARCHAR END)::VARCHAR as type,
    a.popularity::INTEGER, 
    ''::VARCHAR as image_url, 
    public.calculate_distance(p_lat, p_lon, a.latitude::DOUBLE PRECISION, a.longitude::DOUBLE PRECISION) AS distance
  FROM public.airports a
  ORDER BY distance ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Re-create seed_airport_data to support writing new columns
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
    INSERT INTO public.airports (
      iata, name, airport_name, icao, city, country, latitude, longitude, timezone, 
      is_international, airport_type, elevation, flag, popularity
    )
    VALUES (
      v_airport->>'iata',
      v_airport->>'name',
      COALESCE(v_airport->>'airport_name', v_airport->>'name'),
      v_airport->>'icao',
      v_airport->>'city',
      v_airport->>'country',
      (v_airport->>'latitude')::numeric,
      (v_airport->>'longitude')::numeric,
      v_airport->>'timezone',
      COALESCE((v_airport->>'is_international')::boolean, true),
      COALESCE(v_airport->>'airport_type', v_airport->>'type'),
      COALESCE((v_airport->>'elevation')::integer, 0),
      COALESCE(v_airport->>'flag', ''),
      (v_airport->>'popularity')::integer
    )
    ON CONFLICT (iata) DO UPDATE SET
      name = EXCLUDED.name,
      airport_name = EXCLUDED.airport_name,
      icao = EXCLUDED.icao,
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      timezone = EXCLUDED.timezone,
      is_international = EXCLUDED.is_international,
      airport_type = EXCLUDED.airport_type,
      elevation = EXCLUDED.elevation,
      flag = EXCLUDED.flag,
      popularity = EXCLUDED.popularity;
  END LOOP;

  -- Seed airlines
  FOR v_airline IN SELECT * FROM jsonb_array_elements(p_airlines) LOOP
    INSERT INTO public.airlines (iata, name, flag)
    VALUES (
      v_airline->>'iata',
      v_airline->>'name',
      COALESCE(v_airline->>'flag', '✈️')
    )
    ON CONFLICT (iata) DO UPDATE SET
      name = EXCLUDED.name,
      flag = EXCLUDED.flag;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-create create_booking_transaction returning JSON to match data.booking_id access
CREATE OR REPLACE FUNCTION public.create_booking_transaction(
  p_flight_id     UUID,
  p_user_id       UUID,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_total_price   NUMERIC,
  p_passengers    JSONB,
  p_lock_session  TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
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

  -- Create payment record
  INSERT INTO public.payments (booking_id, amount, currency, status)
  VALUES (v_booking_id, p_total_price, 'INR', 'completed');

  RETURN json_build_object(
    'booking_id', v_booking_id,
    'booking_reference', v_reference
  );
END;
$$;

-- 6. Re-create reschedule_booking_transaction matching the exact structure from flightService.ts
CREATE OR REPLACE FUNCTION public.reschedule_booking_transaction(
  p_booking_id      UUID,
  p_user_id         UUID,
  p_new_flight_id   UUID,
  p_passenger_seats JSONB,
  p_new_total_price NUMERIC,
  p_fee             NUMERIC,
  p_reason          TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_flight_id UUID;
  v_old_seat_ids  UUID[];
  v_new_seat_ids  UUID[];
  v_ps            RECORD;
BEGIN
  -- Ownership check
  SELECT flight_id INTO v_old_flight_id
  FROM public.bookings
  WHERE id = p_booking_id AND user_id = p_user_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Collect old seat IDs
  SELECT array_agg(seat_id) INTO v_old_seat_ids
  FROM public.passengers WHERE booking_id = p_booking_id;

  -- Collect new seat IDs from input JSONB
  SELECT array_agg((val->>'seat_id')::UUID) INTO v_new_seat_ids
  FROM jsonb_array_elements(p_passenger_seats) AS val;

  -- Free old seats
  UPDATE public.seats SET status = 'available', lock_session = NULL, updated_at = NOW()
  WHERE id = ANY(v_old_seat_ids);

  -- Book new seats
  UPDATE public.seats SET status = 'booked', lock_session = NULL, updated_at = NOW()
  WHERE id = ANY(v_new_seat_ids);

  -- Update passengers to new seats
  FOR v_ps IN SELECT (val->>'passenger_id')::UUID AS passenger_id, (val->>'seat_id')::UUID AS seat_id FROM jsonb_array_elements(p_passenger_seats) AS val LOOP
    UPDATE public.passengers
    SET seat_id = v_ps.seat_id
    WHERE id = v_ps.passenger_id AND booking_id = p_booking_id;
  END LOOP;

  -- Update booking
  UPDATE public.bookings
  SET flight_id = p_new_flight_id, 
      status = 'rescheduled',
      total_price = p_new_total_price, 
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- Record reschedule log
  INSERT INTO public.reschedules
    (booking_id, old_flight_id, new_flight_id, old_seat_ids, new_seat_ids, price_difference, status)
  VALUES
    (p_booking_id, v_old_flight_id, p_new_flight_id, v_old_seat_ids, v_new_seat_ids,
     p_fee, 'confirmed');

  RETURN TRUE;
END;
$$;

-- 7. Grant execution privileges to roles
GRANT EXECUTE ON FUNCTION public.get_nearby_airports TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking_transaction TO authenticated;
