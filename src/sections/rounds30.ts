// The 30-Day To-Do's tab: one tab per round, its tasks, statuses, "Push →", the round's coaching
// notes, renaming, and the New Round dialog (#modal-overlay). The last round is the active one.

import { byId } from '../dom.ts';
import { initDragTable } from '../drag.ts';
import { openEditModal } from '../edit-modal.ts';
import { state } from '../state.ts';
import { updateStats } from '../stats.ts';
import { save } from '../storage.ts';
import type { Item, Status } from '../types.ts';
import { badgeFor, playBing, showToast } from '../ui.ts';

export function render30(): void {
  const tabsEl = byId('round-tabs');
  const panelsEl = byId('round-panels');
  tabsEl.innerHTML = ''; panelsEl.innerHTML = '';
  if (!state.rounds.length) { panelsEl.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No rounds yet.</p></div>`; return; }
  const activeRound = state.rounds[state.rounds.length - 1];
  const hintEl = document.getElementById('round-rename-hint');
  if (hintEl) hintEl.style.display = 'block';
  state.rounds.forEach((round) => {
    const isActive = round.id === activeRound.id;
    const tab = document.createElement('div');
    tab.className = `round-tab ${isActive ? 'active' : ''} ${round.current ? 'current' : ''}`;
    tab.textContent = round.label; tab.title = 'Double-click to rename';
    tab.onclick = () => switchRound(round.id);
    tab.ondblclick = (e) => { e.stopPropagation(); renameRound(round.id); };
    tab.id = `tab-${round.id}`;
    tabsEl.appendChild(tab);
    const done = round.tasks.filter((t) => t.status === 'complete').length;
    const pct = round.tasks.length ? Math.round(done / round.tasks.length * 100) : 0;
    const panel = document.createElement('div');
    panel.id = `panel-${round.id}`;
    panel.className = `round-panel ${isActive ? 'active' : ''}`;
    panel.innerHTML = `<div class="card"><div class="card-header" style="justify-content:space-between;"><div style="display:flex;align-items:center;gap:10px"><span class="icon">✅</span><h2>${round.label} — ${round.period}</h2></div><div style="display:flex;gap:6px;align-items:center;"><button class="btn btn-sm print-period-btn" onclick="printRound30(${round.id})" title="Print this round">🖨 Print</button><button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);font-size:12px;" onclick="addTask30(${round.id})">＋ Add Task</button></div></div><div class="progress-wrap"><div class="progress-label"><span>Progress</span><span id="prog-30-text-${round.id}">${done} of ${round.tasks.length} complete</span></div><div class="progress-bar"><div class="progress-fill" id="prog-30-bar-${round.id}" style="width:${pct}%"></div></div></div><table class="priority-table"><thead><tr><th style="width:20px"></th><th>Status</th><th>What</th><th style="width:100px">Who</th><th style="width:110px">By When</th><th style="width:80px">Actions</th></tr></thead><tbody id="tasks-${round.id}"></tbody></table><div class="status-legend"><span class="legend-item"><span class="legend-dot dot-on-track"></span> On Track</span><span class="legend-item"><span class="legend-dot dot-off-track"></span> Off Track</span><span class="legend-item"><span class="legend-dot dot-complete"></span> Complete</span><span style="margin-left:auto;font-size:11px;color:var(--grey-light)">💡 Use "Push →" on incomplete tasks to carry into next round</span></div><div style="padding:16px 20px;border-top:1px solid var(--border)"><label style="font-size:12px;font-weight:600;color:var(--grey-dark);display:block;margin-bottom:6px">Coaching session notes for this round</label><textarea class="coaching-area" id="notes-${round.id}" placeholder="Notes from the coaching session reviewing this round…" oninput="saveRoundNotes(${round.id})">${round.notes || ''}</textarea></div></div>`;
    panelsEl.appendChild(panel);
    renderRoundTasks(round.id);
  });
  updateStats();
}

export function renderRoundTasks(roundId: number): void {
  const round = state.rounds.find((r) => r.id === roundId); if (!round) return;
  const tbody = document.getElementById(`tasks-${roundId}`); if (!tbody) return;
  tbody.innerHTML = '';
  let done = 0;
  round.tasks.forEach((t) => {
    if (t.status === 'complete') done++;
    const canPush = t.status !== 'complete' && !t.pushed;
    const pushBtn = canPush ? `<button class="push-btn" onclick="pushTask(${roundId},${t.id})">Push →</button>` : t.pushed ? `<span class="push-btn pushed">Pushed ✓</span>` : '';
    const tr = document.createElement('tr');
    tr.className = t.status === 'complete' ? 'status-complete' : t.status === 'off-track' ? 'status-off-track' : '';
    tr.setAttribute('draggable', 'true'); tr.setAttribute('data-id', String(t.id));
    tr.innerHTML = `<td style="width:20px;cursor:grab;color:var(--grey-light);font-size:16px;text-align:center" class="drag-handle">⠿</td><td><div class="status-btns"><button class="status-btn ${t.status === 'on-track' ? 'active-on-track' : ''}" onclick="setStatus30(${roundId},${t.id},'on-track')">✓ On Track</button><button class="status-btn ${t.status === 'off-track' ? 'active-off-track' : ''}" onclick="setStatus30(${roundId},${t.id},'off-track')">✗ Off Track</button><button class="status-btn ${t.status === 'complete' ? 'active-complete' : ''}" onclick="setStatus30(${roundId},${t.id},'complete')">★ Complete</button></div></td><td class="${t.status === 'complete' ? 'task-text' : ''}">${t.what}${t.pushed ? '<span class="pushed-label">Pushed →</span>' : ''}</td><td>${badgeFor(t.who)}</td><td style="font-size:12px;color:var(--grey-light);white-space:nowrap">${t.when}</td><td style="display:flex;gap:4px;align-items:center;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="editItem30(${roundId},${t.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="deleteTask30(${roundId},${t.id})">🗑</button>${pushBtn}</td>`;
    tbody.appendChild(tr);
  });
  const pct = round.tasks.length ? Math.round(done / round.tasks.length * 100) : 0;
  const barEl = document.getElementById(`prog-30-bar-${roundId}`);
  const txtEl = document.getElementById(`prog-30-text-${roundId}`);
  if (barEl) barEl.style.width = pct + '%';
  if (txtEl) txtEl.textContent = `${done} of ${round.tasks.length} complete`;
  updateStats();
  initDragTable(`tasks-${roundId}`, 'tasks30', roundId);
}

/** A status button. Clicking the active status sets it back to 'none'. */
export function setStatus30(roundId: number, taskId: number, status: Status): void {
  const round = state.rounds.find((r) => r.id === roundId); if (!round) return;
  const t = round.tasks.find((x) => x.id === taskId);
  if (t) { const wasComplete = t.status !== 'complete'; t.status = t.status === status ? 'none' : status; if (status === 'complete' && wasComplete && t.status === 'complete') playBing(); save(); renderRoundTasks(roundId); }
}

/** Clicking a round tab. It clears every .round-tab and .round-panel, the 120-day ones included. */
function switchRound(id: number): void {
  document.querySelectorAll('.round-tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.round-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`tab-${id}`)?.classList.add('active');
  document.getElementById(`panel-${id}`)?.classList.add('active');
}

/** The round's coaching notes box; saves on every keystroke. */
export function saveRoundNotes(roundId: number): void {
  const round = state.rounds.find((r) => r.id === roundId);
  if (round) { round.notes = byId<HTMLTextAreaElement>(`notes-${roundId}`).value; save(); }
}

/** "Push →": copy the task into the next round, or queue it until one is created. */
export function pushTask(roundId: number, taskId: number): void {
  const round = state.rounds.find((r) => r.id === roundId); if (!round) return;
  const t = round.tasks.find((x) => x.id === taskId); if (!t) return;
  t.pushed = true;
  const roundIdx = state.rounds.findIndex((r) => r.id === roundId);
  const nextRound = state.rounds[roundIdx + 1];
  if (nextRound) {
    const newId = Math.max(...nextRound.tasks.map((x) => x.id), 0) + 1;
    nextRound.tasks.push({ id: newId, what: t.what, who: t.who, when: t.when, status: 'none', pushed: false, carriedFrom: round.label });
    save(); renderRoundTasks(roundId); renderRoundTasks(nextRound.id); showToast(`Task carried into "${nextRound.label}" ✓`);
  } else {
    if (!state.pendingPushes) state.pendingPushes = [];
    state.pendingPushes.push({ what: t.what, who: t.who, when: t.when, fromRound: round.label });
    save(); renderRoundTasks(roundId); showToast('Task will be added to the next new round you create ✓');
  }
}

export function addTask30(roundId: number): void {
  openEditModal(
    'Add Task',
    `<div class="edit-field"><label>What</label><textarea id="ef-what" style="min-height:80px" placeholder="Describe the task…"></textarea></div><div class="edit-field"><label>Who</label><input id="ef-who" placeholder="e.g. Newms, Ommers" list="who-suggestions"></div><div class="edit-field"><label>By When</label><input id="ef-when" placeholder="e.g. 31 May 2026"></div>`,
    ({ what, who, when }) => {
      const round = state.rounds.find((r) => r.id === roundId);
      if (round) { const newId = Math.max(...round.tasks.map((x) => x.id), 0) + 1; round.tasks.push({ id: newId, what, who, when, status: 'none', pushed: false }); }
      save(); renderRoundTasks(roundId);
    },
  );
}

export function deleteTask30(roundId: number, taskId: number): void {
  if (!confirm('Delete this task?')) return;
  const round = state.rounds.find((r) => r.id === roundId);
  if (round) round.tasks = round.tasks.filter((t) => t.id !== taskId);
  save(); renderRoundTasks(roundId);
}

export function editItem30(roundId: number, taskId: number): void {
  const round = state.rounds.find((r) => r.id === roundId); if (!round) return;
  const t = round.tasks.find((x) => x.id === taskId); if (!t) return;
  openEditModal(
    'Edit 30-Day Task',
    `<div class="edit-field"><label>What</label><textarea id="ef-what" style="min-height:80px">${t.what}</textarea></div><div class="edit-field"><label>Who</label><input id="ef-who" value="${t.who}" placeholder="e.g. Newms, Ommers" list="who-suggestions"></div><div class="edit-field"><label>By When</label><input id="ef-when" value="${t.when}"></div>`,
    ({ what, who, when }) => {
      const round = state.rounds.find((r) => r.id === roundId);
      if (round) { const t = round.tasks.find((x) => x.id === taskId); if (t) { t.what = what; t.who = who; t.when = when; } }
      save(); renderRoundTasks(roundId);
    },
  );
}

/** Double-clicking a round tab. */
function renameRound(roundId: number): void {
  const round = state.rounds.find((r) => r.id === roundId); if (!round) return;
  openEditModal(
    'Rename Round',
    `<div class="edit-field"><label>Round Name</label><input id="ef-what" value="${round.label}"></div><div class="edit-field"><label>Date Range</label><input id="ef-when" value="${round.period}"></div>`,
    ({ what, when }) => {
      const round = state.rounds.find((r) => r.id === roundId);
      if (round) { round.label = what; if (when) round.period = when; }
      save(); render30();
    },
  );
}

// ---- The New Round dialog (#modal-overlay) ----

/** Ids of the dialog's rows. Kept up to date but not otherwise used. */
let tempTaskRows: number[] = [];
/** Numbers the rows of the New Round dialog. Unlike the New Period dialog, it never resets. */
let taskRowCounter = 0;

export function showNewRoundModal(): void {
  tempTaskRows = []; byId<HTMLInputElement>('new-round-label').value = ''; byId<HTMLInputElement>('new-round-period').value = ''; byId('task-rows').innerHTML = '';
  const pending = state.pendingPushes || [];
  const notice = byId('pushed-tasks-notice');
  if (pending.length > 0) { notice.style.display = 'block'; notice.innerHTML = `<strong>📋 ${pending.length} task${pending.length > 1 ? 's' : ''} will be carried over:</strong><ul style="margin-top:6px;padding-left:18px">${pending.map((p) => `<li>${p.what}</li>`).join('')}</ul>`; } else notice.style.display = 'none';
  addTaskRow(); addTaskRow(); addTaskRow();
  byId('modal-overlay').style.display = 'flex';
}

/** Closes the New Round dialog. */
export function closeModal(): void {
  byId('modal-overlay').style.display = 'none';
}

export function addTaskRow(): void {
  taskRowCounter++;
  const id = taskRowCounter;
  const div = document.createElement('div');
  div.className = 'form-row'; div.id = `trow-${id}`;
  div.innerHTML = `<input class="form-input" id="tw-${id}" placeholder="What needs to be done…"><input class="form-input" id="twho-${id}" placeholder="Who (e.g. Newms, Ommers)" list="who-suggestions"><input class="form-input" id="twhen-${id}" placeholder="By when"><button class="btn btn-danger btn-sm" onclick="removeTaskRow(${id})">✕</button>`;
  byId('task-rows').appendChild(div);
  tempTaskRows.push(id);
}

export function removeTaskRow(id: number): void {
  document.getElementById(`trow-${id}`)?.remove();
  tempTaskRows = tempTaskRows.filter((x) => x !== id);
}

/** The dialog's Create button: queued pushes first, then the filled-in rows. */
export function createRound(): void {
  const label = byId<HTMLInputElement>('new-round-label').value.trim();
  const period = byId<HTMLInputElement>('new-round-period').value.trim();
  if (!label) { alert('Please enter a round label.'); return; }
  const tasks: Item[] = []; let taskId = 1;
  (state.pendingPushes || []).forEach((p) => { tasks.push({ id: taskId++, what: p.what, who: p.who, when: p.when, status: 'none', pushed: false, carriedFrom: p.fromRound }); });
  document.querySelectorAll('#task-rows .form-row').forEach((row) => {
    const rowId = row.id.replace('trow-', '');
    const what = (document.getElementById(`tw-${rowId}`) as HTMLInputElement | null)?.value?.trim();
    const who = (document.getElementById(`twho-${rowId}`) as HTMLInputElement | null)?.value;
    const when = (document.getElementById(`twhen-${rowId}`) as HTMLInputElement | null)?.value?.trim();
    if (what) tasks.push({ id: taskId++, what, who: who || 'Team', when: when || 'TBC', status: 'none', pushed: false });
  });
  state.rounds.forEach((r) => r.current = false);
  state.rounds.push({ id: Date.now(), label, period: period || label, current: true, notes: '', tasks });
  state.pendingPushes = [];
  save(); closeModal(); render30();
}
