// Kit "projector": Sunset y Aura. Cabeza negra que proyecta un halo en la pared (ShaderMaterial) + haz falso.
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, TubeGeometry, CatmullRomCurve3, Vector3, MathUtils, Color,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, AdditiveBlending, DoubleSide,
} from 'three';
import { WALL_Z, createHalo, makeSprite } from '../common.js';

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

export function createProjector(ctx) {
  const { lights: { spot, bulb }, glowTex, reduced } = ctx;
  const root = new Group();
  const world = new Group();

  const blackMat = new MeshStandardMaterial({ color: '#0c0c10', roughness: 0.38, metalness: 0.55, flatShading: false, envMap: ctx.env, envMapIntensity: 0.9 });
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

  root.add(sunset, aura);

  // halo en la pared
  const halo = createHalo();
  halo.mesh.position.set(ctx.lampPos.x, 1.6, WALL_Z + 0.006);
  world.add(halo.mesh);

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
  world.add(beam);

  const lensGlow = makeSprite(glowTex, 0.45);
  world.add(lensGlow);

  const P = {
    lamp: 'sunset', angle: 45,
    pal: PALETTES.sunset.stops.map((h) => new Color(h)),
    lightCol: new Color(PALETTES.sunset.light),
    glowCol: new Color(PALETTES.sunset.glow),
    gain: PALETTES.sunset.gain,
    palTarget: null, lightTarget: null, glowTarget: null, gainTarget: 1,
  };
  const tmp = new Color();
  const headWorld = new Vector3();
  const haloCenter = new Vector3();
  const frontV = new Vector3();
  const dustCol = new Color();

  const headObject = () => (P.lamp === 'sunset' ? sHeadPivot : aHeadPivot);

  function applyAngle() {
    const rad = MathUtils.degToRad(P.angle);
    sHeadPivot.rotation.x = rad;
    aHeadPivot.rotation.x = rad;
    root.updateWorldMatrix(true, true);
    const head = headObject();
    head.getWorldPosition(headWorld);
    const d = headWorld.z - WALL_Z;
    const cy = headWorld.y + d * Math.tan(rad);
    haloCenter.set(headWorld.x, Math.min(cy, 2.95), WALL_Z);
    halo.mesh.position.set(haloCenter.x, haloCenter.y, WALL_Z + 0.006);
    const stretch = 1 + (P.angle - 15) / 60 * 0.22;
    halo.mesh.scale.set(HALO_R, HALO_R * stretch, 1);
    spot.position.copy(headWorld);
    spot.target.position.copy(haloCenter);
    spot.target.updateMatrixWorld();
    bulb.position.copy(headWorld).add(new Vector3(0, 0.08, 0.1));
    const len = headWorld.distanceTo(haloCenter);
    beam.position.copy(headWorld);
    beam.lookAt(haloCenter);
    beam.scale.set(0.2, 0.2, len * 0.8);
    frontV.set(0, 0, -0.045).applyMatrix4(head.matrixWorld);
    lensGlow.position.copy(frontV);
  }

  function setLamp(id) {
    const first = !P.started;
    P.lamp = id;
    P.started = true;
    sunset.visible = id === 'sunset';
    aura.visible = id === 'aura';
    halo.mat.uniforms.uBands.value = PALETTES[id].bands;
    P.palTarget = PALETTES[id].stops.map((h) => new Color(h));
    P.lightTarget = new Color(PALETTES[id].light);
    P.glowTarget = new Color(PALETTES[id].glow);
    P.gainTarget = PALETTES[id].gain;
    if (reduced || first) snap();
    applyAngle();
  }
  function snap() {
    P.gain = P.gainTarget;
    P.pal.forEach((c, i) => c.copy(P.palTarget[i]));
    P.lightCol.copy(P.lightTarget);
    P.glowCol.copy(P.glowTarget);
    P.palTarget = null;
  }

  function update(dt, t, st) {
    let busy = false;
    if (P.palTarget) {
      const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
      let diff = 0;
      P.pal.forEach((c, i) => { c.lerp(P.palTarget[i], k); diff += Math.abs(c.r - P.palTarget[i].r) + Math.abs(c.g - P.palTarget[i].g) + Math.abs(c.b - P.palTarget[i].b); });
      P.lightCol.lerp(P.lightTarget, k);
      P.glowCol.lerp(P.glowTarget, k);
      P.gain += (P.gainTarget - P.gain) * k;
      diff += Math.abs(P.gainTarget - P.gain);
      if (diff < 0.002) snap();
      busy = true;
    }
    const L = st.L;
    const on = L > 0.002;
    const vis = 1 - 0.5 * st.amb;
    for (let i = 0; i < 6; i++) halo.pal[i].copy(P.pal[i]);
    halo.mat.uniforms.uIntensity.value = L * 0.95 * P.gain * vis;
    halo.mat.uniforms.uTime.value = t;
    halo.mesh.visible = on;
    lensGlow.visible = on;
    lensGlow.material.opacity = 0.95 * L;
    lensGlow.material.color.copy(P.glowCol);
    beam.visible = on;
    beamMat.uniforms.uOpacity.value = 0.55 * L * vis;
    beamMat.uniforms.uColor.value.copy(P.glowCol);
    spot.intensity = 7.5 * L;
    spot.color.copy(P.lightCol);
    bulb.intensity = 1.5 * L;
    bulb.color.copy(P.lightCol);
    const lens = P.lamp === 'sunset' ? lensMat : lensMat2;
    tmp.set(P.lamp === 'sunset' ? '#2a1a10' : '#1a1030');
    lens.color.copy(tmp).lerp(dustCol.copy(P.glowCol).multiplyScalar(1.6), L);
    kit.dust.copy(P.glowCol);
    kit.dustOpacity = 0.75 * L;
    return busy;
  }

  const kit = {
    id: 'projector', root, world, animated: true, usesDim: false,
    dust: new Color('#ffc080'), dustOpacity: 0,
    setLamp, setAngle(v) { P.angle = v; applyAngle(); },
    setVariant() {},
    update,
    dispose() {
      [blackMat, lensMat, lensMat2, beamMat, halo.mat].forEach((m) => m.dispose());
    },
  };
  return kit;
}
