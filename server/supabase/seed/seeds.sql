-- Database Seeds
-- Filename: seeds.sql

-- 1. Insert Flights
insert into public.flights (id, flight_number, airline, origin, destination, departure_time, arrival_time, base_price, status, aircraft_type)
values
  -- Flight 1: New York to London (Tomorrow)
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'AA100', 'American Airlines', 'JFK', 'LHR', now() + interval '24 hours', now() + interval '31 hours', 450.00, 'scheduled', 'Boeing 777-300ER'),
  
  -- Flight 2: Paris to New York (Tomorrow)
  ('b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'AF006', 'Air France', 'CDG', 'JFK', now() + interval '30 hours', now() + interval '38 hours', 620.00, 'scheduled', 'Airbus A350-900'),

  -- Flight 3: San Francisco to Tokyo (In 3 Days)
  ('c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f', 'JL001', 'Japan Airlines', 'SFO', 'NRT', now() + interval '72 hours', now() + interval '83 hours', 980.00, 'scheduled', 'Boeing 787-9 Dreamliner'),

  -- Flight 4: New York to San Francisco (In 1 hour 30 mins - perfect for testing the 2h cancellation rule)
  ('d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a', 'UA2400', 'United Airlines', 'JFK', 'SFO', now() + interval '90 minutes', now() + interval '7 hours', 220.00, 'scheduled', 'Boeing 737 MAX 9'),

  -- Flight 5: New York to London (In 2 Days)
  ('e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b', 'AA102', 'American Airlines', 'JFK', 'LHR', now() + interval '48 hours', now() + interval '55 hours', 475.00, 'scheduled', 'Boeing 777-300ER'),

  -- Flight 6: Paris to New York (In 2 Days)
  ('f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c', 'AF008', 'Air France', 'CDG', 'JFK', now() + interval '54 hours', now() + interval '62 hours', 640.00, 'scheduled', 'Airbus A350-900'),

  -- Flight 7: San Francisco to Tokyo (In 4 Days)
  ('a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d', 'JL003', 'Japan Airlines', 'SFO', 'NRT', now() + interval '96 hours', now() + interval '107 hours', 995.00, 'scheduled', 'Boeing 787-9 Dreamliner'),

  -- Flight 8: New York to San Francisco (In 3 Days)
  ('b8c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e', 'UA2402', 'United Airlines', 'JFK', 'SFO', now() + interval '72 hours', now() + interval '78 hours', 240.00, 'scheduled', 'Boeing 737 MAX 9')
on conflict (flight_number) do update set
  departure_time = excluded.departure_time,
  arrival_time = excluded.arrival_time;

-- 2. Seed Seats dynamically for each flight
-- First Class: Rows 1-2, Seats A, F (1-2-1 layout, but just A & F for premium space)
-- Business Class: Rows 3-5, Seats A, C, D, F (2-2-2 or 2-2 layout)
-- Economy Class: Rows 6-20, Seats A, B, C, D, E, F (3-3 layout)

do $$
declare
    f_rec record;
    r int;
    col text;
    class_val text;
    mult numeric(4,2);
begin
    for f_rec in select id from public.flights loop
        -- Clear any existing seats for these flights first to avoid primary key/unique clashes on seed rerun
        delete from public.seats where flight_id = f_rec.id;

        -- Loop through Rows 1 to 20
        for r in 1..20 loop
            -- First Class: Rows 1-2
            if r <= 2 then
                class_val := 'first';
                mult := 3.00;
                for col in select unnest(array['A', 'F']) loop
                    insert into public.seats (flight_id, seat_code, class, price_multiplier, status)
                    values (f_rec.id, r::text || col, class_val, mult, 'available');
                end loop;

            -- Business Class: Rows 3-5
            elsif r <= 5 then
                class_val := 'business';
                mult := 1.80;
                for col in select unnest(array['A', 'C', 'D', 'F']) loop
                    insert into public.seats (flight_id, seat_code, class, price_multiplier, status)
                    values (f_rec.id, r::text || col, class_val, mult, 'available');
                end loop;

            -- Economy Class: Rows 6-20
            else
                class_val := 'economy';
                mult := 1.00;
                for col in select unnest(array['A', 'B', 'C', 'D', 'E', 'F']) loop
                    -- Let's pre-occupy some seats to make it realistic!
                    -- E.g. seat 7B, 12E, 15A etc. are occupied
                    insert into public.seats (flight_id, seat_code, class, price_multiplier, status)
                    values (
                        f_rec.id, 
                        r::text || col, 
                        class_val, 
                        mult, 
                        case 
                            when (r = 7 and col = 'B') or (r = 12 and col = 'E') or (r = 15 and col = 'A') or (r = 18 and col = 'F')
                            then 'occupied' 
                            else 'available' 
                        end
                    );
                end loop;
            end if;
        end loop;
    end loop;
end;
$$;
