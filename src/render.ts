// Draw every tab from `state`, e.g. after loading or importing data.

import { migrateOneYear, renderBlueprint } from './sections/blueprint.ts';
import { renderIssues } from './sections/issues.ts';
import { render120Periods } from './sections/periods120.ts';
import { render30 } from './sections/rounds30.ts';
import { renderSessions } from './sections/sessions.ts';
import { updateStats } from './stats.ts';

export function renderAll(): void {
  renderBlueprint();
  render120Periods();
  render30();
  renderSessions();
  renderIssues();
  updateStats();
  migrateOneYear(); // make sure 1-year targets are {text, done} objects
}
