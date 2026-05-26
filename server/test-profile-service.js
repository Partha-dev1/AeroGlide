const dotenv = require('dotenv');
dotenv.config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Credentials missing in .env');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  const userId = 'b8dc655d-e16c-41ee-a4d1-24064a070e2e'; // parthasarathi.work06@gmail.com
  
  try {
    console.log(`Checking profile table for user ${userId}...`);
    let { data: profile, error: pErr } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
    console.log('Profile from DB:', profile, 'Error:', pErr);

    if (!profile) {
      console.log('Profile missing. Fetching user from Auth...');
      const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
      if (userErr) {
        console.error('❌ getUserById failed:', userErr.message);
        return;
      }
      
      console.log('Auth user metadata:', userData.user.user_metadata);
      const fullName = userData?.user?.user_metadata?.full_name || userData?.user?.email?.split('@')[0] || 'Passenger';
      
      console.log(`Upserting profile for user ${userId} with full_name="${fullName}"...`);
      const { data: newProfile, error: insErr } = await admin
        .from('profiles')
        .upsert({ id: userId, full_name: fullName }, { onConflict: 'id' })
        .select('*')
        .single();
      
      if (insErr) {
        console.error('❌ Profile upsert failed:', insErr.message);
      } else {
        console.log('✅ Created profile successfully:', newProfile);
      }
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }
}

run();
