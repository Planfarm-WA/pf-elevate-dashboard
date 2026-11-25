// Ids for periods, rounds, priorities, tasks and sessions. They're UUID strings, so an item keeps
// the same id in the app and in the database: the Supabase sync matches rows by id.

import type { State } from './types.ts';

/** A new, globally unique id. */
export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Older saves and export files use numbers as ids (Date.now() for periods and rounds, 1, 2, 3…
 * for items). Turn every id in `s` into a string, so the rest of the code only sees strings.
 */
export function stringifyIds(s: State): void {
  for (const p of s.periods120 ?? []) {
    p.id = String(p.id);
    for (const x of p.priorities ?? []) x.id = String(x.id);
  }
  for (const r of s.rounds ?? []) {
    r.id = String(r.id);
    for (const t of r.tasks ?? []) t.id = String(t.id);
  }
  for (const s2 of s.sessions ?? []) s2.id = String(s2.id);
}
