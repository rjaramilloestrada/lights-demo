// Extrae las fotos del catálogo PDF de Vibing Lights y genera WebP optimizados en public/img.
// Uso: node scripts/extract-assets.mjs /ruta/al/catalogo.pdf
// Requiere `pdfimages` (poppler-utils). Las fotos traen el nombre quemado abajo: se recorta.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const pdf = process.argv[2];
if (!pdf) {
  console.error('Uso: node scripts/extract-assets.mjs <catalogo.pdf>');
  process.exit(1);
}
const out = resolve('public/img');
mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'lights-pdf-'));
execFileSync('pdfimages', ['-all', resolve(pdf), join(tmp, 'raw')]);
const files = readdirSync(tmp).sort();
console.log('Imágenes extraídas:', files.join(', '));
const f = (n) => join(tmp, files.find((x) => x.startsWith(`raw-${String(n).padStart(3, '0')}`)));

// keep = fracción superior que se conserva (el rótulo con el nombre queda debajo)
const products = [
  { id: 'mushroom', n: 1, keep: 0.73 },
  { id: 'sunset', n: 2, keep: 0.81 },
  { id: 'aura', n: 3, keep: 0.81 },
  { id: 'water', n: 4, keep: 0.81 },
  { id: 'lava', n: 8, keep: 0.8 },
  { id: 'donut', n: 9, keep: 0.73 },
  { id: 'fungi', n: 10, keep: 0.77 },
];

async function save(img, name, w, q = 84) {
  const p = join(out, `${name}.webp`);
  await img.resize({ width: w, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toFile(p);
  const m = await sharp(p).metadata();
  console.log(name, `${m.width}x${m.height}`);
}

for (const p of products) {
  const src = f(p.n);
  const { width, height } = await sharp(src).metadata();
  const h = Math.round(height * p.keep);
  await save(sharp(src).extract({ left: 0, top: 0, width, height: h }), p.id, 1100);
  await save(sharp(src).extract({ left: 0, top: 0, width, height: h }), `${p.id}-sm`, 520, 72);
}

// Variantes de la lámpara Water (miniaturas redondas del PDF)
for (const [i, n] of [5, 6, 7].entries()) {
  const src = f(n);
  const { width, height } = await sharp(src).metadata();
  const s = Math.min(width, Math.round(height * 0.86));
  await save(sharp(src).extract({ left: Math.round((width - s) / 2), top: Math.round(height * 0.05), width: s, height: s }), `water-v${i + 1}`, 160, 70);
}

// Logos: rojo sobre azul -> rojo con transparencia (canal alfa derivado del canal rojo)
async function redLogo(src, name, w) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const a = Math.max(0, Math.min(255, Math.round((data[i] / 246) * 255)));
    data[i] = 246; data[i + 1] = 3; data[i + 2] = 6; data[i + 3] = a;
  }
  const img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 4 });
  await save(img, name, w, 90);
}
await redLogo(f(0), 'logo-vb', 600);
await redLogo(f(11), 'ready-to-vibe', 700);
