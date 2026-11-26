// Converting between `state` and one business's rows in Supabase. Pure functions: no DOM, no
// network. The sync (sync.ts) compares two snapshots made by stateToRows().

import { issueRow, itemRow, lastCurrent, threeYearLines } from './adapters.ts';
import type { Item, OneYearTarget, State, Status } from './types.ts';

// ---- One business's rows, as the sync compares them ----

export interface PeriodRow { id: string; label: string; period: string; is_current: boolean; one_year_targets: string[]; sort_order: number }
export interface RoundRow { id: string; label: string; period: string; is_current: boolean; notes: string; sort_order: number }
export interface ItemRow { id: string; what: string; who: string; by_when: string; status: Status; pushed: boolean; carried_from: string | null; sort_order: number }
export interface PriorityRow extends ItemRow { period_id: string }
export interface TaskRow extends ItemRow { round_id: string }
export interface SessionRow { id: string; session_date: string; format: string; focus: string; notes: string; done: boolean; sort_order: number }

/**
 * Everything the sync writes for one business. Tables with ids are maps from id to row; lists
 * without ids are arrays in order (they're replaced as a whole when they change).
 */
export interface Snapshot {
  blueprint: { ten_year: string; purpose: string };
  coreValues: { text: string; sort_order: number }[];
  threeYearItems: { text: string; done: boolean; sort_order: number }[];
  oneYearTargets: { text: string; done: boolean; sort_order: number }[];
  issues: { kind: 'issue' | 'opportunity'; text: string; sort_order: number }[];
  /** In queue order; the backend sets created_at to keep it. */
  pendingPriorities: { what: string; who: string; by_when: string; from_period: string }[];
  pendingTasks: { what: string; who: string; by_when: string; from_round: string }[];
  periods: Record<string, PeriodRow>;
  priorities: Record<string, PriorityRow>;
  rounds: Record<string, RoundRow>;
  tasks: Record<string, TaskRow>;
  sessions: Record<string, SessionRow>;
}

/** Turn `state` into rows. Array position becomes sort_order; only the last current period/round stays current. */
export function stateToRows(s: State): Snapshot {
  const bp = s.blueprint;
  const done = bp.threeyearDone ?? {};
  const currentPeriod = lastCurrent(s.periods120);
  const currentRound = lastCurrent(s.rounds);
  const snap: Snapshot = {
    blueprint: { ten_year: bp.tenyear, purpose: bp.purpose },
    coreValues: bp.values.map((text, i) => ({ text, sort_order: i })),
    threeYearItems: threeYearLines(bp.threeyear).map((text, i) => ({ text, done: !!done[i], sort_order: i })),
    oneYearTargets: (bp.oneyear as Array<OneYearTarget | string>).map((t, i) =>
      typeof t === 'string' ? { text: t, done: false, sort_order: i } : { text: t.text, done: t.done, sort_order: i }),
    issues: bp.issues.map((issue, i) => ({ ...issueRow(issue), sort_order: i })),
    pendingPriorities: s.pendingPushes120.map((p) => ({ what: p.what, who: p.who, by_when: p.when, from_period: p.fromPeriod })),
    pendingTasks: s.pendingPushes.map((p) => ({ what: p.what, who: p.who, by_when: p.when, from_round: p.fromRound })),
    periods: {}, priorities: {}, rounds: {}, tasks: {}, sessions: {},
  };
  s.periods120.forEach((p, i) => {
    snap.periods[p.id] = { id: p.id, label: p.label, period: p.period, is_current: i === currentPeriod, one_year_targets: p.oneyear ?? [], sort_order: i };
    p.priorities.forEach((item, j) => { snap.priorities[item.id] = { id: item.id, period_id: p.id, ...itemRow(item, j) }; });
  });
  s.rounds.forEach((r, i) => {
    snap.rounds[r.id] = { id: r.id, label: r.label, period: r.period, is_current: i === currentRound, notes: r.notes ?? '', sort_order: i };
    r.tasks.forEach((item, j) => { snap.tasks[item.id] = { id: item.id, round_id: r.id, ...itemRow(item, j) }; });
  });
  s.sessions.forEach((x, i) => {
    snap.sessions[x.id] = { id: x.id, session_date: x.date, format: x.format, focus: x.focus, notes: x.notes, done: x.done, sort_order: i };
  });
  return snap;
}

// ---- Loading: rows → state ----

type Sorted = { sort_order: number };
type Queued = { created_at: string };

/** One business as loaded by the backend (a nested select), before sorting. */
export interface LoadedBusiness {
  id: string;
  name: string;
  blueprint: {
    ten_year: string;
    purpose: string;
    core_values: ({ text: string } & Sorted)[];
    three_year_items: ({ text: string; done: boolean } & Sorted)[];
    one_year_targets: ({ text: string; done: boolean } & Sorted)[];
  } | null;
  issues: ({ kind: 'issue' | 'opportunity'; text: string } & Sorted)[];
  periods: (PeriodRow & { priorities: Omit<PriorityRow, 'period_id'>[] })[];
  rounds: (RoundRow & { tasks: Omit<TaskRow, 'round_id'>[] })[];
  pendingPriorities: (Snapshot['pendingPriorities'][number] & Queued)[];
  pendingTasks: (Snapshot['pendingTasks'][number] & Queued)[];
  sessions: SessionRow[];
}

/**
 * By sort_order, then by id. Two devices adding an item at the same time can give two rows the same
 * sort_order, and the database returns those in no fixed order; the id keeps every load the same.
 */
const bySortOrder = <T extends Sorted & { id?: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.sort_order - b.sort_order || (a.id ?? '').localeCompare(b.id ?? ''));
const byCreatedAt = <T extends Queued>(rows: T[]): T[] => [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));

function toItem(row: ItemRow): Item {
  const item: Item = { id: row.id, what: row.what, who: row.who, when: row.by_when, status: row.status, pushed: row.pushed };
  if (row.carried_from !== null) item.carriedFrom = row.carried_from;
  return item;
}

/** Turn a loaded business into `state` (without lastUpdated: the save status replaces it). */
export function rowsToState(b: LoadedBusiness): State {
  const bp = b.blueprint;
  const threeYear = bySortOrder(bp?.three_year_items ?? []);
  const threeyearDone: Record<number, boolean> = {};
  threeYear.forEach((item, i) => { if (item.done) threeyearDone[i] = true; });
  return {
    blueprint: {
      tenyear: bp?.ten_year ?? '',
      threeyear: threeYear.map((item) => item.text).join('\n\n'),
      threeyearDone,
      values: bySortOrder(bp?.core_values ?? []).map((v) => v.text),
      oneyear: bySortOrder(bp?.one_year_targets ?? []).map((t) => ({ text: t.text, done: t.done })),
      purpose: bp?.purpose ?? '',
      issues: bySortOrder(b.issues).map((i) => (i.kind === 'opportunity' ? `OPPORTUNITY: ${i.text}` : i.text)),
    },
    periods120: bySortOrder(b.periods).map((p) => ({
      id: p.id, label: p.label, period: p.period, current: p.is_current, oneyear: p.one_year_targets,
      priorities: bySortOrder(p.priorities).map(toItem),
    })),
    rounds: bySortOrder(b.rounds).map((r) => ({
      id: r.id, label: r.label, period: r.period, current: r.is_current, notes: r.notes,
      tasks: bySortOrder(r.tasks).map(toItem),
    })),
    sessions: bySortOrder(b.sessions).map((x) => ({ id: x.id, date: x.session_date, format: x.format, focus: x.focus, notes: x.notes, done: x.done })),
    pendingPushes120: byCreatedAt(b.pendingPriorities).map((p) => ({ what: p.what, who: p.who, when: p.by_when, fromPeriod: p.from_period })),
    pendingPushes: byCreatedAt(b.pendingTasks).map((p) => ({ what: p.what, who: p.who, when: p.by_when, fromRound: p.from_round })),
    lastUpdated: null,
  };
}
