import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load main .env configuration
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Load local overrides from .env.local if present
const localEnvPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath)) {
  console.log('📝 Loading local environment overrides from .env.local');
  const localEnvConfig = dotenv.parse(fs.readFileSync(localEnvPath));
  for (const k in localEnvConfig) {
    process.env[k] = localEnvConfig[k];
  }
}

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  AMADEUS_API_KEY: process.env.AMADEUS_API_KEY || '',
  AMADEUS_API_SECRET: process.env.AMADEUS_API_SECRET || '',
};

// Validate credentials and notify fallback status
if (!ENV.AMADEUS_API_KEY || !ENV.AMADEUS_API_SECRET) {
  console.warn('⚠️  [AeroGlide] AMADEUS_API_KEY or AMADEUS_API_SECRET is missing. Live Amadeus searches will fall back to local simulations.');
} else {
  console.log('✅ [AeroGlide] Amadeus credentials loaded.');
}
