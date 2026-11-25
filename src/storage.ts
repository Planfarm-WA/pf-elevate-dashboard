// Keeping the dashboard in the browser's localStorage: the whole state as one JSON value. Used in
// local mode (development and the tests); it was the only mode before Supabase.

import { stringifyIds } from './ids.ts';
import type { ImportedData, Persistence } from './persistence.ts';
import { state } from './state.ts';
import type { State } from './types.ts';

/** The localStorage key that holds the whole state as JSON. */
export const STORAGE_KEY = 'pf_elevate_blank1';

/** Show when the data was last saved, in the header. */
export function updateLastUpdatedDisplay(): void {
  const el = document.getElementById('last-updated-display');
  if (!el) return;
  const ts = state.lastUpdated;
  if (!ts) { el.innerHTML = ''; return; }
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  el.innerHTML = '<div style="font-size:10px;opacity:0.7;letter-spacing:0.04em;text-transform:uppercase;">Last updated</div><div style="font-size:12px;font-weight:500;">' + date + ' · ' + time + '</div>';
}

/** What localStorage holds. It isn't validated: the fields are used as they are. */
type SavedData = Partial<State> & { exportedAt?: string };

/** Write the whole state to localStorage and stamp lastUpdated. */
function writeAll(): void {
  try {
    state.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateLastUpdatedDisplay();
  } catch (err) {
    console.error('Could not save to localStorage', err);
  }
}

export const localPersistence: Persistence = {
  /** Load the saved state, if any, into `state`. */
  async load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedData;
        if (parsed.blueprint) {
          state.periods120 = parsed.periods120 || state.periods120;
          state.rounds = parsed.rounds || state.rounds;
          state.sessions = parsed.sessions || state.sessions;
          state.blueprint = parsed.blueprint || state.blueprint;
          state.pendingPushes = parsed.pendingPushes || [];
          state.pendingPushes120 = parsed.pendingPushes120 || [];
          state.lastUpdated = parsed.lastUpdated || parsed.exportedAt || null;
          stringifyIds(state);
        }
      }
    } catch (err) {
      console.error('Could not load saved data from localStorage', err);
    }
  },

  changed: writeAll,

  /** Replace what the file contains (lists it doesn't have are kept), then save. */
  async importData(data: ImportedData) {
    if (data.periods120) state.periods120 = data.periods120;
    if (data.rounds) state.rounds = data.rounds;
    if (data.sessions) state.sessions = data.sessions;
    if (data.blueprint) state.blueprint = data.blueprint;
    state.pendingPushes = data.pendingPushes || []; state.pendingPushes120 = data.pendingPushes120 || [];
    if (data.lastUpdated) state.lastUpdated = data.lastUpdated;
    stringifyIds(state);
    writeAll();
  },
};
