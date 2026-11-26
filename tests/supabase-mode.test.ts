// @vitest-environment jsdom
// Supabase mode with an in-memory backend: logging in, choosing and opening a business, saving
// edits (and retrying), importing, switching and signing out.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopLiveUpdates } from '../src/live-updates.ts';
import { stateToRows } from '../src/rows.ts';
import { emptyState } from '../src/state.ts';
import { createFakeBackend, type FakeOptions } from './fake-backend.ts';
import { $, $$, act, pageBody, setValue } from './helpers.ts';

/** A small farm: a purpose, one current period with one priority for Sam, and an empty round. */
function farm(prefix: string) {
  const s = emptyState();
  s.blueprint.purpose = `${prefix} purpose`;
  s.periods120.push({
    id: `${prefix}-p1`, label: 'Period 1', period: 'Jan', current: true, oneyear: [],
    priorities: [{ id: `${prefix}-x1`, what: 'Fix fences', who: 'Sam / Alex', when: 'Feb', status: 'none', pushed: false }],
  });
  s.rounds.push({ id: `${prefix}-r1`, label: 'Round 1', period: 'Feb', current: true, notes: '', tasks: [] });
  return stateToRows(s);
}

const STAFF: Pick<FakeOptions, 'users' | 'staff' | 'businesses'> = {
  users: { 'staff@test.local': 'staff-pw', 'client@test.local': 'client-pw' },
  staff: ['staff@test.local'],
  businesses: [
    { id: 'b1', name: 'Alpha Farm', clients: ['client@test.local'], rows: farm('a') },
    { id: 'b2', name: 'Beta Farm', rows: farm('b') },
  ],
};

/** Start in Supabase mode. `refreshMs` is the live updates' interval (default: a minute). */
async function start(options: FakeOptions, retryMs = [20], refreshMs?: number) {
  const fake = createFakeBackend(options);
  const { startApp } = await import('../src/app.ts');
  await startApp({ kind: 'supabase', backend: fake.backend, timing: { debounceMs: 0, retryMs, refreshMs } });
  return fake;
}

const visible = (selector: string) => !$(selector).hidden;
const saveStatus = () => $('#last-updated-display').textContent ?? '';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Let pending promises run (a reload's answer is applied a few microtasks after the request). */
const settle = () => sleep(0);

function setVisibility(visibility: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
}
/** Switching back to the tab, as the browser reports it. */
const returnToTab = () => document.dispatchEvent(new Event('visibilitychange'));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  history.replaceState(null, '', '/');
  document.body.innerHTML = pageBody();
  setVisibility('visible');
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  stopLiveUpdates();
  Reflect.deleteProperty(document, 'visibilityState');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('logging in', () => {
  it('shows the login form, refuses a wrong password, then lists the businesses', async () => {
    await start({ ...STAFF });
    expect(visible('#login-screen')).toBe(true);
    expect(visible('#dashboard')).toBe(false);

    setValue('#login-email', 'staff@test.local');
    setValue('#login-password', 'wrong');
    act('logIn', {}, 'submit');
    await vi.waitFor(() => expect($('#login-error').textContent).toBe('Invalid login credentials'));
    expect(visible('#login-screen')).toBe(true);

    setValue('#login-password', 'staff-pw');
    act('logIn', {}, 'submit');
    await vi.waitFor(() => expect(visible('#business-picker')).toBe(true));
    expect($('#business-picker-user').textContent).toBe('Signed in as staff@test.local');
    expect($$('#business-list button').map((b) => b.textContent)).toEqual(['Alpha Farm', 'Beta Farm']);
  });

  it('opens the business chosen from the list', async () => {
    await start({ ...STAFF, signedIn: 'staff@test.local' });
    act('openBusiness', { businessId: 'b2' });
    await vi.waitFor(() => expect(visible('#dashboard')).toBe(true));
    expect(visible('#business-picker')).toBe(false);
    expect($('.header-client h1').textContent).toBe('Beta Farm');
    expect(document.title).toBe('Beta Farm – Planfarm Elevate');
    expect(location.search).toBe('?business=b2');
    expect($('#bp-purpose-body').textContent).toBe('b purpose');
    expect(visible('#switch-business-btn')).toBe(true);
    expect(visible('#sign-out-btn')).toBe(true);
    expect(saveStatus()).toContain('All changes saved');
  });

  it('takes a client with one business straight in', async () => {
    await start({ ...STAFF, signedIn: 'client@test.local' });
    expect(visible('#dashboard')).toBe(true);
    expect($('.header-client h1').textContent).toBe('Alpha Farm');
    expect(visible('#switch-business-btn')).toBe(false);
  });

  it('opens the business named in the URL', async () => {
    history.replaceState(null, '', '/?business=b2');
    await start({ ...STAFF, signedIn: 'staff@test.local' });
    expect($('.header-client h1').textContent).toBe('Beta Farm');
  });

  it("explains when a login isn't linked to any business", async () => {
    await start({ users: { 'new@test.local': 'pw' }, businesses: STAFF.businesses, signedIn: 'new@test.local' });
    expect(visible('#business-picker')).toBe(true);
    expect($('#business-picker-message').textContent).toContain("isn't linked to a business yet");
  });
});

describe('saving', () => {
  it('writes an edit to the database as one row, and shows Saved', async () => {
    const fake = await start({ ...STAFF, signedIn: 'client@test.local' });
    act('setStatus120', { periodId: 'a-p1', itemId: 'a-x1', status: 'on-track' });
    await vi.waitFor(() => expect(fake.rows('b1').priorities['a-x1'].status).toBe('on-track'));
    await vi.waitFor(() => expect(saveStatus()).toMatch(/Saved\d{1,2}:\d{2}/));
    expect(fake.applied).toEqual([[
      { kind: 'upsert', table: 'priorities_120', rows: [expect.objectContaining({ id: 'a-x1', status: 'on-track' })] },
    ]]);
  });

  it('shows "Not saved" when a write fails, then retries and saves', async () => {
    // A retry wait long enough for the test to see "Not saved" before the retry succeeds.
    const fake = await start({ ...STAFF, signedIn: 'client@test.local' }, [300]);
    fake.failNext();
    act('setStatus120', { periodId: 'a-p1', itemId: 'a-x1', status: 'complete' });
    await vi.waitFor(() => expect(saveStatus()).toContain('Not saved'));
    await vi.waitFor(() => expect(fake.rows('b1').priorities['a-x1'].status).toBe('complete'));
    await vi.waitFor(() => expect(saveStatus()).toMatch(/Saved/));
  });

  it("suggests the business's own names under Who", async () => {
    await start({ ...STAFF, signedIn: 'client@test.local' });
    expect($$('#who-suggestions option').map((o) => (o as HTMLOptionElement).value)).toEqual(['Alex', 'Sam']);
  });

  it('imports a file into the open business, then shows it', async () => {
    const fake = await start({ ...STAFF, signedIn: 'client@test.local' });
    const file = new File([JSON.stringify({
      version: 3,
      blueprint: { tenyear: '', threeyear: '', values: [], oneyear: [], purpose: 'Imported purpose', issues: [] },
      periods120: [{ id: 1, label: 'Imported period', period: 'Jan', current: true, priorities: [] }],
    })], 'backup.json');
    const input = $('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect($('#bp-purpose-body').textContent).toBe('Imported purpose'));
    expect(fake.rows('b1').blueprint.purpose).toBe('Imported purpose');
    expect(Object.values(fake.rows('b1').periods).map((p) => p.label)).toEqual(['Imported period']);
  });
});

describe('leaving', () => {
  it('switches back to the list, then signs out', async () => {
    history.replaceState(null, '', '/?business=b1');
    const fake = await start({ ...STAFF, signedIn: 'staff@test.local' });
    expect(visible('#dashboard')).toBe(true);

    act('switchBusiness');
    await vi.waitFor(() => expect(visible('#business-picker')).toBe(true));
    expect(location.search).toBe('');

    act('signOut');
    await vi.waitFor(() => expect(visible('#login-screen')).toBe(true));
    expect(await fake.backend.currentUser()).toBeNull();
  });

  it('stops saving a business once you switch away, even while a save is retrying', async () => {
    history.replaceState(null, '', '/?business=b1');
    const fake = await start({ ...STAFF, signedIn: 'staff@test.local' }, [200]);
    fake.failNext();
    act('setStatus120', { periodId: 'a-p1', itemId: 'a-x1', status: 'complete' });
    await vi.waitFor(() => expect(saveStatus()).toContain('Not saved'));

    act('switchBusiness');
    expect(confirm).toHaveBeenCalledWith("Some changes haven't been saved yet. Leave anyway?");
    await vi.waitFor(() => expect(visible('#business-picker')).toBe(true));
    act('openBusiness', { businessId: 'b2' });
    await vi.waitFor(() => expect($('.header-client h1').textContent).toBe('Beta Farm'));

    // Well past the old business's retry: the unsaved edit is dropped, and neither business changes.
    await sleep(500);
    expect(fake.applied).toEqual([]);
    expect(Object.keys(fake.rows('b1').periods)).toEqual(['a-p1']);
    expect(fake.rows('b1').priorities).toEqual({ 'a-x1': expect.objectContaining({ status: 'none' }) });
    expect(Object.keys(fake.rows('b2').periods)).toEqual(['b-p1']);
    expect(saveStatus()).toBe('SavedAll changes saved');
  });

  it('stops saving a business at Sign out, so logging straight back in leaves its rows alone', async () => {
    history.replaceState(null, '', '/?business=b1');
    const fake = await start({ ...STAFF, signedIn: 'staff@test.local' }, [200]);
    fake.failNext();
    act('setStatus120', { periodId: 'a-p1', itemId: 'a-x1', status: 'complete' });
    await vi.waitFor(() => expect(saveStatus()).toContain('Not saved'));

    act('signOut');
    await vi.waitFor(() => expect(visible('#login-screen')).toBe(true));
    // Staff get the list after logging in, so nothing is open and `state` is still empty.
    setValue('#login-email', 'staff@test.local');
    setValue('#login-password', 'staff-pw');
    act('logIn', {}, 'submit');
    await vi.waitFor(() => expect(visible('#business-picker')).toBe(true));

    await sleep(500);
    expect(fake.applied).toEqual([]);
    expect(Object.keys(fake.rows('b1').periods)).toEqual(['a-p1']);
    expect(Object.keys(fake.rows('b1').priorities)).toEqual(['a-x1']);
  });

  it('asks before leaving during an import, and keeps the import out of the next business', async () => {
    history.replaceState(null, '', '/?business=b1');
    const fake = await start({ ...STAFF, signedIn: 'staff@test.local' });
    // Hold the import on its way to the database until the test lets it finish.
    let finishImport = () => {};
    const realImport = fake.backend.importFile.bind(fake.backend);
    fake.backend.importFile = async (id, file) => {
      await new Promise<void>((resolve) => { finishImport = resolve; });
      await realImport(id, file);
    };
    const file = new File([JSON.stringify({
      version: 3,
      blueprint: { tenyear: '', threeyear: '', values: [], oneyear: [], purpose: 'Imported purpose', issues: [] },
    })], 'backup.json');
    const input = $('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledWith('This will replace all current data. Continue?'));

    act('switchBusiness');
    expect(confirm).toHaveBeenLastCalledWith("Some changes haven't been saved yet. Leave anyway?");
    await vi.waitFor(() => expect(visible('#business-picker')).toBe(true));
    act('openBusiness', { businessId: 'b2' });
    await vi.waitFor(() => expect($('.header-client h1').textContent).toBe('Beta Farm'));

    // The import still lands in the business it was started in, but isn't loaded into this one.
    finishImport();
    await vi.waitFor(() => expect(fake.rows('b1').blueprint.purpose).toBe('Imported purpose'));
    await sleep(50);
    expect($('#bp-purpose-body').textContent).toBe('b purpose');
    act('setStatus120', { periodId: 'b-p1', itemId: 'b-x1', status: 'on-track' });
    await vi.waitFor(() => expect(fake.rows('b2').priorities['b-x1'].status).toBe('on-track'));
    expect(Object.keys(fake.rows('b2').periods)).toEqual(['b-p1']);
    expect(fake.rows('b2').blueprint.purpose).toBe('b purpose');
  });
});

describe('live updates', () => {
  const CLIENT = { ...STAFF, signedIn: 'client@test.local' };
  const purpose = () => $('#bp-purpose-body').textContent;
  const changePurposeElsewhere = (fake: ReturnType<typeof createFakeBackend>, id = 'b1') =>
    fake.remoteChange(id, (rows) => { rows.blueprint.purpose = 'Changed elsewhere'; });
  const onTrack = () => $('[data-click="setStatus120"][data-item-id="a-x1"][data-status="on-track"]').classList.contains('active-on-track');

  it('shows a change made on another device when you come back to the tab, or when the network returns', async () => {
    const fake = await start(CLIENT);
    changePurposeElsewhere(fake);
    returnToTab();
    await vi.waitFor(() => expect(purpose()).toBe('Changed elsewhere'));

    fake.remoteChange('b1', (rows) => { rows.priorities['a-x1'].status = 'complete'; });
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect($('#body-120-a-p1 tr').className).toBe('status-complete'));
    expect(fake.applied).toEqual([]);
  });

  it('reloads every so often while the tab is visible, but not while it is hidden', async () => {
    const fake = await start(CLIENT, [20], 30);
    await vi.waitFor(() => expect(fake.loaded.length).toBeGreaterThan(2));

    setVisibility('hidden');
    await sleep(40);
    const whileHidden = fake.loaded.length;
    await sleep(150);
    expect(fake.loaded).toHaveLength(whileHidden);

    setVisibility('visible');
    returnToTab();
    await vi.waitFor(() => expect(fake.loaded.length).toBeGreaterThan(whileHidden));
  });

  it("doesn't redraw for your own save coming back, only for a change made elsewhere", async () => {
    const fake = await start(CLIENT);
    act('setStatus120', { periodId: 'a-p1', itemId: 'a-x1', status: 'on-track' });
    await vi.waitFor(() => expect(saveStatus()).toMatch(/Saved\d{1,2}:\d{2}/));
    const probe = $('#bp-purpose-body p');

    returnToTab();
    await vi.waitFor(() => expect(fake.loaded).toHaveLength(2));
    await settle();
    expect(probe.isConnected).toBe(true);
    expect(saveStatus()).toMatch(/Saved\d{1,2}:\d{2}/);

    changePurposeElsewhere(fake);
    returnToTab();
    await vi.waitFor(() => expect(probe.isConnected).toBe(false));
    expect(purpose()).toBe('Changed elsewhere');
    expect(onTrack()).toBe(true);
  });

  it('waits while a change of yours is unsaved, then shows both', async () => {
    const fake = await start(CLIENT, [300]);
    fake.failNext();
    act('setStatus120', { periodId: 'a-p1', itemId: 'a-x1', status: 'complete' });
    await vi.waitFor(() => expect(saveStatus()).toContain('Not saved'));
    changePurposeElsewhere(fake);

    returnToTab();
    await settle();
    expect(fake.loaded).toHaveLength(1);
    expect(purpose()).toBe('a purpose');

    await vi.waitFor(() => expect(saveStatus()).toMatch(/Saved\d/));
    returnToTab();
    await vi.waitFor(() => expect(purpose()).toBe('Changed elsewhere'));
    expect($('#body-120-a-p1 tr').className).toBe('status-complete');
    expect(fake.rows('b1').priorities['a-x1'].status).toBe('complete');
  });

  it('keeps an edit you saved while a reload was on its way', async () => {
    const fake = await start(CLIENT);
    changePurposeElsewhere(fake);
    const release = fake.holdNextLoad();
    returnToTab();
    await vi.waitFor(() => expect(fake.loaded).toHaveLength(2));

    // The held answer was read before this edit, so applying it would undo the edit.
    act('setStatus120', { periodId: 'a-p1', itemId: 'a-x1', status: 'on-track' });
    await vi.waitFor(() => expect(fake.rows('b1').priorities['a-x1'].status).toBe('on-track'));
    await vi.waitFor(() => expect(saveStatus()).toMatch(/Saved\d/));
    release();
    await settle();
    expect(onTrack()).toBe(true);
    expect(purpose()).toBe('a purpose');

    returnToTab();
    await vi.waitFor(() => expect(purpose()).toBe('Changed elsewhere'));
    expect(onTrack()).toBe(true);
  });

  it("waits while you're in a dialog, typing in a box, or dragging", async () => {
    const fake = await start(CLIENT);
    changePurposeElsewhere(fake);
    const row = () => $('#body-120-a-p1 tr');
    const busy: Array<[what: string, begin: () => void, end: () => void]> = [
      ['edit dialog', () => act('editItem120', { periodId: 'a-p1', itemId: 'a-x1' }), () => act('closeEditModal')],
      ['blueprint dialog', () => act('editBlueprint', { section: 'purpose' }), () => act('closeBpEditModal')],
      ['session dialog', () => act('showAddSessionModal'), () => act('closeSessionEditModal')],
      ['New Period dialog', () => act('showNew120Modal'), () => act('closeNew120Modal')],
      ['New Round dialog', () => act('showNewRoundModal'), () => act('closeModal')],
      ['notes box', () => $('#notes-a-r1').focus(), () => $('#notes-a-r1').blur()],
      ['drag', () => row().dispatchEvent(new Event('dragstart')), () => row().dispatchEvent(new Event('dragend'))],
    ];
    for (const [what, begin, end] of busy) {
      begin();
      returnToTab();
      await settle();
      expect(fake.loaded, what).toHaveLength(1);
      expect(purpose(), what).toBe('a purpose');
      end();
    }
    returnToTab();
    await vi.waitFor(() => expect(purpose()).toBe('Changed elsewhere'));
  });

  it('never loads one business into the next one you open', async () => {
    history.replaceState(null, '', '/?business=b1');
    const fake = await start({ ...STAFF, signedIn: 'staff@test.local' });
    changePurposeElsewhere(fake, 'b1');
    const release = fake.holdNextLoad();
    returnToTab();
    await vi.waitFor(() => expect(fake.loaded).toHaveLength(2));

    act('switchBusiness');
    await vi.waitFor(() => expect(visible('#business-picker')).toBe(true));
    act('openBusiness', { businessId: 'b2' });
    await vi.waitFor(() => expect($('.header-client h1').textContent).toBe('Beta Farm'));
    release();
    await settle();
    expect(purpose()).toBe('b purpose');

    act('setStatus120', { periodId: 'b-p1', itemId: 'b-x1', status: 'on-track' });
    await vi.waitFor(() => expect(fake.rows('b2').priorities['b-x1'].status).toBe('on-track'));
    expect(Object.keys(fake.rows('b2').periods)).toEqual(['b-p1']);
    expect(fake.rows('b2').blueprint.purpose).toBe('b purpose');
  });

  it('keeps the period and round you picked across a redraw, and falls back when they are deleted elsewhere', async () => {
    const s = emptyState();
    s.periods120.push(
      { id: 'p1', label: 'Period 1', period: 'Jan', current: false, oneyear: [], priorities: [] },
      { id: 'p2', label: 'Period 2', period: 'May', current: true, oneyear: [], priorities: [] },
    );
    s.rounds.push(
      { id: 'r1', label: 'Round 1', period: 'Jan', current: false, notes: '', tasks: [] },
      { id: 'r2', label: 'Round 2', period: 'Feb', current: true, notes: '', tasks: [] },
    );
    const fake = await start({ users: { 'c@test.local': 'pw' }, businesses: [{ id: 'b1', name: 'Alpha Farm', clients: ['c@test.local'], rows: stateToRows(s) }], signedIn: 'c@test.local' });
    const active = (id: string) => $(id).classList.contains('active');

    $('#ptab-p1').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    $('#tab-r1').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect([active('#ppanel-p1'), active('#panel-r1')]).toEqual([true, true]);

    changePurposeElsewhere(fake);
    returnToTab();
    await vi.waitFor(() => expect(purpose()).toBe('Changed elsewhere'));
    expect([active('#ppanel-p1'), active('#ppanel-p2'), active('#panel-r1'), active('#panel-r2')]).toEqual([true, false, true, false]);

    fake.remoteChange('b1', (rows) => { delete rows.periods.p1; delete rows.rounds.r1; });
    returnToTab();
    await vi.waitFor(() => expect(document.getElementById('ppanel-p1')).toBeNull());
    expect([active('#ppanel-p2'), active('#panel-r2')]).toEqual([true, true]);
  });

  it('stops after Switch business and after Sign out', async () => {
    history.replaceState(null, '', '/?business=b1');
    const fake = await start({ ...STAFF, signedIn: 'staff@test.local' }, [20], 30);
    await vi.waitFor(() => expect(fake.loaded.length).toBeGreaterThan(1));

    act('switchBusiness');
    await vi.waitFor(() => expect(visible('#business-picker')).toBe(true));
    await sleep(40);
    const afterSwitch = fake.loaded.length;
    returnToTab();
    window.dispatchEvent(new Event('online'));
    await sleep(150);
    expect(fake.loaded).toHaveLength(afterSwitch);

    act('openBusiness', { businessId: 'b1' });
    await vi.waitFor(() => expect(visible('#dashboard')).toBe(true));
    act('signOut');
    await vi.waitFor(() => expect(visible('#login-screen')).toBe(true));
    await sleep(40);
    const afterSignOut = fake.loaded.length;
    returnToTab();
    await sleep(150);
    expect(fake.loaded).toHaveLength(afterSignOut);
  });

  it('changes nothing when a reload fails, and tries again next time', async () => {
    const fake = await start(CLIENT);
    changePurposeElsewhere(fake);
    fake.failNextLoad();
    returnToTab();
    await vi.waitFor(() => expect(fake.loaded).toHaveLength(2));
    await settle();
    expect(purpose()).toBe('a purpose');
    expect(saveStatus()).toBe('SavedAll changes saved');

    returnToTab();
    await vi.waitFor(() => expect(purpose()).toBe('Changed elsewhere'));
  });

  it('goes back to the list when the open business is deleted elsewhere', async () => {
    history.replaceState(null, '', '/?business=b1');
    const fake = await start({ ...STAFF, signedIn: 'staff@test.local' });
    fake.removeBusiness('b1');
    returnToTab();
    await vi.waitFor(() => expect(visible('#business-picker')).toBe(true));
    expect($('#business-picker-message').textContent).toBe("Alpha Farm can't be opened any more: it was deleted, or your login no longer has access to it.");
    expect($$('#business-list button').map((b) => b.textContent)).toEqual(['Beta Farm']);
    expect(location.search).toBe('');
  });

  it('shows a new name given to the business elsewhere', async () => {
    const fake = await start(CLIENT);
    fake.rename('b1', 'Alpha Holdings');
    returnToTab();
    await vi.waitFor(() => expect($('.header-client h1').textContent).toBe('Alpha Holdings'));
    expect(document.title).toBe('Alpha Holdings – Planfarm Elevate');
  });
});

describe('modes', () => {
  it('shows an error page when a production build has no Supabase settings', async () => {
    const { startApp } = await import('../src/app.ts');
    await startApp({ kind: 'missing-config' });
    expect(visible('#config-error')).toBe(true);
    expect(visible('#dashboard')).toBe(false);
    expect(visible('#login-screen')).toBe(false);
    expect(visible('#config-error-detail')).toBe(false);
  });

  it("shows supabase-js's message on the error page when the Supabase URL is malformed", async () => {
    const { appModeFromEnv } = await import('../src/config.ts');
    const mode = appModeFromEnv({
      ...import.meta.env, MODE: 'production', DEV: false, PROD: true,
      VITE_SUPABASE_URL: '127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    });
    expect(mode.kind).toBe('missing-config');

    const { startApp } = await import('../src/app.ts');
    await startApp(mode);
    expect(visible('#config-error')).toBe(true);
    expect(visible('#dashboard')).toBe(false);
    expect(visible('#login-screen')).toBe(false);
    expect(visible('#config-error-detail')).toBe(true);
    expect($('#config-error-detail').textContent).toContain('Invalid supabaseUrl');
  });

  it('skips the login in local mode', async () => {
    const { startApp } = await import('../src/app.ts');
    await startApp({ kind: 'local' });
    expect(visible('#dashboard')).toBe(true);
    expect(visible('#login-screen')).toBe(false);
    expect(visible('#sign-out-btn')).toBe(false);
  });
});
