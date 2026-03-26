import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Fallback to a placeholder so the module doesn't throw when env vars are missing.
// All Supabase calls will fail gracefully (caught in try/catch) and the app
// falls back to localStorage / demo mode.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
