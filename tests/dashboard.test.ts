// @vitest-environment jsdom
/**
 * Smoke tests for the dashboard. Each test loads the real page markup, runs src/main.ts the way
 * the browser does, then acts like a user: it runs the same inline handlers the buttons have,
 * types into the dialogs, and checks the page and the data saved in localStorage.
 *
 * jsdom can't run the inline on*="..." attributes against this test's window, so fire() runs an
 * element's handler code the way a browser would: `this` is the element, `event` is the event,
 * and names are looked up on window (the bridge at the bottom of src/main.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../index.html?raw';

const STORAGE_KEY = 'pf_elevate_blank1';

// ---- The saved data, as these tests read it back from localStorage ----

interface SavedItem {
  id: number;
  what: string;
  who: string;
  when: string;
  status: string;
  pushed: boolean;
  carriedFrom?: string;
}
interface SavedPeriod {
  id: number;
  label: string;
  period: string;
  current: boolean;
  oneyear?: string[];
  priorities: SavedItem[];
}
interface SavedRound {
  id: number;
  label: string;
  period: string;
  current: boolean;
  notes?: string;
  tasks: SavedItem[];
}
interface SavedSession {
  id: number;
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

function pageBody(): string {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(indexHtml)?.[1] ?? '';
  return body.replace(/<script[\s\S]*?<\/script>/gi, '');
}

/** Run startup exactly as the browser does, optionally with data already saved. */
async function startApp(savedData?: Saved): Promise<void> {
  if (savedData) localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
  await import('../src/main.ts');
}

function saved(): Saved {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('Nothing has been saved');
  return JSON.parse(raw) as Saved;
}

function $(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`No element matches ${selector}`);
  return el;
}

function $$(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

function value(selector: string): string {
  return ($(selector) as HTMLInputElement | HTMLTextAreaElement).value;
}

function setValue(selector: string, text: string): void {
  ($(selector) as HTMLInputElement | HTMLTextAreaElement).value = text;
}

/** Run an element's inline on<type>="..." handler the way the browser does. */
function fire(el: Element, type = 'click', event: Event = new Event(type)): void {
  const code = el.getAttribute(`on${type}`);
  if (!code) throw new Error(`No on${type} handler on ${el.outerHTML.slice(0, 80)}`);
  new Function('event', code).call(el, event);
}

/** Find the element whose handler is exactly `call` (e.g. "createPeriod120()") and run it. */
function run(call: string, type = 'click'): void {
  fire($(`[on${type}="${call}"]`), type);
}

/** The attribute behind a dataset-style key: 'periodId' → 'data-period-id'. */
function dataAttr(key: string): string {
  return 'data-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/**
 * Do what a user does to the element whose data-<type> attribute names `action` and whose other
 * data-* attributes match `data`: dispatch a real, bubbling DOM event. The page's delegated
 * listener (src/actions.ts) handles it, exactly as in the browser.
 */
function act(action: string, data: Record<string, string | number> = {}, type: 'click' | 'input' | 'change' = 'click'): void {
  const selector = `[data-${type}="${action}"]` + Object.entries(data).map(([key, value]) => `[${dataAttr(key)}="${value}"]`).join('');
  const event = type === 'click' ? new MouseEvent('click', { bubbles: true, cancelable: true }) : new Event(type, { bubbles: true });
  $(selector).dispatchEvent(event);
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

function createPeriod(label: string, period: string, rows: Row[] = []): number {
  act('showNew120Modal');
  setValue('#new-120-label', label);
  setValue('#new-120-period', period);
  fillRows('#task-rows-120', rows);
  act('createPeriod120');
  const created = saved().periods120.at(-1);
  if (!created) throw new Error('No period was created');
  return created.id;
}

function createRound(label: string, period: string, rows: Row[] = []): number {
  act('showNewRoundModal');
  setValue('#new-round-label', label);
  setValue('#new-round-period', period);
  fillRows('#task-rows', rows);
  act('createRound');
  const created = saved().rounds.at(-1);
  if (!created) throw new Error('No round was created');
  return created.id;
}

function priority(periodIndex: number, id: number): SavedItem {
  const found = saved().periods120[periodIndex]?.priorities.find((p) => p.id === id);
  if (!found) throw new Error(`No priority ${id} in period ${periodIndex}`);
  return found;
}

function task(roundIndex: number, id: number): SavedItem {
  const found = saved().rounds[roundIndex]?.tasks.find((t) => t.id === id);
  if (!found) throw new Error(`No task ${id} in round ${roundIndex}`);
  return found;
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

/** Every action named in data-click / data-input / data-change attributes in `text`. */
function actionNames(text: string): Set<string> {
  return new Set([...text.matchAll(/\bdata-(?:click|input|change)="([A-Za-z0-9_]+)"/g)].map((m) => m[1]));
}

/** Every function name called inside on*="..." attributes in `text`. */
function handlerNames(text: string): Set<string> {
  const names = new Set<string>();
  for (const [, code] of text.matchAll(/\bon[a-z]+="([^"]*)"/g)) {
    const withoutStrings = code.replace(/'[^']*'/g, "''");
    for (const [, name] of withoutStrings.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
      names.add(name);
    }
  }
  return names;
}

// ---- Setup ----

let now = 0;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = pageBody();
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('print', vi.fn());
  // New periods and rounds get Date.now() as their id; make each call distinct.
  now = 1_750_000_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
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

    run('toggleOneYearDone(0)');
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

    run('toggleThreeYearDone(1)');
    expect(saved().blueprint.threeyearDone).toEqual({ 1: true });
    run('toggleThreeYearDone(1)');
    run('toggleThreeYearDone(0)');
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

    run('editOneYearTarget(1)');
    expect(value('#ef-what')).toBe('Hire a manager');
    saveEditDialog({ what: 'Hire a farm manager' });
    run('toggleOneYearDone(0)');
    expect(saved().blueprint.oneyear).toEqual([
      { text: 'Fence the north paddock', done: true },
      { text: 'Hire a farm manager', done: false },
    ]);

    run('deleteOneYearTarget(1)');
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
        { id: 1, what: 'Fix fences', who: 'Sam', when: 'Feb', status: 'none', pushed: false },
        { id: 2, what: 'Buy seed', who: 'Team', when: 'TBC', status: 'none', pushed: false },
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
    run(`addPriority120(${id})`);
    saveEditDialog({ what: 'Buy seed', who: 'Alex', when: 'Mar' });
    run(`editItem120(${id},1)`);
    expect(value('#ef-what')).toBe('Fix fences');
    saveEditDialog({ what: 'Fix all fences', who: 'Sam', when: 'Apr' });
    expect(priority(0, 1)).toMatchObject({ what: 'Fix all fences', who: 'Sam', when: 'Apr' });
    expect(priority(0, 2)).toMatchObject({ what: 'Buy seed', who: 'Alex', when: 'Mar', status: 'none' });

    run(`setStatus120(${id},1,'on-track')`);
    expect(priority(0, 1).status).toBe('on-track');
    expect($('#stat-120-ontrack').textContent).toBe('1');
    run(`setStatus120(${id},1,'on-track')`);
    expect(priority(0, 1).status).toBe('none');

    run(`setStatus120(${id},2,'complete')`);
    expect($('#stat-120-done').textContent).toBe('1');
    expect($(`#prog-120-text-${id}`).textContent).toBe('1 of 2 complete');
    expect($$(`#body-120-${id} tr`)[1].className).toBe('status-complete');

    run(`deletePriority120(${id},2)`);
    expect(saved().periods120[0].priorities.map((p) => p.id)).toEqual([1]);
  });

  it('pushes priorities into the queue, then into the next period', async () => {
    await startApp();
    const first = createPeriod('Period 1', 'Jan – Apr', [
      ['Fix fences', 'Sam', 'Feb'],
      ['Buy seed', 'Alex', 'Mar'],
    ]);
    run(`pushPriority120(${first},1)`);
    expect(priority(0, 1).pushed).toBe(true);
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
      { id: 1, what: 'Fix fences', who: 'Sam', when: 'Feb', status: 'none', pushed: false, carriedFrom: 'Period 1' },
    ]);
    expect(saved().pendingPushes120).toEqual([]);

    run(`pushPriority120(${first},2)`);
    expect(saved().periods120[1].priorities.at(-1)).toEqual({
      id: 2,
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
        { id: 1, what: 'Order fuel', who: 'Sam', when: '10 May', status: 'none', pushed: false },
        { id: 2, what: 'Book vet', who: 'Team', when: 'TBC', status: 'none', pushed: false },
      ],
    });

    run(`addTask30(${first})`);
    saveEditDialog({ what: 'Fix pump', who: 'Alex', when: '20 May' });
    run(`editItem30(${first},2)`);
    saveEditDialog({ what: 'Book the vet', who: 'Sam', when: '15 May' });
    expect(task(0, 2)).toMatchObject({ what: 'Book the vet', who: 'Sam', when: '15 May' });

    run(`setStatus30(${first},3,'complete')`);
    expect($('#stat-30-done').textContent).toBe('1 / 3');
    expect($('#stat-30-ontrack').textContent).toBe('33%');
    run(`setStatus30(${first},3,'complete')`);
    expect(task(0, 3).status).toBe('none');
    run(`deleteTask30(${first},3)`);
    expect(saved().rounds[0].tasks.map((t) => t.id)).toEqual([1, 2]);

    setValue(`#notes-${first}`, 'Good session');
    run(`saveRoundNotes(${first})`, 'input');
    expect(saved().rounds[0].notes).toBe('Good session');

    run(`pushTask(${first},1)`);
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
      tasks: [{ id: 1, what: 'Order fuel', who: 'Sam', when: '10 May', status: 'none', pushed: false, carriedFrom: 'Round 1' }],
    });
    expect(saved().pendingPushes).toEqual([]);

    run(`pushTask(${first},2)`);
    expect(task(1, 2)).toMatchObject({ what: 'Book the vet', carriedFrom: 'Round 1' });

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
      { id: 1, date: '1 May 2026', format: 'Teams', focus: 'Round 1 review', notes: 'Bring numbers', done: false },
    ]);
    expect(isOpen('#session-edit-overlay')).toBe(false);

    run('editSession(1)');
    expect($('#session-edit-title').textContent).toBe('Edit Session');
    expect(value('#se-focus')).toBe('Round 1 review');
    ($('#se-done') as HTMLInputElement).checked = true;
    setValue('#se-focus', 'Round 1 wrap-up');
    act('saveSessionEdit');
    expect(saved().sessions[0]).toMatchObject({ focus: 'Round 1 wrap-up', done: true });
    expect($('#sessions-tbody').textContent).toContain('✓ Done');

    run('editSession(1)');
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
      sessions: data.sessions,
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

    await vi.waitFor(() => expect(saved().sessions).toEqual(imported.sessions));
    expect(confirm).toHaveBeenCalledWith('This will replace all current data. Continue?');
    expect(saved().periods120).toEqual(imported.periods120);
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
    run(`setStatus120(${id},1,'complete')`);

    run(`printPeriod120(${id})`);
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
    run(`printRound30(${id})`);
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

describe('event delegation', () => {
  it('has an action for every data-click / data-input / data-change in the markup', async () => {
    const sources = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
    const used = new Set<string>();
    for (const text of [indexHtml, ...Object.values(sources)]) {
      for (const name of actionNames(text)) used.add(name);
    }
    expect(used.size).toBeGreaterThan(15);

    const { actions } = await import('../src/main.ts');
    expect([...used].filter((name) => !(name in actions))).toEqual([]);
  });
});

describe('window bridge', () => {
  it('has every function that an inline handler calls', async () => {
    const sources = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
    const names = new Set<string>();
    for (const text of [indexHtml, ...Object.values(sources)]) {
      for (const name of handlerNames(text)) names.add(name);
    }
    expect(names.size).toBeGreaterThan(10);

    await startApp();
    const bridge = window as unknown as Record<string, unknown>;
    const missing = [...names].filter((name) => typeof bridge[name] !== 'function');
    expect(missing).toEqual([]);
  });
});
