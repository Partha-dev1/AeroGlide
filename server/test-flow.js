/**
 * AeroGlide Programmatic E2E Flow Integration Test
 * Location: /server/test-flow.js
 */

const { v5: uuidv5 } = require('uuid');

const API_BASE = 'http://localhost:5000/api';
const AUTH_TOKEN = 'mock-token-senior-qa-engineer';
const DETERMINISTIC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const USER_ID = uuidv5(AUTH_TOKEN, DETERMINISTIC_NAMESPACE); // Match server's deterministic UUID mapper
const LOCK_SESSION = 'integration-test-session-' + Date.now();

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`
};

console.log(`🔑 Authenticating as Mock Token: ${AUTH_TOKEN}`);
console.log(`🆔 Mapped Deterministic User UUID: ${USER_ID}`);

async function logStep(title, fn) {
  console.log(`\n====================================================`);
  console.log(`🚀 STEP: ${title}`);
  console.log(`====================================================`);
  try {
    const result = await fn();
    console.log(`✅ SUCCESS!`);
    if (result) console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error(`❌ FAILED!`, err.message);
    throw err;
  }
}

async function runTest() {
  console.log("✈️ Starting AeroGlide Automated Integration Test...");

  // ─── PRE-TEST: Reset in-memory state for a clean run ───
  await logStep('Reset In-Memory State (Clean Slate)', async () => {
    const res = await fetch(`${API_BASE}/test/reset`, { method: 'POST', headers });
    if (!res.ok) {
      console.warn('⚠️ Reset endpoint not available — proceeding anyway.');
      return null;
    }
    return await res.json();
  });

  // ─── STEP 1: Search domestic flights DEL -> BOM ───
  const flights = await logStep('Search Flights (DEL ➔ BOM)', async () => {
    const res = await fetch(`${API_BASE}/flights?origin=DEL&destination=BOM&date=2026-05-30`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (data.length === 0) throw new Error("No flights found on this route.");
    return data.slice(0, 2); // Get two flights to test rescheduling
  });

  const flightA = flights[0];
  const flightB = flights[1];
  console.log(`Selected primary flight: ${flightA.flight_number} (ID: ${flightA.id})`);
  console.log(`Selected reschedule candidate: ${flightB.flight_number} (ID: ${flightB.id})`);

  // ─── STEP 2: Fetch seat grid for flight A ───
  const seats = await logStep(`Get Cabin Seats for ${flightA.flight_number}`, async () => {
    const res = await fetch(`${API_BASE}/flights/${flightA.id}/seats`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const available = data.filter(s => s.status === 'available');
    if (available.length === 0) throw new Error("No available seats found.");
    return available.slice(0, 1);
  });

  const seatA = seats[0];
  console.log(`Selected seat: ${seatA.seat_code} (ID: ${seatA.id})`);

  // ─── STEP 3: Lock seat A ───
  await logStep(`Lock Seat ${seatA.seat_code}`, async () => {
    const res = await fetch(`${API_BASE}/bookings/lock-seats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        flight_id: flightA.id,
        seat_ids: [seatA.id],
        lock_session: LOCK_SESSION
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  });

  // ─── STEP 4: Create booking on flight A ───
  const booking = await logStep('Create Ticket Booking', async () => {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        flight_id: flightA.id,
        user_id: USER_ID,
        contact_email: 'passenger.qa@domain.in',
        contact_phone: '+919988776655',
        total_price: flightA.base_price * seatA.price_multiplier,
        passengers: [
          {
            seat_id: seatA.id,
            first_name: 'Antigravity',
            last_name: 'Engineer',
            passport_number: 'A12345678',
            date_of_birth: '1990-01-01',
            nationality: 'Indian'
          }
        ],
        lock_session: LOCK_SESSION
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  });

  // ─── STEP 5: Verify user bookings list ───
  await logStep('Verify Bookings in User Dashboard', async () => {
    const res = await fetch(`${API_BASE}/bookings/user/${USER_ID}`, { headers });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const found = data.find(b => b.id === booking.booking_id);
    if (!found) throw new Error("Created booking not found in user manifest.");
    return found;
  });

  // ─── STEP 6: Reschedule booking to flight B ───
  // Lock seat on flight B first
  const seatsB = await fetch(`${API_BASE}/flights/${flightB.id}/seats`);
  const seatsBData = await seatsB.json();
  const seatB = seatsBData.find(s => s.status === 'available');
  if (!seatB) throw new Error("No available seats found on flight B.");

  console.log(`Locking new seat ${seatB.seat_code} on flight B`);
  const lockBRes = await fetch(`${API_BASE}/bookings/lock-seats`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      flight_id: flightB.id,
      seat_ids: [seatB.id],
      lock_session: LOCK_SESSION
    })
  });
  if (!lockBRes.ok) throw new Error("Failed locking seat on flight B: " + await lockBRes.text());

  await logStep('Reschedule Booking to Flight B', async () => {
    const res = await fetch(`${API_BASE}/bookings/reschedule`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        booking_id: booking.booking_id,
        new_flight_id: flightB.id,
        new_seat_ids: [seatB.id],
        lock_session: LOCK_SESSION
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  });

  // ─── STEP 7: Cancel booking ───
  await logStep('Cancel Ticket Booking', async () => {
    const res = await fetch(`${API_BASE}/bookings/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        booking_id: booking.booking_id
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  });

  // ─── STEP 8: Route Change & Rebooking (DEL -> CCU) ───
  console.log("\n🔄 Performing destination shift to Chennai/Kolkata route...");
  
  const flightsCCU = await logStep('Search Flights (DEL ➔ CCU)', async () => {
    const res = await fetch(`${API_BASE}/flights?origin=DEL&destination=CCU&date=2026-05-30`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (data.length === 0) throw new Error("No flights found on DEL-CCU route.");
    return data;
  });

  const flightCCU = flightsCCU[0];
  console.log(`Selected Kolkata flight: ${flightCCU.flight_number} (ID: ${flightCCU.id})`);

  const seatsCCURes = await fetch(`${API_BASE}/flights/${flightCCU.id}/seats`);
  const seatsCCUData = await seatsCCURes.json();
  const seatCCU = seatsCCUData.find(s => s.status === 'available');
  if (!seatCCU) throw new Error("No seats available on Kolkata flight.");

  console.log(`Locking seat ${seatCCU.seat_code} on Kolkata flight`);
  await fetch(`${API_BASE}/bookings/lock-seats`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      flight_id: flightCCU.id,
      seat_ids: [seatCCU.id],
      lock_session: LOCK_SESSION
    })
  });

  const bookingCCU = await logStep('Book Ticket to Kolkata', async () => {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        flight_id: flightCCU.id,
        user_id: USER_ID,
        contact_email: 'passenger.qa@domain.in',
        contact_phone: '+919988776655',
        total_price: flightCCU.base_price * seatCCU.price_multiplier,
        passengers: [
          {
            seat_id: seatCCU.id,
            first_name: 'Akasa',
            last_name: 'Flyer',
            passport_number: 'B98765432',
            date_of_birth: '1985-05-05',
            nationality: 'Indian'
          }
        ],
        lock_session: LOCK_SESSION
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  });

  console.log(`\n====================================================`);
  console.log(`🎉 INTEGRATION TEST FULLY COMPLETED WITH SUCCESS! 🎉`);
  console.log(`====================================================`);
}

runTest().catch(err => {
  console.error("❌ Integration test aborted due to error:", err.message);
  process.exit(1);
});
