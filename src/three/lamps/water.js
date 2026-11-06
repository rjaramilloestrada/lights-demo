// Kit "water": base blanca + cristal facetado. Proyecta cáusticas animadas (ShaderMaterial) en pared, techo y mesa.
import {
  Group, Mesh, PlaneGeometry, CylinderGeometry, MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial,
  ShaderMaterial, AdditiveBlending, Color, Vector3, TorusGeometry,
} from 'three';
import { WALL_Z, TABLE_TOP, makeSprite, lathe } from '../common.js';

// c0 sombra, c1 tono medio (el que ves de lejos), c2 brillo
export const WATER_COLORS = {
  ambar: ['#b3200a', '#ff7a10', '#ffd24a'],
  azul: ['#0a1c9a', '#1e6bff', '#7fe3ff'],
  turquesa: ['#04606e', '#12d6c4', '#b8fff0'],
  violeta: ['#3a0a8c', '#8c3cff', '#ff9be6'],
  rosa: ['#9c0a52', '#ff3d95', '#ffc2e0'],
  verde: ['#0a5a1c', '#28d65a', '#d4ff7a'],
  rojo: ['#6e0008', '#ff1e26', '#ff9c5a'],
  blanco: ['#56648a', '#dfe8ff', '#ffffff'],
};

const CAUSTIC_VERT = /* glsl */ `
uniform vec3 uA; uniform vec3 uB;
varying vec2 vP; varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vP = vec2(dot(w.xyz, uA), dot(w.xyz, uB));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const CAUSTIC_FRAG = /* glsl */ `
uniform float uT; uniform float uI; uniform float uScale; uniform float uQ;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uLamp;
varying vec2 vP; varying vec3 vW;
vec2 h2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// distancia F2 - F1 de un voronoi animado: 0 sobre las aristas de las celdas
float edge(vec2 p, float t) {
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = h2(ip + g);
      o = 0.5 + 0.5 * sin(t + 6.2831 * o);
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
float swirl(vec2 p, float t) {
  vec2 q = p;
  q += 0.38 * vec2(sin(q.y * 1.3 + t * 0.35), cos(q.x * 1.1 - t * 0.3));
  q += 0.22 * vec2(sin(q.y * 2.7 - t * 0.5 + 1.7), cos(q.x * 2.3 + t * 0.45));
  return 0.5 + 0.5 * sin(q.x * 1.6 + q.y * 1.1 + sin(q.x * 0.9 - q.y * 1.4 + t * 0.25) * 1.4);
}
void main() {
  vec2 p = vP * uScale;
  float s = swirl(p, uT);
  float e1 = 0.0;
  if (uQ > 0.5) e1 = 1.0 - smoothstep(0.0, 0.42, edge(p * 1.0 + s * 0.6, uT * 0.5));
  float e2 = 1.0 - smoothstep(0.0, 0.75, edge(p * 0.42 + vec2(3.1, 1.7) - s * 0.4, uT * 0.3));
  e1 *= e1;
  float f = 0.45 * s + 0.35 * e2 + 0.3 * e1 * (0.5 + 0.5 * s);
  f = smoothstep(0.2, 0.98, f);
  vec3 col = mix(uC0, uC1, smoothstep(0.08, 0.6, f));
  col = mix(col, uC2, smoothstep(0.72, 1.2, f) * 0.6);
  vec3 dv = vW - uLamp;
  dv.y *= dv.y > 0.0 ? 0.62 : 1.25;       // llega más arriba que abajo
  float d2 = dot(dv, dv);
  float fall = 1.0 / (1.0 + d2 * 0.5);
  fall *= 1.0 - smoothstep(9.0, 16.0, d2);
  float inten = uI * fall * (0.05 + 1.0 * f * f);
  gl_FragColor = vec4(col * inten, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createWater(ctx) {
  const { lights: { bulb }, env, glowTex, lampPos, reduced } = ctx;
  const root = new Group();
  const world = new Group();

  const W = {
    key: 'ambar',
    pal: WATER_COLORS.ambar.map((h) => new Color(h)),
    palT: WATER_COLORS.ambar.map((h) => new Color(h)),
    cycle: false, started: false,
  };
  const uTime = { value: 0 };

  // ---------- Modelo ----------
  const baseMat = new MeshStandardMaterial({ color: '#f1f1f4', roughness: 0.28, metalness: 0.05, flatShading: false, envMap: env, envMapIntensity: 0.9 });
  const base = new Mesh(lathe([[0, 0], [0.072, 0], [0.076, 0.004], [0.076, 0.026], [0.072, 0.034], [0.066, 0.037], [0.0, 0.037]], { div: 6, seg: 56 }), baseMat);
  const ringMat = new MeshBasicMaterial({ color: '#ffb060', toneMapped: false, transparent: true, opacity: 0 });
  const ring = new Mesh(new TorusGeometry(0.0665, 0.0022, 8, 56), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.0375;

  const H = 0.135, R = 0.0675;
  const cg = new CylinderGeometry(R * 0.98, R, H, 40, 18, false);
  const pos = cg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-5) continue;
    const a = Math.atan2(z, x);
    const n = Math.sin(a * 7 + y * 70) * 0.5 + Math.sin(a * 13 - y * 110 + 1.7) * 0.32 + Math.sin(a * 4 + y * 36 + 0.6) * 0.3 + Math.sin(a * 19 + y * 150) * 0.18;
    const k = 1 + (0.052 * n) * (r / R);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  cg.computeVertexNormals();
  const crystalMat = new MeshPhysicalMaterial({
    color: '#ffb36a', emissive: '#ff7a10', emissiveIntensity: 0, roughness: 0.08, metalness: 0, flatShading: true,
    transparent: true, opacity: 0.62, envMap: env, envMapIntensity: 1.3, clearcoat: 1, clearcoatRoughness: 0.08,
  });
  crystalMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform float uTime;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float n1 = sin(vOP.x * 85.0 + vOP.y * 45.0 + uTime * 0.9);
        float n2 = sin(vOP.z * 80.0 - vOP.y * 60.0 - uTime * 0.7);
        float n3 = sin((vOP.x - vOP.z) * 62.0 + vOP.y * 38.0 + uTime * 0.5);
        float spk = clamp(0.5 + 0.5 * n1 * n2 + 0.25 * n3, 0.0, 1.0);
        totalEmissiveRadiance *= 0.45 + 1.35 * spk * spk;`);
  };
  crystalMat.customProgramCacheKey = () => 'waterCrystal';
  const crystal = new Mesh(cg, crystalMat);
  crystal.position.y = 0.037 + H / 2;

  const coreMat = new MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false });
  const core = new Mesh(new CylinderGeometry(0.04, 0.045, 0.1, 24, 1), coreMat);
  core.position.y = 0.037 + 0.065;
  const hot = makeSprite(glowTex, 0.34);
  hot.position.y = 0.037 + 0.07;
  root.add(base, ring, core, crystal, hot);

  // ---------- Proyección (pared, lateral, techo y mesa) ----------
  const shared = {
    uT: uTime, uI: { value: 0 }, uScale: { value: 1.7 }, uQ: { value: 1 },
    uC0: { value: new Color() }, uC1: { value: new Color() }, uC2: { value: new Color() },
    uLamp: { value: new Vector3(lampPos.x, lampPos.y + 0.1, lampPos.z) },
  };
  const plane = (w, h, a, b, mesh) => {
    const mat = new ShaderMaterial({
      uniforms: { ...shared, uA: { value: new Vector3(...a) }, uB: { value: new Vector3(...b) } },
      vertexShader: CAUSTIC_VERT, fragmentShader: CAUSTIC_FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    const m = new Mesh(new PlaneGeometry(w, h), mat);
    m.renderOrder = 2;
    mesh(m);
    world.add(m);
    return m;
  };
  const wallP = plane(9, 3.4, [1, 0, 0], [0, 1, 0], (m) => m.position.set(0, 1.7, WALL_Z + 0.036));
  const sideP = plane(7, 3.4, [0, 0, 1], [0, 1, 0], (m) => { m.rotation.y = Math.PI / 2; m.position.set(-2.3 + 0.01, 1.7, 1.9); });
  const ceilP = plane(9, 8, [1, 0, 0], [0, 0, 1], (m) => { m.rotation.x = Math.PI / 2; m.position.set(0, 3.4 - 0.01, 1.2); });
  const tableP = plane(1.0, 0.54, [1, 0, 0], [0, 0, 1], (m) => { m.rotation.x = -Math.PI / 2; m.position.set(0.2, TABLE_TOP + 0.003, -1.2); });
  tableP.material.uniforms.uScale = { value: 6.5 };
  tableP.material.uniforms.uI = { value: 0 };
  const planes = [wallP, sideP, ceilP, tableP];

  const hsl = { h: 0, s: 0, l: 0 };
  function setPalette(key) {
    if (key === 'ciclo') { W.cycle = true; W.key = key; return; }
    if (!WATER_COLORS[key]) return;
    W.cycle = false;
    W.key = key;
    WATER_COLORS[key].forEach((h, i) => W.palT[i].set(h));
    if (reduced || !W.started) W.pal.forEach((c, i) => c.copy(W.palT[i]));
  }

  function setLamp() { W.started = true; }
  function setVariant(k, v) { if (k === 'waterColor') setPalette(v); }

  const tmp = new Color();
  const wp = new Vector3();
  function update(dt, t, st) {
    let busy = false;
    if (W.cycle) {
      const h = reduced ? 0.58 : (t * 0.045) % 1;
      const mk = (hh, s, l) => tmp.setHSL(((hh % 1) + 1) % 1, s, l);
      W.pal[0].copy(mk(h - 0.07, 0.95, 0.24));
      W.pal[1].copy(mk(h, 0.95, 0.55));
      W.pal[2].copy(mk(h + 0.09, 0.9, 0.78));
      busy = !reduced;
    } else {
      const k = reduced ? 1 : 1 - Math.exp(-dt * 4.5);
      let diff = 0;
      W.pal.forEach((c, i) => { c.lerp(W.palT[i], k); diff += Math.abs(c.r - W.palT[i].r) + Math.abs(c.g - W.palT[i].g) + Math.abs(c.b - W.palT[i].b); });
      busy = diff > 0.004;
    }
    const L = st.L;
    const vis = 1 - 0.55 * st.amb;
    const on = L > 0.002;
    uTime.value = t;
    shared.uI.value = L * 0.6 * vis;
    tableP.material.uniforms.uI.value = L * 0.45 * vis;
    shared.uC0.value.copy(W.pal[0]);
    shared.uC1.value.copy(W.pal[1]);
    shared.uC2.value.copy(W.pal[2]);
    planes.forEach((p) => { p.visible = on; });

    crystalMat.emissive.copy(W.pal[1]);
    crystalMat.emissiveIntensity = 2.1 * L;
    crystalMat.color.copy(W.pal[1]);
    coreMat.color.copy(W.pal[1]).lerp(W.pal[2], 0.55).multiplyScalar(0.2 + 0.8 * L);
    hot.visible = on;
    hot.material.opacity = 0.7 * L;
    hot.material.color.copy(W.pal[2]);
    ringMat.opacity = L;
    ringMat.color.copy(W.pal[1]);

    wp.set(lampPos.x, lampPos.y + 0.12, lampPos.z);
    bulb.position.copy(wp);
    bulb.color.copy(W.pal[1]).lerp(tmp.set('#ffffff'), 0.15);
    bulb.intensity = 2.6 * L;
    bulb.distance = 4.5;
    bulb.decay = 1.6;

    kit.dust.copy(W.pal[2]);
    kit.dustOpacity = 0.7 * L;
    return busy;
  }

  const kit = {
    id: 'water', root, world, animated: true, usesDim: true,
    dust: new Color('#ffc080'), dustOpacity: 0,
    setLamp, setVariant, setAngle() {},
    setQuality(q) { shared.uQ.value = q > 0 ? 1 : 0; },
    update,
    dispose() {
      [baseMat, crystalMat, coreMat, ringMat, hot.material].forEach((m) => m.dispose());
      planes.forEach((p) => { p.material.dispose(); p.geometry.dispose(); });
      cg.dispose();
    },
  };
  return kit;
}
