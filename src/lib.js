export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReduced = () => reducedMotion.matches;

let toastTimer = 0;
export function toast(msg, ms = 4200) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
}

export function store(key, value) {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, value);
  } catch { /* sin almacenamiento */ }
  return null;
}
