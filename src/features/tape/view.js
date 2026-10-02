// Vista de frente del papel. La física lo resuelve de costado (profundidad u, altura v);
// acá cada tramo se proyecta a la pantalla y se le pega la franja de ticket que le toca.
// Los tramos que se alejan se achican (escorzo), los que caen por atrás muestran el dorso
// y lo que queda debajo de la ranura lo tapa el aparato.

import { PAPER_W } from './ticket.js';

const K = 0.22;             // lo que está más atrás se ve un poco más arriba
const F = 900;              // perspectiva: lo de atrás se ve apenas más angosto
const ROLL_U = 34;          // profundidad del rollo (ver physics.js)
const ROLL_TOP = 16;
const ROLL_W = 290;
const LIGHT_U = -0.92, LIGHT_V = 0.38;  // luz de adelante: la parte que se curva hacia atrás queda en sombra

export function createView(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let slotY = 0, cx = 0;
  let drawn = [];           // tramos de frente del último cuadro, para ubicar el mouse

  function resize(below) {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    slotY = h - below;
    cx = w / 2;
  }

  const screenY = (u, v) => slotY - (v + u * K);
  const halfW = u => (PAPER_W / 2) * (F / (F + Math.max(-F / 2, u)));

  function drawRoll() {
    const top = slotY - (ROLL_TOP + ROLL_U * K);
    const g = ctx.createLinearGradient(0, top, 0, slotY);
    g.addColorStop(0, '#d9ebff');
    g.addColorStop(0.45, '#9cc7f7');
    g.addColorStop(1, '#4e8fe0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(cx - ROLL_W / 2, top, ROLL_W, slotY - top + 6, [14, 14, 0, 0]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(cx - ROLL_W / 2 + 14, top + 1, ROLL_W - 28, 1);
  }

  /**
   * @param {ReturnType<import('./physics.js').createTape>['snapshot']} snap
   * @param {HTMLCanvasElement} tex   textura del ticket (ver ticket.js)
   * @param {object} o
   * @param {number} o.texScale       resolución de la textura
   * @param {number} o.texLength      largo dibujado en la textura
   * @param {number} o.sway           vaivén lateral de la parte de arriba, en px
   * @param {number} o.alpha
   */
  function draw(snap, tex, o) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { u, v, m0, h: seg } = snap;
    const n = u.length;
    const off = j => o.sway * Math.min(1, Math.max(0, v[j]) / 200) ** 2;

    // tramos ordenados de atrás para adelante
    const segs = [];
    for (let j = 0; j < n - 1; j++) {
      const top = m0 + j * seg;
      if (top >= o.texLength) break;
      segs.push(j);
    }
    segs.sort((a, b) => (u[b] + u[b + 1]) - (u[a] + u[a + 1]));

    drawn = [];
    ctx.globalAlpha = o.alpha;
    let rollDone = false;
    for (const j of segs) {
      const um = (u[j] + u[j + 1]) / 2;
      if (!rollDone && um < ROLL_U) { drawRoll(); rollDone = true; }

      const ya = screenY(u[j], v[j]);
      const yb = screenY(u[j + 1], v[j + 1]);
      const hw = halfW(um);
      const x = cx + (off(j) + off(j + 1)) / 2 - hw;
      // normal de la cara impresa y luz de arriba-adelante
      const tu = (u[j] - u[j + 1]) / seg, tv = (v[j] - v[j + 1]) / seg;
      const lit = -tv * LIGHT_U + tu * LIGHT_V;
      const front = yb > ya;
      const y0 = Math.min(ya, yb), hh = Math.abs(yb - ya) + 0.75;

      if (front) {
        const top = m0 + j * seg;
        ctx.drawImage(tex, 0, top * o.texScale, tex.width, seg * o.texScale, x, ya, hw * 2, hh);
        const shade = (1 - Math.max(0, Math.min(1, lit))) * 0.3;
        if (shade > 0.01) {
          ctx.fillStyle = `rgba(0, 35, 110, ${shade})`;
          ctx.fillRect(x, y0, hw * 2, hh);
        }
        drawn.push({ ya, yb, x, w: hw * 2, top, seg });
      } else {
        // dorso del papel
        const shade = 0.12 + (1 - Math.max(0, Math.min(1, -lit))) * 0.22;
        ctx.fillStyle = '#e9f1fc';
        ctx.fillRect(x, y0, hw * 2, hh);
        ctx.fillStyle = `rgba(0, 35, 110, ${shade})`;
        ctx.fillRect(x, y0, hw * 2, hh);
      }
    }
    if (!rollDone) drawRoll();
    ctx.globalAlpha = 1;
  }

  /** Qué parte del ticket está bajo el punto (x, y) del canvas: { y, x } en la textura, o null. */
  function hit(px, py) {
    if (py > slotY) return null;
    for (let i = drawn.length - 1; i >= 0; i--) {
      const d = drawn[i];
      if (py < d.ya || py > d.yb || px < d.x || px > d.x + d.w) continue;
      return { y: d.top + ((py - d.ya) / (d.yb - d.ya || 1)) * d.seg, x: ((px - d.x) / d.w) * PAPER_W };
    }
    return null;
  }

  return { resize, draw, hit, get dpr() { return dpr; } };
}
