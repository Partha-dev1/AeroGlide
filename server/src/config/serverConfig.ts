import express from 'express';
import cors from 'cors';
import { supabase as sbClient, isSupabaseConfigured } from './supabase';
import { ENV } from './env';

export const PORT = ENV.PORT;
export const SUPABASE_URL = ENV.SUPABASE_URL;
export const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY;

export const supabase = sbClient;
export const useSupabase = isSupabaseConfigured;

const app = express();
app.use(cors());
app.use(express.json());

export { app };
