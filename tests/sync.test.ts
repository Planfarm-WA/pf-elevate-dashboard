// Tests for src/sync.ts: which writes diff() produces, and how the syncer runs them.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rowsToState, stateToRows, type LoadedBusiness } from '../src/rows.ts';
import { createSyncer, diff, type Op, type SyncStatus } from '../src/sync.ts';
import type { State } from '../src/types.ts';

function business(): LoadedBusiness {
  return {
    id: 'biz', name: 'Farm',
    blueprint: { ten_year: 'Grow', purpose: 'Feed', core_values: [{ text: 'Care', sort_order: 0 }], three_year_items: [], one_year_targets: [] },
    issues: [],
    periods: [{
      id: 'p1', label: 'Period 1', period: 'Jan', is_current: true, one_year_targets: [], sort_order: 0,
      priorities: [
        { id: 'a', what: 'Fix fences', who: 'Sam', by_when: 'Feb', status: 'none', pushed: false, carried_from: null, sort_order: 0 },
        { id: 'b', what: 'Buy seed', who: 'Alex', by_when: 'Mar', status: 'none', pushed: false, carried_from: null, sort_order: 1 },
      ],
    }],
    rounds: [],
    pendingPriorities: [],
    pendingTasks: [],
    sessions: [],
  };
}

/** Load the business, change the state, and diff before → after. */
function diffAfter(change: (s: State) => void): Op[] {
  const s = rowsToState(business());
  const before = stateToRows(s);
  change(s);
  return diff(before, stateToRows(s));
}

describe('diff', () => {
  it('writes nothing when nothing changed', () => {
    expect(diffAfter(() => {})).toEqual([]);
  });

  it('writes one row for a status change', () => {
    const ops = diffAfter((s) => { s.periods120[0].priorities[0].status = 'on-track'; });
    expect(ops).toEqual([{
      kind: 'upsert', table: 'priorities_120',
      rows: [{ id: 'a', period_id: 'p1', what: 'Fix fences', who: 'Sam', by_when: 'Feb', status: 'on-track', pushed: false, carried_from: null, sort_order: 0 }],
    }]);
  });

  it('writes the rows whose sort_order changed when reordering', () => {
    const ops = diffAfter((s) => { s.periods120[0].priorities.reverse(); });
    expect(ops).toHaveLength(1);
    const rows = (ops[0] as Extract<Op, { kind: 'upsert' }>).rows as Array<{ id: string; sort_order: number }>;
    expect(rows.map((r) => [r.id, r.sort_order])).toEqual([['b', 0], ['a', 1]]);
  });

  it('deletes a removed priority', () => {
    expect(diffAfter((s) => { s.periods120[0].priorities.pop(); })).toEqual([{ kind: 'delete', table: 'priorities_120', ids: ['b'] }]);
  });

  it('deletes children before their period', () => {
    const ops = diffAfter((s) => { s.periods120 = []; });
    expect(ops).toEqual([
      { kind: 'delete', table: 'priorities_120', ids: ['a', 'b'] },
      { kind: 'delete', table: 'periods_120', ids: ['p1'] },
    ]);
  });

  it('turns the old period off before the new one becomes current, then adds its priorities', () => {
    const ops = diffAfter((s) => {
      s.periods120[0].current = false;
      s.periods120.push({ id: 'p2', label: 'Period 2', period: 'May', current: true, oneyear: [], priorities: [
        { id: 'c', what: 'Fix fences', who: 'Sam', when: 'Feb', status: 'none', pushed: false, carriedFrom: 'Period 1' },
      ] });
    });
    expect(ops.map((op) => [op.kind, 'table' in op ? op.table : '', 'rows' in op ? (op.rows as Array<{ id: string }>).map((r) => r.id) : []])).toEqual([
      ['upsert', 'periods_120', ['p1']],
      ['upsert', 'periods_120', ['p2']],
      ['upsert', 'priorities_120', ['c']],
    ]);
  });

  it('replaces a list that changed, and writes the blueprint text first', () => {
    const ops = diffAfter((s) => {
      s.blueprint.values = ['Care', 'Honesty'];
      s.blueprint.tenyear = 'Grow more';
    });
    expect(ops).toEqual([
      { kind: 'blueprint', row: { ten_year: 'Grow more', purpose: 'Feed' } },
      { kind: 'replace', table: 'core_values', rows: [{ text: 'Care', sort_order: 0 }, { text: 'Honesty', sort_order: 1 }] },
    ]);
  });

  it('replaces the queue when a priority is pushed with no next period', () => {
    const ops = diffAfter((s) => {
      s.periods120[0].priorities[0].pushed = true;
      s.pendingPushes120.push({ what: 'Fix fences', who: 'Sam', when: 'Feb', fromPeriod: 'Period 1' });
    });
    expect(ops.map((op) => [op.kind, 'table' in op ? op.table : ''])).toEqual([
      ['replace', 'pending_priorities_120'],
      ['upsert', 'priorities_120'],
    ]);
  });
});

describe('createSyncer', () => {
  afterEach(() => { vi.useRealTimers(); });

  function setup(apply: (ops: Op[]) => Promise<void>) {
    vi.useFakeTimers();
    const s = rowsToState(business());
    const statuses: SyncStatus['state'][] = [];
    const syncer = createSyncer({ snapshot: () => stateToRows(s), apply, onStatus: (st) => statuses.push(st.state), debounceMs: 400, retryMs: [1000, 3000] });
    syncer.reset(stateToRows(s));
    return { s, syncer, statuses };
  }

  it('waits for a pause, then writes all changes at once', async () => {
    const apply = vi.fn(async (ops: Op[]) => { void ops; });
    const { s, syncer, statuses } = setup(apply);
    s.periods120[0].priorities[0].status = 'on-track'; syncer.changed();
    await vi.advanceTimersByTimeAsync(200);
    s.periods120[0].priorities[1].status = 'complete'; syncer.changed();
    expect(syncer.pending()).toBe(true);
    await vi.advanceTimersByTimeAsync(400);
    expect(apply).toHaveBeenCalledTimes(1);
    expect((apply.mock.calls[0][0][0] as Extract<Op, { kind: 'upsert' }>).rows).toHaveLength(2);
    expect(syncer.pending()).toBe(false);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('retries after a failure, then saves', async () => {
    let calls = 0;
    const apply = vi.fn(async (ops: Op[]) => { void ops; calls++; if (calls === 1) throw new Error('offline'); });
    const { s, syncer, statuses } = setup(apply);
    s.blueprint.purpose = 'Feed more'; syncer.changed();
    await vi.advanceTimersByTimeAsync(400);
    expect(statuses.at(-1)).toBe('error');
    expect(syncer.pending()).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1][0]).toEqual(apply.mock.calls[0][0]);
    expect(statuses.at(-1)).toBe('saved');
    expect(syncer.pending()).toBe(false);
  });

  it('runs again for changes made while a write is in progress', async () => {
    let release = () => {};
    const apply = vi.fn((ops: Op[]) => { void ops; return new Promise<void>((resolve) => { release = resolve; }); });
    const { s, syncer } = setup(apply);
    s.blueprint.purpose = 'One'; syncer.changed();
    await vi.advanceTimersByTimeAsync(400);
    s.blueprint.purpose = 'Two'; syncer.changed();
    await vi.advanceTimersByTimeAsync(400);
    release();
    await vi.advanceTimersByTimeAsync(400);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1][0]).toEqual([{ kind: 'blueprint', row: { ten_year: 'Grow', purpose: 'Two' } }]);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(syncer.pending()).toBe(false);
  });

  it('does not write after reset() when nothing changed', async () => {
    const apply = vi.fn(async () => {});
    const { syncer } = setup(apply);
    syncer.changed();
    await vi.advanceTimersByTimeAsync(400);
    expect(apply).not.toHaveBeenCalled();
  });
});
