// Starting the dashboard in one of its modes. main.ts picks the mode from the environment;
// the tests call startApp() directly (with a fake backend for Supabase mode).

import { installActions, mergeActions } from './actions.ts';
import type { Backend } from './backend.ts';
import { byId } from './dom.ts';
import { closeEditModal, editModalActions } from './edit-modal.ts';
import { ioActions } from './io.ts';
import { navigationActions } from './navigation.ts';
import { usePersistence } from './persistence.ts';
import { printActions } from './print.ts';
import { renderAll } from './render.ts';
import { blueprintActions, closeBpEditModal } from './sections/blueprint.ts';
import { closeNew120Modal, periods120Actions } from './sections/periods120.ts';
import { closeModal, rounds30Actions } from './sections/rounds30.ts';
import { closeSessionEditModal, sessionsActions } from './sections/sessions.ts';
import { sessionActions, showScreen, startSupabaseSession } from './session.ts';
import { localPersistence, updateLastUpdatedDisplay } from './storage.ts';

export type AppMode =
  /** localStorage only: development without Supabase settings, and the tests. */
  | { kind: 'local' }
  /** Log in, choose a business, and save to Supabase. */
  | { kind: 'supabase'; backend: Backend; timing?: { debounceMs?: number; retryMs?: number[] } }
  /** A production build without Supabase settings: show an error instead of quietly using localStorage. */
  | { kind: 'missing-config' };

// Buttons and inputs name their action in data-click / data-input / data-change / data-submit
// attributes, and one document listener per event type runs it (src/actions.ts). Each module
// exports its actions; a name registered twice throws here. Exported so the tests can check them.
export const actions = mergeActions(
  editModalActions, ioActions, navigationActions, printActions,
  blueprintActions, periods120Actions, rounds30Actions, sessionsActions, sessionActions,
);

export async function startApp(mode: AppMode): Promise<void> {
  // Clicking the dark backdrop around a dialog (not the dialog itself) closes it.
  const backdrops: Array<[overlayId: string, close: () => void]> = [
    ['edit-overlay', closeEditModal],
    ['bp-edit-overlay', closeBpEditModal],
    ['modal-overlay', closeModal],
    ['modal-120-overlay', closeNew120Modal],
    ['session-edit-overlay', closeSessionEditModal],
  ];
  for (const [overlayId, close] of backdrops) {
    byId(overlayId).addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
  }
  installActions(actions);

  if (mode.kind === 'local') {
    usePersistence(localPersistence);
    await localPersistence.load();
    renderAll();
    updateLastUpdatedDisplay();
    showScreen('dashboard');
  } else if (mode.kind === 'missing-config') {
    showScreen('config-error');
  } else {
    showScreen('login');
    await startSupabaseSession(mode.backend, mode.timing);
  }
}
