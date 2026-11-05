import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PRODUCTS, img } from './data/products.js';
import { money, add } from './cart.js';
import { $, $$, prefersReduced } from './lib.js';

function cardHTML(p) {
  const v = p.variants;
  const first = v ? v.options[0] : null;
  const opts = v
    ? `<fieldset class="opts"><legend>${v.label}</legend>${v.options
        .map(
          (o, i) => `<label class="opt"><input type="radio" name="v-${p.id}" value="${o.id}" data-glow="${o.glow}" ${i === 0 ? 'checked' : ''} /><span><i style="--c:${o.glow}"></i>${o.label}</span></label>`,
        )
        .join('')}</fieldset>`
    : '';
  const examples = p.examples
    ? `<div class="examples" aria-label="Ejemplos de colores"><div style="display:flex">${p.examples
        .map((e) => `<img src="${img(e)}" alt="" width="44" height="44" loading="lazy" />`)
        .join('')}</div><span>Ejemplos de colores</span></div>`
    : '';
  const view3d = p.viewer
    ? `<button class="btn btn--ghost" type="button" data-view3d="${p.id}">Verla en 3D</button>`
    : '';
  return `
  <article class="card" id="card-${p.id}" data-id="${p.id}" style="--glow:${first ? first.glow : p.glow}">
    <div class="card__media">
      <img src="${img(p.id + '-sm')}" srcset="${img(p.id + '-sm')} 520w, ${img(p.id)} 1100w" sizes="(min-width:1100px) 300px, (min-width:700px) 46vw, 92vw" alt="Foto de ${p.name}" loading="lazy" decoding="async" style="object-position:${p.pos}" />
      <span class="card__price">${money(p.price)}</span>
    </div>
    <div class="card__body">
      <h3 class="card__name">${p.name}</h3>
      <p class="card__tag">${p.tag}</p>
      ${opts}${examples}
      <div class="card__actions">
        <button class="btn btn--red" type="button" data-add="${p.id}">Agregar</button>
        ${view3d}
      </div>
    </div>
  </article>`;
}

export function initCatalog({ onShow3D }) {
  const grid = $('#grid');
  grid.innerHTML =
    PRODUCTS.map(cardHTML).join('') +
    `<article class="card card--cta"><h3>Tu vibe,<br />tu pedido</h3><p>Suma varias lámparas y envía todo en un solo mensaje.</p><button class="btn btn--white" type="button" data-open-cart>Ver mi pedido</button></article>`;

  const cartBtn = $('#cart-btn');

  grid.addEventListener('change', (e) => {
    const input = e.target.closest('input[type=radio]');
    if (!input) return;
    input.closest('.card').style.setProperty('--glow', input.dataset.glow);
  });

  grid.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const card = addBtn.closest('.card');
      const id = addBtn.dataset.add;
      const checked = card.querySelector('input[type=radio]:checked');
      add(id, checked ? checked.value : '');
      fly(card.querySelector('.card__media img'), cartBtn);
      addBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.92)' }, { transform: 'scale(1)' }], { duration: 300 });
      return;
    }
    const v3 = e.target.closest('[data-view3d]');
    if (v3) onShow3D(v3.dataset.view3d);
    if (e.target.closest('[data-open-cart]')) document.dispatchEvent(new CustomEvent('open-cart'));
  });

  // Tilt 3D solo con mouse
  if (!prefersReduced() && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.card[data-id]', grid).forEach((card) => {
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      gsap.set(card, { transformPerspective: 900 });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        ry(x * 9);
        rx(-y * 9);
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  // Revelado al scroll
  if (!prefersReduced()) {
    ScrollTrigger.batch('#grid .card', {
      start: 'top 92%',
      once: true,
      onEnter: (els) => gsap.from(els, { y: 46, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.09, clearProps: 'transform,opacity' }),
    });
  }
}

// La lámpara "vuela" hacia el carrito (la animación vive en main.js)
function fly(imgEl, target) {
  document.dispatchEvent(new CustomEvent('fly', { detail: { imgEl, target } }));
}

export function highlightCards(ids) {
  $$('#grid .card').forEach((c) => c.classList.toggle('is-pick', ids.includes(c.dataset.id)));
}

export function goToCard(id) {
  const el = $(`#card-${id}`);
  if (!el) return;
  document.dispatchEvent(new CustomEvent('scroll-to', { detail: { target: el, offset: -90 } }));
  el.classList.remove('is-pick');
  void el.offsetWidth;
  el.classList.add('is-pick');
}

