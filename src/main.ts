// @ts-nocheck -- untyped code carried over from the single-file dashboard
// Each function gets types when it moves into its own module (CLAUDE.md to-do,
// "Split src/main.ts into modules"). Remove this line once the file is typed or empty.

import { closeEditModal, saveEdit } from './edit-modal.ts';
import {
  addOneYearTarget, closeBpEditModal, deleteOneYearTarget, editBlueprint, editOneYearTarget,
  migrateOneYear, renderBlueprint, saveBpEdit, toggleOneYearDone, toggleThreeYearDone,
} from './sections/blueprint.ts';
import { renderIssues } from './sections/issues.ts';
import {
  add120TaskRow, addPriority120, closeNew120Modal, createPeriod120, deletePriority120, editItem120,
  pushPriority120, remove120TaskRow, render120Periods, renderPeriodPriorities, setStatus120, showNew120Modal,
} from './sections/periods120.ts';
import {
  addTask30, addTaskRow, closeModal, createRound, deleteTask30, editItem30, pushTask, removeTaskRow,
  render30, renderRoundTasks, saveRoundNotes, setStatus30, showNewRoundModal,
} from './sections/rounds30.ts';
import {
  addNote, closeSessionEditModal, deleteSession, editSession, renderSessions, saveSessionEdit,
  showAddSessionModal,
} from './sections/sessions.ts';
import { state } from './state.ts';
import { updateStats } from './stats.ts';
import { loadSaved, save, updateLastUpdatedDisplay } from './storage.ts';
import { showToast } from './ui.ts';

loadSaved();

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

// Inline handlers (on*="..." in index.html and in the template strings above)
// call these functions by name, but module code isn't global, so this puts
// them on window. Remove each entry once its handler moves to event delegation.
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
