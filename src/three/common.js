// Piezas compartidas del visor 3D: constantes del cuarto, texturas, halo, entorno y helpers de materiales.
import {
  Scene, Mesh, Color, CanvasTexture, SRGBColorSpace, PlaneGeometry, MeshBasicMaterial, MeshStandardMaterial,
  ShaderMaterial, AdditiveBlending, Sprite, SpriteMaterial, PMREMGenerator, DoubleSide, Vector2, SplineCurve,
  LatheGeometry, Vector3,
} from 'three';

export const WALL_Z = -1.6;
export const TABLE_TOP = 0.62;
export const LAMP_POS = new Vector3(0.22, TABLE_TOP, -1.2);

export const std = (color, o = {}) => new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...o });

export const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

// ---------- Texturas ----------
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

// charco de luz suave (sobre la mesa): más plano que glowTexture
export function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function posterTexture() {
  const c = document.createElement('canvas');
  c.width = 192; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9dcc6'; g.fillRect(0, 0, 192, 256);
  g.fillStyle = '#d9633b'; g.beginPath(); g.arc(96, 104, 52, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1f2b4d'; g.beginPath(); g.moveTo(0, 256); g.lineTo(0, 170); g.lineTo(70, 140); g.lineTo(130, 180); g.lineTo(192, 150); g.lineTo(192, 256); g.fill();
  g.fillStyle = '#3d5a80'; g.beginPath(); g.moveTo(0, 256); g.lineTo(0, 210); g.lineTo(80, 190); g.lineTo(192, 220); g.lineTo(192, 256); g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function makeSprite(tex, size) {
  const s = new Sprite(new SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
  s.scale.set(size, size, 1);
  s.renderOrder = 4;
  return s;
}

// decal circular/elíptico aditivo sobre una superficie horizontal
export function makeDecal(tex, w, d) {
  const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(w, d, 1);
  m.renderOrder = 2;
  return m;
}

// ---------- Entorno de estudio (solo para los materiales de las lámparas) ----------
export function makeEnv(renderer) {
  const s = new Scene();
  s.background = new Color(0x0a0b12);
  const panel = (w, h, x, y, z, r, g, b) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(r, g, b), side: DoubleSide, toneMapped: false }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(7, 3, 0, 5, 1, 7, 7, 7.6);        // softbox cenital
  panel(1.2, 5, -4.5, 1.2, 2.5, 5, 4.2, 3.4); // tira cálida izquierda
  panel(1.0, 5, 4.6, 1, 2, 3, 3.8, 5.2);      // tira fría derecha
  panel(5, 1.4, 0, 0.2, 5.5, 1.6, 1.6, 1.8);  // panel frontal tenue
  panel(8, 8, 0, -4, 0, 0.5, 0.4, 0.45);      // rebote del piso
  const pm = new PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  s.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}

// ---------- Perfiles de revolución ----------
// pts: [[r, y], ...] de abajo hacia arriba por la cara exterior. Spline suave (cada segmento "div" puntos).
export function lathe(pts, { div = 5, seg = 48 } = {}) {
  const v = pts.map(([r, y]) => new Vector2(r, y));
  const curve = new SplineCurve(v);
  const pp = curve.getPoints((v.length - 1) * div);
  return new LatheGeometry(pp, seg);
}
// igual pero con puntos exactos (aristas vivas)
export function latheRaw(pts, seg = 48) {
  return new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), seg);
}

// ---------- Halo en la pared (el original de Sunset / Aura, reutilizable) ----------
const HALO_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uC[6];
uniform float uIntensity;
uniform float uTime;
uniform float uBands;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float t = length(p) / 0.5;            // t = 1 en el borde del halo
  float x = clamp(t, 0.0, 1.0) * 5.0;
  int i = int(min(floor(x), 4.0));
  float f = smoothstep(0.0, 1.0, x - float(i));
  vec3 col = mix(uC[i], uC[i + 1], f);
  float body = 1.0 - smoothstep(0.80, 1.0, t);
  float tail = 0.26 * exp(-max(t - 0.82, 0.0) * 3.2) * (1.0 - smoothstep(1.7, 2.0, t));
  float a = max(body, tail * step(0.5, t));
  a *= 0.82 + 0.18 * (1.0 - t * 0.6);
  float rings = 1.0 + uBands * 0.10 * sin(t * 22.0 - uTime * 0.7);
  float core = 1.0 + 0.16 * (1.0 - smoothstep(0.0, 0.5, t));
  col *= rings * core;
  float n = (hash(gl_FragCoord.xy + uTime) - 0.5) / 120.0;
  gl_FragColor = vec4(col * uIntensity + n, clamp(a * min(uIntensity, 1.0), 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createHalo() {
  const pal = Array.from({ length: 6 }, () => new Color());
  const mat = new ShaderMaterial({
    uniforms: { uC: { value: pal }, uIntensity: { value: 0 }, uTime: { value: 0 }, uBands: { value: 0 } },
    vertexShader: HALO_VERT,
    fragmentShader: HALO_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(4, 4), mat);
  mesh.renderOrder = 2;
  return { mesh, mat, pal };
}

// ---------- Emisivo con forma: degradado en Y o radial + borde (rim) ----------
// Para plásticos translúcidos (Mushroom, Donut, Fungi). Material: MeshPhysicalMaterial suave (no flatShading).
export function shapeEmissive(mat, { mode = 'y', lo = 0.6, hi = 1.2, y0 = 0, y1 = 1, rim = 0 } = {}) {
  const u = { uLo: { value: lo }, uHi: { value: hi }, uY0: { value: y0 }, uY1: { value: y1 }, uRim: { value: rim }, uMode: { value: mode === 'radial' ? 1 : 0 } };
  mat.userData.shape = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform float uLo; uniform float uHi; uniform float uY0; uniform float uY1; uniform float uRim; uniform float uMode;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float vH = uMode > 0.5 ? length(vOP.xz) : vOP.y;
        float sg = clamp((vH - uY0) / (uY1 - uY0), 0.0, 1.0);
        totalEmissiveRadiance *= mix(uLo, uHi, sg);
        totalEmissiveRadiance *= 1.0 + uRim * pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);`,
      );
  };
  mat.customProgramCacheKey = () => 'shapeEmissive';
  return u;
}

export const hex = (h) => new Color(h);
