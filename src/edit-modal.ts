// The shared edit dialog (#edit-overlay), used to add, edit and rename priorities, tasks,
// periods, rounds and 1-year targets.

import type { Actions } from './actions.ts';
import { byId } from './dom.ts';

/** What the dialog's fields held when Save was pressed. `who` and `when` are '' if absent. */
export interface EditValues {
  what: string;
  who: string;
  when: string;
}

/** Save logic of the open dialog, supplied by whoever opened it. */
let currentOnSave: ((values: EditValues) => void) | null = null;

/**
 * Open the dialog. `fieldsHtml` holds the inputs: always #ef-what, plus #ef-who and #ef-when when
 * the item has them. Save runs `onSave` and closes the dialog, unless "what" is empty.
 */
export function openEditModal(title: string, fieldsHtml: string, onSave: (values: EditValues) => void): void {
  currentOnSave = onSave;
  byId('edit-title').textContent = title;
  byId('edit-fields').innerHTML = fieldsHtml;
  byId('edit-overlay').classList.add('open');
}

/** The dialog's Save button. */
export function saveEdit(): void {
  const what = (document.getElementById('ef-what') as HTMLInputElement | null)?.value.trim();
  const whoEl = document.getElementById('ef-who') as HTMLInputElement | null;
  const whenEl = document.getElementById('ef-when') as HTMLInputElement | null;
  const who = whoEl ? whoEl.value.trim() : '';
  const when = whenEl ? whenEl.value.trim() : '';
  if (!what) return;
  currentOnSave?.({ what, who, when });
  closeEditModal();
}

/** Close the dialog without saving (Cancel, or a click outside it). */
export function closeEditModal(): void {
  byId('edit-overlay').classList.remove('open');
  currentOnSave = null;
}

/** The dialog's Save and Cancel buttons in index.html. */
export const editModalActions: Actions = { saveEdit, closeEditModal };
