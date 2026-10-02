import { $ } from '../lib/dom.js';

const DURATION = 7000;
let timer = null;

const hide = () => $('toast').classList.remove('show');

/** Aviso abajo de la pantalla con un botón de acción (ej: deshacer). */
export function showToast(message, actionLabel, onAction) {
  const el = $('toast');
  el.querySelector('.toast-msg').textContent = message;
  const btn = el.querySelector('.toast-action');
  btn.textContent = actionLabel;
  btn.onclick = () => {
    hide();
    onAction();
  };
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(hide, DURATION);
}
