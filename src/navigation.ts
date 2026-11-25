// The nav tabs at the top of the page.

import { byId } from './dom.ts';
import { renderBlueprint } from './sections/blueprint.ts';
import { renderIssues } from './sections/issues.ts';
import { render120Periods } from './sections/periods120.ts';
import { render30 } from './sections/rounds30.ts';
import { renderSessions } from './sections/sessions.ts';
import { updateStats } from './stats.ts';

/** The id of each tab's .section element in index.html. */
export type SectionId = 'blueprint' | 'priorities-120' | 'todos-30' | 'issues-opportunities' | 'coaching';

/** Show a tab's section and re-render it. `el` is the clicked tab (`this` in its handler). */
export function showSection(id: SectionId, el?: HTMLElement | null): void {
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
  byId(id).classList.add('active');
  if (el) el.classList.add('active');
  if (id === 'priorities-120') { render120Periods(); }
  if (id === 'issues-opportunities') { renderIssues(); }
  if (id === 'todos-30') render30();
  if (id === 'blueprint') { renderBlueprint(); updateStats(); }
  if (id === 'coaching') renderSessions();
}
