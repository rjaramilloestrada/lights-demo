// Visor 3D "Prueba la luz". Se carga con import() dinámico (ver src/viewer-ui.js).
// Núcleo: cuarto low-poly, cámara/órbita, luces base, polvo y loop con render bajo demanda.
// Cada lámpara vive en un "kit" (src/three/lamps/*) que se crea la primera vez que se elige.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, ACESFilmicToneMapping, SRGBColorSpace,
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, ConeGeometry, OctahedronGeometry,
  SphereGeometry, CircleGeometry, Vector3, MathUtils, MeshStandardMaterial, MeshBasicMaterial, AdditiveBlending,
  HemisphereLight, DirectionalLight, SpotLight, PointLight,
  Points, BufferGeometry, Float32BufferAttribute, PointsMaterial,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WALL_Z, TABLE_TOP, LAMP_POS, std, glowTexture, shadowTexture, poolTexture, posterTexture, makeEnv } from './common.js';
import { createProjector } from './lamps/projector.js';
import { createWater } from './lamps/water.js';
import { createLava } from './lamps/lava.js';
import { createGlow } from './lamps/glow.js';

const FACTORY = { projector: createProjector, water: createWater, lava: createLava, glow: createGlow };
// encuadre por lámpara: k acerca la cámara (ancho), v = alto mínimo visible en metros, (tx, ty) = punto al que mira
const FOCUS = {
  sunset: { k: 1, v: 0, tx: 0.12, ty: 1.12 }, aura: { k: 1, v: 0, tx: 0.12, ty: 1.12 },
  mushroom: { k: 0.27, v: 0.66, tx: 0.2, ty: 0.89 }, water: { k: 0.27, v: 0.66, tx: 0.2, ty: 0.92 }, lava: { k: 0.3, v: 0.92, tx: 0.2, ty: 0.99 },
  donut: { k: 0.34, v: 0.82, tx: 0.2, ty: 0.94 }, fungi: { k: 0.28, v: 0.74, tx: 0.2, ty: 0.92 },
};
const KIT_OF = { sunset: 'projector', aura: 'projector', water: 'water', lava: 'lava', mushroom: 'glow', donut: 'glow', fungi: 'glow' };

const NIGHT = { hemiSky: new Color(0x4b5a9a), hemiGround: new Color(0x20141c), clear: new Color(0x07070c) };
const DAY = { hemiSky: new Color(0xfff1e0), hemiGround: new Color(0x8b7b70), clear: new Color(0x2a2638) };

export async function createViewer({ host, reduced = false, lamp = 'sunset', on = false, angle = 45, variants = {}, dim = 0.85 }) {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('webgl');
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x07070c, 1);
  host.appendChild(renderer.domElement);
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  const scene = new Scene();
  scene.fog = new Fog(0x07070c, 6, 13);

  const camera = new PerspectiveCamera(38, 1, 0.1, 40);
  const target = new Vector3(0.12, 1.12, -1.2);

  // ---------- Cuarto ----------
  const room = new Group();
  scene.add(room);

  const wallMat = std('#4a4163', { roughness: 1, flatShading: false });
  const backWall = new Mesh(new PlaneGeometry(12, 3.4), wallMat);
  backWall.position.set(0, 1.7, WALL_Z);
  room.add(backWall);

  const sideWall = new Mesh(new PlaneGeometry(7, 3.4), std('#3d3556', { roughness: 1, flatShading: false }));
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-2.3, 1.7, 1.9);
  room.add(sideWall);

  const ceiling = new Mesh(new PlaneGeometry(12, 9), std('#2b2542', { roughness: 1, flatShading: false }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 3.4, 1.2);
  room.add(ceiling);

  const floor = new Mesh(new PlaneGeometry(12, 9), std('#5a4034', { roughness: 0.85, flatShading: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 1.2);
  room.add(floor);
  // tablones low-poly
  for (let i = -5; i <= 5; i++) {
    const line = new Mesh(new BoxGeometry(0.012, 0.002, 9), std('#2c1d18'));
    line.position.set(i * 0.55 + 0.1, 0.001, 1.2);
    room.add(line);
  }

  const base = new Mesh(new BoxGeometry(12, 0.14, 0.04), std('#251d38'));
  base.position.set(0, 0.07, WALL_Z + 0.02);
  room.add(base);
  const base2 = new Mesh(new BoxGeometry(0.04, 0.14, 7), std('#251d38'));
  base2.position.set(-2.28, 0.07, 1.9);
  room.add(base2);

  // alfombra octagonal
  const rug = new Mesh(new CircleGeometry(1.0, 8), std('#4d2a45', { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.rotation.z = Math.PI / 8;
  rug.position.set(0.1, 0.004, -0.1);
  room.add(rug);
  const rug2 = new Mesh(new CircleGeometry(0.62, 8), std('#8a5a3c', { roughness: 1 }));
  rug2.rotation.x = -Math.PI / 2;
  rug2.rotation.z = Math.PI / 8;
  rug2.position.set(0.1, 0.006, -0.1);
  room.add(rug2);

  // mesita de noche
  const table = new Group();
  table.position.set(0.2, 0, -1.2);
  room.add(table);
  const walnut = '#6b4a36';
  const body = new Mesh(new BoxGeometry(0.9, 0.46, 0.46), std(walnut));
  body.position.y = 0.35;
  table.add(body);
  const top = new Mesh(new BoxGeometry(1.0, 0.04, 0.54), std('#8a6247', { roughness: 0.6 }));
  top.position.y = TABLE_TOP - 0.02;
  table.add(top);
  const drawer = new Mesh(new BoxGeometry(0.76, 0.3, 0.02), std('#523626'));
  drawer.position.set(0, 0.37, 0.235);
  table.add(drawer);
  const knob = new Mesh(new SphereGeometry(0.025, 6, 4), std('#d9b36b', { metalness: 0.6, roughness: 0.4 }));
  knob.position.set(0, 0.37, 0.265);
  table.add(knob);
  [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]].forEach(([x, z]) => {
    const leg = new Mesh(new CylinderGeometry(0.03, 0.02, 0.12, 4), std('#3a281d'));
    leg.position.set(x, 0.06, z);
    leg.rotation.y = Math.PI / 4;
    table.add(leg);
  });
  // libros y taza
  const bookA = new Mesh(new BoxGeometry(0.2, 0.035, 0.15), std('#2c4a7a'));
  bookA.position.set(-0.3, TABLE_TOP + 0.018, -0.05);
  bookA.rotation.y = 0.2;
  const bookB = new Mesh(new BoxGeometry(0.17, 0.03, 0.13), std('#c04a3a'));
  bookB.position.set(-0.3, TABLE_TOP + 0.05, -0.05);
  bookB.rotation.y = -0.15;
  const mug = new Mesh(new CylinderGeometry(0.04, 0.035, 0.08, 8), std('#e8dcc2', { roughness: 0.5 }));
  mug.position.set(-0.32, TABLE_TOP + 0.105, -0.05);
  table.add(bookA, bookB, mug);

  // planta low-poly
  const plant = new Group();
  plant.position.set(-0.95, 0, -1.15);
  room.add(plant);
  const pot = new Mesh(new CylinderGeometry(0.2, 0.14, 0.34, 6), std('#b3532f'));
  pot.position.y = 0.17;
  plant.add(pot);
  const soil = new Mesh(new CylinderGeometry(0.19, 0.19, 0.02, 6), std('#2a1c14'));
  soil.position.y = 0.34;
  plant.add(soil);
  const greens = ['#2f7d4a', '#3f9a58', '#256b3f', '#4aa862'];
  for (let i = 0; i < 9; i++) {
    const leaf = new Mesh(new OctahedronGeometry(0.2, 0), std(greens[i % 4]));
    const a = (i / 9) * Math.PI * 2 + 0.3;
    leaf.scale.set(0.45, 1.6 + (i % 3) * 0.35, 0.12);
    const h = 0.62 + (i % 3) * 0.16;
    leaf.position.set(Math.cos(a) * 0.12, h, Math.sin(a) * 0.12);
    leaf.rotation.set(Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5);
    plant.add(leaf);
  }
  const stem = new Mesh(new ConeGeometry(0.05, 0.36, 5), std('#2a7442'));
  stem.position.y = 0.52;
  plant.add(stem);

  // póster
  const posterFrame = new Mesh(new BoxGeometry(0.62, 0.84, 0.03), std('#17131f'));
  posterFrame.position.set(-0.78, 1.55, WALL_Z + 0.015);
  room.add(posterFrame);
  const art = new Mesh(new PlaneGeometry(0.54, 0.76), new MeshStandardMaterial({ map: posterTexture(), roughness: 0.8 }));
  art.position.set(-0.78, 1.55, WALL_Z + 0.032);
  room.add(art);

  // sombras falsas
  const shTex = shadowTexture();
  const addShadow = (x, z, w, d, o = 0.7) => {
    const m = new Mesh(new PlaneGeometry(w, d), new MeshBasicMaterial({ map: shTex, transparent: true, opacity: o, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.008, z);
    room.add(m);
  };
  addShadow(0.2, -1.2, 1.5, 1.0, 0.8);
  addShadow(-0.95, -1.15, 0.7, 0.7, 0.8);

  // ---------- Luces compartidas (cantidad fija: evita recompilar shaders al cambiar de lámpara) ----------
  const hemi = new HemisphereLight(0x4b5a9a, 0x20141c, 0.85);
  scene.add(hemi);
  const moon = new DirectionalLight(0x7f95e8, 0.55);
  moon.position.set(-2, 3, 3);
  scene.add(moon);
  const spot = new SpotLight(0xff8a2a, 0, 0, 0.85, 1, 1.4);
  scene.add(spot, spot.target);
  const bulb = new PointLight(0xff8a2a, 0, 3.2, 1.6);
  scene.add(bulb);

  // ---------- Lámparas ----------
  const lampGroup = new Group();
  lampGroup.position.copy(LAMP_POS);
  scene.add(lampGroup);

  const gTex = glowTexture();
  const pTex = poolTexture();
  const env = makeEnv(renderer);
  const ctx = { scene, camera, renderer, reduced, env, glowTex: gTex, poolTex: pTex, lampPos: LAMP_POS, lights: { hemi, moon, spot, bulb } };
  const kits = {};

  // polvo en suspensión
  const N = 70;
  const dustPos = new Float32Array(N * 3);
  const dustSeed = [];
  for (let i = 0; i < N; i++) {
    dustPos[i * 3] = MathUtils.randFloat(-0.7, 1.1);
    dustPos[i * 3 + 1] = MathUtils.randFloat(0.7, 2.1);
    dustPos[i * 3 + 2] = MathUtils.randFloat(-1.55, -0.2);
    dustSeed.push(Math.random() * 6.28);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(dustPos, 3));
  const dustMat = new PointsMaterial({ map: gTex, size: 0.045, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0, color: 0xffc080 });
  const dust = new Points(dustGeo, dustMat);
  scene.add(dust);

  // ---------- Controles ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.55;
  controls.minAzimuthAngle = -0.85;
  controls.maxAzimuthAngle = 0.5;
  controls.minPolarAngle = 1.2;
  controls.maxPolarAngle = 1.66;
  renderer.domElement.style.touchAction = 'pan-y'; // el scroll vertical de la página sigue funcionando

  // ---------- Estado ----------
  const S = {
    lamp, on, angle, dim, level: 0, swap: 1, flash: 0, amb: 0, ambGoal: 0, visible: true, running: false, raf: 0, last: 0, t: 0, dirty: true,
    variants: { temp: 'calida', lavaColor: 'rojo', waterColor: 'ambar', fungiBody: 'blanco', ...variants },
    kit: null, fps: { n: 0, acc: 0, done: false }, w: 1, h: 1,
    focus: { ...FOCUS.sunset }, focusT: { ...FOCUS.sunset },
  };
  const st = { L: 0, level: 0, amb: 0, t: 0 };

  function getKit(id) {
    const name = KIT_OF[id];
    if (!kits[name]) {
      const k = FACTORY[name](ctx);
      k.root.visible = false;
      k.world.visible = false;
      lampGroup.add(k.root);
      scene.add(k.world);
      Object.entries(S.variants).forEach(([key, val]) => k.setVariant(key, val));
      kits[name] = k;
    }
    return kits[name];
  }

  function fitCamera(w, h) {
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = 38;
    camera.updateProjectionMatrix();
    const f = S.focus;
    const span = (aspect < 1 ? 2.3 : aspect < 1.4 ? 2.8 : 3.3) * f.k;
    const tanH = Math.tan(MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(span / 2 / (tanH * aspect), f.v / 2 / tanH);
    target.set(f.tx, f.ty, -1.2);
    const az = 0.2, pol = 1.4;
    // conserva el giro actual del usuario si ya existe, solo ajusta distancia y objetivo
    const dir = camera.position.clone().sub(controls.target);
    controls.target.copy(target);
    if (dir.lengthSq() < 0.01 || !S.fitted) {
      camera.position.set(
        target.x + dist * Math.sin(pol) * Math.sin(az),
        target.y + dist * Math.cos(pol),
        target.z + dist * Math.sin(pol) * Math.cos(az),
      );
    } else {
      dir.setLength(dist);
      camera.position.copy(controls.target).add(dir);
    }
    S.fitted = true;
    controls.minDistance = controls.maxDistance = dist;
    controls.update();
  }

  function pixelRatio() {
    let pr = Math.min(window.devicePixelRatio || 1, 2);
    if (coarse && S.kit && S.kit.animated && S.kit.id !== 'projector') pr = Math.min(pr, S.fps.done ? 1 : 1.5);
    return pr;
  }
  function resize() {
    const w = Math.max(host.clientWidth, 1), h = Math.max(host.clientHeight, 1);
    S.w = w; S.h = h;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    fitCamera(w, h);
    S.dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  function setLampTarget(id) {
    const kit = getKit(id);
    if (S.kit && S.kit !== kit) { S.kit.root.visible = false; S.kit.world.visible = false; }
    const prevLamp = S.lamp;
    S.lamp = id;
    S.kit = kit;
    kit.root.visible = true;
    kit.world.visible = true;
    kit.setLamp(id);
    kit.setAngle(S.angle);
    if (id !== prevLamp || !S.started) { S.swap = reduced || !S.started ? 1 : 0; S.flash = reduced || !S.started ? 0 : 1; }
    Object.assign(S.focusT, FOCUS[id]);
    if (reduced || !S.started) { Object.assign(S.focus, S.focusT); fitCamera(S.w, S.h); }
    S.started = true;
    S.fps.n = 0; S.fps.acc = 0;
    if (renderer.domElement.width) { renderer.setPixelRatio(pixelRatio()); renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false); }
    S.dirty = true;
  }

  const tmpHemi = new Color();
  function applyRoom() {
    const a = S.amb;
    hemi.color.copy(NIGHT.hemiSky).lerp(DAY.hemiSky, a);
    hemi.groundColor.copy(NIGHT.hemiGround).lerp(DAY.hemiGround, a);
    tmpHemi.copy(NIGHT.clear).lerp(DAY.clear, a);
    renderer.setClearColor(tmpHemi, 1);
    scene.fog.color.copy(tmpHemi);
    const L = st.L;
    hemi.intensity = MathUtils.lerp(0.85 - 0.3 * L, 2.1, a);
    moon.intensity = MathUtils.lerp(0.55 - 0.25 * L, 1.7, a);
  }

  function step(dt) {
    S.t += dt;
    let changed = false;
    // nivel de luz con suavizado
    const goal = S.on ? 1 : 0;
    if (Math.abs(goal - S.level) > 0.001) {
      S.level += (goal - S.level) * (reduced ? 1 : 1 - Math.exp(-dt * 4.2));
      if (Math.abs(goal - S.level) <= 0.002) S.level = goal;
      changed = true;
    }
    // modo día / noche del cuarto
    if (Math.abs(S.ambGoal - S.amb) > 0.001) {
      S.amb += (S.ambGoal - S.amb) * (reduced ? 1 : 1 - Math.exp(-dt * 5));
      if (Math.abs(S.ambGoal - S.amb) <= 0.002) S.amb = S.ambGoal;
      changed = true;
    }
    if (S.swap < 1) {
      S.swap = Math.min(1, S.swap + dt * 3);
      const e = 1 - Math.pow(1 - S.swap, 3);
      lampGroup.scale.setScalar(0.85 + 0.15 * e);
      lampGroup.position.y = LAMP_POS.y + (1 - e) * 0.04;
      changed = true;
    }
    {
      const f = S.focus, g = S.focusT;
      const d = Math.abs(f.k - g.k) + Math.abs(f.v - g.v) + Math.abs(f.tx - g.tx) + Math.abs(f.ty - g.ty);
      if (d > 0.0008) {
        const k = reduced ? 1 : 1 - Math.exp(-dt * 4.5);
        f.k += (g.k - f.k) * k; f.v += (g.v - f.v) * k; f.tx += (g.tx - f.tx) * k; f.ty += (g.ty - f.ty) * k;
        fitCamera(S.w, S.h);
        changed = true;
      } else if (d > 0) { Object.assign(f, g); fitCamera(S.w, S.h); changed = true; }
    }
    if (S.flash > 0) {
      S.flash = Math.max(0, S.flash - dt * 2.4);
      renderer.toneMappingExposure = 1.1 + 0.4 * S.flash * S.flash;
      changed = true;
    }
    const kit = S.kit;
    const lit = S.level > 0.01;
    const anim = !reduced && lit;
    if (changed || anim || S.dirty) {
      const L = kit.usesDim ? S.level * S.dim : S.level;
      st.L = L; st.level = S.level; st.amb = S.amb; st.t = S.t;
      spot.intensity = 0; bulb.intensity = 0; bulb.distance = 3.2; bulb.decay = 1.6;
      if (kit.update(dt, S.t, st)) S.dirty = true;
      applyRoom();
      dustMat.opacity = kit.dustOpacity;
      dustMat.color.copy(kit.dust);
      S.dirty = true;
    }
    if (anim) {
      const p = dustGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        p.array[i * 3 + 1] += Math.sin(S.t * 0.4 + dustSeed[i]) * 0.0006;
        p.array[i * 3] += Math.cos(S.t * 0.3 + dustSeed[i]) * 0.0005;
      }
      p.needsUpdate = true;
      S.dirty = true;
    }
    if (controls.update()) S.dirty = true;
    return anim;
  }

  function frame(now) {
    S.raf = 0;
    if (!S.running) return;
    const dt = Math.min((now - (S.last || now)) / 1000, 0.1);
    S.last = now;
    const anim = step(dt);
    if (S.dirty) { renderer.render(scene, camera); S.dirty = false; }
    // si un kit animado va lento en móvil: baja calidad una sola vez
    if (anim && coarse && S.kit.setQuality && !S.fps.done && dt > 0) {
      S.fps.n++; S.fps.acc += dt;
      if (S.fps.n >= 90) {
        if (S.fps.acc / S.fps.n > 0.045) { S.fps.done = true; S.kit.setQuality(0); resize(); }
        else { S.fps.n = 0; S.fps.acc = 0; }
      }
    }
    S.raf = requestAnimationFrame(frame);
  }
  function start() {
    if (S.running) return;
    S.running = true; S.last = 0;
    S.raf = requestAnimationFrame(frame);
  }
  function stop() { S.running = false; if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0; }
  const syncRun = () => (S.visible && !document.hidden ? start() : stop());
  const io = new IntersectionObserver(([e]) => { S.visible = e.isIntersecting; syncRun(); }, { rootMargin: '120px' });
  io.observe(host);
  document.addEventListener('visibilitychange', syncRun);
  controls.addEventListener('change', () => { S.dirty = true; });

  const onLost = (e) => { e.preventDefault(); stop(); host.dispatchEvent(new CustomEvent('viewer-lost')); };
  renderer.domElement.addEventListener('webglcontextlost', onLost);

  // arranque
  S.on = on;
  S.level = on ? 1 : 0;
  setLampTarget(lamp);
  resize();
  step(0.016);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  start();

  return {
    setLamp(id) { if (id !== S.lamp && KIT_OF[id]) setLampTarget(id); },
    setOn(v) { S.on = !!v; S.dirty = true; },
    setAngle(v) { S.angle = v; S.kit.setAngle(v); S.dirty = true; },
    setDim(v) { S.dim = v; S.dirty = true; },
    setVariant(key, val) {
      S.variants[key] = val;
      Object.values(kits).forEach((k) => k.setVariant(key, val));
      S.dirty = true;
    },
    setRoom(mode) { S.ambGoal = mode === 'day' ? 1 : 0; S.dirty = true; },
    getState() { return { lamp: S.lamp, on: S.on, level: S.level, angle: S.angle, dim: S.dim, amb: S.amb, variants: { ...S.variants } }; },
    dispose() {
      stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', syncRun);
      controls.dispose();
      Object.values(kits).forEach((k) => k.dispose());
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
