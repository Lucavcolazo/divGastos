import { emit } from './lib/bus.js';
import { loadItems, saveItems, loadSplit, saveSplit } from './lib/storage.js';

export const CATEGORIES = [
  { id: 'Alquiler', label: 'alquiler' },
  { id: 'Servicios', label: 'servicios' },
  { id: 'Ocio', label: 'ocio' },
  { id: 'Otros', label: 'otros' },
];
export const SPLIT_MIN = 2; // entre 1 "cada uno" sería igual al total
export const SPLIT_MAX = 20;
const DEFAULT_SPLIT = 2;

export const catLabel = id => (CATEGORIES.find(c => c.id === id) ?? CATEGORIES.at(-1)).label;

const isValidItem = i => i && typeof i.id === 'string' && typeof i.name === 'string' && Number.isFinite(i.amount);
const normalize = i => ({ ...i, cat: CATEGORIES.some(c => c.id === i.cat) ? i.cat : 'Otros' });
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const state = {
  /** @type {{ id: string, name: string, cat: string, amount: number }[]} */
  items: loadItems().filter(isValidItem).map(normalize),
  split: loadSplit(DEFAULT_SPLIT, SPLIT_MIN, SPLIT_MAX),
  /** Lo que se está tipeando en la calculadora. `amount` es texto ("1234,5"). */
  entry: { name: '', cat: CATEGORIES[0].id, amount: '', editing: null },
};

export const total = () => state.items.reduce((s, i) => s + i.amount, 0);
export const findItem = id => state.items.find(i => i.id === id);
export const indexOf = id => state.items.findIndex(i => i.id === id);

/* ---------- gastos ---------- */

export function addItem({ name, cat, amount }) {
  const item = { id: newId(), name, cat, amount };
  state.items.push(item);
  saveItems(state.items);
  emit('item:added', item);
  return item;
}

export function updateItem(id, patch) {
  const item = findItem(id);
  if (!item) return;
  Object.assign(item, patch);
  saveItems(state.items);
  emit('item:updated', item);
}

export function removeItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  saveItems(state.items);
  if (state.entry.editing === id) resetEntry();
  emit('items:changed');
}

export function replaceItems(items) {
  state.items = items;
  saveItems(state.items);
  emit('items:changed');
}

/* ---------- división ---------- */

export function setSplit(n) {
  const next = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
  if (next === state.split) return;
  state.split = next;
  saveSplit(next);
  emit('split:changed', next);
}

/* ---------- entrada de la calculadora ---------- */

export function setEntry(patch) {
  Object.assign(state.entry, patch);
  emit('entry:changed');
}

export function resetEntry() {
  setEntry({ name: '', amount: '', editing: null });
}
