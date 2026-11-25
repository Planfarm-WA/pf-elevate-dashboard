// Page helpers shared by the jsdom tests: load index.html's body, find elements, and act like a user.
import indexHtml from '../index.html?raw';

export function pageBody(): string {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(indexHtml)?.[1] ?? '';
  return body.replace(/<script[\s\S]*?<\/script>/gi, '');
}

export function $(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`No element matches ${selector}`);
  return el;
}

export function $$(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

export function value(selector: string): string {
  return ($(selector) as HTMLInputElement | HTMLTextAreaElement).value;
}

export function setValue(selector: string, text: string): void {
  ($(selector) as HTMLInputElement | HTMLTextAreaElement).value = text;
}

/** The attribute behind a dataset-style key: 'periodId' → 'data-period-id'. */
export function dataAttr(key: string): string {
  return 'data-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/**
 * Do what a user does to the element whose data-<type> attribute names `action` and whose other
 * data-* attributes match `data`: dispatch a real, bubbling DOM event. The page's delegated
 * listener (src/actions.ts) handles it, exactly as in the browser.
 */
export function act(action: string, data: Record<string, string | number> = {}, type: 'click' | 'input' | 'change' | 'submit' = 'click'): void {
  const selector = `[data-${type}="${action}"]` + Object.entries(data).map(([key, value]) => `[${dataAttr(key)}="${value}"]`).join('');
  const event = type === 'click' ? new MouseEvent('click', { bubbles: true, cancelable: true }) : new Event(type, { bubbles: true, cancelable: true });
  $(selector).dispatchEvent(event);
}
