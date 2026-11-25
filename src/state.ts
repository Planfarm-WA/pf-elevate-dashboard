import type { State } from './types.ts';

/** A dashboard with nothing in it. */
export function emptyState(): State {
  return {
    periods120: [],
    rounds: [],
    sessions: [],
    blueprint: {
      tenyear: '',
      threeyear: '',
      values: [],
      oneyear: [],
      purpose: '',
      issues: [],
    },
    pendingPushes: [],
    pendingPushes120: [],
  };
}

/**
 * The whole dashboard, shared by every module. Every change follows the same pattern: change
 * `state`, call save(), then re-render the section that changed.
 */
export const state: State = emptyState();
