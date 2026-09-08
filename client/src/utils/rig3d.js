/* ============================================================
   THALACUVERY BOREWELL — full-screen 3D forest drilling site
   One scene: terrain, trees, bushes, grass, rocks,
   BIG rig (LEFT) + SMALL rig (RIGHT), hover drill story with
   water strike, camera framing, error-safe loop, disposal.
   Pure Three.js — no React, no routing.
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ---------------- constants / utils ---------------- */
const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = THREE.MathUtils.lerp;
const damp = THREE.MathUtils.damp;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

const _tv = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _hv = new THREE.Vector3();
const _lv = new THREE.Vector3();

/* ---------------- machine catalogue (public) ---------------- */
export const MACHINES = {
  big: {
    key: 'big', idx: '01', title: 'BIG MACHINE', tag: 'HEAVY-DUTY RIG',
    desc: 'Built for deep bores, high-volume output and large-diameter drilling.',
    color: '#16a34a', lt: '#4ade80', hex: 0x16a34a,
    cb: 'rgba(22,163,74,.55)', csh: 'rgba(22,163,74,.22)',
    place: { x: -15, z: 0, yaw: 0.3 },
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
    place: { x: 14, z: 0, yaw: -0.38 },
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

  const at = (x, y) =>
    grid[(((y % S) + S) % S) * S + (((x % S) + S) % S)];

  const sm = (t) => t * t * (3 - 2 * t);

  function sample(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = at(xi, yi), b = at(xi + 1, yi),
      c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v +
      (a - b - c + d) * u * v;
  }

  return (x, y) => {
    let val = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < 3; o++) {
      val += amp * sample(x * f, y * f);
      tot += amp;
      amp *= 0.5;
      f *= 2.13;
    }
    return val / tot;
  };
}

/* ---------------- canvas textures ---------------- */
function softTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0a1420');
  g.addColorStop(0.42, '#122626');
  g.addColorStop(0.6, '#1c3a30');
  g.addColorStop(0.76, '#122624');
  g.addColorStop(1, '#0a121a');
  x.fillStyle = g;
  x.fillRect(0, 0, 2, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function nameTex(accent, sub) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 140;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 140);
  x.fillStyle = '#f4f7f5';
  x.font = '700 62px "Chakra Petch", sans-serif';
  x.textBaseline = 'middle';
  x.fillText('THALACUVERY', 10, 48);
  x.fillStyle = accent;
  x.fillRect(10, 86, 190, 8);

  if (sub) {
    x.fillStyle = 'rgba(255,255,255,.72)';
    x.font = '600 26px "IBM Plex Mono", monospace';
    x.fillText(sub, 10, 114);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function nameTexWide(accent) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 80;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 80);
  x.fillStyle = '#f4f7f5';
  x.font = '700 60px "Chakra Petch", sans-serif';
  x.textBaseline = 'middle';
  x.fillText('THALACUVERY', 8, 38);
  x.fillStyle = accent;
  x.fillRect(8, 62, 150, 7);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function brandTex(accent, line2) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const x = c.getContext('2d');

  x.fillStyle = '#10161f';
  x.fillRect(0, 0, 512, 160);

  x.fillStyle = accent;
  x.fillRect(0, 0, 10, 160);

  x.fillStyle = '#f2f5f7';
  x.font = '700 62px "Chakra Petch", sans-serif';
  x.textBaseline = 'middle';
  x.fillText('THALACUVERY', 44, 62);

  x.fillStyle = accent;
  x.fillRect(44, 104, 220, 5);

  x.fillStyle = 'rgba(255,255,255,.6)';
  x.font = '600 25px "IBM Plex Mono", monospace';
  x.fillText(line2, 44, 130);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function stripeTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');

  x.fillStyle = '#141922';
  x.fillRect(0, 0, 128, 128);

  x.fillStyle = '#f0c419';
  x.save();
  x.translate(64, 64);
  x.rotate(-Math.PI / 4);

  for (let i = -4; i <= 4; i++) {
    x.fillRect(-96, i * 32 - 8, 192, 16);
  }

  x.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.4, 1);
  return t;
}

/* ---------------- material + primitive helpers ---------------- */
const std = (o) => new THREE.MeshStandardMaterial(o);

function box(w, h, d, m) {
  const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  x.castShadow = x.receiveShadow = true;
  return x;
}

function cyl(rt, rb, h, m, seg = 16) {
  const x = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    m
  );
  x.castShadow = x.receiveShadow = true;
  return x;
}

function bar(a, b, w, m) {
  const d = _tv.subVectors(b, a).clone();
  const len = Math.max(d.length(), 0.001);

  const x = new THREE.Mesh(
    new THREE.BoxGeometry(w, len, w),
    m
  );

  x.castShadow = x.receiveShadow = true;
  x.position.copy(a).addScaledVector(d, 0.5);
  x.quaternion.setFromUnitVectors(UP, d.normalize());

  return x;
}

function tube(pts, r, m) {
  const c = new THREE.CatmullRomCurve3(pts);
  const x = new THREE.Mesh(
    new THREE.TubeGeometry(c, 24, r, 8, false),
    m
  );
  x.castShadow = true;
  return x;
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

  const x = new THREE.Mesh(geo, m);
  x.castShadow = true;

  return x;
}

function spinWrap(mesh, axis) {
  const g = new THREE.Group();

  if (axis === 'z') g.rotation.x = Math.PI / 2;
  else g.rotation.z = Math.PI / 2;

  g.add(mesh);
  return g;
}

function livery(w, h, tex) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.55,
      metalness: 0.05,
    })
  );
}

function palette(accent) {
  const c = new THREE.Color(accent);

  return {
    body: std({ color: c, metalness: 0.22, roughness: 0.55 }),
    bodyDark: std({ color: c.clone().multiplyScalar(0.45), metalness: 0.3, roughness: 0.6 }),
    steel: std({ color: 0x8d97a4, metalness: 0.45, roughness: 0.45 }),
    dark: std({ color: 0x2a313c, metalness: 0.35, roughness: 0.65 }),
    tire: std({ color: 0x16181d, metalness: 0.02, roughness: 0.95 }),
    glass: std({ color: 0x11202e, metalness: 0.4, roughness: 0.2, transparent: true, opacity: 0.68 }),
    pipe: std({ color: 0xb9c2cc, metalness: 0.5, roughness: 0.35 }),
    cable: std({ color: 0x232a35, metalness: 0.4, roughness: 0.6 }),
    beacon: std({ color: 0x552f06, emissive: 0xffb020, emissiveIntensity: 1.2, roughness: 0.45 }),
    lamp: std({ color: 0x0e1c28, emissive: 0xd9edff, emissiveIntensity: 2, roughness: 0.3 }),
    led: std({ color: 0x0a2018, emissive: accent, emissiveIntensity: 0.7, roughness: 0.35 }),
    amber: std({ color: 0x3a2405, emissive: 0xffa733, emissiveIntensity: 1.3, roughness: 0.4 }),
    red: std({ color: 0x2a0805, emissive: 0xff3b30, emissiveIntensity: 1.4, roughness: 0.4 }),
    hole: std({ color: 0x05070a, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
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

    cg.rotation.order = 'YZX';
    cg.rotation.y = -az;
    cg.rotation.z = -0.5;

    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13 * s, 0.3 * s, 10), p.steel);

    cone.castShadow = true;
    cone.rotation.x = Math.PI;

    for (let t = 0; t < 3; t++) {
      const ta = (t / 3) * Math.PI * 2;

      const tooth = box(0.05 * s, 0.06 * s, 0.05 * s, p.dark);

      tooth.position.set(Math.cos(ta) * 0.085 * s, -0.04 * s, Math.sin(ta) * 0.085 * s);

      cone.add(tooth);
    }

    cg.add(cone);
    bit.add(cg);
    cones.push(cone);
  }

  return { bit, cones };
}

/* ============================================================
   MACHINE MODELS — procedural, no model files
   ============================================================ */
function buildBigRig(accent) {
  const p = palette(accent);
  const g = new THREE.Group();
  const u = g.userData;

  const A = 3.55, P = 3.7, L = 8.3;

  u.stow = 1.5;
  u.headOff = 0.5;
  u.headTopLocal = 7.6;
  u.headLowLocal = 0.55;
  u.bitTopLocal = -3.45;
  u.bitDeepLocal = -4.15;
  u.holeX = A;

  const chassis = box(7.4, 0.5, 2.5, p.dark);
  chassis.position.set(0, 1.16, 0);
  g.add(chassis);

  const deck = box(4.95, 0.12, 2.42, p.steel);
  deck.position.set(1.1, 1.5, 0);
  g.add(deck);

  const cab = box(2.0, 1.7, 2.3, p.body);
  cab.position.set(-2.55, 2.27, 0);
  g.add(cab);

  const skirt = box(1.9, 0.5, 2.34, p.dark);
  skirt.position.set(-2.55, 1.6, 0);
  g.add(skirt);

  const wind = box(0.07, 0.85, 2.0, p.glass);
  wind.position.set(-3.57, 2.5, 0);
  g.add(wind);

  const grille = box(0.1, 0.7, 1.5, p.dark);
  grille.position.set(-3.6, 1.95, 0);
  g.add(grille);

  const bumper = box(0.32, 0.44, 2.4, p.dark);
  bumper.position.set(-3.8, 1.5, 0);
  g.add(bumper);

  for (const z of [-0.5, 0, 0.5]) {
    g.add(bar(V(-3.68, 1.72, z), V(-3.68, 2.26, z), 0.05, p.dark));
  }

  for (const s of [-1, 1]) {
    const sw = box(1.3, 0.55, 0.06, p.glass);
    sw.position.set(-2.55, 2.55, s * 1.16);
    g.add(sw);

    const hl = cyl(0.11, 0.11, 0.09, p.lamp, 14);
    hl.rotation.y = Math.PI / 2;
    hl.position.set(-3.55, 1.66, s * 0.85);
    g.add(hl);

    const bc = cyl(0.08, 0.08, 0.16, p.beacon, 10);
    bc.position.set(-2.95, 3.2, s * 0.78);
    g.add(bc);

    const ml = box(0.16, 0.08, 0.1, p.amber);
    ml.position.set(-2.9, 3.16, s * 0.85);
    g.add(ml);

    g.add(bar(V(-3.45, 2.85, s * 1.2), V(-3.62, 3.16, s * 1.32), 0.03, p.dark));

    const mi = box(0.3, 0.22, 0.05, p.glass);
    mi.position.set(-3.64, 3.18, s * 1.33);
    g.add(mi);

    const dh = box(0.3, 0.06, 0.05, p.dark);
    dh.position.set(-1.62, 2.1, s * 1.18);
    g.add(dh);

    const lv = livery(1.7, 0.465, nameTex(accent, 'HEAVY-DUTY DRILLING'));
    lv.position.set(-2.55, 2.02, s * 1.16);
    if (s < 0) lv.rotation.y = Math.PI;
    g.add(lv);
  }

  const dashMat = std({ color: 0x0a0d12, emissive: 0xffb545, emissiveIntensity: 0.5, roughness: 0.8 });
  const dash = box(1.3, 0.5, 1.6, dashMat);
  dash.position.set(-2.85, 2.42, 0);
  g.add(dash);

  for (const s of [-1, 1]) {
    const seat = box(0.45, 0.55, 0.5, p.dark);
    seat.position.set(-2.15, 2.2, s * 0.5);
    g.add(seat);
  }

  u.dashMat = dashMat;

  const cabLight = new THREE.PointLight(0xffc073, 1.6, 6, 2);
  cabLight.position.set(-2.6, 2.55, 0);
  g.add(cabLight);
  u.cabLight = cabLight;

  for (const x of [-1.9, 1.4, 2.4]) {
    for (const s of [-1, 1]) {
      const t = cyl(0.62, 0.62, 0.5, p.tire, 26);
      t.rotation.x = Math.PI / 2;
      t.position.set(x, 0.62, s * 1.31);
      g.add(t);

      const h = cyl(0.2, 0.2, 0.52, p.steel, 12);
      h.rotation.x = Math.PI / 2;
      h.position.set(x, 0.62, s * 1.31);
      g.add(h);
    }
  }

  for (const s of [-1, 1]) {
    const f1 = box(2.15, 0.16, 0.6, p.body);
    f1.position.set(1.9, 1.31, s * 1.31);
    g.add(f1);

    const f2 = box(1.05, 0.16, 0.6, p.body);
    f2.position.set(-1.9, 1.31, s * 1.31);
    g.add(f2);
  }

  for (const x of [0.6, 3.35]) {
    const beam = box(0.34, 0.26, 4.4, p.dark);
    beam.position.set(x, 1.16, 0);
    g.add(beam);

    for (const s of [-1, 1]) {
      const leg = cyl(0.13, 0.13, 1.05, p.steel, 10);
      leg.position.set(x, 0.55, s * 2.05);
      g.add(leg);

      const pad = cyl(0.3, 0.34, 0.16, p.dark, 14);
      pad.position.set(x, 0.08, s * 2.05);
      g.add(pad);
    }
  }

  const cc = box(1.05, 1.45, 1.9, p.bodyDark);
  cc.position.set(-1.35, 2.22, 0);
  g.add(cc);

  const ccw = box(0.06, 0.6, 1.4, p.glass);
  ccw.position.set(-0.81, 2.55, 0);
  g.add(ccw);

  const ccr = box(1.15, 0.08, 2.0, p.dark);
  ccr.position.set(-1.35, 2.99, 0);
  g.add(ccr);

  for (const s of [-1, 1]) {
    g.add(bar(V(-0.86, 1.56, s * 0.16), V(-0.86, 2.86, s * 0.16), 0.04, p.steel));
  }

  for (let i = 0; i < 4; i++) {
    const r = box(0.32, 0.045, 0.045, p.steel);
    r.position.set(-0.86, 1.85 + i * 0.33, 0);
    g.add(r);
  }

  for (const x of [-1.1, -0.1, 0.9, 1.9]) {
    const post = cyl(0.03, 0.03, 0.78, p.steel, 8);
    post.position.set(x, 1.94, 1.14);
    g.add(post);
  }

  g.add(bar(V(-1.15, 2.32, 1.14), V(2.0, 2.32, 1.14), 0.035, p.steel));
  g.add(bar(V(-1.15, 1.98, 1.14), V(2.0, 1.98, 1.14), 0.03, p.steel));

  const eng = box(1.35, 1.05, 1.8, p.body);
  eng.position.set(0.55, 2.0, 0);
  g.add(eng);

  for (const s of [-1, 1]) {
    const vent = box(1.1, 0.5, 0.05, p.dark);
    vent.position.set(0.55, 2.0, s * 0.92);
    g.add(vent);
  }

  const exh = cyl(0.07, 0.07, 0.8, p.dark, 10);
  exh.position.set(0.3, 2.95, -0.75);
  g.add(exh);

  const ecap = box(0.18, 0.06, 0.18, p.dark);
  ecap.position.set(0.3, 3.38, -0.75);
  g.add(ecap);

  u.smokeAnchor = V(0.3, 3.4, -0.75);

  const air = cyl(0.16, 0.16, 0.72, p.steel, 14);
  air.rotation.z = Math.PI / 2;
  air.position.set(0.55, 2.6, 0.6);
  g.add(air);

  const dwb = box(1.2, 0.45, 1.95, p.dark);
  dwb.position.set(1.75, 1.75, 0);
  g.add(dwb);

  const drum = cyl(0.32, 0.32, 0.9, p.steel, 18);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const lug = box(0.07, 0.84, 0.07, p.dark);
    lug.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
    drum.add(lug);
  }

  for (const s of [-1, 1]) {
    const fl = cyl(0.44, 0.44, 0.07, p.bodyDark, 20);
    fl.position.y = s * 0.48;
    drum.add(fl);
  }

  const dwg = spinWrap(drum, 'z');
  dwg.position.set(1.75, 2.28, 0);
  g.add(dwg);
  u.drum = drum;

  const tank = box(1.3, 1.0, 2.0, p.bodyDark);
  tank.position.set(2.85, 1.98, 0);
  g.add(tank);

  const trf = box(1.36, 0.06, 2.06, p.steel);
  trf.position.set(2.85, 2.51, 0);
  g.add(trf);

  for (const s of [-1, 1]) {
    const cap = cyl(0.09, 0.09, 0.15, p.dark, 10);
    cap.position.set(2.85, 2.6, s * 0.62);
    g.add(cap);
  }

  for (const z of [-0.55, 0, 0.55]) {
    const dp = cyl(0.09, 0.09, 3.1, p.pipe, 12);
    dp.rotation.z = Math.PI / 2;
    dp.position.set(2.7, 2.64, z);
    g.add(dp);

    const cpl = box(0.22, 0.2, 0.2, p.steel);
    cpl.position.set(3.9, 2.64, z);
    g.add(cpl);
  }

  for (const s of [-1, 1]) {
    const plate = box(0.14, 2.3, 0.6, p.bodyDark);
    plate.position.set(3.55, 2.62, s * 0.75);
    g.add(plate);

    g.add(bar(V(3.55, 3.5, s * 0.68), V(2.35, 1.56, s * 1.0), 0.07, p.steel));
  }

  const tbeam = box(0.5, 0.2, 1.7, p.dark);
  tbeam.position.set(3.55, 3.66, 0);
  g.add(tbeam);

  const hz = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 2.2), std({ map: stripeTex(), roughness: 0.7 }));
  hz.position.set(3.73, 1.16, 0);
  g.add(hz);

  const mast = new THREE.Group();
  mast.position.set(A, P, 0);
  g.add(mast);
  u.mast = mast;

  const RX = [-0.36, 0.36];
  const RZ = [-0.42, 0.42];

  for (const x of RX) {
    for (const z of RZ) {
      const leg = cyl(0.09, 0.09, L, p.steel, 10);
      leg.position.set(x, L / 2, z);
      mast.add(leg);
    }
  }

  const segs = 7;
  const dy = L / segs;

  for (let i = 0; i < segs; i++) {
    const y0 = i * dy;
    const y1 = y0 + dy;

    for (const x of RX) {
      if (i > 0) {
        mast.add(bar(V(x, y0, RZ[0]), V(x, y0, RZ[1]), 0.055, p.steel));
      }

      mast.add(
        i % 2 === 0
          ? bar(V(x, y0, RZ[0]), V(x, y1, RZ[1]), 0.05, p.steel)
          : bar(V(x, y0, RZ[1]), V(x, y1, RZ[0]), 0.05, p.steel)
      );
    }

    for (const z of RZ) {
      if (i > 0) {
        mast.add(bar(V(RX[0], y0, z), V(RX[1], y0, z), 0.05, p.steel));
      }

      mast.add(
        i % 2 === 0
          ? bar(V(RX[0], y0, z), V(RX[1], y1, z), 0.05, p.steel)
          : bar(V(RX[1], y0, z), V(RX[0], y1, z), 0.05, p.steel)
      );
    }
  }

  for (const z of RZ) {
    mast.add(bar(V(RX[0], L, z), V(RX[1], L, z), 0.07, p.steel));
  }

  for (const x of RX) {
    mast.add(bar(V(x, L, RZ[0]), V(x, L, RZ[1]), 0.07, p.steel));
  }

  const crown = box(1.2, 0.4, 1.05, p.bodyDark);
  crown.position.set(0, L + 0.25, 0);
  mast.add(crown);

  u.sheaves = [];

  for (const s of [-1, 1]) {
    mast.add(bar(V(0, L - 0.15, s * 0.42), V(0, L + 0.05, s * 0.58), 0.06, p.steel));

    const sh = cyl(0.17, 0.17, 0.09, p.steel, 16);
    const wrap = spinWrap(sh, 'z');
    wrap.position.set(0, L + 0.05, s * 0.58);
    mast.add(wrap);
    u.sheaves.push(sh);
  }

  const cb = cyl(0.07, 0.07, 0.18, p.beacon, 10);
  cb.position.set(0, L + 0.52, 0);
  mast.add(cb);

  const npb = box(1.56, 0.56, 0.04, p.dark);
  npb.position.set(0, 6.7, 0.44);
  mast.add(npb);

  const np = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.5),
    new THREE.MeshBasicMaterial({ map: brandTex(accent, 'HEAVY-DUTY RIG · 1500 FT') })
  );

  np.position.set(0, 6.7, 0.465);
  mast.add(np);

  const head = new THREE.Group();
  head.position.set(0, u.headTopLocal, 0);
  mast.add(head);

  head.add(box(1.0, 0.75, 0.95, p.body));

  for (const s of [-1, 1]) {
    const mo = cyl(0.16, 0.16, 0.5, p.dark, 12);
    mo.rotation.x = Math.PI / 2;
    mo.position.set(s * 0.32, 0.62, 0);
    head.add(mo);
  }

  const hplate = box(0.92, 0.1, 0.82, p.steel);
  hplate.position.y = -0.44;
  head.add(hplate);

  const hconn = cyl(0.15, 0.15, 0.2, p.steel, 12);
  hconn.position.y = -0.52;
  head.add(hconn);

  const led = box(0.16, 0.05, 0.05, p.led);
  led.position.set(0.3, 0.12, 0.49);
  head.add(led);

  u.ledMat = p.led;
  u.head = head;

  const pg = new THREE.CylinderGeometry(0.11, 0.11, 1, 6);
  pg.translate(0, -0.5, 0);

  const pipe = new THREE.Mesh(pg, p.pipe);
  pipe.castShadow = true;

  const stripe = box(0.03, 1, 0.05, p.dark);
  stripe.position.set(0, -0.5, 0.1);
  pipe.add(stripe);

  u.pipe = pipe;
  mast.add(pipe);

  const tc = makeTricone(p, 1);
  tc.bit.position.set(0, u.bitTopLocal, 0);
  mast.add(tc.bit);

  u.bitGroup = tc.bit;
  u.cones = tc.cones;

  const collar = new THREE.Group();
  collar.position.set(0, -3.32, 0);
  mast.add(collar);

  for (const [x, z] of [
    [-0.26, -0.26],
    [0.26, -0.26],
    [-0.26, 0.26],
    [0.26, 0.26],
  ]) {
    collar.add(bar(V(x, -0.25, z), V(x, 0.25, z), 0.06, p.dark));
  }

  for (const zz of [-0.26, 0.26]) {
    collar.add(bar(V(-0.26, 0.25, zz), V(0.26, 0.25, zz), 0.05, p.dark));
    collar.add(bar(V(-0.26, -0.25, zz), V(0.26, -0.25, zz), 0.05, p.dark));
  }

  u.collar = collar;

  const hole = new THREE.Group();
  hole.position.set(A, 0, 0);
  g.add(hole);

  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 24, 1, true), p.hole);
  casing.position.y = 0.275;
  casing.castShadow = true;
  hole.add(casing);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), p.hole);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.08;
  hole.add(floor);

  const hring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 10, 28), p.steel);
  hring.rotation.x = Math.PI / 2;
  hring.position.y = 0.55;
  hring.castShadow = true;
  hole.add(hring);

  u.hole = hole;

  u.cables = [];

  for (const [fx, fz, ox, oz] of [
    [-0.2, -0.3, -0.16, -0.3],
    [0.2, 0.3, 0.16, 0.3],
  ]) {
    const mesh = dynCyl(0.03, p.cable);
    mast.add(mesh);

    u.cables.push({ mesh, from: V(fx, L - 0.12, fz), off: V(ox, 0.42, oz) });
  }

  const fl = dynCyl(0.03, p.cable);
  g.add(fl);

  const flA = new THREE.Object3D();
  flA.position.set(0, L + 0.02, 0.55);
  mast.add(flA);

  u.fastline = { mesh: fl, base: V(1.75, 2.55, 0.3), anchor: flA };

  u.hyd = [];

  for (const s of [-1, 1]) {
    const mesh = dynCyl(0.07, p.steel);
    g.add(mesh);

    const anch = new THREE.Object3D();
    anch.position.set(0, 2.6, s * 0.5);
    mast.add(anch);

    const lugB = box(0.14, 0.14, 0.1, p.dark);
    lugB.position.set(0, 2.6, s * 0.44);
    mast.add(lugB);

    const lugA = box(0.16, 0.14, 0.14, p.dark);
    lugA.position.set(2.15, 1.62, s * 0.9);
    g.add(lugA);

    u.hyd.push({ mesh, base: V(2.15, 1.6, s * 0.9), anchor: anch });
  }

  u.feed = [];

  for (const s of [-1, 1]) {
    const mesh = dynCyl(0.055, p.steel);
    mast.add(mesh);

    u.feed.push({ mesh, from: V(s * 0.44, 0.15, 0), off: V(s * 0.32, -0.08, 0) });
  }

  g.add(tube([V(2.5, 2.45, 0.7), V(2.9, 2.85, 0.78), V(3.4, 3.35, 0.55)], 0.05, p.dark));

  mast.add(bar(V(0.15, 0.25, 0.42), V(0.15, 4.85, 0.42), 0.08, p.dark));

  const hoseMesh = new THREE.Mesh(new THREE.BufferGeometry(), p.dark);
  hoseMesh.castShadow = true;
  mast.add(hoseMesh);

  u.hose = {
    mesh: hoseMesh,
    from: V(0.15, 4.95, 0.42),
    toOff: V(0, 0.22, 0.34),
    lastEnd: V(1e9, 0, 0),
    lastAngle: -9,
    r: 0.05,
    local: true,
    sag: 0.55,
    drop: 0.55,
  };

  u.beaconMat = p.beacon;

  return g;
}

function buildSmallRig(accent) {
  const p = palette(accent);
  const g = new THREE.Group();
  const u = g.userData;

  const A = 1.45, P = 2.1, L = 4.35;
  const PX = 0.12;

  u.stow = 1.5;
  u.headOff = 0.3;
  u.headTopLocal = 3.7;
  u.headLowLocal = 0.4;
  u.bitTopLocal = -1.85;
  u.bitDeepLocal = -2.3;
  u.holeX = A + PX;

  const frame = box(3.0, 0.32, 1.5, p.body);
  frame.position.set(0.15, 0.96, 0);
  g.add(frame);

  for (const s of [-1, 1]) {
    g.add(bar(V(-1.32, 0.98, s * 0.3), V(-2.42, 0.68, s * 0.08), 0.06, p.steel));
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 10, 24), p.steel);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(-2.55, 0.68, 0);
  ring.castShadow = true;
  g.add(ring);

  for (const s of [-1, 1]) {
    const lv = livery(1.6, 0.25, nameTexWide(accent));
    lv.position.set(0.15, 0.97, s * 0.76);
    if (s < 0) lv.rotation.y = Math.PI;
    g.add(lv);
  }

  const hz = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 1.2), std({ map: stripeTex(), roughness: 0.7 }));
  hz.position.set(1.66, 1.0, 0);
  g.add(hz);

  const tl = box(0.06, 0.12, 0.18, p.red);
  tl.position.set(1.67, 0.98, -0.5);
  g.add(tl);

  for (const s of [-1, 1]) {
    const t = cyl(0.5, 0.5, 0.32, p.tire, 22);
    t.rotation.x = Math.PI / 2;
    t.position.set(0.95, 0.5, s * 0.86);
    g.add(t);

    const h = cyl(0.15, 0.15, 0.34, p.steel, 10);
    h.rotation.x = Math.PI / 2;
    h.position.set(0.95, 0.5, s * 0.86);
    g.add(h);

    const f = box(0.82, 0.12, 0.66, p.body);
    f.position.set(0.95, 1.06, s * 0.88);
    g.add(f);

    const ml = cyl(0.06, 0.06, 0.05, p.lamp, 10);
    ml.rotation.y = Math.PI / 2;
    ml.position.set(-1.33, 1.05, s * 0.6);
    g.add(ml);
  }

  const eng = box(0.85, 0.6, 0.8, p.body);
  eng.position.set(-0.05, 1.42, 0);
  g.add(eng);

  const exh = cyl(0.045, 0.045, 0.5, p.dark, 8);
  exh.position.set(-0.35, 1.9, 0.22);
  g.add(exh);

  u.smokeAnchor = V(-0.35, 2.18, 0.22);

  const recoil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 20), p.steel);
  recoil.position.set(-0.05, 1.42, 0.42);
  g.add(recoil);

  for (const i of [-1, 1]) {
    g.add(bar(V(-0.15, 1.72, i * 0.2), V(-0.22, 1.98, i * 0.28), 0.03, p.steel));
  }

  const led1 = box(0.1, 0.05, 0.05, p.led);
  led1.position.set(0.12, 1.62, 0.42);
  g.add(led1);

  const led2 = box(0.1, 0.05, 0.05, p.amber);
  led2.position.set(0.28, 1.62, 0.42);
  g.add(led2);

  u.ledMat = p.led;

  const fuel = cyl(0.16, 0.16, 0.72, p.body, 14);
  fuel.rotation.z = Math.PI / 2;
  fuel.position.set(-0.95, 1.22, 0.55);
  g.add(fuel);

  const fcap = cyl(0.05, 0.05, 0.06, p.dark, 8);
  fcap.position.set(-0.62, 1.33, 0.55);
  g.add(fcap);

  const wbr = box(0.4, 0.26, 0.7, p.bodyDark);
  wbr.position.set(-1.15, 1.2, 0);
  g.add(wbr);

  const wm = cyl(0.16, 0.16, 0.44, p.steel, 14);

  const crank = box(0.34, 0.05, 0.05, p.dark);
  crank.position.set(0.19, 0, 0);
  wm.add(crank);

  const knob = cyl(0.05, 0.05, 0.14, p.dark, 8);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(0.4, 0, 0);
  wm.add(knob);

  const wg = spinWrap(wm, 'z');
  wg.position.set(-1.15, 1.47, 0);
  g.add(wg);
  u.drum = wm;

  const tb = box(0.55, 0.34, 0.8, p.bodyDark);
  tb.position.set(0.65, 1.29, 0);
  g.add(tb);

  for (const s of [-1, 1]) {
    const rod = cyl(0.05, 0.05, 2.1, p.pipe, 10);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0.55, 1.51, s * 0.26);
    g.add(rod);
  }

  for (const s of [-1, 1]) {
    const leg = cyl(0.05, 0.05, 1.0, p.steel, 8);
    leg.position.set(-1.28, 0.6, s * 0.55);
    g.add(leg);

    const pad = cyl(0.13, 0.15, 0.08, p.dark, 12);
    pad.position.set(-1.28, 0.1, s * 0.55);
    g.add(pad);
  }

  for (const s of [-1, 1]) {
    g.add(bar(V(1.6, 1.08, s * 0.36), V(2.26, 1.5, s * 0.28), 0.045, p.steel));
  }

  const cross = cyl(0.04, 0.04, 0.62, p.dark, 8);
  cross.rotation.x = Math.PI / 2;
  cross.position.set(2.26, 1.52, 0);
  g.add(cross);

  const mast = new THREE.Group();
  mast.position.set(A, P, 0);
  g.add(mast);
  u.mast = mast;

  const spine = box(0.2, L, 0.36, p.steel);
  spine.position.set(-0.26, L / 2, 0);
  mast.add(spine);

  for (const s of [-1, 1]) {
    const rail = box(0.06, L, 0.08, p.dark);
    rail.position.set(0.12, L / 2, s * 0.17);
    mast.add(rail);

    mast.add(bar(V(-0.26, 0.12, s * 0.28), V(0.1, 0.9, s * 0.17), 0.04, p.steel));
  }

  for (let i = 0; i < 7; i++) {
    const rung = box(0.3, 0.04, 0.03, p.dark);
    rung.position.set(-0.05, 0.6 + i * 0.5, 0.19);
    mast.add(rung);
  }

  const plate = box(0.5, 0.08, 0.5, p.dark);
  plate.position.set(0, L + 0.04, 0);
  mast.add(plate);

  const sh = cyl(0.12, 0.12, 0.09, p.steel, 14);
  const sw = spinWrap(sh, 'z');
  sw.position.set(0.3, L + 0.02, 0);
  mast.add(sw);

  u.sheaves = [sh];

  mast.add(bar(V(0.1, L - 0.06, 0), V(0.3, L, 0), 0.05, p.steel));

  const bcn = cyl(0.055, 0.055, 0.15, p.beacon, 10);
  bcn.position.set(0, L + 0.16, 0);
  mast.add(bcn);

  const np = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.36),
    new THREE.MeshBasicMaterial({ map: brandTex(accent, 'COMPACT RIG · 350 FT') })
  );

  np.position.set(-0.05, 2.6, 0.2);
  np.rotation.y = 0.35;
  mast.add(np);

  const head = new THREE.Group();
  head.position.set(PX, u.headTopLocal, 0);
  mast.add(head);

  head.add(box(0.42, 0.5, 0.46, p.body));

  const mo = cyl(0.1, 0.1, 0.34, p.dark, 10);
  mo.rotation.x = Math.PI / 2;
  mo.position.y = 0.38;
  head.add(mo);

  const hpl = box(0.44, 0.08, 0.48, p.steel);
  hpl.position.y = -0.26;
  head.add(hpl);

  const sled = box(0.16, 0.05, 0.05, p.led);
  sled.position.set(0.1, 0.08, 0.24);
  head.add(sled);

  const pg = new THREE.CylinderGeometry(0.055, 0.055, 1, 6);
  pg.translate(0, -0.5, 0);

  const pipe = new THREE.Mesh(pg, p.pipe);
  pipe.castShadow = true;
  pipe.position.x = PX;

  const stripe = box(0.016, 1, 0.026, p.dark);
  stripe.position.set(0, -0.5, 0.05);
  pipe.add(stripe);

  u.pipe = pipe;
  mast.add(pipe);

  const tc = makeTricone(p, 0.62);
  tc.bit.position.set(PX, u.bitTopLocal, 0);
  mast.add(tc.bit);

  u.bitGroup = tc.bit;
  u.cones = tc.cones;

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 10, 18), p.dark);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(PX, -1.8, 0);
  collar.castShadow = true;

  mast.add(collar);
  u.collar = collar;

  const hole = new THREE.Group();
  hole.position.set(u.holeX, 0, 0);
  g.add(hole);

  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 20, 1, true), p.hole);
  casing.position.y = 0.17;
  hole.add(casing);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), p.hole);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.05;
  hole.add(floor);

  const hring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 10, 24), p.steel);
  hring.rotation.x = Math.PI / 2;
  hring.position.y = 0.34;
  hring.castShadow = true;
  hole.add(hring);

  u.hole = hole;

  const cable = dynCyl(0.02, p.cable);
  mast.add(cable);

  u.cables = [{ mesh: cable, from: V(0.3, L - 0.06, 0), off: V(-0.15, 0.3, 0) }];

  const wr = dynCyl(0.02, p.cable);
  g.add(wr);

  const wa = new THREE.Object3D();
  wa.position.set(0.3, L - 0.04, 0);
  mast.add(wa);

  u.fastline = { mesh: wr, base: V(-1.15, 1.6, 0), anchor: wa };

  u.hyd = [];

  for (const s of [-1, 1]) {
    const mesh = dynCyl(0.05, p.steel);
    g.add(mesh);

    const anch = new THREE.Object3D();
    anch.position.set(-0.1, 1.4, s * 0.3);
    mast.add(anch);

    const lug = box(0.12, 0.12, 0.1, p.dark);
    lug.position.set(0.55, 1.14, s * 0.6);
    g.add(lug);

    u.hyd.push({ mesh, base: V(0.55, 1.12, s * 0.6), anchor: anch });
  }

  u.feed = [];

  const hoseMesh = new THREE.Mesh(new THREE.BufferGeometry(), p.dark);
  hoseMesh.castShadow = true;
  g.add(hoseMesh);

  u.hose = {
    mesh: hoseMesh,
    from: V(-0.2, 1.72, 0.3),
    toOff: V(0, 0.2, 0.15),
    lastEnd: V(1e9, 0, 0),
    lastAngle: -9,
    r: 0.032,
    local: false,
    sag: 0.6,
    drop: 0.5,
  };

  u.beaconMat = p.beacon;

  return g;
}

/* ============================================================
   FOREST ENVIRONMENT — terrain, grass, bushes, rocks, trees
   ============================================================ */
function buildTerrain() {
  const group = new THREE.Group();
  const noise = makeNoise(1337);
  const noise2 = makeNoise(9241);

  const PADS = [
    { x: -15, z: 0, r: 8 },
    { x: 14, z: 0, r: 6 },
  ];

  const ROAD = { x0: -9, x1: 8.5, halfW: 2.4 };

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

    const h =
      (noise(x * 0.055, z * 0.055) - 0.45) * 3.2 +
      (noise2(x * 0.16, z * 0.16) - 0.5) * 0.9;

    return h * f;
  }

  const geo = new THREE.PlaneGeometry(200, 200, 88, 88);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cGrass = new THREE.Color(0x2f4a2a);
  const cGrass2 = new THREE.Color(0x233d1c);
  const cSoil = new THREE.Color(0x4a3a26);
  const cSoil2 = new THREE.Color(0x3c2f1e);
  const cRock = new THREE.Color(0x454138);

  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    pos.setY(i, heightAt(x, z));

    const f = padFactor(x, z);
    const soil = 1 - f;

    c.copy(cGrass).lerp(cGrass2, noise(x * 0.13, z * 0.13));

    const n = noise2(x * 0.09 + 40, z * 0.09 - 17);

    if (n > 0.62) {
      c.lerp(cRock, (n - 0.62) * 1.4);
    }

    if (soil > 0) {
      c.lerp(cSoil2, soil * 0.55);

      if (soil > 0.75) {
        c.lerp(cSoil, (soil - 0.75) * 3);
      }
    }

    const dist = Math.hypot(x, z);

    if (dist > 55) {
      c.lerp(cRock, clamp((dist - 55) / 60, 0, 0.5));
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true })
  );

  ground.receiveShadow = true;
  group.add(ground);

  const rnd = mulberry32(20240);

  const clearOfWorkArea = (x, z) => padFactor(x, z) > 0.85 && Math.hypot(x, z) < 70;

  function scatter(count, minR, maxR, extra) {
    const out = [];
    let guard = 0;

    while (out.length < count && guard++ < count * 80) {
      const a = rnd() * Math.PI * 2;
      const rr = minR + rnd() * (maxR - minR);
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;

      if (!clearOfWorkArea(x, z)) continue;
      if (extra && !extra(x, z)) continue;

      out.push([x, z]);
    }

    return out;
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const pv = new THREE.Vector3();

  const fillRest = (mesh, n, placed) => {
    for (let i = placed; i < n; i++) {
      m.compose(pv.set(0, -60, 0), q.identity(), sc.set(0.001, 0.001, 0.001));
      mesh.setMatrixAt(i, m);
    }
  };

  {
    const gGeo = new THREE.ConeGeometry(0.1, 0.55, 4);
    gGeo.translate(0, 0.27, 0);

    const gMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });

    const G = 760;
    const pts = scatter(G, 5, 62);
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

  {
    const bGeo = new THREE.IcosahedronGeometry(0.62, 0);
    const bMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, flatShading: true });

    const B = 56;
    const pts = scatter(B, 8, 60);
    const bush = new THREE.InstancedMesh(bGeo, bMat, B);

    const bc = [new THREE.Color(0x2c4726), new THREE.Color(0x24401f), new THREE.Color(0x37522c)];

    pts.forEach(([x, z], i) => {
      const s = 0.8 + rnd() * 1.2;
      const sy = 0.55 + rnd() * 0.5;

      e.set(0, rnd() * Math.PI, 0);
      q.setFromEuler(e);

      m.compose(pv.set(x, heightAt(x, z) + 0.25 * sy, z), q, sc.set(s, sy, s));

      bush.setMatrixAt(i, m);
      bush.setColorAt(i, bc[(rnd() * 3) | 0]);
    });

    fillRest(bush, B, pts.length);
    bush.castShadow = bush.receiveShadow = true;
    group.add(bush);
  }

  {
    const rGeo = new THREE.DodecahedronGeometry(0.42, 0);
    const rMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02, flatShading: true });

    const R = 42;
    const pts = scatter(R, 6, 62);
    const rocks = new THREE.InstancedMesh(rGeo, rMat, R);

    const rc = [new THREE.Color(0x5b564b), new THREE.Color(0x4c473d), new THREE.Color(0x6a6154)];

    pts.forEach(([x, z], i) => {
      const s = 0.35 + rnd() * 1.1;

      e.set(rnd() * 3, rnd() * 3, rnd() * 3);
      q.setFromEuler(e);

      m.compose(pv.set(x, heightAt(x, z) + 0.1 * s, z), q, sc.set(s, s * (0.6 + rnd() * 0.5), s));

      rocks.setMatrixAt(i, m);
      rocks.setColorAt(i, rc[(rnd() * 3) | 0]);
    });

    fillRest(rocks, R, pts.length);
    rocks.castShadow = rocks.receiveShadow = true;
    group.add(rocks);
  }

  {
    const tGeo = new THREE.CylinderGeometry(0.14, 0.24, 1, 7);
    tGeo.translate(0, 0.5, 0);

    const tMat = new THREE.MeshStandardMaterial({ color: 0x463322, roughness: 0.95, flatShading: true });

    const fGeo = new THREE.IcosahedronGeometry(1, 0);
    const fMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true });

    const TREES = 28;

    const treePts = scatter(TREES, 13, 56, (x, z) => !(z > 6 && Math.abs(x) < 27));

    const trunkMesh = new THREE.InstancedMesh(tGeo, tMat, TREES);
    const foliage = new THREE.InstancedMesh(fGeo, fMat, TREES * 3);

    const fc = [
      new THREE.Color(0x2c4a26),
      new THREE.Color(0x223e1d),
      new THREE.Color(0x35522c),
      new THREE.Color(0x1d3619),
    ];

    let bi = 0;

    treePts.forEach(([x, z], i) => {
      let th = 2.6 + rnd() * 2.0;
      if (rnd() < 0.28) th *= 1.35;

      const ts = 0.85 + rnd() * 0.55;

      e.set(0, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.12);
      q.setFromEuler(e);

      m.compose(pv.set(x, heightAt(x, z) - 0.1, z), q, sc.set(ts, th, ts));

      trunkMesh.setMatrixAt(i, m);

      for (let k = 0; k < 3; k++) {
        const r = 1.05 + rnd() * 1.2;

        e.set(rnd() * 3, rnd() * 3, rnd() * 3);
        q.setFromEuler(e);

        m.compose(
          pv.set(
            x + (rnd() - 0.5) * 1.2,
            heightAt(x, z) + th * (0.6 + k * 0.3) + (rnd() - 0.5) * 0.4,
            z + (rnd() - 0.5) * 1.2
          ),
          q,
          sc.set(r, r * (0.75 + rnd() * 0.3), r)
        );

        foliage.setMatrixAt(bi, m);
        foliage.setColorAt(bi, fc[(rnd() * 4) | 0]);
        bi++;
      }
    });

    fillRest(trunkMesh, TREES, treePts.length);

    for (let i = bi; i < TREES * 3; i++) {
      m.compose(pv.set(0, -60, 0), q.identity(), sc.set(0.001, 0.001, 0.001));
      foliage.setMatrixAt(i, m);
    }

    trunkMesh.castShadow = foliage.castShadow = true;
    trunkMesh.receiveShadow = foliage.receiveShadow = true;

    group.add(trunkMesh, foliage);
  }

  {
    const hGeo = new THREE.DodecahedronGeometry(1, 0);
    const hMat = new THREE.MeshStandardMaterial({ color: 0x1c2f23, roughness: 1, flatShading: true });

    const H = 9;
    const hills = new THREE.InstancedMesh(hGeo, hMat, H);
    const hr = mulberry32(777);

    for (let i = 0; i < H; i++) {
      const a = (i / H) * Math.PI * 2 + hr() * 0.6;
      const rr = 70 + hr() * 16;

      e.set(0, hr() * Math.PI, 0);
      q.setFromEuler(e);

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
    this.N = 90;
    this.origin = origin;
    this.pos = new Float32Array(this.N * 3);
    this.col = new Float32Array(this.N * 3);
    this.parts = [];

    for (let i = 0; i < this.N; i++) {
      this.parts.push({ life: -1, ttl: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0 });
    }

    const geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3);
    this.ca = new THREE.BufferAttribute(this.col, 3);
    this.pa.setUsage(THREE.DynamicDrawUsage);
    this.ca.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa);
    geo.setAttribute('color', this.ca);

    this.pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size,
        map: softTex(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      })
    );

    this.pts.frustumCulled = false;
    this.base = new THREE.Color(0xc09a6e).lerp(new THREE.Color(accentHex), 0.25);
    parent.add(this.pts);
  }

  burst(n) {
    for (let k = 0; k < n; k++) {
      const i = this.parts.findIndex((p) => p.life < 0 || p.life >= p.ttl);
      if (i < 0) return;

      const p = this.parts[i];
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 1.3;

      p.x = this.origin.x + (Math.random() - 0.5) * 0.25;
      p.z = this.origin.z + (Math.random() - 0.5) * 0.25;
      p.y = this.origin.y + Math.random() * 0.1;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = 0.9 + Math.random() * 1.5;
      p.ttl = 0.7 + Math.random() * 0.7;
      p.life = 0;
    }
  }

  update(dt) {
    let any = false;

    for (let i = 0; i < this.N; i++) {
      const p = this.parts[i];

      if (p.life >= 0 && p.life < p.ttl) {
        p.life += dt;
        p.vy -= dt * 1.6;
        p.vx *= Math.exp(-dt * 1.6);
        p.vz *= Math.exp(-dt * 1.6);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        if (p.y < 0.05) {
          p.y = 0.05;
          p.vy *= -0.25;
        }

        if (p.life >= p.ttl) {
          this.pos[i * 3 + 1] = -99;
          this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
          any = true;
          continue;
        }

        const k = 1 - p.life / p.ttl;
        const f = k * k;

        this.pos[i * 3] = p.x;
        this.pos[i * 3 + 1] = p.y;
        this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = this.base.r * f;
        this.col[i * 3 + 1] = this.base.g * f;
        this.col[i * 3 + 2] = this.base.b * f;
        any = true;
      }
    }

    if (any) {
      this.pa.needsUpdate = true;
      this.ca.needsUpdate = true;
    }
  }
}

class Smoke {
  constructor(parent, anchor) {
    this.anchor = anchor;
    this.pool = [];
    this.acc = 0;
    this.rate = 0.45;

    const geo = new THREE.SphereGeometry(1, 8, 6);

    for (let i = 0; i < 14; i++) {
      const mm = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: 0x3d454f,
          transparent: true,
          opacity: 0,
          roughness: 1,
          metalness: 0,
          depthWrite: false,
        })
      );

      mm.visible = false;
      mm.userData = { age: -1 };
      parent.add(mm);
      this.pool.push(mm);
    }
  }

  spawn(boost = 1) {
    const mm = this.pool.find((p) => p.userData.age < 0);
    if (!mm) return;

    const u = mm.userData;
    u.ttl = 1.3 + Math.random() * 0.8;
    u.age = 0;
    u.ph = Math.random() * 9;
    u.p = this.anchor.clone().add(V((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.1));
    u.vx = (Math.random() - 0.5) * 0.3 + 0.15;
    u.vz = (Math.random() - 0.5) * 0.3;
    u.vy = 0.7 + Math.random() * 0.5;
    u.s0 = 0.09 * boost;
    u.s1 = (0.42 + Math.random() * 0.25) * boost;
    u.o = 0.6 + 0.4 * Math.random();

    mm.visible = true;
  }

  burst(n) {
    for (let i = 0; i < n; i++) this.spawn(1.6);
  }

  update(dt, t) {
    this.acc += dt * this.rate;

    while (this.acc > 1) {
      this.acc -= 1;
      this.spawn();
    }

    for (const mm of this.pool) {
      const u = mm.userData;
      if (u.age < 0) continue;

      u.age += dt;
      const k = u.age / u.ttl;

      if (k >= 1) {
        u.age = -1;
        mm.visible = false;
        continue;
      }

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
      parent.add(mm);
      this.rings.push(mm);
    }

    this.next = 0;
  }

  emit() {
    const mm = this.rings[this.next++ % 3];
    mm.userData.t = 0;
  }

  update(dt) {
    for (const mm of this.rings) {
      if (mm.userData.t < 0) continue;

      mm.userData.t += dt;
      const k = mm.userData.t / 1.1;

      if (k >= 1) {
        mm.userData.t = -1;
        mm.material.opacity = 0;
        continue;
      }

      const s = 0.7 + k * 1.6;
      mm.scale.set(s, s, 1);
      mm.material.opacity = 0.4 * (1 - k) * (k < 0.15 ? k / 0.15 : 1);
    }
  }
}

class Drops {
  /* water droplets */
  constructor(parent) {
    this.N = 110;
    this.pos = new Float32Array(this.N * 3);
    this.col = new Float32Array(this.N * 3);
    this.parts = [];

    for (let i = 0; i < this.N; i++) {
      this.parts.push({ life: -1, ttl: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0 });
    }

    const geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3);
    this.ca = new THREE.BufferAttribute(this.col, 3);
    this.pa.setUsage(THREE.DynamicDrawUsage);
    this.ca.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa);
    geo.setAttribute('color', this.ca);

    this.pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.17,
        map: softTex(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      })
    );

    this.pts.frustumCulled = false;
    this.base = new THREE.Color(0x9fdcf2);
    parent.add(this.pts);
  }

  spawn(n, y) {
    for (let k = 0; k < n; k++) {
      const i = this.parts.findIndex((p) => p.life < 0 || p.life >= p.ttl);
      if (i < 0) return;

      const p = this.parts[i];
      const a = Math.random() * Math.PI * 2;
      const sp = 0.25 + Math.random() * 1.2;

      p.x = (Math.random() - 0.5) * 0.22;
      p.z = (Math.random() - 0.5) * 0.22;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = 2.6 + Math.random() * 2.6;
      p.ttl = 0.65 + Math.random() * 0.55;
      p.life = 0;
    }
  }

  update(dt) {
    let any = false;

    for (let i = 0; i < this.N; i++) {
      const p = this.parts[i];

      if (p.life >= 0 && p.life < p.ttl) {
        p.life += dt;
        p.vy -= dt * 7.5;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        if (p.life >= p.ttl || p.y < 0) {
          this.pos[i * 3 + 1] = -99;
          this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
          any = true;
          continue;
        }

        const k = 1 - p.life / p.ttl;
        const f = k * k;

        this.pos[i * 3] = p.x;
        this.pos[i * 3 + 1] = p.y;
        this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = this.base.r * f;
        this.col[i * 3 + 1] = this.base.g * f;
        this.col[i * 3 + 2] = this.base.b * f;
        any = true;
      }
    }

    if (any) {
      this.pa.needsUpdate = true;
      this.ca.needsUpdate = true;
    }
  }
}

/* ============================================================
<<<<<<< HEAD
   RigViewer — the scene controller matching MachineSelection.jsx:
   one canvas, both rigs, hover-to-rig-up + drilling + water
   strike, click-to-select, and render-loop / disposal.

   Constructor contract (fixes the mismatch that broke the page):
     new RigViewer({ canvas, onHover, onSelect })
       onHover(key | null) — fired when the hovered rig changes
       onSelect(key)        — fired on a tap/click that lands on a rig
     viewer.setHover(key | null) — lets external UI (e.g. the label
       chips in MachineSelection.jsx) drive the same rig-up animation
       that canvas hover drives.
     viewer.dispose()

   A tap/click only fires onSelect if the pointer barely moved
   between down and up, so dragging to orbit the camera never
   accidentally selects a rig.
   ============================================================ */
export class RigViewer {
  constructor({ canvas, onHover, onSelect } = {}) {
    this.canvas = canvas;
    this.onHover = onHover || null;
    this.onSelect = onSelect || null;

=======
   SiteController — the missing piece: wires terrain + both rigs
   into one scene, drives hover-to-rig-up + drilling + water
   strike, and owns the render loop / disposal.

   ASSUMPTIONS (undocumented in the source you provided):
   - hover raycasts against each rig's own meshes (not the
     `hitbox` box, which had no consumer anywhere in the file).
   - reaching `cfg.waterDepth` triggers Drops+Ripple for
     `cfg.flowSec` seconds, then the rig retracts; re-hovering
     later resets depth and repeats.
   - camera holds one fixed framing that shows both rigs;
     there is no per-rig "zoom in" spec anywhere in your file.
   ============================================================ */
export class SiteController {
  constructor(canvas) {
    this.canvas = canvas;
>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1
    this.disposed = false;
    this._raf = 0;
    this._autoTimer = null;
    this._retryTimer = null;
    this._bound = [];
    this.units = {};
    this._hovered = null;
<<<<<<< HEAD
=======
    this._labelEl = null;
    this._labelSub = null;
>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1

    this._ndc = new THREE.Vector2();
    this.ray = new THREE.Raycaster();

    this._initScene();
    this._initTerrain();
    this._initUnits();
    this._initControls();
<<<<<<< HEAD
=======
    this._initLabel();
>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1
    this._bindEvents();
    this._resize();
    this._start();
  }

  /* ---------------- setup ---------------- */
  _initScene() {
    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = makeSkyTexture();
    this.scene.fog = new THREE.Fog(0x0a1420, 40, 150);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.camera.position.set(2, 20, 36);

    this.scene.add(new THREE.HemisphereLight(0x8fa6b0, 0x1a1408, 0.85));

    const key = new THREE.DirectionalLight(0xfff2df, 1.7);
    key.position.set(30, 42, 18);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -46;
    sc.right = 46;
    sc.top = 46;
    sc.bottom = -46;
    sc.near = 1;
    sc.far = 140;
    key.shadow.bias = -0.0003;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x5fb5a8, 0.4);
    fill.position.set(-24, 14, -20);
    this.scene.add(fill);
  }

  _initTerrain() {
    const { group, heightAt, padFactor } = buildTerrain();
    this.scene.add(group);
    this.heightAt = heightAt;
    this.padFactor = padFactor;
  }

  _initUnits() {
    for (const key of Object.keys(MACHINES)) {
      const cfg = MACHINES[key];
      const rig = cfg.builder(cfg.hex);
      const y = this.heightAt(cfg.place.x, cfg.place.z);

      rig.position.set(cfg.place.x, y, cfg.place.z);
      rig.rotation.y = cfg.place.yaw;
      this.scene.add(rig);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(cfg.ringR * 0.88, cfg.ringR, 48),
        new THREE.MeshBasicMaterial({
          color: cfg.hex,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cfg.place.x, y + 0.03, cfg.place.z);
      this.scene.add(ring);

      const u = rig.userData;
      const dust = new Dust(rig, V(u.holeX, 0.32, 0), cfg.hex, 0.16);
      const smoke = new Smoke(rig, u.smokeAnchor);
      const ripple = new Ripple(rig, u.holeX, cfg.ringR * 0.1, cfg.color);
      const drops = new Drops(rig);

      this.units[key] = {
        key,
        cfg,
        rig,
        ring,
        dust,
        smoke,
        ripple,
        drops,
        mastAngle: u.stow,
        mastTarget: u.stow,
        locked: false,
        ready: false,
        pipeRun: 0,
        bitLocal: u.headTopLocal - u.headOff - 0.55,
        hover: 0,
        hoverT: 0,
        spin: 0,
        lastHead: u.headTopLocal,
        lastAngle: u.stow,
        dustAcc: 0,
        rippleAcc: 0,
        drill: { on: false, phase: 'idle', head: u.headTopLocal, depth: 0, waterOn: false, waterT: 0 },
      };
    }
  }

  _initControls() {
    const controls = (this.controls = new OrbitControls(this.camera, this.canvas));
    controls.target.set(0, 4, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 14;
    controls.maxDistance = 70;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();
  }

<<<<<<< HEAD
=======
  _initLabel() {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'padding:6px 10px',
      'border-radius:7px',
      'background:rgba(6,10,17,.92)',
      'border:1px solid #20bea5',
      'color:#e8f0ee',
      "font:600 .68rem 'IBM Plex Mono', monospace",
      'letter-spacing:.16em',
      'white-space:nowrap',
      'opacity:0',
      'transform:translateY(5px)',
      'transition:opacity .16s, transform .16s',
      'z-index:5',
    ].join(';');
    this.canvas.parentElement.appendChild(el);
    this._labelEl = el;
  }

>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1
  _bindEvents() {
    const on = (type, fn, opts) => {
      this.canvas.addEventListener(type, fn, opts);
      this._bound.push([type, fn]);
    };

<<<<<<< HEAD
    let downX = 0, downY = 0, moved = false;

    on('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      moved = false;
    });

    on('pointermove', (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true;
      this._pick(e);
    });

    on('pointerup', (e) => {
      if (!moved) this._click(e);
    });

    on('pointerleave', () => this._applyHover(null));
=======
    on('pointermove', (e) => this._pick(e));
    on('pointerleave', () => this._setHover(null));
>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.canvas.parentElement);
  }

<<<<<<< HEAD
  /* ---------------- hover / picking / selection ---------------- */
  _raycastKey(e) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
=======
  /* ---------------- hover / picking ---------------- */
  _pick(e) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1

    this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this._ndc, this.camera);

    const rigs = Object.values(this.units).map((u) => u.rig);
    const hits = this.ray.intersectObjects(rigs, true);
<<<<<<< HEAD
    return hits.length ? this._unitOf(hits[0].object) : null;
  }

  _pick(e) {
    this._applyHover(this._raycastKey(e));
  }

  _click(e) {
    const key = this._raycastKey(e);
    if (key) this.onSelect && this.onSelect(key);
=======
    const key = hits.length ? this._unitOf(hits[0].object) : null;

    this._setHover(key, e);
>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1
  }

  _unitOf(obj) {
    for (const u of Object.values(this.units)) {
      let p = obj;
      while (p) {
        if (p === u.rig) return u.key;
        p = p.parent;
      }
    }
    return null;
  }

<<<<<<< HEAD
  /* Drives the rig-up animation. Used by both canvas hover and the
     public setHover() API so external UI (label chips) can trigger
     the same behavior as hovering the 3D model directly. */
  _applyHover(key) {
    if (this._hovered === key) return;

    this._hovered = key;

    for (const [k, u] of Object.entries(this.units)) {
      const isHovered = k === key;
      u.hoverT = isHovered ? 1 : 0;
      u.mastTarget = isHovered ? 0 : u.rig.userData.stow;
    }

    this.onHover && this.onHover(key);
  }

  /** Public API: let external UI (e.g. label chips) drive hover state. */
  setHover(key) {
    this._applyHover(key || null);
=======
  _setHover(key, e) {
    if (this._hovered && this._hovered !== key) {
      this.units[this._hovered].hoverT = 0;
    }

    this._hovered = key;
    this._labelSub = key;

    if (key) {
      const u = this.units[key];
      u.hoverT = 1;
      u.mastTarget = 0; // raise mast on hover

      this._labelEl.textContent = `${u.cfg.title} · ${u.cfg.tag}`;
      this._labelEl.style.borderColor = u.cfg.color;
      this._labelEl.style.color = u.cfg.lt;
      this._labelEl.style.opacity = '1';
      this._labelEl.style.transform = 'none';

      if (e) {
        const r = this.canvas.parentElement.getBoundingClientRect();
        let x = e.clientX - r.left + 16;
        let y = e.clientY - r.top + 18;
        x = Math.max(4, Math.min(x, r.width - 220));
        y = Math.max(4, Math.min(y, r.height - 40));
        this._labelEl.style.left = x + 'px';
        this._labelEl.style.top = y + 'px';
      }
    } else {
      for (const u of Object.values(this.units)) {
        u.mastTarget = u.rig.userData.stow; // lower mast when nothing hovered
      }
      this._labelEl.style.opacity = '0';
      this._labelEl.style.transform = 'translateY(5px)';
    }
>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1
  }

  /* ---------------- resize ---------------- */
  _resize() {
    const p = this.canvas.parentElement;
    const w = p.clientWidth;
    const h = p.clientHeight;
    if (!w || !h) return;

    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ---------------- per-unit update ---------------- */
  _updateUnit(u, dt, t) {
    const rigU = u.rig.userData;
    const cfg = u.cfg;

    u.hover += (u.hoverT - u.hover) * Math.min(1, dt * 6);

    const lam = REDUCED ? 18 : 2.2;
    u.mastAngle = damp(u.mastAngle, u.mastTarget, lam, dt);
    rigU.mast.rotation.z = u.mastAngle;

    const rigging = Math.abs(u.mastAngle - u.mastTarget) > 0.03;

    if (u.mastTarget === 0) {
      if (!u.locked && u.mastAngle < 0.06) {
        u.locked = true;
        u.pipeRun = 0;
        u.smoke.burst(3);
      }
      if (u.locked && !u.ready) {
        u.pipeRun = Math.min(1, u.pipeRun + dt / 0.8);
        const e = 1 - Math.pow(1 - u.pipeRun, 3);
        u.bitLocal = lerp(rigU.headTopLocal - rigU.headOff - 0.55, rigU.bitTopLocal, e);
        rigU.bitGroup.visible = u.pipeRun > 0.4;
        rigU.collar.visible = u.pipeRun > 0.3;
        rigU.hole.visible = u.pipeRun > 0.25;

        if (u.pipeRun >= 1) {
          u.ready = true;
          u.drill.on = true;
          u.drill.phase = 'down';
        }
      }
    } else {
      if (u.mastAngle > rigU.stow * 0.6) {
        u.locked = false;
        u.ready = false;
        u.pipeRun = 0;
        u.drill.on = false;
        u.drill.depth = 0;
        u.drill.waterOn = false;
        u.drill.waterT = 0;
      }
      u.bitLocal = rigU.headTopLocal - rigU.headOff - 0.55;
      rigU.bitGroup.visible = false;
      rigU.collar.visible = false;
      rigU.hole.visible = false;
    }

    const d = u.drill;

    if (u.ready && d.waterOn) {
      d.waterT -= dt;
      u.drops.spawn(3, rigU.headTopLocal * 0.15 + 0.3);
      u.rippleAcc += dt;
      if (u.rippleAcc > 0.3) {
        u.rippleAcc = 0;
        u.ripple.emit();
      }
      if (d.waterT <= 0) {
        d.waterOn = false;
        d.on = false;
        d.phase = 'up';
      }
    } else if (u.ready && d.on) {
      const span = rigU.headTopLocal - rigU.headLowLocal;

      if (d.phase === 'down') {
        d.head -= (span * dt) / cfg.drill.downSec;
        const pr = clamp((rigU.headTopLocal - d.head) / span, 0, 1);
        u.bitLocal = lerp(rigU.bitTopLocal, rigU.bitDeepLocal, pr);

        u.dustAcc += dt * 18;
        while (u.dustAcc > 1) {
          u.dustAcc -= 1;
          u.dust.burst(1);
        }

        u.rippleAcc += dt;
        if (u.rippleAcc > 0.5) {
          u.rippleAcc = 0;
          u.ripple.emit();
        }

        if (d.head <= rigU.headLowLocal) {
          d.head = rigU.headLowLocal;
          u.bitLocal = rigU.bitDeepLocal;
          d.phase = 'bottom';
          d.wait = 0.5;
          d.depth += cfg.drill.strokeFt;
          u.dust.burst(20);

          if (d.depth >= cfg.waterDepth) {
            d.waterOn = true;
            d.waterT = cfg.flowSec;
            u.drops.spawn(30, rigU.headTopLocal * 0.15 + 0.3);
            u.ripple.emit();
          }
        }
      } else if (d.phase === 'bottom') {
        d.wait -= dt;
        if (d.wait <= 0) d.phase = 'up';
      } else if (d.phase === 'up') {
        d.head += (span * dt) / cfg.drill.upSec;
        const pr = clamp((d.head - rigU.headLowLocal) / span, 0, 1);
        u.bitLocal = lerp(rigU.bitDeepLocal, rigU.bitTopLocal, pr);

        if (d.head >= rigU.headTopLocal) {
          d.head = rigU.headTopLocal;
          u.bitLocal = rigU.bitTopLocal;
          d.phase = d.depth >= cfg.waterDepth ? 'idle' : 'down';
          if (d.phase === 'idle') d.on = false;
        }
      }
    }

    rigU.head.position.y = d.head;
    const pipeTop = d.head - rigU.headOff;
    rigU.pipe.position.y = pipeTop;
    rigU.pipe.scale.y = Math.max(0.02, pipeTop - u.bitLocal);
    rigU.bitGroup.position.y = u.bitLocal;

    const spinRate = (d.on && d.phase !== 'up' ? 1 : 0.12) * cfg.drill.rpm * 0.105;
    u.spin += spinRate * dt;
    rigU.pipe.rotation.y = u.spin;
    rigU.bitGroup.rotation.y = u.spin * 1.7;
    for (const cn of rigU.cones) cn.rotation.y += dt * (d.on ? 9 : 1.5);

    for (const cb of rigU.cables) updateBar(cb.mesh, cb.from, _b.copy(rigU.head.position).add(cb.off));

    const dHead = d.head - u.lastHead;
    const dAng = u.mastAngle - u.lastAngle;
    u.lastHead = d.head;
    u.lastAngle = u.mastAngle;
    if (rigU.drum) rigU.drum.rotation.y += dHead * 6 + dAng * 3;
    for (const s of rigU.sheaves) s.rotation.y += dHead * 5 + dAng * 2.5;

    for (const h of rigU.hyd) {
      h.anchor.getWorldPosition(_a);
      u.rig.worldToLocal(_a);
      updateBar(h.mesh, h.base, _a);
    }
    if (rigU.fastline) {
      rigU.fastline.anchor.getWorldPosition(_a);
      u.rig.worldToLocal(_a);
      updateBar(rigU.fastline.mesh, rigU.fastline.base, _a);
    }

    const bm = rigU.beaconMat;
    if (d.waterOn) bm.emissiveIntensity = Math.sin(t * 22) > 0 ? 3.8 : 0.2;
    else if (u.ready && d.on) bm.emissiveIntensity = Math.sin(t * 18) > 0 ? 3.6 : 0.15;
    else if (rigging || (u.locked && !u.ready)) bm.emissiveIntensity = Math.sin(t * 12) > 0 ? 3.2 : 0.15;
    else bm.emissiveIntensity = 1 + Math.sin(t * 2.2) * 0.7;

    if (rigU.ledMat) rigU.ledMat.emissiveIntensity = u.ready && d.on ? 1.6 + Math.sin(t * 9) * 0.8 : 0.7;

    u.smoke.rate = d.on ? 5 : rigging ? 3 : 0.6;
    u.smoke.update(dt, t);
    u.dust.update(dt);
    u.ripple.update(dt);
    u.drops.update(dt);

    const ringMat = u.ring.material;
    ringMat.opacity = 0.35 + 0.3 * u.hover + (d.waterOn ? 0.25 * Math.sin(t * 10) : 0);
  }

  /* ---------------- main loop ---------------- */
  _start() {
    let last = performance.now();

    const tick = (now) => {
      if (this.disposed) return;
      this._raf = requestAnimationFrame(tick);

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      for (const u of Object.values(this.units)) this._updateUnit(u, dt, t);

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    this._raf = requestAnimationFrame(tick);
  }

  /* ---------------- disposal ---------------- */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
    if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
    this._ro.disconnect();
    for (const [type, fn] of this._bound) this.canvas.removeEventListener(type, fn);
    this._bound.length = 0;
    this.controls.dispose();
<<<<<<< HEAD
=======
    if (this._labelEl) { this._labelEl.remove(); this._labelEl = null; this._labelSub = null; }
>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1
    const mats = new Set(), texs = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mm = o.material;
      if (mm) {
        (Array.isArray(mm) ? mm : [mm]).forEach((m) => {
          if (mats.has(m)) return;
          mats.add(m);
          for (const k in m) {
            const v = m[k];
            if (v && v.isTexture) texs.add(v);
          }
        });
      }
    });
    texs.forEach((tx) => tx.dispose());
    mats.forEach((m) => m.dispose());
    this.renderer.dispose();
    this.scene = null; this.camera = null; this.controls = null;
    this.units = {};
  }
<<<<<<< HEAD
=======
}

/* ---------------- public mount helper ---------------- */
export function mountSite(canvas) {
  return new SiteController(canvas);
>>>>>>> f3bb49f0a1a6d3f93b84c6363e91a27a248b91c1
}