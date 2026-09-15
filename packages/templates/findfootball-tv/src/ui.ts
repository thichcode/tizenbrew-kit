// UI 2 man hinh: Quet lich (trigger crawl) + Chon phat (select player).
// Dieu khien remote: len/xuong di chuyen, Enter chon, Back ve list.
import { Playable } from './api.js';

export type View = 'list' | 'settings';

let items: Playable[] = [];
let focusIdx = 0;

export function setItems(list: Playable[]): void {
  items = list;
  focusIdx = 0;
}

export function getItems(): Playable[] {
  return items;
}

export function renderList(container: HTMLElement, onPick: (i: number) => void): void {
  container.innerHTML = '';
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Chua co link xem. Bam "Quet lich moi" roi doi bot sniff.';
    container.appendChild(p);
    return;
  }
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.className = 'match';
    b.dataset.idx = String(i);
    b.innerHTML =
      `<span class="t">${escapeHtml(it.time)}</span> ` +
      `<span class="n">${escapeHtml(it.title)}</span>`;
    b.addEventListener('click', () => onPick(i));
    b.addEventListener('focus', () => {
      focusIdx = i;
    });
    container.appendChild(b);
  });
}

export function focusItem(i: number): void {
  const nodes = document.querySelectorAll<HTMLButtonElement>('.match');
  const n = nodes.length;
  if (!n) return;
  focusIdx = ((i % n) + n) % n;
  nodes[focusIdx]?.focus();
  nodes[focusIdx]?.scrollIntoView(false);
}

export function moveFocus(d: number): void {
  focusItem(focusIdx + d);
}

export function setStatus(el: HTMLElement | null, t: string): void {
  if (el) el.textContent = t;
}

export function setNow(el: HTMLElement | null, t: string): void {
  if (el) el.textContent = t;
}

export function setCount(el: HTMLElement | null, n: number): void {
  if (el) el.textContent = n ? `${n} link xem` : '';
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
