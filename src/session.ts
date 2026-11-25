// Supabase mode: logging in, choosing a business, opening it, switching and signing out. Also the
// header's save status and the "Who" suggestions, which come from the open business's data.

import { str, type Actions } from './actions.ts';
import type { Backend, BusinessSummary } from './backend.ts';
import { byId } from './dom.ts';
import { usePersistence } from './persistence.ts';
import { renderAll } from './render.ts';
import { emptyState, state } from './state.ts';
import { createSupabasePersistence, type SupabasePersistence } from './supabase-persistence.ts';
import type { SyncStatus } from './sync.ts';

export type Screen = 'login' | 'picker' | 'dashboard' | 'config-error';

/** Show one of the page's screens and hide the others. */
export function showScreen(screen: Screen): void {
  byId('login-screen').hidden = screen !== 'login';
  byId('business-picker').hidden = screen !== 'picker';
  byId('config-error').hidden = screen !== 'config-error';
  byId('dashboard').hidden = screen !== 'dashboard';
}

type Timing = { debounceMs?: number; retryMs?: number[] };

let backend: Backend | null = null;
let timing: Timing = {};
let signedInAs = '';
let businesses: BusinessSummary[] = [];
let open: SupabasePersistence | null = null;

function api(): Backend {
  if (!backend) throw new Error('Not in Supabase mode');
  return backend;
}

/** Start in Supabase mode: show the login form, or the businesses if a session is already there. */
export async function startSupabaseSession(b: Backend, t: Timing = {}): Promise<void> {
  backend = b;
  timing = t;
  window.addEventListener('beforeunload', warnIfUnsaved);
  byId('sign-out-btn').hidden = false;
  const email = await b.currentUser();
  if (email) await showBusinesses(email, true);
  else showLogin();
}

function warnIfUnsaved(event: BeforeUnloadEvent): void {
  if (open?.pending()) {
    event.preventDefault();
    event.returnValue = '';
  }
}

function showMessage(id: string, text: string): void {
  const el = byId(id);
  el.textContent = text;
  el.hidden = !text;
}

function showLogin(message = ''): void {
  byId<HTMLInputElement>('login-password').value = '';
  showMessage('login-error', message);
  showScreen('login');
  byId<HTMLInputElement>('login-email').focus();
}

async function logIn(event: Event): Promise<void> {
  event.preventDefault();
  const email = byId<HTMLInputElement>('login-email').value.trim();
  const password = byId<HTMLInputElement>('login-password').value;
  const button = byId<HTMLButtonElement>('login-button');
  button.disabled = true;
  showMessage('login-error', '');
  try {
    await api().signIn(email, password);
    byId<HTMLInputElement>('login-password').value = '';
    await showBusinesses(email, true);
  } catch (err) {
    showMessage('login-error', err instanceof Error ? err.message : String(err));
  } finally {
    button.disabled = false;
  }
}

/**
 * List the businesses this login can open. With `autoOpen`, open one straight away when the URL
 * names it (?business=…) or when there's only one.
 */
async function showBusinesses(email: string, autoOpen: boolean): Promise<void> {
  signedInAs = email;
  byId('business-picker-user').textContent = `Signed in as ${email}`;
  showMessage('business-picker-message', '');
  try {
    businesses = await api().listBusinesses();
  } catch (err) {
    businesses = [];
    showMessage('business-picker-message', err instanceof Error ? err.message : String(err));
  }
  byId('switch-business-btn').hidden = businesses.length < 2;
  if (autoOpen) {
    const wanted = new URLSearchParams(location.search).get('business');
    const target = businesses.find((b) => b.id === wanted) ?? (businesses.length === 1 ? businesses[0] : undefined);
    if (target) {
      await openBusiness(target.id);
      return;
    }
  }
  const list = byId('business-list');
  list.replaceChildren(...businesses.map((b) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.click = 'openBusiness';
    button.dataset.businessId = b.id;
    button.textContent = b.name;
    const li = document.createElement('li');
    li.append(button);
    return li;
  }));
  if (!businesses.length && !byId('business-picker-message').textContent) {
    showMessage('business-picker-message', "Your login isn't linked to a business yet. Ask Planfarm to add it.");
  }
  showScreen('picker');
}

async function openBusiness(id: string): Promise<void> {
  const persistence = createSupabasePersistence(api(), id, showSaveStatus, timing);
  try {
    await persistence.load();
  } catch (err) {
    showMessage('business-picker-message', `Couldn't open this business: ${err instanceof Error ? err.message : String(err)}`);
    showScreen('picker');
    return;
  }
  open = persistence;
  usePersistence(persistence);
  const name = persistence.businessName();
  const heading = document.querySelector('.header-client h1');
  if (heading) heading.textContent = name;
  document.title = `${name} – Planfarm Elevate`;
  renderWhoSuggestions();
  renderAll();
  setUrlBusiness(id);
  showScreen('dashboard');
}

/** Ask before leaving a business while changes are still on their way to the database. */
function okToLeave(): boolean {
  return !open?.pending() || confirm("Some changes haven't been saved yet. Leave anyway?");
}

async function switchBusiness(): Promise<void> {
  if (!okToLeave()) return;
  open = null;
  setUrlBusiness(null);
  await showBusinesses(signedInAs, false);
}

async function signOut(): Promise<void> {
  if (!okToLeave()) return;
  await api().signOut();
  open = null;
  Object.assign(state, emptyState());
  setUrlBusiness(null);
  showLogin();
}

function setUrlBusiness(id: string | null): void {
  const url = new URL(location.href);
  if (id) url.searchParams.set('business', id);
  else url.searchParams.delete('business');
  history.replaceState(null, '', url);
}

/** The header's save status (replaces "Last updated" in Supabase mode). */
export function showSaveStatus(status: SyncStatus): void {
  const el = document.getElementById('last-updated-display');
  if (!el) return;
  let label = 'Saved';
  let detail = 'All changes saved';
  if (status.state === 'saving') { label = 'Saving…'; detail = ''; }
  if (status.state === 'saved' && status.at) {
    detail = status.at.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  }
  if (status.state === 'error') { label = 'Not saved'; detail = 'Retrying…'; }
  el.title = status.state === 'error' ? status.message : '';
  el.innerHTML = '<div style="font-size:10px;opacity:0.7;letter-spacing:0.04em;text-transform:uppercase;"></div><div style="font-size:12px;font-weight:500;"></div>';
  (el.children[0] as HTMLElement).textContent = label;
  (el.children[1] as HTMLElement).textContent = detail;
  if (status.state === 'saved') renderWhoSuggestions();
}

/** Fill the "Who" suggestions with every name already used in this business. */
function renderWhoSuggestions(): void {
  const list = document.getElementById('who-suggestions');
  if (!list) return;
  const whos = [
    ...state.periods120.flatMap((p) => p.priorities.map((x) => x.who)),
    ...state.rounds.flatMap((r) => r.tasks.map((t) => t.who)),
    ...state.pendingPushes120.map((p) => p.who),
    ...state.pendingPushes.map((p) => p.who),
  ];
  const names = [...new Set(whos.flatMap((who) => who.split(/[/,&]/)).map((n) => n.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  list.replaceChildren(...names.map((name) => {
    const option = document.createElement('option');
    option.value = name;
    return option;
  }));
}

/** The login form, the business list, Switch business and Sign out. */
export const sessionActions: Actions = {
  logIn: (_el, event) => void logIn(event),
  openBusiness: (el) => void openBusiness(str(el, 'businessId')),
  switchBusiness: () => void switchBusiness(),
  signOut: () => void signOut(),
};
