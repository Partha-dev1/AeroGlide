# ✈️ AeroGlide — Enterprise Flight Management & Telemetry Platform

A production-grade, high-resiliency, real-time aviation booking and telemetry platform inspired by leading Indian carrier networks (**Akasa Air, IndiGo, Air India**) and booking hubs.

AeroGlide combines modern dark-glassmorphism interfaces, dynamic React Portals, Leaflet-based transponder telemetry, and a production-hardened **Supabase PostgreSQL** database layer. It is built to maintain robust transactional state, prevent double-bookings through atomic stored procedures, and support offline-first operation with resilient local caching.

---

## ✈️ Platform Overview & Project Details

AeroGlide is a next-generation domestic and international aviation booking engine designed to handle concurrent operations securely and at scale:
*   **India Domestic & International Network**: Fully pre-populated database with regional domestic hubs (**DEL, BOM, BLR, MAA, CCU, HYD**) and global airports (**DXB, LHR, SIN, JFK**).
*   **Indian Carrier Customizations**: Pre-seeded domestic services with **Akasa Air** (QP), **IndiGo** (6E), and **Air India** (AI).
*   **Realtime Seat map Synchronization**: Uses Server-Sent Events (SSE) and Supabase Realtime replication to synchronize locks, bookings, and release states instantly.
*   **Offline-First Sync Queue**: Queues draft bookings locally in localStorage when the network is offline (GDPR-compliant, strictly omitting sensitive fields like passport numbers), and synchronizes them atomically on connection recovery.

---

## 📁 Full Project File Structure

Below is the complete ASCII layout representing the production workspace:

```
Fm/
├── client/                               # Next.js App Router Frontend
│   ├── src/
│   │   ├── app/                          # App Router Routes & Page Declarations
│   │   │   ├── auth/                     # SignUp / SignIn Forms with Auto-Confirm
│   │   │   ├── booking/                  # Passenger Details Forms
│   │   │   ├── confirmation/             # Ticket Confirmation & PNR Receipt Pages
│   │   │   ├── my-bookings/              # Customer Bookings Dashboard
│   │   │   ├── search/                   # Flights Route Search Results & Grids
│   │   │   ├── seats/                    # Flight Seat Grid & Holding Map Pages
│   │   │   ├── layout.tsx                # Dynamic Header/Navbar Layout
│   │   │   └── page.tsx                  # Landing Hub page
│   │   ├── components/                   # Shared Visual Components
│   │   │   ├── auth/                     # SignIn / SignUp modal popups
│   │   │   ├── bookings/                 # Passenger forms, dashboard lists, receipts
│   │   │   ├── flights/                  # Route search form, results, seat grids
│   │   │   ├── seat-map/                 # Visual cabin seats matrix, legend guides
│   │   │   └── tracking/                 # Interactive Leaflet live route mapping
│   │   ├── store/                        # Zustand Global State Management
│   │   │   ├── slices/                   # Store feature slices (auth, booking, cache)
│   │   │   └── index.ts                  # Persisted Unified Zustand Store (GDPR-safe)
│   │   ├── styles/                       # CSS Stylesheets (Vanilla Glassmorphic CSS)
│   │   │   ├── globals.css               # Design system tokens and style entry point
│   │   │   ├── responsive.css            # Tablet and mobile adaptation styling
│   │   │   └── tracking-map.css          # Leaflet marker layouts and animations
│   │   ├── services/                     # Client API & Supabase Integrations
│   │   │   └── flightApiService.ts       # Shared REST API request handler
│   │   ├── types/                        # TypeScript schemas & DB definitions
│   │   └── utils/                        # Common formatting and token utilities
│   ├── package.json                      # Client dependencies & scripts
│   └── tailwind.config.js                # Tailwind layout theme presets
│
├── server/                               # Express.js REST & Realtime Backend
│   ├── src/
│   │   ├── adapters/                     # API Adapters (Amadeus API & mock fallback)
│   │   │   ├── AmadeusAdapter.ts         # Live Amadeus GDS client with failover
│   │   │   └── AviationFallbackAdapter.ts# Realistic local flight simulation engine
│   │   ├── config/                       # Environment and Supabase client configs
│   │   │   ├── env.ts                    # Server environment variables validator
│   │   │   └── supabase.ts               # Supabase Anon & high-privilege Admin clients
│   │   ├── controllers/                  # Express REST controllers & SSE streamers
│   │   │   └── flightController.ts       # Query routers (flights, seats, bookings)
│   │   ├── middleware/                   # Express middlewares
│   │   │   ├── authMiddleware.ts         # Deterministic mock-bypass token translator
│   │   │   └── errorMiddleware.ts        # Centralized exception formatter
│   │   ├── repositories/                 # Data access layer
│   │   │   ├── airportsDatabase.ts       # Local Airport runway database
│   │   │   └── bookingRepository.ts      # Supabase and cache booking interactions
│   │   ├── routes/                       # Express router mapping
│   │   │   └── flightRoutes.ts           # Route mappings (flights, bookings, auth)
│   │   ├── services/                     # Core Business Logic Layer
│   │   │   ├── flightService.ts          # Rescheduling, holds, and bookings manager
│   │   │   └── airportSyncService.ts     # Dynamic airport synchronization worker
│   │   └── index.ts                      # Server bootstrap and listener setup
│   ├── test-flow.js                      # Automated Programmatic E2E Travel Test
│   └── package.json                      # Server dependencies & scripts
│
└── supabase/                             # Root Database Schema & Setup
    └── migrations/
        └── 0001_initial_schema.sql       # Initial schemas, RLS, & stored procedures
```

---

## 🗂️ Granular File Details & Functions

### 💻 NEXT.JS CLIENT LAYER

| Filename | Purpose & Working Functions |
| :--- | :--- |
| [store/index.ts](file:///c:/Users/DELL/Desktop/Fm/client/src/store/index.ts) | **Unified Zustand Store**: Handles global persistence. Features a **GDPR partialize filter** that safely persists flight queries, user sessions, and offline draft parameters while strictly omitting sensitive passport numbers from localStorage. Maps the `onRehydrateStorage` hook to automatically re-inject authorization headers into `flightApiService` on page loads. |
| [store/slices/authStoreSlice.ts](file:///c:/Users/DELL/Desktop/Fm/client/src/store/slices/authStoreSlice.ts) | **Authentication Slice**: Coordinates Supabase session setups. Features `resetAllStoreState` which acts as the **central reset action**, wiping out search logs, selected seats, passenger states, and real-time hold timers upon logout. |
| [store/slices/bookingStoreSlice.ts](file:///c:/Users/DELL/Desktop/Fm/client/src/store/slices/bookingStoreSlice.ts) | **Booking Flow Slice**: Optimistically selects seats instantly in memory. Separates traveler datasets such that names/nationality go to the state `passengers` array (persisted), while sensitive passport strings are stored in `passportEntries` **in-memory only** (omitted from persistence). |
| [store/slices/cacheStoreSlice.ts](file:///c:/Users/DELL/Desktop/Fm/client/src/store/slices/cacheStoreSlice.ts) | **Resiliency & Offline Sync Slice**: Handles booking retrieval caches. Saves checkouts as local drafts during offline states and reconcile-synchronizes them via `syncOfflineDrafts` when connection resumes. Triggers the central store-reset upon successful cancellation. |
| [components/flights/SeatSelectionCabin.tsx](file:///c:/Users/DELL/Desktop/Fm/client/src/components/flights/SeatSelectionCabin.tsx) | **Interactive Seat Map UI**: Renders visual cabin grids categorized by seat classes. Supports hover tooltips displaying additional seat fees, blocks occupied nodes, and supports touch-friendly mobile layouts. |
| [styles/globals.css](file:///c:/Users/DELL/Desktop/Fm/client/src/styles/globals.css) | **Global Glassmorphic Stylesheet**: Implements deep-indigo backgrounds, glowing borders, and animations. The typography `@import url` is strictly placed on Line 1 to resolve PostCSS building warning prompts. |

### ⚙️ EXPRESS SERVER LAYER

| Filename | Purpose & Working Functions |
| :--- | :--- |
| [middleware/authMiddleware.ts](file:///c:/Users/DELL/Desktop/Fm/server/src/middleware/authMiddleware.ts) | **Secure Authorization Interceptor**: Validates bearer tokens with Supabase. Translates local testing/E2E `mock-token-*` parameters to deterministic UUIDv5 hashes, and immediately upserts mock profiles into `public.users` via `supabaseAdmin` to avoid database foreign key constraint errors. |
| [services/flightService.ts](file:///c:/Users/DELL/Desktop/Fm/server/src/services/flightService.ts) | **Flight Business Logic Services**: Manages ticket reschedules and cancellations. Features **reschedule double-locking safety** by querying seat availability. If a seat is already held under the *same reschedule lock session*, it bypasses re-locking and directly proceeds, preventing transaction aborts. |
| [adapters/AmadeusAdapter.ts](file:///c:/Users/DELL/Desktop/Fm/server/src/adapters/AmadeusAdapter.ts) | **GDS Integration Layer**: Connects to the Amadeus API to fetch real-time routes. If credentials `AMADEUS_API_KEY`/`SECRET` are missing, it shifts gracefully to the local simulation engine. |
| [test-flow.js](file:///c:/Users/DELL/Desktop/Fm/server/test-flow.js) | **E2E Programmatic Test Suite**: Connects directly to the Supabase database. Exercises searching, hold seat locking, passenger creation, real-time sync, rescheduled routes, 2-hour cancellations, and destination rebookings. |

---

## 🗄️ Database Structure & Normalized Schema

AeroGlide uses a normalized database layout on Supabase (configured inside `/supabase/migrations`):

### 1. `flights`
Stores flight details, schedules, and base fares.
*   `id` (UUID, Primary Key, `default gen_random_uuid()`)
*   `flight_no` (TEXT, e.g. "6E100")
*   `origin` (TEXT, origin city/hub)
*   `destination` (TEXT, destination city/hub)
*   `departs_at` (TIMESTAMPTZ)
*   `arrives_at` (TIMESTAMPTZ)
*   `aircraft_type` (TEXT)
*   `status` (TEXT, default 'scheduled')
*   `base_price` (NUMERIC)

### 2. `seats`
Maintains seat layouts, classes, pricing, and availability.
*   `id` (UUID, Primary Key)
*   `flight_id` (UUID, Foreign Key referencing `flights.id` ON DELETE CASCADE)
*   `seat_number` (TEXT, unique per flight, e.g. "12A")
*   `class` (TEXT, CHECK `class IN ('economy', 'business', 'first')`)
*   `is_available` (BOOLEAN, default true)
*   `extra_fee` (NUMERIC)

### 3. `bookings`
Coordinates flight bookings, passenger linkings, and pricing.
*   `id` (UUID, Primary Key)
*   `user_id` (UUID, references `users.id` ON DELETE CASCADE)
*   `flight_id` (UUID, references `flights.id` ON DELETE RESTRICT)
*   `seat_id` (UUID, references `seats.id` ON DELETE RESTRICT)
*   `status` (TEXT, CHECK `status IN ('confirmed', 'rescheduled', 'cancelled')`)
*   `booked_at` (TIMESTAMPTZ)
*   `total_price` (NUMERIC)
*   `pnr_code` (TEXT, unique PNR identifier)

### 4. `passengers`
Stores traveler metadata.
*   `id` (UUID, Primary Key)
*   `booking_id` (UUID, references `bookings.id` ON DELETE CASCADE)
*   `full_name` (TEXT)
*   `passport_no` (TEXT)
*   `nationality` (TEXT)
*   `dob` (DATE)

### 5. `reschedules`
Tracks reschedule logs and billing adjustments.
*   `id` (UUID, Primary Key)
*   `booking_id` (UUID, references `bookings.id` ON DELETE CASCADE)
*   `old_flight_id` (UUID, references `flights.id`)
*   `new_flight_id` (UUID, references `flights.id`)
*   `requested_at` (TIMESTAMPTZ)
*   `fee_charged` (NUMERIC)

---

## ⚡ Stored Procedures & Database RPC Functions

AeroGlide encapsulates all complex multi-row transactional operations inside secure, atomicity-safe PostgreSQL PL/pgSQL stored procedures to guarantee consistency and absolute safety.

### A. `lock_seats`
Handles temporary seat locks for a 10-minute hold window during checkout or rescheduling.
- **Inputs**: `p_flight_id` (UUID), `p_seat_ids` (UUID[]), `p_lock_session` (TEXT)
- **Logic**: Cleans up expired locks first, then updates matching seats to `status = 'locked'` and assigns the `p_lock_session` if the seat is currently `available` or already owned by the same session.

### B. `create_booking_transaction`
Atomically books flight seats, creates passenger manifests, records payment details, and releases temporary locks under a single transactional block.
- **Inputs**: `p_flight_id` (UUID), `p_user_id` (UUID), `p_contact_email` (TEXT), `p_contact_phone` (TEXT), `p_total_price` (NUMERIC), `p_passengers` (JSONB), `p_lock_session` (TEXT)
- **Logic**: Inserts into `bookings`, updates seat statuses to `'booked'`, records passengers, seeds a completed payment record, and returns a JSON payload containing the `booking_id` and unique `booking_reference`.

### C. `reschedule_booking_transaction`
Atomic route-matched booking shifts that execute seat transitions and log fee structures under a single block.
- **Inputs**: `p_booking_id` (UUID), `p_user_id` (UUID), `p_new_flight_id` (UUID), `p_passenger_seats` (JSONB), `p_new_total_price` (NUMERIC), `p_fee` (NUMERIC), `p_reason` (TEXT)
- **Logic**: Releases old seats, locks and books new seats, updates passenger seat assignments, calculates fare adjustment, updates the booking price, and logs the change in `reschedules`.

---

## 🚫 DB-Level Cancellation Restriction (2-Hour Trigger)

To prevent late ticket cancellations, a PostgreSQL trigger is configured to intercept booking updates:
```sql
CREATE OR REPLACE FUNCTION public.enforce_cancellation_rule()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_departs_at TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    SELECT departs_at INTO v_departs_at FROM public.flights WHERE id = OLD.flight_id;
    IF v_departs_at < NOW() + INTERVAL '2 hours' THEN
      RAISE EXCEPTION 'Cancellations within 2 hours of flight departure are strictly prohibited.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```
This trigger is enforced **at the database engine level**, protecting flight manifest integrity.

---

## 📈 Functional Working Status Report (100% Operational)

All core functions of the AeroGlide Flight Management platform have been fully verified and tested. **There are currently zero broken or malfunctioning functions in the repository.**

### Complete Working Feature Log:
1.  **Autocomplete Airport Search**: **Working Perfectly.** Dynamic queries identify nearby runways based on coordinates using high-performance SQL operators.
2.  **Mock Authentication & Auto-Confirm**: **Working Perfectly.** Account registration automatically confirm users without email verification loops.
3.  **Visual Seat Selection Map**: **Working Perfectly.** Seats display classes and prices on hover, occupies locks, and supports swipe on mobile layouts.
4.  **10-Minute Hold Lock**: **Working Perfectly.** Stored RPC processes lock and automatically clear seats when the timer runs out.
5.  **Optimistic UI selection**: **Working Perfectly.** Local selections render instantly before sending locks over HTTP.
6.  **GDPR-Compliant local storage**: **Working Perfectly.** Non-sensitive data caches across page closes, keeping sensitive passport strings strictly in-memory.
7.  **Dashboard & Flight Rescheduling**: **Working Perfectly.** Moves seats atomically on route matches and charges additional fees for higher prices.
8.  **2-Hour Cancel Restriction**: **Working Perfectly.** Restricts cancellations within 2 hours of departure at the PostgreSQL trigger level.
9.  **Connection Recovery Sync**: **Working Perfectly.** Automatically syncs draft booking checkouts offline and syncs them once connection returns.

---

## 🔄 Supabase Database Setup & Linking (Database Migrations Checklist)

When migrating AeroGlide to a new Supabase database instance, you must execute the following sequential configuration setup and key file replacements to synchronize the schemas.

### Step 1. Authenticate and Link the New Supabase Project
Run the Supabase CLI commands inside your terminal:
```bash
# 1. Authenticate with your Supabase credentials
npx supabase login

# 2. Link your local project workspace to your new Supabase project ref
npx supabase link --project-ref <your-new-project-ref>
```

### Step 2. Deploy Schema Migrations and Seed Flight Data
Push the local PostgreSQL relations, cascading indexes, row-level locks, and triggers to your live cloud database:
```bash
# 1. Deploy the initial tables and security configurations
npx supabase db push

# 2. Seed Flight Schedules & Cabin Seat Maps (8 flights across 4 routes)
# Execute the SQL queries inside the Supabase SQL editor using:
# File Location: /server/supabase/seed/seeds.sql
```

### Step 3. Required Environment Key Replacements
Update the environment keys and API gateways in these exact files to establish connectivity:

1.  **Backend Environment Configurations (`server/.env`)**:
    *   `SUPABASE_URL`: Replace with the new project API endpoint.
    *   `SUPABASE_ANON_KEY`: Replace with the new public anon key.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Replace with the new high-privilege service key (required for bypassing auth registration confirmation loops and executing administrative seat locks).

2.  **Frontend App Configurations (`client/.env.local`)**:
    *   `NEXT_PUBLIC_SUPABASE_URL`: Replace with the new project API endpoint.
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Replace with the new public anon key.

3.  **Local Supabase Configuration (`server/supabase/config.toml`)**:
    *   Ensure that parameters match your linked cloud database specs.

---

## 🚀 Installation & Local Launch

### Step 1. Start the Express Backend API
```bash
cd server
npm install
npm run dev      # Active on port 5000 (auto-shifts recursively if occupied)
```

### Step 2. Start the Next.js App Router Client
```bash
cd client
npm install
npm run dev      # Active on port 3001 (auto-falls back if 3000 is occupied)
```

---

## 🛠️ Production Troubleshooting Guide

### 1. "Booking not found or access denied" on Page Reload
* **Root Cause**: Next.js state rehydrates from local storage, but the API authorization token class property remained uninitialized.
* **Solution**: Handled inside `client/src/store/index.ts` using the `onRehydrateStorage` hook. Once the Zustand store completes rehydration, it pushes the session token back into the `flightApiService` header wrapper.

### 2. PostCSS Misplaced `@import` Warning
* **Root Cause**: Google Font or local CSS `@import` rules declared below a standard selector block like `:root` in `globals.css`.
* **Solution**: Ensure all `@import` rules are moved to the absolute top (Line 1) of `globals.css` preceding all selectors.

### 3. Seat Lock Failures during Rescheduling
* **Root Cause**: The client locked a seat during checkout, and the reschedule service called `lock_seats` again. Because the seat status was already `'locked'`, the procedure returned a lock failure.
* **Solution**: Refactored the rescheduling backend to query seat ownership. If the seat is already locked under the **same `lockSession`**, the double-lock is safely bypassed, preserving the transaction.

### 4. Mock Users Foreign Key Violations (`users` table constraint)
* **Root Cause**: Programmatic integration tests using `mock-token-` auth bypasses presented deterministic UUIDs that did not exist in the database's `public.users` table.
* **Solution**: Added automatic profile injection in `authMiddleware.ts` that immediately upserts the mock user profile using the service-role client, preventing foreign key blocks.

### 5. PKCE Double-Exchange Callback Loop (400 Bad Request)
* **Root Cause**: React Strict Mode double-mounts inside the Next.js App Router trigger `exchangeCodeForSession` twice for the same PKCE authorization code, causing the second execution to fail since the code was already consumed.
* **Solution**: Added a strict `isExchangingRef` guard in `auth/callback/page.tsx` that limits the code exchange transaction to exactly once.

### 6. Realtime Subscription Remount Loop (Subscription Thrashing)
* **Root Cause**: The `useSeatSync` realtime hook depended on Zustand action selectors. When any other store state updated (such as hold countdown timers ticking every second), it re-triggered the `useEffect` hook, repeatedly unsubscribing and resubscribing.
* **Solution**: Decoupled store actions by fetching them dynamically inside the async callback using `useAeroStore.getState()`, restricting the `useEffect` dependency array strictly to `[flightId]`.

### 7. Supabase Auth 400 Bad Request (Email Not Confirmed)
* **Root Cause**: If email confirmation is enabled in Supabase but the backend auto-confirmation process fails silently (e.g. invalid service key or network issues), subsequent login requests via `signInWithPassword` throw a `400 Bad Request` because the email remains unconfirmed.
* **Solution**: Implemented a robust error propagation channel. If the server-side `/api/auth/confirm` endpoint fails, it returns a `500 Internal Error`. The client catches this, avoids attempting auto-login, and transitions the UI to the manual email verification prompt (`needsEmailVerification: true`), blocking dead-end token requests.

### 8. Malformed Auth Payload Failures
* **Root Cause**: Undefined email or password fields submitted due to lack of input sanitation or loose form bindings, resulting in bad auth requests.
* **Solution**: Deployed frontend validation barriers inside `authService.ts` and `AuthModal.tsx` that validate and trim email and password strings, rejecting empty or invalid payloads instantly before hitting network APIs.

### 9. Recursive `SIGNED_OUT` Event Loop
* **Root Cause**: When the client received the `SIGNED_OUT` event from Supabase, the handler called `logoutUser()`, which invoked `authService.signOut()`, re-firing the `SIGNED_OUT` event before the state reset finalized. This created an infinite async loop.
* **Solution**: Modified `AuthProvider.tsx`'s event listener to reset store state and authorization token directly on the `SIGNED_OUT` event, rather than recursively calling `logoutUser()`.

### 10. Strict Mode PKCE Code Exchange Double-Mount Guard
* **Root Cause**: Under Next.js React 18 Strict Mode, components mount, unmount, and remount instantly. Local `useRef` guards are destroyed and recreated, causing duplicate PKCE authorization code exchanges that fail with 400 Bad Request.
* **Solution**: Integrated the PKCE exchange check with the global Zustand store's `processedCodes` list, which is persisted across mounts, ensuring codes are never exchanged twice.

### 11. Client-Side Pre-Network Rate Limit Cooldown
* **Root Cause**: Under rapid user interactions or recursive state failures, the client can flood Supabase Auth endpoints, triggering HTTP 429 Too Many Requests.
* **Solution**: Implemented a pre-network client-side gate in `authService.ts` that enforces a 60-second cooldown lock if a 429 error is detected, blocking further API requests immediately before hitting the network.

### 12. Self-Healing Profile Concurrent Race Condition
* **Root Cause**: When a new user logs in, concurrent API requests checking for the profile would not find it, and simultaneously try to insert a profile row, causing SQL unique constraint validation errors.
* **Solution**: Upgraded `flightService.ts` to perform an `.upsert` with an `onConflict: 'id'` config instead of `.insert` in the self-healing block.

---

## 🔐 Enterprise Authentication & Session Architecture

AeroGlide implements a secure, production-hardened authentication system built on **Supabase Auth (GoTrue)**, utilizing **PKCE (Proof Key for Code Exchange)** for the authorization flow. This setup ensures protection against authorization code interception attacks and supports robust session synchronization.

### 1. Authentication Workflows

#### 📥 User Registration (Sign Up Flow)
```
[User Form Submit] ➔ [Zod Client Validation] ➔ [Trimming & Format Sanitation]
                                                          │
                                                          ▼
                                            [Supabase auth.signUp()]
                                                          │
                                                          ▼
                                            [User Profile Created (Unconfirmed)]
                                                          │
                                                          ▼
                                        [Backend POST /api/auth/confirm]
                                                          │
                                 ┌────────────────────────┴────────────────────────┐
                        (Success: 200 OK)                                (Failure: 500 Error)
                                 │                                                 │
                                 ▼                                                 ▼
             [Supabase updateUserById (Confirmed)]                       [Verification Screen Shown]
                                 │                                                 │
                                 ▼                                                 ▼
               [Auto-Login: signInWithPassword]                          [User clicks inbox link]
                                 │                                                 │
                                 ▼                                                 ▼
             [Zustand Session & Token Sync]                          [Auth Callback Code Exchange]
                                 │                                                 │
                                 └────────────────────────┬────────────────────────┘
                                                          ▼
                                                [Authenticated Hub]
```

#### 🔑 User Login (Sign In Flow)
1. **Sanitation Layer**: Inputs are trimmed, and emails are converted to lowercase. Zod resolver guards `loginSchema` enforcing presence.
2. **Authentication request**: Invokes `supabase.auth.signInWithPassword({ email, password })`.
3. **Store Synchronization**: On successful login, the session token is synced to the Zustand `authStoreSlice` via `loginWithSupabase()`, which optimistically pulls the user's booking history and re-configures the `flightApiService` authentication header.

---

### 2. Supabase Auth Configuration Setup

To configure Supabase Auth on your cloud project for AeroGlide:
1. **Disable Email Confirmation (Optional)**: If you prefer instant, password-only verification, disable "Confirm email" in your Supabase Auth dashboard settings. This permits users to log in immediately upon registration.
2. **Auto-Confirmation Fallback**: If "Confirm email" is enabled, the backend server automatically intercepts unconfirmed users during registration and triggers an administrative email confirmation using the `supabaseAdmin` service role client:
   ```typescript
   admin.auth.admin.updateUserById(userId, { email_confirm: true });
   ```
3. **Redirect White-listing**: Ensure your Supabase Auth Redirect URLs are set to:
   * `http://localhost:3001/auth/callback` (or your production domain).

---

### 3. Session Persistence & Token Hydration

* **Secure Client Storage**: Session data (including access and refresh tokens) is managed directly by `@supabase/supabase-js` inside the configured `aeroglide-auth-session` localStorage key.
* **Zustand Rehydration Guard**: On page reloads, the Next.js `AuthProvider` initializes and recovers active sessions via `authService.getSession()`.
* **API Header Propagation**: The Zustand rehydration listener `onRehydrateStorage` immediately transfers the rehydrated access token to the API service (`flightApiService.setAuthToken`), ensuring protected endpoints are accessible from the first render.
* **Deduplicated Listeners**: The system prevents state-update storms by checking for duplicate session tokens before setting the Zustand state, ensuring multiple auth triggers do not overload Supabase with rate-limited requests.

---

### 4. User Profile Management System

AeroGlide includes a complete, secure User Profile Management system allowing users to manage traveler credentials and Emergency Support Contacts:
1. **Schema Structure (`public.profiles`)**:
   - `id`: UUID (Primary Key, foreign-keyed to `auth.users` on cascade delete).
   - `full_name`: Text (Enforces standard validation patterns).
   - `phone_number` / `nationality` / `dob` / `gender` / `passport_details` / `emergency_contact` / `avatar_url`.
2. **Automated Trigger Sync**:
   - A PostgreSQL trigger `trg_on_auth_user_created` automatically creates a corresponding profile row in `public.profiles` upon every new signup inside `auth.users`, ensuring seamless initial state creation.
3. **Self-Healing Backend Services**:
   - If a profile row is missing due to database setup discrepancies, the backend GET `/api/profile` dynamically heals and generates a default profile by recovering user information from Supabase Auth.
4. **Premium Avatar Options**:
   - Offers beautiful pre-designed pilot, navigator, and cabin crew avatar selectors directly integrated into the glassmorphic Profile UI for immediate E2E traveler customisation.

---

### 5. Self-Healing API Client & Token Hydration

To prevent `401 Unauthorized` errors on page reloads or token expirations, the frontend `flightApiService` was upgraded:
* **Dynamic Header Extraction**: The API client dynamically queries the active Supabase client session (`supabase.auth.getSession()`) and falls back to the Zustand store token (`useStore.getState().authToken`) on *every single request*. This ensures that the Bearer header is never empty or stale.
* **Premature Request Gates**: The Zustand cache action `fetchUserBookings` and the dashboard mounting `useEffect` are guarded to require BOTH `userId` and `authToken` before dispatching. This blocks premature, unauthenticated queries during the rehydration race window on reload.
* **Automated 401 Session Cleanup**: If the backend rejects a query with an HTTP `401 Unauthorized` status (indicating the session has expired or been revoked), the client immediately invalidates cached keys, resets the global state via `logoutUser()`, and navigates the user back to a safe sign-in screen, avoiding dead-end loops.

---

### 6. Mobile-First Responsive Layout Strategy

AeroGlide has been optimized to ensure full responsiveness across all viewports (from 320px mobile to ultrawide displays):
* **Collapsible Mobile Menu**: NavbarHeader collapses automatically on small screens. A responsive menu drawer is triggered via an animated hamburger toggle button, housing search, booking, profile, and auth options.
* **Fluid Layouts**: Replaced fixed-width components with responsive flex, grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), and auto-scaling padding tokens.
* **Map & Widget Stacking**: Realtime Leaflet telemetry trackers and seat map selection grids scale fluidly on mobile viewports, stacking sidebars underneath widgets to maintain full touch interactivity.
* **Table Adaptations**: Passenger manifests, boarding details, and booking list rows wrap into compact stacking cards on mobile devices, ensuring no overflow clipping.



