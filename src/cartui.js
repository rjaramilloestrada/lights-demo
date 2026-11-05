import { subscribe, getState, setQty, clear, buildMessage, whatsappUrl, money } from './cart.js';
import { img } from './data/products.js';
import { WHATSAPP_NUMBER } from './config.js';
import { $, prefersReduced, toast } from './lib.js';

let isOpen = false;
let lastFocus = null;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function initCartUI({ lenis }) {
  const cart = $('#cart');
  const backdrop = $('#backdrop');
  const list = $('#cart-items');
  const empty = $('#cart-empty');
  const form = $('#cart-form');
  const nameIn = $('#cart-name');
  const cityIn = $('#cart-city');
  const err = $('#cart-error');
  const bar = $('#bar');
  let prevCount = 0;

  try {
    nameIn.value = localStorage.getItem('vl-name') || '';
    cityIn.value = localStorage.getItem('vl-city') || '';
  } catch { /* sin almacenamiento */ }

  function renderMessage() {
    $('#cart-message').textContent = buildMessage(nameIn.value, cityIn.value);
  }

  function render(state) {
    $('#cart-count').textContent = String(state.count);
    $('#cart-count').classList.toggle('has-items', state.count > 0);
    $('#cart-btn').setAttribute('aria-label', `Abrir pedido, ${state.count} ${state.count === 1 ? 'lámpara' : 'lámparas'}`);
    $('#cart-total').textContent = money(state.total);
    $('#bar-total').textContent = money(state.total);
    $('#bar-count').textContent = `${state.count} ${state.count === 1 ? 'lámpara' : 'lámparas'}`;
    empty.hidden = state.count > 0;
    form.hidden = state.count === 0;
    list.innerHTML = state.lines
      .map(
        (l) => `<li class="cline" data-key="${l.key}">
          <img src="${img(l.id + '-sm')}" alt="" width="64" height="64" />
          <div class="cline__t"><b>${l.product.name}</b><span>${l.label || 'Precio unitario ' + money(l.product.price)}</span></div>
          <div class="cline__r"><strong>${money(l.lineTotal)}</strong>
            <div class="qty"><button type="button" data-dec aria-label="Quitar una unidad de ${l.product.name}">−</button><span aria-live="polite">${l.qty}</span><button type="button" data-inc aria-label="Agregar una unidad de ${l.product.name}">+</button></div>
          </div></li>`,
      )
      .join('');
    renderMessage();
    const showBar = state.count > 0 && !isOpen;
    if (showBar && bar.hidden) { bar.hidden = false; bar.classList.remove('is-in'); void bar.offsetWidth; bar.classList.add('is-in'); }
    if (!showBar) bar.hidden = true;
    if (state.count === 0 && isOpen) { /* se queda abierto mostrando el estado vacío */ }
    prevCount = state.count;
  }

  function setOpen(open) {
    isOpen = open;
    if (open) {
      lastFocus = document.activeElement;
      cart.hidden = false;
      backdrop.hidden = false;
      void cart.offsetWidth;
      cart.classList.add('is-open');
      backdrop.classList.add('is-open');
      lenis && lenis.stop();
      document.documentElement.style.overflow = 'hidden';
      bar.hidden = true;
      setTimeout(() => $('#cart-close').focus({ preventScroll: true }), 60);
    } else {
      cart.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      lenis && lenis.start();
      document.documentElement.style.overflow = '';
      const done = () => { if (!isOpen) { cart.hidden = true; backdrop.hidden = true; } };
      if (prefersReduced() || cart.classList.contains('vt')) done(); else setTimeout(done, 520);
      render(getState());
      lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
    }
  }

  // View Transitions API con fallback CSS
  function toggle(open) {
    if (open === isOpen) return;
    const useVT = typeof document.startViewTransition === 'function' && !prefersReduced();
    if (!useVT) { setOpen(open); return; }
    cart.classList.add('vt');
    let t;
    try {
      t = document.startViewTransition(() => setOpen(open));
    } catch {
      cart.classList.remove('vt');
      setOpen(open);
      return;
    }
    t.ready.catch(() => {});
    t.updateCallbackDone.catch(() => {});
    t.finished.catch(() => {}).finally(() => cart.classList.remove('vt'));
  }

  $('#cart-btn').addEventListener('click', () => toggle(true));
  $('#bar-open').addEventListener('click', () => toggle(true));
  $('#cart-close').addEventListener('click', () => toggle(false));
  $('#cart-empty-cta').addEventListener('click', (e) => { e.preventDefault(); toggle(false); document.dispatchEvent(new CustomEvent('scroll-to', { detail: { target: $('#catalogo') } })); });
  backdrop.addEventListener('click', () => toggle(false));
  document.addEventListener('open-cart', () => toggle(true));
  $('#ready-cta').addEventListener('click', () => {
    if (getState().count > 0) toggle(true);
    else document.dispatchEvent(new CustomEvent('scroll-to', { detail: { target: $('#catalogo') } }));
  });
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') toggle(false);
    if (e.key === 'Tab') {
      const f = cart.querySelectorAll('button:not([hidden]), input, summary, a[href]');
      const vis = [...f].filter((x) => x.offsetParent !== null);
      if (!vis.length) return;
      const first = vis[0], last = vis[vis.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  list.addEventListener('click', (e) => {
    const li = e.target.closest('.cline');
    if (!li) return;
    const line = getState().lines.find((l) => l.key === li.dataset.key);
    if (!line) return;
    if (e.target.closest('[data-inc]')) setQty(line.key, line.qty + 1);
    if (e.target.closest('[data-dec]')) setQty(line.key, line.qty - 1);
  });

  [nameIn, cityIn].forEach((inp) => {
    inp.addEventListener('input', () => {
      inp.classList.remove('is-bad');
      err.hidden = true;
      try { localStorage.setItem(inp === nameIn ? 'vl-name' : 'vl-city', inp.value); } catch { /* ok */ }
      renderMessage();
    });
  });

  $('#cart-clear').addEventListener('click', () => { clear(); toast('Pedido vaciado.'); });

  $('#cart-send').addEventListener('click', async () => {
    const bad = [nameIn, cityIn].filter((i) => !i.value.trim());
    if (bad.length) {
      bad.forEach((i) => i.classList.add('is-bad'));
      err.textContent = 'Escribe tu nombre y tu ciudad para armar el mensaje.';
      err.hidden = false;
      bad[0].focus();
      return;
    }
    const msg = buildMessage(nameIn.value, cityIn.value);
    const url = whatsappUrl(msg);
    if (WHATSAPP_NUMBER && url) {
      window.open(url, '_blank', 'noopener');
      toast('Abriendo WhatsApp con tu pedido.');
      return;
    }
    const ok = await copyText(msg);
    toast(
      ok
        ? 'Mensaje copiado. En la versión real, este botón abre el WhatsApp de Vibing Lights con tu pedido listo.'
        : 'No pudimos copiar solo. Selecciona el mensaje de arriba y cópialo. En la versión real, este botón abre WhatsApp.',
      6000,
    );
  });

  subscribe((s) => {
    render(s);
    if (s.count > prevCount) {
      // refuerzo visual cuando se agrega
    }
  });
}
