// Dibuja el ticket impreso en un canvas aparte (la "textura" del papel). La vista
// después lo recorta en tiras finitas y las pega sobre la forma que da la física.
//
// El eje y de la textura es el material del papel: 0 es la punta (el corte de arriba,
// con el encabezado) y crece hacia la ranura, donde está el último gasto.

import { num, pad } from '../../lib/format.js';

export const PAPER_W = 244;
const PAD_X = 18;
const TOP = 80;             // encabezado
export const ROW_H = 44;
const EMPTY_H = 52;
const BOTTOM = 14;
const BLANK = 420;          // papel en blanco que sigue en el rollo (se ve al tirar)

const INK = '#0150c0';
const INK_SOFT = '#2b5aa6';
const PAPER = '#fdfeff';
const FONT = '"Geist Mono", ui-monospace, monospace';

/**
 * Ubica cada fila en el papel. `collapse` (id → 0..1) achica las que se están borrando.
 * Devuelve las filas con su `y` y el largo total de lo impreso.
 */
export function layoutTicket(items, collapse = new Map()) {
  let y = TOP;
  const rows = items.map(item => {
    const h = ROW_H * (1 - (collapse.get(item.id) ?? 0));
    const row = { item, y, h };
    y += h;
    return row;
  });
  if (!rows.length) y += EMPTY_H;
  return { rows, length: y + BOTTOM };
}

export function rowAt(layout, y) {
  return layout.rows.find(r => y >= r.y && y < r.y + r.h) ?? null;
}

function zigzagTop(ctx, w) {
  const step = 12, depth = 7;
  ctx.beginPath();
  ctx.moveTo(0, depth);
  for (let x = 0; x < w; x += step) {
    ctx.lineTo(x + step / 2, 0);
    ctx.lineTo(Math.min(w, x + step), depth);
  }
  ctx.lineTo(w, depth + 1);
  ctx.lineTo(0, depth + 1);
  ctx.closePath();
  ctx.fill();
}

function dashed(ctx, y) {
  ctx.save();
  ctx.strokeStyle = 'rgba(1, 80, 192, 0.45)';
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(PAD_X, y + 0.5);
  ctx.lineTo(PAPER_W - PAD_X, y + 0.5);
  ctx.stroke();
  ctx.restore();
}

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

/**
 * @param {HTMLCanvasElement} canvas  donde se dibuja (se redimensiona solo)
 * @param {object} o
 * @param {ReturnType<typeof layoutTicket>} o.layout
 * @param {number} o.split
 * @param {string} o.month
 * @param {(id: string) => string} o.catLabel
 * @param {string|null} o.hover    fila bajo el mouse
 * @param {string|null} o.editing  fila que se está editando
 * @param {string|null} o.focus    fila con foco del teclado
 * @param {boolean} o.hoverDel     el mouse está sobre la ×
 * @param {number} o.scale         resolución (devicePixelRatio)
 */
export function drawTicket(canvas, o) {
  const { layout, scale } = o;
  const h = Math.ceil(layout.length + BLANK);
  const W = Math.round(PAPER_W * scale), Hpx = Math.round(h * scale);
  if (canvas.width !== W || canvas.height !== Hpx) {
    canvas.width = W;
    canvas.height = Hpx;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, PAPER_W, h);

  // papel con el borde de arriba cortado en zigzag
  ctx.fillStyle = PAPER;
  zigzagTop(ctx, PAPER_W);
  ctx.fillRect(0, 7, PAPER_W, h - 7);

  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';

  // encabezado
  ctx.textAlign = 'center';
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('DIVISOR DE GASTOS', PAPER_W / 2, 36);
  ctx.font = `400 11px ${FONT}`;
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(o.month, PAPER_W / 2, 54);
  dashed(ctx, 68);

  if (!layout.rows.length) {
    ctx.font = `400 11.5px ${FONT}`;
    ctx.fillText('*** sin gastos todavía ***', PAPER_W / 2, TOP + 30);
  }

  const amtRight = PAPER_W - PAD_X - 16; // a la derecha queda lugar para la ×
  layout.rows.forEach((row, idx) => {
    const { item, y, h: rh } = row;
    if (rh < 1) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, PAPER_W, rh);
    ctx.clip();
    ctx.globalAlpha = rh / ROW_H;

    const active = item.id === o.editing || item.id === o.focus;
    if (item.id === o.hover || active) {
      ctx.fillStyle = item.id === o.editing ? 'rgba(2, 114, 253, 0.13)' : 'rgba(2, 114, 253, 0.07)';
      ctx.beginPath();
      ctx.roundRect(PAD_X - 8, y + 3, PAPER_W - 2 * PAD_X + 16, rh - 6, 6);
      ctx.fill();
    }
    if (item.id === o.focus) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(PAD_X - 8, y + 3.5, PAPER_W - 2 * PAD_X + 16, rh - 7, 6);
      ctx.stroke();
    }

    // nombre ........ monto
    ctx.fillStyle = INK;
    ctx.font = `400 13px ${FONT}`;
    ctx.textAlign = 'right';
    const amt = num(item.amount);
    ctx.fillText(amt, amtRight, y + 20);
    const amtW = ctx.measureText(amt).width;
    ctx.textAlign = 'left';
    const name = fit(ctx, item.name, (amtRight - amtW - PAD_X) * 0.72);
    ctx.fillText(name, PAD_X, y + 20);
    const nameW = ctx.measureText(name).width;
    ctx.save();
    ctx.strokeStyle = 'rgba(1, 80, 192, 0.45)';
    ctx.setLineDash([1, 2.5]);
    ctx.beginPath();
    ctx.moveTo(PAD_X + nameW + 6, y + 17.5);
    ctx.lineTo(amtRight - amtW - 6, y + 17.5);
    ctx.stroke();
    ctx.restore();

    // 01 · servicios          c/u 1.234
    ctx.fillStyle = INK_SOFT;
    ctx.font = `400 11px ${FONT}`;
    ctx.fillText(`${pad(idx + 1)} · ${o.catLabel(item.cat)}`, PAD_X, y + 35);
    ctx.textAlign = 'right';
    ctx.fillText(`c/u ${num(item.amount / o.split)}`, amtRight, y + 35);

    // × para borrar
    if (item.id === o.hover || active) {
      ctx.fillStyle = item.id === o.hover && o.hoverDel ? INK : INK_SOFT;
      ctx.font = `400 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('×', PAPER_W - PAD_X - 2, y + 22);
    }
    ctx.restore();
  });

  return h;
}

/** La × ocupa el borde derecho de cada fila. */
export const isDeleteZone = x => x > PAPER_W - PAD_X - 14;
