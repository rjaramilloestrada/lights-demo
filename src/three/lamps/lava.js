// Kit "lava": base y capuchón de metal, botella de vidrio con blobs de cera (metaballs por raymarch solo dentro de la botella).
import {
  Group, Mesh, CylinderGeometry, MeshStandardMaterial, ShaderMaterial, Color, Vector3, Vector4, MathUtils,
} from 'three';
import { WALL_Z, TABLE_TOP, createHalo, makeSprite, makeDecal, lathe } from '../common.js';

const VARIANTS = {
  rojo: { liquid: '#d10f1c', wax: '#ff2a2c', hi: '#ff8a3c', light: '#ff2b2b' },
  naranja: { liquid: '#ff9410', wax: '#ffd02e', hi: '#fff29a', light: '#ff9a1a' },
  azul: { liquid: '#1030ff', wax: '#14d4e6', hi: '#a6f7ff', light: '#2f7bff' },
};

const NB = 7;
const PH = [0.0, 1.1, 2.3, 3.4, 4.6, 5.5, 0.8];
const SP = [0.34, 0.27, 0.4, 0.23, 0.31, 0.37, 0.21];
const RR = [0.0225, 0.0185, 0.016, 0.0195, 0.0145, 0.0175, 0.015];

const BOTTLE_VERT = /* glsl */ `
varying vec3 vOP; varying vec3 vNW; varying vec3 vWP;
void main() {
  vOP = position;
  vNW = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const BOTTLE_FRAG = /* glsl */ `
uniform vec3 uCam; uniform float uSteps; uniform float uPow; uniform float uAmb;
uniform vec3 uLiquid; uniform vec3 uWax; uniform vec3 uHi;
uniform float uY0; uniform float uY1; uniform float uR0; uniform float uR1;
uniform float uPool; uniform vec4 uB[7];
varying vec3 vOP; varying vec3 vNW; varying vec3 vWP;

float Rr(float y) { return mix(uR0, uR1, clamp((y - uY0) / (uY1 - uY0), 0.0, 1.0)); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float map(vec3 p) {
  float rr = Rr(p.y);
  float d = p.y - uPool - 0.011 * (1.0 - clamp(dot(p.xz, p.xz) / (rr * rr), 0.0, 1.0));
  for (int i = 0; i < 7; i++) d = smin(d, length(p - uB[i].xyz) - uB[i].w, 0.017);
  return d;
}
vec3 nrm(vec3 p) {
  vec2 e = vec2(0.0007, -0.0007);
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}
void main() {
  vec3 rd = normalize(vOP - uCam);
  float tt = 0.0006;
  bool hit = false;
  vec3 hp = vOP;
  float dl = 1.0;
  for (int i = 0; i < 72; i++) {
    if (float(i) >= uSteps) break;
    vec3 p = vOP + rd * tt;
    if (length(p.xz) > Rr(p.y) + 0.0009 || p.y < uY0 || p.y > uY1) { dl = 1.0; break; }
    float d = map(p);
    dl = d;
    if (d < 0.00025) { hit = true; hp = p; break; }
    tt += max(d * 0.9, 0.00035);
  }
  if (!hit && dl < 0.0007) { hit = true; hp = vOP + rd * tt; }
  float hN = clamp((vOP.y - uY0) / (uY1 - uY0), 0.0, 1.0);
  float thick = sqrt(max(1.0 - dot(vOP.xz, vOP.xz) / (Rr(vOP.y) * Rr(vOP.y)), 0.0));
  vec3 col;
  if (hit) {
    vec3 n = nrm(hp);
    float hh = clamp((hp.y - uY0) / (uY1 - uY0), 0.0, 1.0);
    float dif = clamp(dot(n, normalize(vec3(0.15, -0.65, 0.75))) * 0.5 + 0.5, 0.0, 1.0);
    float sss = pow(1.0 - abs(dot(n, -rd)), 1.6);
    float glow = mix(1.35, 0.78, hh);
    vec3 wax = mix(uWax * 0.5, uWax * 1.25, dif) * glow;
    wax = mix(wax, uHi * 1.1, sss * 0.55);
    float sp = pow(max(dot(reflect(rd, n), normalize(vec3(-0.4, 0.5, 0.75))), 0.0), 36.0);
    col = wax * uPow + uHi * sp * 0.55 * uPow + uWax * 0.04;
  } else {
    float glow = mix(1.3, 0.5, hN);
    col = uLiquid * glow * (0.42 + 0.7 * thick) * uPow + uLiquid * 0.035;
  }
  // reflejos de vidrio (ventanas del estudio)
  vec3 V = normalize(cameraPosition - vWP);
  vec3 Rf = reflect(-V, normalize(vNW));
  float s1 = smoothstep(0.89, 0.985, dot(Rf, normalize(vec3(-0.55, 0.35, 0.75))));
  float s2 = smoothstep(0.93, 0.99, dot(Rf, normalize(vec3(0.75, 0.25, 0.6))));
  float edgeG = pow(1.0 - clamp(dot(V, normalize(vNW)), 0.0, 1.0), 3.0);
  col += (s1 * 0.7 + s2 * 0.4) * vec3(1.0, 0.97, 0.92) * (0.3 + 0.5 * uAmb + 0.25 * uPow) + edgeG * 0.15 * mix(uLiquid, vec3(1.0), 0.4) * (0.4 + uPow);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createLava(ctx) {
  const { lights: { bulb }, env, glowTex, poolTex, lampPos, reduced } = ctx;
  const root = new Group();
  const world = new Group();

  const metal = new MeshStandardMaterial({ color: '#9ea1a8', metalness: 0.92, roughness: 0.3, flatShading: false, envMap: env, envMapIntensity: 1.6 });
  const base = new Mesh(lathe([[0, 0], [0.056, 0], [0.058, 0.006], [0.053, 0.02], [0.044, 0.045], [0.038, 0.075], [0.0365, 0.098], [0.0405, 0.118], [0.046, 0.135]], { div: 6, seg: 56 }), metal);
  const cap = new Mesh(lathe([[0.034, 0], [0.0365, 0.004], [0.0365, 0.012], [0.0335, 0.026], [0.0265, 0.04], [0.0165, 0.05], [0.007, 0.0555], [0, 0.057]], { div: 6, seg: 48 }), metal);
  cap.position.y = 0.285;

  const HB = 0.15, R0 = 0.046, R1 = 0.034;
  const uCam = { value: new Vector3() };
  const uB = { value: Array.from({ length: NB }, () => new Vector4()) };
  const U = {
    uCam, uB, uSteps: { value: 72 }, uPow: { value: 0 }, uAmb: { value: 0 },
    uLiquid: { value: new Color() }, uWax: { value: new Color() }, uHi: { value: new Color() },
    uY0: { value: -HB / 2 }, uY1: { value: HB / 2 }, uR0: { value: R0 }, uR1: { value: R1 }, uPool: { value: -HB / 2 + 0.014 },
  };
  const bottleMat = new ShaderMaterial({ uniforms: U, vertexShader: BOTTLE_VERT, fragmentShader: BOTTLE_FRAG });
  const bottle = new Mesh(new CylinderGeometry(R1, R0, HB, 40, 1, false), bottleMat);
  bottle.position.y = 0.135 + HB / 2;
  bottle.onBeforeRender = (r, s, cam) => { uCam.value.copy(cam.position); bottle.worldToLocal(uCam.value); };
  root.add(base, bottle, cap);

  // extras
  const pool = makeDecal(poolTex, 0.62, 0.4);
  pool.position.set(lampPos.x, TABLE_TOP + 0.003, lampPos.z + 0.02);
  const halo = createHalo();
  halo.mesh.position.set(lampPos.x, TABLE_TOP + 0.3, WALL_Z + 0.006);
  halo.mesh.scale.set(1.25, 1.35, 1);
  const bloom = makeSprite(glowTex, 0.62);
  bloom.position.set(lampPos.x, TABLE_TOP + 0.2, lampPos.z - 0.04);
  world.add(pool, halo.mesh, bloom);

  const Lv = {
    key: 'rojo', started: false, heat: 0, quality: 1,
    liq: new Color(VARIANTS.rojo.liquid), liqT: new Color(VARIANTS.rojo.liquid),
    wax: new Color(VARIANTS.rojo.wax), waxT: new Color(VARIANTS.rojo.wax),
    hi: new Color(VARIANTS.rojo.hi), hiT: new Color(VARIANTS.rojo.hi),
    light: new Color(VARIANTS.rojo.light), lightT: new Color(VARIANTS.rojo.light),
  };
  const tmpC = new Color();
  const wp = new Vector3();
  const cols = ['liq', 'wax', 'hi', 'light'];

  function setVariant(k, v) {
    if (k !== 'lavaColor' || !VARIANTS[v]) return;
    Lv.key = v;
    const V = VARIANTS[v];
    Lv.liqT.set(V.liquid); Lv.waxT.set(V.wax); Lv.hiT.set(V.hi); Lv.lightT.set(V.light);
    if (reduced || !Lv.started) cols.forEach((c) => Lv[c].copy(Lv[c + 'T']));
  }
  function setLamp() {
    Lv.started = true;
    cols.forEach((c) => { if (reduced) Lv[c].copy(Lv[c + 'T']); });
  }

  function blobs(t, heat) {
    const y0 = U.uY0.value, y1 = U.uY1.value;
    for (let i = 0; i < NB; i++) {
      let s = 0.5 - 0.5 * Math.cos(t * SP[i] + PH[i]);
      s = s * s * (3 - 2 * s);
      const yb = y0 + 0.017, yt = y1 - 0.022;
      const y = MathUtils.lerp(yb, MathUtils.lerp(yb, yt, s), heat);
      const r = RR[i] * (0.86 + 0.34 * (1 - s)) * (0.8 + 0.2 * heat);
      const ang = t * 0.12 + PH[i] * 2;
      const Rh = MathUtils.lerp(R0, R1, (y - y0) / (y1 - y0)) - r;
      const sw = Math.sin(t * 0.07 + PH[i]);
      const rad = Rh * 0.55 * (0.3 + 0.7 * sw * sw) * heat;
      uB.value[i].set(rad * Math.cos(ang), y, rad * Math.sin(ang), r);
    }
    U.uPool.value = y0 + 0.014 + 0.007 * heat;
  }

  function update(dt, t, st) {
    const L = st.L;
    const on = L > 0.002;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5);
    let diff = 0;
    cols.forEach((c) => {
      const a = Lv[c], b = Lv[c + 'T'];
      diff += Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
      a.lerp(b, k);
    });
    // la cera tarda en calentarse: sube con el nivel de luz, pero más lento
    const hk = reduced ? 1 : 1 - Math.exp(-dt * (L > Lv.heat ? 1.6 : 0.9));
    Lv.heat += (L - Lv.heat) * hk;
    if (Math.abs(L - Lv.heat) < 0.002) Lv.heat = L;
    blobs(t, MathUtils.smoothstep(Lv.heat, 0, 1));
    const vis = 1 - 0.5 * st.amb;
    U.uPow.value = 0.1 + 0.9 * L;
    U.uAmb.value = st.amb;
    U.uSteps.value = Lv.quality > 0 ? 72 : 36;
    U.uLiquid.value.copy(Lv.liq);
    U.uWax.value.copy(Lv.wax);
    U.uHi.value.copy(Lv.hi);

    wp.set(lampPos.x, lampPos.y + 0.17, lampPos.z + 0.03);
    bulb.position.copy(wp);
    bulb.color.copy(Lv.light);
    bulb.intensity = 2.6 * L;
    bulb.distance = 4;
    bulb.decay = 1.6;

    pool.visible = on;
    pool.material.opacity = 0.55 * L * vis;
    pool.material.color.copy(Lv.light);
    halo.mesh.visible = on;
    for (let i = 0; i < 6; i++) halo.pal[i].copy(Lv.light).multiplyScalar([1.0, 0.72, 0.44, 0.22, 0.08, 0.0][i]);
    halo.mat.uniforms.uIntensity.value = 0.55 * L * vis;
    bloom.visible = on;
    bloom.material.opacity = 0.55 * L * vis;
    bloom.material.color.copy(Lv.light);

    kit.dust.copy(tmpC.copy(Lv.light).lerp(Lv.hi, 0.5));
    kit.dustOpacity = 0.55 * L;
    return diff > 0.003 || Lv.heat !== L;
  }

  const kit = {
    id: 'lava', root, world, animated: true, usesDim: true,
    dust: new Color('#ffc080'), dustOpacity: 0,
    setLamp, setVariant, setAngle() {},
    setQuality(q) { Lv.quality = q; },
    update,
    dispose() { [metal, bottleMat, pool.material, halo.mat, bloom.material].forEach((m) => m.dispose()); },
  };
  return kit;
}
