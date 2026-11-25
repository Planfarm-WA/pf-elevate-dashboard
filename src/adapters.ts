// Converts a dashboard JSON export into rows for the Supabase tables. Pure functions: no DOM, no
// network. Used by scripts/import-dashboard.ts now, and by the app's Import button later.

import { Constants, type TablesInsert } from './database.types.ts';
import type {
  Blueprint, Item, OneYearTarget, PendingPriority120, PendingTask30, Period120, Round30, Session, Status,
} from './types.ts';

/** A problem with the file itself. Thrown before anything is written. */
export class ExportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportFileError';
  }
}

/**
 * An export file after parseExportFile(): checked, with legacy data converted. A list the file
 * doesn't contain is undefined, and importing keeps the existing rows for it (as the app's
 * Import does).
 */
export interface ParsedExport {
  blueprint: Blueprint;
  periods120?: Period120[];
  rounds?: Round30[];
  sessions?: Session[];
  /** Always replaced on import; a missing queue is empty. */
  pendingPushes: PendingTask30[];
  pendingPushes120: PendingPriority120[];
}

// ---- Checking and normalising the JSON ----

type JsonObject = Record<string, unknown>;

const STATUSES: readonly string[] = Constants.public.Enums.item_status;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown, path: string): JsonObject {
  if (!isObject(value)) throw new ExportFileError(`${path} must be an object`);
  return value;
}

/** A text field. Missing or null → ''; numbers and booleans → their text. */
function text(value: unknown, path: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new ExportFileError(`${path} must be text`);
}

/** A list, or undefined when the field is missing or null. */
function optionalList(value: unknown, path: string): unknown[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new ExportFileError(`${path} must be a list`);
  return value;
}

function list(value: unknown, path: string): unknown[] {
  return optionalList(value, path) ?? [];
}

function status(value: unknown, path: string): Status {
  if (value === undefined || value === null || value === '') return 'none';
  if (typeof value === 'string' && STATUSES.includes(value)) return value as Status;
  throw new ExportFileError(`${path} is ${JSON.stringify(value)}; expected ${STATUSES.join(', ')}`);
}

function parseItem(value: unknown, path: string): Item {
  const o = asObject(value, path);
  const item: Item = {
    id: '', // ids aren't imported; the database makes new ones
    what: text(o.what, `${path}.what`),
    who: text(o.who, `${path}.who`),
    when: text(o.when, `${path}.when`),
    status: status(o.status, `${path}.status`),
    pushed: Boolean(o.pushed),
  };
  if (o.carriedFrom !== undefined && o.carriedFrom !== null) item.carriedFrom = text(o.carriedFrom, `${path}.carriedFrom`);
  return item;
}

function parseOneYearTarget(value: unknown, path: string): OneYearTarget {
  if (typeof value === 'string') return { text: value, done: false }; // older exports
  const o = asObject(value, path);
  return { text: text(o.text, `${path}.text`), done: Boolean(o.done) };
}

function parseBlueprint(value: unknown): Blueprint {
  const o = asObject(value, 'blueprint');
  const done = o.threeyearDone;
  return {
    tenyear: text(o.tenyear, 'blueprint.tenyear'),
    threeyear: text(o.threeyear, 'blueprint.threeyear'),
    threeyearDone: isObject(done) ? (done as Record<number, boolean>) : {},
    values: list(o.values, 'blueprint.values').map((v, i) => text(v, `blueprint.values[${i}]`)),
    oneyear: list(o.oneyear, 'blueprint.oneyear').map((v, i) => parseOneYearTarget(v, `blueprint.oneyear[${i}]`)),
    purpose: text(o.purpose, 'blueprint.purpose'),
    issues: list(o.issues, 'blueprint.issues').map((v, i) => text(v, `blueprint.issues[${i}]`)),
  };
}

function parsePeriod(value: unknown, path: string): Period120 {
  const o = asObject(value, path);
  return {
    id: '',
    label: text(o.label, `${path}.label`),
    period: text(o.period, `${path}.period`),
    current: Boolean(o.current),
    oneyear: list(o.oneyear, `${path}.oneyear`).map((v, i) => text(v, `${path}.oneyear[${i}]`)),
    priorities: list(o.priorities, `${path}.priorities`).map((v, i) => parseItem(v, `${path}.priorities[${i}]`)),
  };
}

function parseRound(value: unknown, path: string): Round30 {
  const o = asObject(value, path);
  return {
    id: '',
    label: text(o.label, `${path}.label`),
    period: text(o.period, `${path}.period`),
    current: Boolean(o.current),
    notes: text(o.notes, `${path}.notes`),
    tasks: list(o.tasks, `${path}.tasks`).map((v, i) => parseItem(v, `${path}.tasks[${i}]`)),
  };
}

function parseSession(value: unknown, path: string): Session {
  const o = asObject(value, path);
  return {
    id: '',
    date: text(o.date, `${path}.date`),
    format: text(o.format, `${path}.format`),
    focus: text(o.focus, `${path}.focus`),
    notes: text(o.notes, `${path}.notes`),
    done: Boolean(o.done),
  };
}

/**
 * Check an export file (parsed JSON) and convert it to ParsedExport. Throws ExportFileError,
 * naming the field, if something can't be imported. Like the app's Import, the file needs a
 * `version` and a `blueprint`.
 */
export function parseExportFile(json: unknown): ParsedExport {
  if (!isObject(json) || !json.version || !json.blueprint) {
    throw new ExportFileError('Not a valid Planfarm data file: it needs "version" and "blueprint"');
  }
  const periods = optionalList(json.periods120, 'periods120');
  const rounds = optionalList(json.rounds, 'rounds');
  const sessions = optionalList(json.sessions, 'sessions');
  return {
    blueprint: parseBlueprint(json.blueprint),
    periods120: periods?.map((v, i) => parsePeriod(v, `periods120[${i}]`)),
    rounds: rounds?.map((v, i) => parseRound(v, `rounds[${i}]`)),
    sessions: sessions?.map((v, i) => parseSession(v, `sessions[${i}]`)),
    pendingPushes: list(json.pendingPushes, 'pendingPushes').map((v, i) => {
      const o = asObject(v, `pendingPushes[${i}]`);
      return { what: text(o.what, `pendingPushes[${i}].what`), who: text(o.who, `pendingPushes[${i}].who`), when: text(o.when, `pendingPushes[${i}].when`), fromRound: text(o.fromRound, `pendingPushes[${i}].fromRound`) };
    }),
    pendingPushes120: list(json.pendingPushes120, 'pendingPushes120').map((v, i) => {
      const o = asObject(v, `pendingPushes120[${i}]`);
      return { what: text(o.what, `pendingPushes120[${i}].what`), who: text(o.who, `pendingPushes120[${i}].who`), when: text(o.when, `pendingPushes120[${i}].when`), fromPeriod: text(o.fromPeriod, `pendingPushes120[${i}].fromPeriod`) };
    }),
  };
}

// ---- Building the rows ----

/** The tables whose rows carry a sort_order. */
type SortedTable =
  | 'core_values' | 'three_year_items' | 'one_year_targets' | 'issues'
  | 'periods_120' | 'priorities_120' | 'rounds_30' | 'tasks_30' | 'coaching_sessions';

/** A row to insert, without the columns the importer fills in, and with sort_order required. */
type RowFor<T extends SortedTable, Omitted extends string> = Omit<TablesInsert<T>, Omitted | 'sort_order'> & { sort_order: number };

export interface DashboardRows {
  blueprint: { ten_year: string; purpose: string };
  coreValues: RowFor<'core_values', 'business_id'>[];
  threeYearItems: RowFor<'three_year_items', 'business_id'>[];
  oneYearTargets: RowFor<'one_year_targets', 'business_id'>[];
  issues: RowFor<'issues', 'business_id'>[];
  /** Undefined: the file has no periods120, so existing periods are kept. */
  periods?: { period: RowFor<'periods_120', 'business_id'>; priorities: RowFor<'priorities_120', 'period_id'>[] }[];
  /** Undefined: the file has no rounds, so existing rounds are kept. */
  rounds?: { round: RowFor<'rounds_30', 'business_id'>; tasks: RowFor<'tasks_30', 'round_id'>[] }[];
  /** In queue order. The importer sets created_at to keep that order. */
  pendingPriorities: Omit<TablesInsert<'pending_priorities_120'>, 'business_id' | 'created_at'>[];
  pendingTasks: Omit<TablesInsert<'pending_tasks_30'>, 'business_id' | 'created_at'>[];
  /** Undefined: the file has no sessions, so existing sessions are kept. */
  sessions?: RowFor<'coaching_sessions', 'business_id'>[];
}

// The rules below are shared with src/rows.ts (the Supabase sync), so imports and syncing agree.

/** Index of the last item marked current, or -1. The database allows one current per business. */
export function lastCurrent(items: { current: boolean }[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (items[i].current) return i;
  return -1;
}

/** A priority or task as a row, without its id and parent id. */
export function itemRow(item: Item, sortOrder: number) {
  return {
    what: item.what,
    who: item.who,
    by_when: item.when,
    status: item.status,
    pushed: item.pushed,
    carried_from: item.carriedFrom ?? null,
    sort_order: sortOrder,
  };
}

/** The 3-year items in the text, split and indexed the same way as renderThreeYearTargets(). */
export function threeYearLines(text: string): string[] {
  return text.split('\n\n').map((line) => line.trim()).filter(Boolean);
}

/** An issue as stored: the "OPPORTUNITY:" prefix becomes kind = 'opportunity' and leaves the text. */
export function issueRow(issue: string): { kind: 'issue' | 'opportunity'; text: string } {
  return issue.startsWith('OPPORTUNITY:')
    ? { kind: 'opportunity', text: issue.replace(/^OPPORTUNITY:\s*/, '') }
    : { kind: 'issue', text: issue };
}

/** Convert a checked export into rows. Array position becomes sort_order. */
export function exportToRows(file: ParsedExport): DashboardRows {
  const bp = file.blueprint;
  // threeyearDone counts the non-empty items, as on the page.
  const threeYear = threeYearLines(bp.threeyear);
  const currentPeriod = file.periods120 ? lastCurrent(file.periods120) : -1;
  const currentRound = file.rounds ? lastCurrent(file.rounds) : -1;
  return {
    blueprint: { ten_year: bp.tenyear, purpose: bp.purpose },
    coreValues: bp.values.map((value, i) => ({ text: value, sort_order: i })),
    threeYearItems: threeYear.map((line, i) => ({ text: line, done: !!bp.threeyearDone?.[i], sort_order: i })),
    oneYearTargets: bp.oneyear.map((target, i) => ({ text: target.text, done: target.done, sort_order: i })),
    issues: bp.issues.map((issue, i) => ({ ...issueRow(issue), sort_order: i })),
    periods: file.periods120?.map((p, i) => ({
      period: { label: p.label, period: p.period, is_current: i === currentPeriod, one_year_targets: p.oneyear ?? [], sort_order: i },
      priorities: p.priorities.map((item, j) => itemRow(item, j)),
    })),
    rounds: file.rounds?.map((r, i) => ({
      round: { label: r.label, period: r.period, is_current: i === currentRound, notes: r.notes ?? '', sort_order: i },
      tasks: r.tasks.map((item, j) => itemRow(item, j)),
    })),
    pendingPriorities: file.pendingPushes120.map((p) => ({ what: p.what, who: p.who, by_when: p.when, from_period: p.fromPeriod })),
    pendingTasks: file.pendingPushes.map((p) => ({ what: p.what, who: p.who, by_when: p.when, from_round: p.fromRound })),
    sessions: file.sessions?.map((s, i) => ({ session_date: s.date, format: s.format, focus: s.focus, notes: s.notes, done: s.done, sort_order: i })),
  };
}
