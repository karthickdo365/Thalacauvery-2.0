/* ============================================================
   THALACUVERY BOREWELL — full-screen 3D forest drilling site
   Terrain, leafy trees (instanced real leaf geometry), shrubs,
   grass, rocks, BIG rig (LEFT) + SMALL rig (RIGHT, extra
   distance), a water-bowser LORRY behind the site feeding both
   rigs through ground pipes, hover drill story with water
   strike, camera framing, VISIBLE error reporting, safe
   disposal. Pure Three.js — no React, no routing.
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ---------------- constants / utils ---------------- */
const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = THREE.MathUtils.lerp;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

const _tv = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _hv = new THREE.Vector3();
const _lv = new THREE.Vector3();

const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _d1 = new THREE.Vector3();
const _c1 = new THREE.Color();
const _ZAX = new THREE.Vector3(0, 0, 1);
const _YAX = new THREE.Vector3(0, 1, 0);

/* water bowser lorry — parked behind the site, feeds both rigs */
const LORRY = { x: 1.5, z: -8, sink: 0.12 };

/* ---------------- machine catalogue (public) ---------------- */
export const MACHINES = {
  big: {
    key: 'big', idx: '01', title: 'BIG MACHINE', tag: 'HEAVY-DUTY RIG',
    desc: 'Built for deep bores, high-volume output and large-diameter drilling.',
    color: '#16a34a', lt: '#4ade80', hex: 0x16a34a,
    cb: 'rgba(22,163,74,.55)', csh: 'rgba(22,163,74,.22)',
    place: { x: -15, z: 0, yaw: 0.3 },            // LEFT side
    hitbox: { w: 10.6, h: 12.8, d: 7.4, cy: 6.2 },
    ringR: 4.2,
    waterDepth: 120,
    waterScale: 1.05,
    flowSec: 6,
    drill: { strokeFt: 28, rpm: 128, downSec: 3.6, upSec: 1.4 },
    specs: [
      ['MAX DEPTH', '1,500 FT'], ['BORE Ø', '6½″ – 12½″'],
      ['ENGINE', '351 HP'], ['MUD PUMP', 'TRIPLEX 5×6'],
    ],
    builder: buildBigRig,
  },
  small: {
    key: 'small', idx: '02', title: 'SMALL MACHINE', tag: 'COMPACT RIG',
    desc: 'Perfect for narrow sites, quick jobs and tight-access drilling.',
    color: '#d97706', lt: '#fbbf24', hex: 0xd97706,
    cb: 'rgba(217,119,6,.55)', csh: 'rgba(217,119,6,.22)',
    place: { x: 19, z: 0, yaw: -0.38 },           // RIGHT side — extra distance
    hitbox: { w: 6.4, h: 7.2, d: 5.4, cy: 3.4 },
    ringR: 2.9,
    waterDepth: 80,
    waterScale: 0.72,
    flowSec: 5,
    drill: { strokeFt: 9, rpm: 210, downSec: 2.8, upSec: 1.1 },
    specs: [
      ['MAX DEPTH', '350 FT'], ['BORE Ø', '4″ – 8″'],
      ['ENGINE', '62 HP'], ['PUMP', '3″ CENTRIFUGAL'],
    ],
    builder: buildSmallRig,
  },
};

/* ---------------- seeded random + value noise ---------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const S = 64, grid = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) grid[i] = rnd();
  const at = (x, y) => grid[(((y % S) + S) % S) * S + (((x % S) + S) % S)];
  const sm = (t) => t * t * (3 - 2 * t);
  function sample(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return (x, y) => {
    let val = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < 3; o++) {
      val += amp * sample(x * f, y * f);
      tot += amp; amp *= 0.5; f *= 2.13;
    }
    return val / tot;
  };
}

/* ---------------- canvas textures ---------------- */
function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makeSkyTexture() {
  const c = document.createElement('canvas'); c.width = 2; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0a1420');
  g.addColorStop(0.42, '#122626');
  g.addColorStop(0.6, '#1c3a30');
  g.addColorStop(0.76, '#122624');
  g.addColorStop(1, '#0a121a');
  x.fillStyle = g; x.fillRect(0, 0, 2, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function nameTex(accent, sub) {                 // painted livery — cab doors
  const c = document.createElement('canvas'); c.width = 512; c.height = 140;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 140);
  x.fillStyle = '#f4f7f5';
  x.font = '700 62px "Chakra Petch", sans-serif';
  x.textBaseline = 'middle';
  x.fillText('THALACUVERY', 10, 48);
  x.fillStyle = accent; x.fillRect(10, 86, 190, 8);
  if (sub) {
    x.fillStyle = 'rgba(255,255,255,.72)';
    x.font = '600 26px "IBM Plex Mono", monospace';
    x.fillText(sub, 10, 114);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function nameTexWide(accent) {                  // painted livery — tank / frame
  const c = document.createElement('canvas'); c.width = 512; c.height = 80;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 80);
  x.fillStyle = '#f4f7f5';
  x.font = '700 60px "Chakra Petch", sans-serif';
  x.textBaseline = 'middle';
  x.fillText('THALACUVERY', 8, 38);
  x.fillStyle = accent; x.fillRect(8, 62, 150, 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function brandTex(accent, line2) {              // mast plate
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#10161f'; x.fillRect(0, 0, 512, 160);
  x.fillStyle = accent; x.fillRect(0, 0, 10, 160);
  x.fillStyle = '#f2f5f7';
  x.font = '700 62px "Chakra Petch", sans-serif';
  x.textBaseline = 'middle'; x.fillText('THALACUVERY', 44, 62);
  x.fillStyle = accent; x.fillRect(44, 104, 220, 5);
  x.fillStyle = 'rgba(255,255,255,.6)';
  x.font = '600 25px "IBM Plex Mono", monospace';
  x.fillText(line2, 44, 130);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function stripeTex() {                          // hazard stripes
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#141922'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#f0c419';
  x.save(); x.translate(64, 64); x.rotate(-Math.PI / 4);
  for (let i = -4; i <= 4; i++) x.fillRect(-96, i * 32 - 8, 192, 16);
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.4, 1);
  return t;
}

/* ---------------- material + primitive helpers ---------------- */
const std = (o) => new THREE.MeshStandardMaterial(o);
function box(w, h, d, m) {
  const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  x.castShadow = x.receiveShadow = true; return x;
}
function cyl(rt, rb, h, m, seg = 16) {
  const x = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  x.castShadow = x.receiveShadow = true; return x;
}
function bar(a, b, w, m) {
  const d = _tv.subVectors(b, a).clone(), len = Math.max(d.length(), 0.001);
  const x = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), m);
  x.castShadow = x.receiveShadow = true;
  x.position.copy(a).addScaledVector(d, 0.5);
  x.quaternion.setFromUnitVectors(UP, d.normalize());
  return x;
}
function tube(pts, r, m) {
  const c = new THREE.CatmullRomCurve3(pts);
  const x = new THREE.Mesh(new THREE.TubeGeometry(c, 24, r, 8, false), m);
  x.castShadow = true; return x;
}
function updateBar(mesh, a, b) {
  _tv.subVectors(b, a);
  const len = Math.max(_tv.length(), 0.001);
  mesh.position.copy(a);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, _tv.normalize());
}
function dynCyl(r, m) {
  const geo = new THREE.CylinderGeometry(r, r, 1, 10);
  geo.translate(0, 0.5, 0);
  const x = new THREE.Mesh(geo, m); x.castShadow = true; return x;
}
function spinWrap(mesh, axis) {
  const g = new THREE.Group();
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  else g.rotation.z = Math.PI / 2;
  g.add(mesh); return g;
}
function livery(w, h, tex) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, metalness: 0.05 })
  );
}
function palette(accent) {
  const c = new THREE.Color(accent);
  return {
    body:     std({ color: c, metalness: 0.22, roughness: 0.55 }),
    bodyDark: std({ color: c.clone().multiplyScalar(0.45), metalness: 0.3, roughness: 0.6 }),
    steel:    std({ color: 0x8d97a4, metalness: 0.45, roughness: 0.45 }),
    dark:     std({ color: 0x2a313c, metalness: 0.35, roughness: 0.65 }),
    tire:     std({ color: 0x16181d, metalness: 0.02, roughness: 0.95 }),
    glass:    std({ color: 0x11202e, metalness: 0.4, roughness: 0.2, transparent: true, opacity: 0.68 }),
    pipe:     std({ color: 0xb9c2cc, metalness: 0.5, roughness: 0.35 }),
    cable:    std({ color: 0x232a35, metalness: 0.4, roughness: 0.6 }),
    beacon:   std({ color: 0x552f06, emissive: 0xffb020, emissiveIntensity: 1.2, roughness: 0.45 }),
    lamp:     std({ color: 0x0e1c28, emissive: 0xd9edff, emissiveIntensity: 2, roughness: 0.3 }),
    led:      std({ color: 0x0a2018, emissive: accent, emissiveIntensity: 0.7, roughness: 0.35 }),
    amber:    std({ color: 0x3a2405, emissive: 0xffa733, emissiveIntensity: 1.3, roughness: 0.4 }),
    red:      std({ color: 0x2a0805, emissive: 0xff3b30, emissiveIntensity: 1.4, roughness: 0.4 }),
    hole:     std({ color: 0x05070a, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
  };
}
function makeTricone(p, s) {
  const bit = new THREE.Group();
  bit.add(cyl(0.17 * s, 0.17 * s, 0.24 * s, p.steel, 12));
  const cones = [];
  for (let i = 0; i < 3; i++) {
    const az = (i / 3) * Math.PI * 2;
    const cg = new THREE.Group();
    cg.position.set(Math.cos(az) * 0.11 * s, -0.1 * s, Math.sin(az) * 0.11 * s);
    cg.rotation.order = 'YZX'; cg.rotation.y = -az; cg.rotation.z = -0.5;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13 * s, 0.3 * s, 10), p.steel);
    cone.castShadow = true; cone.rotation.x = Math.PI;
    for (let t = 0; t < 3; t++) {
      const ta = (t / 3) * Math.PI * 2;
      const tooth = box(0.05 * s, 0.06 * s, 0.05 * s, p.dark);
      tooth.position.set(Math.cos(ta) * 0.085 * s, -0.04 * s, Math.sin(ta) * 0.085 * s);
      cone.add(tooth);
    }
    cg.add(cone); bit.add(cg); cones.push(cone);
  }
  return { bit, cones };
}

/* ============================================================
   MACHINE MODELS — procedural, no model files
   ============================================================ */
function buildBigRig(accent) {
  const p = palette(accent), g = new THREE.Group(), u = g.userData;
  const A = 3.55, P = 3.7, L = 8.3;
  u.stow = 1.5;
  u.headOff = 0.5;
  u.headTopLocal = 7.6; u.headLowLocal = 0.55;
  u.bitTopLocal = -3.45; u.bitDeepLocal = -4.15;
  u.holeX = A;

  /* carrier */
  const chassis = box(7.4, 0.5, 2.5, p.dark); chassis.position.set(0, 1.16, 0); g.add(chassis);
  const deck = box(4.95, 0.12, 2.42, p.steel); deck.position.set(1.1, 1.5, 0); g.add(deck);

  /* operator cab — glass, lit interior, THALACUVERY livery */
  const cab = box(2.0, 1.7, 2.3, p.body); cab.position.set(-2.55, 2.27, 0); g.add(cab);
  const skirt = box(1.9, 0.5, 2.34, p.dark); skirt.position.set(-2.55, 1.6, 0); g.add(skirt);
  const wind = box(0.07, 0.85, 2.0, p.glass); wind.position.set(-3.57, 2.5, 0); g.add(wind);
  const grille = box(0.1, 0.7, 1.5, p.dark); grille.position.set(-3.6, 1.95, 0); g.add(grille);
  const bumper = box(0.32, 0.44, 2.4, p.dark); bumper.position.set(-3.8, 1.5, 0); g.add(bumper);
  for (const z of [-0.5, 0, 0.5]) g.add(bar(V(-3.68, 1.72, z), V(-3.68, 2.26, z), 0.05, p.dark));
  for (const s of [-1, 1]) {
    const sw = box(1.3, 0.55, 0.06, p.glass); sw.position.set(-2.55, 2.55, s * 1.16); g.add(sw);
    const hl = cyl(0.11, 0.11, 0.09, p.lamp, 14); hl.rotation.y = Math.PI / 2; hl.position.set(-3.55, 1.66, s * 0.85); g.add(hl);
    const bc = cyl(0.08, 0.08, 0.16, p.beacon, 10); bc.position.set(-2.95, 3.2, s * 0.78); g.add(bc);
    const ml = box(0.16, 0.08, 0.1, p.amber); ml.position.set(-2.9, 3.16, s * 0.85); g.add(ml);
    g.add(bar(V(-3.45, 2.85, s * 1.2), V(-3.62, 3.16, s * 1.32), 0.03, p.dark));
    const mi = box(0.3, 0.22, 0.05, p.glass); mi.position.set(-3.64, 3.18, s * 1.33); g.add(mi);
    const dh = box(0.3, 0.06, 0.05, p.dark); dh.position.set(-1.62, 2.1, s * 1.18); g.add(dh);
    const lv = livery(1.7, 0.465, nameTex(accent, 'HEAVY-DUTY DRILLING'));
    lv.position.set(-2.55, 2.02, s * 1.16);
    if (s < 0) lv.rotation.y = Math.PI;
    g.add(lv);
  }
  const dashMat = std({ color: 0x0a0d12, emissive: 0xffb545, emissiveIntensity: 0.5, roughness: 0.8 });
  const dash = box(1.3, 0.5, 1.6, dashMat); dash.position.set(-2.85, 2.42, 0); g.add(dash);
  for (const s of [-1, 1]) { const seat = box(0.45, 0.55, 0.5, p.dark); seat.position.set(-2.15, 2.2, s * 0.5); g.add(seat); }
  u.dashMat = dashMat;
  const cabLight = new THREE.PointLight(0xffc073, 1.6, 6, 2); cabLight.position.set(-2.6, 2.55, 0); g.add(cabLight);
  u.cabLight = cabLight;

  /* axles & fenders */
  for (const x of [-1.9, 1.4, 2.4]) for (const s of [-1, 1]) {
    const t = cyl(0.62, 0.62, 0.5, p.tire, 26); t.rotation.x = Math.PI / 2; t.position.set(x, 0.62, s * 1.31); g.add(t);
    const h = cyl(0.2, 0.2, 0.52, p.steel, 12); h.rotation.x = Math.PI / 2; h.position.set(x, 0.62, s * 1.31); g.add(h);
  }
  for (const s of [-1, 1]) {
    const f1 = box(2.15, 0.16, 0.6, p.body); f1.position.set(1.9, 1.31, s * 1.31); g.add(f1);
    const f2 = box(1.05, 0.16, 0.6, p.body); f2.position.set(-1.9, 1.31, s * 1.31); g.add(f2);
  }

  /* outriggers */
  for (const x of [0.6, 3.35]) {
    const beam = box(0.34, 0.26, 4.4, p.dark); beam.position.set(x, 1.16, 0); g.add(beam);
    for (const s of [-1, 1]) {
      const leg = cyl(0.13, 0.13, 1.05, p.steel, 10); leg.position.set(x, 0.55, s * 2.05); g.add(leg);
      const pad = cyl(0.3, 0.34, 0.16, p.dark, 14); pad.position.set(x, 0.08, s * 2.05); g.add(pad);
    }
  }

  /* control cabin + ladder + handrail */
  const cc = box(1.05, 1.45, 1.9, p.bodyDark); cc.position.set(-1.35, 2.22, 0); g.add(cc);
  const ccw = box(0.06, 0.6, 1.4, p.glass); ccw.position.set(-0.81, 2.55, 0); g.add(ccw);
  const ccr = box(1.15, 0.08, 2.0, p.dark); ccr.position.set(-1.35, 2.99, 0); g.add(ccr);
  for (const s of [-1, 1]) g.add(bar(V(-0.86, 1.56, s * 0.16), V(-0.86, 2.86, s * 0.16), 0.04, p.steel));
  for (let i = 0; i < 4; i++) { const r = box(0.32, 0.045, 0.045, p.steel); r.position.set(-0.86, 1.85 + i * 0.33, 0); g.add(r); }
  for (const x of [-1.1, -0.1, 0.9, 1.9]) { const post = cyl(0.03, 0.03, 0.78, p.steel, 8); post.position.set(x, 1.94, 1.14); g.add(post); }
  g.add(bar(V(-1.15, 2.32, 1.14), V(2.0, 2.32, 1.14), 0.035, p.steel));
  g.add(bar(V(-1.15, 1.98, 1.14), V(2.0, 1.98, 1.14), 0.03, p.steel));

  /* engine deck */
  const eng = box(1.35, 1.05, 1.8, p.body); eng.position.set(0.55, 2.0, 0); g.add(eng);
  for (const s of [-1, 1]) { const vent = box(1.1, 0.5, 0.05, p.dark); vent.position.set(0.55, 2.0, s * 0.92); g.add(vent); }
  const exh = cyl(0.07, 0.07, 0.8, p.dark, 10); exh.position.set(0.3, 2.95, -0.75); g.add(exh);
  const ecap = box(0.18, 0.06, 0.18, p.dark); ecap.position.set(0.3, 3.38, -0.75); g.add(ecap);
  u.smokeAnchor = V(0.3, 3.4, -0.75);
  const air = cyl(0.16, 0.16, 0.72, p.steel, 14); air.rotation.z = Math.PI / 2; air.position.set(0.55, 2.6, 0.6); g.add(air);

  /* drawworks */
  const dwb = box(1.2, 0.45, 1.95, p.dark); dwb.position.set(1.75, 1.75, 0); g.add(dwb);
  const drum = cyl(0.32, 0.32, 0.9, p.steel, 18);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const lug = box(0.07, 0.84, 0.07, p.dark);
    lug.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35); drum.add(lug);
  }
  for (const s of [-1, 1]) { const fl = cyl(0.44, 0.44, 0.07, p.bodyDark, 20); fl.position.y = s * 0.48; drum.add(fl); }
  const dwg = spinWrap(drum, 'z'); dwg.position.set(1.75, 2.28, 0); g.add(dwg);
  u.drum = drum;

  /* mud tank + racked drill pipes */
  const tank = box(1.3, 1.0, 2.0, p.bodyDark); tank.position.set(2.85, 1.98, 0); g.add(tank);
  const trf = box(1.36, 0.06, 2.06, p.steel); trf.position.set(2.85, 2.51, 0); g.add(trf);
  for (const s of [-1, 1]) { const cap = cyl(0.09, 0.09, 0.15, p.dark, 10); cap.position.set(2.85, 2.6, s * 0.62); g.add(cap); }
  for (const z of [-0.55, 0, 0.55]) {
    const dp = cyl(0.09, 0.09, 3.1, p.pipe, 12);
    dp.rotation.z = Math.PI / 2; dp.position.set(2.7, 2.64, z); g.add(dp);
    const cpl = box(0.22, 0.2, 0.2, p.steel); cpl.position.set(3.9, 2.64, z); g.add(cpl);
  }

  /* mast tower + hazard board */
  for (const s of [-1, 1]) {
    const plate = box(0.14, 2.3, 0.6, p.bodyDark); plate.position.set(3.55, 2.62, s * 0.75); g.add(plate);
    g.add(bar(V(3.55, 3.5, s * 0.68), V(2.35, 1.56, s * 1.0), 0.07, p.steel));
  }
  const tbeam = box(0.5, 0.2, 1.7, p.dark); tbeam.position.set(3.55, 3.66, 0); g.add(tbeam);
  const hz = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 2.2), std({ map: stripeTex(), roughness: 0.7 }));
  hz.position.set(3.73, 1.16, 0); g.add(hz);

  /* mast — vertical box truss */
  const mast = new THREE.Group(); mast.position.set(A, P, 0); g.add(mast);
  u.mast = mast;
  const RX = [-0.36, 0.36], RZ = [-0.42, 0.42];
  for (const x of RX) for (const z of RZ) {
    const leg = cyl(0.09, 0.09, L, p.steel, 10); leg.position.set(x, L / 2, z); mast.add(leg);
  }
  const segs = 7, dy = L / segs;
  for (let i = 0; i < segs; i++) {
    const y0 = i * dy, y1 = y0 + dy;
    for (const x of RX) {
      if (i > 0) mast.add(bar(V(x, y0, RZ[0]), V(x, y0, RZ[1]), 0.055, p.steel));
      mast.add(i % 2 === 0 ? bar(V(x, y0, RZ[0]), V(x, y1, RZ[1]), 0.05, p.steel)
                           : bar(V(x, y0, RZ[1]), V(x, y1, RZ[0]), 0.05, p.steel));
    }
    for (const z of RZ) {
      if (i > 0) mast.add(bar(V(RX[0], y0, z), V(RX[1], y0, z), 0.05, p.steel));
      mast.add(i % 2 === 0 ? bar(V(RX[0], y0, z), V(RX[1], y1, z), 0.05, p.steel)
                           : bar(V(RX[1], y0, z), V(RX[0], y1, z), 0.05, p.steel));
    }
  }
  for (const z of RZ) mast.add(bar(V(RX[0], L, z), V(RX[1], L, z), 0.07, p.steel));
  for (const x of RX) mast.add(bar(V(x, L, RZ[0]), V(x, L, RZ[1]), 0.07, p.steel));

  const crown = box(1.2, 0.4, 1.05, p.bodyDark); crown.position.set(0, L + 0.25, 0); mast.add(crown);
  u.sheaves = [];
  for (const s of [-1, 1]) {
    mast.add(bar(V(0, L - 0.15, s * 0.42), V(0, L + 0.05, s * 0.58), 0.06, p.steel));
    const sh = cyl(0.17, 0.17, 0.09, p.steel, 16);
    const wrap = spinWrap(sh, 'z'); wrap.position.set(0, L + 0.05, s * 0.58); mast.add(wrap);
    u.sheaves.push(sh);
  }
  const cb = cyl(0.07, 0.07, 0.18, p.beacon, 10); cb.position.set(0, L + 0.52, 0); mast.add(cb);

  const npb = box(1.56, 0.56, 0.04, p.dark); npb.position.set(0, 6.7, 0.44); mast.add(npb);
  const np = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.5),
    new THREE.MeshBasicMaterial({ map: brandTex(accent, 'HEAVY-DUTY RIG · 1500 FT') })
  );
  np.position.set(0, 6.7, 0.465); mast.add(np);

  /* top-drive head */
  const head = new THREE.Group(); head.position.set(0, u.headTopLocal, 0); mast.add(head);
  head.add(box(1.0, 0.75, 0.95, p.body));
  for (const s of [-1, 1]) {
    const mo = cyl(0.16, 0.16, 0.5, p.dark, 12); mo.rotation.x = Math.PI / 2; mo.position.set(s * 0.32, 0.62, 0); head.add(mo);
  }
  const hplate = box(0.92, 0.1, 0.82, p.steel); hplate.position.y = -0.44; head.add(hplate);
  const hconn = cyl(0.15, 0.15, 0.2, p.steel, 12); hconn.position.y = -0.52; head.add(hconn);
  const led = box(0.16, 0.05, 0.05, p.led); led.position.set(0.3, 0.12, 0.49); head.add(led);
  u.ledMat = p.led; u.head = head;

  /* hex kelly */
  const pg = new THREE.CylinderGeometry(0.11, 0.11, 1, 6); pg.translate(0, -0.5, 0);
  const pipe = new THREE.Mesh(pg, p.pipe); pipe.castShadow = true;
  const stripe = box(0.03, 1, 0.05, p.dark); stripe.position.set(0, -0.5, 0.1); pipe.add(stripe);
  u.pipe = pipe; mast.add(pipe);

  /* tricone bit + guide collar + conductor hole */
  const tc = makeTricone(p, 1);
  tc.bit.position.set(0, u.bitTopLocal, 0); mast.add(tc.bit);
  u.bitGroup = tc.bit; u.cones = tc.cones;

  const collar = new THREE.Group(); collar.position.set(0, -3.32, 0); mast.add(collar);
  for (const [x, z] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]])
    collar.add(bar(V(x, -0.25, z), V(x, 0.25, z), 0.06, p.dark));
  for (const zz of [-0.26, 0.26]) {
    collar.add(bar(V(-0.26, 0.25, zz), V(0.26, 0.25, zz), 0.05, p.dark));
    collar.add(bar(V(-0.26, -0.25, zz), V(0.26, -0.25, zz), 0.05, p.dark));
  }
  u.collar = collar;

  const hole = new THREE.Group(); hole.position.set(A, 0, 0); g.add(hole);
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 24, 1, true), p.hole);
  casing.position.y = 0.275; casing.castShadow = true; hole.add(casing);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), p.hole);
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.08; hole.add(floor);
  const hring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 10, 28), p.steel);
  hring.rotation.x = Math.PI / 2; hring.position.y = 0.55; hring.castShadow = true; hole.add(hring);
  u.hole = hole;

  /* dynamic rigging */
  u.cables = [];
  for (const [fx, fz, ox, oz] of [[-0.2, -0.3, -0.16, -0.3], [0.2, 0.3, 0.16, 0.3]]) {
    const mesh = dynCyl(0.03, p.cable); mast.add(mesh);
    u.cables.push({ mesh, from: V(fx, L - 0.12, fz), off: V(ox, 0.42, oz) });
  }
  const fl = dynCyl(0.03, p.cable); g.add(fl);
  const flA = new THREE.Object3D(); flA.position.set(0, L + 0.02, 0.55); mast.add(flA);
  u.fastline = { mesh: fl, base: V(1.75, 2.55, 0.3), anchor: flA };

  u.hyd = [];
  for (const s of [-1, 1]) {
    const mesh = dynCyl(0.07, p.steel); g.add(mesh);
    const anch = new THREE.Object3D(); anch.position.set(0, 2.6, s * 0.5); mast.add(anch);
    const lugB = box(0.14, 0.14, 0.1, p.dark); lugB.position.set(0, 2.6, s * 0.44); mast.add(lugB);
    const lugA = box(0.16, 0.14, 0.14, p.dark); lugA.position.set(2.15, 1.62, s * 0.9); g.add(lugA);
    u.hyd.push({ mesh, base: V(2.15, 1.6, s * 0.9), anchor: anch });
  }

  u.feed = [];
  for (const s of [-1, 1]) {
    const mesh = dynCyl(0.055, p.steel); mast.add(mesh);
    u.feed.push({ mesh, from: V(s * 0.44, 0.15, 0), off: V(s * 0.32, -0.08, 0) });
  }

  /* mud circuit */
  g.add(tube([V(2.5, 2.45, 0.7), V(2.9, 2.85, 0.78), V(3.4, 3.35, 0.55)], 0.05, p.dark));
  mast.add(bar(V(0.15, 0.25, 0.42), V(0.15, 4.85, 0.42), 0.08, p.dark));
  const hoseMesh = new THREE.Mesh(new THREE.BufferGeometry(), p.dark);
  hoseMesh.castShadow = true; mast.add(hoseMesh);
  u.hose = {
    mesh: hoseMesh, from: V(0.15, 4.95, 0.42), toOff: V(0, 0.22, 0.34),
    lastEnd: V(1e9, 0, 0), lastAngle: -9, r: 0.05, local: true, sag: 0.55, drop: 0.55,
  };

  u.beaconMat = p.beacon;
  return g;
}

function buildSmallRig(accent) {
  const p = palette(accent), g = new THREE.Group(), u = g.userData;
  const A = 1.45, P = 2.1, L = 4.35;
  const PX = 0.12;
  u.stow = 1.5; u.headOff = 0.3;
  u.headTopLocal = 3.7; u.headLowLocal = 0.4;
  u.bitTopLocal = -1.85; u.bitDeepLocal = -2.3;
  u.holeX = A + PX;

  /* frame + tongue + THALACUVERY frame livery */
  const frame = box(3.0, 0.32, 1.5, p.body); frame.position.set(0.15, 0.96, 0); g.add(frame);
  for (const s of [-1, 1]) g.add(bar(V(-1.32, 0.98, s * 0.3), V(-2.42, 0.68, s * 0.08), 0.06, p.steel));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 10, 24), p.steel);
  ring.rotation.y = Math.PI / 2; ring.position.set(-2.55, 0.68, 0); ring.castShadow = true; g.add(ring);
  for (const s of [-1, 1]) {
    const lv = livery(1.6, 0.25, nameTexWide(accent));
    lv.position.set(0.15, 0.97, s * 0.76);
    if (s < 0) lv.rotation.y = Math.PI;
    g.add(lv);
  }
  const hz = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 1.2), std({ map: stripeTex(), roughness: 0.7 }));
  hz.position.set(1.66, 1.0, 0); g.add(hz);
  const tl = box(0.06, 0.12, 0.18, p.red); tl.position.set(1.67, 0.98, -0.5); g.add(tl);

  for (const s of [-1, 1]) {
    const t = cyl(0.5, 0.5, 0.32, p.tire, 22); t.rotation.x = Math.PI / 2; t.position.set(0.95, 0.5, s * 0.86); g.add(t);
    const h = cyl(0.15, 0.15, 0.34, p.steel, 10); h.rotation.x = Math.PI / 2; h.position.set(0.95, 0.5, s * 0.86); g.add(h);
    const f = box(0.82, 0.12, 0.66, p.body); f.position.set(0.95, 1.06, s * 0.88); g.add(f);
    const ml = cyl(0.06, 0.06, 0.05, p.lamp, 10); ml.rotation.y = Math.PI / 2; ml.position.set(-1.33, 1.05, s * 0.6); g.add(ml);
  }

  /* power pack + fuel + controls */
  const eng = box(0.85, 0.6, 0.8, p.body); eng.position.set(-0.05, 1.42, 0); g.add(eng);
  const exh = cyl(0.045, 0.045, 0.5, p.dark, 8); exh.position.set(-0.35, 1.9, 0.22); g.add(exh);
  u.smokeAnchor = V(-0.35, 2.18, 0.22);
  const recoil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 20), p.steel);
  recoil.position.set(-0.05, 1.42, 0.42); g.add(recoil);
  for (const i of [-1, 1]) g.add(bar(V(-0.15, 1.72, i * 0.2), V(-0.22, 1.98, i * 0.28), 0.03, p.steel));
  const led1 = box(0.1, 0.05, 0.05, p.led); led1.position.set(0.12, 1.62, 0.42); g.add(led1);
  const led2 = box(0.1, 0.05, 0.05, p.amber); led2.position.set(0.28, 1.62, 0.42); g.add(led2);
  u.ledMat = p.led;
  const fuel = cyl(0.16, 0.16, 0.72, p.body, 14); fuel.rotation.z = Math.PI / 2; fuel.position.set(-0.95, 1.22, 0.55); g.add(fuel);
  const fcap = cyl(0.05, 0.05, 0.06, p.dark, 8); fcap.position.set(-0.62, 1.33, 0.55); g.add(fcap);

  /* winch drum with crank */
  const wbr = box(0.4, 0.26, 0.7, p.bodyDark); wbr.position.set(-1.15, 1.2, 0); g.add(wbr);
  const wm = cyl(0.16, 0.16, 0.44, p.steel, 14);
  const crank = box(0.34, 0.05, 0.05, p.dark); crank.position.set(0.19, 0, 0); wm.add(crank);
  const knob = cyl(0.05, 0.05, 0.14, p.dark, 8); knob.rotation.z = Math.PI / 2; knob.position.set(0.4, 0, 0); wm.add(knob);
  const wg = spinWrap(wm, 'z'); wg.position.set(-1.15, 1.47, 0); g.add(wg);
  u.drum = wm;

  /* toolbox + spare rods */
  const tb = box(0.55, 0.34, 0.8, p.bodyDark); tb.position.set(0.65, 1.29, 0); g.add(tb);
  for (const s of [-1, 1]) {
    const rod = cyl(0.05, 0.05, 2.1, p.pipe, 10);
    rod.rotation.z = Math.PI / 2; rod.position.set(0.55, 1.51, s * 0.26); g.add(rod);
  }

  /* jacks + handle */
  for (const s of [-1, 1]) {
    const leg = cyl(0.05, 0.05, 1.0, p.steel, 8); leg.position.set(-1.28, 0.6, s * 0.55); g.add(leg);
    const pad = cyl(0.13, 0.15, 0.08, p.dark, 12); pad.position.set(-1.28, 0.1, s * 0.55); g.add(pad);
  }
  for (const s of [-1, 1]) g.add(bar(V(1.6, 1.08, s * 0.36), V(2.26, 1.5, s * 0.28), 0.045, p.steel));
  const cross = cyl(0.04, 0.04, 0.62, p.dark, 8); cross.rotation.x = Math.PI / 2; cross.position.set(2.26, 1.52, 0); g.add(cross);

  /* mast */
  const mast = new THREE.Group(); mast.position.set(A, P, 0); g.add(mast);
  u.mast = mast;
  const spine = box(0.2, L, 0.36, p.steel); spine.position.set(-0.26, L / 2, 0); mast.add(spine);
  for (const s of [-1, 1]) {
    const rail = box(0.06, L, 0.08, p.dark); rail.position.set(0.12, L / 2, s * 0.17); mast.add(rail);
    mast.add(bar(V(-0.26, 0.12, s * 0.28), V(0.1, 0.9, s * 0.17), 0.04, p.steel));
  }
  for (let i = 0; i < 7; i++) { const rung = box(0.3, 0.04, 0.03, p.dark); rung.position.set(-0.05, 0.6 + i * 0.5, 0.19); mast.add(rung); }

  const plate = box(0.5, 0.08, 0.5, p.dark); plate.position.set(0, L + 0.04, 0); mast.add(plate);
  const sh = cyl(0.12, 0.12, 0.09, p.steel, 14);
  const sw = spinWrap(sh, 'z'); sw.position.set(0.3, L + 0.02, 0); mast.add(sw);
  u.sheaves = [sh];
  mast.add(bar(V(0.1, L - 0.06, 0), V(0.3, L, 0), 0.05, p.steel));
  const bcn = cyl(0.055, 0.055, 0.15, p.beacon, 10); bcn.position.set(0, L + 0.16, 0); mast.add(bcn);
  const np = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.36),
    new THREE.MeshBasicMaterial({ map: brandTex(accent, 'COMPACT RIG · 350 FT') })
  );
  np.position.set(-0.05, 2.6, 0.2); np.rotation.y = 0.35; mast.add(np);

  /* head + rod + bit + collar + hole */
  const head = new THREE.Group(); head.position.set(PX, u.headTopLocal, 0); mast.add(head);
  head.add(box(0.42, 0.5, 0.46, p.body));
  const mo = cyl(0.1, 0.1, 0.34, p.dark, 10); mo.rotation.x = Math.PI / 2; mo.position.y = 0.38; head.add(mo);
  const hpl = box(0.44, 0.08, 0.48, p.steel); hpl.position.y = -0.26; head.add(hpl);
  const sled = box(0.16, 0.05, 0.05, p.led); sled.position.set(0.1, 0.08, 0.24); head.add(sled);

  const pg = new THREE.CylinderGeometry(0.055, 0.055, 1, 6); pg.translate(0, -0.5, 0);
  const pipe = new THREE.Mesh(pg, p.pipe); pipe.castShadow = true; pipe.position.x = PX;
  const stripe = box(0.016, 1, 0.026, p.dark); stripe.position.set(0, -0.5, 0.05); pipe.add(stripe);
  u.pipe = pipe; mast.add(pipe);

  const tc = makeTricone(p, 0.62);
  tc.bit.position.set(PX, u.bitTopLocal, 0); mast.add(tc.bit);
  u.bitGroup = tc.bit; u.cones = tc.cones;

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 10, 18), p.dark);
  collar.rotation.x = Math.PI / 2; collar.position.set(PX, -1.8, 0); collar.castShadow = true;
  mast.add(collar); u.collar = collar;

  const hole = new THREE.Group(); hole.position.set(u.holeX, 0, 0); g.add(hole);
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 20, 1, true), p.hole);
  casing.position.y = 0.17; hole.add(casing);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), p.hole);
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.05; hole.add(floor);
  const hring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 10, 24), p.steel);
  hring.rotation.x = Math.PI / 2; hring.position.y = 0.34; hring.castShadow = true; hole.add(hring);
  u.hole = hole;

  /* dynamic rigging */
  const cable = dynCyl(0.02, p.cable); mast.add(cable);
  u.cables = [{ mesh: cable, from: V(0.3, L - 0.06, 0), off: V(-0.15, 0.3, 0) }];
  const wr = dynCyl(0.02, p.cable); g.add(wr);
  const wa = new THREE.Object3D(); wa.position.set(0.3, L - 0.04, 0); mast.add(wa);
  u.fastline = { mesh: wr, base: V(-1.15, 1.6, 0), anchor: wa };

  u.hyd = [];
  for (const s of [-1, 1]) {
    const mesh = dynCyl(0.05, p.steel); g.add(mesh);
    const anch = new THREE.Object3D(); anch.position.set(-0.1, 1.4, s * 0.3); mast.add(anch);
    const lug = box(0.12, 0.12, 0.1, p.dark); lug.position.set(0.55, 1.14, s * 0.6); g.add(lug);
    u.hyd.push({ mesh, base: V(0.55, 1.12, s * 0.6), anchor: anch });
  }
  u.feed = [];

  const hoseMesh = new THREE.Mesh(new THREE.BufferGeometry(), p.dark);
  hoseMesh.castShadow = true; g.add(hoseMesh);
  u.hose = {
    mesh: hoseMesh, from: V(-0.2, 1.72, 0.3), toOff: V(0, 0.2, 0.15),
    lastEnd: V(1e9, 0, 0), lastAngle: -9, r: 0.032, local: false, sag: 0.6, drop: 0.5,
  };

  u.beaconMat = p.beacon;
  return g;
}

/* ============================================================
   WATER BOWSER LORRY — parked behind the site; feeds both rigs
   ============================================================ */
function buildWaterLorry(accent, heightAt) {
  const p = palette(accent);
  const g = new THREE.Group();

  g.position.set(LORRY.x, heightAt(LORRY.x, LORRY.z) - LORRY.sink, LORRY.z);
  g.rotation.y = 0;                                // parked along the track

  /* chassis */
  const chassis = box(7.0, 0.45, 2.4, p.dark); chassis.position.set(0, 1.05, 0); g.add(chassis);

  /* cab */
  const cab = box(2.0, 1.6, 2.2, p.body); cab.position.set(-2.45, 2.05, 0); g.add(cab);
  const skirt = box(1.9, 0.45, 2.24, p.dark); skirt.position.set(-2.45, 1.5, 0); g.add(skirt);
  const wind = box(0.07, 0.8, 1.9, p.glass); wind.position.set(-3.47, 2.3, 0); g.add(wind);
  const grille = box(0.1, 0.6, 1.4, p.dark); grille.position.set(-3.5, 1.8, 0); g.add(grille);
  const bumper = box(0.3, 0.4, 2.3, p.dark); bumper.position.set(-3.65, 1.4, 0); g.add(bumper);
  for (const s of [-1, 1]) {
    const sw = box(1.25, 0.5, 0.06, p.glass); sw.position.set(-2.45, 2.3, s * 1.11); g.add(sw);
    const hl = cyl(0.11, 0.11, 0.09, p.lamp, 14); hl.rotation.y = Math.PI / 2; hl.position.set(-3.42, 1.55, s * 0.8); g.add(hl);
    const bc = cyl(0.075, 0.075, 0.15, p.beacon, 10); bc.position.set(-2.8, 2.92, s * 0.66); g.add(bc);
    g.add(bar(V(-3.3, 2.6, s * 1.15), V(-3.45, 2.88, s * 1.28), 0.03, p.dark));
    const mi = box(0.26, 0.2, 0.05, p.glass); mi.position.set(-3.47, 2.9, s * 1.29); g.add(mi);
    const lv = livery(1.5, 0.4, nameTex(accent, 'WATER BOWSER'));
    lv.position.set(-2.45, 1.8, s * 1.11);
    if (s < 0) lv.rotation.y = Math.PI;
    g.add(lv);
    const tlight = box(0.06, 0.12, 0.16, p.red); tlight.position.set(3.52, 1.25, s * 0.85); g.add(tlight);
  }

  /* wheels — front axle + rear tandem */
  for (const x of [-2.2, 1.7, 2.7]) for (const s of [-1, 1]) {
    const t = cyl(0.55, 0.55, 0.42, p.tire, 22); t.rotation.x = Math.PI / 2; t.position.set(x, 0.55, s * 1.21); g.add(t);
    const h = cyl(0.18, 0.18, 0.44, p.steel, 10); h.rotation.x = Math.PI / 2; h.position.set(x, 0.55, s * 1.21); g.add(h);
  }
  for (const s of [-1, 1]) {
    const f = box(2.25, 0.14, 0.56, p.body); f.position.set(2.2, 1.19, s * 1.21); g.add(f);
  }

  /* water tank on cradles + THALACUVERY livery */
  const cr1 = box(0.6, 0.3, 2.0, p.dark); cr1.position.set(-1.1, 1.32, 0); g.add(cr1);
  const cr2 = box(0.6, 0.3, 2.0, p.dark); cr2.position.set(1.9, 1.32, 0); g.add(cr2);
  const tank = cyl(1.02, 1.02, 4.3, p.bodyDark, 24); tank.rotation.z = Math.PI / 2; tank.position.set(0.55, 2.35, 0); g.add(tank);
  for (const x of [-1.2, 0.55, 2.3]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.045, 10, 40), p.dark);
    band.rotation.y = Math.PI / 2; band.position.set(x, 2.35, 0); band.castShadow = true; g.add(band);
  }
  for (const x of [-0.15, 1.25]) {
    const cap = cyl(0.16, 0.16, 0.14, p.dark, 12); cap.position.set(x, 3.42, 0); g.add(cap);
  }
  for (const s of [-1, 1]) {
    const lv = livery(3.1, 0.5, nameTexWide(accent));
    lv.position.set(0.55, 2.35, s * 1.03);
    if (s < 0) lv.rotation.y = Math.PI;
    g.add(lv);
  }

  /* rear pump skid + hose reels (where the site pipes connect) */
  const pump = box(0.9, 0.7, 1.7, p.dark); pump.position.set(3.15, 1.45, 0); g.add(pump);
  for (const s of [-1, 1]) {
    const reel = cyl(0.38, 0.38, 0.3, p.steel, 18);
    reel.rotation.x = Math.PI / 2; reel.position.set(3.3, 0.98, s * 0.72); g.add(reel);
    const hub = cyl(0.09, 0.09, 0.36, p.dark, 10);
    hub.rotation.x = Math.PI / 2; hub.position.set(3.3, 0.98, s * 0.72); g.add(hub);
    /* outlet elbow pointing outward — the pipes start here */
    const out = cyl(0.07, 0.07, 0.4, p.steel, 10);
    out.rotation.x = Math.PI / 2; out.position.set(3.3, 1.1, s * 0.95); g.add(out);
  }
  const hz = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 2.0), std({ map: stripeTex(), roughness: 0.7 }));
  hz.position.set(3.55, 1.05, 0); g.add(hz);

  return g;
}

/* ============================================================
   SITE PIPES — lorry → BIG rig + lorry → SMALL rig,
   laid over the terrain (heightAt keeps them on the ground)
   ============================================================ */
function buildLorryPipes(heightAt) {
  const group = new THREE.Group();
  const pipeMat = std({ color: 0x39424e, metalness: 0.45, roughness: 0.5 });
  const ringMat = std({ color: 0x232a35, metalness: 0.5, roughness: 0.5 });
  const ZAX = new THREE.Vector3(0, 0, 1);

  const ground = (x, z) => heightAt(x, z);
  const lorryY = ground(LORRY.x, LORRY.z) - LORRY.sink;

  /* start points at the lorry's rear outlets */
  const startA = V(LORRY.x + 3.3, lorryY + 1.1, LORRY.z + 0.95);
  const startB = V(LORRY.x + 3.3, lorryY + 1.1, LORRY.z - 0.95);

  /* end points at the rigs (world coordinates) */
  const endA = V(-12.1, 1.6, -0.35);               // BIG rig mud-tank manifold
  const endB = V(18.35, 1.25, 0.2);                // SMALL rig power-pack inlet

  const curveA = new THREE.CatmullRomCurve3([
    startA,
    V(2.0, ground(2.0, -6.3) + 0.3, -6.3),
    V(-2.5, ground(-2.5, -4.1) + 0.28, -4.1),
    V(-7.5, ground(-7.5, -2.3) + 0.26, -2.3),
    V(-10.9, ground(-10.9, -1.2) + 0.6, -1.2),
    endA,
  ]);
  const curveB = new THREE.CatmullRomCurve3([
    startB,
    V(6.8, ground(6.8, -8.6) + 0.3, -8.6),
    V(10.5, ground(10.5, -5.4) + 0.28, -5.4),
    V(15.0, ground(15.0, -2.0) + 0.26, -2.0),
    V(17.7, ground(17.7, 0.1) + 0.5, 0.1),
    endB,
  ]);

  function addPipe(curve, r) {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, r, 8, false), pipeMat);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);

    /* couplings along the run */
    for (const t of [0.05, 0.25, 0.45, 0.65, 0.85, 0.97]) {
      const pos = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.045, 0.035, 10, 22), ringMat);
      ring.position.copy(pos);
      ring.quaternion.setFromUnitVectors(ZAX, tan);
      ring.castShadow = true;
      group.add(ring);
    }

    /* valve wheel mid-run */
    const vp = curve.getPointAt(0.5);
    const stem = cyl(0.045, 0.045, 0.5, ringMat, 8);
    stem.position.set(vp.x, vp.y + 0.25, vp.z);
    group.add(stem);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 10, 24), ringMat);
    wheel.rotation.x = -Math.PI / 2;
    wheel.position.set(vp.x, vp.y + 0.5, vp.z);
    wheel.castShadow = true;
    group.add(wheel);
  }

  addPipe(curveA, 0.085);
  addPipe(curveB, 0.08);

  /* junction manifold on the lorry rear between the two outlets */
  const junction = box(0.55, 0.5, 1.6, ringMat);
  junction.position.set(LORRY.x + 3.3, lorryY + 0.9, LORRY.z);
  group.add(junction);

  return group;
}

/* ============================================================
   LEAFY TREES — real leaf geometry + branch skeletons,
   all rendered through a handful of InstancedMeshes.
   Crowns are hundreds of individual pointed, curved, folded
   leaves in small clusters — not polygon blobs.
   ============================================================ */

/* pointed, curved, V-folded leaf along +Y (base at origin).
   width = widest leaf width; curve = tip droop; crease = fold. */
function makeLeafGeometry(width, curve, crease) {
  const ST = 6;                                    // stations along the leaf
  const positions = [];
  const indices = [];
  for (let i = 0; i <= ST; i++) {
    const t = i / ST;
    const w = (width * 0.5) * Math.sin(Math.PI * Math.pow(t, 0.85));
    const bend = -curve * t * t;                   // tip curls back
    positions.push(-w, t, bend);                          // left edge
    positions.push(0, t, bend + crease * (1 - t * 0.55)); // lifted midrib
    positions.push(w, t, bend);                           // right edge
  }
  for (let i = 0; i < ST; i++) {
    const a = i * 3, b = (i + 1) * 3;
    indices.push(a, b, a + 1, a + 1, b, b + 1);           // left half
    indices.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); // right half
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const LEAF_PALETTE = [
  new THREE.Color(0x1e3a15), new THREE.Color(0x27491d),
  new THREE.Color(0x2f5724), new THREE.Color(0x3a6529),
  new THREE.Color(0x4a7431),
];
const LEAF_SUN = new THREE.Color(0x8fae52);        // sun-facing tint
const WOOD_TRUNK = new THREE.Color(0x4a3a26);
const WOOD_TWIG = new THREE.Color(0x6b5138);

/* three tree variations — tall forest / medium broad-leaf / bush */
const TREE_KINDS = {
  tall: {
    trunkLen: [3.6, 0.8], trunkR: [0.3, 0.07], maxDepth: 3,
    trunkSplits: 3, branchSplits: 3, spread: 0.5, leader: true,
    leaderLen: 0.8, leafDensity: 1.0, leafScale: 0.95,
  },
  broad: {
    trunkLen: [2.7, 0.9], trunkR: [0.4, 0.08], maxDepth: 3,
    trunkSplits: 5, branchSplits: 3, spread: 0.85, leader: false,
    leaderLen: 0.8, leafDensity: 1.05, leafScale: 1.1,
  },
  bush: {
    trunkLen: [1.1, 0.5], trunkR: [0.16, 0.04], maxDepth: 2,
    trunkSplits: 5, branchSplits: 2, spread: 1.0, leader: false,
    leaderLen: 0.8, leafDensity: 1.35, leafScale: 1.25,
  },
};

/* a collector shared by trees + shrubs; filled with plain number
   records, then baked into InstancedMeshes once at the end */
function makeForestCollector() {
  return { branches: [], leafA: [], leafB: [] };
}

function pushBranch(out, p, d, r, l, t) {
  _q1.setFromUnitVectors(UP, d);
  out.branches.push({
    x: p.x, y: p.y, z: p.z,
    qx: _q1.x, qy: _q1.y, qz: _q1.z, qw: _q1.w,
    sx: r, sy: l, sz: r, t,
  });
}

function pushLeaf(out, broad, px, py, pz, dx, dy, dz, spin, sl, sw, r, g, b) {
  _q1.setFromAxisAngle(UP, spin);                  // fold direction around the leaf axis
  _q2.setFromUnitVectors(UP, _d1.set(dx, dy, dz).normalize());
  _q2.multiply(_q1);
  (broad ? out.leafA : out.leafB).push({
    x: px, y: py, z: pz,
    qx: _q2.x, qy: _q2.y, qz: _q2.z, qw: _q2.w,
    sx: sw, sy: sl, sz: sw,
    r, g, b,
  });
}

/* a small cluster of naturally varied leaves around a point */
function addLeafCluster(out, point, dir, count, rnd, treeH, leafScale) {
  const base = LEAF_PALETTE[(rnd() * LEAF_PALETTE.length) | 0];
  const jr = (rnd() - 0.5) * 0.2, jg = (rnd() - 0.5) * 0.2, jb = (rnd() - 0.5) * 0.1;
  for (let i = 0; i < count; i++) {
    const px = point.x + (rnd() - 0.5) * 0.6;
    const py = point.y + (rnd() - 0.3) * 0.5;
    const pz = point.z + (rnd() - 0.5) * 0.6;

    /* leaves spray outward from the branch with an up bias */
    const dx = dir.x * 0.35 + (rnd() - 0.5) * 1.6;
    const dy = dir.y * 0.35 + 0.4 + rnd() * 0.9;
    const dz = dir.z * 0.35 + (rnd() - 0.5) * 1.6;

    const spin = rnd() * Math.PI * 2;
    const sl = leafScale * (0.6 + rnd() * 0.45);   // length
    const sw = sl * (0.75 + rnd() * 0.6);          // width variation

    /* colour: cluster hue + per-leaf jitter + height sun tint */
    const sun = clamp(point.y / Math.max(0.8, treeH), 0, 1) * (0.35 + rnd() * 0.35);
    _c1.setRGB(
      clamp(base.r + jr + (rnd() - 0.5) * 0.06, 0, 1),
      clamp(base.g + jg + (rnd() - 0.5) * 0.07, 0, 1),
      clamp(base.b + jb + (rnd() - 0.5) * 0.04, 0, 1)
    ).lerp(LEAF_SUN, sun * 0.5);

    pushLeaf(out, rnd() < 0.55, px, py, pz, dx, dy, dz, spin, sl, sw, _c1.r, _c1.g, _c1.b);
  }
}

/* recursive branch skeleton — same spread/azimuth math as the
   original procedural tree viewer, baked as shared instances */
function growBranch(out, origin, dir, length, radius, depth, cfg, rnd, treeH, leafK) {
  const end = origin.clone().addScaledVector(dir, length);
  pushBranch(out, origin, dir, radius, length, 1 - depth / cfg.maxDepth);

  if (depth === 0) {
    /* leaf cluster at the twig tip */
    addLeafCluster(out, end, dir,
      Math.max(2, Math.round((3 + rnd() * 4) * cfg.leafDensity * leafK)),
      rnd, treeH, cfg.leafScale);
    /* sometimes a smaller cluster mid-twig */
    if (rnd() < 0.45) {
      addLeafCluster(out, origin.clone().lerp(end, 0.5), dir,
        Math.max(1, Math.round((2 + rnd() * 2) * cfg.leafDensity * leafK)),
        rnd, treeH, cfg.leafScale);
    }
    return;
  }

  const isTrunk = depth === cfg.maxDepth;
  const nSplits = isTrunk ? cfg.trunkSplits : cfg.branchSplits + (rnd() < 0.3 ? 1 : 0);

  for (let c = 0; c < nSplits; c++) {
    if (!isTrunk && rnd() < 0.12) continue;        // natural gaps in the crown
    const leader = isTrunk && c === 0 && cfg.leader;
    const tilt = leader
      ? 0.05 + rnd() * 0.09
      : cfg.spread * (0.75 + rnd() * 0.6);
    const az = (c / nSplits) * Math.PI * 2 + rnd() * 1.4;

    const child = dir.clone()
      .applyAxisAngle(_ZAX, tilt * (rnd() > 0.5 ? 1 : -1))
      .applyAxisAngle(_YAX, az);

    const lenK = leader ? cfg.leaderLen : 0.6 + rnd() * 0.16;
    growBranch(out, end, child, length * lenK, radius * 0.62, depth - 1, cfg, rnd, treeH, leafK);
  }

  /* foliage sprinkled along outer branches so the branch
     structure stays visible through gaps in the leaves */
  if (depth === 1) {
    const n = 1 + ((rnd() * 2) | 0);
    for (let s = 0; s < n; s++) {
      const t = 0.45 + rnd() * 0.5;
      addLeafCluster(out, origin.clone().lerp(end, t), dir,
        Math.max(1, Math.round((2 + rnd() * 3) * cfg.leafDensity * leafK)),
        rnd, treeH, cfg.leafScale);
    }
  }
}

function growLeafyTree(out, kind, x, groundY, z, rnd, leafK) {
  const cfg = TREE_KINDS[kind];
  const trunkLen = cfg.trunkLen[0] + rnd() * cfg.trunkLen[1];
  const trunkR = cfg.trunkR[0] + rnd() * cfg.trunkR[1];
  const treeH = trunkLen * 1.9;                    // approx crown top for sun tint

  /* whole-tree lean — no two trees stand identically */
  const lean = 0.03 + rnd() * 0.13;
  const leanAz = rnd() * Math.PI * 2;
  const dir0 = V(
    Math.sin(lean) * Math.cos(leanAz),
    Math.cos(lean),
    Math.sin(lean) * Math.sin(leanAz)
  );

  const base = V(x, groundY - 0.15, z);
  growBranch(out, base, dir0, trunkLen, trunkR, cfg.maxDepth, cfg, rnd, treeH, leafK);
}

/* bake collected branches/leaves into 3 InstancedMeshes */
function bakeForest(group, forest) {
  if (!forest.branches.length && !forest.leafA.length && !forest.leafB.length) return;

  const woodMat = std({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
  const leafMat = std({
    vertexColors: true, roughness: 0.85, metalness: 0,
    side: THREE.DoubleSide, flatShading: true,   // opaque, solid foliage
  });

  /* tapered branch — base at origin, extends +Y */
  const branchGeo = new THREE.CylinderGeometry(0.62, 1, 1, 5, 1);
  branchGeo.translate(0, 0.5, 0);
  const leafGeoA = makeLeafGeometry(0.5, 0.16, 0.07);   // broad curved leaf
  const leafGeoB = makeLeafGeometry(0.3, 0.3, 0.045);   // narrow curlier leaf

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
        p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();

  function bakeLeaves(list, geo) {
    const mesh = new THREE.InstancedMesh(geo, leafMat, list.length);
    list.forEach((rec, i) => {
      q.set(rec.qx, rec.qy, rec.qz, rec.qw);
      m.compose(p.set(rec.x, rec.y, rec.z), q, s.set(rec.sx, rec.sy, rec.sz));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setRGB(rec.r, rec.g, rec.b));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  if (forest.branches.length) {
    const wood = new THREE.InstancedMesh(branchGeo, woodMat, forest.branches.length);
    forest.branches.forEach((b, i) => {
      q.set(b.qx, b.qy, b.qz, b.qw);
      m.compose(p.set(b.x, b.y, b.z), q, s.set(b.sx, b.sy, b.sz));
      wood.setMatrixAt(i, m);
      c.copy(WOOD_TRUNK).lerp(WOOD_TWIG, b.t);
      wood.setColorAt(i, c);
    });
    wood.castShadow = wood.receiveShadow = true;
    wood.frustumCulled = false;
    group.add(wood);
  }
  if (forest.leafA.length) bakeLeaves(forest.leafA, leafGeoA);
  if (forest.leafB.length) bakeLeaves(forest.leafB, leafGeoB);
}

/* ============================================================
   FOREST ENVIRONMENT — terrain, grass, leafy shrubs, rocks,
   leafy trees
   ============================================================ */
function buildTerrain() {
  const group = new THREE.Group();
  const noise = makeNoise(1337);
  const noise2 = makeNoise(9241);

  const PADS = [
    { x: -15, z: 0, r: 8 },                        // BIG rig pad
    { x: 19, z: 0, r: 6 },                         // SMALL rig pad (moved out)
  ];
  const ROAD = { x0: -8, x1: 13, halfW: 2.4 };     // dirt track between pads

  function padFactor(x, z) {
    let f = 1;
    for (const p of PADS) {
      const d = Math.hypot(x - p.x, z - p.z);
      f = Math.min(f, clamp((d - p.r * 0.55) / (p.r * 0.45), 0, 1));
    }
    const rx = clamp(x, ROAD.x0, ROAD.x1);
    const rd = Math.hypot(x - rx, z);
    f = Math.min(f, clamp((rd - ROAD.halfW * 0.5) / (ROAD.halfW * 0.9), 0, 1));
    return f;
  }
  function heightAt(x, z) {
    const f = padFactor(x, z);
    const h = (noise(x * 0.055, z * 0.055) - 0.45) * 3.2 + (noise2(x * 0.16, z * 0.16) - 0.5) * 0.9;
    return h * f;
  }

  /* ground with vertex colors */
  const geo = new THREE.PlaneGeometry(200, 200, 88, 88);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x2f4a2a), cGrass2 = new THREE.Color(0x233d1c),
        cSoil = new THREE.Color(0x4a3a26), cSoil2 = new THREE.Color(0x3c2f1e),
        cRock = new THREE.Color(0x454138);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const f = padFactor(x, z);
    const soil = 1 - f;
    c.copy(cGrass).lerp(cGrass2, noise(x * 0.13, z * 0.13));
    const n = noise2(x * 0.09 + 40, z * 0.09 - 17);
    if (n > 0.62) c.lerp(cRock, (n - 0.62) * 1.4);
    if (soil > 0) {
      c.lerp(cSoil2, soil * 0.55);
      if (soil > 0.75) c.lerp(cSoil, (soil - 0.75) * 3);
    }
    const dist = Math.hypot(x, z);
    if (dist > 55) c.lerp(cRock, clamp((dist - 55) / 60, 0, 0.5));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0, flatShading: true,
  }));
  ground.receiveShadow = true;
  group.add(ground);

  /* scatter helper (rejection sampling, off the pads & road) */
  const rnd = mulberry32(20240);
  const clearOfWorkArea = (x, z) => padFactor(x, z) > 0.85 && Math.hypot(x, z) < 70;
  function scatter(count, minR, maxR, extra) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 80) {
      const a = rnd() * Math.PI * 2, rr = minR + rnd() * (maxR - minR);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (!clearOfWorkArea(x, z)) continue;
      if (extra && !extra(x, z)) continue;
      out.push([x, z]);
    }
    return out;
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
        e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  const fillRest = (mesh, n, placed) => {
    for (let i = placed; i < n; i++) {
      m.compose(pv.set(0, -60, 0), q.identity(), sc.set(0.001, 0.001, 0.001));
      mesh.setMatrixAt(i, m);
    }
  };

  /* shared collector for all woody plants (shrubs + trees) */
  const forest = makeForestCollector();

  /* grass tufts (instanced) */
  {
    const gGeo = new THREE.ConeGeometry(0.1, 0.55, 4); gGeo.translate(0, 0.27, 0);
    const gMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
    const G = 760, pts = scatter(G, 5, 62);
    const grass = new THREE.InstancedMesh(gGeo, gMat, G);
    const gc = [new THREE.Color(0x3b5a2c), new THREE.Color(0x2e4a24), new THREE.Color(0x466334)];
    pts.forEach(([x, z], i) => {
      const s = 0.7 + rnd() * 0.9;
      e.set((rnd() - 0.5) * 0.35, rnd() * Math.PI, (rnd() - 0.5) * 0.35);
      q.setFromEuler(e);
      m.compose(pv.set(x, heightAt(x, z), z), q, sc.set(s, s * (0.8 + rnd() * 0.7), s));
      grass.setMatrixAt(i, m);
      grass.setColorAt(i, gc[(rnd() * 3) | 0]);
    });
    fillRest(grass, G, pts.length);
    grass.receiveShadow = true;
    group.add(grass);
  }

  /* shrubs — leafy now (same positions/scales as the old blob
     bushes). Exactly 4 shared-seed rnd() calls per shrub (same
     as before) so the downstream scatter positions are
     unchanged; the leaf detail uses a local seeded rng. */
  {
    const B = 56;
    const pts = scatter(B, 8, 60);
    pts.forEach(([x, z], i) => {
      const s = 0.8 + rnd() * 1.2;                 // shared-seed call 1
      const sy = 0.55 + rnd() * 0.5;               // shared-seed call 2
      const yaw = rnd() * Math.PI;                 // shared-seed call 3
      const cseed = (rnd() * 3) | 0;               // shared-seed call 4
      const br = mulberry32(9000 + i * 131 + cseed * 17);

      const base = V(x, heightAt(x, z) + 0.25 * sy, z);
      const nStems = 3 + ((br() * 3) | 0);
      for (let st = 0; st < nStems; st++) {
        const sa = yaw + br() * Math.PI * 2;
        const tilt = 0.35 + br() * 0.5;
        const dir = V(
          Math.sin(tilt) * Math.cos(sa),
          Math.cos(tilt),
          Math.sin(tilt) * Math.sin(sa)
        );
        const len = (0.5 + br() * 0.5) * s;
        const end = base.clone().addScaledVector(dir, len);
        pushBranch(forest, base, dir, 0.045 * s, len, 1);
        addLeafCluster(forest, end, dir,
          3 + ((br() * 4) | 0), br, 1.6 * s * (0.6 + sy), 0.45 * s + 0.2);
      }
    });
  }

  /* rocks (instanced) */
  {
    const rGeo = new THREE.DodecahedronGeometry(0.42, 0);
    const rMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02, flatShading: true });
    const R = 42, pts = scatter(R, 6, 62);
    const rocks = new THREE.InstancedMesh(rGeo, rMat, R);
    const rc = [new THREE.Color(0x5b564b), new THREE.Color(0x4c473d), new THREE.Color(0x6a6154)];
    pts.forEach(([x, z], i) => {
      const s = 0.35 + rnd() * 1.1;
      e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
      m.compose(pv.set(x, heightAt(x, z) + 0.1 * s, z), q, sc.set(s, s * (0.6 + rnd() * 0.5), s));
      rocks.setMatrixAt(i, m);
      rocks.setColorAt(i, rc[(rnd() * 3) | 0]);
    });
    fillRest(rocks, R, pts.length);
    rocks.castShadow = rocks.receiveShadow = true;
    group.add(rocks);
  }

  /* forest — natural trunks, branches and hundreds of individual
     leaves per tree (SAME placement positions as before) */
  {
    const TREES = 28;
    const treePts = scatter(TREES, 14, 56, (x, z) => !(z > 4 && Math.abs(x) < 30));

    treePts.forEach(([x, z]) => {
      const roll = rnd();
      const kind = roll < 0.42 ? 'broad' : roll < 0.76 ? 'tall' : 'bush';
      const dist = Math.hypot(x, z);
      /* distant trees carry fewer leaves (cheap distance LOD) */
      const leafK = clamp(1.15 - (dist - 14) / 70, 0.45, 1.1);
      growLeafyTree(forest, kind, x, heightAt(x, z), z, rnd, leafK);
    });

    bakeForest(group, forest);
  }

  /* distant hills (forest-edge silhouettes) */
  {
    const hGeo = new THREE.DodecahedronGeometry(1, 0);
    const hMat = new THREE.MeshStandardMaterial({ color: 0x1c2f23, roughness: 1, flatShading: true });
    const H = 9;
    const hills = new THREE.InstancedMesh(hGeo, hMat, H);
    const hr = mulberry32(777);
    for (let i = 0; i < H; i++) {
      const a = (i / H) * Math.PI * 2 + hr() * 0.6;
      const rr = 70 + hr() * 16;
      e.set(0, hr() * Math.PI, 0); q.setFromEuler(e);
      m.compose(pv.set(Math.cos(a) * rr, -1, Math.sin(a) * rr), q, sc.set(16 + hr() * 9, 4 + hr() * 5, 11 + hr() * 7));
      hills.setMatrixAt(i, m);
    }
    group.add(hills);
  }

  return { group, heightAt, padFactor };
}

/* ============================================================
   EFFECTS — dust, smoke, ripples, water
   ============================================================ */
class Dust {
  constructor(parent, origin, accentHex, size) {
    this.N = 90; this.origin = origin;
    this.pos = new Float32Array(this.N * 3);
    this.col = new Float32Array(this.N * 3);
    this.parts = [];
    for (let i = 0; i < this.N; i++) this.parts.push({ life: -1, ttl: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0 });
    const geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3);
    this.ca = new THREE.BufferAttribute(this.col, 3);
    this.pa.setUsage(THREE.DynamicDrawUsage); this.ca.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa); geo.setAttribute('color', this.ca);
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size, map: softTex(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true,
    }));
    this.pts.frustumCulled = false;
    this.base = new THREE.Color(0xc09a6e).lerp(new THREE.Color(accentHex), 0.25);
    parent.add(this.pts);
  }
  burst(n) {
    for (let k = 0; k < n; k++) {
      const i = this.parts.findIndex((p) => p.life < 0 || p.life >= p.ttl);
      if (i < 0) return;
      const p = this.parts[i], a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 1.3;
      p.x = this.origin.x + (Math.random() - 0.5) * 0.25;
      p.z = this.origin.z + (Math.random() - 0.5) * 0.25;
      p.y = this.origin.y + Math.random() * 0.1;
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = 0.9 + Math.random() * 1.5;
      p.ttl = 0.7 + Math.random() * 0.7; p.life = 0;
    }
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.N; i++) {
      const p = this.parts[i];
      if (p.life >= 0 && p.life < p.ttl) {
        p.life += dt; p.vy -= dt * 1.6;
        p.vx *= Math.exp(-dt * 1.6); p.vz *= Math.exp(-dt * 1.6);
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.25; }
        if (p.life >= p.ttl) {
          this.pos[i * 3 + 1] = -99;
          this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
          any = true; continue;
        }
        const k = 1 - p.life / p.ttl, f = k * k;
        this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = this.base.r * f; this.col[i * 3 + 1] = this.base.g * f; this.col[i * 3 + 2] = this.base.b * f;
        any = true;
      }
    }
    if (any) { this.pa.needsUpdate = true; this.ca.needsUpdate = true; }
  }
}

class Smoke {
  constructor(parent, anchor) {
    this.anchor = anchor; this.pool = []; this.acc = 0; this.rate = 0.45;
    const geo = new THREE.SphereGeometry(1, 8, 6);
    for (let i = 0; i < 14; i++) {
      const mm = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0x3d454f, transparent: true, opacity: 0, roughness: 1, metalness: 0, depthWrite: false,
      }));
      mm.visible = false; mm.userData = { age: -1 };
      parent.add(mm); this.pool.push(mm);
    }
  }
  spawn(boost = 1) {
    const mm = this.pool.find((p) => p.userData.age < 0);
    if (!mm) return;
    const u = mm.userData;
    u.ttl = 1.3 + Math.random() * 0.8; u.age = 0; u.ph = Math.random() * 9;
    u.p = this.anchor.clone().add(V((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.1));
    u.vx = (Math.random() - 0.5) * 0.3 + 0.15;
    u.vz = (Math.random() - 0.5) * 0.3;
    u.vy = 0.7 + Math.random() * 0.5;
    u.s0 = 0.09 * boost; u.s1 = (0.42 + Math.random() * 0.25) * boost;
    u.o = 0.6 + 0.4 * Math.random();
    mm.visible = true;
  }
  burst(n) { for (let i = 0; i < n; i++) this.spawn(1.6); }
  update(dt, t) {
    this.acc += dt * this.rate;
    while (this.acc > 1) { this.acc -= 1; this.spawn(); }
    for (const mm of this.pool) {
      const u = mm.userData;
      if (u.age < 0) continue;
      u.age += dt;
      const k = u.age / u.ttl;
      if (k >= 1) { u.age = -1; mm.visible = false; continue; }
      u.p.y += u.vy * dt;
      u.p.x += u.vx * dt + Math.sin((t + u.ph) * 3) * dt * 0.25;
      u.p.z += u.vz * dt;
      u.vy *= Math.exp(-dt * 0.35);
      mm.position.copy(u.p);
      mm.scale.setScalar(u.s0 + (u.s1 - u.s0) * k);
      mm.material.opacity = 0.28 * Math.sin(Math.PI * Math.min(k, 1)) * u.o;
    }
  }
}

class Ripple {
  constructor(parent, x, rIn, color) {
    this.rings = [];
    for (let i = 0; i < 3; i++) {
      const mm = new THREE.Mesh(
        new THREE.RingGeometry(rIn, rIn * 1.32, 28),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
      );
      mm.rotation.x = -Math.PI / 2;
      mm.position.set(x, 0.045, 0);
      mm.userData.t = -1;
      parent.add(mm); this.rings.push(mm);
    }
    this.next = 0;
  }
  emit() { const mm = this.rings[this.next++ % 3]; mm.userData.t = 0; }
  update(dt) {
    for (const mm of this.rings) {
      if (mm.userData.t < 0) continue;
      mm.userData.t += dt;
      const k = mm.userData.t / 1.1;
      if (k >= 1) { mm.userData.t = -1; mm.material.opacity = 0; continue; }
      const s = 0.7 + k * 1.6;
      mm.scale.set(s, s, 1);
      mm.material.opacity = 0.4 * (1 - k) * (k < 0.15 ? k / 0.15 : 1);
    }
  }
}

class Drops { /* water droplets */
  constructor(parent) {
    this.N = 110;
    this.pos = new Float32Array(this.N * 3);
    this.col = new Float32Array(this.N * 3);
    this.parts = [];
    for (let i = 0; i < this.N; i++) this.parts.push({ life: -1, ttl: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0 });
    const geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3);
    this.ca = new THREE.BufferAttribute(this.col, 3);
    this.pa.setUsage(THREE.DynamicDrawUsage); this.ca.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa); geo.setAttribute('color', this.ca);
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.17, map: softTex(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true,
    }));
    this.pts.frustumCulled = false;
    this.base = new THREE.Color(0x9fdcf2);
    parent.add(this.pts);
  }
  spawn(n, y) {
    for (let k = 0; k < n; k++) {
      const i = this.parts.findIndex((p) => p.life < 0 || p.life >= p.ttl);
      if (i < 0) return;
      const p = this.parts[i], a = Math.random() * Math.PI * 2, sp = 0.25 + Math.random() * 1.2;
      p.x = (Math.random() - 0.5) * 0.22; p.z = (Math.random() - 0.5) * 0.22; p.y = y;
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = 2.6 + Math.random() * 2.6;
      p.ttl = 0.65 + Math.random() * 0.55; p.life = 0;
    }
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.N; i++) {
      const p = this.parts[i];
      if (p.life >= 0 && p.life < p.ttl) {
        p.life += dt; p.vy -= dt * 7.5;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.life >= p.ttl || p.y < 0) {
          this.pos[i * 3 + 1] = -99;
          this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
          any = true; continue;
        }
        const k = 1 - p.life / p.ttl, f = k * k;
        this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = this.base.r * f; this.col[i * 3 + 1] = this.base.g * f; this.col[i * 3 + 2] = this.base.b * f;
        any = true;
      }
    }
    if (any) { this.pa.needsUpdate = true; this.ca.needsUpdate = true; }
  }
}

class WaterJet {
  /* borewell water strike: column + spray cone + droplets + ripples + wet patch */
  constructor(parent, x, k = 1) {
    this.k = k;
    const g = this.group = new THREE.Group();
    g.position.set(x, 0, 0); parent.add(g);

    const colGeo = new THREE.CylinderGeometry(0.15, 0.2, 1, 10, 1, true);
    colGeo.translate(0, 0.5, 0);
    this.colMat = new THREE.MeshStandardMaterial({
      color: 0xaee6ff, emissive: 0x2fa8d8, emissiveIntensity: 1,
      transparent: true, opacity: 0, roughness: 0.18, metalness: 0,
      depthWrite: false, side: THREE.DoubleSide,
    });
    this.col = new THREE.Mesh(colGeo, this.colMat);
    this.col.position.y = 0.5; this.col.scale.set(1, 0.02, 1);
    g.add(this.col);

    const mistGeo = new THREE.CylinderGeometry(0.62, 0.26, 1.5, 10, 1, true);
    mistGeo.translate(0, 0.75, 0);
    this.mistMat = new THREE.MeshStandardMaterial({
      color: 0x8fd8f2, emissive: 0x2fa8d8, emissiveIntensity: 0.5,
      transparent: true, opacity: 0, roughness: 0.3, metalness: 0,
      depthWrite: false, side: THREE.DoubleSide,
    });
    this.mist = new THREE.Mesh(mistGeo, this.mistMat);
    this.mist.position.y = 0.4; g.add(this.mist);

    this.collarMat = new THREE.MeshStandardMaterial({
      color: 0x0a2530, emissive: 0x35c8ea, emissiveIntensity: 0, roughness: 0.4,
    });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 10, 26), this.collarMat);
    collar.rotation.x = Math.PI / 2; collar.position.y = 0.58; g.add(collar);

    this.wetMat = new THREE.MeshStandardMaterial({
      color: 0x223238, transparent: true, opacity: 0,
      roughness: 0.3, metalness: 0.05, depthWrite: false,
    });
    const wet = new THREE.Mesh(new THREE.CircleGeometry(2.4, 26), this.wetMat);
    wet.rotation.x = -Math.PI / 2; wet.position.y = 0.035; g.add(wet);

    this.drops = new Drops(g);
    this.ripple = new Ripple(g, 0, 0.3, 0x54c8ec);
    this.light = new THREE.PointLight(0x3ec6f0, 0, 10, 2);
    this.light.position.set(0, 1.3, 0); g.add(this.light);

    this.level = 0; this.wet = 0; this.phase = 'off';
    this._rip = 0; this._acc = 0;
  }
  erupt() { this.phase = 'erupt'; }
  subside() { this.phase = 'subside'; }
  update(dt, t) {
    if (this.phase === 'erupt') {
      this.level = Math.min(1, this.level + dt / 0.9);
      if (this.level >= 1) this.phase = 'flow';
    } else if (this.phase === 'subside') {
      this.level = Math.max(0, this.level - dt / 1.1);
      if (this.level <= 0) this.phase = 'off';
    }
    const l = this.level, k = this.k;
    this.wet += ((l > 0.15 ? 1 : 0) - this.wet) * Math.min(1, dt * (l > 0.15 ? 0.9 : 0.35));
    const wob = 1 + 0.09 * Math.sin(t * 11) + 0.05 * Math.sin(t * 17.3);
    this.col.visible = l > 0.02;
    this.col.scale.set(wob, Math.max(0.02, l * (1.5 * k + 0.3 * Math.sin(t * 6.2))), wob);
    this.colMat.opacity = 0.5 * l;
    this.mist.visible = l > 0.1;
    this.mist.scale.set(wob, Math.max(0.02, l * 1.05 * k), wob);
    this.mistMat.opacity = 0.15 * l;
    this.collarMat.emissiveIntensity = 1.2 * l + (l > 0.2 ? 0.4 * Math.sin(t * 8) : 0);
    this.wetMat.opacity = 0.4 * this.wet;
    this.light.intensity = l * (22 * k + 7 * Math.sin(t * 9));
    if (l > 0.25) {
      this._acc += dt * l * 80 * k;
      while (this._acc > 1) { this._acc -= 1; this.drops.spawn(1, 0.5 + l * 0.9 * k); }
      this._rip += dt;
      if (this._rip > 0.42) { this._rip = 0; this.ripple.emit(); }
    }
    this.drops.update(dt);
    this.ripple.update(dt);
  }
}

/* ============================================================
   MachineUnit — hover story:
   idle (rigged, ready) → drill down + dust → water erupts at
   the borehole → rod trips back up → water flows → subsides.
   Leaving the machine at ANY point gracefully resets it.
   ============================================================ */
class MachineUnit {
  constructor(viewer, key) {
    const cfg = this.cfg = MACHINES[key];
    this.viewer = viewer; this.key = key;
    this.hover = 0; this.hoverT = 0; this.flash = 0;

    this.root = new THREE.Group();
    this.root.position.set(cfg.place.x, 0, cfg.place.z);
    this.root.rotation.y = cfg.place.yaw;
    viewer.scene.add(this.root);

    this.rig = cfg.builder(cfg.hex);
    this.root.add(this.rig);
    const u = this.u = this.rig.userData;

    /* invisible hitbox for hover / click raycasting */
    const hb = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.hitbox.w, cfg.hitbox.h, cfg.hitbox.d),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hb.position.y = cfg.hitbox.cy;
    hb.userData.key = key;
    this.root.add(hb);
    this.hitbox = hb;

    /* ground glow ring + colored accent light */
    this.ringMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.hex).multiplyScalar(0.25),
      emissive: cfg.hex, emissiveIntensity: 0,
      transparent: true, opacity: 0, roughness: 0.6,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(cfg.ringR, 0.07, 10, 80), this.ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    this.root.add(ring);

    this.light = new THREE.PointLight(cfg.hex, 0, 26, 2);
    this.light.position.set(0, 5, 4);
    this.root.add(this.light);

    /* effects */
    this.dust = new Dust(this.root, V(u.holeX, 0.35, 0), cfg.hex, 0.22);
    this.smoke = new Smoke(this.root, u.smokeAnchor);
    this.ripple = new Ripple(this.root, u.holeX, 0.34, 0x8a7a5e);
    this.water = new WaterJet(this.root, u.holeX, cfg.waterScale);

    /* fully rigged + ready from the first frame (machine always visible) */
    this.state = 'idle';
    this.autoDrill = false;
    this.mastAngle = 0; this.mastTarget = 0;
    this.locked = true; this.ready = true; this.pipeRun = 1;
    this.bitLocal = u.bitTopLocal;
    this.drill = { phase: 'idle', head: u.headTopLocal, wait: 0 };
    this.depthFt = 0; this.waterFound = false; this.flowT = 0;
    u.bitGroup.visible = true;
    u.collar.visible = true;
    u.hole.visible = true;
    this.smoke.burst(2);
    this.flash = 0.5;
    this._spin = Math.random() * 6;
    this._lastHead = u.headTopLocal; this._lastAngle = 0;
    this._dustAcc = 0; this._rippleAcc = 0;
  }

  /* ---- public API ---- */
  setHover(on) {
    this.hoverT = on ? 1 : 0;
    if (on) {
      this.autoDrill = true;
      if (this.state === 'idle') { this.state = 'drilling'; this.drill.phase = 'down'; }
    } else {
      this.autoDrill = false;
      if (this.state === 'drilling' || this.state === 'tripping' || this.state === 'flowing') {
        if (this.waterFound) this.water.subside();
        this.state = 'recover';
      }
    }
  }
  powerFlash() {
    this.flash = 1;
    this.dust.burst(14); this.smoke.burst(4);
  }
  startDrill() {
    this.autoDrill = true;
    if (this.state === 'idle') { this.state = 'drilling'; this.drill.phase = 'down'; }
  }
  stopDrill() {
    this.autoDrill = false;
    if (this.state === 'drilling' || this.state === 'tripping') {
      if (this.waterFound) this.water.subside();
      this.state = 'recover';
    }
  }
  drillDepth() { return this.depthFt; }
  showWaterDiscovery() {
    if (this.state !== 'flowing') {
      this.drill.phase = 'idle';
      this.drill.head = this.u.headTopLocal;
      this.bitLocal = this.u.bitTopLocal;
      this.depthFt = this.cfg.waterDepth;
      this.waterFound = true;
      this.water.erupt();
      this.state = 'flowing'; this.flowT = 0;
    }
  }
  startWaterEffect() { this.showWaterDiscovery(); }
  stopWaterEffect() {
    if (this.waterFound) { this.waterFound = false; this.water.subside(); }
    if (this.state === 'flowing') { this.state = 'idle'; this.depthFt = 0; }
  }

  _updateHose(u) {
    const h = u.hose; if (!h) return;
    let end;
    if (h.local) {
      end = _hv.copy(u.head.position).add(h.toOff);
    } else {
      u.head.getWorldPosition(_hv); this.rig.worldToLocal(_hv);
      end = _hv.add(h.toOff);
    }
    const moved = end.distanceToSquared(h.lastEnd) > 0.0004;
    const rotated = Math.abs(this.mastAngle - h.lastAngle) > 0.008;
    if (!h.mesh.geometry || moved || rotated) {
      h.lastEnd.copy(end); h.lastAngle = this.mastAngle;
      const mid = new THREE.Vector3().addVectors(h.from, end).multiplyScalar(0.5);
      mid.z += h.sag; mid.y -= h.drop;
      const curve = new THREE.CatmullRomCurve3([h.from, mid, end]);
      if (h.mesh.geometry && h.mesh.geometry.attributes) h.mesh.geometry.dispose();
      h.mesh.geometry = new THREE.TubeGeometry(curve, 14, h.r, 7, false);
    }
  }

  update(dt, t) {
    const u = this.u, cfg = this.cfg, d = this.drill;

    this.hover += (this.hoverT - this.hover) * Math.min(1, dt * 6);
    this.flash *= Math.exp(-dt * 2.6);

    /* mast stays vertical (machines are always fully visible) */
    u.mast.rotation.z = this.mastAngle;

    /* ---- scripted hover story ---- */
    const span = u.headTopLocal - u.headLowLocal;

    if (this.state === 'drilling') {
      d.head -= span * dt / cfg.drill.downSec;
      const pr = clamp((u.headTopLocal - d.head) / span, 0, 1);
      this.depthFt = cfg.waterDepth * pr;
      this.bitLocal = lerp(u.bitTopLocal, u.bitDeepLocal, pr);
      this._dustAcc += dt * 22;
      while (this._dustAcc > 1) { this._dustAcc -= 1; this.dust.burst(1); }
      this._rippleAcc += dt;
      if (this._rippleAcc > 0.5) { this._rippleAcc = 0; this.ripple.emit(); }
      if (d.head <= u.headLowLocal) {
        d.head = u.headLowLocal;
        this.bitLocal = u.bitDeepLocal;
        this.depthFt = cfg.waterDepth;
        this.waterFound = true;
        this.water.erupt();
        this.dust.burst(18);
        d.phase = 'up';
        this.state = 'tripping';
      }
    } else if (this.state === 'tripping') {
      d.head += span * dt / cfg.drill.upSec;
      const pr = clamp((d.head - u.headLowLocal) / span, 0, 1);
      this.bitLocal = lerp(u.bitDeepLocal, u.bitTopLocal, pr);
      this._dustAcc += dt * 6;
      while (this._dustAcc > 1) { this._dustAcc -= 1; this.dust.burst(1); }
      if (d.head >= u.headTopLocal) {
        d.head = u.headTopLocal;
        this.bitLocal = u.bitTopLocal;
        d.phase = 'idle';
        this.state = 'flowing'; this.flowT = 0;
      }
    } else if (this.state === 'flowing') {
      this.flowT += dt;
      if (this.flowT > cfg.flowSec) {
        this.water.subside();
        this.waterFound = false;
        this.depthFt = 0;
        this.state = 'idle';
      }
    } else if (this.state === 'recover') {
      d.head += span * dt / Math.max(0.8, cfg.drill.upSec * 0.8);
      const pr = clamp((d.head - u.headLowLocal) / span, 0, 1);
      this.bitLocal = lerp(u.bitDeepLocal, u.bitTopLocal, pr);
      if (d.head >= u.headTopLocal) {
        d.head = u.headTopLocal;
        this.bitLocal = u.bitTopLocal;
        d.phase = 'idle';
        this.depthFt = 0;
        this.waterFound = false;
        this.state = this.autoDrill ? 'drilling' : 'idle';
        if (this.state === 'drilling') d.phase = 'down';
      }
    }

    /* head / kelly / bit */
    const vib = this.state === 'drilling';
    const wob = vib ? Math.sin(t * 31) * 0.02 : 0;
    u.head.position.y = d.head + wob;
    const pipeTop = d.head - u.headOff;
    u.pipe.position.y = pipeTop;
    u.pipe.scale.y = Math.max(0.02, pipeTop - this.bitLocal);
    u.bitGroup.position.y = this.bitLocal;

    const spinMul = this.state === 'drilling' ? 1
      : this.state === 'tripping' ? 0.3
      : this.state === 'flowing' ? 0.15 : 0.08;
    const spinRate = spinMul * cfg.drill.rpm * 0.105 + this.flash * 22;
    this._spin += spinRate * dt;
    u.pipe.rotation.y = this._spin;
    u.bitGroup.rotation.y = this._spin * 1.7;
    for (const cn of u.cones) cn.rotation.y += dt * (vib ? 9 : 1.2);

    /* dynamic rigging */
    for (const cb of u.cables) updateBar(cb.mesh, cb.from, _b.copy(u.head.position).add(cb.off));
    for (const f of u.feed) updateBar(f.mesh, f.from, _b.copy(u.head.position).add(f.off));
    const dHead = d.head - this._lastHead;
    this._lastHead = d.head;
    if (u.drum) u.drum.rotation.y += dHead * 6;
    for (const s of u.sheaves) s.rotation.y += dHead * 5;

    /* vibration */
    this.rig.position.set(Math.sin(t * 53) * 0.013 * (vib ? 1 : 0), Math.sin(t * 47) * 0.011 * (vib ? 1 : 0), 0);

    this.root.updateMatrixWorld(true);
    for (const h of u.hyd) {
      h.anchor.getWorldPosition(_a); this.rig.worldToLocal(_a);
      updateBar(h.mesh, h.base, _a);
    }
    if (u.fastline) {
      u.fastline.anchor.getWorldPosition(_a); this.rig.worldToLocal(_a);
      updateBar(u.fastline.mesh, u.fastline.base, _a);
    }
    this._updateHose(u);

    /* beacons / LEDs / cab glow */
    const bm = u.beaconMat;
    if (this.waterFound) bm.emissiveIntensity = Math.sin(t * 16) > 0 ? 3.6 : 0.15;
    else if (this.state === 'drilling') bm.emissiveIntensity = Math.sin(t * 15) > 0 ? 3.4 : 0.15;
    else bm.emissiveIntensity = 1 + Math.sin(t * 2.2) * 0.7 + this.flash * 3;
    if (u.ledMat) u.ledMat.emissiveIntensity = this.state === 'drilling' ? 1.6 + Math.sin(t * 9) * 0.8 : 0.7;
    if (u.cabLight) u.cabLight.intensity = 1.6 + (this.state === 'drilling' ? 2.2 : 0) + this.flash * 4;
    if (u.dashMat) u.dashMat.emissiveIntensity = 0.5 + (this.state === 'drilling' ? 0.8 : 0);

    /* hover glow */
    this.ringMat.opacity = this.hover * 0.85;
    this.ringMat.emissiveIntensity = 0.4 + 2.6 * this.hover + this.flash * 3 + 0.15 * Math.sin(t * 1.6);
    this.light.intensity = 26 * this.hover + 80 * this.flash;

    /* effects */
    this.smoke.rate = this.state === 'drilling' ? 4
      : this.state === 'flowing' ? 2
      : this.hoverT > 0 ? 1.4 : 0.45;
    if (this.flash > 0.2) this.smoke.rate += 6;
    this.smoke.update(dt, t);
    this.dust.update(dt);
    this.ripple.update(dt);
    this.water.update(dt, t);
  }
}

/* ============================================================
   RigViewer — ONE forest scene, both machines, lorry + pipes,
   camera, hover/click, floating label, VISIBLE error reporting,
   guaranteed first paint, safe disposal.
   ============================================================ */
export class RigViewer {
  constructor({ canvas, onHover, onSelect, onError }) {
    this.canvas = canvas;
    this.onHover = onHover; this.onSelect = onSelect; this.onError = onError;
    this.w = 0; this.h = 0; this.disposed = false;
    this._raf = 0; this._last = performance.now();
    this._hoverKey = null; this._userMoved = false; this._autoTimer = null;
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._down = { x: 0, y: 0, moved: false };
    this._bound = [];
    this._reported = {};
    this._labelEl = null; this._labelSub = null;
    this._retryTimers = [];
    this.units = {};

    /* renderer — attached to the provided canvas (renderer.domElement === canvas) */
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const smallScreen = Math.min(window.screen.width, window.screen.height) < 720;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen ? 1.75 : 2));
    r.setClearColor(0x0d1f22, 1);                 // paint even an empty scene
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.06;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1f22);
    this.scene.fog = new THREE.Fog(0x152b28, 85, 230);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1200);
    this.camera.position.set(26, 21, 44);

    /* each subsystem builds independently — one failure never
       blanks the whole scene, and every failure is reported */
    this._buildEnvironment();

    this.controls = new OrbitControls(this.camera, canvas);
    const c = this.controls;
    c.target.set(1, 3.2, 0);                      // scene centre (machines ± lorry)
    c.enableDamping = true; c.dampingFactor = 0.07;
    c.enablePan = false;
    c.minDistance = 20; c.maxDistance = 160;
    c.minPolarAngle = 0.18; c.maxPolarAngle = 1.36;
    c.autoRotate = !REDUCED; c.autoRotateSpeed = 0.4;
    c.addEventListener('start', () => {
      this._userMoved = true;
      c.autoRotate = false;
      if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
    });
    c.addEventListener('end', () => {
      this._autoTimer = setTimeout(() => {
        if (!this.disposed && !REDUCED) c.autoRotate = true;
      }, 7000);
    });

    for (const key of ['big', 'small']) {
      try { this.units[key] = new MachineUnit(this, key); }
      catch (err) { this._fail('machine:' + key, err); }
    }

    this._bindEvents();

    /* sizing: ResizeObserver + window-resize fallback + retries */
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas.parentElement);
    this._onWinResize = () => this._resize();
    window.addEventListener('resize', this._onWinResize);
    for (const ms of [100, 350, 900]) {
      this._retryTimers.push(setTimeout(() => { if (!this.disposed) this._resize(); }, ms));
    }

    this._resize();        // sizes + frames + PAINTS immediately
    this._paint();         // guaranteed first-frame attempt

    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  /* ---------- error reporting (never silent) ---------- */
  _fail(tag, err) {
    if (this._reported[tag]) return;              // report each failure once
    this._reported[tag] = true;
    console.error('[rig3d] ' + tag + ' failed:', err);
    if (this.onError) { try { this.onError(err); } catch (_) { /* ignore */ } }
  }
  _paint() {
    if (this.disposed || !this.w || !this.renderer || !this.scene) return;
    try { this.renderer.render(this.scene, this.camera); }
    catch (err) { this._fail('render', err); }
  }

  /* ---------- public API (React-facing) ---------- */
  setHover(key) { this._setHover(key || null); }
  getHovered() { return this._hoverKey; }
  powerFlash(key) { const u = this.units[key]; if (u) u.powerFlash(); }
  startDrill(key) { const u = this.units[key]; if (u) u.startDrill(); }
  stopDrill(key) { const u = this.units[key]; if (u) u.stopDrill(); }
  drillDepth(key) { const u = this.units[key]; return u ? u.depthFt : 0; }
  showWaterDiscovery(key) { const u = this.units[key]; if (u) u.showWaterDiscovery(); }
  startWaterEffect(key) { this.showWaterDiscovery(key); }
  stopWaterEffect(key) { const u = this.units[key]; if (u) u.stopWaterEffect(); }
  setWaterDepth(key, depth) {
    if (MACHINES[key] && typeof depth === 'number') MACHINES[key].waterDepth = Math.max(1, depth);
  }

  /* ---------- internals ---------- */
  _buildEnvironment() {
    const s = this.scene;

    try {
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(600, 24, 12),
        new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
      );
      s.add(sky);
    } catch (err) { this._fail('sky', err); }

    try {
      s.add(new THREE.HemisphereLight(0x8fb0bf, 0x27301f, 0.8));
      const sun = new THREE.DirectionalLight(0xffd9a8, 2.4);
      sun.position.set(38, 44, 26);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera;
      sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60;
      sc.near = 5; sc.far = 180;
      sun.shadow.normalBias = 0.06; sun.shadow.bias = -0.0002;
      s.add(sun); s.add(sun.target);
      const fill = new THREE.DirectionalLight(0x2bd4bd, 0.35);
      fill.position.set(-30, 18, -24); s.add(fill);
      s.add(new THREE.AmbientLight(0x223038, 0.35));
    } catch (err) { this._fail('lights', err); }

    let heightAt = null;
    try {
      const terrain = buildTerrain();
      heightAt = terrain.heightAt;
      s.add(terrain.group);
    } catch (err) { this._fail('terrain', err); }
    const safeH = heightAt || ((x, z) => 0);

    try { s.add(buildWaterLorry(0x16a34a, safeH)); }
    catch (err) { this._fail('lorry', err); }

    try { s.add(buildLorryPipes(safeH)); }
    catch (err) { this._fail('pipes', err); }
  }

  _bindEvents() {
    const cv = this.canvas;
    const add = (type, fn, opt) => {
      cv.addEventListener(type, fn, opt);
      this._bound.push([type, fn]);
    };
    add('pointerdown', (e) => {
      this._down.x = e.clientX; this._down.y = e.clientY; this._down.moved = false;
    });
    add('pointermove', (e) => {
      if (e.buttons !== 0) {
        if (Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y) > 7) this._down.moved = true;
        return;
      }
      try { this._setHover(this._pick(e.clientX, e.clientY)); }
      catch (err) { this._fail('hover', err); }
    });
    add('pointerleave', () => this._setHover(null));
    add('click', (e) => {
      if (this._down.moved) return;                 // that was a camera drag
      try {
        const key = this._pick(e.clientX, e.clientY);
        if (key) {
          const u = this.units[key];
          if (u) u.powerFlash();
          if (this.onSelect) this.onSelect(key);    // React handles navigation
        }
      } catch (err) { this._fail('click', err); }
    });
    add('webglcontextlost', (e) => {
      e.preventDefault();
      this._fail('webgl-context', new Error('WebGL context lost'));
    });
  }

  _pick(cx, cy) {
    if (!this.w) return null;
    const list = [];
    for (const k of ['big', 'small']) {
      const u = this.units[k];
      if (u && u.hitbox) list.push(u.hitbox);
    }
    if (!list.length) return null;
    const r = this.canvas.getBoundingClientRect();
    this._ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    const hits = this._ray.intersectObjects(list, false);
    return hits.length ? hits[0].object.userData.key : null;
  }

  _setHover(key) {
    if (key === this._hoverKey) return;
    this._hoverKey = key;
    for (const k in this.units) {
      try { this.units[k].setHover(k === key); }
      catch (err) { this._fail('unit-hover:' + k, err); }
    }
    if (this.onHover) this.onHover(key);
    this.canvas.style.cursor = key ? 'pointer' : 'grab';
    if (key && this.units[key]) this._fillLabel(key);
  }

  /* floating label that follows the hovered machine in screen space */
  _ensureLabel() {
    if (this._labelEl) return;
    const el = document.createElement('div');
    el.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'z-index:6', 'pointer-events:none',
      'opacity:0', 'transition:opacity .25s', 'transform:translate(-50%,-100%)',
      'padding:8px 14px', 'border-radius:10px',
      'background:rgba(6,10,17,.88)', 'border:1px solid #20bea5',
      'backdrop-filter:blur(4px)', '-webkit-backdrop-filter:blur(4px)',
      'font:700 13px "Chakra Petch","Segoe UI",sans-serif', 'letter-spacing:.1em',
      'color:#fff', 'white-space:nowrap', 'text-align:center',
    ].join(';');
    const sub = document.createElement('div');
    sub.style.cssText = 'font:600 9px "IBM Plex Mono",monospace;letter-spacing:.24em;margin-top:4px;opacity:.9;';
    el.appendChild(document.createTextNode(''));
    el.appendChild(sub);
    this.canvas.parentElement.appendChild(el);
    this._labelEl = el; this._labelSub = sub;
  }
  _fillLabel(key) {
    this._ensureLabel();
    const m = MACHINES[key];
    this._labelEl.childNodes[0].nodeValue = m.title;
    this._labelSub.textContent = m.tag;
    this._labelEl.style.borderColor = m.color;
    this._labelSub.style.color = m.lt;
  }
  _updateLabel() {
    if (!this._labelEl) return;
    const key = this._hoverKey;
    const unit = key ? this.units[key] : null;
    if (!unit || !this.w || this.disposed) { this._labelEl.style.opacity = '0'; return; }
    _lv.set(0, unit.cfg.hitbox.cy + unit.cfg.hitbox.h * 0.5 + 0.3, 0);
    unit.root.localToWorld(_lv);
    _lv.project(this.camera);
    const x = (_lv.x * 0.5 + 0.5) * this.w;
    const y = (-_lv.y * 0.5 + 0.5) * this.h;
    this._labelEl.style.opacity = '1';
    this._labelEl.style.left = clamp(x, 90, this.w - 90) + 'px';
    this._labelEl.style.top = clamp(y - 16, 64, this.h - 60) + 'px';
  }

  _resize() {
    if (this.disposed || !this.renderer) return;
    const p = this.canvas.parentElement;
    const w = p ? p.clientWidth : 0, h = p ? p.clientHeight : 0;
    if (!w || !h) { this.w = 0; return; }
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this._userMoved) this._frame();
    this._paint();                                 // paint the moment we know the size
  }

  /* auto-frame BOTH machines + the lorry regardless of viewport shape */
  _frame() {
    if (!this.w || !this.h) return;
    const aspect = this.w / this.h;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const dist = Math.max(22 / (tanV * aspect), 13.5 / tanV) * 1.02;
    const d = clamp(dist, this.controls.minDistance, this.controls.maxDistance);
    const dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 0.25) dir.set(0.5, 0.42, 0.85);
    dir.normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, d);
    this.controls.update();
  }

  _loop(now) {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    const t = now / 1000;
    try { this.controls.update(); }
    catch (err) { this._fail('controls', err); }
    for (const k in this.units) {
      try { this.units[k].update(dt, t); }
      catch (err) { this._fail('unit:' + k, err); }
    }
    this._paint();
    this._updateLabel();
  }

  /* ---------- full disposal — no leaks on unmount ---------- */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
    this._retryTimers.forEach(clearTimeout);
    this._retryTimers.length = 0;
    if (this._onWinResize) {
      try { window.removeEventListener('resize', this._onWinResize); } catch (_) {}
      this._onWinResize = null;
    }
    this._ro.disconnect();
    for (const [type, fn] of this._bound) this.canvas.removeEventListener(type, fn);
    this._bound.length = 0;
    try { this.controls.dispose(); } catch (_) {}
    if (this._labelEl) { this._labelEl.remove(); this._labelEl = null; this._labelSub = null; }
    if (this.scene) {
      try {
        const mats = new Set(), texs = new Set();
        this.scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          const mm = o.material;
          if (mm) {
            (Array.isArray(mm) ? mm : [mm]).forEach((mt) => {
              if (mats.has(mt)) return;
              mats.add(mt);
              for (const k in mt) {
                const v = mt[k];
                if (v && v.isTexture) texs.add(v);
              }
            });
          }
        });
        texs.forEach((tx) => tx.dispose());
        mats.forEach((mt) => mt.dispose());
      } catch (_) {}
    }
    try { this.renderer.dispose(); } catch (_) {}
    this.scene = null; this.camera = null; this.controls = null;
    this.units = {};
  }
}