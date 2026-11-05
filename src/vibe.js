import { gsap } from 'gsap';
import { VIBES, byId, img } from './data/products.js';
import { money } from './cart.js';
import { $, $$, prefersReduced } from './lib.js';
import { highlightCards, goToCard } from './catalog.js';

export function initVibe() {
  const chips = $('#vibe-chips');
  const note = $('#vibe-note');
  const picks = $('#vibe-picks');
  chips.innerHTML = VIBES.map((v) => `<button class="chip" role="radio" aria-checked="false" type="button" data-vibe="${v.id}">${v.label}</button>`).join('');

  function select(id, silent = false) {
    const v = VIBES.find((x) => x.id === id);
    $$('.chip', chips).forEach((c) => c.setAttribute('aria-checked', String(c.dataset.vibe === id)));
    note.textContent = v.note;
    picks.innerHTML = v.picks
      .map((pid) => {
        const p = byId(pid);
        return `<button class="pick" type="button" data-pick="${pid}"><img src="${img(pid + '-sm')}" alt="" width="260" height="260" loading="lazy" /><div><b>${p.name}</b><span>${money(p.price)}</span><small>Ver en el catálogo</small></div></button>`;
      })
      .join('');
    if (!silent) highlightCards(v.picks);
    if (!silent && !prefersReduced()) {
      gsap.from('.pick', { y: 30, opacity: 0, scale: 0.94, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.1 });
    }
  }

  select('chill', true);
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vibe]');
    if (b) select(b.dataset.vibe);
  });
  chips.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const all = $$('.chip', chips);
    const i = all.findIndex((c) => c.getAttribute('aria-checked') === 'true');
    const n = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
    n.focus();
    select(n.dataset.vibe);
  });
  picks.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) goToCard(b.dataset.pick);
  });
}
