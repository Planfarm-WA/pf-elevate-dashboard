// Export Data and Import Data in the header. The JSON file is the backup format clients already
// have, so changes to the state shape must still import older exports.

import type { Actions } from './actions.ts';
import { migrateOneYear, renderBlueprint } from './sections/blueprint.ts';
import { renderIssues } from './sections/issues.ts';
import { render120Periods } from './sections/periods120.ts';
import { render30 } from './sections/rounds30.ts';
import { renderSessions } from './sections/sessions.ts';
import { state } from './state.ts';
import { updateStats } from './stats.ts';
import { save, updateLastUpdatedDisplay } from './storage.ts';
import type { ExportFile } from './types.ts';
import { showToast } from './ui.ts';

/** Download the whole state as planfarm-elevate-dashboard-YYYY-MM-DD.json (export version 3). */
function exportData(): void {
  const exportable: ExportFile = { version: 3, exportedAt: new Date().toISOString(), periods120: state.periods120, rounds: state.rounds, sessions: state.sessions, blueprint: state.blueprint, pendingPushes: state.pendingPushes || [], pendingPushes120: state.pendingPushes120 || [] };
  const json = JSON.stringify(exportable, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  const d = new Date();
  a.download = `planfarm-elevate-dashboard-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Data exported successfully');
}

/** What an imported file may hold. Only `version` and `blueprint` are checked. */
type ImportedData = Partial<ExportFile> & { lastUpdated?: string };

/** The file input's change handler: after confirming, replace everything with the file's data. */
function importData(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data: ImportedData;
    try { data = JSON.parse(String(reader.result)) as ImportedData; } catch { alert('Could not read file.'); return; }
    if (!data.version || !data.blueprint) { alert('Not a valid Planfarm data file.'); return; }
    if (!confirm('This will replace all current data. Continue?')) return;
    if (data.periods120) state.periods120 = data.periods120;
    if (data.rounds) state.rounds = data.rounds;
    if (data.sessions) state.sessions = data.sessions;
    if (data.blueprint) state.blueprint = data.blueprint;
    state.pendingPushes = data.pendingPushes || []; state.pendingPushes120 = data.pendingPushes120 || [];
    if (data.lastUpdated) state.lastUpdated = data.lastUpdated;
    save(); migrateOneYear(); renderBlueprint(); render120Periods(); render30(); renderSessions(); renderIssues(); updateStats(); updateLastUpdatedDisplay();
    showToast('Data imported successfully');
  };
  reader.readAsText(file); input.value = '';
}

/** The header's Export Data button and Import Data file input. */
export const ioActions: Actions = {
  exportData,
  importData: (_el, event) => importData(event),
};
