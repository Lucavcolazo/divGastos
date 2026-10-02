import { money } from './format.js';

export const $ = id => document.getElementById(id);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Vuelve a disparar una animación CSS sacando y poniendo la clase. */
export function restartAnimation(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

const ROLL_MS = 700;
const ROLL_STAGGER_MS = 35;

function rollChar(oldCh, newCh, dir, delay) {
  const ch = document.createElement('span');
  ch.className = 'roll-ch';
  ch.style.setProperty('--dir', dir);
  ch.style.setProperty('--delay', `${delay}ms`);
  const out = document.createElement('span');
  out.className = 'roll-old';
  out.textContent = oldCh;
  const inn = document.createElement('span');
  inn.className = 'roll-new';
  inn.textContent = newCh;
  ch.append(out, inn);
  return ch;
}

/**
 * Muestra un monto con efecto rodillo: solo los dígitos que cambian se deslizan,
 * hacia arriba si el monto sube y hacia abajo si baja. Necesita la clase `.roll`.
 */
export function rollTo(el, value) {
  const text = money(value);
  const prevText = el._text;
  const prevValue = el._v ?? 0;
  el._text = text;
  el._v = value;
  clearTimeout(el._rollTimer);

  // primera vez (al cargar) o sin animaciones: sin rodillo
  if (prevText === undefined || reduced) {
    el.textContent = text;
    return;
  }
  if (prevText === text) return;

  // se comparan alineados a la derecha, como se ven en pantalla
  const n = Math.max(text.length, prevText.length);
  const from = prevText.padStart(n);
  const to = text.padStart(n);
  const dir = value >= prevValue ? 1 : -1;

  const frag = document.createDocumentFragment();
  let changed = 0;
  for (let i = n - 1; i >= 0; i--) {
    frag.prepend(from[i] === to[i] ? document.createTextNode(to[i]) : rollChar(from[i], to[i], dir, changed++ * ROLL_STAGGER_MS));
  }
  el.replaceChildren(frag);

  // al terminar deja texto plano (y saca los espacios de relleno)
  el._rollTimer = setTimeout(() => { el.textContent = text; }, ROLL_MS + changed * ROLL_STAGGER_MS + 50);
}
