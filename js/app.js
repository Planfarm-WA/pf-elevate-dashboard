const WHO_OPTIONS = ['Person A','Person B','Advisor','Team'];

const state = {
  "periods120": [],
  "rounds": [],
  "sessions": [],
  "blueprint": {
    "tenyear": "",
    "threeyear": "",
    "values": [],
    "oneyear": [],
    "purpose": "",
    "issues": []
  },
  "pendingPushes": [],
  "pendingPushes120": []
};

function save() {
  try {
    state.lastUpdated = new Date().toISOString();
    localStorage.setItem('pf_elevate_blank1', JSON.stringify(state));
    updateLastUpdatedDisplay();
  } catch (err) {
    console.error('Could not save to localStorage', err);
  }
}

function updateLastUpdatedDisplay() {
  const el = document.getElementById('last-updated-display');
  if (!el) return;
  const ts = state.lastUpdated;
  if (!ts) { el.innerHTML = ''; return; }
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-AU', {day:'numeric', month:'short', year:'numeric'});
  const time = d.toLocaleTimeString('en-AU', {hour:'2-digit', minute:'2-digit'});
  el.innerHTML = '<div style="font-size:10px;opacity:0.7;letter-spacing:0.04em;text-transform:uppercase;">Last updated</div><div style="font-size:12px;font-weight:500;">' + date + ' · ' + time + '</div>';
}

// Try to load saved state
(function() {
  try {
    const saved = localStorage.getItem('pf_elevate_blank1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.blueprint) {
        state.periods120 = parsed.periods120 || state.periods120;
        state.rounds = parsed.rounds || state.rounds;
        state.sessions = parsed.sessions || state.sessions;
        state.blueprint = parsed.blueprint || state.blueprint;
        state.pendingPushes = parsed.pendingPushes || [];
        state.pendingPushes120 = parsed.pendingPushes120 || [];
        state.lastUpdated = parsed.lastUpdated || parsed.exportedAt || null;
      }
    }
  } catch (err) {
    console.error('Could not load saved data from localStorage', err);
  }
})();

function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (el) el.classList.add('active');
  if (id === 'priorities-120') { render120Periods(); }
  if (id === 'issues-opportunities') { renderIssues(); }
  if (id === 'todos-30') render30();
  if (id === 'blueprint') { renderBlueprint(); updateStats(); }
  if (id === 'coaching') renderSessions();
}

function renderSessions() {
  const tbody = document.getElementById('sessions-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  state.sessions.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${s.date}</strong>${s.done?'<span class="session-done-badge">✓ Done</span>':''}</td><td>${s.format}</td><td>${s.focus}</td><td style="color:var(--grey-light);font-size:12px">${s.notes}</td><td><div class="session-row-actions"><button class="btn btn-ghost btn-sm" onclick="editSession(${s.id})">✏️ Edit</button></div></td>`;
    tbody.appendChild(tr);
  });
}

let currentSessionId = null, isNewSession = false;

function showAddSessionModal() {
  isNewSession = true; currentSessionId = null;
  document.getElementById('session-edit-title').textContent = 'Add New Session';
  document.getElementById('session-delete-btn').style.display = 'none';
  document.getElementById('session-edit-fields').innerHTML = sessionFormHTML({date:'',done:false,format:'',focus:'',notes:''});
  document.getElementById('session-edit-overlay').classList.add('open');
}

function editSession(id) {
  const s = state.sessions.find(x => x.id === id);
  if (!s) return;
  isNewSession = false; currentSessionId = id;
  document.getElementById('session-edit-title').textContent = 'Edit Session';
  document.getElementById('session-delete-btn').style.display = 'inline-flex';
  document.getElementById('session-edit-fields').innerHTML = sessionFormHTML(s);
  document.getElementById('session-edit-overlay').classList.add('open');
}

function sessionFormHTML(s) {
  return `<div class="edit-field"><label>Date</label><input id="se-date" type="text" value="${s.date||''}" placeholder="e.g. 1 May 2026"></div><div class="edit-field"><label>Format</label><input id="se-format" type="text" value="${s.format||''}" placeholder="e.g. In-person, Teams, TBC"></div><div class="edit-field"><label>Focus / Topic</label><input id="se-focus" type="text" value="${s.focus||''}" placeholder="e.g. 30-Day Round 2 Review"></div><div class="edit-field"><label>Notes</label><textarea id="se-notes" style="min-height:80px">${s.notes||''}</textarea></div><div class="edit-field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;text-transform:none;letter-spacing:0;font-size:13px;font-weight:500;"><input type="checkbox" id="se-done" ${s.done?'checked':''} style="width:auto;accent-color:var(--lime)"> Mark as completed</label></div>`;
}

function saveSessionEdit() {
  const date = document.getElementById('se-date').value.trim();
  const format = document.getElementById('se-format').value.trim();
  const focus = document.getElementById('se-focus').value.trim();
  const notes = document.getElementById('se-notes').value.trim();
  const done = document.getElementById('se-done').checked;
  if (!date || !focus) { alert('Please enter at least a date and focus.'); return; }
  if (isNewSession) {
    const newId = Math.max(...state.sessions.map(s => s.id), 0) + 1;
    state.sessions.push({id:newId,date,format,focus,notes,done});
  } else {
    const s = state.sessions.find(x => x.id === currentSessionId);
    if (s) { s.date=date; s.format=format; s.focus=focus; s.notes=notes; s.done=done; }
  }
  save(); renderSessions(); closeSessionEditModal();
  showToast(isNewSession ? 'Session added ✓' : 'Session updated ✓');
}

function deleteSession() {
  if (!confirm('Delete this session?')) return;
  state.sessions = state.sessions.filter(s => s.id !== currentSessionId);
  save(); renderSessions(); closeSessionEditModal(); showToast('Session deleted');
}

function closeSessionEditModal() {
  document.getElementById('session-edit-overlay').classList.remove('open');
  currentSessionId = null; isNewSession = false;
}

function renderBlueprint() {
  const bp = state.blueprint;
  document.getElementById('bp-tenyear-body').innerHTML = bp.tenyear.split('\n\n').map(p => `<p>${p}</p>`).join('');
  renderThreeYearTargets();
  document.getElementById('bp-purpose-body').innerHTML = `<p>${bp.purpose}</p>`;
  document.getElementById('bp-values-body').innerHTML = bp.values.map(v => `<span class="value-pill">${v}</span>`).join('');
  renderOneYearTargets();
}

function migrateOneYear() {
  // Migrate plain strings to {text, done} objects if needed
  state.blueprint.oneyear = (state.blueprint.oneyear || []).map(item =>
    typeof item === 'string' ? {text: item, done: false} : item
  );
}

function renderOneYearTargets() {
  migrateOneYear();
  const oneEl = document.getElementById('bp-oneyear-body');
  if (!oneEl) return;
  const targets = state.blueprint.oneyear || [];
  if (!targets.length) { oneEl.innerHTML = `<p style="color:var(--grey-light);font-style:italic">No targets set yet.</p>`; return; }
  oneEl.innerHTML = `<ul id="oneyear-list" style="list-style:none;padding:0;margin:0">${targets.map((item,idx) => {
    const done = item.done || false;
    return `<li data-idx="${idx}" draggable="true" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);${done?'opacity:0.6':''}">
      <span class="drag-handle" title="Drag to reorder" style="flex-shrink:0">⠿</span>
      <button onclick="toggleOneYearDone(${idx})" title="${done?'Mark incomplete':'Mark complete'}" style="flex-shrink:0;width:22px;height:22px;border-radius:50%;border:2px solid ${done?'var(--lime)':'var(--teal-mid)'};background:${done?'var(--lime)':'white'};cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:all 0.15s;">${done?'<span style="color:white;font-size:13px;line-height:1">✓</span>':''}</button>
      <span style="flex:1;font-size:14px;color:var(--grey-mid);line-height:1.5;${done?'text-decoration:line-through':''}">${item.text}</span>
      <button class="btn btn-ghost btn-sm" onclick="editOneYearTarget(${idx})" style="flex-shrink:0">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="deleteOneYearTarget(${idx})" style="flex-shrink:0">🗑</button>
    </li>`;
  }).join('')}</ul>`;
  initDragList('oneyear-list','oneyear');
}

function toggleOneYearDone(idx) {
  migrateOneYear();
  const item = state.blueprint.oneyear[idx];
  if (!item) return;
  const wasDone = item.done;
  item.done = !item.done;
  if (!wasDone && item.done) playBing();
  save(); renderOneYearTargets();
}

function renderThreeYearTargets() {
  const el = document.getElementById('bp-threeyear-body');
  if (!el) return;
  const text = state.blueprint.threeyear || '';
  if (!state.blueprint.threeyearDone) state.blueprint.threeyearDone = {};
  const lines = text.split('\n\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) { el.innerHTML = '<p style="color:var(--grey-light);font-style:italic">No items yet.</p>'; return; }
  el.innerHTML = '<ul style="list-style:none;padding:0;margin:0">' + lines.map((line, idx) => {
    const done = !!state.blueprint.threeyearDone[idx];
    return `<li style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);${done?'opacity:0.6':''}">
      <button onclick="toggleThreeYearDone(${idx})" title="${done?'Mark incomplete':'Mark complete'}" style="flex-shrink:0;margin-top:2px;width:22px;height:22px;border-radius:50%;border:2px solid ${done?'var(--lime)':'var(--teal-mid)'};background:${done?'var(--lime)':'white'};cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:all 0.15s;">${done?'<span style="color:white;font-size:13px;line-height:1">✓</span>':''}</button>
      <span style="flex:1;font-size:14px;color:var(--grey-mid);line-height:1.6;${done?'text-decoration:line-through':''}">${line}</span>
    </li>`;
  }).join('') + '</ul>';
}

function toggleThreeYearDone(idx) {
  if (!state.blueprint.threeyearDone) state.blueprint.threeyearDone = {};
  const wasDone = !!state.blueprint.threeyearDone[idx];
  state.blueprint.threeyearDone[idx] = !wasDone;
  if (!wasDone) playBing();
  save(); renderThreeYearTargets();
}

function addOneYearTarget() {
  editCtx = {type:'oneyear-new'};
  document.getElementById('edit-title').textContent = 'Add 1-Year Target';
  document.getElementById('edit-fields').innerHTML = `<div class="edit-field"><label>Target</label><textarea id="ef-what" style="min-height:80px" placeholder="Describe the target…"></textarea></div>`;
  document.getElementById('edit-overlay').classList.add('open');
}

function editOneYearTarget(idx) {
  migrateOneYear();
  editCtx = {type:'oneyear-edit',idx};
  document.getElementById('edit-title').textContent = 'Edit 1-Year Target';
  const item = state.blueprint.oneyear[idx];
  document.getElementById('edit-fields').innerHTML = `<div class="edit-field"><label>Target</label><textarea id="ef-what" style="min-height:80px">${item.text||item}</textarea></div>`;
  document.getElementById('edit-overlay').classList.add('open');
}

function deleteOneYearTarget(idx) {
  if (!confirm('Delete this target?')) return;
  state.blueprint.oneyear.splice(idx,1);
  save(); renderOneYearTargets();
}

function renderIssues() {
  const issEl = document.getElementById('bp-issues-body');
  if (!issEl) return;
  if (!state.blueprint.issues.length) { issEl.innerHTML = `<p style="color:var(--grey-light);font-style:italic">No issues or opportunities logged yet.</p>`; return; }
  issEl.innerHTML = `<ul style="padding-left:18px;list-style:disc;">${state.blueprint.issues.map(i => { const isOpp = i.startsWith('OPPORTUNITY:'); return `<li style="margin-bottom:6px">${isOpp ? '<strong style="color:var(--lime-dark,#5a8a1a)">Opportunity:</strong> '+i.replace('OPPORTUNITY: ','') : i}</li>`; }).join('')}</ul>`;
}

let currentBpSection = null;

function editBlueprint(section) {
  currentBpSection = section;
  const bp = state.blueprint;
  const titles = {tenyear:'10-Year Direction',threeyear:'3-Year Picture',values:'Core Values',purpose:'Our Purpose',issues:'Issues & Opportunities'};
  document.getElementById('bp-edit-title').textContent = 'Edit: ' + titles[section];
  const fieldsEl = document.getElementById('bp-edit-fields');
  if (['tenyear','threeyear','purpose'].includes(section)) {
    fieldsEl.innerHTML = `<div class="edit-field"><label>Content (use blank lines to separate paragraphs)</label><textarea id="bp-edit-val" style="min-height:180px">${bp[section]}</textarea></div>`;
  } else if (section === 'values') {
    fieldsEl.innerHTML = `<div class="edit-field"><label>Values (one per line)</label><textarea id="bp-edit-val" style="min-height:140px">${bp.values.join('\n')}</textarea></div>`;
  } else if (section === 'issues') {
    fieldsEl.innerHTML = `<div class="edit-field"><label>Issues &amp; Opportunities (one per line — prefix with OPPORTUNITY: for green highlight)</label><textarea id="bp-edit-val" style="min-height:200px">${bp.issues.join('\n')}</textarea></div>`;
  }
  document.getElementById('bp-edit-overlay').classList.add('open');
}

function saveBpEdit() {
  const val = document.getElementById('bp-edit-val').value.trim();
  const bp = state.blueprint;
  if (['tenyear','threeyear','purpose'].includes(currentBpSection)) { bp[currentBpSection] = val; if (currentBpSection==='threeyear') bp.threeyearDone={}; }
  else if (currentBpSection === 'values') { bp.values = val.split('\n').map(v=>v.trim()).filter(Boolean); }
  else if (currentBpSection === 'issues') { bp.issues = val.split('\n').map(v=>v.trim()).filter(Boolean); }
  save(); renderBlueprint(); renderIssues(); closeBpEditModal();
}

function closeBpEditModal() { document.getElementById('bp-edit-overlay').classList.remove('open'); currentBpSection = null; }

function render120Periods() {
  const tabsEl = document.getElementById('period-tabs-120');
  const panelsEl = document.getElementById('period-panels-120');
  if (!tabsEl || !panelsEl) return;
  tabsEl.innerHTML = ''; panelsEl.innerHTML = '';
  if (!state.periods120.length) { panelsEl.innerHTML = `<div class="empty-state"><div class="icon">⚡</div><p>No periods yet.</p></div>`; updateStats(); return; }
  const activePeriod = state.periods120[state.periods120.length - 1];
  document.getElementById('period-rename-hint').style.display = 'block';
  state.periods120.forEach(period => {
    const isActive = period.id === activePeriod.id;
    const tab = document.createElement('div');
    tab.className = `round-tab ${isActive?'active':''} ${period.current?'current':''}`;
    tab.textContent = period.label; tab.title = 'Double-click to rename';
    tab.onclick = () => switch120Period(period.id);
    tab.ondblclick = (e) => { e.stopPropagation(); renamePeriod120(period.id); };
    tab.id = `ptab-${period.id}`;
    tabsEl.appendChild(tab);
    const done = period.priorities.filter(p=>p.status==='complete').length;
    const pct = period.priorities.length ? Math.round(done/period.priorities.length*100) : 0;
    const panel = document.createElement('div');
    panel.id = `ppanel-${period.id}`;
    panel.className = `round-panel ${isActive?'active':''}`;
    panel.innerHTML = `<div class="card"><div class="card-header" style="justify-content:space-between;"><div style="display:flex;align-items:center;gap:10px"><span class="icon">⚡</span><h2>${period.label} — ${period.period}</h2></div><div style="display:flex;gap:6px;align-items:center;"><button class="btn btn-sm print-period-btn" onclick="printPeriod120(${period.id})" title="Print this period">🖨 Print</button><button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);font-size:12px;" onclick="addPriority120(${period.id})">＋ Add Priority</button></div></div><div class="progress-wrap"><div class="progress-label"><span>Progress</span><span id="prog-120-text-${period.id}">${done} of ${period.priorities.length} complete</span></div><div class="progress-bar"><div class="progress-fill" id="prog-120-bar-${period.id}" style="width:${pct}%"></div></div></div><table class="priority-table"><thead><tr><th style="width:20px"></th><th>Status</th><th>What</th><th style="width:100px">Who</th><th style="width:100px">By When</th><th style="width:90px"></th></tr></thead><tbody id="body-120-${period.id}"></tbody></table><div class="status-legend"><span class="legend-item"><span class="legend-dot dot-on-track"></span> On Track</span><span class="legend-item"><span class="legend-dot dot-off-track"></span> Off Track</span><span class="legend-item"><span class="legend-dot dot-complete"></span> Complete</span><span style="margin-left:auto;font-size:11px;color:var(--grey-light)">💡 Use "Push →" to carry items into the next period</span></div></div>`;
    panelsEl.appendChild(panel);
    renderPeriodPriorities(period.id);
  });
  updateStats();
}

function renderPeriodPriorities(periodId) {
  const period = state.periods120.find(p=>p.id===periodId);
  if (!period) return;
  const tbody = document.getElementById(`body-120-${periodId}`);
  if (!tbody) return;
  tbody.innerHTML = '';
  let done = 0;
  period.priorities.forEach(p => {
    if (p.status==='complete') done++;
    const canPush = p.status!=='complete' && !p.pushed;
    const pushBtn = canPush ? `<button class="push-btn" onclick="pushPriority120(${periodId},${p.id})">Push →</button>` : p.pushed ? `<span class="push-btn pushed">Pushed ✓</span>` : '';
    const tr = document.createElement('tr');
    tr.className = p.status==='complete'?'status-complete':p.status==='off-track'?'status-off-track':'';
    tr.setAttribute('draggable','true'); tr.setAttribute('data-id',p.id);
    tr.innerHTML = `<td style="width:20px;cursor:grab;color:var(--grey-light);font-size:16px;text-align:center" class="drag-handle">⠿</td><td><div class="status-btns"><button class="status-btn ${p.status==='on-track'?'active-on-track':''}" onclick="setStatus120(${periodId},${p.id},'on-track')">✓ On Track</button><button class="status-btn ${p.status==='off-track'?'active-off-track':''}" onclick="setStatus120(${periodId},${p.id},'off-track')">✗ Off Track</button><button class="status-btn ${p.status==='complete'?'active-complete':''}" onclick="setStatus120(${periodId},${p.id},'complete')">★ Complete</button></div></td><td class="${p.status==='complete'?'task-text':''}">${p.what}${p.pushed?'<span class="pushed-label">Pushed →</span>':''}</td><td>${badgeFor(p.who)}</td><td style="font-size:12px;color:var(--grey-light);white-space:nowrap">${p.when}</td><td style="display:flex;gap:4px;align-items:center;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="editItem120(${periodId},${p.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="deletePriority120(${periodId},${p.id})">🗑</button>${pushBtn}</td>`;
    tbody.appendChild(tr);
  });
  const pct = period.priorities.length ? Math.round(done/period.priorities.length*100) : 0;
  const bar = document.getElementById(`prog-120-bar-${periodId}`);
  const txt = document.getElementById(`prog-120-text-${periodId}`);
  if (bar) bar.style.width = pct+'%';
  if (txt) txt.textContent = `${done} of ${period.priorities.length} complete`;
  initDragTable(`body-120-${periodId}`,'priorities120',periodId);
}

function switch120Period(id) {
  document.querySelectorAll('#period-tabs-120 .round-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#period-panels-120 .round-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById(`ptab-${id}`)?.classList.add('active');
  document.getElementById(`ppanel-${id}`)?.classList.add('active');
}


function playBing() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const unlock = ctx.createBufferSource();
    unlock.buffer = ctx.createBuffer(1, 1, 22050);
    unlock.connect(ctx.destination);
    unlock.start(0);
    ctx.resume().then(() => {
      const now = ctx.currentTime;
      [[1046.5, 0.0], [1318.5, 0.13], [1568.0, 0.26]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.connect(env);
        env.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0.001, now + delay);
        env.gain.linearRampToValueAtTime(0.6, now + delay + 0.015);
        env.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.8);
        osc.start(now + delay);
        osc.stop(now + delay + 0.85);
      });
    });
  } catch(e) { console.warn('playBing error:', e); }
}

function setStatus120(periodId,itemId,status) {
  const period = state.periods120.find(p=>p.id===periodId); if (!period) return;
  const p = period.priorities.find(x=>x.id===itemId); if (!p) return;
  const wasComplete = p.status !== 'complete';
  p.status = p.status===status?'none':status;
  if (status === 'complete' && wasComplete && p.status === 'complete') playBing();
  save(); renderPeriodPriorities(periodId); updateStats();
}

function pushPriority120(periodId,itemId) {
  const period = state.periods120.find(p=>p.id===periodId); if (!period) return;
  const item = period.priorities.find(x=>x.id===itemId); if (!item) return;
  item.pushed = true;
  const idx = state.periods120.findIndex(p=>p.id===periodId);
  const next = state.periods120[idx+1];
  if (next) {
    const newId = Math.max(...next.priorities.map(x=>x.id),0)+1;
    next.priorities.push({id:newId,what:item.what,who:item.who,when:item.when,status:'none',pushed:false,carriedFrom:period.label});
    save(); renderPeriodPriorities(periodId); renderPeriodPriorities(next.id); showToast(`Priority carried into "${next.label}" ✓`);
  } else {
    if (!state.pendingPushes120) state.pendingPushes120 = [];
    state.pendingPushes120.push({what:item.what,who:item.who,when:item.when,fromPeriod:period.label});
    save(); renderPeriodPriorities(periodId); showToast('Priority will be added to the next new period you create ✓');
  }
}

let editCtx = null;

function editItem120(periodId,itemId) {
  const period = state.periods120.find(p=>p.id===periodId); if (!period) return;
  const p = period.priorities.find(x=>x.id===itemId); if (!p) return;
  editCtx = {type:'120',periodId,itemId};
  document.getElementById('edit-title').textContent = 'Edit 120-Day Priority';
  document.getElementById('edit-fields').innerHTML = `<div class="edit-field"><label>What</label><textarea id="ef-what" style="min-height:80px">${p.what}</textarea></div><div class="edit-field"><label>Who</label><input id="ef-who" value="${p.who}" placeholder="e.g. Newms, Ommers" list="who-suggestions"></div><div class="edit-field"><label>By When</label><input id="ef-when" value="${p.when}"></div>`;
  document.getElementById('edit-overlay').classList.add('open');
}

function addPriority120(periodId) {
  editCtx = {type:'120-new',periodId};
  document.getElementById('edit-title').textContent = 'Add 120-Day Priority';
  document.getElementById('edit-fields').innerHTML = `<div class="edit-field"><label>What</label><textarea id="ef-what" style="min-height:80px" placeholder="Describe the priority action…"></textarea></div><div class="edit-field"><label>Who</label><input id="ef-who" placeholder="e.g. Newms, Ommers" list="who-suggestions"></div><div class="edit-field"><label>By When</label><input id="ef-when" placeholder="e.g. Jun 2026"></div>`;
  document.getElementById('edit-overlay').classList.add('open');
}

function deletePriority120(periodId,itemId) {
  if (!confirm('Delete this priority?')) return;
  const period = state.periods120.find(p=>p.id===periodId);
  if (period) period.priorities = period.priorities.filter(x=>x.id!==itemId);
  save(); renderPeriodPriorities(periodId); updateStats();
}

function addTask30(roundId) {
  editCtx = {type:'30-new',roundId};
  document.getElementById('edit-title').textContent = 'Add Task';
  document.getElementById('edit-fields').innerHTML = `<div class="edit-field"><label>What</label><textarea id="ef-what" style="min-height:80px" placeholder="Describe the task…"></textarea></div><div class="edit-field"><label>Who</label><input id="ef-who" placeholder="e.g. Newms, Ommers" list="who-suggestions"></div><div class="edit-field"><label>By When</label><input id="ef-when" placeholder="e.g. 31 May 2026"></div>`;
  document.getElementById('edit-overlay').classList.add('open');
}

function deleteTask30(roundId,taskId) {
  if (!confirm('Delete this task?')) return;
  const round = state.rounds.find(r=>r.id===roundId);
  if (round) round.tasks = round.tasks.filter(t=>t.id!==taskId);
  save(); renderRoundTasks(roundId);
}

function editItem30(roundId,taskId) {
  const round = state.rounds.find(r=>r.id===roundId); if (!round) return;
  const t = round.tasks.find(x=>x.id===taskId); if (!t) return;
  editCtx = {type:'30',roundId,taskId};
  document.getElementById('edit-title').textContent = 'Edit 30-Day Task';
  document.getElementById('edit-fields').innerHTML = `<div class="edit-field"><label>What</label><textarea id="ef-what" style="min-height:80px">${t.what}</textarea></div><div class="edit-field"><label>Who</label><input id="ef-who" value="${t.who}" placeholder="e.g. Newms, Ommers" list="who-suggestions"></div><div class="edit-field"><label>By When</label><input id="ef-when" value="${t.when}"></div>`;
  document.getElementById('edit-overlay').classList.add('open');
}

function saveEdit() {
  const what = document.getElementById('ef-what')?.value.trim();
  const whoEl = document.getElementById('ef-who');
  const whenEl = document.getElementById('ef-when');
  const who = whoEl ? whoEl.value.trim() : '';
  const when = whenEl ? whenEl.value.trim() : '';
  if (!what) return;
  if (editCtx.type==='120') {
    const period = state.periods120.find(p=>p.id===editCtx.periodId);
    if (period) { const p = period.priorities.find(x=>x.id===editCtx.itemId); if (p) { p.what=what; p.who=who; p.when=when; } }
    save(); renderPeriodPriorities(editCtx.periodId);
  } else if (editCtx.type==='120-new') {
    const period = state.periods120.find(p=>p.id===editCtx.periodId);
    if (period) { const newId = Math.max(...period.priorities.map(x=>x.id),0)+1; period.priorities.push({id:newId,what,who,when,status:'none',pushed:false}); }
    save(); renderPeriodPriorities(editCtx.periodId); updateStats();
  } else if (editCtx.type==='rename-round') {
    const round = state.rounds.find(r=>r.id===editCtx.roundId);
    if (round) { round.label=what; if (when) round.period=when; }
    save(); render30();
  } else if (editCtx.type==='rename-period120') {
    const period = state.periods120.find(p=>p.id===editCtx.periodId);
    if (period) { period.label=what; if (when) period.period=when; }
    save(); render120Periods();
  } else if (editCtx.type==='oneyear-new') {
    migrateOneYear(); state.blueprint.oneyear.push({text:what,done:false}); save(); renderOneYearTargets();
  } else if (editCtx.type==='oneyear-edit') {
    migrateOneYear(); const oi=state.blueprint.oneyear[editCtx.idx]; if(oi) oi.text=what; save(); renderOneYearTargets();
  } else if (editCtx.type==='30') {
    const round = state.rounds.find(r=>r.id===editCtx.roundId);
    if (round) { const t = round.tasks.find(x=>x.id===editCtx.taskId); if (t) { t.what=what; t.who=who; t.when=when; } }
    save(); renderRoundTasks(editCtx.roundId);
  } else if (editCtx.type==='30-new') {
    const round = state.rounds.find(r=>r.id===editCtx.roundId);
    if (round) { const newId = Math.max(...round.tasks.map(x=>x.id),0)+1; round.tasks.push({id:newId,what,who,when,status:'none',pushed:false}); }
    save(); renderRoundTasks(editCtx.roundId);
  }
  closeEditModal();
}

function closeEditModal() { document.getElementById('edit-overlay').classList.remove('open'); editCtx = null; }

function render30() {
  const tabsEl = document.getElementById('round-tabs');
  const panelsEl = document.getElementById('round-panels');
  tabsEl.innerHTML = ''; panelsEl.innerHTML = '';
  if (!state.rounds.length) { panelsEl.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No rounds yet.</p></div>`; return; }
  const activeRound = state.rounds[state.rounds.length-1];
  const hintEl = document.getElementById('round-rename-hint');
  if (hintEl) hintEl.style.display = 'block';
  state.rounds.forEach(round => {
    const isActive = round.id === activeRound.id;
    const tab = document.createElement('div');
    tab.className = `round-tab ${isActive?'active':''} ${round.current?'current':''}`;
    tab.textContent = round.label; tab.title = 'Double-click to rename';
    tab.onclick = () => switchRound(round.id);
    tab.ondblclick = (e) => { e.stopPropagation(); renameRound(round.id); };
    tab.id = `tab-${round.id}`;
    tabsEl.appendChild(tab);
    const done = round.tasks.filter(t=>t.status==='complete').length;
    const pct = round.tasks.length ? Math.round(done/round.tasks.length*100) : 0;
    const panel = document.createElement('div');
    panel.id = `panel-${round.id}`;
    panel.className = `round-panel ${isActive?'active':''}`;
    panel.innerHTML = `<div class="card"><div class="card-header" style="justify-content:space-between;"><div style="display:flex;align-items:center;gap:10px"><span class="icon">✅</span><h2>${round.label} — ${round.period}</h2></div><div style="display:flex;gap:6px;align-items:center;"><button class="btn btn-sm print-period-btn" onclick="printRound30(${round.id})" title="Print this round">🖨 Print</button><button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);font-size:12px;" onclick="addTask30(${round.id})">＋ Add Task</button></div></div><div class="progress-wrap"><div class="progress-label"><span>Progress</span><span id="prog-30-text-${round.id}">${done} of ${round.tasks.length} complete</span></div><div class="progress-bar"><div class="progress-fill" id="prog-30-bar-${round.id}" style="width:${pct}%"></div></div></div><table class="priority-table"><thead><tr><th style="width:20px"></th><th>Status</th><th>What</th><th style="width:100px">Who</th><th style="width:110px">By When</th><th style="width:80px">Actions</th></tr></thead><tbody id="tasks-${round.id}"></tbody></table><div class="status-legend"><span class="legend-item"><span class="legend-dot dot-on-track"></span> On Track</span><span class="legend-item"><span class="legend-dot dot-off-track"></span> Off Track</span><span class="legend-item"><span class="legend-dot dot-complete"></span> Complete</span><span style="margin-left:auto;font-size:11px;color:var(--grey-light)">💡 Use "Push →" on incomplete tasks to carry into next round</span></div><div style="padding:16px 20px;border-top:1px solid var(--border)"><label style="font-size:12px;font-weight:600;color:var(--grey-dark);display:block;margin-bottom:6px">Coaching session notes for this round</label><textarea class="coaching-area" id="notes-${round.id}" placeholder="Notes from the coaching session reviewing this round…" oninput="saveRoundNotes(${round.id})">${round.notes||''}</textarea></div></div>`;
    panelsEl.appendChild(panel);
    renderRoundTasks(round.id);
  });
  updateStats();
}

function renderRoundTasks(roundId) {
  const round = state.rounds.find(r=>r.id===roundId); if (!round) return;
  const tbody = document.getElementById(`tasks-${roundId}`); if (!tbody) return;
  tbody.innerHTML = '';
  let done = 0;
  round.tasks.forEach(t => {
    if (t.status==='complete') done++;
    const canPush = t.status!=='complete' && !t.pushed;
    const pushBtn = canPush ? `<button class="push-btn" onclick="pushTask(${roundId},${t.id})">Push →</button>` : t.pushed ? `<span class="push-btn pushed">Pushed ✓</span>` : '';
    const tr = document.createElement('tr');
    tr.className = t.status==='complete'?'status-complete':t.status==='off-track'?'status-off-track':'';
    tr.setAttribute('draggable','true'); tr.setAttribute('data-id',t.id);
    tr.innerHTML = `<td style="width:20px;cursor:grab;color:var(--grey-light);font-size:16px;text-align:center" class="drag-handle">⠿</td><td><div class="status-btns"><button class="status-btn ${t.status==='on-track'?'active-on-track':''}" onclick="setStatus30(${roundId},${t.id},'on-track')">✓ On Track</button><button class="status-btn ${t.status==='off-track'?'active-off-track':''}" onclick="setStatus30(${roundId},${t.id},'off-track')">✗ Off Track</button><button class="status-btn ${t.status==='complete'?'active-complete':''}" onclick="setStatus30(${roundId},${t.id},'complete')">★ Complete</button></div></td><td class="${t.status==='complete'?'task-text':''}">${t.what}${t.pushed?'<span class="pushed-label">Pushed →</span>':''}</td><td>${badgeFor(t.who)}</td><td style="font-size:12px;color:var(--grey-light);white-space:nowrap">${t.when}</td><td style="display:flex;gap:4px;align-items:center;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="editItem30(${roundId},${t.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="deleteTask30(${roundId},${t.id})">🗑</button>${pushBtn}</td>`;
    tbody.appendChild(tr);
  });
  const pct = round.tasks.length ? Math.round(done/round.tasks.length*100) : 0;
  const barEl = document.getElementById(`prog-30-bar-${roundId}`);
  const txtEl = document.getElementById(`prog-30-text-${roundId}`);
  if (barEl) barEl.style.width = pct+'%';
  if (txtEl) txtEl.textContent = `${done} of ${round.tasks.length} complete`;
  updateStats();
  initDragTable(`tasks-${roundId}`,'tasks30',roundId);
}

function setStatus30(roundId,taskId,status) {
  const round = state.rounds.find(r=>r.id===roundId); if (!round) return;
  const t = round.tasks.find(x=>x.id===taskId);
  if (t) { const wasComplete = t.status !== 'complete'; t.status = t.status===status?'none':status; if (status==='complete' && wasComplete && t.status==='complete') playBing(); save(); renderRoundTasks(roundId); }
}

function switchRound(id) {
  document.querySelectorAll('.round-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.round-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById(`tab-${id}`)?.classList.add('active');
  document.getElementById(`panel-${id}`)?.classList.add('active');
}

function saveRoundNotes(roundId) {
  const round = state.rounds.find(r=>r.id===roundId);
  if (round) { round.notes = document.getElementById(`notes-${roundId}`).value; save(); }
}

function pushTask(roundId,taskId) {
  const round = state.rounds.find(r=>r.id===roundId); if (!round) return;
  const t = round.tasks.find(x=>x.id===taskId); if (!t) return;
  t.pushed = true;
  const roundIdx = state.rounds.findIndex(r=>r.id===roundId);
  const nextRound = state.rounds[roundIdx+1];
  if (nextRound) {
    const newId = Math.max(...nextRound.tasks.map(x=>x.id),0)+1;
    nextRound.tasks.push({id:newId,what:t.what,who:t.who,when:t.when,status:'none',pushed:false,carriedFrom:round.label});
    save(); renderRoundTasks(roundId); renderRoundTasks(nextRound.id); showToast(`Task carried into "${nextRound.label}" ✓`);
  } else {
    if (!state.pendingPushes) state.pendingPushes = [];
    state.pendingPushes.push({what:t.what,who:t.who,when:t.when,fromRound:round.label});
    save(); renderRoundTasks(roundId); showToast('Task will be added to the next new round you create ✓');
  }
}

let taskRows120Counter = 0;
function showNew120Modal() {
  document.getElementById('new-120-label').value=''; document.getElementById('new-120-period').value=''; document.getElementById('new-120-targets').value=''; document.getElementById('task-rows-120').innerHTML=''; taskRows120Counter=0;
  const pending = state.pendingPushes120||[];
  const notice = document.getElementById('pushed-120-notice');
  if (pending.length>0) { notice.style.display='block'; notice.innerHTML=`<strong>📋 ${pending.length} priorit${pending.length>1?'ies':'y'} will be carried over:</strong><ul style="margin-top:6px;padding-left:18px">${pending.map(p=>`<li>${p.what}</li>`).join('')}</ul>`; } else notice.style.display='none';
  add120TaskRow(); add120TaskRow(); add120TaskRow();
  document.getElementById('modal-120-overlay').style.display='flex';
}

function closeNew120Modal() { document.getElementById('modal-120-overlay').style.display='none'; }

function add120TaskRow() {
  taskRows120Counter++;
  const id = taskRows120Counter;
  const div = document.createElement('div');
  div.className='form-row'; div.id=`trow120-${id}`;
  div.innerHTML=`<input class="form-input" id="t120w-${id}" placeholder="Priority action…"><input class="form-input" id="t120who-${id}" placeholder="Who (e.g. Newms, Ommers)" list="who-suggestions"><input class="form-input" id="t120when-${id}" placeholder="By when"><button class="btn btn-danger btn-sm" onclick="remove120TaskRow(${id})">✕</button>`;
  document.getElementById('task-rows-120').appendChild(div);
}

function remove120TaskRow(id) { document.getElementById(`trow120-${id}`)?.remove(); }

function createPeriod120() {
  const label = document.getElementById('new-120-label').value.trim();
  const period = document.getElementById('new-120-period').value.trim();
  const targetsRaw = document.getElementById('new-120-targets').value.trim();
  if (!label) { alert('Please enter a period label.'); return; }
  const oneyear = targetsRaw ? targetsRaw.split('\n').map(v=>v.trim()).filter(Boolean) : [];
  const priorities = []; let pid = 1;
  (state.pendingPushes120||[]).forEach(p => { priorities.push({id:pid++,what:p.what,who:p.who,when:p.when,status:'none',pushed:false,carriedFrom:p.fromPeriod}); });
  document.querySelectorAll('#task-rows-120 .form-row').forEach(row => {
    const rowId = row.id.replace('trow120-','');
    const what = document.getElementById(`t120w-${rowId}`)?.value?.trim();
    const who = document.getElementById(`t120who-${rowId}`)?.value;
    const when = document.getElementById(`t120when-${rowId}`)?.value?.trim();
    if (what) priorities.push({id:pid++,what,who:who||'Team',when:when||'TBC',status:'none',pushed:false});
  });
  state.periods120.forEach(p=>p.current=false);
  state.periods120.push({id:Date.now(),label,period:period||label,current:true,oneyear,priorities});
  state.pendingPushes120=[];
  save(); closeNew120Modal(); render120Periods(); showToast(`Period "${label}" created ✓`);
}

let tempTaskRows = [];
function showNewRoundModal() {
  tempTaskRows=[]; document.getElementById('new-round-label').value=''; document.getElementById('new-round-period').value=''; document.getElementById('task-rows').innerHTML='';
  const pending = state.pendingPushes||[];
  const notice = document.getElementById('pushed-tasks-notice');
  if (pending.length>0) { notice.style.display='block'; notice.innerHTML=`<strong>📋 ${pending.length} task${pending.length>1?'s':''} will be carried over:</strong><ul style="margin-top:6px;padding-left:18px">${pending.map(p=>`<li>${p.what}</li>`).join('')}</ul>`; } else notice.style.display='none';
  addTaskRow(); addTaskRow(); addTaskRow();
  document.getElementById('modal-overlay').style.display='flex';
}

function closeModal() { document.getElementById('modal-overlay').style.display='none'; }

let taskRowCounter = 0;
function addTaskRow() {
  taskRowCounter++;
  const id = taskRowCounter;
  const div = document.createElement('div');
  div.className='form-row'; div.id=`trow-${id}`;
  div.innerHTML=`<input class="form-input" id="tw-${id}" placeholder="What needs to be done…"><input class="form-input" id="twho-${id}" placeholder="Who (e.g. Newms, Ommers)" list="who-suggestions"><input class="form-input" id="twhen-${id}" placeholder="By when"><button class="btn btn-danger btn-sm" onclick="removeTaskRow(${id})">✕</button>`;
  document.getElementById('task-rows').appendChild(div);
  tempTaskRows.push(id);
}

function removeTaskRow(id) { document.getElementById(`trow-${id}`)?.remove(); tempTaskRows=tempTaskRows.filter(x=>x!==id); }

function createRound() {
  const label = document.getElementById('new-round-label').value.trim();
  const period = document.getElementById('new-round-period').value.trim();
  if (!label) { alert('Please enter a round label.'); return; }
  const tasks = []; let taskId = 1;
  (state.pendingPushes||[]).forEach(p => { tasks.push({id:taskId++,what:p.what,who:p.who,when:p.when,status:'none',pushed:false,carriedFrom:p.fromRound}); });
  document.querySelectorAll('#task-rows .form-row').forEach(row => {
    const rowId = row.id.replace('trow-','');
    const what = document.getElementById(`tw-${rowId}`)?.value?.trim();
    const who = document.getElementById(`twho-${rowId}`)?.value;
    const when = document.getElementById(`twhen-${rowId}`)?.value?.trim();
    if (what) tasks.push({id:taskId++,what,who:who||'Team',when:when||'TBC',status:'none',pushed:false});
  });
  state.rounds.forEach(r=>r.current=false);
  state.rounds.push({id:Date.now(),label,period:period||label,current:true,notes:'',tasks});
  state.pendingPushes=[];
  save(); closeModal(); render30();
}

function renameRound(roundId) {
  const round = state.rounds.find(r=>r.id===roundId); if (!round) return;
  editCtx = {type:'rename-round',roundId};
  document.getElementById('edit-title').textContent='Rename Round';
  document.getElementById('edit-fields').innerHTML=`<div class="edit-field"><label>Round Name</label><input id="ef-what" value="${round.label}"></div><div class="edit-field"><label>Date Range</label><input id="ef-when" value="${round.period}"></div>`;
  document.getElementById('edit-overlay').classList.add('open');
}

function renamePeriod120(periodId) {
  const period = state.periods120.find(p=>p.id===periodId); if (!period) return;
  editCtx = {type:'rename-period120',periodId};
  document.getElementById('edit-title').textContent='Rename Period';
  document.getElementById('edit-fields').innerHTML=`<div class="edit-field"><label>Period Name</label><input id="ef-what" value="${period.label}"></div><div class="edit-field"><label>Date Range</label><input id="ef-when" value="${period.period}"></div>`;
  document.getElementById('edit-overlay').classList.add('open');
}

function badgeFor(who) {
  if (!who) return '';
  const palette = ['badge-rob','badge-kellie','badge-paul','badge-peter','badge-robkellie','badge-team'];
  return who.split(/[/,&]/).map(w => {
    w = w.trim();
    let hash = 0;
    for (let i=0;i<w.length;i++) hash = (hash*31 + w.charCodeAt(i)) >>> 0;
    const cls = palette[hash % palette.length];
    return `<span class="badge ${cls}">${w}</span>`;
  }).join(' ');
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText=`position:fixed;bottom:24px;right:24px;background:var(--grey-dark);color:white;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);transition:opacity 0.3s`;
  t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),300); },2800);
}

function addNote() {
  const date = document.getElementById('note-date').value.trim();
  const who = document.getElementById('note-who').value.trim();
  const text = document.getElementById('note-text').value.trim();
  if (!text) return;
  const div = document.createElement('div');
  div.style.marginBottom='16px';
  div.innerHTML=`<div style="font-size:12px;font-weight:700;color:var(--teal-dark);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${date||'Undated'}${who?' — '+who:''}</div><div style="font-size:13px;color:var(--grey-mid);background:var(--grey-bg);padding:12px;border-radius:8px;line-height:1.7">${text}</div>`;
  document.getElementById('session-notes-list').appendChild(div);
  document.getElementById('note-date').value=''; document.getElementById('note-who').value=''; document.getElementById('note-text').value='';
}

function updateStats() {
  const current120 = state.periods120.length ? state.periods120[state.periods120.length-1] : null;
  document.getElementById('stat-120-done').textContent = current120 ? current120.priorities.filter(p=>p.status==='complete').length : 0;
  document.getElementById('stat-120-ontrack').textContent = current120 ? current120.priorities.filter(p=>p.status==='on-track').length : 0;
  const current30 = state.rounds.length ? state.rounds[state.rounds.length-1] : null;
  if (current30) {
    const done30 = current30.tasks.filter(t=>t.status==='complete').length;
    document.getElementById('stat-30-done').textContent = `${done30} / ${current30.tasks.length}`;
    const pct = current30.tasks.length ? Math.round(done30/current30.tasks.length*100) : 0;
    document.getElementById('stat-30-ontrack').textContent = pct+'%';
  }
}

function exportData() {
  const exportable = {version:3,exportedAt:new Date().toISOString(),periods120:state.periods120,rounds:state.rounds,sessions:state.sessions,blueprint:state.blueprint,pendingPushes:state.pendingPushes||[],pendingPushes120:state.pendingPushes120||[]};
  const json = JSON.stringify(exportable,null,2);
  const blob = new Blob([json],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  const d = new Date();
  a.download = `planfarm-elevate-dashboard-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('Data exported successfully');
}

function importData(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    let data;
    try { data = JSON.parse(e.target.result); } catch { alert('Could not read file.'); return; }
    if (!data.version||!data.blueprint) { alert('Not a valid Planfarm data file.'); return; }
    if (!confirm('This will replace all current data. Continue?')) return;
    if (data.periods120) state.periods120=data.periods120;
    if (data.rounds) state.rounds=data.rounds;
    if (data.sessions) state.sessions=data.sessions;
    if (data.blueprint) state.blueprint=data.blueprint;
    state.pendingPushes=data.pendingPushes||[]; state.pendingPushes120=data.pendingPushes120||[];
    if (data.lastUpdated) state.lastUpdated = data.lastUpdated;
    save(); migrateOneYear(); renderBlueprint(); render120Periods(); render30(); renderSessions(); renderIssues(); updateStats(); updateLastUpdatedDisplay();
    showToast('Data imported successfully');
  };
  reader.readAsText(file); event.target.value='';
}

let dragSrc = null;

function initDragTable(tbodyId,type,contextId) {
  const tbody = document.getElementById(tbodyId); if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('dragstart',function(e){dragSrc=this;this.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    row.addEventListener('dragend',function(){this.classList.remove('dragging');tbody.querySelectorAll('tr').forEach(r=>r.classList.remove('drag-over'));});
    row.addEventListener('dragover',function(e){e.preventDefault();tbody.querySelectorAll('tr').forEach(r=>r.classList.remove('drag-over'));if(this!==dragSrc)this.classList.add('drag-over');e.dataTransfer.dropEffect='move';});
    row.addEventListener('drop',function(e){
      e.preventDefault();if(this===dragSrc)return;this.classList.remove('drag-over');
      const rows=Array.from(tbody.querySelectorAll('tr'));const dragIdx=rows.indexOf(dragSrc);const dropIdx=rows.indexOf(this);
      if(dragIdx<dropIdx)tbody.insertBefore(dragSrc,this.nextSibling);else tbody.insertBefore(dragSrc,this);
      const newOrder=Array.from(tbody.querySelectorAll('tr')).map(r=>parseInt(r.getAttribute('data-id')));
      if(type==='priorities120'){const period=state.periods120.find(p=>p.id===contextId);if(period){period.priorities.sort((a,b)=>newOrder.indexOf(a.id)-newOrder.indexOf(b.id));save();}}
      else if(type==='tasks30'){const round=state.rounds.find(r=>r.id===contextId);if(round){round.tasks.sort((a,b)=>newOrder.indexOf(a.id)-newOrder.indexOf(b.id));save();}}
    });
  });
}

function initDragList(listId,type) {
  const list = document.getElementById(listId); if (!list) return;
  list.querySelectorAll('li').forEach(item => {
    item.addEventListener('dragstart',function(e){dragSrc=this;this.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    item.addEventListener('dragend',function(){this.classList.remove('dragging');list.querySelectorAll('li').forEach(i=>i.classList.remove('drag-over'));});
    item.addEventListener('dragover',function(e){e.preventDefault();list.querySelectorAll('li').forEach(i=>i.classList.remove('drag-over'));if(this!==dragSrc)this.classList.add('drag-over');});
    item.addEventListener('drop',function(e){
      e.preventDefault();if(this===dragSrc)return;this.classList.remove('drag-over');
      const items=Array.from(list.querySelectorAll('li'));const dragIdx=items.indexOf(dragSrc);const dropIdx=items.indexOf(this);
      if(dragIdx<dropIdx)list.insertBefore(dragSrc,this.nextSibling);else list.insertBefore(dragSrc,this);
      if(type==='oneyear'){const newOrder=Array.from(list.querySelectorAll('li')).map(i=>parseInt(i.getAttribute('data-idx')));const reordered=newOrder.map(idx=>state.blueprint.oneyear[idx]);state.blueprint.oneyear=reordered;list.querySelectorAll('li').forEach((li,i)=>li.setAttribute('data-idx',i));save();}
    });
  });
}

function addPrintStatusSpans() {
  document.querySelectorAll('.priority-table tbody tr').forEach(tr => {
    tr.querySelectorAll('.print-status').forEach(el=>el.remove());
    let statusText, statusColor;
    if(tr.classList.contains('status-complete')){statusText='★ Complete';statusColor='#5a8a1a';}
    else if(tr.classList.contains('status-off-track')){statusText='✗ Off Track';statusColor='#c0392b';}
    else if(tr.querySelector('.active-on-track')){statusText='✓ On Track';statusColor='#088A9E';}
    else{statusText='— Not Set';statusColor='#aaa';}
    const statusCell=tr.querySelector('td:nth-child(2)');
    if(statusCell){const span=document.createElement('span');span.className='print-status';span.style.cssText=`display:none;font-size:10px;font-weight:700;color:${statusColor};background:white;border:1px solid ${statusColor};border-radius:8px;padding:2px 7px;white-space:nowrap;`;span.textContent=statusText;statusCell.prepend(span);}
  });
}

function cleanupPrintStatusSpans() { document.querySelectorAll('.print-status').forEach(el=>el.remove()); }

function printPeriod120(periodId) {
  renderPeriodPriorities(periodId); addPrintStatusSpans();
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('print-target'));
  document.querySelectorAll('.round-panel').forEach(p=>p.classList.remove('print-target'));
  document.getElementById('priorities-120').classList.add('print-target');
  document.getElementById(`ppanel-${periodId}`)?.classList.add('print-target');
  document.body.classList.add('printing-single');
  window.print();
  setTimeout(()=>{document.body.classList.remove('printing-single');document.querySelectorAll('.print-target').forEach(el=>el.classList.remove('print-target'));cleanupPrintStatusSpans();},1000);
}

function printRound30(roundId) {
  renderRoundTasks(roundId); addPrintStatusSpans();
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('print-target'));
  document.querySelectorAll('.round-panel').forEach(p=>p.classList.remove('print-target'));
  document.getElementById('todos-30').classList.add('print-target');
  document.getElementById(`panel-${roundId}`)?.classList.add('print-target');
  document.body.classList.add('printing-single');
  window.print();
  setTimeout(()=>{document.body.classList.remove('printing-single');document.querySelectorAll('.print-target').forEach(el=>el.classList.remove('print-target'));cleanupPrintStatusSpans();},1000);
}

function printAll() {
  renderBlueprint(); render120Periods(); render30(); renderSessions(); renderIssues(); updateStats();
  addPrintStatusSpans(); window.print();
  setTimeout(()=>cleanupPrintStatusSpans(),1000);
}

document.getElementById('edit-overlay').addEventListener('click',function(e){if(e.target===this)closeEditModal();});
document.getElementById('bp-edit-overlay').addEventListener('click',function(e){if(e.target===this)closeBpEditModal();});
document.getElementById('modal-overlay').addEventListener('click',function(e){if(e.target===this)closeModal();});
document.getElementById('modal-120-overlay').addEventListener('click',function(e){if(e.target===this)closeNew120Modal();});
document.getElementById('session-edit-overlay').addEventListener('click',function(e){if(e.target===this)closeSessionEditModal();});

renderBlueprint();
render120Periods();
render30();
renderSessions();
renderIssues();
updateStats();

// Nothing needed — playBing handles its own context
migrateOneYear(); // ensure oneyear items are objects
updateLastUpdatedDisplay();
