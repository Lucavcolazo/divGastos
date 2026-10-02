import { $, restartAnimation } from '../lib/dom.js';
import { pad, fmtEntry, parseEntry } from '../lib/format.js';
import { on } from '../lib/bus.js';
import {
  state, CATEGORIES, catLabel, indexOf, findItem,
  setEntry, resetEntry, addItem, updateItem,
} from '../state.js';
import { ripple } from './ripple.js';

const MAX_DIGITS = 11;

const shake = () => restartAnimation($('screen'), 'shake');

/** Procesa una tecla de la calculadora: dígitos, "000", ",", back, clear o add. */
export function press(k) {
  const a = state.entry.amount;
  let next;

  if (/^\d$/.test(k)) {
    if (a.includes(',') ? a.split(',')[1].length >= 2 : a.length >= MAX_DIGITS) return shake();
    next = a === '0' ? k : a + k;
  } else if (k === '000') {
    if (!a || a === '0' || a.includes(',') || a.length + 3 > MAX_DIGITS) return shake();
    next = a + '000';
  } else if (k === ',') {
    if (a.includes(',')) return shake();
    next = (a || '0') + ',';
  } else if (k === 'back') {
    next = a.slice(0, -1);
  } else if (k === 'clear') {
    return resetEntry();
  } else if (k === 'add') {
    return commit();
  } else {
    return;
  }
  setEntry({ amount: next });
}

function commit() {
  const { entry } = state;
  const amount = parseEntry(entry.amount);
  if (!(amount > 0)) return shake();
  const data = { name: entry.name.trim() || catLabel(entry.cat), cat: entry.cat, amount };

  if (entry.editing) updateItem(entry.editing, data);
  else addItem(data);

  resetEntry();
  ripple($('printer'), 1.6);
}

function startEdit(id) {
  if (state.entry.editing === id) return resetEntry();
  const item = findItem(id);
  if (!item) return;
  setEntry({ editing: id, name: item.name, cat: item.cat, amount: String(item.amount).replace('.', ',') });
}

/** Marca una tecla como apretada (cuando se usa el teclado físico). */
export function flashKey(k) {
  const btn = document.querySelector(`.key[data-k="${k}"]`);
  if (!btn) return;
  btn.classList.add('is-down');
  setTimeout(() => btn.classList.remove('is-down'), 110);
  ripple(btn, k === 'add' ? 1.2 : 0.8);
}

export const focusName = () => $('s-name').focus({ preventScroll: true });

function render() {
  const { entry } = state;
  const nameEl = $('s-name');
  if (nameEl.value !== entry.name) nameEl.value = entry.name;
  $('s-cat').textContent = catLabel(entry.cat);
  $('s-mode').textContent = entry.editing ? `editando #${pad(indexOf(entry.editing) + 1)}` : 'nuevo';
  $('s-amt').textContent = fmtEntry(entry.amount);
  $('add-label').textContent = entry.editing ? 'guardar' : 'imprimir';
  document.querySelectorAll('.cat').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === entry.cat));
}

export function initCalculator() {
  const cats = $('cats');
  cats.innerHTML = CATEGORIES.map(c => `<button class="cat" type="button" data-cat="${c.id}" aria-pressed="false">${c.label}</button>`).join('');
  cats.addEventListener('click', e => {
    const btn = e.target.closest('.cat');
    if (!btn) return;
    setEntry({ cat: btn.dataset.cat });
    ripple(btn, 0.6);
  });

  $('keys').addEventListener('click', e => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    ripple(btn, btn.dataset.k === 'add' ? 1.2 : 0.8);
    press(btn.dataset.k);
  });

  const nameEl = $('s-name');
  nameEl.addEventListener('input', () => setEntry({ name: nameEl.value }));
  nameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // con monto cargado imprime; si no, suelta el foco para tipear el monto
      if (state.entry.amount) commit();
      else nameEl.blur();
    } else if (e.key === 'Escape') {
      nameEl.blur();
    }
  });

  on('entry:changed', render);
  on('items:changed', render);
  on('edit:request', startEdit);
  render();
}
