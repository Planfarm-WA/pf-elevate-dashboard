// Entry point, loaded by index.html. Loads the saved data, wires up the dialogs, renders every
// tab, and puts the functions that inline on*="..." handlers call on window.

import { installActions, mergeActions } from './actions.ts';
import { byId } from './dom.ts';
import { closeEditModal, editModalActions, saveEdit } from './edit-modal.ts';
import { exportData, importData, ioActions } from './io.ts';
import { navigationActions, showSection } from './navigation.ts';
import { printActions, printAll, printPeriod120, printRound30 } from './print.ts';
import {
  addOneYearTarget, blueprintActions, closeBpEditModal, deleteOneYearTarget, editBlueprint, editOneYearTarget,
  migrateOneYear, renderBlueprint, saveBpEdit, toggleOneYearDone, toggleThreeYearDone,
} from './sections/blueprint.ts';
import { renderIssues } from './sections/issues.ts';
import {
  add120TaskRow, addPriority120, closeNew120Modal, createPeriod120, deletePriority120, editItem120,
  periods120Actions, pushPriority120, remove120TaskRow, render120Periods, setStatus120, showNew120Modal,
} from './sections/periods120.ts';
import {
  addTask30, addTaskRow, closeModal, createRound, deleteTask30, editItem30, pushTask, removeTaskRow,
  render30, rounds30Actions, saveRoundNotes, setStatus30, showNewRoundModal,
} from './sections/rounds30.ts';
import {
  addNote, closeSessionEditModal, deleteSession, editSession, renderSessions, saveSessionEdit,
  sessionsActions, showAddSessionModal,
} from './sections/sessions.ts';
import { updateStats } from './stats.ts';
import { loadSaved, updateLastUpdatedDisplay } from './storage.ts';

loadSaved();

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

renderBlueprint();
render120Periods();
render30();
renderSessions();
renderIssues();
updateStats();
migrateOneYear(); // make sure 1-year targets are {text, done} objects
updateLastUpdatedDisplay();

// Buttons and inputs name their action in data-click / data-input / data-change attributes;
// one document listener per event type runs it (src/actions.ts). Exported for the tests.
export const actions = mergeActions(
  editModalActions, ioActions, navigationActions, printActions,
  blueprintActions, periods120Actions, rounds30Actions, sessionsActions,
);
installActions(actions);

// Inline handlers (on*="..." in index.html and in the sections' template strings) call these
// functions by name, but module code isn't global, so this puts them on window. The bridge test
// in tests/dashboard.test.ts fails if one is missing. Remove each entry once its handler moves to
// event delegation (CLAUDE.md to-do).
Object.assign(window, {
  add120TaskRow, addNote, addOneYearTarget, addPriority120, addTask30, addTaskRow,
  closeBpEditModal, closeEditModal, closeModal, closeNew120Modal, closeSessionEditModal,
  createPeriod120, createRound, deleteOneYearTarget, deletePriority120, deleteSession,
  deleteTask30, editBlueprint, editItem120, editItem30, editOneYearTarget, editSession,
  exportData, importData, printAll, printPeriod120, printRound30, pushPriority120, pushTask,
  remove120TaskRow, removeTaskRow, saveBpEdit, saveEdit, saveRoundNotes, saveSessionEdit,
  setStatus120, setStatus30, showAddSessionModal, showNew120Modal, showNewRoundModal,
  showSection, toggleOneYearDone, toggleThreeYearDone,
});
