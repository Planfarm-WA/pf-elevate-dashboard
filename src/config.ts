// Which mode the app runs in, from Vite's environment variables:
//   tests                                  → local (localStorage)
//   VITE_SUPABASE_URL + _PUBLISHABLE_KEY   → Supabase
//   `pnpm dev` without them                → local
//   a production build without them        → an error page, never a quiet fallback to localStorage

import type { AppMode } from './app.ts';
import { supabaseBackend } from './backend.ts';
import { createDb } from './supabase.ts';

export function appModeFromEnv(env: ImportMetaEnv = import.meta.env): AppMode {
  if (env.MODE === 'test') return { kind: 'local' };
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) return { kind: 'supabase', backend: supabaseBackend(createDb(url, key)) };
  return env.DEV ? { kind: 'local' } : { kind: 'missing-config' };
}
