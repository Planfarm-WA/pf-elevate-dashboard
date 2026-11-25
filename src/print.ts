// The Print buttons: the whole dashboard (header), or one period or round (its card).
// The @media print rules in styles.css do the layout: body.printing-single shows only the
// .print-target section and panel, and the .print-status labels are only visible in print.

import { num, type Actions } from './actions.ts';
import { byId } from './dom.ts';
import { renderBlueprint } from './sections/blueprint.ts';
import { renderIssues } from './sections/issues.ts';
import { render120Periods, renderPeriodPriorities } from './sections/periods120.ts';
import { render30, renderRoundTasks } from './sections/rounds30.ts';
import { renderSessions } from './sections/sessions.ts';
import { updateStats } from './stats.ts';

/** The status buttons don't print well, so give every priority/task row a status label. */
function addPrintStatusSpans(): void {
  document.querySelectorAll('.priority-table tbody tr').forEach((tr) => {
    tr.querySelectorAll('.print-status').forEach((el) => el.remove());
    let statusText: string, statusColor: string;
    if (tr.classList.contains('status-complete')) { statusText = '★ Complete'; statusColor = '#5a8a1a'; }
    else if (tr.classList.contains('status-off-track')) { statusText = '✗ Off Track'; statusColor = '#c0392b'; }
    else if (tr.querySelector('.active-on-track')) { statusText = '✓ On Track'; statusColor = '#088A9E'; }
    else { statusText = '— Not Set'; statusColor = '#aaa'; }
    const statusCell = tr.querySelector('td:nth-child(2)');
    if (statusCell) { const span = document.createElement('span'); span.className = 'print-status'; span.style.cssText = `display:none;font-size:10px;font-weight:700;color:${statusColor};background:white;border:1px solid ${statusColor};border-radius:8px;padding:2px 7px;white-space:nowrap;`; span.textContent = statusText; statusCell.prepend(span); }
  });
}

function cleanupPrintStatusSpans(): void {
  document.querySelectorAll('.print-status').forEach((el) => el.remove());
}

export function printPeriod120(periodId: number): void {
  renderPeriodPriorities(periodId); addPrintStatusSpans();
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('print-target'));
  document.querySelectorAll('.round-panel').forEach((p) => p.classList.remove('print-target'));
  byId('priorities-120').classList.add('print-target');
  document.getElementById(`ppanel-${periodId}`)?.classList.add('print-target');
  document.body.classList.add('printing-single');
  window.print();
  setTimeout(() => { document.body.classList.remove('printing-single'); document.querySelectorAll('.print-target').forEach((el) => el.classList.remove('print-target')); cleanupPrintStatusSpans(); }, 1000);
}

export function printRound30(roundId: number): void {
  renderRoundTasks(roundId); addPrintStatusSpans();
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('print-target'));
  document.querySelectorAll('.round-panel').forEach((p) => p.classList.remove('print-target'));
  byId('todos-30').classList.add('print-target');
  document.getElementById(`panel-${roundId}`)?.classList.add('print-target');
  document.body.classList.add('printing-single');
  window.print();
  setTimeout(() => { document.body.classList.remove('printing-single'); document.querySelectorAll('.print-target').forEach((el) => el.classList.remove('print-target')); cleanupPrintStatusSpans(); }, 1000);
}

export function printAll(): void {
  renderBlueprint(); render120Periods(); render30(); renderSessions(); renderIssues(); updateStats();
  addPrintStatusSpans(); window.print();
  setTimeout(() => cleanupPrintStatusSpans(), 1000);
}

/** The header's Print button and the Print button on each period and round card. */
export const printActions: Actions = {
  printAll,
  printPeriod120: (el) => printPeriod120(num(el, 'periodId')),
  printRound30: (el) => printRound30(num(el, 'roundId')),
};
