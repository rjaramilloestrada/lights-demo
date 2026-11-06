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
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-user-lights-demo/437bce3c-54c0-5776-8709-f59dc2c89a8e/scratchpad/shots-v2';
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
  const [r, g, b] = st.channels.slice(0, 3).map((c) => Math.round(c.mean));
  return { mean: Math.round(mean), std: Math.round(std), r, g, b };
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


// ---------- Visor 3D con las 7 lámparas ----------
const LAMPS = ['mushroom', 'sunset', 'aura', 'water', 'lava', 'donut', 'fungi'];
const NAMES = { mushroom: 'Mushroom', sunset: 'Sunset', aura: 'Aura', water: 'Water', lava: 'Lava', donut: 'Donut', fungi: 'Fungi' };

async function newViewerPage(browser, name, viewport, errors, opts = {}) {
  const isMobile = viewport.width < 600;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile, locale: 'es-EC', ...opts });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vl-intro', '1'); } catch (e) { /* nada */ } });
  const page = await ctx.newPage();
  watchErrors(page, errors, name);
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(600);
  return { ctx, page, isMobile };
}
async function openViewer(page, isMobile) {
  await scrollToEl(page, '#prueba', -(isMobile ? 90 : 100));
  await page.waitForSelector('#viewer.is-ready, #viewer.is-fallback', { timeout: 25000 });
}
// deja a la vista las fichas, el escenario y (en escritorio) el panel
async function frameViewer(page, isMobile) {
  await scrollToEl(page, '#viewer-rail', -(isMobile ? 120 : 130));
  await sleep(250);
}
// captura del visor ya encuadrado (fichas + escenario, y el panel en escritorio)
async function vshot(page, isMobile, name) {
  await frameViewer(page, isMobile);
  return shot(page, name);
}
const dataOf = (page, k) => page.locator('#viewer').getAttribute('data-' + k);
async function setOn(page, want) {
  const cur = (await dataOf(page, 'on')) === 'true';
  if (cur !== want) await page.locator('.switch').click();
}
async function pickLamp(page, id, wait = 2400) {
  await page.click('#tab-' + id);
  await sleep(wait);
}

async function runViewer7(browser, name, viewport, errors) {
  const { ctx, page, isMobile } = await newViewerPage(browser, name, viewport, errors);
  await openViewer(page, isMobile);
  check(`${name} visor 7: listo`, (await dataOf(page, 'state')) === 'ready', await dataOf(page, 'state'));
  await sleep(1300);

  // carrusel de 7 fichas
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#viewer-tabs .tab')].map((t) => t.dataset.lamp));
  check(`${name} carrusel con las 7 lámparas`, JSON.stringify(tabs) === JSON.stringify(LAMPS), tabs.join(','));
  const rail = await page.evaluate(() => { const t = document.querySelector('#viewer-tabs'); return { sw: t.scrollWidth, cw: t.clientWidth }; });
  if (isMobile) check(`${name} carrusel se desliza horizontal (móvil)`, rail.sw > rail.cw, `${rail.sw} > ${rail.cw}`);
  check(`${name} sin scroll horizontal de la página (visor)`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await frameViewer(page, isMobile);

  // cada lámpara: encendida, apagada, de nuevo encendida
  const stats = {};
  for (const id of LAMPS) {
    await pickLamp(page, id, id === 'lava' || id === 'water' ? 3000 : 2200);
    check(`${name} ${id}: ficha activa`, (await dataOf(page, 'lamp')) === id);
    await setOn(page, true);
    await sleep(2200);
    await vshot(page, isMobile, `${name}-lamp-${id}-on`);
    const onS = await canvasStats(page);
    stats[id] = onS;
    await page.locator('#viewer-stage').screenshot({ path: path.join(SHOTS, `${name}-stage-${id}-on.png`) });
    check(`${name} ${id}: canvas con contenido`, !onS || (onS.mean > 22 && onS.std > 14), JSON.stringify(onS));
    // controles correctos
    const vis = await page.evaluate(() => ({
      angle: !document.querySelector('[data-ctl=angle]').hidden, dimmer: !document.querySelector('[data-ctl=dimmer]').hidden,
      temp: !document.querySelector('[data-ctl=temp]').hidden, lava: !document.querySelector('[data-ctl=lavaColor]').hidden,
      water: !document.querySelector('[data-ctl=waterColor]').hidden, body: !document.querySelector('[data-ctl=fungiBody]').hidden,
    }));
    const want = { angle: ['sunset', 'aura'].includes(id), dimmer: !['sunset', 'aura'].includes(id), temp: ['mushroom', 'donut', 'fungi'].includes(id), lava: id === 'lava', water: id === 'water', body: id === 'fungi' };
    check(`${name} ${id}: controles propios`, JSON.stringify(vis) === JSON.stringify(want), JSON.stringify(vis));
    await setOn(page, false);
    await sleep(2000);
    await vshot(page, isMobile, `${name}-lamp-${id}-off`);
    const offS = await canvasStats(page);
    check(`${name} ${id}: apagada más oscura que encendida`, !offS || !onS || offS.mean < onS.mean - 4, `${offS && offS.mean} < ${onS && onS.mean}`);
    await setOn(page, true);
    await sleep(1500);
  }
  fs.writeFileSync(path.join(SHOTS, `${name}-lamp-stats.json`), JSON.stringify(stats, null, 1));

  // ---- Variantes ----
  // Water: color de la luz
  await pickLamp(page, 'water', 2400);
  const wAmb = await canvasStats(page);
  await page.locator('.sw:has(input[value=azul])').click();
  await sleep(2600);
  check(`${name} Water: cambia a azul`, (await dataOf(page, 'water')) === 'azul');
  await frameViewer(page, isMobile);
  await vshot(page, isMobile, `${name}-water-azul`);
  const wAz = await canvasStats(page);
  check(`${name} Water azul: más azul que rojo`, !wAz || wAz.b > wAz.r, JSON.stringify(wAz));
  check(`${name} Water ámbar: más rojo que azul`, !wAmb || wAmb.r > wAmb.b, JSON.stringify(wAmb));
  for (const c of ['violeta', 'verde', 'ciclo']) {
    await page.locator(`.sw:has(input[value=${c}])`).click();
    await sleep(2300);
    await vshot(page, isMobile, `${name}-water-${c}`);
  }
  const wGreen = await page.locator('.sw:has(input[value=verde])').count();
  check(`${name} Water: 8 colores de ejemplo + ciclo`, (await page.locator('.sw').count()) === 9 && wGreen === 1);
  check(`${name} Water: aviso de +16 colores`, /\+16 colores/.test(await page.locator('[data-ctl=waterColor] .ctl__note').innerText()));
  await page.locator('.sw:has(input[value=ambar])').click();
  await sleep(800);

  // Lava: rojo / naranja / azul
  await pickLamp(page, 'lava', 3000);
  const lRed = await canvasStats(page);
  await vshot(page, isMobile, `${name}-lava-rojo`);
  await page.locator('#opts-lava .vopt', { hasText: 'Naranja' }).click();
  await sleep(2800);
  check(`${name} Lava: variante naranja`, (await dataOf(page, 'lava')) === 'naranja');
  await vshot(page, isMobile, `${name}-lava-naranja`);
  await page.locator('#opts-lava .vopt', { hasText: 'Azul' }).click();
  await sleep(2800);
  check(`${name} Lava: variante azul`, (await dataOf(page, 'lava')) === 'azul');
  await vshot(page, isMobile, `${name}-lava-azul`);
  const lBlue = await canvasStats(page);
  check(`${name} Lava azul: más azul que rojo; rojo: más rojo que azul`, !lBlue || !lRed || (lBlue.b > lBlue.r && lRed.r > lRed.b), `${JSON.stringify(lRed)} ${JSON.stringify(lBlue)}`);

  // Mushroom: Cálida -> Fría; intensidad
  await pickLamp(page, 'mushroom', 2400);
  const mWarm = await canvasStats(page);
  await page.locator('#opts-temp .vopt', { hasText: 'Neutra' }).click();
  await sleep(2000);
  await vshot(page, isMobile, `${name}-mushroom-neutra`);
  await page.locator('#opts-temp .vopt', { hasText: 'Fría' }).click();
  await sleep(2200);
  check(`${name} Mushroom: iluminación fría`, (await dataOf(page, 'temp')) === 'fria');
  await vshot(page, isMobile, `${name}-mushroom-fria`);
  const mCool = await canvasStats(page);
  check(`${name} Mushroom fría: más azul relativo que cálida`, !mCool || !mWarm || mCool.b / mCool.r > mWarm.b / mWarm.r, `${mCool && (mCool.b / mCool.r).toFixed(2)} > ${mWarm && (mWarm.b / mWarm.r).toFixed(2)}`);
  await page.locator('#viewer-dim').fill('100');
  await sleep(1200);
  const m100 = await canvasStats(page);
  await page.locator('#viewer-dim').fill('25');
  await sleep(1400);
  await vshot(page, isMobile, `${name}-mushroom-dim25`);
  const m25 = await canvasStats(page);
  check(`${name} Mushroom: el dimmer baja la luz`, !m25 || !m100 || m25.mean < m100.mean - 4, `${m25 && m25.mean} < ${m100 && m100.mean}`);
  await page.locator('#viewer-dim').fill('85');
  await page.locator('#opts-temp .vopt', { hasText: 'Cálida' }).click();
  await sleep(600);

  // Donut neutra, Fungi cuerpos
  await pickLamp(page, 'donut', 2300);
  await page.locator('#opts-temp .vopt', { hasText: 'Neutra' }).click();
  await sleep(2200);
  check(`${name} Donut: iluminación neutra`, (await dataOf(page, 'temp')) === 'neutra');
  await vshot(page, isMobile, `${name}-donut-neutra`);
  await pickLamp(page, 'fungi', 2300);
  for (const b of ['Negro', 'Rojo', 'Blanco']) {
    await page.locator('#opts-body .vopt', { hasText: b }).click();
    await sleep(1500);
    check(`${name} Fungi: cuerpo ${b} (visual)`, (await dataOf(page, 'body')) === b.toLowerCase());
    await vshot(page, isMobile, `${name}-fungi-${b.toLowerCase()}`);
  }
  await page.locator('#opts-temp .vopt', { hasText: 'Fría' }).click();
  await sleep(2000);
  await vshot(page, isMobile, `${name}-fungi-fria`);

  // Cuarto de día / noche
  await pickLamp(page, 'mushroom', 2000);
  await page.locator('#opts-temp .vopt', { hasText: 'Cálida' }).click();
  await sleep(900);
  const night = await canvasStats(page);
  await page.click('#viewer-mode');
  await sleep(2300);
  check(`${name} modo día activo`, (await dataOf(page, 'room')) === 'day' && (await page.locator('#viewer-mode').getAttribute('aria-pressed')) === 'true');
  await vshot(page, isMobile, `${name}-room-day`);
  const day = await canvasStats(page);
  check(`${name} cuarto de día más claro que de noche`, !day || !night || day.mean > night.mean + 15, `${day && day.mean} > ${night && night.mean}`);
  await page.click('#viewer-mode');
  await sleep(1500);

  // Teclado en las fichas
  await page.locator('#tab-sunset').focus();
  await pickLamp(page, 'sunset', 1200);
  await page.locator('#tab-sunset').focus();
  await page.keyboard.press('ArrowRight');
  await sleep(500);
  check(`${name} flecha derecha pasa a la siguiente ficha`, (await dataOf(page, 'lamp')) === 'aura');
  await page.keyboard.press('ArrowLeft');
  await sleep(300);
  check(`${name} flecha izquierda regresa`, (await dataOf(page, 'lamp')) === 'sunset');

  check(`${name} sin scroll horizontal tras recorrer las 7`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  // "Verla en 3D" desde las tarjetas del catálogo
  const nBtn = await page.locator('[data-view3d]').count();
  check(`${name} 7 botones "Verla en 3D"`, nBtn === 7, String(nBtn));
  await scrollToEl(page, '#card-lava', -140);
  await page.locator('#card-lava .opt', { hasText: 'Azul' }).click();
  await page.locator('#card-lava [data-view3d]').click();
  await sleep(3200);
  check(`${name} "Verla en 3D" de Lava abre Lava en azul`, (await dataOf(page, 'lamp')) === 'lava' && (await dataOf(page, 'lava')) === 'azul', `${await dataOf(page, 'lamp')} ${await dataOf(page, 'lava')}`);
  await frameViewer(page, isMobile);
  await vshot(page, isMobile, `${name}-from-card-lava`);
  await scrollToEl(page, '#card-fungi', -140);
  await page.locator('#card-fungi .opt', { hasText: 'Fría' }).click();
  await page.locator('#card-fungi [data-view3d]').click();
  await sleep(2600);
  check(`${name} "Verla en 3D" de Fungi abre Fungi en fría`, (await dataOf(page, 'lamp')) === 'fungi' && (await dataOf(page, 'temp')) === 'fria');

  // Agregar desde el visor: Lava (Azul) + Donut (Neutra) = $70
  await frameViewer(page, isMobile);
  await pickLamp(page, 'lava', 1200);
  check(`${name} botón agregar muestra precio Lava`, /\$31/.test(await page.locator('#viewer-add').innerText()));
  await page.locator('#viewer-add').click();
  await sleep(500);
  await pickLamp(page, 'donut', 1200);
  await page.locator('#opts-temp .vopt', { hasText: 'Neutra' }).click();
  check(`${name} botón agregar muestra precio Donut`, /\$39/.test(await page.locator('#viewer-add').innerText()));
  await page.locator('#viewer-add').click();
  await sleep(900);
  check(`${name} carrito desde el visor = 2`, (await page.locator('#cart-count').innerText()) === '2');
  await page.click('#cart-btn');
  await sleep(1000);
  await page.fill('#cart-name', 'Camila Andrade');
  await page.fill('#cart-city', 'Quito');
  await sleep(300);
  const msg = await page.locator('#cart-message').innerText();
  const needles = ['Lava Lamp (Azul): $31', 'Donut Lamp (Neutra): $39', 'Total: $70'];
  const missing = needles.filter((n) => !msg.includes(n));
  check(`${name} mensaje desde el visor: Lava Azul + Donut Neutra = $70`, missing.length === 0, missing.join(' | '));
  await shot(page, `${name}-viewer-cart`);
  await ctx.close();
}

async function runTour(browser, errors) {
  const { ctx, page, isMobile } = await newViewerPage(browser, 'tour', { width: 390, height: 844 }, errors);
  await openViewer(page, isMobile);
  await scrollToEl(page, '#viewer-stage', -80);
  await sleep(8500);
  const l1 = await dataOf(page, 'lamp');
  check('recorrido automático: pasa a otra lámpara sin tocar nada', l1 !== 'sunset', l1);
  await page.click('#tab-donut');
  await sleep(300);
  await sleep(6500);
  check('recorrido automático se detiene con la primera interacción', (await dataOf(page, 'lamp')) === 'donut', await dataOf(page, 'lamp'));
  await ctx.close();
}

async function runReduced7(browser, errors) {
  const { ctx, page, isMobile } = await newViewerPage(browser, 'reduced7', { width: 390, height: 844 }, errors, { reducedMotion: 'reduce' });
  await openViewer(page, isMobile);
  await sleep(800);
  await frameViewer(page, isMobile);
  for (const id of ['water', 'lava', 'donut']) {
    await pickLamp(page, id, 1200);
    await setOn(page, true);
    await sleep(900);
    await vshot(page, isMobile, `reduced-lamp-${id}-on`);
    const s = await canvasStats(page);
    check(`reduced-motion: ${id} se ve con luz`, !s || (s.mean > 20 && s.std > 12), JSON.stringify(s));
  }
  await sleep(7000);
  check('reduced-motion: sin recorrido automático', (await dataOf(page, 'lamp')) === 'donut');
  check('reduced-motion: sin scroll horizontal (7 lámparas)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await ctx.close();
}

async function runNoWebGL7(browser, errors) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('vl-intro', '1'); } catch (e) { /* nada */ }
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...r) {
      if (/webgl/i.test(type)) return null;
      return orig.call(this, type, ...r);
    };
  });
  const page = await ctx.newPage();
  watchErrors(page, errors, 'nowebgl7');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await scrollToEl(page, '#prueba', -90);
  await page.waitForSelector('#viewer.is-fallback', { timeout: 15000 });
  await page.click('#tab-lava');
  await sleep(500);
  const src = await page.locator('#viewer-poster').getAttribute('src');
  check('sin WebGL: la foto de respaldo sigue a la lámpara elegida (Lava)', /lava\.webp/.test(src), src);
  await page.click('#tab-fungi');
  await sleep(400);
  check('sin WebGL: la foto de respaldo sigue a la lámpara elegida (Fungi)', /fungi\.webp/.test(await page.locator('#viewer-poster').getAttribute('src')));
  await scrollToEl(page, '#viewer-rail', -120);
  await shot(page, 'nowebgl-lamp-fungi');
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
    await runViewer7(browser, 'm390', { width: 390, height: 844 }, errors);
    await runViewer7(browser, 'd1280', { width: 1280, height: 800 }, errors);
    await runTour(browser, errors);
    await runReduced7(browser, errors);
    await runNoWebGL7(browser, errors);
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
