// The 120-Day Priorities tab: one tab per period, its priorities, statuses, "Push →", renaming,
// and the New Period dialog (#modal-120-overlay). The last period is the active one.

import { num, oneOf, str, type Actions } from '../actions.ts';
import { byId } from '../dom.ts';
import { initDragTable } from '../drag.ts';
import { newId } from '../ids.ts';
import { openEditModal } from '../edit-modal.ts';
import { state } from '../state.ts';
import { updateStats } from '../stats.ts';
import { save } from '../storage.ts';
import { STATUSES, type Item, type Status } from '../types.ts';
import { badgeFor, playBing, showToast } from '../ui.ts';

export function render120Periods(): void {
  const tabsEl = document.getElementById('period-tabs-120');
  const panelsEl = document.getElementById('period-panels-120');
  if (!tabsEl || !panelsEl) return;
  tabsEl.innerHTML = ''; panelsEl.innerHTML = '';
  if (!state.periods120.length) { panelsEl.innerHTML = `<div class="empty-state"><div class="icon">⚡</div><p>No periods yet.</p></div>`; updateStats(); return; }
  const activePeriod = state.periods120[state.periods120.length - 1];
  byId('period-rename-hint').style.display = 'block';
  state.periods120.forEach((period) => {
    const isActive = period.id === activePeriod.id;
    const tab = document.createElement('div');
    tab.className = `round-tab ${isActive ? 'active' : ''} ${period.current ? 'current' : ''}`;
    tab.textContent = period.label; tab.title = 'Double-click to rename';
    tab.onclick = () => switch120Period(period.id);
    tab.ondblclick = (e) => { e.stopPropagation(); renamePeriod120(period.id); };
    tab.id = `ptab-${period.id}`;
    tabsEl.appendChild(tab);
    const done = period.priorities.filter((p) => p.status === 'complete').length;
    const pct = period.priorities.length ? Math.round(done / period.priorities.length * 100) : 0;
    const panel = document.createElement('div');
    panel.id = `ppanel-${period.id}`;
    panel.className = `round-panel ${isActive ? 'active' : ''}`;
    panel.innerHTML = `<div class="card"><div class="card-header" style="justify-content:space-between;"><div style="display:flex;align-items:center;gap:10px"><span class="icon">⚡</span><h2>${period.label} — ${period.period}</h2></div><div style="display:flex;gap:6px;align-items:center;"><button class="btn btn-sm print-period-btn" data-click="printPeriod120" data-period-id="${period.id}" title="Print this period">🖨 Print</button><button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);font-size:12px;" data-click="addPriority120" data-period-id="${period.id}">＋ Add Priority</button></div></div><div class="progress-wrap"><div class="progress-label"><span>Progress</span><span id="prog-120-text-${period.id}">${done} of ${period.priorities.length} complete</span></div><div class="progress-bar"><div class="progress-fill" id="prog-120-bar-${period.id}" style="width:${pct}%"></div></div></div><table class="priority-table"><thead><tr><th style="width:20px"></th><th>Status</th><th>What</th><th style="width:100px">Who</th><th style="width:100px">By When</th><th style="width:90px"></th></tr></thead><tbody id="body-120-${period.id}"></tbody></table><div class="status-legend"><span class="legend-item"><span class="legend-dot dot-on-track"></span> On Track</span><span class="legend-item"><span class="legend-dot dot-off-track"></span> Off Track</span><span class="legend-item"><span class="legend-dot dot-complete"></span> Complete</span><span style="margin-left:auto;font-size:11px;color:var(--grey-light)">💡 Use "Push →" to carry items into the next period</span></div></div>`;
    panelsEl.appendChild(panel);
    renderPeriodPriorities(period.id);
  });
  updateStats();
}

export function renderPeriodPriorities(periodId: string): void {
  const period = state.periods120.find((p) => p.id === periodId);
  if (!period) return;
  const tbody = document.getElementById(`body-120-${periodId}`);
  if (!tbody) return;
  tbody.innerHTML = '';
  let done = 0;
  period.priorities.forEach((p) => {
    if (p.status === 'complete') done++;
    const canPush = p.status !== 'complete' && !p.pushed;
    const pushBtn = canPush ? `<button class="push-btn" data-click="pushPriority120" data-period-id="${periodId}" data-item-id="${p.id}">Push →</button>` : p.pushed ? `<span class="push-btn pushed">Pushed ✓</span>` : '';
    const tr = document.createElement('tr');
    tr.className = p.status === 'complete' ? 'status-complete' : p.status === 'off-track' ? 'status-off-track' : '';
    tr.setAttribute('draggable', 'true'); tr.setAttribute('data-id', p.id);
    tr.innerHTML = `<td style="width:20px;cursor:grab;color:var(--grey-light);font-size:16px;text-align:center" class="drag-handle">⠿</td><td><div class="status-btns"><button class="status-btn ${p.status === 'on-track' ? 'active-on-track' : ''}" data-click="setStatus120" data-period-id="${periodId}" data-item-id="${p.id}" data-status="on-track">✓ On Track</button><button class="status-btn ${p.status === 'off-track' ? 'active-off-track' : ''}" data-click="setStatus120" data-period-id="${periodId}" data-item-id="${p.id}" data-status="off-track">✗ Off Track</button><button class="status-btn ${p.status === 'complete' ? 'active-complete' : ''}" data-click="setStatus120" data-period-id="${periodId}" data-item-id="${p.id}" data-status="complete">★ Complete</button></div></td><td class="${p.status === 'complete' ? 'task-text' : ''}">${p.what}${p.pushed ? '<span class="pushed-label">Pushed →</span>' : ''}</td><td>${badgeFor(p.who)}</td><td style="font-size:12px;color:var(--grey-light);white-space:nowrap">${p.when}</td><td style="display:flex;gap:4px;align-items:center;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" data-click="editItem120" data-period-id="${periodId}" data-item-id="${p.id}">✏️</button><button class="btn btn-danger btn-sm" data-click="deletePriority120" data-period-id="${periodId}" data-item-id="${p.id}">🗑</button>${pushBtn}</td>`;
    tbody.appendChild(tr);
  });
  const pct = period.priorities.length ? Math.round(done / period.priorities.length * 100) : 0;
  const bar = document.getElementById(`prog-120-bar-${periodId}`);
  const txt = document.getElementById(`prog-120-text-${periodId}`);
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = `${done} of ${period.priorities.length} complete`;
  initDragTable(`body-120-${periodId}`, 'priorities120', periodId);
}

function switch120Period(id: string): void {
  document.querySelectorAll('#period-tabs-120 .round-tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('#period-panels-120 .round-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`ptab-${id}`)?.classList.add('active');
  document.getElementById(`ppanel-${id}`)?.classList.add('active');
}

/** A status button. Clicking the active status sets it back to 'none'. */
function setStatus120(periodId: string, itemId: string, status: Status): void {
  const period = state.periods120.find((p) => p.id === periodId); if (!period) return;
  const p = period.priorities.find((x) => x.id === itemId); if (!p) return;
  const wasComplete = p.status !== 'complete';
  p.status = p.status === status ? 'none' : status;
  if (status === 'complete' && wasComplete && p.status === 'complete') playBing();
  save(); renderPeriodPriorities(periodId); updateStats();
}

/** "Push →": copy the priority into the next period, or queue it until one is created. */
function pushPriority120(periodId: string, itemId: string): void {
  const period = state.periods120.find((p) => p.id === periodId); if (!period) return;
  const item = period.priorities.find((x) => x.id === itemId); if (!item) return;
  item.pushed = true;
  const idx = state.periods120.findIndex((p) => p.id === periodId);
  const next = state.periods120[idx + 1];
  if (next) {
    next.priorities.push({ id: newId(), what: item.what, who: item.who, when: item.when, status: 'none', pushed: false, carriedFrom: period.label });
    save(); renderPeriodPriorities(periodId); renderPeriodPriorities(next.id); showToast(`Priority carried into "${next.label}" ✓`);
  } else {
    if (!state.pendingPushes120) state.pendingPushes120 = [];
    state.pendingPushes120.push({ what: item.what, who: item.who, when: item.when, fromPeriod: period.label });
    save(); renderPeriodPriorities(periodId); showToast('Priority will be added to the next new period you create ✓');
  }
}

function editItem120(periodId: string, itemId: string): void {
  const period = state.periods120.find((p) => p.id === periodId); if (!period) return;
  const p = period.priorities.find((x) => x.id === itemId); if (!p) return;
  openEditModal(
    'Edit 120-Day Priority',
    `<div class="edit-field"><label>What</label><textarea id="ef-what" style="min-height:80px">${p.what}</textarea></div><div class="edit-field"><label>Who</label><input id="ef-who" value="${p.who}" placeholder="e.g. Newms, Ommers" list="who-suggestions"></div><div class="edit-field"><label>By When</label><input id="ef-when" value="${p.when}"></div>`,
    ({ what, who, when }) => {
      const period = state.periods120.find((p) => p.id === periodId);
      if (period) { const p = period.priorities.find((x) => x.id === itemId); if (p) { p.what = what; p.who = who; p.when = when; } }
      save(); renderPeriodPriorities(periodId);
    },
  );
}

function addPriority120(periodId: string): void {
  openEditModal(
    'Add 120-Day Priority',
    `<div class="edit-field"><label>What</label><textarea id="ef-what" style="min-height:80px" placeholder="Describe the priority action…"></textarea></div><div class="edit-field"><label>Who</label><input id="ef-who" placeholder="e.g. Newms, Ommers" list="who-suggestions"></div><div class="edit-field"><label>By When</label><input id="ef-when" placeholder="e.g. Jun 2026"></div>`,
    ({ what, who, when }) => {
      const period = state.periods120.find((p) => p.id === periodId);
      if (period) { period.priorities.push({ id: newId(), what, who, when, status: 'none', pushed: false }); }
      save(); renderPeriodPriorities(periodId); updateStats();
    },
  );
}

function deletePriority120(periodId: string, itemId: string): void {
  if (!confirm('Delete this priority?')) return;
  const period = state.periods120.find((p) => p.id === periodId);
  if (period) period.priorities = period.priorities.filter((x) => x.id !== itemId);
  save(); renderPeriodPriorities(periodId); updateStats();
}

/** Double-clicking a period tab. */
function renamePeriod120(periodId: string): void {
  const period = state.periods120.find((p) => p.id === periodId); if (!period) return;
  openEditModal(
    'Rename Period',
    `<div class="edit-field"><label>Period Name</label><input id="ef-what" value="${period.label}"></div><div class="edit-field"><label>Date Range</label><input id="ef-when" value="${period.period}"></div>`,
    ({ what, when }) => {
      const period = state.periods120.find((p) => p.id === periodId);
      if (period) { period.label = what; if (when) period.period = when; }
      save(); render120Periods();
    },
  );
}

// ---- The New Period dialog (#modal-120-overlay) ----

/** Numbers the rows of the New Period dialog; reset each time it opens. */
let taskRows120Counter = 0;

function showNew120Modal(): void {
  byId<HTMLInputElement>('new-120-label').value = ''; byId<HTMLInputElement>('new-120-period').value = ''; byId<HTMLTextAreaElement>('new-120-targets').value = ''; byId('task-rows-120').innerHTML = ''; taskRows120Counter = 0;
  const pending = state.pendingPushes120 || [];
  const notice = byId('pushed-120-notice');
  if (pending.length > 0) { notice.style.display = 'block'; notice.innerHTML = `<strong>📋 ${pending.length} priorit${pending.length > 1 ? 'ies' : 'y'} will be carried over:</strong><ul style="margin-top:6px;padding-left:18px">${pending.map((p) => `<li>${p.what}</li>`).join('')}</ul>`; } else notice.style.display = 'none';
  add120TaskRow(); add120TaskRow(); add120TaskRow();
  byId('modal-120-overlay').style.display = 'flex';
}

export function closeNew120Modal(): void {
  byId('modal-120-overlay').style.display = 'none';
}

function add120TaskRow(): void {
  taskRows120Counter++;
  const id = taskRows120Counter;
  const div = document.createElement('div');
  div.className = 'form-row'; div.id = `trow120-${id}`;
  div.innerHTML = `<input class="form-input" id="t120w-${id}" placeholder="Priority action…"><input class="form-input" id="t120who-${id}" placeholder="Who (e.g. Newms, Ommers)" list="who-suggestions"><input class="form-input" id="t120when-${id}" placeholder="By when"><button class="btn btn-danger btn-sm" data-click="remove120TaskRow" data-row="${id}">✕</button>`;
  byId('task-rows-120').appendChild(div);
}

function remove120TaskRow(id: number): void {
  document.getElementById(`trow120-${id}`)?.remove();
}

/** The dialog's Create button: queued pushes first, then the filled-in rows. */
function createPeriod120(): void {
  const label = byId<HTMLInputElement>('new-120-label').value.trim();
  const period = byId<HTMLInputElement>('new-120-period').value.trim();
  const targetsRaw = byId<HTMLTextAreaElement>('new-120-targets').value.trim();
  if (!label) { alert('Please enter a period label.'); return; }
  const oneyear = targetsRaw ? targetsRaw.split('\n').map((v) => v.trim()).filter(Boolean) : [];
  const priorities: Item[] = [];
  (state.pendingPushes120 || []).forEach((p) => { priorities.push({ id: newId(), what: p.what, who: p.who, when: p.when, status: 'none', pushed: false, carriedFrom: p.fromPeriod }); });
  document.querySelectorAll('#task-rows-120 .form-row').forEach((row) => {
    const rowId = row.id.replace('trow120-', '');
    const what = (document.getElementById(`t120w-${rowId}`) as HTMLInputElement | null)?.value?.trim();
    const who = (document.getElementById(`t120who-${rowId}`) as HTMLInputElement | null)?.value;
    const when = (document.getElementById(`t120when-${rowId}`) as HTMLInputElement | null)?.value?.trim();
    if (what) priorities.push({ id: newId(), what, who: who || 'Team', when: when || 'TBC', status: 'none', pushed: false });
  });
  state.periods120.forEach((p) => p.current = false);
  state.periods120.push({ id: newId(), label, period: period || label, current: true, oneyear, priorities });
  state.pendingPushes120 = [];
  save(); closeNew120Modal(); render120Periods(); showToast(`Period "${label}" created ✓`);
}

/** The 120-day buttons: on each period's card and priority row, and in the New Period dialog. */
export const periods120Actions: Actions = {
  addPriority120: (el) => addPriority120(str(el, 'periodId')),
  editItem120: (el) => editItem120(str(el, 'periodId'), str(el, 'itemId')),
  deletePriority120: (el) => deletePriority120(str(el, 'periodId'), str(el, 'itemId')),
  pushPriority120: (el) => pushPriority120(str(el, 'periodId'), str(el, 'itemId')),
  setStatus120: (el) => setStatus120(str(el, 'periodId'), str(el, 'itemId'), oneOf(el, 'status', STATUSES)),
  showNew120Modal,
  closeNew120Modal,
  add120TaskRow,
  remove120TaskRow: (el) => remove120TaskRow(num(el, 'row')),
  createPeriod120,
};
