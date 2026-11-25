// Everything the app asks of Supabase, behind one interface. supabaseBackend() is the real one;
// the tests use an in-memory fake with the same interface.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedExport } from './adapters.ts';
import type { Database } from './database.types.ts';
import { importDashboard } from './importer.ts';
import type { LoadedBusiness } from './rows.ts';
import type { Op } from './sync.ts';

export interface BusinessSummary {
  id: string;
  name: string;
}

export interface Backend {
  /** Throws with Supabase's message (e.g. "Invalid login credentials") if it fails. */
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** The signed-in user's email, or null when nobody is signed in. */
  currentUser(): Promise<string | null>;
  /** The businesses this login can open (all of them for staff), by name. */
  listBusinesses(): Promise<BusinessSummary[]>;
  loadBusiness(id: string): Promise<LoadedBusiness>;
  /** Write the ops in order; throws on the first failure. */
  apply(businessId: string, ops: Op[]): Promise<void>;
  /** Replace a business's data with a checked export file (see importer.ts). */
  importFile(businessId: string, file: ParsedExport): Promise<void>;
}

type Db = SupabaseClient<Database>;

/** One nested select loads a whole business (Supabase follows the foreign keys). */
const BUSINESS_QUERY = `
  id, name,
  blueprints ( ten_year, purpose,
    core_values ( text, sort_order ),
    three_year_items ( text, done, sort_order ),
    one_year_targets ( text, done, sort_order ) ),
  issues ( kind, text, sort_order ),
  periods_120 ( id, label, period, is_current, one_year_targets, sort_order,
    priorities_120 ( id, what, who, by_when, status, pushed, carried_from, sort_order ) ),
  rounds_30 ( id, label, period, is_current, notes, sort_order,
    tasks_30 ( id, what, who, by_when, status, pushed, carried_from, sort_order ) ),
  pending_priorities_120 ( what, who, by_when, from_period, created_at ),
  pending_tasks_30 ( what, who, by_when, from_round, created_at ),
  coaching_sessions ( id, session_date, format, focus, notes, done, sort_order )
`;

/** The nested select's result, as Supabase returns it (table names as keys). */
interface RawBusiness {
  id: string;
  name: string;
  blueprints: NonNullable<LoadedBusiness['blueprint']> | NonNullable<LoadedBusiness['blueprint']>[] | null;
  issues: LoadedBusiness['issues'];
  periods_120: (Omit<LoadedBusiness['periods'][number], 'priorities'> & { priorities_120: LoadedBusiness['periods'][number]['priorities'] })[];
  rounds_30: (Omit<LoadedBusiness['rounds'][number], 'tasks'> & { tasks_30: LoadedBusiness['rounds'][number]['tasks'] })[];
  pending_priorities_120: LoadedBusiness['pendingPriorities'];
  pending_tasks_30: LoadedBusiness['pendingTasks'];
  coaching_sessions: LoadedBusiness['sessions'];
}

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

/** The tables whose rows carry business_id directly (priorities and tasks hang off their period/round). */
const HAS_BUSINESS_ID = new Set(['periods_120', 'rounds_30', 'coaching_sessions']);
/** The queues are read back in created_at order. */
const QUEUES = new Set(['pending_priorities_120', 'pending_tasks_30']);

export function supabaseBackend(db: Db): Backend {
  // apply() works on table names chosen at runtime, which the typed client can't follow;
  // the rows come from stateToRows(), so their shape is already right.
  const loose = db as unknown as SupabaseClient;

  return {
    async signIn(email, password) {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },

    async signOut() {
      await db.auth.signOut();
    },

    async currentUser() {
      const { data } = await db.auth.getSession();
      return data.session?.user.email ?? null;
    },

    async listBusinesses() {
      const { data, error } = await db.from('businesses').select('id, name').order('name');
      fail('Loading the businesses', error);
      return data ?? [];
    },

    async loadBusiness(id) {
      const { data, error } = await loose.from('businesses').select(BUSINESS_QUERY).eq('id', id).maybeSingle();
      fail('Loading the business', error);
      if (!data) throw new Error('This business was not found, or your login cannot open it.');
      const raw = data as RawBusiness;
      const blueprint = Array.isArray(raw.blueprints) ? (raw.blueprints[0] ?? null) : raw.blueprints;
      return {
        id: raw.id,
        name: raw.name,
        blueprint,
        issues: raw.issues,
        periods: raw.periods_120.map(({ priorities_120, ...p }) => ({ ...p, priorities: priorities_120 })),
        rounds: raw.rounds_30.map(({ tasks_30, ...r }) => ({ ...r, tasks: tasks_30 })),
        pendingPriorities: raw.pending_priorities_120,
        pendingTasks: raw.pending_tasks_30,
        sessions: raw.coaching_sessions,
      };
    },

    async apply(businessId, ops) {
      const start = Date.now();
      for (const op of ops) {
        switch (op.kind) {
          case 'blueprint': {
            const { error } = await db.from('blueprints').upsert({ business_id: businessId, ...op.row }, { onConflict: 'business_id' });
            fail('Saving the blueprint', error);
            break;
          }
          case 'replace': {
            const removed = await loose.from(op.table).delete().eq('business_id', businessId);
            fail(`Saving ${op.table}`, removed.error);
            if (op.rows.length) {
              const rows = op.rows.map((row, i) => ({
                ...row,
                business_id: businessId,
                ...(QUEUES.has(op.table) ? { created_at: new Date(start + i).toISOString() } : {}),
              }));
              const inserted = await loose.from(op.table).insert(rows);
              fail(`Saving ${op.table}`, inserted.error);
            }
            break;
          }
          case 'delete': {
            const { error } = await loose.from(op.table).delete().in('id', op.ids);
            fail(`Deleting from ${op.table}`, error);
            break;
          }
          case 'upsert': {
            const rows = HAS_BUSINESS_ID.has(op.table) ? op.rows.map((row) => ({ ...row, business_id: businessId })) : op.rows;
            const { error } = await loose.from(op.table).upsert(rows);
            fail(`Saving ${op.table}`, error);
            break;
          }
        }
      }
    },

    async importFile(businessId, file) {
      await importDashboard(db, businessId, file);
    },
  };
}
