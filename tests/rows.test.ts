// Tests for src/rows.ts: loading a business's rows into `state`, and turning `state` back into rows.
import { describe, expect, it } from 'vitest';
import { rowsToState, stateToRows, type LoadedBusiness } from '../src/rows.ts';

/** A business as the backend loads it. Rows are deliberately out of order, as a database may return them. */
function loaded(): LoadedBusiness {
  return {
    id: 'biz-1',
    name: 'ABC Holdings',
    blueprint: {
      ten_year: 'Grow\n\nExpand',
      purpose: 'Feed people',
      core_values: [{ text: 'Care', sort_order: 1 }, { text: 'Honesty', sort_order: 0 }],
      three_year_items: [{ text: 'Debt free', done: true, sort_order: 1 }, { text: 'New shed', done: false, sort_order: 0 }],
      one_year_targets: [{ text: 'Hire a manager', done: true, sort_order: 0 }],
    },
    issues: [
      { kind: 'opportunity', text: 'Solar grant', sort_order: 1 },
      { kind: 'issue', text: 'Water supply', sort_order: 0 },
    ],
    periods: [
      {
        id: 'p2', label: 'Period 2', period: 'May', is_current: true, one_year_targets: [], sort_order: 1,
        priorities: [{ id: 'x3', what: 'Buy seed', who: 'Team', by_when: 'TBC', status: 'none', pushed: false, carried_from: 'Period 1', sort_order: 0 }],
      },
      {
        id: 'p1', label: 'Period 1', period: 'Jan', is_current: false, one_year_targets: ['Target A'], sort_order: 0,
        priorities: [
          { id: 'x2', what: 'Buy seed', who: 'Team', by_when: 'TBC', status: 'on-track', pushed: true, carried_from: null, sort_order: 1 },
          { id: 'x1', what: 'Fix fences', who: 'Sam', by_when: 'Feb', status: 'complete', pushed: false, carried_from: null, sort_order: 0 },
        ],
      },
    ],
    rounds: [
      {
        id: 'r1', label: 'Round 1', period: 'May', is_current: true, notes: 'Good session', sort_order: 0,
        tasks: [{ id: 't1', what: 'Order fuel', who: 'Sam', by_when: '10 May', status: 'off-track', pushed: false, carried_from: null, sort_order: 0 }],
      },
    ],
    pendingPriorities: [
      { what: 'Second', who: '', by_when: '', from_period: 'Period 2', created_at: '2026-05-01T00:00:00.002Z' },
      { what: 'First', who: '', by_when: '', from_period: 'Period 2', created_at: '2026-05-01T00:00:00.001Z' },
    ],
    pendingTasks: [],
    sessions: [
      { id: 's2', session_date: '1 June', format: '', focus: 'Round 2 review', notes: '', done: false, sort_order: 1 },
      { id: 's1', session_date: '1 May', format: 'Teams', focus: 'Round 1 review', notes: 'Bring numbers', done: true, sort_order: 0 },
    ],
  };
}

describe('rowsToState', () => {
  it('builds the blueprint the page expects', () => {
    const { blueprint } = rowsToState(loaded());
    expect(blueprint).toEqual({
      tenyear: 'Grow\n\nExpand',
      threeyear: 'New shed\n\nDebt free',
      threeyearDone: { 1: true },
      values: ['Honesty', 'Care'],
      oneyear: [{ text: 'Hire a manager', done: true }],
      purpose: 'Feed people',
      issues: ['Water supply', 'OPPORTUNITY: Solar grant'],
    });
  });

  it('sorts periods, priorities, rounds, tasks and sessions, and maps their fields', () => {
    const s = rowsToState(loaded());
    expect(s.periods120.map((p) => [p.id, p.label, p.current, p.oneyear])).toEqual([
      ['p1', 'Period 1', false, ['Target A']],
      ['p2', 'Period 2', true, []],
    ]);
    expect(s.periods120[0].priorities).toEqual([
      { id: 'x1', what: 'Fix fences', who: 'Sam', when: 'Feb', status: 'complete', pushed: false },
      { id: 'x2', what: 'Buy seed', who: 'Team', when: 'TBC', status: 'on-track', pushed: true },
    ]);
    expect(s.periods120[1].priorities[0].carriedFrom).toBe('Period 1');
    expect(s.rounds[0]).toMatchObject({ id: 'r1', current: true, notes: 'Good session' });
    expect(s.sessions.map((x) => [x.id, x.date, x.done])).toEqual([['s1', '1 May', true], ['s2', '1 June', false]]);
  });

  it('keeps the queues in created_at order', () => {
    expect(rowsToState(loaded()).pendingPushes120.map((p) => p.what)).toEqual(['First', 'Second']);
  });

  it('copes with a business that has no blueprint row', () => {
    const b = { ...loaded(), blueprint: null };
    expect(rowsToState(b).blueprint).toMatchObject({ tenyear: '', threeyear: '', values: [], oneyear: [], purpose: '' });
  });
});

describe('stateToRows', () => {
  it('turns loaded state back into the same rows (so opening a business writes nothing)', () => {
    const b = loaded();
    const snap = stateToRows(rowsToState(b));
    expect(snap.blueprint).toEqual({ ten_year: 'Grow\n\nExpand', purpose: 'Feed people' });
    expect(snap.coreValues).toEqual([{ text: 'Honesty', sort_order: 0 }, { text: 'Care', sort_order: 1 }]);
    expect(snap.threeYearItems).toEqual([{ text: 'New shed', done: false, sort_order: 0 }, { text: 'Debt free', done: true, sort_order: 1 }]);
    expect(snap.oneYearTargets).toEqual([{ text: 'Hire a manager', done: true, sort_order: 0 }]);
    expect(snap.issues).toEqual([{ kind: 'issue', text: 'Water supply', sort_order: 0 }, { kind: 'opportunity', text: 'Solar grant', sort_order: 1 }]);
    expect(snap.periods).toEqual({
      p1: { id: 'p1', label: 'Period 1', period: 'Jan', is_current: false, one_year_targets: ['Target A'], sort_order: 0 },
      p2: { id: 'p2', label: 'Period 2', period: 'May', is_current: true, one_year_targets: [], sort_order: 1 },
    });
    for (const p of b.periods) {
      for (const x of p.priorities) expect(snap.priorities[x.id]).toEqual({ ...x, period_id: p.id });
    }
    for (const r of b.rounds) {
      const { tasks, ...round } = r;
      expect(snap.rounds[r.id]).toEqual(round);
      for (const t of tasks) expect(snap.tasks[t.id]).toEqual({ ...t, round_id: r.id });
    }
    for (const x of b.sessions) expect(snap.sessions[x.id]).toEqual(x);
    expect(snap.pendingPriorities).toEqual([
      { what: 'First', who: '', by_when: '', from_period: 'Period 2' },
      { what: 'Second', who: '', by_when: '', from_period: 'Period 2' },
    ]);
  });

  it('is stable: converting twice gives the same rows', () => {
    const first = stateToRows(rowsToState(loaded()));
    const again = stateToRows(rowsToState(loaded()));
    expect(again).toEqual(first);
  });

  it('keeps only the last period marked current, and converts legacy 1-year strings', () => {
    const s = rowsToState(loaded());
    s.periods120.forEach((p) => { p.current = true; });
    (s.blueprint.oneyear as unknown[]).push('Legacy target');
    const snap = stateToRows(s);
    expect(Object.values(snap.periods).map((p) => [p.id, p.is_current])).toEqual([['p1', false], ['p2', true]]);
    expect(snap.oneYearTargets.at(-1)).toEqual({ text: 'Legacy target', done: false, sort_order: 1 });
  });
});
