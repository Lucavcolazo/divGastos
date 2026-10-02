// Montos siempre en pesos enteros: ,50 o más redondea para arriba, menos para abajo
const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0, roundingMode: 'halfExpand' });

export const num = v => nf.format(v);
export const money = v => '$ ' + nf.format(v);
export const pad = n => String(n).padStart(2, '0');

/** Monto en formato es-AR mientras se escribe: "1234,5" -> "1.234,5" */
export function fmtEntry(s) {
  if (!s) return '0';
  const [int, dec] = s.split(',');
  const head = nf.format(Number(int || 0));
  return s.includes(',') ? head + ',' + dec : head;
}

/** "1234,5" -> 1234.5 */
export const parseEntry = s => parseFloat((s || '0').replace(',', '.')) || 0;

export function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
