// Saving to Supabase: compare the rows last saved with the rows `state` has now, and write only
// the differences. diff() is pure; createSyncer() runs it after a short pause, and retries.

import type { PeriodRow, PriorityRow, RoundRow, SessionRow, Snapshot, TaskRow } from './rows.ts';

/** The lists without ids. When one changes, its rows are replaced as a whole. */
export type ListTable = 'core_values' | 'three_year_items' | 'one_year_targets' | 'issues' | 'pending_priorities_120' | 'pending_tasks_30';
/** The tables whose rows have ids. They get per-row upserts and deletes. */
export type IdTable = 'periods_120' | 'priorities_120' | 'rounds_30' | 'tasks_30' | 'coaching_sessions';

/** One write. The backend adds business_id (and created_at for the queues). */
export type Op =
  | { kind: 'blueprint'; row: Snapshot['blueprint'] }
  | { kind: 'replace'; table: ListTable; rows: object[] }
  | { kind: 'delete'; table: IdTable; ids: string[] }
  | { kind: 'upsert'; table: IdTable; rows: object[] };

const LISTS: Array<[ListTable, (s: Snapshot) => object[]]> = [
  ['core_values', (s) => s.coreValues],
  ['three_year_items', (s) => s.threeYearItems],
  ['one_year_targets', (s) => s.oneYearTargets],
  ['issues', (s) => s.issues],
  ['pending_priorities_120', (s) => s.pendingPriorities],
  ['pending_tasks_30', (s) => s.pendingTasks],
];

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Rows in `next` that are new or differ from `prev` (matched by id). */
function changed<T extends { id: string }>(prev: Record<string, T>, next: Record<string, T>): T[] {
  return Object.values(next).filter((row) => !same(prev[row.id], row));
}

/** Ids in `prev` that are gone from `next`. */
function removed<T>(prev: Record<string, T>, next: Record<string, T>): string[] {
  return Object.keys(prev).filter((id) => !(id in next));
}

/**
 * The writes that turn `prev` into `next`, in a safe order: the blueprint, the lists, deletes
 * (children before parents), periods and rounds that stop being current before those that become
 * current (the database allows one current per business), then priorities, tasks and sessions.
 */
export function diff(prev: Snapshot, next: Snapshot): Op[] {
  const ops: Op[] = [];
  if (!same(prev.blueprint, next.blueprint)) ops.push({ kind: 'blueprint', row: next.blueprint });
  for (const [table, rows] of LISTS) {
    if (!same(rows(prev), rows(next))) ops.push({ kind: 'replace', table, rows: rows(next) });
  }
  const deletes: Array<[IdTable, string[]]> = [
    ['priorities_120', removed<PriorityRow>(prev.priorities, next.priorities)],
    ['tasks_30', removed<TaskRow>(prev.tasks, next.tasks)],
    ['periods_120', removed<PeriodRow>(prev.periods, next.periods)],
    ['rounds_30', removed<RoundRow>(prev.rounds, next.rounds)],
    ['coaching_sessions', removed<SessionRow>(prev.sessions, next.sessions)],
  ];
  for (const [table, ids] of deletes) if (ids.length) ops.push({ kind: 'delete', table, ids });

  const upsert = (table: IdTable, rows: object[]) => { if (rows.length) ops.push({ kind: 'upsert', table, rows }); };
  const periods = changed(prev.periods, next.periods);
  const rounds = changed(prev.rounds, next.rounds);
  upsert('periods_120', periods.filter((p) => !p.is_current));
  upsert('rounds_30', rounds.filter((r) => !r.is_current));
  upsert('periods_120', periods.filter((p) => p.is_current));
  upsert('rounds_30', rounds.filter((r) => r.is_current));
  upsert('priorities_120', changed<PriorityRow>(prev.priorities, next.priorities));
  upsert('tasks_30', changed<TaskRow>(prev.tasks, next.tasks));
  upsert('coaching_sessions', changed<SessionRow>(prev.sessions, next.sessions));
  return ops;
}

// ---- Running it ----

export type SyncStatus =
  | { state: 'saved'; at: Date | null }
  | { state: 'saving' }
  | { state: 'error'; message: string };

export interface SyncerOptions {
  /** The rows `state` has now (stateToRows). */
  snapshot(): Snapshot;
  /** Write the ops, in order. Throws if one fails. */
  apply(ops: Op[]): Promise<void>;
  onStatus(status: SyncStatus): void;
  /** How long to wait after the last change before writing. */
  debounceMs?: number;
  /** Waits before each retry after a failure; the last one repeats. */
  retryMs?: number[];
}

export interface Syncer {
  /** Start from these rows (what the database holds right after loading). */
  reset(saved: Snapshot): void;
  /** Something in `state` changed: write the differences after a short pause. */
  changed(): void;
  /** True while changes haven't reached the database yet (waiting, writing, or failed). */
  pending(): boolean;
  /** True when `rows` hold exactly what was last saved (or loaded): nothing to write. */
  matchesSaved(rows: Snapshot): boolean;
  /**
   * Stop for good: no more writes, retries or status updates, and unsaved changes are dropped. A
   * write already under way still reaches the database, but its result is ignored. Without this,
   * a retry after the business was left would compare `state` (by then another business, or empty)
   * with this business's saved rows, and write the difference into this business.
   */
  stop(): void;
}

export function createSyncer(options: SyncerOptions): Syncer {
  const debounceMs = options.debounceMs ?? 400;
  const retryMs = options.retryMs ?? [2000, 5000, 10000, 30000];
  let saved: Snapshot | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let runAgain = false;
  let failed = false;
  let attempt = 0;
  let stopped = false;

  function schedule(delay: number): void {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void run(); }, delay);
  }

  async function run(): Promise<void> {
    if (stopped || !saved) return;
    if (running) { runAgain = true; return; }
    running = true;
    try {
      const next = options.snapshot();
      const ops = diff(saved, next);
      if (ops.length) await options.apply(ops);
      if (stopped) return;
      saved = next;
      failed = false;
      attempt = 0;
      if (!runAgain && !timer) options.onStatus({ state: 'saved', at: new Date() });
    } catch (err) {
      if (stopped) return;
      // Keep `saved` as it was: the retry recomputes the same differences, and every write can be
      // repeated safely, so a partly applied attempt still ends up right.
      failed = true;
      options.onStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) });
      schedule(retryMs[Math.min(attempt, retryMs.length - 1)]);
      attempt++;
    } finally {
      running = false;
      if (runAgain) { runAgain = false; schedule(debounceMs); }
    }
  }

  return {
    reset(snapshot) {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = null;
      saved = snapshot;
      failed = false;
      attempt = 0;
      options.onStatus({ state: 'saved', at: null });
    },
    changed() {
      if (stopped) return;
      if (!failed) options.onStatus({ state: 'saving' });
      schedule(debounceMs);
    },
    pending: () => !stopped && (timer !== null || running || failed),
    matchesSaved: (rows) => saved !== null && diff(saved, rows).length === 0,
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      runAgain = false;
    },
  };
}
