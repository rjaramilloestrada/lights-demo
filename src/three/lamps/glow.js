// Kit "glow": Mushroom, Donut y Fungi. Plásticos/metal que iluminan el cuarto desde adentro.
// Luz = PointLight compartida + charco de luz sobre la mesa + resplandor en la pared (halo) + sprite de brillo.
import {
  Group, Mesh, CylinderGeometry, SphereGeometry, TorusGeometry, MeshPhysicalMaterial, MeshStandardMaterial, Color, Vector3,
} from 'three';
import { WALL_Z, TABLE_TOP, createHalo, makeSprite, makeDecal, lathe, latheRaw, shapeEmissive } from '../common.js';

const TEMPS = {
  calida: { light: '#ffa24a', shell: { mushroom: '#ff5200', donut: '#ff6200' } },
  neutra: { light: '#fff0d8', shell: { mushroom: '#ff8a24', donut: '#ff9a2e' } },
  fria: { light: '#a9ceff', shell: { mushroom: '#ffb487', donut: '#ffc396' } },
};

const BODIES = {
  negro: { color: '#0b0b0f', glow: 0.0 },
  rojo: { color: '#e01a14', glow: 0.55 },
  blanco: { color: '#f3f1ec', glow: 1.0 },
};

// Parámetros de luz por lámpara (offsets locales respecto de la mesa)
const DEFS = {
  mushroom: { light: [0, 0.1, -0.1], bulbI: 1.7, shellI: 1.0, pool: [0.78, 0.46], poolO: 0.5, halo: [1.15, 1.0], haloY: 0.2, haloGain: 0.5, spriteY: 0.12, spriteS: 0.9 },
  donut: { light: [0, 0.16, -0.12], bulbI: 2.0, shellI: 1.0, pool: [0.8, 0.5], poolO: 0.5, halo: [1.3, 1.2], haloY: 0.17, haloGain: 0.55, spriteY: 0.16, spriteS: 1.0 },
  fungi: { light: [0, 0.14, -0.07], bulbI: 1.9, shellI: 1.4, pool: [0.8, 0.52], poolO: 0.62, halo: [1.05, 0.9], haloY: 0.17, haloGain: 0.34, spriteY: 0.15, spriteS: 0.75 },
};

export function createGlow(ctx) {
  const { lights: { bulb }, env, glowTex, poolTex, lampPos, reduced } = ctx;
  const root = new Group();
  const world = new Group();

  const G = {
    lamp: 'mushroom', temp: 'calida', body: 'blanco', started: false,
    col: new Color(TEMPS.calida.light), colT: new Color(TEMPS.calida.light),
    shell: new Color(TEMPS.calida.shell.mushroom), shellT: new Color(TEMPS.calida.shell.mushroom),
  };
  const built = {};
  const tmp = new Color();
  const wpos = new Vector3();

  // ---------- Mushroom ----------
  function buildMushroom() {
    const g = new Group();
    const mat = new MeshPhysicalMaterial({
      color: '#c93f00', emissive: '#ff4a00', emissiveIntensity: 0, roughness: 0.16, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, envMap: env, envMapIntensity: 1.0,
    });
    shapeEmissive(mat, { mode: 'y', lo: 0.55, hi: 1.2, y0: 0.03, y1: 0.17, rim: 0.3 });
    const stem = new Mesh(lathe([[0, 0], [0.058, 0], [0.061, 0.005], [0.058, 0.012], [0.046, 0.02], [0.03, 0.036], [0.0235, 0.056], [0.021, 0.074], [0.02, 0.094]], { div: 6, seg: 48 }), mat);
    const cap = new Mesh(lathe([[0.02, 0.094], [0.05, 0.089], [0.088, 0.085], [0.111, 0.089], [0.118, 0.101], [0.114, 0.119], [0.1, 0.139], [0.076, 0.157], [0.046, 0.169], [0.023, 0.173], [0.012, 0.17], [0, 0.166]], { div: 6, seg: 64 }), mat);
    g.add(stem, cap);
    return { group: g, mats: [mat], shell: [mat] };
  }

  // ---------- Donut ----------
  function buildDonut() {
    const g = new Group();
    g.position.y = 0.152;
    g.rotation.y = 0.16;
    const mat = new MeshPhysicalMaterial({
      color: '#c64200', emissive: '#ff5a00', emissiveIntensity: 0, roughness: 0.14, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, envMap: env, envMapIntensity: 0.9,
    });
    shapeEmissive(mat, { mode: 'radial', lo: 1.2, hi: 0.85, y0: 0.036, y1: 0.15, rim: 0.25 });
    const shell = new Mesh(lathe([[0, -0.034], [0.06, -0.034], [0.12, -0.03], [0.142, -0.018], [0.15, 0], [0.143, 0.018], [0.125, 0.031], [0.09, 0.036], [0.056, 0.036], [0.041, 0.031], [0.035, 0.022]], { div: 7, seg: 72 }), mat);
    shell.rotation.x = Math.PI / 2;
    const chromeMat = new MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.06, envMap: env, envMapIntensity: 1.7, flatShading: false });
    const chrome = new Mesh(new SphereGeometry(0.037, 40, 24), chromeMat);
    chrome.scale.z = 0.42;
    chrome.position.z = 0.012;
    const bezelMat = new MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff6a00', emissiveIntensity: 0, roughness: 0.3, flatShading: false });
    const bezel = new Mesh(new TorusGeometry(0.0385, 0.0048, 14, 56), bezelMat);
    bezel.position.z = 0.024;
    const foot = new Mesh(new CylinderGeometry(0.03, 0.035, 0.012, 16), new MeshStandardMaterial({ color: '#16161c', roughness: 0.6, flatShading: false }));
    foot.position.y = -0.15;
    g.add(shell, chrome, bezel, foot);
    return { group: g, mats: [mat, chromeMat, bezelMat], shell: [mat], bezel: bezelMat };
  }

  // ---------- Fungi ----------
  function buildFungi() {
    const g = new Group();
    const capMat = new MeshPhysicalMaterial({ color: '#f3f1ec', metalness: 0.35, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.04, envMap: env, envMapIntensity: 1.35 });
    const stemMat = new MeshPhysicalMaterial({
      color: '#f3f1ec', emissive: '#ffa24a', emissiveIntensity: 0, metalness: 0.1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, envMap: env, envMapIntensity: 1.2,
    });
    shapeEmissive(stemMat, { mode: 'y', lo: 0.1, hi: 1.3, y0: -0.0775, y1: 0.0775, rim: 0 });
    const stem = new Mesh(new CylinderGeometry(0.039, 0.039, 0.155, 48, 1), stemMat);
    stem.position.y = 0.0775;
    const cap = new Mesh(latheRaw([
      [0, 0], [0.08, 0], [0.0885, 0.003], [0.0905, 0.012], [0.09, 0.03], [0.086, 0.05], [0.075, 0.067], [0.057, 0.079], [0.033, 0.0855], [0.012, 0.0875], [0, 0.088],
    ], 64), capMat);
    cap.position.y = 0.15;
    const studMat = new MeshStandardMaterial({ color: '#d8d8de', metalness: 1, roughness: 0.18, envMap: env, envMapIntensity: 1.3, flatShading: false });
    const stud = new Mesh(new SphereGeometry(0.0065, 14, 10), studMat);
    stud.position.set(0, 0.04, 0.039);
    g.add(stem, cap, stud);
    return { group: g, mats: [capMat, stemMat, studMat], capMat, stemMat };
  }

  const builders = { mushroom: buildMushroom, donut: buildDonut, fungi: buildFungi };

  // ---------- Extras de mundo ----------
  const pool = makeDecal(poolTex, 0.8, 0.5);
  pool.position.set(lampPos.x, TABLE_TOP + 0.003, lampPos.z + 0.03);
  const halo = createHalo();
  halo.mesh.position.set(lampPos.x, 0.95, WALL_Z + 0.006);
  const bloom = makeSprite(glowTex, 0.9);
  world.add(pool, halo.mesh, bloom);

  function applyTemp() {
    const T = TEMPS[G.temp];
    G.colT.set(T.light);
    G.shellT.set(T.shell[G.lamp] || T.shell.mushroom);
    if (reduced) { G.col.copy(G.colT); G.shell.copy(G.shellT); }
  }
  function applyBody() {
    const b = built.fungi;
    if (!b) return;
    const B = BODIES[G.body];
    b.capMat.color.set(B.color);
    b.stemMat.color.set(B.color);
  }

  function setLamp(id) {
    G.lamp = id;
    if (!built[id]) {
      built[id] = builders[id]();
      built[id].group.visible = false;
      root.add(built[id].group);
      if (id === 'fungi') applyBody();
    }
    Object.keys(built).forEach((k) => { built[k].group.visible = k === id; });
    const d = DEFS[id];
    pool.scale.set(d.pool[0], d.pool[1], 1);
    halo.mesh.scale.set(d.halo[0], d.halo[1], 1);
    halo.mesh.position.set(lampPos.x, TABLE_TOP + d.haloY, WALL_Z + 0.006);
    bloom.scale.set(d.spriteS, d.spriteS, 1);
    bloom.position.set(lampPos.x, TABLE_TOP + d.spriteY, lampPos.z - 0.07);
    applyTemp();
    if (!G.started || reduced) { G.col.copy(G.colT); G.shell.copy(G.shellT); }
    G.started = true;
  }

  function setVariant(key, val) {
    if (key === 'temp' && TEMPS[val]) { G.temp = val; applyTemp(); }
    if (key === 'fungiBody' && BODIES[val]) { G.body = val; applyBody(); }
  }

  function update(dt, t, st) {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5);
    const b = built[G.lamp];
    if (!b) return false;
    let diff = Math.abs(G.col.r - G.colT.r) + Math.abs(G.col.g - G.colT.g) + Math.abs(G.col.b - G.colT.b);
    diff += Math.abs(G.shell.r - G.shellT.r) + Math.abs(G.shell.g - G.shellT.g) + Math.abs(G.shell.b - G.shellT.b);
    const busy = diff > 0.003;
    if (busy) { G.col.lerp(G.colT, k); G.shell.lerp(G.shellT, k); } else { G.col.copy(G.colT); G.shell.copy(G.shellT); }

    const L = st.L;
    const vis = 1 - 0.5 * st.amb;
    const d = DEFS[G.lamp];
    const on = L > 0.002;

    // luz real
    wpos.set(lampPos.x + d.light[0], lampPos.y + d.light[1], lampPos.z + d.light[2]);
    bulb.position.copy(wpos);
    bulb.color.copy(G.col);
    bulb.intensity = d.bulbI * L;
    bulb.distance = 4.2;
    bulb.decay = 1.7;

    // materiales
    if (G.lamp === 'fungi') {
      const B = BODIES[G.body];
      tmp.copy(G.col).multiply(b.stemMat.color).multiplyScalar(1.1);
      b.stemMat.emissive.copy(tmp);
      b.stemMat.emissiveIntensity = d.shellI * L * B.glow * 1.5;
      // el fondo blanco lava el negro: el cuerpo negro solo recibe brillo bajo la tapa
    } else {
      b.shell.forEach((m) => { m.emissive.copy(G.shell); m.emissiveIntensity = d.shellI * L; });
      if (b.bezel) { b.bezel.emissive.copy(G.shell); b.bezel.emissiveIntensity = 1.6 * L; }
    }

    // charco en la mesa, halo en la pared y brillo
    pool.visible = on;
    pool.material.opacity = d.poolO * L * vis;
    pool.material.color.copy(G.col);
    halo.mesh.visible = on;
    for (let i = 0; i < 6; i++) {
      const f = [1.0, 0.74, 0.46, 0.22, 0.08, 0.0][i];
      halo.pal[i].copy(G.col).multiplyScalar(f);
    }
    halo.mat.uniforms.uIntensity.value = L * d.haloGain * vis;
    halo.mat.uniforms.uTime.value = t;
    bloom.visible = on;
    bloom.material.opacity = 0.5 * L * vis;
    bloom.material.color.copy(G.lamp === 'fungi' ? G.col : G.shell).lerp(G.col, G.lamp === 'fungi' ? 0 : 0.35);

    kit.dust.copy(G.col);
    kit.dustOpacity = 0.6 * L;
    return busy;
  }

  const kit = {
    id: 'glow', root, world, animated: false, usesDim: true,
    dust: new Color('#ffc080'), dustOpacity: 0,
    setLamp, setVariant, setAngle() {},
    update,
    dispose() {
      Object.values(built).forEach((b) => b.mats.forEach((m) => m.dispose()));
      pool.material.dispose(); halo.mat.dispose(); bloom.material.dispose();
    },
  };
  return kit;
}
