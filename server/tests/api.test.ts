import fetch from 'node-fetch';

async function check(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`❌ ${url} responded ${res.status}`);
      process.exit(1);
    }
    console.log(`✅ ${url} OK (${res.status})`);
  } catch (e) {
    console.error(`❌ ${url} error`, e);
    process.exit(1);
  }
}

async function run() {
  const base = 'http://localhost:5000';
  await check(`${base}/health`);
  await check(`${base}/api/flights`);
  await check(`${base}/api/airports/search?query=JFK`);
  // Check user bookings endpoint – expect 401 if unauthenticated
  await fetch(`${base}/api/bookings/user/123`).then(r => {
    if (r.status === 401) console.log('✅ /api/bookings/user 401 (expected)');
    else console.error('❌ /api/bookings/user unexpected status', r.status);
  });
}

run();
