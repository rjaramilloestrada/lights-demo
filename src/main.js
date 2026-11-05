import './styles.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { PRODUCTS } from './data/products.js';
import { $, $$, prefersReduced } from './lib.js';
import { runIntro } from './intro.js';
import { initHero, initMarquee } from './hero.js';
import { initRoom } from './room.js';
import { initCatalog } from './catalog.js';
import { initVibe } from './vibe.js';
import { initCartUI } from './cartui.js';
import { initViewerUI } from './viewer-ui.js';

gsap.registerPlugin(ScrollTrigger);

// Alto del banner para posicionar nav y secciones
const banner = $('#banner');
const setBannerH = () => document.documentElement.style.setProperty('--banner-h', banner.offsetHeight + 'px');
setBannerH();
new ResizeObserver(setBannerH).observe(banner);

// Smooth scroll (Lenis) sincronizado con ScrollTrigger
let lenis = null;
if (!prefersReduced()) {
  lenis = new Lenis({ duration: 1.1, smoothWheel: true, anchors: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollTo(target, offset = 0) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: offset - (el.id === 'room' ? 0 : 0), duration: 1.3 });
  else el.scrollIntoView({ behavior: 'auto', block: 'start' });
}
document.addEventListener('scroll-to', (e) => scrollTo(e.detail.target, e.detail.offset || 0));
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href') === '#') return;
  const t = $(a.getAttribute('href'));
  if (!t) return;
  e.preventDefault();
  scrollTo(t, t.id === 'top' ? 0 : -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top')) || 0) + 1);
  if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
});

// Nav con fondo al hacer scroll
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Intro y hero
const introDone = runIntro();
initHero(introDone);
initMarquee(PRODUCTS.map((p) => p.name.replace(' Lamp', '')));

// Secciones
initRoom();
const viewer = initViewerUI({
  fly: (imgEl, target) => document.dispatchEvent(new CustomEvent('fly', { detail: { imgEl, target } })),
});
initCatalog({
  onShow3D: (id) => {
    viewer.show(id);
    scrollTo('#prueba', -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top')) || 0) + 1);
  },
});
initVibe();
initCartUI({ lenis });

// Revelados al scroll
if (!prefersReduced()) {
  $$('.section__head').forEach((h) => {
    gsap.from(h.children, { y: 34, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
  });
  gsap.from('.viewer__stage, .viewer__panel', { y: 50, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: '#viewer', start: 'top 85%', once: true } });
  gsap.from('.how__steps li', { y: 50, opacity: 0, rotate: 1.5, duration: 0.8, ease: 'power3.out', stagger: 0.14, scrollTrigger: { trigger: '.how__steps', start: 'top 85%', once: true } });
  gsap.from('.ready img', { scale: 0.7, rotate: -4, opacity: 0, duration: 1, ease: 'back.out(1.7)', scrollTrigger: { trigger: '.ready', start: 'top 85%', once: true } });
  gsap.from('.ready .btn', { y: 20, opacity: 0, duration: 0.6, delay: 0.3, scrollTrigger: { trigger: '.ready', start: 'top 85%', once: true } });
  gsap.from('.footer > *', { y: 20, opacity: 0, duration: 0.7, stagger: 0.1, scrollTrigger: { trigger: '.footer', start: 'top 92%', once: true } });
}

// Glow del cursor (solo mouse)
const cg = $('#cursor-glow');
if (cg && !prefersReduced() && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const mx = gsap.quickTo(cg, 'x', { duration: 0.45, ease: 'power3.out' });
  const my = gsap.quickTo(cg, 'y', { duration: 0.45, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => { cg.classList.add('is-on'); mx(e.clientX); my(e.clientY); }, { passive: true });
  document.addEventListener('pointerleave', () => cg.classList.remove('is-on'));
}

// Vuelo del producto al carrito (usado por el visor)
document.addEventListener('fly', (e) => {
  const { imgEl, target } = e.detail;
  if (!imgEl || prefersReduced()) { target.classList.add('bump'); setTimeout(() => target.classList.remove('bump'), 500); return; }
  const a = imgEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const clone = document.createElement('img');
  clone.src = imgEl.currentSrc || imgEl.src;
  clone.alt = '';
  clone.className = 'fly';
  clone.style.left = Math.max(10, Math.min(window.innerWidth - 74, a.left + a.width / 2 - 32)) + 'px';
  clone.style.top = Math.max(10, Math.min(window.innerHeight - 74, a.top + a.height / 2 - 32)) + 'px';
  document.body.appendChild(clone);
  const ox = parseFloat(clone.style.left) + 32, oy = parseFloat(clone.style.top) + 32;
  gsap.to(clone, {
    x: b.left + b.width / 2 - ox, y: b.top + b.height / 2 - oy, scale: 0.35, opacity: 0.6, duration: 0.75, ease: 'power3.inOut',
    onComplete: () => { clone.remove(); target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); },
  });
});

window.addEventListener('load', () => ScrollTrigger.refresh());
