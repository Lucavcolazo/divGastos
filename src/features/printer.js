// Impresora del aparato: cada gasto empuja el papel fuera de la ranura. El papel es una
// tira con física (tape/physics.js) que sube, se curva y cae por detrás de la calculadora.
//
// Gestos sobre el papel: tirar para arriba (o scroll ↓) lo saca y, pasado el umbral, lo
// corta; empujarlo para abajo (o scroll ↑) lo mete y deja ver los gastos anteriores.
// Sobre la impresora, scroll ↓ o arrastrar para abajo también tira del papel.
import { $, sleep, reduced } from '../lib/dom.js';
import { num, pad, esc } from '../lib/format.js';
import { on, emit } from '../lib/bus.js';
import { state, catLabel, findItem, removeItem, replaceItems, resetEntry } from '../state.js';
import { showToast } from './toast.js';
import { createTape } from './tape/physics.js';
import { createView } from './tape/view.js';
import { layoutTicket, rowAt, drawTicket, isDeleteZone } from './tape/ticket.js';

const TEAR_DISTANCE = 160;  // px que hay que tirar para cortar
const PULL_OUT = 0.35;      // papel en blanco que sale por cada px que se tira
const LINE_FEED_MS = 650;
const DELETE_MS = 320;
const BELOW = 28;           // parte del canvas que queda detrás del aparato, bajo la ranura
const MIN_OUT = 150;        // al empujar el papel para adentro siempre queda esto afuera
const DT = 1 / 120;

let printerEl, canvas, listEl, bars;
let tape, view, tex;
let layout, texLength = 0, month = '';

let printed = 0;            // papel impreso que ya salió
let browse = 0;             // cuánto se empujó para adentro para ver gastos anteriores
let pull = 0;               // cuánto se está tirando para cortar
let cutting = false;
let fade = 1;
const collapse = new Map(); // filas que se están borrando: id → 0..1
let hover = null, hoverDel = false, focusId = null;
let sway = 0, swayV = 0;

let texDirty = true;
let anims = 0;              // animaciones en curso (avance, borrado, corte)
let raf = 0, last = 0, acc = 0;

// Las impresiones se encolan para que no se pisen si se cargan varios gastos seguidos
let queue = Promise.resolve();
const enqueue = task => (queue = queue.then(task));

/* ---------- dibujo ---------- */

const outLen = () => printed - browse + pull * PULL_OUT;
const maxBrowse = () => Math.max(0, printed - MIN_OUT);

function relayout() {
  layout = layoutTicket(state.items, collapse);
  texDirty = true;
}

function paintTexture() {
  texLength = drawTicket(tex, {
    layout, month, split: state.split, catLabel,
    hover, hoverDel, focus: focusId, editing: state.entry.editing,
    scale: view.dpr,
  });
  texDirty = false;
}

function render() {
  if (texDirty) paintTexture();
  tape.setOut(outLen());
  view.draw(tape.snapshot(), tex, { texScale: view.dpr, texLength, sway, alpha: fade });
}

function frame(t) {
  raf = 0;
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  acc += dt;
  tape.setOut(outLen());
  while (acc >= DT) {
    tape.step(DT);
    // vaivén lateral de la punta: un resorte amortiguado
    swayV += (-55 * sway - 3.2 * swayV) * DT;
    sway += swayV * DT;
    acc -= DT;
  }
  render();
  const moving = tape.energy > 2e-4 || Math.abs(sway) > 0.05 || Math.abs(swayV) > 0.05;
  if (anims > 0 || moving || dragging) wake();
}

/** Arranca la animación si estaba dormida. Sin animaciones, resuelve la forma de una. */
function wake() {
  if (reduced) {
    tape.setOut(outLen());
    for (let i = 0; i < 240; i++) tape.step(DT);
    sway = swayV = 0;
    render();
    return;
  }
  if (raf) return;
  if (!anims && !dragging) last = performance.now();
  raf = requestAnimationFrame(frame);
}

function kick(v) {
  swayV += v * (Math.random() < 0.5 ? -1 : 1);
}

/** Anima de 0 a 1 durante `ms`, llamando a fn(t) en cada cuadro. */
function animate(ms, fn) {
  if (reduced || ms <= 0) {
    fn(1);
    wake();
    return Promise.resolve();
  }
  anims++;
  return new Promise(resolve => {
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / ms);
      fn(t);
      if (t < 1) requestAnimationFrame(tick);
      else { anims--; resolve(); }
    };
    requestAnimationFrame(tick);
    wake();
  });
}

/* ---------- avance del papel ---------- */

const setLcd = text => { $('pr-lcd').textContent = text; };

function idleLcd() {
  if (cutting) return;
  if (pull > 0) setLcd(`CORTANDO ${Math.round(Math.min(1, pull / TEAR_DISTANCE) * 100)}%`);
  else if (browse > 4) setLcd('REVISANDO ↑');
  else setLcd(`LISTO · ${pad(state.items.length)}`);
}

function printing(on) {
  printerEl.classList.toggle('is-printing', on);
  if (on) setLcd('IMPRIMIENDO');
  else idleLcd();
}

/** El papel avanza hasta `to`, a pasos como un motor paso a paso. */
async function feed(to, ms) {
  const from = printed;
  const delta = to - from;
  if (delta <= 0) {
    printed = to;
    wake();
    return;
  }
  const steps = Math.max(6, Math.round(delta / 4));
  printing(true);
  let lastStep = -1;
  await animate(ms, t => {
    const s = Math.floor(t * steps);
    if (s !== lastStep) {
      lastStep = s;
      printed = from + (delta * s) / steps;
      if (s % 3 === 0) kick(1.2);
    }
  });
  printed = to;
  printing(false);
}

/** Vuelve a mostrar lo último impreso (si se estaba revisando). */
function unbrowse() {
  if (browse <= 0) return Promise.resolve();
  const from = browse;
  return animate(Math.min(500, 150 + from), t => { browse = from * (1 - easeOut(t)); });
}
const easeOut = t => 1 - (1 - t) ** 3;

/** Saca el ticket entero de la ranura (al entrar, después de cortar o deshacer). */
function feedIn() {
  return feed(layout.length, Math.min(1800, 500 + layout.length * 1.4));
}

async function printNew(item) {
  if (!findItem(item.id)) return;
  relayout();
  syncList();
  await unbrowse();
  await feed(layout.length, LINE_FEED_MS);
  kick(5);
}

/** Pone al día todo lo que depende del estado sin mover el papel. */
function sync() {
  relayout();
  syncList();
  // si se borró algo (o se restauró), el papel entra o sale lo justo
  if (!cutting && !anims && printed > 0) printed = layout.length;
  browse = Math.min(browse, maxBrowse());
  idleLcd();
  wake();
}

/** Borra una fila: se achica y el papel entra por la ranura lo que medía. */
async function deleteRow(id) {
  if (collapse.has(id)) return;
  collapse.set(id, 0);
  await animate(DELETE_MS, t => {
    collapse.set(id, easeOut(t));
    relayout();
    printed = Math.min(printed, layout.length);
  });
  collapse.delete(id);
  if (hover === id) hover = null;
  removeItem(id);
}

/* ---------- cortar ---------- */

async function cutTicket() {
  if (!state.items.length || cutting) return;
  cutting = true;
  dragging = false;
  await queue;
  const snapshot = state.items.slice();

  tape.tear();
  kick(8);
  setLcd('CORTADO');
  bars.forEach(b => b.classList.remove('on'));
  await animate(reduced ? 0 : 700, t => { fade = 1 - t * t; });

  resetEntry();
  replaceItems([]);
  tape.reset();
  printed = browse = pull = 0;
  fade = 1;
  cutting = false;
  sync();

  showToast('ticket cortado', 'deshacer', () => restore(snapshot));
  await sleep(120);
  enqueue(feedIn);
}

async function restore(snapshot) {
  await queue;
  replaceItems(snapshot);
  tape.reset();
  printed = browse = 0;
  sync();
  await sleep(30);
  enqueue(feedIn);
}

/* ---------- tirar y empujar el papel ---------- */

let dragging = false;
let releaseTimer = null;

const canMove = () => !cutting && !printerEl.classList.contains('is-printing') && printed > 0;

/**
 * Mueve el papel `dy` px: positivo lo saca (primero vuelve a lo último y, si `canPull`,
 * tira para cortar), negativo lo mete para ver lo anterior. Devuelve si se pudo mover.
 */
function movePaper(dy, canPull = true) {
  if (!canMove()) return false;
  if (dy > 0) {
    if (!browse && (!canPull || !state.items.length)) return false;
    const used = Math.min(browse, dy);
    browse -= used;
    dy -= used;
    if (canPull && state.items.length) pull += dy;
  } else {
    if (pull > 0) {
      const used = Math.min(pull, -dy);
      pull -= used;
      dy += used;
    }
    if (dy < 0) {
      if (browse >= maxBrowse()) return false;
      browse = Math.min(maxBrowse(), browse - dy);
    }
  }
  const p = Math.min(1, pull / TEAR_DISTANCE);
  bars.forEach((b, i) => b.classList.toggle('on', i < Math.round(p * bars.length)));
  idleLcd();
  wake();
  if (pull >= TEAR_DISTANCE) cutTicket();
  return true;
}

/** Si se suelta antes del umbral, el papel vuelve a entrar. */
function releasePull() {
  if (cutting || pull === 0) return;
  const from = pull;
  bars.forEach(b => b.classList.remove('on'));
  animate(380, t => { pull = from * (1 - easeOut(t)); }).then(idleLcd);
  kick(3);
}

// Si la rueda venía scrolleando la página, no se la roba el papel (así no se corta sin querer)
let lastScroll = 0;

/** Rueda sobre el papel: solo lo mete y lo saca. Sobre la impresora: scroll ↓ tira para cortar. */
function onWheel(e, onPaper) {
  if (performance.now() - lastScroll < 250) return;
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.45;
  if (dy < 0 && !onPaper) return;
  if (!movePaper(dy, !onPaper)) return; // no hay nada que mover: que scrollee la página
  e.preventDefault();
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(releasePull, 240);
}

/** Arrastre: `sign` = 1 si arrastrar para abajo saca el papel (impresora), -1 si lo mete (papel). */
function bindDrag(el, sign, onTap) {
  let lastY = null, moved = 0, startHit = null;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    startHit = onTap ? hitAt(e) : null;
    if (onTap && !startHit) return;
    lastY = e.clientY;
    moved = 0;
    try { el.setPointerCapture(e.pointerId); } catch {}
  });
  el.addEventListener('pointermove', e => {
    if (lastY === null) return;
    const dy = e.clientY - lastY;
    moved += Math.abs(dy);
    if (moved < 6 && onTap) return;
    lastY = e.clientY;
    dragging = true;
    movePaper(dy * sign);
  });
  const end = e => {
    if (lastY === null) return;
    lastY = null;
    dragging = false;
    if (moved < 6 && onTap && e.type === 'pointerup') onTap(startHit);
    releasePull();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/* ---------- mouse y teclado sobre el ticket ---------- */

function hitAt(e) {
  const r = canvas.getBoundingClientRect();
  const h = view.hit(e.clientX - r.left, e.clientY - r.top);
  if (!h) return null;
  const row = rowAt(layout, h.y);
  return { row, del: !!row && isDeleteZone(h.x) };
}

function setHover(id, del) {
  if (id === hover && del === hoverDel) return;
  hover = id;
  hoverDel = del;
  texDirty = true;
  wake();
}

function onTap(hit) {
  if (!hit?.row) return;
  const { id } = hit.row.item;
  if (hit.del) deleteRow(id);
  else emit('edit:request', id);
}

/** Lista accesible (oculta): permite editar y borrar con teclado o lector de pantalla. */
function syncList() {
  const ids = state.items.map(i => i.id).join();
  if (listEl.dataset.ids !== ids) {
    listEl.dataset.ids = ids;
    listEl.innerHTML = state.items.map(item => `<li data-id="${item.id}">
      <button type="button" class="p-edit">Editar ${esc(item.name)}, ${num(item.amount)}</button>
      <button type="button" class="p-del">Eliminar ${esc(item.name)}</button></li>`).join('');
  } else {
    state.items.forEach((item, i) => {
      const li = listEl.children[i];
      li.querySelector('.p-edit').textContent = `Editar ${item.name}, ${num(item.amount)}`;
      li.querySelector('.p-del').textContent = `Eliminar ${item.name}`;
    });
  }
}

/** Empuja el papel lo justo para que la fila quede a la vista. */
function browseTo(id) {
  const row = layout.rows.find(r => r.item.id === id);
  if (!row) return;
  const s = printed - browse - (row.y + row.h / 2); // distancia a la ranura
  if (s > 60 && s < 190) return;
  const from = browse;
  const to = Math.max(0, Math.min(maxBrowse(), printed - (row.y + row.h / 2) - 110));
  animate(300, t => { browse = from + (to - from) * easeOut(t); }).then(idleLcd);
}

/* ---------- init ---------- */

export function initPrinter() {
  printerEl = $('printer');
  canvas = $('tape');
  listEl = $('p-list');
  bars = [...$('pr-grille').children];
  tape = createTape();
  view = createView(canvas);
  tex = document.createElement('canvas');

  const d = new Date();
  month = `${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })} · ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`;

  view.resize(BELOW);
  addEventListener('resize', () => {
    view.resize(BELOW);
    texDirty = true;
    wake();
  });

  // papel: hover, click para editar o borrar, arrastre y scroll para moverlo
  canvas.addEventListener('pointermove', e => {
    if (e.buttons) return;
    const h = hitAt(e);
    setHover(h?.row?.item.id ?? null, !!h?.del);
    canvas.style.cursor = h?.row ? 'pointer' : h ? 'grab' : '';
  });
  canvas.addEventListener('pointerleave', () => setHover(null, false));
  canvas.addEventListener('wheel', e => { if (hitAt(e)) onWheel(e, true); }, { passive: false });
  bindDrag(canvas, -1, onTap);

  // impresora: scroll ↓ o arrastrar para abajo tira del papel
  printerEl.addEventListener('wheel', e => onWheel(e, false), { passive: false });
  addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
  bindDrag(printerEl, 1, null);
  $('cut').addEventListener('click', cutTicket);

  listEl.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    if (e.target.closest('.p-del')) deleteRow(li.dataset.id);
    else if (e.target.closest('.p-edit')) emit('edit:request', li.dataset.id);
  });
  listEl.addEventListener('focusin', e => {
    focusId = e.target.closest('li')?.dataset.id ?? null;
    texDirty = true;
    if (focusId) browseTo(focusId);
    wake();
  });
  listEl.addEventListener('focusout', () => {
    focusId = null;
    texDirty = true;
    wake();
  });

  on('item:added', item => enqueue(() => printNew(item)));
  on('item:updated', () => { sync(); kick(2); });
  on('items:changed', sync);
  on('entry:changed', () => {
    texDirty = true;
    if (state.entry.editing) browseTo(state.entry.editing);
    wake();
  });
  on('split:changed', () => { texDirty = true; wake(); });

  relayout();
  syncList();
  idleLcd();

  // la tipografía tiene que estar cargada antes de imprimir en el canvas
  document.fonts?.ready.then(() => { texDirty = true; wake(); });

  // El ticket sale de la impresora la primera vez que se ve
  const io = new IntersectionObserver(entries => {
    if (!entries.some(en => en.isIntersecting)) return;
    io.disconnect();
    enqueue(feedIn);
  }, { threshold: 0.35 });
  io.observe(printerEl);
}

