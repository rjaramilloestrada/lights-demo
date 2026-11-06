import { gsap } from 'gsap';
import { PRODUCTS, byId, img } from './data/products.js';
import { add, money } from './cart.js';
import { $, $$, prefersReduced } from './lib.js';

// Colores de muestra del Water Lamp (solo ejemplos: la lámpara real tiene +16 colores). Mismo orden que en three/lamps/water.js
const WATER_CHIPS = [
  { id: 'ambar', label: 'Ámbar', c: ['#b3200a', '#ff7a10', '#ffd24a'] },
  { id: 'azul', label: 'Azul', c: ['#0a1c9a', '#1e6bff', '#7fe3ff'] },
  { id: 'turquesa', label: 'Turquesa', c: ['#04606e', '#12d6c4', '#b8fff0'] },
  { id: 'violeta', label: 'Violeta', c: ['#3a0a8c', '#8c3cff', '#ff9be6'] },
  { id: 'rosa', label: 'Rosa', c: ['#9c0a52', '#ff3d95', '#ffc2e0'] },
  { id: 'verde', label: 'Verde', c: ['#0a5a1c', '#28d65a', '#d4ff7a'] },
  { id: 'rojo', label: 'Rojo', c: ['#6e0008', '#ff1e26', '#ff9c5a'] },
  { id: 'blanco', label: 'Blanco', c: ['#56648a', '#dfe8ff', '#ffffff'] },
];
const BODY_CHIPS = [
  { id: 'negro', label: 'Negro', glow: '#15151b' },
  { id: 'rojo', label: 'Rojo', glow: '#e01a14' },
  { id: 'blanco', label: 'Blanco', glow: '#f3f1ec' },
];

// qué controles muestra cada lámpara
const CONTROLS = {
  sunset: ['angle'],
  aura: ['angle'],
  mushroom: ['dimmer', 'temp'],
  water: ['dimmer', 'waterColor'],
  lava: ['dimmer', 'lavaColor'],
  donut: ['dimmer', 'temp'],
  fungi: ['dimmer', 'temp', 'fungiBody'],
};
const TEMP_OF = new Set(['mushroom', 'donut', 'fungi']);

const radio = (name, o, checked, extra = '') =>
  `<label class="vopt"><input type="radio" name="${name}" value="${o.id}" ${checked ? 'checked' : ''} /><span><i style="--c:${o.glow}"></i>${o.label}${extra}</span></label>`;

// Controles del visor + carga diferida de three (chunk aparte) con IntersectionObserver.
export function initViewerUI({ fly }) {
  const root = $('#viewer');
  const host = $('#viewer-canvas');
  const sw = $('#viewer-switch');
  const swLabel = $('#viewer-switch-label');
  const slider = $('#viewer-angle');
  const out = $('#viewer-angle-out');
  const dimEl = $('#viewer-dim');
  const dimOut = $('#viewer-dim-out');
  const poster = $('#viewer-poster');
  const hint = $('#viewer-hint');
  const tabsEl = $('#viewer-tabs');
  const modeBtn = $('#viewer-mode');
  const reduced = prefersReduced();
  const LAMPS = PRODUCTS.map((p) => p.id);

  const state = {
    lamp: 'sunset', on: false, angle: 45, dim: 85, touched: false, room: 'night',
    variant: { mushroom: 'calida', donut: 'calida', fungi: 'calida', lava: 'rojo' },
    waterColor: 'ambar', fungiBody: 'blanco',
  };
  let api = null;

  // ---------- Chips de lámparas ----------
  tabsEl.innerHTML = PRODUCTS.map(
    (p) => `<button class="tab" type="button" role="tab" id="tab-${p.id}" data-lamp="${p.id}" aria-selected="false" tabindex="-1" style="--c:${p.glow}">
      <img src="${img(p.id + '-sm')}" alt="" width="38" height="38" loading="lazy" decoding="async" style="object-position:${p.pos}" /><span>${p.name.replace(' Lamp', '')}</span></button>`,
  ).join('');

  // ---------- Opciones dinámicas ----------
  const tri = byId('mushroom').variants.options;
  const lavaOpts = byId('lava').variants.options;
  const paint = {
    temp() {
      const cur = state.variant[state.lamp] || 'calida';
      $('#opts-temp').innerHTML = tri.map((o) => radio('viewer-temp', o, o.id === cur)).join('');
    },
    lavaColor() { $('#opts-lava').innerHTML = lavaOpts.map((o) => radio('viewer-lava', o, o.id === state.variant.lava)).join(''); },
    waterColor() {
      $('#opts-water').innerHTML =
        WATER_CHIPS.map(
          (o) => `<label class="sw" title="${o.label}"><input type="radio" name="viewer-water" value="${o.id}" aria-label="${o.label}" ${o.id === state.waterColor ? 'checked' : ''} /><span style="--a:${o.c[0]};--b:${o.c[1]};--c:${o.c[2]}"></span></label>`,
        ).join('') +
        `<label class="sw sw--cycle" title="Ciclo de colores"><input type="radio" name="viewer-water" value="ciclo" aria-label="Ciclo de colores" ${state.waterColor === 'ciclo' ? 'checked' : ''} /><span>Ciclo</span></label>`;
    },
    fungiBody() { $('#opts-body').innerHTML = BODY_CHIPS.map((o) => radio('viewer-body', o, o.id === state.fungiBody)).join(''); },
  };
  paint.temp(); paint.lavaColor(); paint.waterColor(); paint.fungiBody();

  const syncCard = (id, value) => {
    const r = $(`#card-${id} input[type=radio][value="${value}"]`);
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  };
  const variantFor = (id) => (TEMP_OF.has(id) || id === 'lava' ? state.variant[id] : '');
  const pushVariants = () => {
    if (!api) return;
    api.setVariant('temp', state.variant[state.lamp] || state.variant.mushroom);
    api.setVariant('lavaColor', state.variant.lava);
    api.setVariant('waterColor', state.waterColor);
    api.setVariant('fungiBody', state.fungiBody);
  };

  const apply = {
    lamp(animate = true) {
      const p = byId(state.lamp);
      $$('.tab').forEach((t) => {
        const on = t.dataset.lamp === state.lamp;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      const active = $(`#tab-${state.lamp}`);
      if (active && tabsEl.scrollWidth > tabsEl.clientWidth + 2) {
        const left = active.offsetLeft - (tabsEl.clientWidth - active.offsetWidth) / 2;
        tabsEl.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
      }
      $('#viewer-name').textContent = p.name;
      $('#viewer-desc').textContent = p.tag;
      $('#viewer-add').textContent = `Agregar al pedido · ${money(p.price)}`;
      poster.src = img(p.id);
      poster.alt = `Foto de la lámpara ${p.name.replace(' Lamp', '')}`;
      root.dataset.lamp = state.lamp;
      const show = CONTROLS[state.lamp];
      $$('#viewer-ctl [data-ctl]').forEach((el) => { el.hidden = !show.includes(el.dataset.ctl); });
      if (TEMP_OF.has(state.lamp)) paint.temp();
      root.dataset.variant = variantFor(state.lamp);
      root.dataset.temp = TEMP_OF.has(state.lamp) ? state.variant[state.lamp] : '';
      root.dataset.lava = state.variant.lava;
      root.dataset.water = state.waterColor;
      root.dataset.body = state.fungiBody;
      if (animate && !reduced) {
        gsap.fromTo('#viewer-ctl [data-ctl]:not([hidden])', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out', stagger: 0.07, clearProps: 'opacity,transform' });
        gsap.fromTo('.viewer__info', { opacity: 0.2, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'opacity,transform' });
      }
      if (api) { pushVariants(); api.setLamp(state.lamp); }
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
    dim() {
      dimOut.textContent = `${state.dim}%`;
      dimEl.value = String(state.dim);
      dimEl.setAttribute('aria-valuetext', `${state.dim} por ciento`);
      root.dataset.dim = String(state.dim);
      api && api.setDim(state.dim / 100);
    },
    room() {
      const day = state.room === 'day';
      root.dataset.room = state.room;
      modeBtn.setAttribute('aria-pressed', String(day));
      modeBtn.querySelector('span').textContent = day ? 'Cuarto de día' : 'Cuarto de noche';
      modeBtn.title = day ? 'Cuarto de día' : 'Cuarto de noche';
      modeBtn.setAttribute('aria-label', day ? 'Cambiar a cuarto de noche' : 'Cambiar a cuarto de día');
      api && api.setRoom(state.room);
    },
  };

  const select = (id) => { if (!LAMPS.includes(id) || id === state.lamp) return; state.lamp = id; apply.lamp(); };

  // cualquier interacción real del usuario detiene el recorrido automático
  const touch = () => { state.touched = true; };
  root.addEventListener('pointerdown', touch, true);
  root.addEventListener('keydown', touch, true);
  root.addEventListener('input', touch, true);

  tabsEl.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (t) { state.touched = true; select(t.dataset.lamp); }
  });
  const step = (dir) => {
    const i = LAMPS.indexOf(state.lamp);
    select(LAMPS[(i + dir + LAMPS.length) % LAMPS.length]);
    $(`#tab-${state.lamp}`).focus({ preventScroll: true });
  };
  tabsEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); select(LAMPS[0]); $(`#tab-${state.lamp}`).focus({ preventScroll: true }); }
    else if (e.key === 'End') { e.preventDefault(); select(LAMPS[LAMPS.length - 1]); $(`#tab-${state.lamp}`).focus({ preventScroll: true }); }
  });
  // flechas del carrusel (escritorio): recorren las lámparas
  $('#rail-prev').addEventListener('click', () => { state.touched = true; step(-1); });
  $('#rail-next').addEventListener('click', () => { state.touched = true; step(1); });
  const railScroll = () => root.classList.toggle('is-scrollable', tabsEl.scrollWidth > tabsEl.clientWidth + 4);
  new ResizeObserver(railScroll).observe(tabsEl);

  sw.addEventListener('change', () => { state.touched = true; state.on = sw.checked; apply.on(); });
  slider.addEventListener('input', () => { state.touched = true; state.angle = Number(slider.value); apply.angle(); });
  dimEl.addEventListener('input', () => { state.touched = true; state.dim = Number(dimEl.value); apply.dim(); });
  $('#viewer-ctl').addEventListener('change', (e) => {
    const r = e.target.closest('input[type=radio]');
    if (!r) return;
    state.touched = true;
    if (r.name === 'viewer-temp') { state.variant[state.lamp] = r.value; root.dataset.temp = r.value; root.dataset.variant = r.value; api && api.setVariant('temp', r.value); syncCard(state.lamp, r.value); }
    else if (r.name === 'viewer-lava') { state.variant.lava = r.value; root.dataset.lava = r.value; root.dataset.variant = r.value; api && api.setVariant('lavaColor', r.value); syncCard('lava', r.value); }
    else if (r.name === 'viewer-water') { state.waterColor = r.value; root.dataset.water = r.value; api && api.setVariant('waterColor', r.value); }
    else if (r.name === 'viewer-body') { state.fungiBody = r.value; root.dataset.body = r.value; api && api.setVariant('fungiBody', r.value); }
  });
  modeBtn.addEventListener('click', () => { state.touched = true; state.room = state.room === 'day' ? 'night' : 'day'; apply.room(); });

  $('#viewer-add').addEventListener('click', () => {
    add(state.lamp, variantFor(state.lamp));
    fly && fly(poster, $('#cart-btn'));
  });
  $('#viewer-stage').addEventListener('pointerdown', () => hint.classList.add('is-gone'), { once: true });

  apply.lamp(false); apply.on(); apply.angle(); apply.dim(); apply.room();

  // API pública para "Verla en 3D" desde el catálogo (cualquiera de las 7, con la variante elegida en la tarjeta)
  const show = (id, variant = '') => {
    if (!LAMPS.includes(id)) return;
    state.touched = true;
    const list = id === 'lava' ? lavaOpts : TEMP_OF.has(id) ? tri : [];
    if (variant && list.some((o) => o.id === variant)) state.variant[id] = variant;
    if (id === 'lava') paint.lavaColor();
    if (id === state.lamp) { apply.lamp(false); return; }
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

  // ---------- Recorrido automático (hasta la primera interacción) ----------
  let stageVisible = false;
  new IntersectionObserver(([e]) => { stageVisible = e.isIntersecting; }, { threshold: 0.35 }).observe($('#viewer-stage'));
  function startTour() {
    if (reduced) return;
    let idle = 0, touring = false;
    const id = setInterval(() => {
      if (state.touched) { clearInterval(id); return; }
      if (!api || !stageVisible || document.hidden) { if (!touring) idle = 0; return; }
      idle += 500;
      if (idle >= (touring ? 4000 : 6000)) {
        idle = 0;
        touring = true;
        select(LAMPS[(LAMPS.indexOf(state.lamp) + 1) % LAMPS.length]);
        if (!state.on) { state.on = true; apply.on(); }
      }
    }, 500);
  }

  async function load() {
    root.dataset.state = 'loading';
    try {
      const probe = document.createElement('canvas');
      if (!probe.getContext('webgl2') && !probe.getContext('webgl')) throw new Error('nowebgl');
      const mod = await import('./three/viewer.js');
      api = await mod.createViewer({
        host, reduced, lamp: state.lamp, on: state.on, angle: state.angle, dim: state.dim / 100,
        variants: { temp: state.variant[state.lamp] || 'calida', lavaColor: state.variant.lava, waterColor: state.waterColor, fungiBody: state.fungiBody },
      });
      api.setRoom(state.room);
      pushVariants();
      root.classList.add('is-ready');
      root.dataset.state = 'ready';
      host.addEventListener('viewer-lost', () => fallback('lost'));
      // Primera vez en pantalla: se enciende sola para mostrar el efecto
      if (!reduced) {
        setTimeout(() => {
          if (!state.touched) { state.on = true; apply.on(); }
        }, 700);
      }
      startTour();
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
