// Visor 3D "Prueba la luz". Se carga con import() dinámico (ver src/viewer-ui.js).
// Cuarto low-poly + lámpara Sunset / Aura + halo proyectado en la pared (ShaderMaterial).
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, ACESFilmicToneMapping, SRGBColorSpace,
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, ConeGeometry, OctahedronGeometry,
  SphereGeometry, CircleGeometry, TubeGeometry, CatmullRomCurve3, Vector3, MathUtils,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, AdditiveBlending, NormalBlending, DoubleSide,
  HemisphereLight, DirectionalLight, SpotLight, PointLight, Sprite, SpriteMaterial, CanvasTexture,
  Points, BufferGeometry, Float32BufferAttribute, PointsMaterial,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WALL_Z = -1.6;
const TABLE_TOP = 0.62;
const LAMP_POS = new Vector3(0.22, TABLE_TOP, -1.2);
const HALO_R = 1.0; // radio del halo en metros

const PALETTES = {
  sunset: {
    stops: ['#ffe27a', '#ffc23a', '#ff8f1a', '#f4521b', '#c4122f', '#5e0a52'],
    light: '#ff8a2a', glow: '#ffa040', bands: 0, gain: 1,
  },
  aura: {
    stops: ['#00f0b0', '#00b4ec', '#3a5cff', '#9438ff', '#ff3aa8', '#ff6a5a'],
    light: '#a470ff', glow: '#b78cff', bands: 1, gain: 0.72,
  },
};

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

const BEAM_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vP; varying float vT;
void main() {
  vT = uv.y;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vP = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity;
varying vec3 vN; varying vec3 vP; varying float vT;
void main() {
  float fres = pow(abs(dot(normalize(vN), normalize(-vP))), 1.6);
  float a = uOpacity * fres * mix(0.55, 0.12, vT);
  gl_FragColor = vec4(uColor, a);
}`;

function glowTexture() {
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

function shadowTexture() {
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

function posterTexture() {
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

const std = (color, o = {}) => new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...o });

export async function createViewer({ host, reduced = false, lamp = 'sunset', on = false, angle = 45 }) {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('webgl');
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x07070c, 1);
  host.appendChild(renderer.domElement);

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

  // ---------- Lámparas ----------
  const blackMat = new MeshStandardMaterial({ color: '#0c0c10', roughness: 0.38, metalness: 0.55, flatShading: false });
  const lampGroup = new Group();
  lampGroup.position.copy(LAMP_POS);
  scene.add(lampGroup);
  const lensMat = new MeshBasicMaterial({ color: '#2a1a10', toneMapped: false });
  const lensMat2 = new MeshBasicMaterial({ color: '#1a1030', toneMapped: false });

  // Sunset: cabeza cuadrada negra en soporte
  const sunset = new Group();
  const sBase = new Mesh(new CylinderGeometry(0.06, 0.07, 0.018, 20), blackMat);
  sBase.position.y = 0.009;
  const sStem = new Mesh(new CylinderGeometry(0.008, 0.008, 0.17, 8), blackMat);
  sStem.position.y = 0.1;
  const sHinge = new Mesh(new CylinderGeometry(0.014, 0.014, 0.05, 10), blackMat);
  sHinge.rotation.z = Math.PI / 2;
  sHinge.position.y = 0.185;
  const sHeadPivot = new Group();
  sHeadPivot.position.set(0, 0.185, 0);
  const sHead = new Mesh(new BoxGeometry(0.1, 0.1, 0.05), blackMat);
  sHead.position.z = -0.015;
  const sLens = new Mesh(new CylinderGeometry(0.03, 0.03, 0.006, 20), lensMat);
  sLens.rotation.x = Math.PI / 2;
  sLens.position.z = -0.042;
  sHeadPivot.add(sHead, sLens);
  sunset.add(sBase, sStem, sHinge, sHeadPivot);

  // Aura: cabeza redonda negra en cuello de cisne y base redonda
  const aura = new Group();
  const aBase = new Mesh(new CylinderGeometry(0.075, 0.085, 0.018, 28), blackMat);
  aBase.position.y = 0.009;
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0.01, 0), new Vector3(0, 0.07, 0.012), new Vector3(0, 0.14, -0.012), new Vector3(0, 0.2, 0.004), new Vector3(0, 0.25, -0.02),
  ]);
  const aNeck = new Mesh(new TubeGeometry(curve, 28, 0.0085, 8, false), blackMat);
  const aHeadPivot = new Group();
  aHeadPivot.position.set(0, 0.255, -0.02);
  const aHead = new Mesh(new CylinderGeometry(0.068, 0.068, 0.016, 32), blackMat);
  aHead.rotation.x = -Math.PI / 2;
  const aLens = new Mesh(new CylinderGeometry(0.045, 0.045, 0.004, 28), lensMat2);
  aLens.rotation.x = -Math.PI / 2;
  aLens.position.z = -0.0095;
  aHeadPivot.add(aHead, aLens);
  aura.add(aBase, aNeck, aHeadPivot);

  lampGroup.add(sunset, aura);

  // ---------- Luces ----------
  const hemi = new HemisphereLight(0x4b5a9a, 0x20141c, 0.85);
  scene.add(hemi);
  const moon = new DirectionalLight(0x7f95e8, 0.55);
  moon.position.set(-2, 3, 3);
  scene.add(moon);
  const spot = new SpotLight(0xff8a2a, 0, 0, 0.85, 1, 1.4);
  scene.add(spot, spot.target);
  const bulb = new PointLight(0xff8a2a, 0, 3.2, 1.6);
  scene.add(bulb);

  // halo en la pared
  const palCols = Array.from({ length: 6 }, () => new Color());
  const haloMat = new ShaderMaterial({
    uniforms: {
      uC: { value: palCols },
      uIntensity: { value: 0 },
      uTime: { value: 0 },
      uBands: { value: 0 },
    },
    vertexShader: HALO_VERT,
    fragmentShader: HALO_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const halo = new Mesh(new PlaneGeometry(4, 4), haloMat);
  halo.position.set(LAMP_POS.x, 1.6, WALL_Z + 0.006);
  halo.renderOrder = 2;
  scene.add(halo);

  // haz volumétrico falso
  const beamGeo = new CylinderGeometry(1, 0.035, 1, 40, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, 0.5);
  const beamMat = new ShaderMaterial({
    uniforms: { uColor: { value: new Color('#ff9a40') }, uOpacity: { value: 0 } },
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  });
  const beam = new Mesh(beamGeo, beamMat);
  beam.renderOrder = 3;
  scene.add(beam);

  // brillo tipo bloom con sprites aditivos
  const gTex = glowTexture();
  const mkSprite = (size) => {
    const s = new Sprite(new SpriteMaterial({ map: gTex, color: 0xffffff, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
    s.scale.set(size, size, 1);
    s.renderOrder = 4;
    scene.add(s);
    return s;
  };
  const lensGlow = mkSprite(0.45);

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
    lamp, on, angle, level: 0, swap: 1, visible: true, running: false, raf: 0, last: 0, t: 0, dirty: true,
    pal: PALETTES[lamp].stops.map((h) => new Color(h)),
    lightCol: new Color(PALETTES[lamp].light),
    glowCol: new Color(PALETTES[lamp].glow),
    bands: PALETTES[lamp].bands,
    gain: PALETTES[lamp].gain,
  };
  const tmp = new Color();
  const headWorld = new Vector3();
  const haloCenter = new Vector3();

  function fitCamera(w, h) {
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = 38;
    camera.updateProjectionMatrix();
    const span = aspect < 1 ? 2.3 : aspect < 1.4 ? 2.8 : 3.3;
    const dist = span / 2 / (Math.tan(MathUtils.degToRad(camera.fov / 2)) * aspect);
    const az = 0.2, pol = 1.4;
    const prev = controls.getDistance ? controls.getDistance() : dist;
    // conserva el giro actual del usuario si ya existe, solo ajusta la distancia
    const dir = camera.position.clone().sub(controls.target);
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
    return prev;
  }

  function resize() {
    const w = Math.max(host.clientWidth, 1), h = Math.max(host.clientHeight, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    fitCamera(w, h);
    S.dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  function applyLamp() {
    sunset.visible = S.lamp === 'sunset';
    aura.visible = S.lamp === 'aura';
    haloMat.uniforms.uBands.value = S.bands;
  }
  function headObject() { return S.lamp === 'sunset' ? sHeadPivot : aHeadPivot; }

  function applyAngle() {
    const rad = MathUtils.degToRad(S.angle);
    sHeadPivot.rotation.x = rad;
    aHeadPivot.rotation.x = rad;
    lampGroup.updateMatrixWorld(true);
    const head = headObject();
    head.getWorldPosition(headWorld);
    const d = headWorld.z - WALL_Z;
    const cy = headWorld.y + d * Math.tan(rad);
    haloCenter.set(headWorld.x, Math.min(cy, 2.95), WALL_Z);
    halo.position.set(haloCenter.x, haloCenter.y, WALL_Z + 0.006);
    const stretch = 1 + (S.angle - 15) / 60 * 0.22;
    halo.scale.set(HALO_R, HALO_R * stretch, 1);
    spot.position.copy(headWorld);
    spot.target.position.copy(haloCenter);
    spot.target.updateMatrixWorld();
    bulb.position.copy(headWorld).add(new Vector3(0, 0.08, 0.1));
    // haz: del cabezal al centro del halo
    const len = headWorld.distanceTo(haloCenter);
    beam.position.copy(headWorld);
    beam.lookAt(haloCenter);
    beam.scale.set(0.2, 0.2, len * 0.8);
    // brillo del lente
    const front = new Vector3(0, 0, -0.045).applyMatrix4(head.matrixWorld);
    lensGlow.position.copy(front);
    S.dirty = true;
  }

  function applyLevel() {
    const L = S.level;
    const on_ = L > 0.002;
    haloMat.uniforms.uIntensity.value = L * 0.95 * S.gain;
    halo.visible = on_;
    lensGlow.visible = on_;
    lensGlow.material.opacity = 0.95 * L;
    lensGlow.material.color.copy(S.glowCol);
    beam.visible = on_;
    beamMat.uniforms.uOpacity.value = 0.55 * L;
    beamMat.uniforms.uColor.value.copy(S.glowCol);
    spot.intensity = 7.5 * L;
    spot.color.copy(S.lightCol);
    bulb.intensity = 1.5 * L;
    bulb.color.copy(S.lightCol);
    dustMat.opacity = 0.75 * L;
    dustMat.color.copy(S.glowCol);
    hemi.intensity = 0.85 - 0.3 * L;
    moon.intensity = 0.55 - 0.25 * L;
    const lens = S.lamp === 'sunset' ? lensMat : lensMat2;
    tmp.set(S.lamp === 'sunset' ? '#2a1a10' : '#1a1030');
    lens.color.copy(tmp).lerp(S.glowCol.clone().multiplyScalar(1.6), L);
    S.dirty = true;
  }

  function setLampTarget(id) {
    S.lamp = id;
    S.swap = reduced ? 1 : 0;
    S.bands = PALETTES[id].bands;
    S.palTarget = PALETTES[id].stops.map((h) => new Color(h));
    S.lightTarget = new Color(PALETTES[id].light);
    S.glowTarget = new Color(PALETTES[id].glow);
    S.gainTarget = PALETTES[id].gain;
    if (reduced) {
      S.gain = S.gainTarget;
      S.pal.forEach((c, i) => c.copy(S.palTarget[i]));
      S.lightCol.copy(S.lightTarget);
      S.glowCol.copy(S.glowTarget);
    }
    applyLamp();
    applyAngle();
    applyLevel();
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
    // transición de paleta
    if (S.palTarget) {
      const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
      let diff = 0;
      S.pal.forEach((c, i) => { c.lerp(S.palTarget[i], k); diff += Math.abs(c.r - S.palTarget[i].r) + Math.abs(c.g - S.palTarget[i].g) + Math.abs(c.b - S.palTarget[i].b); });
      S.lightCol.lerp(S.lightTarget, k);
      S.glowCol.lerp(S.glowTarget, k);
      S.gain += (S.gainTarget - S.gain) * k;
      diff += Math.abs(S.gainTarget - S.gain);
      if (diff < 0.002) { S.palTarget = null; S.gain = S.gainTarget; }
      changed = true;
    }
    if (S.swap < 1) {
      S.swap = Math.min(1, S.swap + dt * 3);
      const e = 1 - Math.pow(1 - S.swap, 3);
      lampGroup.scale.setScalar(0.85 + 0.15 * e);
      lampGroup.position.y = LAMP_POS.y + (1 - e) * 0.04;
      changed = true;
    }
    if (changed) {
      for (let i = 0; i < 6; i++) palCols[i].copy(S.pal[i]);
      applyLevel();
    }
    if (!reduced && S.level > 0.01) {
      haloMat.uniforms.uTime.value = S.t;
      const p = dustGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        p.array[i * 3 + 1] += Math.sin(S.t * 0.4 + dustSeed[i]) * 0.0006;
        p.array[i * 3] += Math.cos(S.t * 0.3 + dustSeed[i]) * 0.0005;
      }
      p.needsUpdate = true;
      S.dirty = true;
    }
    if (controls.update()) S.dirty = true;
  }

  function frame(now) {
    S.raf = 0;
    if (!S.running) return;
    const dt = Math.min((now - (S.last || now)) / 1000, 0.1);
    S.last = now;
    step(dt);
    if (S.dirty) { renderer.render(scene, camera); S.dirty = false; }
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
  palCols.forEach((c, i) => c.copy(S.pal[i]));
  setLampTarget(lamp);
  S.palTarget = null;
  resize();
  renderer.render(scene, camera);
  start();

  return {
    setLamp(id) { if (id !== S.lamp && PALETTES[id]) setLampTarget(id); },
    setOn(v) { S.on = !!v; S.dirty = true; },
    setAngle(v) { S.angle = v; applyAngle(); },
    getState() { return { lamp: S.lamp, on: S.on, level: S.level, angle: S.angle }; },
    dispose() {
      stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', syncRun);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
