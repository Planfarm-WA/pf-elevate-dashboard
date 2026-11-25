// Tests for src/adapters.ts: checking an export file and turning it into table rows.
// The fixture is a made-up version 3 export that covers the awkward cases.
import { describe, expect, it } from 'vitest';
import { ExportFileError, exportToRows, parseExportFile } from '../src/adapters.ts';
import fixtureText from './fixtures/export-v3.json?raw';

/** A fresh copy of the fixture as plain JSON, so a test can change it. */
function fixture(): Record<string, unknown> {
  return JSON.parse(fixtureText) as Record<string, unknown>;
}

function rows(json: unknown = fixture()) {
  return exportToRows(parseExportFile(json));
}

describe('exportToRows', () => {
  it('maps the blueprint text and values', () => {
    const r = rows();
    expect(r.blueprint).toEqual({ ten_year: 'Grow the farm\n\nBuy the neighbour block', purpose: 'Feed people' });
    expect(r.coreValues).toEqual([
      { text: 'Honesty', sort_order: 0 },
      { text: 'Care', sort_order: 1 },
    ]);
  });

  it('splits the 3-year picture like the page does: trim, drop empty items, then index the ticks', () => {
    expect(rows().threeYearItems).toEqual([
      { text: 'New shed', done: false, sort_order: 0 },
      { text: 'Debt free', done: true, sort_order: 1 },
      { text: 'Second house', done: false, sort_order: 2 },
    ]);
  });

  it('converts legacy 1-year targets stored as plain strings', () => {
    expect(rows().oneYearTargets).toEqual([
      { text: 'Legacy target', done: false, sort_order: 0 },
      { text: 'Hire a manager', done: true, sort_order: 1 },
    ]);
  });

  it('turns the OPPORTUNITY: prefix into kind, with or without a space after it', () => {
    expect(rows().issues).toEqual([
      { kind: 'issue', text: 'Water supply', sort_order: 0 },
      { kind: 'opportunity', text: 'Solar grant', sort_order: 1 },
      { kind: 'opportunity', text: 'Carbon credits', sort_order: 2 },
    ]);
  });

  it('maps periods and priorities, keeping only the last current period', () => {
    const periods = rows().periods ?? [];
    expect(periods.map((p) => p.period)).toEqual([
      { label: 'Period 1', period: 'Jan – Apr 2026', is_current: false, one_year_targets: ['Target A'], sort_order: 0 },
      { label: 'Period 2', period: 'May – Aug 2026', is_current: true, one_year_targets: [], sort_order: 1 },
    ]);
    expect(periods[0].priorities).toEqual([
      { what: 'Fix fences', who: 'Sam', by_when: 'Feb', status: 'complete', pushed: false, carried_from: null, sort_order: 0 },
      { what: 'Buy seed', who: 'Team', by_when: 'TBC', status: 'on-track', pushed: true, carried_from: null, sort_order: 1 },
    ]);
    expect(periods[1].priorities).toEqual([
      { what: 'Buy seed', who: 'Team', by_when: 'TBC', status: 'none', pushed: false, carried_from: 'Period 1', sort_order: 0 },
    ]);
  });

  it('maps rounds and tasks, with default notes and status', () => {
    const rounds = rows().rounds ?? [];
    expect(rounds.map((r) => r.round)).toEqual([
      { label: 'Round 1', period: 'May', is_current: true, notes: 'Good session', sort_order: 0 },
      { label: 'Round 2', period: 'June', is_current: false, notes: '', sort_order: 1 },
    ]);
    expect(rounds[0].tasks.map((t) => [t.what, t.status, t.pushed])).toEqual([
      ['Order fuel', 'off-track', true],
      ['Book vet', 'on-track', false],
    ]);
    expect(rounds[1].tasks).toEqual([
      { what: 'Order fuel', who: 'Sam', by_when: '10 May', status: 'none', pushed: false, carried_from: 'Round 1', sort_order: 0 },
    ]);
  });

  it('keeps the queues in order', () => {
    const r = rows();
    expect(r.pendingTasks).toEqual([
      { what: 'Fix pump', who: 'Alex', by_when: 'June', from_round: 'Round 2' },
      { what: 'Spray weeds', who: 'Sam', by_when: 'June', from_round: 'Round 2' },
      { what: 'Check troughs', who: 'Team', by_when: 'TBC', from_round: 'Round 2' },
    ]);
    expect(r.pendingPriorities).toEqual([{ what: 'Sell cattle', who: 'Sam', by_when: 'Aug', from_period: 'Period 2' }]);
  });

  it('maps sessions', () => {
    expect(rows().sessions).toEqual([
      { session_date: '1 May 2026', format: 'Teams', focus: 'Round 1 review', notes: 'Bring numbers', done: true, sort_order: 0 },
      { session_date: '1 June 2026', format: '', focus: 'Round 2 review', notes: '', done: false, sort_order: 1 },
    ]);
  });

  it('leaves out lists the file does not have, so importing keeps them; missing queues are empty', () => {
    const json = fixture();
    delete json.periods120;
    json.rounds = null;
    delete json.sessions;
    delete json.pendingPushes;
    delete json.pendingPushes120;
    const r = rows(json);
    expect(r.periods).toBeUndefined();
    expect(r.rounds).toBeUndefined();
    expect(r.sessions).toBeUndefined();
    expect(r.pendingTasks).toEqual([]);
    expect(r.pendingPriorities).toEqual([]);
  });

  it('treats an empty list as "replace with nothing"', () => {
    const json = fixture();
    json.sessions = [];
    expect(rows(json).sessions).toEqual([]);
  });

  it('fills in missing text with empty strings', () => {
    const r = rows({ version: 3, blueprint: { oneyear: [{}] }, periods120: [{ priorities: [{}] }] });
    expect(r.blueprint).toEqual({ ten_year: '', purpose: '' });
    expect(r.oneYearTargets).toEqual([{ text: '', done: false, sort_order: 0 }]);
    expect(r.periods?.[0].period).toEqual({ label: '', period: '', is_current: false, one_year_targets: [], sort_order: 0 });
    expect(r.periods?.[0].priorities[0]).toMatchObject({ what: '', who: '', by_when: '', status: 'none', pushed: false });
  });
});

describe('parseExportFile', () => {
  it.each([
    ['no version', { blueprint: {} }],
    ['no blueprint', { version: 3 }],
    ['not an object', ['version', 3]],
  ])('rejects a file with %s', (_label, json) => {
    expect(() => parseExportFile(json)).toThrow('Not a valid Planfarm data file');
  });

  it('names the field when a status is unknown', () => {
    const json = fixture();
    const periods = json.periods120 as Array<{ priorities: Array<{ status: string }> }>;
    periods[0].priorities[1].status = 'done';
    expect(() => parseExportFile(json)).toThrow(ExportFileError);
    expect(() => parseExportFile(json)).toThrow(
      'periods120[0].priorities[1].status is "done"; expected none, on-track, off-track, complete',
    );
  });

  it('rejects a list that is not a list', () => {
    expect(() => parseExportFile({ version: 3, blueprint: {}, rounds: { a: 1 } })).toThrow('rounds must be a list');
  });

  it('rejects a 1-year target that is neither text nor an object', () => {
    expect(() => parseExportFile({ version: 3, blueprint: { oneyear: [42] } })).toThrow('blueprint.oneyear[0] must be an object');
  });
});
