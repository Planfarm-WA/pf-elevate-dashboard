import { byId } from './dom.ts';
import { state } from './state.ts';

/**
 * Write the current period's and round's numbers into the hidden #stat-* divs. The stats row that
 * showed them was removed, but the divs must stay in index.html or this throws.
 */
export function updateStats(): void {
  const current120 = state.periods120.length ? state.periods120[state.periods120.length - 1] : null;
  byId('stat-120-done').textContent = String(current120 ? current120.priorities.filter((p) => p.status === 'complete').length : 0);
  byId('stat-120-ontrack').textContent = String(current120 ? current120.priorities.filter((p) => p.status === 'on-track').length : 0);
  const current30 = state.rounds.length ? state.rounds[state.rounds.length - 1] : null;
  if (current30) {
    const done30 = current30.tasks.filter((t) => t.status === 'complete').length;
    byId('stat-30-done').textContent = `${done30} / ${current30.tasks.length}`;
    const pct = current30.tasks.length ? Math.round(done30 / current30.tasks.length * 100) : 0;
    byId('stat-30-ontrack').textContent = pct + '%';
  }
}
