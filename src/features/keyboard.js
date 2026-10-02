// Teclado físico: números, coma, backspace, enter, escape. Letras van al concepto.
import { $ } from '../lib/dom.js';
import { emit } from '../lib/bus.js';
import { state } from '../state.js';
import { press, flashKey, focusName } from './calculator.js';
import { heroInView, goToCalc } from './hero.js';

const KEYMAP = { ',': ',', '.': ',', Backspace: 'back', Escape: 'clear', Delete: 'clear', Enter: 'add', '+': 'add' };

export function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target === $('s-name') || e.ctrlKey || e.metaKey || e.altKey) return;

    // Enter sobre una línea del ticket la edita
    const row = e.target.closest?.('.p-item');
    if (row && e.key === 'Enter' && !e.target.closest('.p-del')) {
      e.preventDefault();
      emit('edit:request', row.dataset.id);
      return;
    }
    // Enter/espacio sobre otros botones (dividir, deshacer…) hacen lo suyo
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a') && !e.target.closest('.calc')) return;

    const k = /^\d$/.test(e.key) ? e.key : KEYMAP[e.key];
    if (k) {
      e.preventDefault();
      // Desde el hero, enter (o empezar a tipear) baja a la calculadora
      if (heroInView()) {
        goToCalc();
        if (k === 'add' && !state.entry.amount) return;
      }
      flashKey(k);
      press(k);
    } else if (e.key.length === 1 && /\p{L}/u.test(e.key)) {
      if (heroInView()) goToCalc();
      focusName();
    }
  });
}
