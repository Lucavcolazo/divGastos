// Resumen arriba de la mesa: lo que se está cargando, el total y cuánto paga cada uno.
import { $, rollTo } from '../lib/dom.js';
import { esc, fmtEntry } from '../lib/format.js';
import { on } from '../lib/bus.js';
import { state, total, catLabel, setSplit, SPLIT_MAX } from '../state.js';
import { ripple } from './ripple.js';

function renderEntry() {
  const { entry } = state;
  const name = entry.name.trim();
  $('h-meta').innerHTML = `${name ? esc(name) : '<span class="muted">concepto</span>'} <span class="muted">· ${catLabel(entry.cat)}</span>`;
  $('h-amt').textContent = fmtEntry(entry.amount);
}

function renderTotals() {
  const t = total();
  rollTo($('r-total'), t);
  rollTo($('r-half'), t / state.split);
}

function renderSplit() {
  $('split-n').textContent = state.split;
  document.querySelectorAll('.split-label').forEach(el => { el.textContent = state.split; });
  document.querySelector('[data-split="-1"]').disabled = state.split <= 1;
  document.querySelector('[data-split="1"]').disabled = state.split >= SPLIT_MAX;
}

export function initSummary() {
  document.querySelectorAll('.split-btn').forEach(btn => btn.addEventListener('click', () => {
    setSplit(state.split + Number(btn.dataset.split));
    ripple(btn, 0.6);
  }));

  on('item:added', renderTotals);
  on('item:updated', renderTotals);
  on('items:changed', renderTotals);
  on('entry:changed', renderEntry);
  on('split:changed', () => { renderSplit(); renderTotals(); });

  renderSplit();
  renderEntry();
  renderTotals();
}
