import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in env'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type MedicineRecord = {
  id: string;
  name: string;
  color: string | null;
  notes: string | null;
  dose_interval_hours: number | null;
  archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DoseRecord = {
  id: string;
  medicine_id: string;
  taken_at: string;
  logged_by: string;
  note: string | null;
  created_at: string;
};
