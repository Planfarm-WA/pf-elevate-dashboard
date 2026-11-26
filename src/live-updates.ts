// Live updates (Supabase mode): while a business is open, reload it now and then, so changes made
// on another device show up without reloading the page. session.ts starts and stops this; its
// `reload` callback does the reloading and decides whether it's safe (supabase-persistence.ts).

import { isDragging } from './drag.ts';

/** How often to reload while the tab is visible. */
export const REFRESH_EVERY_MS = 60_000;

/** The running copy's stop function, kept on `document` so starting again always stops the old one
 * (the tests re-run startup, and Vite can reload this module). */
const STOP = Symbol.for('pf-elevate:live-updates');
type DocumentWithStop = Document & { [STOP]?: () => void };

/**
 * Call `reload` when the tab becomes visible again, when the network comes back, and every
 * `everyMs` while the tab is visible. One reload at a time; the timer restarts after each one.
 */
export function startLiveUpdates(reload: () => Promise<void>, everyMs = REFRESH_EVERY_MS): void {
  stopLiveUpdates();
  let stopped = false;
  let running = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function schedule(): void {
    clearTimer();
    if (!stopped) timer = setTimeout(() => { timer = null; trigger(); }, everyMs);
  }

  function trigger(): void {
    if (stopped) return;
    if (document.visibilityState === 'visible') void run();
    else schedule();
  }

  async function run(): Promise<void> {
    if (running) { again = true; return; }
    running = true;
    clearTimer();
    try {
      await reload();
    } catch (err) {
      console.error(err);
    } finally {
      running = false;
      if (again) { again = false; trigger(); } else schedule();
    }
  }

  document.addEventListener('visibilitychange', trigger);
  window.addEventListener('online', trigger);
  schedule();
  (document as DocumentWithStop)[STOP] = () => {
    stopped = true;
    clearTimer();
    document.removeEventListener('visibilitychange', trigger);
    window.removeEventListener('online', trigger);
  };
}

export function stopLiveUpdates(): void {
  const doc = document as DocumentWithStop;
  doc[STOP]?.();
  doc[STOP] = undefined;
}

/**
 * True while a redraw would get in the user's way: an edit dialog is open, the New Period or New
 * Round dialog is open, the cursor is in a box on the dashboard (a round's notes save on every
 * keystroke), or a row is being dragged.
 */
export function userIsBusy(): boolean {
  if (document.querySelector('.edit-overlay.open')) return true;
  for (const id of ['modal-overlay', 'modal-120-overlay']) {
    if (document.getElementById(id)?.style.display === 'flex') return true;
  }
  const focused = document.activeElement;
  if (focused?.closest('#dashboard') && focused.matches('input, textarea, select')) return true;
  return isDragging();
}
