// The Coaching Sessions tab: the sessions table and the session dialog (#session-edit-overlay).

import { str, type Actions } from '../actions.ts';
import { byId } from '../dom.ts';
import { esc } from '../html.ts';
import { newId } from '../ids.ts';
import { state } from '../state.ts';
import { save } from '../persistence.ts';
import type { Session } from '../types.ts';
import { showToast } from '../ui.ts';

/** The session being edited, or null when adding a new one. */
let currentSessionId: string | null = null;
let isNewSession = false;

export function renderSessions(): void {
  const tbody = document.getElementById('sessions-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  state.sessions.forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${esc(s.date)}</strong>${s.done ? '<span class="session-done-badge">✓ Done</span>' : ''}</td><td>${esc(s.format)}</td><td>${esc(s.focus)}</td><td style="color:var(--grey-light);font-size:12px">${esc(s.notes)}</td><td><div class="session-row-actions"><button class="btn btn-ghost btn-sm" data-click="editSession" data-session-id="${esc(s.id)}">✏️ Edit</button></div></td>`;
    tbody.appendChild(tr);
  });
}

function showAddSessionModal(): void {
  isNewSession = true;
  currentSessionId = null;
  byId('session-edit-title').textContent = 'Add New Session';
  byId('session-delete-btn').style.display = 'none';
  byId('session-edit-fields').innerHTML = sessionFormHTML({ date: '', done: false, format: '', focus: '', notes: '' });
  byId('session-edit-overlay').classList.add('open');
}

function editSession(id: string): void {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return;
  isNewSession = false;
  currentSessionId = id;
  byId('session-edit-title').textContent = 'Edit Session';
  byId('session-delete-btn').style.display = 'inline-flex';
  byId('session-edit-fields').innerHTML = sessionFormHTML(s);
  byId('session-edit-overlay').classList.add('open');
}

function sessionFormHTML(s: Omit<Session, 'id'>): string {
  return `<div class="edit-field"><label>Date</label><input id="se-date" type="text" value="${esc(s.date || '')}" placeholder="e.g. 1 May 2026"></div><div class="edit-field"><label>Format</label><input id="se-format" type="text" value="${esc(s.format || '')}" placeholder="e.g. In-person, Teams, TBC"></div><div class="edit-field"><label>Focus / Topic</label><input id="se-focus" type="text" value="${esc(s.focus || '')}" placeholder="e.g. 30-Day Round 2 Review"></div><div class="edit-field"><label>Notes</label><textarea id="se-notes" style="min-height:80px">${esc(s.notes || '')}</textarea></div><div class="edit-field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;text-transform:none;letter-spacing:0;font-size:13px;font-weight:500;"><input type="checkbox" id="se-done" ${s.done ? 'checked' : ''} style="width:auto;accent-color:var(--lime)"> Mark as completed</label></div>`;
}

function saveSessionEdit(): void {
  const date = byId<HTMLInputElement>('se-date').value.trim();
  const format = byId<HTMLInputElement>('se-format').value.trim();
  const focus = byId<HTMLInputElement>('se-focus').value.trim();
  const notes = byId<HTMLTextAreaElement>('se-notes').value.trim();
  const done = byId<HTMLInputElement>('se-done').checked;
  if (!date || !focus) { alert('Please enter at least a date and focus.'); return; }
  if (isNewSession) {
    state.sessions.push({ id: newId(), date, format, focus, notes, done });
  } else {
    const s = state.sessions.find((x) => x.id === currentSessionId);
    if (s) { s.date = date; s.format = format; s.focus = focus; s.notes = notes; s.done = done; }
  }
  save();
  renderSessions();
  closeSessionEditModal();
  showToast(isNewSession ? 'Session added ✓' : 'Session updated ✓');
}

function deleteSession(): void {
  if (!confirm('Delete this session?')) return;
  state.sessions = state.sessions.filter((s) => s.id !== currentSessionId);
  save();
  renderSessions();
  closeSessionEditModal();
  showToast('Session deleted');
}

export function closeSessionEditModal(): void {
  byId('session-edit-overlay').classList.remove('open');
  currentSessionId = null;
  isNewSession = false;
}

/** The sessions buttons: Add Session, each row's Edit, and the session dialog. */
export const sessionsActions: Actions = {
  showAddSessionModal,
  editSession: (el) => editSession(str(el, 'sessionId')),
  saveSessionEdit,
  deleteSession,
  closeSessionEditModal,
};
