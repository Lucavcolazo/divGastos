// Persistencia en localStorage. Todo va envuelto en try/catch: en modo privado
// o con el almacenamiento bloqueado la app sigue andando, solo que sin guardar.

const ITEMS_KEY = 'divisor-gastos/items';
const SPLIT_KEY = 'divisor-gastos/split';

export function loadItems() {
  try {
    const items = JSON.parse(localStorage.getItem(ITEMS_KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveItems(items) {
  try { localStorage.setItem(ITEMS_KEY, JSON.stringify(items)); } catch {}
}

export function loadSplit(fallback, max) {
  try {
    const n = parseInt(localStorage.getItem(SPLIT_KEY), 10);
    return n >= 1 && n <= max ? n : fallback;
  } catch {
    return fallback;
  }
}

export function saveSplit(n) {
  try { localStorage.setItem(SPLIT_KEY, String(n)); } catch {}
}
