import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Fallback to a placeholder so the module doesn't throw when env vars are missing.
// All Supabase calls will fail gracefully (caught in try/catch) and the app
// falls back to localStorage / demo mode.
//
// TYPED (generated types, src/types/database.ts — regenerate with `npm run db:types` after a migration): every table
// name, column filter, RPC name and returned row is checked against production's schema.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

/**
 * The SAME client, without the schema types — ONLY for code whose table name is a runtime string (the export
 * registry, generic paging / CRUD helpers, the restore writer): the compiler cannot know which table that is.
 * Everything with a literal table name uses `supabase`. test:db-types pins which files may import this.
 */
export const supabaseLoose: SupabaseClient = supabase as SupabaseClient;
