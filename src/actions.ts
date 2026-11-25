// Event delegation. Elements say what should happen in data attributes instead of inline
// onclick="..." code, and one listener per event type (on the document) runs the matching action:
//
//   <button data-click="setStatus120" data-period-id="1750000000000" data-item-id="1" data-status="on-track">
//
// data-click / data-input / data-change name the action for that event. Any other data-*
// attributes are its arguments, read with num() and oneOf() below. Each module exports its
// actions next to the markup that uses them; main.ts merges and installs them.

/** Runs for an event on `el`, the element carrying the data-click/data-input/data-change attribute. */
export type Action = (el: HTMLElement, event: Event) => void;
export type Actions = Record<string, Action>;

/** The events that can be delegated: the data-<event> attributes that are understood. */
export const ACTION_EVENTS = ['click', 'input', 'change'] as const;

/** Combine the modules' actions. Throws if two modules register the same name. */
export function mergeActions(...groups: Actions[]): Actions {
  const all: Actions = {};
  for (const group of groups) {
    for (const [name, action] of Object.entries(group)) {
      if (name in all) throw new Error(`Action "${name}" is registered twice`);
      all[name] = action;
    }
  }
  return all;
}

/** Where the installed actions live, so installing again replaces them instead of adding listeners. */
const INSTALLED = Symbol.for('pf-elevate:actions');
type DocumentWithActions = Document & { [INSTALLED]?: Actions };

/**
 * Add one document listener per event type, running the action that data-<event> names. Calling
 * it again (the tests re-run startup; Vite can re-run modules) only swaps the actions, so an
 * event never runs its action twice.
 */
export function installActions(actions: Actions): void {
  const doc = document as DocumentWithActions;
  const alreadyListening = doc[INSTALLED] !== undefined;
  doc[INSTALLED] = actions;
  if (alreadyListening) return;
  for (const type of ACTION_EVENTS) {
    document.addEventListener(type, (event) => {
      if (!(event.target instanceof Element)) return;
      const el = event.target.closest<HTMLElement>(`[data-${type}]`);
      if (!el) return;
      const name = el.dataset[type] ?? '';
      const action = doc[INSTALLED]?.[name];
      if (!action) {
        console.error(`No action "${name}" (data-${type} on <${el.tagName.toLowerCase()}>)`);
        return;
      }
      action(el, event);
    });
  }
}

/** The attribute behind a dataset key, for messages: 'periodId' → 'data-period-id'. */
function attributeName(key: string): string {
  return 'data-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/** A number argument: num(el, 'periodId') reads data-period-id. Throws if it's missing or not a number. */
export function num(el: HTMLElement, key: string): number {
  const raw = el.dataset[key];
  const value = Number(raw);
  if (raw === undefined || raw === '' || Number.isNaN(value)) {
    throw new Error(`${attributeName(key)} must be a number, not ${JSON.stringify(raw)}`);
  }
  return value;
}

/** An argument limited to `allowed`, e.g. oneOf(el, 'status', STATUSES). Throws if it's anything else. */
export function oneOf<T extends string>(el: HTMLElement, key: string, allowed: readonly T[]): T {
  const raw = el.dataset[key];
  if (raw === undefined || !(allowed as readonly string[]).includes(raw)) {
    throw new Error(`${attributeName(key)} must be one of ${allowed.join(', ')}, not ${JSON.stringify(raw)}`);
  }
  return raw as T;
}
