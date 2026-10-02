// Punto de entrada liviano para las ondas del fondo. three.js se carga aparte
// (ver main.js); hasta que llega, ripple() no hace nada.

let rippleAt = null;

export const setRippleHandler = fn => { rippleAt = fn; };

/** Manda una onda desde el centro de un elemento de la página. */
export function ripple(el, strength = 1) {
  if (!rippleAt || !el) return;
  const r = el.getBoundingClientRect();
  rippleAt(r.left + r.width / 2, r.top + r.height / 2, strength);
}
