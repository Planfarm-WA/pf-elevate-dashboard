// Keeping the dashboard in Supabase: load one business into `state`, then sync every change back
// as row-level writes (sync.ts). Used once someone has logged in and opened a business.

import { parseExportFile } from './adapters.ts';
import type { Backend } from './backend.ts';
import type { ImportedData, Persistence } from './persistence.ts';
import { rowsToState, stateToRows } from './rows.ts';
import { state } from './state.ts';
import { createSyncer, type SyncStatus } from './sync.ts';

export interface SupabasePersistence extends Persistence {
  /** The open business's name (after load()). */
  businessName(): string;
  /** True while changes haven't reached the database yet. */
  pending(): boolean;
}

export function createSupabasePersistence(
  backend: Backend,
  businessId: string,
  onStatus: (status: SyncStatus) => void,
  timing: { debounceMs?: number; retryMs?: number[] } = {},
): SupabasePersistence {
  let name = '';
  const syncer = createSyncer({
    snapshot: () => stateToRows(state),
    apply: (ops) => backend.apply(businessId, ops),
    onStatus,
    ...timing,
  });

  async function load(): Promise<void> {
    const business = await backend.loadBusiness(businessId);
    name = business.name;
    Object.assign(state, rowsToState(business));
    syncer.reset(stateToRows(state));
  }

  return {
    load,
    changed: () => syncer.changed(),
    async importData(data: ImportedData) {
      await backend.importFile(businessId, parseExportFile(data));
      await load();
    },
    businessName: () => name,
    pending: () => syncer.pending(),
  };
}
