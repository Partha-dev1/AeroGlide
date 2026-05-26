const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in server/.env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase DB successfully!');
    
    // Select count of profiles
    const profiles = await client.query(`SELECT COUNT(*) FROM public.profiles;`);
    console.log(`Profiles count: ${profiles.rows[0].count}`);

    // Select count of users
    const users = await client.query(`SELECT COUNT(*) FROM public.users;`);
    console.log(`Users count: ${users.rows[0].count}`);

    // Select profiles
    const profs = await client.query(`SELECT * FROM public.profiles LIMIT 5;`);
    console.log('\n--- SAMPLE PROFILES ---');
    console.log(profs.rows);

    // Select users
    const usrs = await client.query(`SELECT * FROM public.users LIMIT 5;`);
    console.log('\n--- SAMPLE USERS ---');
    console.log(usrs.rows);

  } catch (err) {
    console.error('❌ Database query failed:', err.message);
  } finally {
    await client.end();
  }
}

testConnection();
