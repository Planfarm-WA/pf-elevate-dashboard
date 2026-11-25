// Helpers for the DOM (Document Object Model): the browser's in-memory tree of the page's elements.

/**
 * document.getElementById, typed as T (for example HTMLInputElement, so `.value` type-checks).
 * Throws "Missing element #id" if the element isn't there, instead of returning null. Use plain
 * document.getElementById where a missing element is expected and handled.
 */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}
