// Where the dashboard's data is kept: localStorage (storage.ts) or Supabase. main.ts picks one at
// startup; the rest of the code only calls save() after changing `state`.

import type { ExportFile } from './types.ts';

/** What an imported file may hold. Only `version` and `blueprint` are checked (in io.ts). */
export type ImportedData = Partial<ExportFile> & { lastUpdated?: string };

export interface Persistence {
  /** Fill `state` with the dashboard. Runs at startup, before the first render. */
  load(): Promise<void>;
  /** Called by save() after every change to `state`. */
  changed(): void;
  /** Replace the dashboard with an export file's data (already checked and confirmed). */
  importData(data: ImportedData): Promise<void>;
}

let active: Persistence | null = null;

/** Choose where data is kept. Called once by main.ts. */
export function usePersistence(persistence: Persistence): void {
  active = persistence;
}

/** The persistence main.ts chose. */
export function persistence(): Persistence {
  if (!active) throw new Error('No persistence chosen yet (main.ts calls usePersistence first)');
  return active;
}

/** Save the latest changes to `state`. Every section calls this right after changing `state`. */
export function save(): void {
  persistence().changed();
}
