// The Issues & Opportunities tab. The list itself is edited from the blueprint dialog
// (editBlueprint('issues')) and stored in state.blueprint.issues.

import { state } from '../state.ts';

/** Render the list. An "OPPORTUNITY: " prefix is shown as a green "Opportunity:" label. */
export function renderIssues(): void {
  const issEl = document.getElementById('bp-issues-body');
  if (!issEl) return;
  if (!state.blueprint.issues.length) { issEl.innerHTML = `<p style="color:var(--grey-light);font-style:italic">No issues or opportunities logged yet.</p>`; return; }
  issEl.innerHTML = `<ul style="padding-left:18px;list-style:disc;">${state.blueprint.issues.map((i) => { const isOpp = i.startsWith('OPPORTUNITY:'); return `<li style="margin-bottom:6px">${isOpp ? '<strong style="color:var(--lime-dark,#5a8a1a)">Opportunity:</strong> ' + i.replace('OPPORTUNITY: ', '') : i}</li>`; }).join('')}</ul>`;
}
