// Drag-to-reorder for the priority/task tables and the 1-year targets list.

import { state } from './state.ts';
import { save } from './storage.ts';

/** The row or list item being dragged. */
let dragSrc: HTMLElement | null = null;

/**
 * Make the rows of a priorities/tasks table draggable. Dropping a row moves it, reorders the
 * matching items in `state` to the new row order (by `data-id`) and saves.
 */
export function initDragTable(tbodyId: string, type: 'priorities120' | 'tasks30', contextId: number): void {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      dragSrc = row;
      row.classList.add('dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drag-over'));
      if (row !== dragSrc) row.classList.add('drag-over');
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (row === dragSrc) return;
      row.classList.remove('drag-over');
      if (!dragSrc) return;
      const rows: Element[] = Array.from(tbody.querySelectorAll('tr'));
      const dragIdx = rows.indexOf(dragSrc);
      const dropIdx = rows.indexOf(row);
      if (dragIdx < dropIdx) tbody.insertBefore(dragSrc, row.nextSibling);
      else tbody.insertBefore(dragSrc, row);
      const newOrder = Array.from(tbody.querySelectorAll('tr')).map((r) => parseInt(r.getAttribute('data-id') ?? ''));
      if (type === 'priorities120') {
        const period = state.periods120.find((p) => p.id === contextId);
        if (period) {
          period.priorities.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
          save();
        }
      } else if (type === 'tasks30') {
        const round = state.rounds.find((r) => r.id === contextId);
        if (round) {
          round.tasks.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
          save();
        }
      }
    });
  });
}

/**
 * Make the items of a list draggable. For the 1-year targets, dropping reorders
 * state.blueprint.oneyear to the new order (by `data-idx`), renumbers the items and saves.
 */
export function initDragList(listId: string, type: 'oneyear'): void {
  const list = document.getElementById(listId);
  if (!list) return;
  list.querySelectorAll('li').forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      dragSrc = item;
      item.classList.add('dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('li').forEach((i) => i.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      list.querySelectorAll('li').forEach((i) => i.classList.remove('drag-over'));
      if (item !== dragSrc) item.classList.add('drag-over');
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      if (item === dragSrc) return;
      item.classList.remove('drag-over');
      if (!dragSrc) return;
      const items: Element[] = Array.from(list.querySelectorAll('li'));
      const dragIdx = items.indexOf(dragSrc);
      const dropIdx = items.indexOf(item);
      if (dragIdx < dropIdx) list.insertBefore(dragSrc, item.nextSibling);
      else list.insertBefore(dragSrc, item);
      if (type === 'oneyear') {
        const newOrder = Array.from(list.querySelectorAll('li')).map((i) => parseInt(i.getAttribute('data-idx') ?? ''));
        const reordered = newOrder.map((idx) => state.blueprint.oneyear[idx]);
        state.blueprint.oneyear = reordered;
        list.querySelectorAll('li').forEach((li, i) => li.setAttribute('data-idx', String(i)));
        save();
      }
    });
  });
}
