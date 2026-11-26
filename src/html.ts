// Escaping text for the HTML strings the sections build and set with innerHTML.
//
// The rule: every value from `state`, the database or a form input that goes into such a string
// goes through esc(), whether it ends up as element text, inside a quoted attribute (value, id,
// data-*) or as textarea content. Otherwise a `<` or `"` in someone's text becomes part of the
// page: it cuts a field short in an edit dialog, or adds elements and event handlers that run code
// for everyone who opens that business. Text set through DOM properties (textContent, .value,
// dataset) needs nothing.

const CODES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** `text` with & < > " ' replaced by character references, so the browser shows it as typed. */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => CODES[c]);
}
