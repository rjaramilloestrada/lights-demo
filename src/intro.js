import { gsap } from 'gsap';
import { $, store } from './lib.js';

// Intro "lights on": ~0.9 s, saltable (clic, toque, Esc o botón).
export function runIntro() {
  const root = document.documentElement;
  const el = $('#intro');
  if (!root.classList.contains('has-intro') || !el) return Promise.resolve(false);
  store('vl-intro', '1');

  return new Promise((resolve) => {
    let finished = false;
    const reveal = () => resolve(true);
    const finish = () => {
      if (finished) return;
      finished = true;
      tl.kill();
      clearTimeout(guard);
      root.classList.remove('has-intro');
      window.removeEventListener('keydown', onKey);
      resolve(true);
    };
    const knob = $('#intro-switch span');
    const tl = gsap.timeline({ onComplete: finish });
    tl.from('#intro-switch', { scale: 0.7, opacity: 0, duration: 0.2, ease: 'back.out(2)' })
      .to(knob, { y: 52, duration: 0.08, ease: 'power2.in' }, 0.22)
      .to('#intro-switch', { boxShadow: 'inset 0 0 0 5px #0b0b10, 0 0 60px 14px rgba(255,138,31,0.8)', duration: 0.1 }, 0.27)
      .to('#intro-halo', { scale: 80, duration: 0.5, ease: 'power3.in' }, 0.3)
      .to('#intro-switch', { opacity: 0, duration: 0.15 }, 0.4)
      .to('#intro-skip', { opacity: 0, duration: 0.1 }, 0.3)
      .call(reveal, null, 0.55)
      .to(el, { opacity: 0, duration: 0.18, ease: 'none' }, 0.72);
    const guard = setTimeout(finish, 1300); // nunca bloquea más de ~1.3 s
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish(); };
    window.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', finish);
    $('#intro-skip').addEventListener('click', finish);
  });
}
