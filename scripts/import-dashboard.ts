// Command line: load a dashboard JSON export into one business in Supabase.
//
//   pnpm import-dashboard "<business name or id>" <export-file.json>
//
// Signs in as your staff user, so the database's access rules apply exactly as in the app.
// Needs these environment variables (see README, "Importing a client's export file"):
//   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, PF_STAFF_EMAIL, PF_STAFF_PASSWORD

import { readFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ExportFileError, parseExportFile } from '../src/adapters.ts';
import type { Database } from '../src/database.types.ts';
import { ImportError, importDashboard, type ImportSummary } from '../src/importer.ts';

const USAGE = 'Usage: pnpm import-dashboard "<business name or id>" <export-file.json>';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A problem with how the script was run (arguments, environment, sign-in, business). */
class UsageError extends Error {}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new UsageError(`Set the ${name} environment variable (see README, "Importing a client's export file").`);
  return value;
}

async function readExport(path: string): Promise<unknown> {
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch (err) {
    throw new UsageError(`Could not read ${path}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new ExportFileError(`${path} isn't valid JSON: ${(err as Error).message}`);
  }
}

/** Find the business by id, or by exact name (which must match exactly one). */
async function findBusiness(sb: SupabaseClient<Database>, nameOrId: string): Promise<{ id: string; name: string }> {
  const query = sb.from('businesses').select('id, name');
  const { data, error } = UUID.test(nameOrId) ? await query.eq('id', nameOrId) : await query.eq('name', nameOrId);
  if (error) throw new UsageError(`Could not look up the business: ${error.message}`);
  if (!data.length) throw new UsageError(`No business "${nameOrId}" (or your login can't access it).`);
  if (data.length > 1) {
    throw new UsageError(`${data.length} businesses are called "${nameOrId}"; pass the id instead:\n${data.map((b) => `  ${b.id}`).join('\n')}`);
  }
  return data[0];
}

function printSummary(s: ImportSummary): void {
  const kept = (n: number | null) => (n === null ? 'kept (not in the file)' : String(n));
  const lines: Array<[string, string]> = [
    ['Core values', String(s.coreValues)],
    ['3-year items', String(s.threeYearItems)],
    ['1-year targets', String(s.oneYearTargets)],
    ['Issues & opportunities', String(s.issues)],
    ['120-day periods', kept(s.periods)],
    ['120-day priorities', kept(s.priorities)],
    ['30-day rounds', kept(s.rounds)],
    ['30-day tasks', kept(s.tasks)],
    ['Queued priorities', String(s.pendingPriorities)],
    ['Queued tasks', String(s.pendingTasks)],
    ['Coaching sessions', kept(s.sessions)],
  ];
  for (const [label, value] of lines) console.log(`  ${label.padEnd(24)}${value}`);
}

async function main(): Promise<void> {
  const [nameOrId, path, ...extra] = process.argv.slice(2);
  if (!nameOrId || !path || extra.length) throw new UsageError(USAGE);

  // Check the file first, so a bad file stops the import before anything is written.
  const file = parseExportFile(await readExport(path));

  const sb = createClient<Database>(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = env('PF_STAFF_EMAIL');
  const signIn = await sb.auth.signInWithPassword({ email, password: env('PF_STAFF_PASSWORD') });
  if (signIn.error) throw new UsageError(`Could not sign in as ${email}: ${signIn.error.message}`);

  try {
    const business = await findBusiness(sb, nameOrId);
    console.log(`Importing ${path} into "${business.name}" (${business.id})…`);
    printSummary(await importDashboard(sb, business.id, file));
    console.log('Done.');
  } finally {
    await sb.auth.signOut();
  }
}

main().catch((err: unknown) => {
  if (err instanceof ExportFileError) {
    console.error(`Not imported, nothing was changed: ${err.message}`);
  } else if (err instanceof ImportError) {
    console.error(`Import stopped while writing ${err.table}: ${err.message}`);
    console.error('The business may be partly imported. Fix the problem and run the import again (it replaces everything).');
  } else if (err instanceof UsageError) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
