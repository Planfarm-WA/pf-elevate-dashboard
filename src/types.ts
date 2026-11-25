// The dashboard's data, as saved in localStorage and in exported files (export version 3).

/** Status of a 120-day priority or a 30-day task. Clicking the active status sets it back to 'none'. */
export type Status = 'none' | 'on-track' | 'off-track' | 'complete';

/** A 120-day priority or a 30-day task. */
export interface Item {
  /** Unique within its period or round: the highest id there + 1. */
  id: number;
  what: string;
  who: string;
  /** Free text, e.g. "Jun 2026" or "TBC". */
  when: string;
  status: Status;
  /** Pushed into the next period or round (shown as "Pushed ✓"). */
  pushed: boolean;
  /** Label of the period or round it was carried over from. */
  carriedFrom?: string;
}

export interface Period120 {
  /** Date.now() when the period was created. */
  id: number;
  label: string;
  /** Free-text date range. */
  period: string;
  current: boolean;
  /** Targets typed into the New Period dialog. Saved but never shown. Older exports may not have it. */
  oneyear?: string[];
  priorities: Item[];
}

export interface Round30 {
  /** Date.now() when the round was created. */
  id: number;
  label: string;
  /** Free-text date range. */
  period: string;
  current: boolean;
  /** Coaching session notes for the round. Older exports may not have it. */
  notes?: string;
  tasks: Item[];
}

export interface Session {
  id: number;
  /** Free text, e.g. "1 May 2026". */
  date: string;
  format: string;
  focus: string;
  notes: string;
  done: boolean;
}

export interface OneYearTarget {
  text: string;
  done: boolean;
}

export interface Blueprint {
  /** Paragraphs separated by blank lines. */
  tenyear: string;
  /** 3-year items, separated by blank lines. */
  threeyear: string;
  /** Ticked 3-year items, by position. Reset whenever the 3-year text is edited. */
  threeyearDone?: Record<number, boolean>;
  values: string[];
  /** Older saves hold plain strings here; migrateOneYear() converts them. */
  oneyear: OneYearTarget[];
  purpose: string;
  /** One per line. An "OPPORTUNITY: " prefix marks an opportunity. */
  issues: string[];
}

/** A priority pushed while there was no next period. It's added to the next period created. */
export interface PendingPriority120 {
  what: string;
  who: string;
  when: string;
  fromPeriod: string;
}

/** A task pushed while there was no next round. It's added to the next round created. */
export interface PendingTask30 {
  what: string;
  who: string;
  when: string;
  fromRound: string;
}

export interface State {
  periods120: Period120[];
  rounds: Round30[];
  sessions: Session[];
  blueprint: Blueprint;
  pendingPushes: PendingTask30[];
  pendingPushes120: PendingPriority120[];
  /** ISO time of the last save. */
  lastUpdated?: string | null;
}

/** The file written by Export Data. */
export interface ExportFile {
  version: number;
  exportedAt: string;
  periods120: Period120[];
  rounds: Round30[];
  sessions: Session[];
  blueprint: Blueprint;
  pendingPushes: PendingTask30[];
  pendingPushes120: PendingPriority120[];
}
