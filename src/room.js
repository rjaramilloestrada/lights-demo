import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, prefersReduced } from './lib.js';

// Sección pinneada: el cuarto oscuro se ilumina con el scroll y aparecen 3 frases.
export function initRoom() {
  const section = $('#room');
  const stage = $('#room-stage');
  const steps = $$('#room-steps li');
  const dots = $$('#room-dots i');

  if (prefersReduced()) {
    section.classList.add('is-static');
    stage.style.setProperty('--rd', '0.08');
    stage.style.setProperty('--hs', '1');
    return;
  }

  gsap.set(steps, { opacity: 0, y: 24 });
  gsap.set(steps[0], { opacity: 1, y: 0 });
  stage.style.setProperty('--rd', '0.9');
  stage.style.setProperty('--hs', '0.12');
  stage.style.setProperty('--ho', '0');

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to(stage, { '--rd': 0.04, duration: 2.2 }, 0)
    .to(stage, { '--hs': 1, '--ho': 1, duration: 2.0, ease: 'power2.out' }, 0.1)
    .to('#room-lens', { attr: { r: 9 }, duration: 1.5 }, 0.2)
    .to(steps[0], { opacity: 0, y: -24, duration: 0.2 }, 0.9)
    .to(steps[1], { opacity: 1, y: 0, duration: 0.25 }, 1.12)
    .to(steps[1], { opacity: 0, y: -24, duration: 0.2 }, 1.9)
    .to(steps[2], { opacity: 1, y: 0, duration: 0.25 }, 2.12)
    .to({}, { duration: 0.6 }, 2.4);

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=260%',
    pin: true,
    scrub: 0.5,
    anticipatePin: 1,
    animation: tl,
    onUpdate: (self) => {
      const i = self.progress < 0.33 ? 0 : self.progress < 0.68 ? 1 : 2;
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
    },
  });
  dots[0].classList.add('on');
}
