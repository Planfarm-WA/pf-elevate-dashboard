// Small UI pieces shared by the sections: toasts, the completion sound and the Who badges.

import { esc } from './html.ts';

/** Show a message in the bottom-right corner for about 3 seconds. */
export function showToast(msg: string): void {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:var(--grey-dark);color:white;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);transition:opacity 0.3s`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

/** Older Safari only has the prefixed AudioContext. */
type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

/** The rising three-note "bing" played when an item is marked complete. */
export function playBing(): void {
  try {
    const AudioCtx = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const unlock = ctx.createBufferSource();
    unlock.buffer = ctx.createBuffer(1, 1, 22050);
    unlock.connect(ctx.destination);
    unlock.start(0);
    ctx.resume().then(() => {
      const now = ctx.currentTime;
      const notes: Array<[freq: number, delay: number]> = [[1046.5, 0.0], [1318.5, 0.13], [1568.0, 0.26]];
      notes.forEach(([freq, delay]) => {
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
  } catch (e) {
    console.warn('playBing error:', e);
  }
}

/**
 * Coloured badges for a "Who" value, as HTML. Several names can be separated by "/", "," or "&".
 * The raw value is split and hashed first, and each name is escaped only when it goes into the
 * HTML, so an `&` still separates names and the colours don't depend on escaping.
 */
export function badgeFor(who: string): string {
  if (!who) return '';
  const palette = ['badge-rob', 'badge-kellie', 'badge-paul', 'badge-peter', 'badge-robkellie', 'badge-team'];
  return who.split(/[/,&]/).map((w) => {
    w = w.trim();
    let hash = 0;
    for (let i = 0; i < w.length; i++) hash = (hash * 31 + w.charCodeAt(i)) >>> 0;
    const cls = palette[hash % palette.length];
    return `<span class="badge ${cls}">${esc(w)}</span>`;
  }).join(' ');
}
