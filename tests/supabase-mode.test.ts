// @vitest-environment jsdom
// Supabase mode with an in-memory backend: logging in, choosing and opening a business, saving
// edits (and retrying), importing, switching and signing out.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stateToRows } from '../src/rows.ts';
import { emptyState } from '../src/state.ts';
import { createFakeBackend, type FakeOptions } from './fake-backend.ts';
import { $, $$, act, pageBody, setValue } from './helpers.ts';

/** A small farm: a purpose, and one current period with one priority for Sam. */
function farm(prefix: string) {
  const s = emptyState();
  s.blueprint.purpose = `${prefix} purpose`;
  s.periods120.push({
    id: `${prefix}-p1`, label: 'Period 1', period: 'Jan', current: true, oneyear: [],
    priorities: [{ id: `${prefix}-x1`, what: 'Fix fences', who: 'Sam / Alex', when: 'Feb', status: 'none', pushed: false }],
  });
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

async function start(options: FakeOptions, retryMs = [20]) {
  const fake = createFakeBackend(options);
  const { startApp } = await import('../src/app.ts');
  await startApp({ kind: 'supabase', backend: fake.backend, timing: { debounceMs: 0, retryMs } });
  return fake;
}

const visible = (selector: string) => !$(selector).hidden;
const saveStatus = () => $('#last-updated-display').textContent ?? '';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  history.replaceState(null, '', '/');
  document.body.innerHTML = pageBody();
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
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
});

describe('modes', () => {
  it('shows an error page when a production build has no Supabase settings', async () => {
    const { startApp } = await import('../src/app.ts');
    await startApp({ kind: 'missing-config' });
    expect(visible('#config-error')).toBe(true);
    expect(visible('#dashboard')).toBe(false);
    expect(visible('#login-screen')).toBe(false);
  });

  it('skips the login in local mode', async () => {
    const { startApp } = await import('../src/app.ts');
    await startApp({ kind: 'local' });
    expect(visible('#dashboard')).toBe(true);
    expect(visible('#login-screen')).toBe(false);
    expect(visible('#sign-out-btn')).toBe(false);
  });
});
