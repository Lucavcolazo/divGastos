// Física del papel: una tira flexible vista de costado. Sale de la ranura hacia arriba,
// se curva hacia atrás por su propio peso (y por la curva que trae del rollo) y cae
// por detrás del aparato.
//
// Coordenadas del plano lateral, en px: u = profundidad (+ hacia atrás), v = altura
// (+ hacia arriba). La ranura está en (0, 0). Cada partícula tiene una coordenada de
// material fija (distancia desde la punta del papel), que es lo que permite mapear
// el ticket impreso sobre la tira aunque se mueva.

const H = 5;                  // separación entre partículas
const MAX_FREE = 560;         // largo simulado; lo que sigue ya está apoyado atrás, fuera de vista
const ITERATIONS = 14;
const SPANS = [1, 2, 4, 8, 16]; // rigidez a varias escalas: el papel se sostiene sin cientos de iteraciones

export const TUNING = {
  gravity: 300,               // papel liviano: el aire lo frena bastante
  damping: 0.975,
  bend: 0.5,                  // rigidez del papel
  curl: 1 / 147,              // curva que trae del rollo: es la que lo dobla hacia atrás
  exitTilt: 0,
  guide: 40,                  // tramo recto que sostiene la tapa transparente de la cuchilla
  restBelow: -20,             // más abajo el papel ya está apoyado detrás: no pesa ni se mueve
  tornGravity: 1600,          // ya cortado cae más rápido
};

// Cuerpo del aparato visto de costado: el rollo detrás de la ranura y la caja debajo
const ROLL = { u: 34, v: -8, r: 24 };
const BODY = { u0: -14, u1: 62, v0: -900, v1: 0 };

export function createTape() {
  // partícula 0 = punta del papel; la última es la que está dentro de la ranura
  let u = [], v = [], pu = [], pv = [], free = [];
  let m0 = 0;        // material de la partícula 0
  let out = 0;       // cuánto papel salió de la ranura
  let torn = false;
  let energy = 0;

  const count = () => u.length;
  const mat = j => m0 + j * H;
  // posición sobre la guía de la ranura para un punto a `s` px de la salida
  const guideAt = s => [Math.sin(TUNING.exitTilt) * s, Math.cos(TUNING.exitTilt) * s];

  function push(j, pos) {
    u.splice(j, 0, pos[0]); v.splice(j, 0, pos[1]);
    pu.splice(j, 0, pos[0]); pv.splice(j, 0, pos[1]);
    free.splice(j, 0, false);
  }
  function drop(j) {
    u.splice(j, 1); v.splice(j, 1); pu.splice(j, 1); pv.splice(j, 1); free.splice(j, 1);
  }

  /** Ajusta las partículas al largo que salió: agrega o saca por la ranura y por la cola. */
  function syncLength() {
    if (torn) return;
    if (!count()) push(0, guideAt(out - m0));
    // por la ranura: siempre una partícula adentro (s <= 0)
    while (out - mat(count() - 1) > 0) push(count(), guideAt(out - mat(count())));
    while (count() > 1 && out - mat(count() - 2) <= 0) drop(count() - 1);
    // por la cola: solo se simulan los últimos MAX_FREE px
    while (count() > 2 && out - mat(1) > MAX_FREE) { drop(0); m0 += H; }
    while (m0 > 0 && out - m0 < MAX_FREE - H) {
      const du = count() > 1 ? u[0] - u[1] : 0;
      const dv = count() > 1 ? v[0] - v[1] : 1;
      push(0, [u[0] + du, v[0] + dv]);
      m0 -= H;
    }
  }

  function placeGuided() {
    for (let j = 0; j < count(); j++) {
      const s = out - mat(j);
      free[j] = torn || s > TUNING.guide;
      if (!free[j]) {
        const [gu, gv] = guideAt(s);
        u[j] = pu[j] = gu;
        v[j] = pv[j] = gv;
      }
    }
  }

  function collide(j) {
    if (torn) return;
    // rollo
    const du = u[j] - ROLL.u, dv = v[j] - ROLL.v;
    const d = Math.hypot(du, dv);
    if (d < ROLL.r) {
      const k = ROLL.r / (d || 1);
      u[j] = ROLL.u + du * k;
      v[j] = ROLL.v + dv * k;
      pu[j] += (u[j] - pu[j]) * 0.3; // un poco de rozamiento
      pv[j] += (v[j] - pv[j]) * 0.3;
    }
    // caja: se empuja hacia la cara más cercana (arriba o atrás)
    if (u[j] > BODY.u0 && u[j] < BODY.u1 && v[j] < BODY.v1 && v[j] > BODY.v0) {
      const toTop = BODY.v1 - v[j];
      const toBack = BODY.u1 - u[j];
      const toFront = u[j] - BODY.u0;
      if (toTop <= toBack && toTop <= toFront) v[j] = BODY.v1;
      else if (toBack <= toFront) u[j] = BODY.u1;
      else u[j] = BODY.u0;
    }
  }

  function solveDistance(a, b) {
    const wa = free[a] ? 1 : 0, wb = free[b] ? 1 : 0;
    const w = wa + wb;
    if (!w) return;
    const du = u[b] - u[a], dv = v[b] - v[a];
    const d = Math.hypot(du, dv) || 1e-6;
    const k = (d - H) / d / w;
    u[a] += du * k * wa; v[a] += dv * k * wa;
    u[b] -= du * k * wb; v[b] -= dv * k * wb;
  }

  // Lleva la partícula del medio hacia donde estaría si la tira tuviera su curva de reposo
  function solveBend(a, i, b, span) {
    const wa = free[a] ? 1 : 0, wi = free[i] ? 1 : 0, wb = free[b] ? 1 : 0;
    const w = wi + (wa + wb) / 4;
    if (!w) return;
    // cuerda hacia la punta (a) desde la ranura (b); la curva de reposo dobla hacia atrás
    const cu = u[a] - u[b], cv = v[a] - v[b];
    const cl = Math.hypot(cu, cv) || 1e-6;
    const sag = (span * span * TUNING.curl) / 2;
    const tu = (u[a] + u[b]) / 2 - (cv / cl) * sag;
    const tv = (v[a] + v[b]) / 2 + (cu / cl) * sag;
    const lam = TUNING.bend / w;
    const eu = (tu - u[i]) * lam, ev = (tv - v[i]) * lam;
    u[i] += eu * wi; v[i] += ev * wi;
    u[a] -= eu * wa / 2; v[a] -= ev * wa / 2;
    u[b] -= eu * wb / 2; v[b] -= ev * wb / 2;
  }

  function step(dt) {
    syncLength();
    placeGuided();
    const n = count();
    const g = (torn ? TUNING.tornGravity : TUNING.gravity) * dt * dt;
    energy = 0;
    for (let j = 0; j < n; j++) {
      if (!free[j]) continue;
      const resting = !torn && v[j] < TUNING.restBelow;
      const damp = resting ? 0.6 : TUNING.damping;
      const vu = (u[j] - pu[j]) * damp, vv = (v[j] - pv[j]) * damp;
      energy += vu * vu + vv * vv;
      pu[j] = u[j]; pv[j] = v[j];
      u[j] += vu;
      v[j] += vv - (resting ? 0 : g);
    }
    for (let it = 0; it < ITERATIONS; it++) {
      for (let j = 0; j < n - 1; j++) solveDistance(j, j + 1);
      for (const k of SPANS) for (let j = k; j < n - k; j++) solveBend(j - k, j, j + k, k * H);
      for (let j = 0; j < n; j++) if (free[j]) collide(j);
    }
  }

  return {
    H,
    step,
    /** Cuánto papel está afuera de la ranura (puede bajar: se lo empuja para adentro). */
    setOut(len) { out = Math.max(0, len); },
    get out() { return out; },
    /** Corta el papel en la ranura: todo lo que estaba afuera cae. */
    tear() {
      torn = true;
      for (let j = 0; j < count(); j++) {
        free[j] = true;
        pu[j] = u[j] + 0.6;   // un tirón hacia adelante al cortarse
        pv[j] = v[j] - 1.2;
      }
    },
    reset() {
      u = []; v = []; pu = []; pv = []; free = [];
      m0 = 0; out = 0; torn = false;
    },
    get torn() { return torn; },
    /** Energía cinética aproximada del último paso: sirve para dormir la animación. */
    get energy() { return energy; },
    /** Para dibujar: posiciones y material de cada partícula. */
    snapshot() { return { u, v, m0, h: H, out, torn }; },
  };
}
