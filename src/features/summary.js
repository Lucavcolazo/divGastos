// Resumen arriba del aparato: el total del mes y cuánto paga cada uno.
import { $, rollTo } from '../lib/dom.js';
import { on } from '../lib/bus.js';
import { state, total, setSplit, SPLIT_MIN, SPLIT_MAX } from '../state.js';
import { ripple } from './ripple.js';

function renderTotals() {
  const t = total();
  rollTo($('r-total'), t);
  rollTo($('r-half'), t / state.split);
}

function renderSplit() {
  $('split-n').textContent = state.split;
  document.querySelector('[data-split="-1"]').disabled = state.split <= SPLIT_MIN;
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
  on('split:changed', () => { renderSplit(); renderTotals(); });

  renderSplit();
  renderTotals();
}
