// Writes a checked export file into one business's tables through supabase-js. The database's
// access rules (RLS) apply: staff can import into any business, a client only into their own.
//
// supabase-js sends each insert and delete as its own request, so there's no transaction across
// them. If a request fails, the import stops and the business may be partly imported. Importing
// the same file again fixes it, because an import replaces the business's data.

import type { SupabaseClient } from '@supabase/supabase-js';
import { exportToRows, type ParsedExport } from './adapters.ts';
import type { Database } from './database.types.ts';

/** A write failed; `table` says where the import stopped. */
export class ImportError extends Error {
  readonly table: string;

  constructor(table: string, message: string) {
    super(`${table}: ${message}`);
    this.name = 'ImportError';
    this.table = table;
  }
}

/** How many rows were written. null: the file didn't have that list, so the existing rows were kept. */
export interface ImportSummary {
  coreValues: number;
  threeYearItems: number;
  oneYearTargets: number;
  issues: number;
  periods: number | null;
  priorities: number | null;
  rounds: number | null;
  tasks: number | null;
  pendingPriorities: number;
  pendingTasks: number;
  sessions: number | null;
}

/** Throw an ImportError if a supabase-js request failed; otherwise return its result. */
function must<T extends { error: { message: string } | null }>(table: string, result: T): T {
  if (result.error) throw new ImportError(table, result.error.message);
  return result;
}

/**
 * Replace a business's dashboard with the contents of an export file. What's replaced matches the
 * app's Import: the blueprint and its lists always; periods, rounds and sessions only if the file
 * has them; both queues always.
 */
export async function importDashboard(
  sb: SupabaseClient<Database>,
  businessId: string,
  file: ParsedExport,
): Promise<ImportSummary> {
  const rows = exportToRows(file);
  const business_id = businessId;

  // RLS hides businesses this login can't access, so "not found" also means "no access".
  const found = must('businesses', await sb.from('businesses').select('id').eq('id', business_id).maybeSingle());
  if (!found.data) throw new ImportError('businesses', `No business ${business_id} (or no access to it)`);

  // The blueprint row already exists (a trigger creates it with the business); upsert in case it doesn't.
  must('blueprints', await sb.from('blueprints').upsert({ business_id, ...rows.blueprint }, { onConflict: 'business_id' }));

  must('core_values', await sb.from('core_values').delete().eq('business_id', business_id));
  if (rows.coreValues.length) must('core_values', await sb.from('core_values').insert(rows.coreValues.map((r) => ({ ...r, business_id }))));

  must('three_year_items', await sb.from('three_year_items').delete().eq('business_id', business_id));
  if (rows.threeYearItems.length) must('three_year_items', await sb.from('three_year_items').insert(rows.threeYearItems.map((r) => ({ ...r, business_id }))));

  must('one_year_targets', await sb.from('one_year_targets').delete().eq('business_id', business_id));
  if (rows.oneYearTargets.length) must('one_year_targets', await sb.from('one_year_targets').insert(rows.oneYearTargets.map((r) => ({ ...r, business_id }))));

  must('issues', await sb.from('issues').delete().eq('business_id', business_id));
  if (rows.issues.length) must('issues', await sb.from('issues').insert(rows.issues.map((r) => ({ ...r, business_id }))));

  let priorities: number | null = null;
  if (rows.periods) {
    // Deleting a period deletes its priorities too (on delete cascade).
    must('periods_120', await sb.from('periods_120').delete().eq('business_id', business_id));
    priorities = 0;
    if (rows.periods.length) {
      const inserted = must('periods_120', await sb.from('periods_120')
        .insert(rows.periods.map((p) => ({ ...p.period, business_id })))
        .select('id, sort_order')).data ?? [];
      const idBySort = new Map(inserted.map((p) => [p.sort_order, p.id]));
      const priorityRows = rows.periods.flatMap((p) => {
        const period_id = idBySort.get(p.period.sort_order);
        if (!period_id) throw new ImportError('periods_120', `the insert didn't return period ${p.period.sort_order + 1}`);
        return p.priorities.map((x) => ({ ...x, period_id }));
      });
      if (priorityRows.length) must('priorities_120', await sb.from('priorities_120').insert(priorityRows));
      priorities = priorityRows.length;
    }
  }

  let tasks: number | null = null;
  if (rows.rounds) {
    must('rounds_30', await sb.from('rounds_30').delete().eq('business_id', business_id));
    tasks = 0;
    if (rows.rounds.length) {
      const inserted = must('rounds_30', await sb.from('rounds_30')
        .insert(rows.rounds.map((r) => ({ ...r.round, business_id })))
        .select('id, sort_order')).data ?? [];
      const idBySort = new Map(inserted.map((r) => [r.sort_order, r.id]));
      const taskRows = rows.rounds.flatMap((r) => {
        const round_id = idBySort.get(r.round.sort_order);
        if (!round_id) throw new ImportError('rounds_30', `the insert didn't return round ${r.round.sort_order + 1}`);
        return r.tasks.map((x) => ({ ...x, round_id }));
      });
      if (taskRows.length) must('tasks_30', await sb.from('tasks_30').insert(taskRows));
      tasks = taskRows.length;
    }
  }

  // The queues have no sort_order; they're read back in created_at order, so space those 1 ms apart.
  const start = Date.now();
  const createdAt = (i: number) => new Date(start + i).toISOString();

  must('pending_priorities_120', await sb.from('pending_priorities_120').delete().eq('business_id', business_id));
  if (rows.pendingPriorities.length) must('pending_priorities_120', await sb.from('pending_priorities_120').insert(rows.pendingPriorities.map((r, i) => ({ ...r, business_id, created_at: createdAt(i) }))));

  must('pending_tasks_30', await sb.from('pending_tasks_30').delete().eq('business_id', business_id));
  if (rows.pendingTasks.length) must('pending_tasks_30', await sb.from('pending_tasks_30').insert(rows.pendingTasks.map((r, i) => ({ ...r, business_id, created_at: createdAt(i) }))));

  if (rows.sessions) {
    must('coaching_sessions', await sb.from('coaching_sessions').delete().eq('business_id', business_id));
    if (rows.sessions.length) must('coaching_sessions', await sb.from('coaching_sessions').insert(rows.sessions.map((r) => ({ ...r, business_id }))));
  }

  return {
    coreValues: rows.coreValues.length,
    threeYearItems: rows.threeYearItems.length,
    oneYearTargets: rows.oneYearTargets.length,
    issues: rows.issues.length,
    periods: rows.periods ? rows.periods.length : null,
    priorities,
    rounds: rows.rounds ? rows.rounds.length : null,
    tasks,
    pendingPriorities: rows.pendingPriorities.length,
    pendingTasks: rows.pendingTasks.length,
    sessions: rows.sessions ? rows.sessions.length : null,
  };
}
