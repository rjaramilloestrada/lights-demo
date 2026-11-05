import { byId } from './data/products.js';
import { WHATSAPP_NUMBER, STORE_NAME } from './config.js';

const KEY = 'vl-demo-cart-v1';
let items = []; // { key, id, variant, qty }
const subs = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(raw)) {
      items = raw.filter((i) => i && byId(i.id) && Number.isInteger(i.qty) && i.qty > 0).slice(0, 40);
    }
  } catch { items = []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* sin almacenamiento */ }
}
function emit() { save(); subs.forEach((fn) => fn(getState())); }

export function variantLabel(product, variantId) {
  if (product.variants) {
    const o = product.variants.options.find((x) => x.id === variantId);
    return o ? o.label : '';
  }
  if (product.examples) return 'color a confirmar por WhatsApp';
  return '';
}

export function getState() {
  const lines = items.map((i) => {
    const p = byId(i.id);
    return { ...i, product: p, label: variantLabel(p, i.variant), lineTotal: p.price * i.qty };
  });
  return {
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    total: lines.reduce((s, l) => s + l.lineTotal, 0),
  };
}

export const money = (n) => `$${n}`;

export function add(id, variant = '') {
  const key = `${id}:${variant}`;
  const found = items.find((i) => i.key === key);
  if (found) found.qty = Math.min(found.qty + 1, 20);
  else items.push({ key, id, variant, qty: 1 });
  emit();
}
export function setQty(key, qty) {
  const it = items.find((i) => i.key === key);
  if (!it) return;
  if (qty <= 0) items = items.filter((i) => i.key !== key);
  else it.qty = Math.min(qty, 20);
  emit();
}
export function clear() { items = []; emit(); }
export function subscribe(fn) { subs.add(fn); fn(getState()); return () => subs.delete(fn); }

export function buildMessage(name = '', city = '') {
  const { lines, total } = getState();
  const rows = lines.map((l) => {
    const v = l.label ? ` (${l.label})` : '';
    return `• ${l.qty} x ${l.product.name}${v}: ${money(l.lineTotal)}`;
  });
  return [
    `Hola ${STORE_NAME} 👋 Quiero pedir:`,
    ...rows,
    `Total: ${money(total)}`,
    `Nombre: ${name.trim() || '(tu nombre)'}`,
    `Ciudad: ${city.trim() || '(tu ciudad)'}`,
    'Envío: se coordina por WhatsApp',
  ].join('\n');
}

export function whatsappUrl(message) {
  return WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}` : '';
}

load();
