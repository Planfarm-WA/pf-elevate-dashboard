// An in-memory stand-in for src/backend.ts, so Supabase mode can be tested without a network.
// It applies the sync's ops to stored rows the way the database would (including cascades).
import type { ParsedExport } from '../src/adapters.ts';
import type { Backend } from '../src/backend.ts';
import { rowsToState, stateToRows, type LoadedBusiness, type Snapshot } from '../src/rows.ts';
import { emptyState } from '../src/state.ts';
import type { Op } from '../src/sync.ts';

export interface FakeBusiness {
  id: string;
  name: string;
  /** Emails of client logins linked to this business. */
  clients?: string[];
  rows?: Snapshot;
}

export interface FakeOptions {
  /** email → password */
  users: Record<string, string>;
  /** Emails that are staff (can open every business). */
  staff?: string[];
  businesses: FakeBusiness[];
  /** Already logged in (a session left from an earlier visit). */
  signedIn?: string | null;
}

const LIST_FIELDS: Record<string, keyof Snapshot> = {
  core_values: 'coreValues', three_year_items: 'threeYearItems', one_year_targets: 'oneYearTargets',
  issues: 'issues', pending_priorities_120: 'pendingPriorities', pending_tasks_30: 'pendingTasks',
};
const ID_FIELDS: Record<string, 'periods' | 'priorities' | 'rounds' | 'tasks' | 'sessions'> = {
  periods_120: 'periods', priorities_120: 'priorities', rounds_30: 'rounds', tasks_30: 'tasks', coaching_sessions: 'sessions',
};

export function createFakeBackend(options: FakeOptions) {
  let user = options.signedIn ?? null;
  const businesses = new Map(options.businesses.map((b) => [b.id, {
    name: b.name,
    clients: b.clients ?? [],
    rows: structuredClone(b.rows ?? stateToRows(emptyState())),
  }]));
  const applied: Op[][] = [];
  const loaded: string[] = [];
  let failures = 0;
  let loadFailures = 0;
  let heldLoad: Promise<void> | null = null;

  const canSee = (id: string) => {
    const b = businesses.get(id);
    return !!b && !!user && ((options.staff ?? []).includes(user) || b.clients.includes(user));
  };
  const rowsOf = (id: string): Snapshot => {
    const b = businesses.get(id);
    if (!b || !canSee(id)) throw new Error('This business was not found, or your login cannot open it.');
    return b.rows;
  };

  function load(id: string): LoadedBusiness {
    const rows = rowsOf(id);
    const queued = <T>(list: T[]) => list.map((row, i) => ({ ...row, created_at: new Date(Date.UTC(2026, 0, 1) + i).toISOString() }));
    return structuredClone({
      id,
      name: businesses.get(id)?.name ?? '',
      blueprint: { ...rows.blueprint, core_values: rows.coreValues, three_year_items: rows.threeYearItems, one_year_targets: rows.oneYearTargets },
      issues: rows.issues,
      periods: Object.values(rows.periods).map((p) => ({ ...p, priorities: Object.values(rows.priorities).filter((x) => x.period_id === p.id) })),
      rounds: Object.values(rows.rounds).map((r) => ({ ...r, tasks: Object.values(rows.tasks).filter((t) => t.round_id === r.id) })),
      pendingPriorities: queued(rows.pendingPriorities),
      pendingTasks: queued(rows.pendingTasks),
      sessions: Object.values(rows.sessions),
    });
  }

  const backend: Backend = {
    async signIn(email, password) {
      if (options.users[email] !== password) throw new Error('Invalid login credentials');
      user = email;
    },
    async signOut() { user = null; },
    async currentUser() { return user; },
    async listBusinesses() {
      return [...businesses.entries()].filter(([id]) => canSee(id)).map(([id, b]) => ({ id, name: b.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async loadBusiness(id) {
      loaded.push(id);
      if (loadFailures > 0) { loadFailures--; throw new Error('simulated network error'); }
      // Read now, as the server would at request time, but answer once a held load is released.
      const data = canSee(id) ? load(id) : null;
      const hold = heldLoad;
      heldLoad = null;
      if (hold) await hold;
      return data;
    },
    async apply(id, ops) {
      if (failures > 0) { failures--; throw new Error('simulated network error'); }
      const rows = rowsOf(id);
      for (const op of structuredClone(ops)) {
        if (op.kind === 'blueprint') rows.blueprint = op.row;
        if (op.kind === 'replace') (rows[LIST_FIELDS[op.table]] as object[]) = op.rows;
        if (op.kind === 'delete') {
          const field = ID_FIELDS[op.table];
          for (const rowId of op.ids) {
            delete rows[field][rowId];
            // on delete cascade
            if (field === 'periods') for (const x of Object.values(rows.priorities)) if (x.period_id === rowId) delete rows.priorities[x.id];
            if (field === 'rounds') for (const t of Object.values(rows.tasks)) if (t.round_id === rowId) delete rows.tasks[t.id];
          }
        }
        if (op.kind === 'upsert') {
          const table = rows[ID_FIELDS[op.table]] as Record<string, object>;
          for (const row of op.rows as Array<{ id: string }>) table[row.id] = row;
        }
      }
      applied.push(ops);
    },
    async importFile(id, file: ParsedExport) {
      const s = rowsToState(load(id));
      s.blueprint = file.blueprint;
      const withId = <T extends { id: string }>(x: T): T => ({ ...x, id: crypto.randomUUID() });
      if (file.periods120) s.periods120 = file.periods120.map((p) => ({ ...withId(p), priorities: p.priorities.map(withId) }));
      if (file.rounds) s.rounds = file.rounds.map((r) => ({ ...withId(r), tasks: r.tasks.map(withId) }));
      if (file.sessions) s.sessions = file.sessions.map(withId);
      s.pendingPushes = file.pendingPushes;
      s.pendingPushes120 = file.pendingPushes120;
      const b = businesses.get(id);
      if (b) b.rows = stateToRows(s);
    },
  };

  return {
    backend,
    /** The rows stored for a business (what "the database" holds). */
    rows: (id: string) => businesses.get(id)?.rows ?? stateToRows(emptyState()),
    /** Every apply() call that succeeded, in order. */
    applied,
    /** Make the next `count` apply() calls fail. */
    failNext: (count = 1) => { failures = count; },
    /** Every loadBusiness() call, in order (the business ids). */
    loaded,
    /** Change a business's stored rows, as another device would. */
    remoteChange: (id: string, change: (rows: Snapshot) => void) => {
      const b = businesses.get(id);
      if (b) change(b.rows);
    },
    /** Rename a business, as staff on another device would. */
    rename: (id: string, name: string) => {
      const b = businesses.get(id);
      if (b) b.name = name;
    },
    /** Delete a business (its rows and client links go with it). */
    removeBusiness: (id: string) => { businesses.delete(id); },
    /** Make the next `count` loadBusiness() calls fail, as when offline. */
    failNextLoad: (count = 1) => { loadFailures = count; },
    /** Hold the next loadBusiness() answer (read at request time) until the returned function runs. */
    holdNextLoad: (): (() => void) => {
      let release = () => {};
      heldLoad = new Promise<void>((resolve) => { release = resolve; });
      return () => release();
    },
  };
}
