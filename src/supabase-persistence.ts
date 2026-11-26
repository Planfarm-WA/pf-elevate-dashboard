// Keeping the dashboard in Supabase: load one business into `state`, then sync every change back
// as row-level writes (sync.ts). Used once someone has logged in and opened a business.

import { parseExportFile } from './adapters.ts';
import type { Backend } from './backend.ts';
import type { ImportedData, Persistence } from './persistence.ts';
import { rowsToState, stateToRows, type LoadedBusiness } from './rows.ts';
import { state } from './state.ts';
import { createSyncer, type SyncStatus } from './sync.ts';

/**
 * What refresh() did:
 * - 'changed': another device changed the business, and `state` now holds the new data (redraw it).
 * - 'unchanged': the database holds what this page last saved (or loaded).
 * - 'skipped': not now (something unsaved, the user is busy, or an edit/load/close happened while
 *   the request was out); a later refresh tries again.
 * - 'failed': the request failed, e.g. offline.
 * - 'gone': the business no longer exists, or this login can't open it any more.
 */
export type RefreshResult = 'changed' | 'unchanged' | 'skipped' | 'failed' | 'gone';

export interface SupabasePersistence extends Persistence {
  /** The open business's name (after load()). */
  businessName(): string;
  /** True while changes haven't reached the database yet, or an import is still running. */
  pending(): boolean;
  /**
   * Reload the business and take on changes made elsewhere. Only while nothing here is unsaved and
   * `busy()` is false, checked before and after the request. Never throws.
   */
  refresh(busy?: () => boolean): Promise<RefreshResult>;
  /**
   * The business is being left (Switch business, Sign out): stop saving it for good, and never
   * load it into `state` again. `state` will soon hold another business, or nothing, and this
   * business's saving must not write that into it.
   */
  close(): void;
}

export function createSupabasePersistence(
  backend: Backend,
  businessId: string,
  onStatus: (status: SyncStatus) => void,
  timing: { debounceMs?: number; retryMs?: number[] } = {},
): SupabasePersistence {
  let name = '';
  let closed = false;
  let importing = false;
  let refreshing = false;
  // Goes up on every edit, load, applied refresh and close. A refresh whose request started before
  // one of those is out of date: applying it could undo an edit made (and saved) meanwhile.
  let generation = 0;
  const syncer = createSyncer({
    snapshot: () => stateToRows(state),
    apply: (ops) => backend.apply(businessId, ops),
    onStatus,
    ...timing,
  });

  const pending = () => !closed && (importing || syncer.pending());

  /** Put a loaded business into `state`; the syncer starts from exactly these rows. */
  function adopt(business: LoadedBusiness): void {
    generation++;
    name = business.name;
    Object.assign(state, rowsToState(business));
    syncer.reset(stateToRows(state));
  }

  async function load(): Promise<void> {
    generation++;
    const business = await backend.loadBusiness(businessId);
    if (!business) throw new Error('This business was not found, or your login cannot open it.');
    if (closed) return;
    adopt(business);
  }

  async function refresh(busy: () => boolean = () => false): Promise<RefreshResult> {
    const idle = () => !closed && !refreshing && !pending() && !busy();
    if (!idle()) return 'skipped';
    const before = generation;
    refreshing = true;
    let fresh: LoadedBusiness | null;
    try {
      fresh = await backend.loadBusiness(businessId);
    } catch {
      return 'failed';
    } finally {
      refreshing = false;
    }
    if (generation !== before || !idle()) return 'skipped';
    if (!fresh) return 'gone';
    // The same round trip load() makes, so this page's own saves coming back compare equal.
    if (fresh.name === name && syncer.matchesSaved(stateToRows(rowsToState(fresh)))) return 'unchanged';
    adopt(fresh);
    return 'changed';
  }

  return {
    load,
    changed() {
      generation++;
      syncer.changed();
    },
    async importData(data: ImportedData) {
      importing = true;
      try {
        await backend.importFile(businessId, parseExportFile(data));
        await load();
      } finally {
        importing = false;
      }
    },
    businessName: () => name,
    pending,
    refresh,
    close() {
      closed = true;
      generation++;
      syncer.stop();
    },
  };
}
