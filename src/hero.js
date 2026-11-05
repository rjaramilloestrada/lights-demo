import { gsap } from 'gsap';
import { $, $$, prefersReduced } from './lib.js';

function splitLetters(root) {
  $$('.word', root).forEach((w) => {
    const txt = w.textContent;
    w.textContent = '';
    w.setAttribute('aria-hidden', 'true');
    [...txt].forEach((c) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      w.appendChild(s);
    });
  });
}

export function initHero(afterIntro) {
  const title = $('#hero-title');
  splitLetters(title);
  const hero = $('#hero');
  const reduced = prefersReduced();

  if (!reduced) {
    const tl = gsap.timeline({ paused: true });
    tl.from('.hero .eyebrow', { y: 16, opacity: 0, duration: 0.6, ease: 'power3.out' })
      .from('.hero__title .ch', { yPercent: 120, rotate: 8, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.035 }, 0.05)
      .from('.hero__lead', { y: 20, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0.45)
      .from('.hero__cta .btn', { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08 }, 0.6)
      .from('.hero__disc', { scale: 0.6, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0.2)
      .from('.hero__tag', { scale: 0, rotate: -20, duration: 0.7, ease: 'back.out(2.2)' }, 0.9);
    afterIntro.then(() => tl.play());
    // por si la promesa tarda, el contenido nunca queda oculto
    setTimeout(() => { if (tl.progress() === 0) tl.play(); }, 1900);
  }

  // Glow que sigue al cursor / giroscopio
  let mx = 50, my = 45, tx = 50, ty = 45, idle = true;
  const apply = () => {
    hero.style.setProperty('--mx', mx.toFixed(1) + '%');
    hero.style.setProperty('--my', my.toFixed(1) + '%');
    hero.style.setProperty('--px', (((mx - 50) / 50) * -14).toFixed(1) + 'px');
    hero.style.setProperty('--py', (((my - 45) / 50) * -14).toFixed(1) + 'px');
  };
  apply();
  if (reduced) return;
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width) * 100;
    ty = ((e.clientY - r.top) / r.height) * 100;
    idle = false;
  });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    tx = 50 + Math.max(-30, Math.min(30, e.gamma)) * 1.4;
    ty = 45 + Math.max(-30, Math.min(30, (e.beta || 45) - 45)) * 1.2;
    idle = false;
  }, { passive: true });
  let heroVisible = true;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0 }).observe(hero);
  gsap.ticker.add((time) => {
    if (!heroVisible) return;
    if (idle) { tx = 50 + Math.sin(time * 0.6) * 18; ty = 45 + Math.cos(time * 0.45) * 12; }
    mx += (tx - mx) * 0.08;
    my += (ty - my) * 0.08;
    apply();
  });
}

export function initMarquee(names) {
  const track = $('#marquee');
  const one = names.map((n) => `<span class="marquee__item">${n}</span>`).join('');
  track.innerHTML = one + one + one + one;
}
