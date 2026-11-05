import { byId, img } from './data/products.js';
import { add, money } from './cart.js';
import { $, $$, prefersReduced } from './lib.js';

// Controles del visor + carga diferida de three (chunk aparte) con IntersectionObserver.
export function initViewerUI({ fly }) {
  const root = $('#viewer');
  const host = $('#viewer-canvas');
  const sw = $('#viewer-switch');
  const swLabel = $('#viewer-switch-label');
  const slider = $('#viewer-angle');
  const out = $('#viewer-angle-out');
  const poster = $('#viewer-poster');
  const hint = $('#viewer-hint');
  const reduced = prefersReduced();

  const state = { lamp: 'sunset', on: false, angle: 45, touched: false };
  let api = null;

  const apply = {
    lamp() {
      const p = byId(state.lamp);
      $$('.tab').forEach((t) => {
        const on = t.dataset.lamp === state.lamp;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      $('#viewer-name').textContent = p.name;
      $('#viewer-desc').textContent = p.tag;
      $('#viewer-add').textContent = `Agregar al pedido · ${money(p.price)}`;
      poster.src = img(p.id);
      poster.alt = `Foto de la lámpara ${p.name.replace(' Lamp', '')}`;
      root.dataset.lamp = state.lamp;
      api && api.setLamp(state.lamp);
    },
    on() {
      sw.checked = state.on;
      swLabel.textContent = state.on ? 'Apagar' : 'Encender';
      root.dataset.on = String(state.on);
      api && api.setOn(state.on);
    },
    angle() {
      out.textContent = `${state.angle}°`;
      slider.value = String(state.angle);
      slider.setAttribute('aria-valuetext', `${state.angle} grados`);
      root.dataset.angle = String(state.angle);
      api && api.setAngle(state.angle);
    },
  };

  $$('.tab').forEach((t) =>
    t.addEventListener('click', () => { state.touched = true; state.lamp = t.dataset.lamp; apply.lamp(); }),
  );
  $('.viewer__tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    state.lamp = state.lamp === 'sunset' ? 'aura' : 'sunset';
    apply.lamp();
    $(`#tab-${state.lamp}`).focus();
  });
  sw.addEventListener('change', () => { state.touched = true; state.on = sw.checked; apply.on(); });
  slider.addEventListener('input', () => { state.touched = true; state.angle = Number(slider.value); apply.angle(); });
  $('#viewer-add').addEventListener('click', () => {
    add(state.lamp);
    fly && fly(poster, $('#cart-btn'));
  });
  $('#viewer-stage').addEventListener('pointerdown', () => hint.classList.add('is-gone'), { once: true });

  apply.lamp(); apply.on(); apply.angle();

  // API pública para "Verla en 3D" desde el catálogo
  const show = (id) => {
    if (id !== 'sunset' && id !== 'aura') return;
    state.touched = true;
    state.lamp = id;
    apply.lamp();
  };

  const fallback = (why) => {
    root.classList.add('is-fallback');
    root.classList.remove('is-ready');
    $('#viewer-fallback').hidden = false;
    $('#viewer-hint').hidden = true;
    root.dataset.state = 'fallback:' + why;
  };

  async function load() {
    root.dataset.state = 'loading';
    try {
      const probe = document.createElement('canvas');
      if (!probe.getContext('webgl2') && !probe.getContext('webgl')) throw new Error('nowebgl');
      const mod = await import('./three/viewer.js');
      api = await mod.createViewer({ host, reduced, lamp: state.lamp, on: state.on, angle: state.angle });
      root.classList.add('is-ready');
      root.dataset.state = 'ready';
      host.addEventListener('viewer-lost', () => fallback('lost'));
      // Primera vez en pantalla: se enciende sola para mostrar el efecto
      if (!reduced) {
        setTimeout(() => {
          if (!state.touched) { state.on = true; apply.on(); }
        }, 700);
      }
      setTimeout(() => hint.classList.add('is-gone'), 6000);
    } catch (e) {
      console.warn('[viewer] usando foto de respaldo', e && e.message);
      fallback(e && e.message ? e.message : 'error');
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    },
    { rootMargin: '500px 0px' },
  );
  io.observe(root);

  return { show };
}
