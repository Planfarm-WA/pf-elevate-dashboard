// The Farm Blueprint tab: 10-Year Direction, 3-Year Picture, Core Values, 1-Year Targets and
// Purpose, plus the blueprint text dialog (#bp-edit-overlay), which also edits the issues list.

import { num, oneOf, type Actions } from '../actions.ts';
import { byId } from '../dom.ts';
import { initDragList } from '../drag.ts';
import { openEditModal } from '../edit-modal.ts';
import { state } from '../state.ts';
import { save } from '../storage.ts';
import type { OneYearTarget } from '../types.ts';
import { playBing } from '../ui.ts';
import { renderIssues } from './issues.ts';

/** The parts of the blueprint that the text dialog edits. */
const BP_SECTIONS = ['tenyear', 'threeyear', 'values', 'purpose', 'issues'] as const;
type BpSection = (typeof BP_SECTIONS)[number];
/** The parts stored as one block of text. */
type BpTextSection = 'tenyear' | 'threeyear' | 'purpose';

function isTextSection(section: BpSection | null): section is BpTextSection {
  return section === 'tenyear' || section === 'threeyear' || section === 'purpose';
}

export function renderBlueprint(): void {
  const bp = state.blueprint;
  byId('bp-tenyear-body').innerHTML = bp.tenyear.split('\n\n').map((p) => `<p>${p}</p>`).join('');
  renderThreeYearTargets();
  byId('bp-purpose-body').innerHTML = `<p>${bp.purpose}</p>`;
  byId('bp-values-body').innerHTML = bp.values.map((v) => `<span class="value-pill">${v}</span>`).join('');
  renderOneYearTargets();
}

/** Convert 1-year targets saved as plain strings (older data) into {text, done} objects. */
export function migrateOneYear(): void {
  const items = (state.blueprint.oneyear || []) as Array<OneYearTarget | string>;
  state.blueprint.oneyear = items.map((item) => typeof item === 'string' ? { text: item, done: false } : item);
}

// ---- 1-year targets ----

export function renderOneYearTargets(): void {
  migrateOneYear();
  const oneEl = document.getElementById('bp-oneyear-body');
  if (!oneEl) return;
  const targets = state.blueprint.oneyear || [];
  if (!targets.length) { oneEl.innerHTML = `<p style="color:var(--grey-light);font-style:italic">No targets set yet.</p>`; return; }
  oneEl.innerHTML = `<ul id="oneyear-list" style="list-style:none;padding:0;margin:0">${targets.map((item, idx) => {
    const done = item.done || false;
    return `<li data-idx="${idx}" draggable="true" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);${done ? 'opacity:0.6' : ''}">
      <span class="drag-handle" title="Drag to reorder" style="flex-shrink:0">⠿</span>
      <button data-click="toggleOneYearDone" data-idx="${idx}" title="${done ? 'Mark incomplete' : 'Mark complete'}" style="flex-shrink:0;width:22px;height:22px;border-radius:50%;border:2px solid ${done ? 'var(--lime)' : 'var(--teal-mid)'};background:${done ? 'var(--lime)' : 'white'};cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:all 0.15s;">${done ? '<span style="color:white;font-size:13px;line-height:1">✓</span>' : ''}</button>
      <span style="flex:1;font-size:14px;color:var(--grey-mid);line-height:1.5;${done ? 'text-decoration:line-through' : ''}">${item.text}</span>
      <button class="btn btn-ghost btn-sm" data-click="editOneYearTarget" data-idx="${idx}" style="flex-shrink:0">✏️</button>
      <button class="btn btn-danger btn-sm" data-click="deleteOneYearTarget" data-idx="${idx}" style="flex-shrink:0">🗑</button>
    </li>`;
  }).join('')}</ul>`;
  initDragList('oneyear-list', 'oneyear');
}

export function toggleOneYearDone(idx: number): void {
  migrateOneYear();
  const item = state.blueprint.oneyear[idx];
  if (!item) return;
  const wasDone = item.done;
  item.done = !item.done;
  if (!wasDone && item.done) playBing();
  save();
  renderOneYearTargets();
}

export function addOneYearTarget(): void {
  openEditModal(
    'Add 1-Year Target',
    `<div class="edit-field"><label>Target</label><textarea id="ef-what" style="min-height:80px" placeholder="Describe the target…"></textarea></div>`,
    ({ what }) => {
      migrateOneYear();
      state.blueprint.oneyear.push({ text: what, done: false });
      save();
      renderOneYearTargets();
    },
  );
}

export function editOneYearTarget(idx: number): void {
  migrateOneYear();
  const item = state.blueprint.oneyear[idx];
  openEditModal(
    'Edit 1-Year Target',
    `<div class="edit-field"><label>Target</label><textarea id="ef-what" style="min-height:80px">${item.text || item}</textarea></div>`,
    ({ what }) => {
      migrateOneYear();
      const oi = state.blueprint.oneyear[idx];
      if (oi) oi.text = what;
      save();
      renderOneYearTargets();
    },
  );
}

export function deleteOneYearTarget(idx: number): void {
  if (!confirm('Delete this target?')) return;
  state.blueprint.oneyear.splice(idx, 1);
  save();
  renderOneYearTargets();
}

// ---- 3-year picture ----

export function renderThreeYearTargets(): void {
  const el = document.getElementById('bp-threeyear-body');
  if (!el) return;
  const text = state.blueprint.threeyear || '';
  if (!state.blueprint.threeyearDone) state.blueprint.threeyearDone = {};
  const doneByIdx = state.blueprint.threeyearDone;
  const lines = text.split('\n\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) { el.innerHTML = '<p style="color:var(--grey-light);font-style:italic">No items yet.</p>'; return; }
  el.innerHTML = '<ul style="list-style:none;padding:0;margin:0">' + lines.map((line, idx) => {
    const done = !!doneByIdx[idx];
    return `<li style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);${done ? 'opacity:0.6' : ''}">
      <button data-click="toggleThreeYearDone" data-idx="${idx}" title="${done ? 'Mark incomplete' : 'Mark complete'}" style="flex-shrink:0;margin-top:2px;width:22px;height:22px;border-radius:50%;border:2px solid ${done ? 'var(--lime)' : 'var(--teal-mid)'};background:${done ? 'var(--lime)' : 'white'};cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:all 0.15s;">${done ? '<span style="color:white;font-size:13px;line-height:1">✓</span>' : ''}</button>
      <span style="flex:1;font-size:14px;color:var(--grey-mid);line-height:1.6;${done ? 'text-decoration:line-through' : ''}">${line}</span>
    </li>`;
  }).join('') + '</ul>';
}

export function toggleThreeYearDone(idx: number): void {
  if (!state.blueprint.threeyearDone) state.blueprint.threeyearDone = {};
  const doneByIdx = state.blueprint.threeyearDone;
  const wasDone = !!doneByIdx[idx];
  doneByIdx[idx] = !wasDone;
  if (!wasDone) playBing();
  save();
  renderThreeYearTargets();
}

// ---- The blueprint text dialog (#bp-edit-overlay) ----

/** The part of the blueprint the dialog is editing. */
let currentBpSection: BpSection | null = null;

export function editBlueprint(section: BpSection): void {
  currentBpSection = section;
  const bp = state.blueprint;
  const titles: Record<BpSection, string> = { tenyear: '10-Year Direction', threeyear: '3-Year Picture', values: 'Core Values', purpose: 'Our Purpose', issues: 'Issues & Opportunities' };
  byId('bp-edit-title').textContent = 'Edit: ' + titles[section];
  const fieldsEl = byId('bp-edit-fields');
  if (isTextSection(section)) {
    fieldsEl.innerHTML = `<div class="edit-field"><label>Content (use blank lines to separate paragraphs)</label><textarea id="bp-edit-val" style="min-height:180px">${bp[section]}</textarea></div>`;
  } else if (section === 'values') {
    fieldsEl.innerHTML = `<div class="edit-field"><label>Values (one per line)</label><textarea id="bp-edit-val" style="min-height:140px">${bp.values.join('\n')}</textarea></div>`;
  } else if (section === 'issues') {
    fieldsEl.innerHTML = `<div class="edit-field"><label>Issues &amp; Opportunities (one per line — prefix with OPPORTUNITY: for green highlight)</label><textarea id="bp-edit-val" style="min-height:200px">${bp.issues.join('\n')}</textarea></div>`;
  }
  byId('bp-edit-overlay').classList.add('open');
}

export function saveBpEdit(): void {
  const val = byId<HTMLTextAreaElement>('bp-edit-val').value.trim();
  const bp = state.blueprint;
  if (isTextSection(currentBpSection)) { bp[currentBpSection] = val; if (currentBpSection === 'threeyear') bp.threeyearDone = {}; }
  else if (currentBpSection === 'values') { bp.values = val.split('\n').map((v) => v.trim()).filter(Boolean); }
  else if (currentBpSection === 'issues') { bp.issues = val.split('\n').map((v) => v.trim()).filter(Boolean); }
  save();
  renderBlueprint();
  renderIssues();
  closeBpEditModal();
}

export function closeBpEditModal(): void {
  byId('bp-edit-overlay').classList.remove('open');
  currentBpSection = null;
}

/** The blueprint's buttons: the Edit buttons and dialog in index.html, and the target lists above. */
export const blueprintActions: Actions = {
  editBlueprint: (el) => editBlueprint(oneOf(el, 'section', BP_SECTIONS)),
  saveBpEdit,
  closeBpEditModal,
  addOneYearTarget,
  toggleOneYearDone: (el) => toggleOneYearDone(num(el, 'idx')),
  editOneYearTarget: (el) => editOneYearTarget(num(el, 'idx')),
  deleteOneYearTarget: (el) => deleteOneYearTarget(num(el, 'idx')),
  toggleThreeYearDone: (el) => toggleThreeYearDone(num(el, 'idx')),
};
