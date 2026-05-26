import fetch from 'node-fetch';

async function checkHealth() {
  const res = await fetch('http://localhost:5000/health');
  const json = await res.json();
  console.log('Health:', json);
}

async function checkFlights() {
  const res = await fetch('http://localhost:5000/api/flights?origin=JFK&destination=LHR&date=2024-12-01');
  const json = await res.json();
  console.log('Flights search result count:', json?.length || 0);
}

async function run() {
  try {
    await checkHealth();
    await checkFlights();
    console.log('API verification completed successfully');
  } catch (e) {
    console.error('API verification failed:', e);
    process.exit(1);
  }
}

run();
