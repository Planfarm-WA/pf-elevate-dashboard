// The typed Supabase client for the browser. It keeps the login session in localStorage, so people
// stay logged in between visits.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

export function createDb(url: string, publishableKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, publishableKey);
}
