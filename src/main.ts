// Entry point, loaded by index.html. Chooses where data is kept, wires up the dialogs and the
// event delegation, then loads the data and renders every tab.

import { installActions, mergeActions } from './actions.ts';
import { byId } from './dom.ts';
import { closeEditModal, editModalActions } from './edit-modal.ts';
import { ioActions } from './io.ts';
import { navigationActions } from './navigation.ts';
import { persistence, usePersistence } from './persistence.ts';
import { printActions } from './print.ts';
import { blueprintActions, closeBpEditModal, migrateOneYear, renderBlueprint } from './sections/blueprint.ts';
import { renderIssues } from './sections/issues.ts';
import { closeNew120Modal, periods120Actions, render120Periods } from './sections/periods120.ts';
import { closeModal, render30, rounds30Actions } from './sections/rounds30.ts';
import { closeSessionEditModal, renderSessions, sessionsActions } from './sections/sessions.ts';
import { updateStats } from './stats.ts';
import { localPersistence, updateLastUpdatedDisplay } from './storage.ts';

usePersistence(localPersistence);

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

// Buttons and inputs name their action in data-click / data-input / data-change attributes, and
// one document listener per event type runs it (src/actions.ts). Each module exports its actions;
// a name registered twice throws here. Exported so the tests can check every action is used.
export const actions = mergeActions(
  editModalActions, ioActions, navigationActions, printActions,
  blueprintActions, periods120Actions, rounds30Actions, sessionsActions,
);
installActions(actions);

/** Load the data, then draw every tab. */
async function start(): Promise<void> {
  await persistence().load();
  renderBlueprint();
  render120Periods();
  render30();
  renderSessions();
  renderIssues();
  updateStats();
  migrateOneYear(); // make sure 1-year targets are {text, done} objects
  updateLastUpdatedDisplay();
}

/** Resolves once the page has loaded its data and drawn it (the tests wait for this). */
export const ready = start();
