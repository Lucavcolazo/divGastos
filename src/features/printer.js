// Impresora de tickets: cada gasto nuevo hace avanzar el papel y se imprime la línea.
// Tirar del ticket (scroll o arrastre sobre la impresora) lo corta y borra todo.
import { $, sleep, reduced, restartAnimation } from '../lib/dom.js';
import { num, money, pad, esc } from '../lib/format.js';
import { on, emit } from '../lib/bus.js';
import { state, total, catLabel, findItem, removeItem, replaceItems, resetEntry } from '../state.js';
import { showToast } from './toast.js';

const TEAR_DISTANCE = 160; // px que hay que tirar para cortar
const LINE_FEED_MS = 650;

let printerEl, feedEl, paperEl, listEl, bars;
let cutting = false;

// Las impresiones se encolan para que no se pisen si se cargan varios gastos seguidos
let queue = Promise.resolve();
const enqueue = task => (queue = queue.then(task));

/* ---------- filas del ticket ---------- */

const rows = () => [...listEl.children];
const rowFor = id => listEl.querySelector(`[data-id="${id}"]`);

function rowHTML(item) {
  return `<div class="p-line"><span class="p-name">${esc(item.name)}</span><span class="p-dots"></span><span class="p-amt">${num(item.amount)}</span></div>
    <div class="p-meta"><span class="p-idx"></span><span class="p-each"></span></div>
    <button class="p-del" type="button" aria-label="Eliminar ${esc(item.name)}">×</button>`;
}

function makeRow(item) {
  const li = document.createElement('li');
  li.className = 'p-item';
  li.dataset.id = item.id;
  li.tabIndex = 0;
  li.setAttribute('aria-label', `Editar ${item.name}`);
  li.innerHTML = rowHTML(item);
  return li;
}

function buildPaper() {
  listEl.replaceChildren(...state.items.map(makeRow));
  sync();
}

/** Pone al día numeración, c/u, fila en edición y totales sin reimprimir nada. */
function sync() {
  rows().forEach(li => {
    if (!findItem(li.dataset.id) && !li.classList.contains('is-removing')) li.remove();
  });
  rows().forEach((li, idx) => {
    const item = findItem(li.dataset.id);
    if (!item) return;
    li.querySelector('.p-idx').textContent = `${pad(idx + 1)} · ${catLabel(item.cat)}`;
    li.querySelector('.p-each').textContent = `c/u ${num(item.amount / state.split)}`;
    li.classList.toggle('is-editing', li.dataset.id === state.entry.editing);
  });
  $('p-empty').hidden = listEl.children.length > 0;
  const t = total();
  $('p-total').textContent = money(t);
  $('p-half').textContent = money(t / state.split);
  $('p-count').textContent = `${state.items.length} ${state.items.length === 1 ? 'item' : 'items'}`;
  if (!printerEl.classList.contains('is-printing') && !cutting) setLcd(`LISTO · ${pad(state.items.length)}`);
}

/* ---------- motor de avance ---------- */

const setLcd = text => { $('pr-lcd').textContent = text; };

function printing(on) {
  printerEl.classList.toggle('is-printing', on);
  setLcd(on ? 'IMPRIMIENDO' : `LISTO · ${pad(state.items.length)}`);
}

/** El papel entero baja `delta` px desde la ranura, a pasos como un motor paso a paso. */
function feed(delta, ms) {
  feedEl.classList.remove('waiting');
  if (reduced || delta <= 0) {
    feedEl.style.transition = 'none';
    feedEl.style.transform = 'none';
    return Promise.resolve();
  }
  feedEl.style.transition = 'none';
  feedEl.style.transform = `translateY(${-delta}px)`;
  void feedEl.offsetHeight;
  feedEl.style.transition = `transform ${ms}ms steps(${Math.max(6, Math.round(delta / 4))}, end)`;
  feedEl.style.transform = 'translateY(0)';
  printing(true);
  return sleep(ms).then(() => printing(false));
}

/** Saca el ticket completo de la ranura (al entrar, después de cortar o deshacer). */
function feedIn() {
  const h = paperEl.offsetHeight + 30;
  feedEl.style.transform = `translateY(${-h}px)`;
  return feed(h, Math.min(1800, 500 + h * 1.4));
}

/** Esconde el papel dentro de la impresora, sin animación. */
function hidePaper() {
  feedEl.style.transition = 'none';
  feedEl.classList.add('waiting');
  feedEl.style.transform = '';
}

async function printNew(item) {
  if (rowFor(item.id) || !findItem(item.id)) return;
  const before = paperEl.offsetHeight;
  const li = makeRow(item);
  listEl.appendChild(li);
  sync();
  const delta = Math.max(paperEl.offsetHeight - before, 24);
  restartAnimation(li, 'is-printing');
  await feed(delta, LINE_FEED_MS);
}

function reprint(item) {
  const li = rowFor(item.id);
  if (!li) return;
  li.innerHTML = rowHTML(item);
  li.setAttribute('aria-label', `Editar ${item.name}`);
  sync();
  restartAnimation(li, 'is-printing');
}

/** Borra una línea colapsándola; el papel se acorta. */
function deleteRow(id) {
  const li = rowFor(id);
  const finish = () => {
    li?.remove();
    removeItem(id);
  };
  if (!li || reduced) return finish();
  li.style.height = li.offsetHeight + 'px';
  void li.offsetHeight;
  li.classList.add('is-removing');
  li.style.height = '0px';
  setTimeout(finish, 320);
}

/* ---------- cortar ticket ---------- */

async function cutTicket() {
  if (!state.items.length || cutting) return;
  cutting = true;
  await queue;
  const snapshot = state.items.slice();

  feedEl.classList.remove('is-pulling');
  feedEl.classList.add('is-torn');
  await sleep(reduced ? 0 : 680);

  resetEntry();
  replaceItems([]);
  feedEl.classList.remove('is-torn');
  hidePaper();
  buildPaper();
  resetPull();
  cutting = false;
  sync();

  showToast('ticket cortado', 'deshacer', () => restore(snapshot));
  await sleep(60);
  enqueue(feedIn);
}

async function restore(snapshot) {
  await queue;
  replaceItems(snapshot);
  hidePaper();
  buildPaper();
  await sleep(30);
  enqueue(feedIn);
}

/* ---------- tirar del ticket (scroll o arrastre sobre la impresora) ---------- */

let pull = 0;
let pullTimer = null;
let dragY = null;

const canPull = () => state.items.length > 0 && !cutting && !printerEl.classList.contains('is-printing');

function setPull(px) {
  pull = Math.max(0, px);
  const p = Math.min(1, pull / TEAR_DISTANCE);
  feedEl.classList.toggle('is-pulling', pull > 0);
  feedEl.style.transition = 'none';
  feedEl.style.transform = `translateY(${pull}px) rotate(${p * 1.2}deg)`;
  bars.forEach((b, i) => b.classList.toggle('on', i < Math.round(p * bars.length)));
  setLcd(pull > 0 ? `CORTANDO ${Math.round(p * 100)}%` : `LISTO · ${pad(state.items.length)}`);
  if (pull >= TEAR_DISTANCE) {
    dragY = null;
    cutTicket();
  }
}

function resetPull() {
  pull = 0;
  bars.forEach(b => b.classList.remove('on'));
  feedEl.classList.remove('is-pulling');
}

/** Si se suelta antes del umbral, el papel vuelve a la ranura. */
function releasePull() {
  if (cutting || pull === 0) return;
  resetPull();
  feedEl.style.transition = 'transform .4s cubic-bezier(.3, 1.5, .5, 1)';
  feedEl.style.transform = 'translateY(0)';
  setLcd(`LISTO · ${pad(state.items.length)}`);
}

function bindPull() {
  printerEl.addEventListener('wheel', e => {
    if (!canPull()) return;
    e.preventDefault();
    setPull(pull + e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.45);
    clearTimeout(pullTimer);
    pullTimer = setTimeout(releasePull, 240);
  }, { passive: false });

  printerEl.addEventListener('pointerdown', e => {
    if (!canPull()) return;
    dragY = e.clientY;
    try { printerEl.setPointerCapture(e.pointerId); } catch {}
  });
  printerEl.addEventListener('pointermove', e => {
    if (dragY !== null) setPull(e.clientY - dragY);
  });
  const endDrag = () => {
    if (dragY === null) return;
    dragY = null;
    releasePull();
  };
  printerEl.addEventListener('pointerup', endDrag);
  printerEl.addEventListener('pointercancel', endDrag);
}

/* ---------- init ---------- */

export function initPrinter() {
  printerEl = $('printer');
  feedEl = $('feed');
  paperEl = $('paper');
  listEl = $('p-list');
  bars = [...$('pr-grille').children];

  const d = new Date();
  $('p-month').textContent = `${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })} · ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`;

  listEl.addEventListener('click', e => {
    const li = e.target.closest('.p-item');
    if (!li || li.classList.contains('is-removing')) return;
    if (e.target.closest('.p-del')) deleteRow(li.dataset.id);
    else emit('edit:request', li.dataset.id);
  });
  $('cut').addEventListener('click', cutTicket);
  bindPull();

  on('item:added', item => enqueue(() => printNew(item)));
  on('item:updated', reprint);
  on('items:changed', sync);
  on('entry:changed', sync);
  on('split:changed', sync);

  buildPaper();

  // El ticket sale de la impresora la primera vez que se ve
  const io = new IntersectionObserver(entries => {
    if (!entries.some(en => en.isIntersecting)) return;
    io.disconnect();
    enqueue(feedIn);
  }, { threshold: 0.35 });
  io.observe(printerEl);
}
