// The staff admin screen ("Manage businesses", #admin), reached from the business list
// (session.ts): add, rename and delete businesses, and choose which client logins can open each
// one. Logins themselves are created in the Supabase dashboard. The rows are built with DOM
// properties (textContent, value, dataset), so names and emails are never read as HTML.

import { str, type Actions } from './actions.ts';
import type { Backend, BusinessSummary, ClientLogin } from './backend.ts';
import { byId, showMessage } from './dom.ts';

let backend: Backend | null = null;
let businesses: BusinessSummary[] = [];
let logins: ClientLogin[] = [];
/** One change at a time: a second click while one is saving does nothing. */
let busy = false;

/** Fill the screen (each time it opens). A failure shows on the screen; this never throws. */
export async function loadAdmin(b: Backend): Promise<void> {
  backend = b;
  showMessage('admin-message', '');
  byId('admin-list').replaceChildren(text('p', 'Loading…', 'auth-sub'));
  try {
    await refresh();
  } catch (err) {
    byId('admin-list').replaceChildren();
    showMessage('admin-message', messageOf(err));
  }
}

function api(): Backend {
  if (!backend) throw new Error('Not in Supabase mode');
  return backend;
}

async function refresh(): Promise<void> {
  [businesses, logins] = await Promise.all([api().listBusinesses(), api().listClientLogins()]);
  const list = byId('admin-list');
  if (!businesses.length) list.replaceChildren(text('p', 'No businesses yet. Add the first one above.', 'auth-sub'));
  else list.replaceChildren(...businesses.map(businessSection));
}

// ---- Building the screen ----

function text<K extends keyof HTMLElementTagNameMap>(tag: K, content: string, className = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.textContent = content;
  if (className) el.className = className;
  return el;
}

function button(label: string, className: string, type: 'button' | 'submit'): HTMLButtonElement {
  const el = text('button', label, className);
  el.type = type;
  return el;
}

function input(name: string, value: string, placeholder: string): HTMLInputElement {
  const el = document.createElement('input');
  el.className = 'form-input';
  el.name = name;
  el.value = value;
  el.placeholder = placeholder;
  el.autocomplete = 'off';
  return el;
}

function rowForm(businessId: string, ...children: HTMLElement[]): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'admin-row';
  form.dataset.businessId = businessId;
  form.append(...children);
  return form;
}

/** One business: rename, its client logins (Remove), link a login by email, and delete. */
function businessSection(b: BusinessSummary): HTMLElement {
  const section = document.createElement('section');
  section.className = 'admin-business';
  section.id = `admin-business-${b.id}`;

  const nameInput = input('name', b.name, 'Business name');
  nameInput.setAttribute('aria-label', 'Business name');
  const rename = rowForm(b.id, nameInput, button('Rename', 'btn btn-ghost btn-sm', 'submit'));
  rename.dataset.submit = 'renameBusiness';

  const list = text('ul', '', 'admin-logins');
  const mine = logins.filter((l) => l.businessId === b.id);
  if (!mine.length) list.append(text('li', 'No client logins yet.', 'admin-none'));
  for (const login of mine) {
    const remove = button('Remove', 'btn btn-danger btn-sm', 'button');
    remove.dataset.click = 'unlinkClient';
    remove.dataset.businessId = b.id;
    remove.dataset.userId = login.userId;
    const li = document.createElement('li');
    li.append(text('span', login.email, 'admin-login-email'), remove);
    list.append(li);
  }

  const email = input('email', '', 'Email of an existing login');
  email.type = 'email';
  email.setAttribute('aria-label', `Email of a login to link to ${b.name}`);
  const link = rowForm(b.id, email, button('Link login', 'btn btn-teal btn-sm', 'submit'));
  link.dataset.submit = 'linkClient';

  const error = text('p', '', 'auth-error');
  error.id = `admin-error-${b.id}`;
  error.hidden = true;

  const confirmName = input('confirmName', '', `Type ${b.name} to confirm`);
  confirmName.setAttribute('aria-label', `Type ${b.name} to confirm deleting it`);
  const remove = rowForm(b.id, confirmName, button('Delete', 'btn btn-danger btn-sm', 'submit'));
  remove.dataset.submit = 'deleteBusiness';
  const del = document.createElement('details');
  del.className = 'admin-delete';
  del.append(
    text('summary', 'Delete business…'),
    text('p', `Deletes ${b.name}'s whole dashboard and its client links, and can't be undone: export its data first if it might be needed. The logins themselves stay.`),
    remove,
  );

  section.append(rename, text('h3', 'Client logins'), list, link, error, del);
  return section;
}

// ---- Changes ----

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The text typed in a form's input. */
function field(form: HTMLElement, name: string): string {
  return form.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value.trim() ?? '';
}

/** Another business with this name (ignoring case), apart from `exceptId`. */
function nameTaken(name: string, exceptId = ''): BusinessSummary | undefined {
  return businesses.find((b) => b.id !== exceptId && b.name.trim().toLowerCase() === name.toLowerCase());
}

const takenMessage = (name: string) => `Another business is already called ${name}. Use a different name, so the two can't be mixed up.`;

/**
 * Make one change, then reload the lists (which also clears the forms). On failure the message
 * shows in `messageId`, and what was typed stays. Returns whether it worked.
 */
async function run(messageId: string, change: () => Promise<void>): Promise<boolean> {
  if (busy) return false;
  busy = true;
  showMessage('admin-message', '');
  showMessage(messageId, '');
  try {
    await change();
    await refresh();
    return true;
  } catch (err) {
    showMessage(messageId, messageOf(err));
    return false;
  } finally {
    busy = false;
  }
}

async function createBusiness(): Promise<void> {
  const nameInput = byId<HTMLInputElement>('new-business-name');
  const name = nameInput.value.trim();
  if (!name) return showMessage('admin-message', 'A business needs a name.');
  if (nameTaken(name)) return showMessage('admin-message', takenMessage(name));
  if (await run('admin-message', async () => { await api().createBusiness(name); })) {
    nameInput.value = '';
    // The next step is usually linking the client's login (names are unique, see nameTaken()).
    const created = businesses.find((b) => b.name === name);
    if (created) document.getElementById(`admin-business-${created.id}`)?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
  }
}

async function renameBusiness(form: HTMLElement): Promise<void> {
  const id = str(form, 'businessId');
  const name = field(form, 'name');
  const errorId = `admin-error-${id}`;
  if (!name) return showMessage(errorId, 'A business needs a name.');
  if (businesses.find((b) => b.id === id)?.name === name) return;
  if (nameTaken(name, id)) return showMessage(errorId, takenMessage(name));
  await run(errorId, () => api().renameBusiness(id, name));
}

async function linkClient(form: HTMLElement): Promise<void> {
  const id = str(form, 'businessId');
  const email = field(form, 'email');
  if (!email) return showMessage(`admin-error-${id}`, 'Type the email of an existing login.');
  await run(`admin-error-${id}`, () => api().linkClient(id, email));
}

async function unlinkClient(el: HTMLElement): Promise<void> {
  const id = str(el, 'businessId');
  const userId = str(el, 'userId');
  const email = logins.find((l) => l.businessId === id && l.userId === userId)?.email ?? 'this login';
  const name = businesses.find((b) => b.id === id)?.name ?? 'this business';
  if (!confirm(`Remove ${email}'s access to ${name}? The login itself stays.`)) return;
  await run(`admin-error-${id}`, () => api().unlinkClient(id, userId));
}

async function deleteBusiness(form: HTMLElement): Promise<void> {
  const id = str(form, 'businessId');
  const business = businesses.find((b) => b.id === id);
  if (!business) return;
  // Typing the exact name is the confirmation: it deletes the business's whole dashboard.
  if (field(form, 'confirmName') !== business.name.trim()) {
    return showMessage(`admin-error-${id}`, `Type the name exactly as shown (${business.name}) to delete this business.`);
  }
  await run(`admin-error-${id}`, () => api().deleteBusiness(id));
}

/** The admin screen's forms and buttons. */
export const adminActions: Actions = {
  createBusiness: (_el, event) => { event.preventDefault(); void createBusiness(); },
  renameBusiness: (el, event) => { event.preventDefault(); void renameBusiness(el); },
  linkClient: (el, event) => { event.preventDefault(); void linkClient(el); },
  unlinkClient: (el) => void unlinkClient(el),
  deleteBusiness: (el, event) => { event.preventDefault(); void deleteBusiness(el); },
};
