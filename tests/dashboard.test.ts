// @vitest-environment jsdom
/**
 * Smoke tests for the dashboard. Each test loads the real page markup, runs src/main.ts the way
 * the browser does, then acts like a user: act() dispatches real DOM events on the buttons (found
 * by their data-click / data-input / data-change attributes), it types into the dialogs, and it
 * checks the page and the data saved in localStorage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../index.html?raw';
import { $, $$, act, pageBody, setValue, value } from './helpers.ts';

const STORAGE_KEY = 'pf_elevate_blank1';

// ---- The saved data, as these tests read it back from localStorage ----

/** Ids are UUID strings; older saved data and export files used numbers (still accepted on load). */
type Id = string | number;

interface SavedItem {
  id: Id;
  what: string;
  who: string;
  when: string;
  status: string;
  pushed: boolean;
  carriedFrom?: string;
}
interface SavedPeriod {
  id: Id;
  label: string;
  period: string;
  current: boolean;
  oneyear?: string[];
  priorities: SavedItem[];
}
interface SavedRound {
  id: Id;
  label: string;
  period: string;
  current: boolean;
  notes?: string;
  tasks: SavedItem[];
}
interface SavedSession {
  id: Id;
  date: string;
  format: string;
  focus: string;
  notes: string;
  done: boolean;
}
interface SavedPending {
  what: string;
  who: string;
  when: string;
  fromPeriod?: string;
  fromRound?: string;
}
interface Saved {
  periods120: SavedPeriod[];
  rounds: SavedRound[];
  sessions: SavedSession[];
  blueprint: {
    tenyear: string;
    threeyear: string;
    threeyearDone?: Record<string, boolean>;
    values: string[];
    oneyear: Array<{ text: string; done: boolean } | string>;
    purpose: string;
    issues: string[];
  };
  pendingPushes: SavedPending[];
  pendingPushes120: SavedPending[];
  lastUpdated?: string;
}

function fixture(overrides: Partial<Saved> = {}): Saved {
  return {
    periods120: [],
    rounds: [],
    sessions: [],
    blueprint: { tenyear: '', threeyear: '', values: [], oneyear: [], purpose: '', issues: [] },
    pendingPushes: [],
    pendingPushes120: [],
    ...overrides,
  };
}

// ---- Helpers ----

/** Run startup exactly as the browser does, optionally with data already saved. */
async function startApp(savedData?: Saved): Promise<void> {
  if (savedData) localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
  const { ready } = await import('../src/main.ts');
  await ready;
}

function saved(): Saved {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('Nothing has been saved');
  return JSON.parse(raw) as Saved;
}

/** Fill the shared edit dialog (#edit-overlay) and press Save. */
function saveEditDialog(fields: { what?: string; who?: string; when?: string }): void {
  if (fields.what !== undefined) setValue('#ef-what', fields.what);
  if (fields.who !== undefined) setValue('#ef-who', fields.who);
  if (fields.when !== undefined) setValue('#ef-when', fields.when);
  act('saveEdit');
}

function editBlueprint(section: string, text: string): void {
  act('editBlueprint', { section });
  expect($('#bp-edit-overlay').classList.contains('open')).toBe(true);
  setValue('#bp-edit-val', text);
  act('saveBpEdit');
}

type Row = [what: string, who?: string, when?: string];

function fillRows(container: string, rows: Row[]): void {
  const formRows = $$(`${container} .form-row`);
  rows.forEach(([what, who = '', when = ''], i) => {
    const inputs = formRows[i]?.querySelectorAll('input');
    if (!inputs) throw new Error(`The dialog has no row ${i + 1}`);
    inputs[0].value = what;
    inputs[1].value = who;
    inputs[2].value = when;
  });
}

function createPeriod(label: string, period: string, rows: Row[] = []): Id {
  act('showNew120Modal');
  setValue('#new-120-label', label);
  setValue('#new-120-period', period);
  fillRows('#task-rows-120', rows);
  act('createPeriod120');
  const created = saved().periods120.at(-1);
  if (!created) throw new Error('No period was created');
  return created.id;
}

function createRound(label: string, period: string, rows: Row[] = []): Id {
  act('showNewRoundModal');
  setValue('#new-round-label', label);
  setValue('#new-round-period', period);
  fillRows('#task-rows', rows);
  act('createRound');
  const created = saved().rounds.at(-1);
  if (!created) throw new Error('No round was created');
  return created.id;
}

function priority(periodIndex: number, id: Id): SavedItem {
  const found = saved().periods120[periodIndex]?.priorities.find((p) => p.id === id);
  if (!found) throw new Error(`No priority ${id} in period ${periodIndex}`);
  return found;
}

function task(roundIndex: number, id: Id): SavedItem {
  const found = saved().rounds[roundIndex]?.tasks.find((t) => t.id === id);
  if (!found) throw new Error(`No task ${id} in round ${roundIndex}`);
  return found;
}

/** The id of the priority at `position` in a period (ids are random UUIDs, so tests look them up). */
function priorityId(periodIndex: number, position: number): Id {
  const item = saved().periods120[periodIndex]?.priorities[position];
  if (!item) throw new Error(`No priority at position ${position} in period ${periodIndex}`);
  return item.id;
}

function taskId(roundIndex: number, position: number): Id {
  const item = saved().rounds[roundIndex]?.tasks[position];
  if (!item) throw new Error(`No task at position ${position} in round ${roundIndex}`);
  return item.id;
}

/** Older data uses numeric ids; loading or importing it turns them into strings. */
function withStringIds<T extends { id: Id }>(items: T[]): T[] {
  return items.map((item) => ({ ...item, id: String(item.id) }));
}

function isOpen(overlay: string): boolean {
  return $(overlay).classList.contains('open');
}

/** jsdom has no drag data, so dispatch the four drag events with a stand-in dataTransfer. */
function drag(source: Element, target: Element): void {
  const dataTransfer = { effectAllowed: '', dropEffect: '' };
  const steps: Array<[Element, string]> = [
    [source, 'dragstart'],
    [target, 'dragover'],
    [target, 'drop'],
    [source, 'dragend'],
  ];
  for (const [el, type] of steps) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    el.dispatchEvent(event);
  }
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Choose a file in the header's Import input, as the user does. */
function importFile(file: File): void {
  const input = $('input[type="file"]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Every action named in data-click/input/change/submit attributes (or set via el.dataset.click = '…') in `text`. */
function actionNames(text: string): Set<string> {
  const attributes = [...text.matchAll(/\bdata-(?:click|input|change|submit)="([A-Za-z0-9_]+)"/g)];
  const assigned = [...text.matchAll(/\bdataset\.(?:click|input|change|submit)\s*=\s*'([A-Za-z0-9_]+)'/g)];
  return new Set([...attributes, ...assigned].map((m) => m[1]));
}

/** The page's markup and source as text: index.html plus every .ts file under src/. */
function markupAndSources(): string[] {
  const sources = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
  return [indexHtml, ...Object.values(sources)];
}

// ---- Setup ----

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = pageBody();
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('print', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- Tests ----

describe('startup', () => {
  it('shows the empty states when nothing is saved', async () => {
    await startApp();
    expect($('#period-panels-120').textContent).toContain('No periods yet.');
    expect($('#round-panels').textContent).toContain('No rounds yet.');
    expect($('#bp-threeyear-body').textContent).toContain('No items yet.');
    expect($('#bp-oneyear-body').textContent).toContain('No targets set yet.');
    expect($('#bp-issues-body').textContent).toContain('No issues or opportunities logged yet.');
    expect($('#last-updated-display').innerHTML).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('shows saved data and converts legacy 1-year targets', async () => {
    await startApp(
      fixture({
        periods120: [{ id: 7, label: 'Period 1', period: 'Jan', current: true, oneyear: [], priorities: [] }],
        rounds: [{ id: 8, label: 'Round 1', period: 'May', current: true, notes: 'Went well', tasks: [] }],
        sessions: [{ id: 1, date: '1 May', format: 'Teams', focus: 'Kick-off', notes: '', done: false }],
        blueprint: {
          tenyear: 'Grow',
          threeyear: '',
          values: ['Care'],
          oneyear: ['Old target'],
          purpose: 'Feed people',
          issues: [],
        },
        lastUpdated: '2026-05-01T02:30:00.000Z',
      }),
    );
    expect($('#ptab-7').textContent).toBe('Period 1');
    expect($('#tab-8').textContent).toBe('Round 1');
    expect(value('#notes-8')).toBe('Went well');
    expect($('#sessions-tbody').textContent).toContain('Kick-off');
    expect($('#bp-values-body').textContent).toBe('Care');
    expect($('#bp-oneyear-body').textContent).toContain('Old target');
    expect($('#last-updated-display').textContent).toContain('Last updated');

    act('toggleOneYearDone', { idx: 0 });
    expect(saved().blueprint.oneyear).toEqual([{ text: 'Old target', done: true }]);
  });
});

describe('blueprint', () => {
  it('edits the text sections, values and issues', async () => {
    await startApp();
    editBlueprint('tenyear', 'Grow the farm\n\nBuy the neighbour block');
    editBlueprint('purpose', 'Feed people');
    editBlueprint('values', 'Honesty\n  Care \n\n');
    editBlueprint('issues', 'Water supply\nOPPORTUNITY: Solar grant');

    expect($$('#bp-tenyear-body p').map((p) => p.textContent)).toEqual(['Grow the farm', 'Buy the neighbour block']);
    expect($('#bp-purpose-body').textContent).toBe('Feed people');
    expect($$('#bp-values-body .value-pill').map((v) => v.textContent)).toEqual(['Honesty', 'Care']);
    const issues = $$('#bp-issues-body li');
    expect(issues.map((li) => li.textContent)).toEqual(['Water supply', 'Opportunity: Solar grant']);
    expect(issues[1].querySelector('strong')?.textContent).toBe('Opportunity:');
    expect(saved().blueprint).toMatchObject({
      tenyear: 'Grow the farm\n\nBuy the neighbour block',
      purpose: 'Feed people',
      values: ['Honesty', 'Care'],
      issues: ['Water supply', 'OPPORTUNITY: Solar grant'],
    });
    expect(isOpen('#bp-edit-overlay')).toBe(false);
  });

  it('ticks 3-year items and clears the ticks when the text is edited', async () => {
    await startApp();
    editBlueprint('threeyear', 'New shed\n\nDebt free');
    expect($$('#bp-threeyear-body li')).toHaveLength(2);

    act('toggleThreeYearDone', { idx: 1 });
    expect(saved().blueprint.threeyearDone).toEqual({ 1: true });
    act('toggleThreeYearDone', { idx: 1 });
    act('toggleThreeYearDone', { idx: 0 });
    expect(saved().blueprint.threeyearDone).toEqual({ 0: true, 1: false });

    editBlueprint('threeyear', 'New shed\n\nDebt free\n\nSecond house');
    expect(saved().blueprint.threeyearDone).toEqual({});
  });

  it('adds, edits, ticks and deletes 1-year targets', async () => {
    await startApp();
    act('addOneYearTarget');
    expect($('#edit-title').textContent).toBe('Add 1-Year Target');
    saveEditDialog({ what: 'Fence the north paddock' });
    act('addOneYearTarget');
    saveEditDialog({ what: 'Hire a manager' });

    act('editOneYearTarget', { idx: 1 });
    expect(value('#ef-what')).toBe('Hire a manager');
    saveEditDialog({ what: 'Hire a farm manager' });
    act('toggleOneYearDone', { idx: 0 });
    expect(saved().blueprint.oneyear).toEqual([
      { text: 'Fence the north paddock', done: true },
      { text: 'Hire a farm manager', done: false },
    ]);

    act('deleteOneYearTarget', { idx: 1 });
    expect(confirm).toHaveBeenCalledWith('Delete this target?');
    expect(saved().blueprint.oneyear).toEqual([{ text: 'Fence the north paddock', done: true }]);
  });

  it('keeps the edit dialog open when "what" is empty, and closes it on an outside click', async () => {
    await startApp();
    act('addOneYearTarget');
    saveEditDialog({ what: '   ' });
    expect(isOpen('#edit-overlay')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    $('#edit-overlay').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(isOpen('#edit-overlay')).toBe(false);
  });
});

describe('120-day priorities', () => {
  it('creates a period from the dialog', async () => {
    await startApp();
    act('showNew120Modal');
    expect($('#modal-120-overlay').style.display).toBe('flex');
    expect($$('#task-rows-120 .form-row')).toHaveLength(3);
    setValue('#new-120-label', 'Period 1');
    setValue('#new-120-period', 'Jan – Apr 2026');
    setValue('#new-120-targets', 'Target A\nTarget B');
    fillRows('#task-rows-120', [['Fix fences', 'Sam', 'Feb'], ['Buy seed']]);
    act('createPeriod120');

    const [period] = saved().periods120;
    expect(period).toMatchObject({
      label: 'Period 1',
      period: 'Jan – Apr 2026',
      current: true,
      oneyear: ['Target A', 'Target B'],
      priorities: [
        { id: expect.any(String), what: 'Fix fences', who: 'Sam', when: 'Feb', status: 'none', pushed: false },
        { id: expect.any(String), what: 'Buy seed', who: 'Team', when: 'TBC', status: 'none', pushed: false },
      ],
    });
    expect($('#modal-120-overlay').style.display).toBe('none');
    expect($$(`#body-120-${period.id} tr`)).toHaveLength(2);
    expect($(`#prog-120-text-${period.id}`).textContent).toBe('0 of 2 complete');
  });

  it('needs a label for a new period', async () => {
    await startApp();
    act('showNew120Modal');
    act('createPeriod120');
    expect(alert).toHaveBeenCalledWith('Please enter a period label.');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('adds, edits, toggles and deletes priorities', async () => {
    await startApp();
    const id = createPeriod('Period 1', 'Jan – Apr', [['Fix fences', 'Sam', 'Feb']]);
    act('addPriority120', { periodId: id });
    saveEditDialog({ what: 'Buy seed', who: 'Alex', when: 'Mar' });
    const fix = priorityId(0, 0);
    const seed = priorityId(0, 1);
    act('editItem120', { periodId: id, itemId: fix });
    expect(value('#ef-what')).toBe('Fix fences');
    saveEditDialog({ what: 'Fix all fences', who: 'Sam', when: 'Apr' });
    expect(priority(0, fix)).toMatchObject({ what: 'Fix all fences', who: 'Sam', when: 'Apr' });
    expect(priority(0, seed)).toMatchObject({ what: 'Buy seed', who: 'Alex', when: 'Mar', status: 'none' });

    act('setStatus120', { periodId: id, itemId: fix, status: 'on-track' });
    expect(priority(0, fix).status).toBe('on-track');
    expect($('#stat-120-ontrack').textContent).toBe('1');
    act('setStatus120', { periodId: id, itemId: fix, status: 'on-track' });
    expect(priority(0, fix).status).toBe('none');

    act('setStatus120', { periodId: id, itemId: seed, status: 'complete' });
    expect($('#stat-120-done').textContent).toBe('1');
    expect($(`#prog-120-text-${id}`).textContent).toBe('1 of 2 complete');
    expect($$(`#body-120-${id} tr`)[1].className).toBe('status-complete');

    act('deletePriority120', { periodId: id, itemId: seed });
    expect(saved().periods120[0].priorities.map((p) => p.id)).toEqual([fix]);
  });

  it('pushes priorities into the queue, then into the next period', async () => {
    await startApp();
    const first = createPeriod('Period 1', 'Jan – Apr', [
      ['Fix fences', 'Sam', 'Feb'],
      ['Buy seed', 'Alex', 'Mar'],
    ]);
    const fix = priorityId(0, 0);
    const seed = priorityId(0, 1);
    act('pushPriority120', { periodId: first, itemId: fix });
    expect(priority(0, fix).pushed).toBe(true);
    expect(saved().pendingPushes120).toEqual([{ what: 'Fix fences', who: 'Sam', when: 'Feb', fromPeriod: 'Period 1' }]);
    expect($(`#body-120-${first}`).textContent).toContain('Pushed ✓');
    expect(document.body.textContent).toContain('Priority will be added to the next new period you create ✓');

    act('showNew120Modal');
    expect($('#pushed-120-notice').textContent).toContain('1 priority will be carried over');
    setValue('#new-120-label', 'Period 2');
    act('createPeriod120');
    const [p1, p2] = saved().periods120;
    expect(p1.current).toBe(false);
    expect(p2).toMatchObject({ label: 'Period 2', period: 'Period 2', current: true });
    expect(p2.priorities).toEqual([
      { id: expect.any(String), what: 'Fix fences', who: 'Sam', when: 'Feb', status: 'none', pushed: false, carriedFrom: 'Period 1' },
    ]);
    expect(saved().pendingPushes120).toEqual([]);

    act('pushPriority120', { periodId: first, itemId: seed });
    expect(saved().periods120[1].priorities.at(-1)).toEqual({
      id: expect.any(String),
      what: 'Buy seed',
      who: 'Alex',
      when: 'Mar',
      status: 'none',
      pushed: false,
      carriedFrom: 'Period 1',
    });
    expect(saved().pendingPushes120).toEqual([]);
  });

  it('renames a period by double-clicking its tab, and switches tabs on click', async () => {
    await startApp();
    const first = createPeriod('Period 1', 'Jan – Apr');
    const second = createPeriod('Period 2', 'May – Aug');
    expect($(`#ppanel-${second}`).classList.contains('active')).toBe(true);

    $(`#ptab-${first}`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect($(`#ppanel-${first}`).classList.contains('active')).toBe(true);
    expect($(`#ppanel-${second}`).classList.contains('active')).toBe(false);

    $(`#ptab-${first}`).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect($('#edit-title').textContent).toBe('Rename Period');
    saveEditDialog({ what: 'P1 – 2026', when: 'Feb – May' });
    expect(saved().periods120[0]).toMatchObject({ label: 'P1 – 2026', period: 'Feb – May' });
    expect($(`#ptab-${first}`).textContent).toBe('P1 – 2026');
  });
});

describe('30-day to-dos', () => {
  it('creates rounds, tracks tasks and notes, and carries tasks forward', async () => {
    await startApp();
    const first = createRound('Round 1', 'May', [['Order fuel', 'Sam', '10 May'], ['Book vet']]);
    expect(saved().rounds[0]).toMatchObject({
      label: 'Round 1',
      period: 'May',
      current: true,
      notes: '',
      tasks: [
        { id: expect.any(String), what: 'Order fuel', who: 'Sam', when: '10 May', status: 'none', pushed: false },
        { id: expect.any(String), what: 'Book vet', who: 'Team', when: 'TBC', status: 'none', pushed: false },
      ],
    });

    act('addTask30', { roundId: first });
    saveEditDialog({ what: 'Fix pump', who: 'Alex', when: '20 May' });
    const fuel = taskId(0, 0);
    const vet = taskId(0, 1);
    const pump = taskId(0, 2);
    act('editItem30', { roundId: first, taskId: vet });
    saveEditDialog({ what: 'Book the vet', who: 'Sam', when: '15 May' });
    expect(task(0, vet)).toMatchObject({ what: 'Book the vet', who: 'Sam', when: '15 May' });

    act('setStatus30', { roundId: first, taskId: pump, status: 'complete' });
    expect($('#stat-30-done').textContent).toBe('1 / 3');
    expect($('#stat-30-ontrack').textContent).toBe('33%');
    act('setStatus30', { roundId: first, taskId: pump, status: 'complete' });
    expect(task(0, pump).status).toBe('none');
    act('deleteTask30', { roundId: first, taskId: pump });
    expect(saved().rounds[0].tasks.map((t) => t.id)).toEqual([fuel, vet]);

    setValue(`#notes-${first}`, 'Good session');
    act('saveRoundNotes', { roundId: first }, 'input');
    expect(saved().rounds[0].notes).toBe('Good session');

    act('pushTask', { roundId: first, taskId: fuel });
    expect(saved().pendingPushes).toEqual([{ what: 'Order fuel', who: 'Sam', when: '10 May', fromRound: 'Round 1' }]);
    act('showNewRoundModal');
    expect($('#pushed-tasks-notice').textContent).toContain('1 task will be carried over');
    act('closeModal');
    expect($('#modal-overlay').style.display).toBe('none');

    const second = createRound('Round 2', '');
    expect(saved().rounds[0].current).toBe(false);
    expect(saved().rounds[1]).toMatchObject({
      label: 'Round 2',
      period: 'Round 2',
      current: true,
      tasks: [{ id: expect.any(String), what: 'Order fuel', who: 'Sam', when: '10 May', status: 'none', pushed: false, carriedFrom: 'Round 1' }],
    });
    expect(saved().pendingPushes).toEqual([]);

    act('pushTask', { roundId: first, taskId: vet });
    expect(task(1, taskId(1, 1))).toMatchObject({ what: 'Book the vet', carriedFrom: 'Round 1' });

    $(`#tab-${second}`).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect($('#edit-title').textContent).toBe('Rename Round');
    saveEditDialog({ what: 'June round', when: 'June' });
    expect(saved().rounds[1]).toMatchObject({ label: 'June round', period: 'June' });
  });

  it('needs a label for a new round', async () => {
    await startApp();
    act('showNewRoundModal');
    act('createRound');
    expect(alert).toHaveBeenCalledWith('Please enter a round label.');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('coaching sessions', () => {
  it('adds, edits and deletes sessions', async () => {
    await startApp();
    act('showAddSessionModal');
    expect($('#session-edit-title').textContent).toBe('Add New Session');
    expect($('#session-delete-btn').style.display).toBe('none');
    setValue('#se-date', '1 May 2026');
    setValue('#se-format', 'Teams');
    setValue('#se-focus', 'Round 1 review');
    setValue('#se-notes', 'Bring numbers');
    act('saveSessionEdit');
    expect(saved().sessions).toEqual([
      { id: expect.any(String), date: '1 May 2026', format: 'Teams', focus: 'Round 1 review', notes: 'Bring numbers', done: false },
    ]);
    expect(isOpen('#session-edit-overlay')).toBe(false);

    act('editSession', { sessionId: saved().sessions[0].id });
    expect($('#session-edit-title').textContent).toBe('Edit Session');
    expect(value('#se-focus')).toBe('Round 1 review');
    ($('#se-done') as HTMLInputElement).checked = true;
    setValue('#se-focus', 'Round 1 wrap-up');
    act('saveSessionEdit');
    expect(saved().sessions[0]).toMatchObject({ focus: 'Round 1 wrap-up', done: true });
    expect($('#sessions-tbody').textContent).toContain('✓ Done');

    act('editSession', { sessionId: saved().sessions[0].id });
    act('deleteSession');
    expect(saved().sessions).toEqual([]);
    expect(isOpen('#session-edit-overlay')).toBe(false);
  });

  it('needs a date and a focus', async () => {
    await startApp();
    act('showAddSessionModal');
    setValue('#se-focus', 'Review');
    act('saveSessionEdit');
    expect(alert).toHaveBeenCalledWith('Please enter at least a date and focus.');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('adds Session Notes to the page without saving them', async () => {
    await startApp();
    setValue('#note-date', '1 May');
    setValue('#note-who', 'Sam');
    setValue('#note-text', 'Talked about water');
    act('addNote');
    expect($('#session-notes-list').textContent).toContain('1 May — Sam');
    expect($('#session-notes-list').textContent).toContain('Talked about water');
    expect(value('#note-text')).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('export and import', () => {
  it('exports everything as a version 3 file', async () => {
    const blobs: Blob[] = [];
    const downloads: string[] = [];
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      blobs.push(obj as Blob);
      return 'blob:test';
    };
    URL.revokeObjectURL = () => {};
    vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(function (this: HTMLElement) {
      if (this instanceof HTMLAnchorElement) downloads.push(this.download);
    });
    const data = fixture({
      sessions: [{ id: 1, date: '1 May', format: 'Teams', focus: 'Kick-off', notes: '', done: false }],
      pendingPushes: [{ what: 'Order fuel', who: 'Sam', when: 'May', fromRound: 'Round 1' }],
    });
    await startApp(data);

    act('exportData');
    expect(blobs).toHaveLength(1);
    const exported = JSON.parse(await readBlob(blobs[0])) as Record<string, unknown>;
    expect(exported).toMatchObject({
      version: 3,
      periods120: [],
      rounds: [],
      sessions: withStringIds(data.sessions),
      blueprint: data.blueprint,
      pendingPushes: data.pendingPushes,
      pendingPushes120: [],
    });
    expect(typeof exported.exportedAt).toBe('string');
    expect(downloads).toEqual([expect.stringMatching(/^planfarm-elevate-dashboard-\d{4}-\d{2}-\d{2}\.json$/)]);
  });

  it('imports a file, replacing everything', async () => {
    await startApp(
      fixture({ sessions: [{ id: 1, date: 'old', format: '', focus: 'Old session', notes: '', done: false }] }),
    );
    const imported = {
      version: 3,
      periods120: [
        {
          id: 5,
          label: 'Imported period',
          period: 'Jan',
          current: true,
          oneyear: [],
          priorities: [{ id: 1, what: 'Imported priority', who: 'Sam', when: 'Feb', status: 'none', pushed: false }],
        },
      ],
      rounds: [],
      sessions: [{ id: 3, date: '2 June', format: 'Farm', focus: 'Imported session', notes: '', done: true }],
      blueprint: {
        tenyear: 'Imported direction',
        threeyear: '',
        values: [],
        oneyear: ['Legacy target'],
        purpose: '',
        issues: [],
      },
      pendingPushes: [],
      pendingPushes120: [],
    };
    importFile(new File([JSON.stringify(imported)], 'backup.json', { type: 'application/json' }));

    await vi.waitFor(() => expect(saved().sessions).toEqual(withStringIds(imported.sessions)));
    expect(confirm).toHaveBeenCalledWith('This will replace all current data. Continue?');
    expect(saved().periods120).toEqual(withStringIds(imported.periods120).map((p) => ({ ...p, priorities: withStringIds(p.priorities) })));
    expect($$('#body-120-5 tr')).toHaveLength(1);
    expect($('#sessions-tbody').textContent).toContain('Imported session');
    expect($('#sessions-tbody').textContent).not.toContain('Old session');
    expect($('#bp-tenyear-body').textContent).toBe('Imported direction');
    expect($('#bp-oneyear-body').textContent).toContain('Legacy target');
  });

  it('rejects a file that is not a dashboard export', async () => {
    await startApp(fixture({ sessions: [{ id: 1, date: 'x', format: '', focus: 'Keep me', notes: '', done: false }] }));
    importFile(new File([JSON.stringify({ hello: 'world' })], 'other.json'));
    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Not a valid Planfarm data file.'));
    expect(saved().sessions[0].focus).toBe('Keep me');
  });
});

describe('printing', () => {
  it('marks one period for printing, then cleans up', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await startApp();
    const id = createPeriod('Period 1', 'Jan', [['Fix fences'], ['Buy seed']]);
    act('setStatus120', { periodId: id, itemId: priorityId(0, 0), status: 'complete' });

    act('printPeriod120', { periodId: id });
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains('printing-single')).toBe(true);
    expect($('#priorities-120').classList.contains('print-target')).toBe(true);
    expect($(`#ppanel-${id}`).classList.contains('print-target')).toBe(true);
    expect($$('.print-status').map((s) => s.textContent)).toEqual(['★ Complete', '— Not Set']);

    vi.advanceTimersByTime(1000);
    expect(document.body.classList.contains('printing-single')).toBe(false);
    expect($$('.print-target')).toHaveLength(0);
    expect($$('.print-status')).toHaveLength(0);
  });

  it('marks one round for printing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await startApp();
    const id = createRound('Round 1', 'May', [['Order fuel']]);
    act('printRound30', { roundId: id });
    expect($('#todos-30').classList.contains('print-target')).toBe(true);
    expect($(`#panel-${id}`).classList.contains('print-target')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect($$('.print-target')).toHaveLength(0);
  });

  it('prints everything with status labels, then removes them', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await startApp();
    createPeriod('Period 1', 'Jan', [['Fix fences']]);
    act('printAll');
    expect(print).toHaveBeenCalledTimes(1);
    expect($$('.print-status')).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect($$('.print-status')).toHaveLength(0);
  });
});

describe('navigation', () => {
  it('switches tabs', async () => {
    await startApp();
    act('showSection', { section: 'coaching' });
    expect($('#coaching').classList.contains('active')).toBe(true);
    expect($('#blueprint').classList.contains('active')).toBe(false);
    expect($('.nav-tab.active').textContent).toContain('Coaching');
  });
});

describe('drag and drop', () => {
  it('reorders priorities', async () => {
    await startApp();
    const id = createPeriod('Period 1', 'Jan', [['A'], ['B'], ['C']]);
    const rows = $$(`#body-120-${id} tr`);
    drag(rows[2], rows[0]);
    expect(saved().periods120[0].priorities.map((p) => p.what)).toEqual(['C', 'A', 'B']);
  });

  it('reorders 1-year targets', async () => {
    await startApp(
      fixture({
        blueprint: {
          tenyear: '',
          threeyear: '',
          values: [],
          oneyear: [
            { text: 'A', done: false },
            { text: 'B', done: false },
            { text: 'C', done: false },
          ],
          purpose: '',
          issues: [],
        },
      }),
    );
    const items = $$('#oneyear-list li');
    drag(items[0], items[2]);
    expect(saved().blueprint.oneyear).toEqual([
      { text: 'B', done: false },
      { text: 'C', done: false },
      { text: 'A', done: false },
    ]);
  });
});

describe('user text', () => {
  // Characters that mean something in HTML, for every place the templates put text: element text
  // (<img …>), quoted attributes (" and '), textarea content (</textarea>) and a typed entity (&amp;).
  const TEXT = `A & B <img src=x> "quoted" 'single' </textarea> &amp;`;
  // "Who" is split into badges on / , and &, so it gets the same characters without those.
  const WHO = `Sam "Q" <img src=x> 'Al'`;

  /** No element was created from the text: index.html has no <img> of its own. */
  function noMarkupFromText(): void {
    expect(document.querySelector('img')).toBeNull();
  }

  it('shows text exactly as typed, never as HTML, and every dialog saves it back unchanged', async () => {
    await startApp(fixture({
      periods120: [{ id: 'p1', label: TEXT, period: TEXT, current: true, oneyear: [], priorities: [{ id: 'x1', what: TEXT, who: WHO, when: TEXT, status: 'none', pushed: false }] }],
      rounds: [{ id: 'r1', label: TEXT, period: TEXT, current: true, notes: TEXT, tasks: [{ id: 't1', what: TEXT, who: WHO, when: TEXT, status: 'none', pushed: false }] }],
      sessions: [{ id: 's1', date: TEXT, format: TEXT, focus: TEXT, notes: TEXT, done: false }],
      blueprint: { tenyear: TEXT, threeyear: TEXT, values: [TEXT], oneyear: [{ text: TEXT, done: false }], purpose: TEXT, issues: [TEXT, `OPPORTUNITY: ${TEXT}`] },
      pendingPushes: [{ what: TEXT, who: WHO, when: TEXT, fromRound: TEXT }],
      pendingPushes120: [{ what: TEXT, who: WHO, when: TEXT, fromPeriod: TEXT }],
    }));
    noMarkupFromText();

    // Shown as text everywhere.
    expect($('#ppanel-p1 h2').textContent).toBe(`${TEXT} — ${TEXT}`);
    expect($('#body-120-p1 tr').textContent).toContain(TEXT);
    expect($$('#body-120-p1 .badge').map((b) => b.textContent)).toEqual([WHO]);
    expect($('#panel-r1 h2').textContent).toBe(`${TEXT} — ${TEXT}`);
    expect($('#tasks-r1 tr').textContent).toContain(TEXT);
    expect(value('#notes-r1')).toBe(TEXT);
    expect($$('#sessions-tbody td').slice(0, 4).map((td) => td.textContent)).toEqual([TEXT, TEXT, TEXT, TEXT]);
    expect($('#bp-tenyear-body').textContent).toBe(TEXT);
    expect($('#bp-threeyear-body').textContent?.trim()).toBe(TEXT);
    expect($('#bp-purpose-body').textContent).toBe(TEXT);
    expect($('#bp-values-body').textContent).toBe(TEXT);
    expect($('#bp-oneyear-body').textContent).toContain(TEXT);
    expect($$('#bp-issues-body li').map((li) => li.textContent)).toEqual([TEXT, `Opportunity: ${TEXT}`]);

    // The queued pushes, listed in the New Period and New Round dialogs.
    act('showNew120Modal');
    expect($('#pushed-120-notice li').textContent).toBe(TEXT);
    act('closeNew120Modal');
    act('showNewRoundModal');
    expect($('#pushed-tasks-notice li').textContent).toBe(TEXT);
    act('closeModal');
    noMarkupFromText();

    // Each dialog shows the text in full, and saving it unchanged keeps it exactly.
    act('editItem120', { periodId: 'p1', itemId: 'x1' });
    expect([value('#ef-what'), value('#ef-who'), value('#ef-when')]).toEqual([TEXT, WHO, TEXT]);
    noMarkupFromText();
    act('saveEdit');
    expect(priority(0, 'x1')).toMatchObject({ what: TEXT, who: WHO, when: TEXT });

    act('editItem30', { roundId: 'r1', taskId: 't1' });
    expect([value('#ef-what'), value('#ef-who'), value('#ef-when')]).toEqual([TEXT, WHO, TEXT]);
    act('saveEdit');
    expect(task(0, 't1')).toMatchObject({ what: TEXT, who: WHO, when: TEXT });

    $('#ptab-p1').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect([value('#ef-what'), value('#ef-when')]).toEqual([TEXT, TEXT]);
    act('saveEdit');
    expect(saved().periods120[0]).toMatchObject({ label: TEXT, period: TEXT });

    $('#tab-r1').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect([value('#ef-what'), value('#ef-when')]).toEqual([TEXT, TEXT]);
    act('saveEdit');
    expect(saved().rounds[0]).toMatchObject({ label: TEXT, period: TEXT });

    act('editOneYearTarget', { idx: 0 });
    expect(value('#ef-what')).toBe(TEXT);
    act('saveEdit');
    expect(saved().blueprint.oneyear).toEqual([{ text: TEXT, done: false }]);

    const sections: Array<[section: string, shown: string]> = [
      ['tenyear', TEXT], ['threeyear', TEXT], ['purpose', TEXT], ['values', TEXT], ['issues', `${TEXT}\nOPPORTUNITY: ${TEXT}`],
    ];
    for (const [section, shown] of sections) {
      act('editBlueprint', { section });
      expect(value('#bp-edit-val')).toBe(shown);
      noMarkupFromText();
      act('saveBpEdit');
    }
    expect(saved().blueprint).toMatchObject({ tenyear: TEXT, threeyear: TEXT, purpose: TEXT, values: [TEXT], issues: [TEXT, `OPPORTUNITY: ${TEXT}`] });

    act('editSession', { sessionId: 's1' });
    expect([value('#se-date'), value('#se-format'), value('#se-focus'), value('#se-notes')]).toEqual([TEXT, TEXT, TEXT, TEXT]);
    noMarkupFromText();
    act('saveSessionEdit');
    expect(saved().sessions[0]).toMatchObject({ date: TEXT, format: TEXT, focus: TEXT, notes: TEXT });

    expect(saved().rounds[0].notes).toBe(TEXT);
    noMarkupFromText();
  });

  it('keeps working with ids that contain a quote (an imported file in local mode)', async () => {
    const id = 'p"1';
    await startApp(fixture({
      periods120: [{ id, label: 'Period 1', period: 'Jan', current: true, priorities: [{ id: 'x"1', what: 'Fix fences', who: 'Sam', when: 'Feb', status: 'none', pushed: false }] }],
    }));
    expect(document.getElementById(`body-120-${id}`)?.textContent).toContain('Fix fences');
    const edit = $('[data-click="editItem120"]');
    expect([edit.dataset.periodId, edit.dataset.itemId]).toEqual([id, 'x"1']);
    edit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(value('#ef-what')).toBe('Fix fences');
  });
});

describe('event delegation', () => {
  it('has an action for every data-click / data-input / data-change / data-submit in the markup, and no unused ones', async () => {
    const used = new Set<string>();
    for (const text of markupAndSources()) {
      for (const name of actionNames(text)) used.add(name);
    }
    expect(used.size).toBeGreaterThan(40);

    const { actions } = await import('../src/main.ts');
    expect([...used].filter((name) => !(name in actions))).toEqual([]);
    expect(Object.keys(actions).filter((name) => !used.has(name))).toEqual([]);
  });

  it('has no inline on*="..." handlers left in the markup or templates', () => {
    const inline = markupAndSources().flatMap((text) => [...text.matchAll(/\bon[a-z]+="[^"]*"/g)].map((m) => m[0]));
    expect(inline).toEqual([]);
  });
});
