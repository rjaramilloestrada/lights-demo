// Prueba E2E con Playwright contra `npm run preview` (http://127.0.0.1:4173).
// Uso: NODE_PATH=$(npm root -g) node scripts/e2e.cjs
// Toma capturas a 390x844 y 1280x800 y recorre el flujo completo de compra.
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')));
}
let sharp = null;
try { sharp = require('sharp'); } catch { /* opcional: solo para medir el canvas */ }

const URL = 'http://127.0.0.1:4173/';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-user/437bce3c-54c0-5776-8709-f59dc2c89a8e/scratchpad/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ping() {
  return new Promise((resolve) => {
    http.get(URL, (res) => { res.resume(); resolve(res.statusCode === 200); }).on('error', () => resolve(false));
  });
}

async function ensureServer() {
  if (await ping()) return null;
  const child = spawn('npm', ['run', 'preview'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { if (await ping()) return child; await sleep(250); }
  throw new Error('preview no arrancó');
}

function watchErrors(page, bag, label) {
  page.on('console', (m) => { if (m.type() === 'error') bag.push(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', (e) => bag.push(`[${label}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => bag.push(`[${label}] requestfailed: ${r.url()} ${r.failure() && r.failure().errorText}`));
}

async function goto(page, y) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await sleep(850);
}
async function scrollToEl(page, sel, offset = 0) {
  const y = await page.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    return el.getBoundingClientRect().top + window.scrollY + o;
  }, [sel, offset]);
  await goto(page, y);
}
async function shot(page, name) {
  const f = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: f });
  return f;
}

async function canvasStats(page) {
  const buf = await page.locator('#viewer-stage').screenshot();
  if (!sharp) return null;
  const st = await sharp(buf).stats();
  const mean = st.channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3;
  const std = st.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0) / 3;
  return { mean: Math.round(mean), std: Math.round(std) };
}

async function runViewport(browser, name, viewport, errors) {
  const isMobile = viewport.width < 600;
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile, locale: 'es-EC',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  watchErrors(page, errors, name);

  // ---- Intro: no bloquea más de ~1.5 s ----
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const hadIntro = await page.evaluate(() => document.documentElement.classList.contains('has-intro'));
  check(`${name} intro se muestra`, hadIntro);
  await sleep(350);
  await shot(page, `${name}-00-intro`);
  await page.waitForFunction(() => !document.documentElement.classList.contains('has-intro'), null, { timeout: 3000 });
  const introMs = Date.now() - t0;
  check(`${name} intro termina rápido`, introMs < 2000, `${introMs} ms desde domcontentloaded`);
  await sleep(1400);

  // ---- Estructura y datos ----
  const banner = await page.locator('#banner').innerText();
  check(`${name} banner demo`, banner.includes('Demo de IGNIS con fotos y precios del catálogo de Vibing Lights. No es la tienda oficial.'));
  check(`${name} meta robots noindex`, (await page.locator('meta[name=robots]').getAttribute('content')).includes('noindex'));
  const prices = await page.evaluate(() => [...document.querySelectorAll('#grid .card[data-id]')].map((c) => `${c.querySelector('.card__name').textContent}|${c.querySelector('.card__price').textContent}`));
  const expected = ['Mushroom Lamp|$36', 'Sunset Lamp|$17', 'Aura Lamp|$17', 'Water Lamp|$21', 'Lava Lamp|$31', 'Donut Lamp|$39', 'Fungi Lamp|$31'];
  check(`${name} 7 productos con precios del catálogo`, JSON.stringify(prices) === JSON.stringify(expected), prices.join(', '));

  // ---- Capturas por sección ----
  await goto(page, 0);
  await sleep(600);
  await shot(page, `${name}-01-hero`);
  const hOverflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`${name} sin scroll horizontal`, hOverflow.sw <= hOverflow.iw, `${hOverflow.sw} <= ${hOverflow.iw}`);

  const roomTop = await page.evaluate(() => document.querySelector('#room').getBoundingClientRect().top + window.scrollY);
  const roomLen = await page.evaluate(() => window.innerHeight * 2.6);
  await goto(page, roomTop + 40);
  await shot(page, `${name}-02a-room-start`);
  await goto(page, roomTop + roomLen * 0.45);
  await shot(page, `${name}-02b-room-mid`);
  await goto(page, roomTop + roomLen * 0.9);
  await shot(page, `${name}-02c-room-end`);

  // ---- Visor ----
  await scrollToEl(page, '#prueba', -(isMobile ? 90 : 100));
  await page.waitForSelector('#viewer.is-ready, #viewer.is-fallback', { timeout: 25000 });
  const vstate = await page.locator('#viewer').getAttribute('data-state');
  check(`${name} visor 3D listo (sin fallback)`, vstate === 'ready', vstate);
  await sleep(1800); // auto-encendido de la primera vez
  const autoOn = await page.locator('#viewer').getAttribute('data-on');
  check(`${name} visor se enciende solo la primera vez`, autoOn === 'true');
  await scrollToEl(page, '#viewer-stage', -(isMobile ? 70 : 90));
  await sleep(500);
  await shot(page, `${name}-03a-viewer-sunset-on`);
  const sOn = await canvasStats(page);
  check(`${name} canvas Sunset con contenido`, !sOn || (sOn.mean > 25 && sOn.std > 18), JSON.stringify(sOn));

  await page.click('#tab-aura');
  check(`${name} tab Aura activa`, (await page.locator('#viewer').getAttribute('data-lamp')) === 'aura');
  await sleep(1500);
  await shot(page, `${name}-03b-viewer-aura-on`);
  const aOn = await canvasStats(page);
  check(`${name} canvas Aura con contenido`, !aOn || (aOn.mean > 25 && aOn.std > 18), JSON.stringify(aOn));

  // interruptor: apagar y volver a encender
  await page.locator('.switch').click();
  await sleep(1400);
  check(`${name} interruptor apaga`, (await page.locator('#viewer').getAttribute('data-on')) === 'false');
  await shot(page, `${name}-03c-viewer-aura-off`);
  const aOff = await canvasStats(page);
  check(`${name} apagado más oscuro que encendido`, !aOff || !aOn || aOff.mean < aOn.mean, `${aOff && aOff.mean} < ${aOn && aOn.mean}`);
  await page.locator('.switch').click();
  await sleep(1200);
  check(`${name} interruptor enciende`, (await page.locator('#viewer').getAttribute('data-on')) === 'true');

  await page.locator('#viewer-angle').fill('68');
  await sleep(1200);
  check(`${name} slider ajusta el ángulo`, (await page.locator('#viewer-angle-out').innerText()) === '68°');
  await shot(page, `${name}-03d-viewer-aura-angle68`);
  await page.locator('#viewer-angle').fill('25');
  await sleep(1000);
  await shot(page, `${name}-03e-viewer-aura-angle25`);

  // órbita: arrastrar en el canvas
  const box = await page.locator('#viewer-canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await sleep(700);
  await shot(page, `${name}-03f-viewer-orbit`);

  await page.click('#tab-sunset');
  await sleep(1300);
  await page.locator('#viewer-angle').fill('45');
  await sleep(900);

  // ---- Vibe ----
  await scrollToEl(page, '#vibe', -(isMobile ? 80 : 90));
  await page.click('[data-vibe="fiesta"]');
  await sleep(900);
  await shot(page, `${name}-04-vibe`);

  // ---- Catálogo ----
  await scrollToEl(page, '#catalogo', -80);
  await sleep(600);
  await shot(page, `${name}-05a-catalog-top`);
  await scrollToEl(page, '#card-lava', -120);
  await sleep(600);
  await shot(page, `${name}-05b-catalog-mid`);

  // Agregar: Mushroom (Fría) + Lava (Azul) + Sunset
  await scrollToEl(page, '#card-mushroom', -140);
  await page.locator('#card-mushroom .opt', { hasText: 'Fría' }).click();
  await sleep(700);
  await shot(page, `${name}-05c-mushroom-fria`);
  await page.locator('#card-mushroom [data-add]').click();
  await sleep(900);
  await scrollToEl(page, '#card-lava', -140);
  await page.locator('#card-lava .opt', { hasText: 'Azul' }).click();
  await page.locator('#card-lava [data-add]').click();
  await sleep(900);
  await scrollToEl(page, '#card-sunset', -140);
  await page.locator('#card-sunset [data-add]').click();
  await sleep(1000);
  const count = await page.locator('#cart-count').innerText();
  check(`${name} contador del carrito = 3`, count === '3', count);
  await shot(page, `${name}-06-after-add`);
  if (isMobile) check(`${name} barra inferior móvil visible`, await page.locator('#bar').isVisible());

  // ---- Carrito ----
  await page.click('#cart-btn');
  await sleep(1000);
  check(`${name} drawer abierto`, await page.locator('#cart').isVisible());
  // validación: sin nombre/ciudad
  await page.click('#cart-send');
  check(`${name} pide nombre y ciudad`, await page.locator('#cart-error').isVisible());
  await page.fill('#cart-name', 'Camila Andrade');
  await page.fill('#cart-city', 'Quito');
  await sleep(400);
  await shot(page, `${name}-07-cart`);
  const msg = await page.locator('#cart-message').innerText();
  const needles = ['Mushroom Lamp (Fría)', 'Lava Lamp (Azul)', 'Sunset Lamp', 'Total: $84', 'Camila Andrade', 'Quito', 'Envío: se coordina por WhatsApp'];
  const missing = needles.filter((n) => !msg.includes(n));
  check(`${name} mensaje con ítems, variantes y total $84`, missing.length === 0, missing.length ? 'faltan: ' + missing.join(' | ') : '');
  check(`${name} mensaje sin raya larga`, !msg.includes('—'));
  await page.click('#cart-send');
  await sleep(700);
  const toastTxt = await page.locator('#toast').innerText();
  check(`${name} toast explica que la versión real abre WhatsApp`, /versión real/i.test(toastTxt) && /WhatsApp/.test(toastTxt), toastTxt);
  let clip = '';
  try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = 'ERR ' + e.message; }
  check(`${name} el mensaje se copió al portapapeles`, clip === msg, clip === msg ? '' : clip.slice(0, 80));
  await shot(page, `${name}-08-cart-sent`);
  fs.writeFileSync(path.join(SHOTS, `${name}-message.txt`), msg);
  // cantidades
  await page.locator('#cart-items [data-inc]').first().click();
  await sleep(300);
  const total2 = await page.locator('#cart-total').innerText();
  check(`${name} + cantidad actualiza el total`, total2 === '$120', total2);
  await page.locator('#cart-items [data-dec]').first().click();
  await sleep(300);
  await page.keyboard.press('Escape');
  await sleep(900);
  check(`${name} Esc cierra el drawer`, !(await page.locator('#cart').isVisible()));

  // ---- Cómo pedir / cierre / footer ----
  await scrollToEl(page, '#como', -70);
  await sleep(1200);
  await shot(page, `${name}-09-how`);
  await goto(page, 999999);
  await sleep(1300);
  await shot(page, `${name}-10-footer`);

  // persistencia del carrito
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(500);
  check(`${name} carrito persiste en localStorage`, (await page.locator('#cart-count').innerText()) === '3');
  await ctx.close();
}

async function runIntroSkip(browser, errors) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watchErrors(page, errors, 'skip');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(150);
  const t = Date.now();
  await page.locator('#intro-skip').tap().catch(() => page.locator('#intro-skip').click());
  await page.waitForFunction(() => !document.documentElement.classList.contains('has-intro'), null, { timeout: 2000 });
  check('intro se puede saltar (botón)', Date.now() - t < 600, `${Date.now() - t} ms`);
  // segunda visita de la sesión: sin intro
  await page.reload({ waitUntil: 'domcontentloaded' });
  check('intro no se repite en la misma sesión', !(await page.evaluate(() => document.documentElement.classList.contains('has-intro'))));
  await ctx.close();
}

async function runReduced(browser, errors) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  watchErrors(page, errors, 'reduced');
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(600);
  check('reduced-motion: sin intro', !(await page.evaluate(() => document.documentElement.classList.contains('has-intro'))));
  await shot(page, 'reduced-01-hero');
  const roomTop = await page.evaluate(() => document.querySelector('#room').getBoundingClientRect().top + window.scrollY);
  await goto(page, roomTop);
  await shot(page, 'reduced-02-room');
  await scrollToEl(page, '#prueba', -90);
  await page.waitForSelector('#viewer.is-ready, #viewer.is-fallback', { timeout: 25000 });
  await sleep(1200);
  check('reduced-motion: visor no se enciende solo', (await page.locator('#viewer').getAttribute('data-on')) === 'false');
  await page.locator('.switch').click();
  await sleep(500);
  await shot(page, 'reduced-03-viewer');
  const hov = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check('reduced-motion: sin scroll horizontal', hov);
  await ctx.close();
}

async function runNoWebGL(browser, errors) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...r) {
      if (/webgl/i.test(type)) return null;
      return orig.call(this, type, ...r);
    };
  });
  const page = await ctx.newPage();
  watchErrors(page, errors, 'nowebgl');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('#intro-skip').click().catch(() => {});
  await scrollToEl(page, '#prueba', -90);
  await page.waitForSelector('#viewer.is-fallback', { timeout: 15000 });
  await sleep(600);
  check('sin WebGL: se muestra la foto de respaldo', await page.locator('#viewer-poster').isVisible() && await page.locator('#viewer-fallback').isVisible());
  await scrollToEl(page, '#viewer-stage', -70);
  await shot(page, 'nowebgl-viewer');
  await ctx.close();
}

(async () => {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const errors = [];
  try {
    await runViewport(browser, 'm390', { width: 390, height: 844 }, errors);
    await runViewport(browser, 'd1280', { width: 1280, height: 800 }, errors);
    await runIntroSkip(browser, errors);
    await runReduced(browser, errors);
    await runNoWebGL(browser, errors);
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  check('cero errores de consola / página', errors.length === 0, errors.join(' || '));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
  console.log('Capturas en', SHOTS);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
