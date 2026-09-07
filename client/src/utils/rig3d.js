import * as THREE from 'three';

/* ---------------- shared utils ---------------- */
const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const _tv = new THREE.Vector3();

/* ---------------- machine catalogue ---------------- */
export const MACHINES = {
  big: {
    key: 'big',
    idx: '01',
    title: 'BIG MACHINE',
    tag: 'HEAVY-DUTY RIG',
    desc: 'Built for deep bores, high-volume output and large-diameter drilling.',
    color: '#16a34a',
    lt: '#4ade80',
    hex: 0x16a34a,
    cb: 'rgba(22,163,74,.55)',
    csh: 'rgba(22,163,74,.22)',
    view: { targetY: 4.6, dist: 16.5, min: 10, max: 24 },
    shadowR: 9,
    stageR: 5.2,
    drill: {
      strokeFt: 28,
      rpm: 128,
      torque: 18.6,
      psi: 340,
      downSec: 7.5,
      headTop: 8.6,
      headLow: 2.15,
      dustSize: 0.2,
    },
    specs: [
      ['MAX DEPTH', '1,500 ft'],
      ['BORE Ø', '6½″ – 12½″'],
      ['ENGINE', '351 HP · Diesel'],
      ['MAST', '8.2 m box truss'],
      ['MUD PUMP', 'Triplex 5×6'],
      ['TOOL JOINTS', '4¼″ API'],
    ],
    builder: buildBigRig,
  },

  small: {
    key: 'small',
    idx: '02',
    title: 'SMALL MACHINE',
    tag: 'COMPACT RIG',
    desc: 'Perfect for narrow sites, quick jobs and tight-access drilling.',
    color: '#d97706',
    lt: '#fbbf24',
    hex: 0xd97706,
    cb: 'rgba(217,119,6,.55)',
    csh: 'rgba(217,119,6,.22)',
    view: { targetY: 2.45, dist: 8.8, min: 5, max: 13 },
    shadowR: 6,
    stageR: 3.4,
    drill: {
      strokeFt: 9,
      rpm: 210,
      torque: 3.2,
      psi: 118,
      downSec: 6,
      headTop: 4.75,
      headLow: 1.45,
      dustSize: 0.13,
    },
    specs: [
      ['MAX DEPTH', '350 ft'],
      ['BORE Ø', '4″ – 8″'],
      ['ENGINE', '62 HP · Diesel'],
      ['MAST', '4.4 m guide frame'],
      ['PUMP', '3″ centrifugal'],
      ['GROSS WEIGHT', '2.4 t'],
    ],
    builder: buildSmallRig,
  },
};

/* ---------------- geometry helpers ---------------- */
const std = (o) => new THREE.MeshStandardMaterial(o);

function box(w, h, d, m) {
  const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  x.castShadow = true;
  x.receiveShadow = true;
  return x;
}

function cyl(rt, rb, h, m, seg = 16) {
  const x = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    m
  );
  x.castShadow = true;
  x.receiveShadow = true;
  return x;
}

function bar(a, b, w, m) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();

  const x = new THREE.Mesh(
    new THREE.BoxGeometry(w, len, w),
    m
  );

  x.position.copy(a).addScaledVector(dir, 0.5);
  x.quaternion.setFromUnitVectors(UP, dir.normalize());

  x.castShadow = true;
  x.receiveShadow = true;

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

  const len = _tv.length();

  mesh.position.copy(a);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(
    UP,
    _tv.normalize()
  );
}

function palette(accent) {
  const c = new THREE.Color(accent);

  return {
    body: std({
      color: c,
      metalness: 0.3,
      roughness: 0.52,
    }),

    bodyDark: std({
      color: c.clone().multiplyScalar(0.5),
      metalness: 0.38,
      roughness: 0.55,
    }),

    steel: std({
      color: 0x9aa3b0,
      metalness: 0.55,
      roughness: 0.38,
    }),

    dark: std({
      color: 0x272e3a,
      metalness: 0.45,
      roughness: 0.62,
    }),

    tire: std({
      color: 0x14171d,
      metalness: 0.05,
      roughness: 0.95,
    }),

    glass: std({
      color: 0x0e1a28,
      metalness: 0.85,
      roughness: 0.16,
    }),

    pipe: std({
      color: 0xc6ccd6,
      metalness: 0.7,
      roughness: 0.32,
    }),

    cable: std({
      color: 0x1b212c,
      metalness: 0.6,
      roughness: 0.5,
    }),

    beacon: std({
      color: 0x552f06,
      emissive: 0xffb020,
      emissiveIntensity: 1.2,
      roughness: 0.45,
    }),

    lamp: std({
      color: 0x0e1c28,
      emissive: 0xd9edff,
      emissiveIntensity: 2.4,
      roughness: 0.3,
    }),
  };
}

/* ---------------- BIG RIG ---------------- */
function buildBigRig(accent) {
  const p = palette(accent);
  const g = new THREE.Group();
  const u = g.userData;

  const A = 3.55;

  u.headTop = 8.6;
  u.headLow = 2.15;
  u.headOff = 0.46;

  const chassis = box(
    6.6,
    0.5,
    2.5,
    p.dark
  );

  chassis.position.set(-0.2, 1.16, 0);
  g.add(chassis);

  const deck = box(
    4.3,
    0.1,
    2.42,
    p.steel
  );

  deck.position.set(0.85, 1.47, 0);
  g.add(deck);

  const cab = box(
    2.05,
    1.8,
    2.3,
    p.body
  );

  cab.position.set(-2.45, 2.32, 0);
  g.add(cab);

  const skirt = box(
    1.95,
    0.5,
    2.34,
    p.dark
  );

  skirt.position.set(-2.45, 1.6, 0);
  g.add(skirt);

  const wind = box(
    0.07,
    0.85,
    2.0,
    p.glass
  );

  wind.position.set(-3.47, 2.62, 0);
  g.add(wind);

  const grille = box(
    0.1,
    0.72,
    1.55,
    p.dark
  );

  grille.position.set(-3.5, 1.95, 0);
  g.add(grille);

  const bumper = box(
    0.3,
    0.44,
    2.4,
    p.dark
  );

  bumper.position.set(-3.68, 1.5, 0);
  g.add(bumper);

  for (const s of [-1, 1]) {
    const sw = box(
      1.35,
      0.6,
      0.06,
      p.glass
    );

    sw.position.set(
      -2.45,
      2.72,
      s * 1.16
    );

    g.add(sw);

    const hl = cyl(
      0.11,
      0.11,
      0.09,
      p.lamp,
      14
    );

    hl.rotation.y = Math.PI / 2;

    hl.position.set(
      -3.5,
      1.66,
      s * 0.85
    );

    g.add(hl);

    const bc = cyl(
      0.085,
      0.085,
      0.22,
      p.beacon,
      10
    );

    bc.position.set(
      -2.9,
      3.33,
      s * 0.62
    );

    g.add(bc);
  }

  for (const x of [-1.7, 1.45, 2.45]) {
    for (const s of [-1, 1]) {
      const t = cyl(
        0.62,
        0.62,
        0.5,
        p.tire,
        26
      );

      t.rotation.x = Math.PI / 2;

      t.position.set(
        x,
        0.62,
        s * 1.31
      );

      g.add(t);

      const h = cyl(
        0.2,
        0.2,
        0.52,
        p.steel,
        12
      );

      h.rotation.x = Math.PI / 2;

      h.position.set(
        x,
        0.62,
        s * 1.31
      );

      g.add(h);
    }
  }

  for (const s of [-1, 1]) {
    const f1 = box(
      2.1,
      0.16,
      0.62,
      p.body
    );

    f1.position.set(
      1.95,
      1.5,
      s * 1.31
    );

    g.add(f1);

    const f2 = box(
      1.0,
      0.16,
      0.62,
      p.body
    );

    f2.position.set(
      -1.7,
      1.5,
      s * 1.31
    );

    g.add(f2);
  }

  for (const x of [0.6, 3.3]) {
    const beam = box(
      0.34,
      0.26,
      4.6,
      p.dark
    );

    beam.position.set(
      x,
      1.16,
      0
    );

    g.add(beam);

    for (const s of [-1, 1]) {
      const leg = cyl(
        0.13,
        0.13,
        1.05,
        p.steel,
        10
      );

      leg.position.set(
        x,
        0.55,
        s * 2.05
      );

      g.add(leg);

      const pad = cyl(
        0.3,
        0.34,
        0.16,
        p.dark,
        14
      );

      pad.position.set(
        x,
        0.08,
        s * 2.05
      );

      g.add(pad);
    }
  }

  const engine = box(
    1.5,
    1.05,
    1.85,
    p.body
  );

  engine.position.set(
    0.25,
    2.0,
    0
  );

  g.add(engine);

  for (const s of [-1, 1]) {
    const vent = box(
      1.2,
      0.5,
      0.05,
      p.dark
    );

    vent.position.set(
      0.25,
      2.0,
      s * 0.94
    );

    g.add(vent);
  }

  const exh = cyl(
    0.07,
    0.07,
    1.15,
    p.dark,
    10
  );

  exh.position.set(
    0.1,
    3.1,
    -0.72
  );

  g.add(exh);

  const air = cyl(
    0.16,
    0.16,
    0.72,
    p.steel,
    14
  );

  air.rotation.z = Math.PI / 2;

  air.position.set(
    0.25,
    2.62,
    0.55
  );

  g.add(air);

  const tank = box(
    1.25,
    1.0,
    2.0,
    p.bodyDark
  );

  tank.position.set(
    2.05,
    1.98,
    0
  );

  g.add(tank);

  const tr = box(
    1.3,
    0.06,
    2.05,
    p.steel
  );

  tr.position.set(
    2.05,
    2.51,
    0
  );

  g.add(tr);

  for (const s of [-1, 1]) {
    const cap = cyl(
      0.09,
      0.09,
      0.15,
      p.dark,
      10
    );

    cap.position.set(
      2.05,
      2.58,
      s * 0.62
    );

    g.add(cap);
  }

  const cc = box(
    1.05,
    1.45,
    1.9,
    p.bodyDark
  );

  cc.position.set(
    -1.0,
    2.22,
    0
  );

  g.add(cc);

  const ccw = box(
    0.06,
    0.6,
    1.4,
    p.glass
  );

  ccw.position.set(
    -0.43,
    2.55,
    0
  );

  g.add(ccw);

  const ccr = box(
    1.15,
    0.08,
    2.0,
    p.dark
  );

  ccr.position.set(
    -1.0,
    2.99,
    0
  );

  g.add(ccr);

  const mB = 1.35;
  const mT = 9.55;

  for (const s of [-1, 1]) {
    const leg = cyl(
      0.09,
      0.09,
      mB,
      p.steel,
      10
    );

    leg.position.set(
      A,
      mB / 2,
      s * 0.42
    );

    g.add(leg);

    g.add(
      bar(
        V(2.9, 1.42, s * 0.9),
        V(A, 5.2, s * 0.42),
        0.08,
        p.steel
      )
    );
  }

  const base = box(
    1.15,
    0.18,
    1.15,
    p.dark
  );

  base.position.set(
    A,
    1.44,
    0
  );

  g.add(base);

  const RX = [
    A - 0.36,
    A + 0.36,
  ];

  const RZ = [
    -0.42,
    0.42,
  ];

  for (const x of RX) {
    for (const z of RZ) {
      g.add(
        bar(
          V(x, mB, z),
          V(x, mT, z),
          0.09,
          p.steel
        )
      );
    }
  }

  const segs = 6;
  const dy = (mT - mB) / segs;

  for (let i = 0; i < segs; i++) {
    const y0 = mB + i * dy;
    const y1 = y0 + dy;

    for (const z of RZ) {
      if (i > 0) {
        g.add(
          bar(
            V(RX[0], y0, z),
            V(RX[1], y0, z),
            0.06,
            p.steel
          )
        );
      }

      g.add(
        i % 2 === 0
          ? bar(
              V(RX[0], y0, z),
              V(RX[1], y1, z),
              0.055,
              p.steel
            )
          : bar(
              V(RX[1], y0, z),
              V(RX[0], y1, z),
              0.055,
              p.steel
            )
      );
    }

    for (const x of RX) {
      g.add(
        bar(
          V(x, y0, RZ[0]),
          V(x, y0, RZ[1]),
          0.055,
          p.steel
        )
      );
    }
  }

  for (const z of RZ) {
    g.add(
      bar(
        V(RX[0], mT, z),
        V(RX[1], mT, z),
        0.07,
        p.steel
      )
    );
  }

  for (const x of RX) {
    g.add(
      bar(
        V(x, mT, RZ[0]),
        V(x, mT, RZ[1]),
        0.07,
        p.steel
      )
    );
  }

  const crown = box(
    1.2,
    0.42,
    1.05,
    p.bodyDark
  );

  crown.position.set(
    A,
    9.76,
    0
  );

  g.add(crown);

  const pulley = cyl(
    0.16,
    0.16,
    0.14,
    p.steel,
    16
  );

  pulley.rotation.x = Math.PI / 2;

  pulley.position.set(
    A,
    9.5,
    0
  );

  g.add(pulley);

  const cb2 = cyl(
    0.08,
    0.08,
    0.2,
    p.beacon,
    10
  );

  cb2.position.set(
    A,
    10.1,
    0
  );

  g.add(cb2);

  g.add(
    tube(
      [
        V(2.05, 2.4, 0.95),
        V(2.6, 3.2, 1.02),
        V(3.3, 4.3, 0.62),
        V(A, 5.1, 0.34),
      ],
      0.055,
      p.dark
    )
  );

  u.head = new THREE.Group();

  u.head.position.set(
    A,
    u.headTop,
    0
  );

  u.head.add(
    box(
      1.0,
      0.72,
      0.9,
      p.body
    )
  );

  for (const s of [-1, 1]) {
    const mo = cyl(
      0.15,
      0.15,
      0.5,
      p.dark,
      12
    );

    mo.position.set(
      s * 0.3,
      0.6,
      0
    );

    u.head.add(mo);
  }

  const hp = box(
    0.92,
    0.1,
    0.82,
    p.steel
  );

  hp.position.y = -0.42;

  u.head.add(hp);

  g.add(u.head);

  const pg = new THREE.CylinderGeometry(
    0.1,
    0.1,
    1,
    14
  );

  pg.translate(
    0,
    -0.5,
    0
  );

  u.pipe = new THREE.Mesh(
    pg,
    p.pipe
  );

  u.pipe.castShadow = true;

  u.pipe.position.set(
    A,
    u.headTop - u.headOff,
    0
  );

  g.add(u.pipe);

  u.bit = cyl(
    0.13,
    0.02,
    0.36,
    p.steel,
    10
  );

  u.bit.position.set(
    A,
    0.18,
    0
  );

  g.add(u.bit);

  for (const [x, z] of [
    [-0.3, -0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [0.3, 0.3],
  ]) {
    g.add(
      bar(
        V(A + x, 0.32, z),
        V(A + x, 0.05, z),
        0.06,
        p.dark
      )
    );
  }

  g.add(
    bar(
      V(A - 0.3, 0.32, -0.3),
      V(A + 0.3, 0.32, -0.3),
      0.06,
      p.dark
    )
  );

  g.add(
    bar(
      V(A - 0.3, 0.32, 0.3),
      V(A + 0.3, 0.32, 0.3),
      0.06,
      p.dark
    )
  );

  g.add(
    bar(
      V(A - 0.3, 0.05, -0.3),
      V(A + 0.3, 0.05, -0.3),
      0.06,
      p.dark
    )
  );

  g.add(
    bar(
      V(A - 0.3, 0.05, 0.3),
      V(A + 0.3, 0.05, 0.3),
      0.06,
      p.dark
    )
  );

  const cg = new THREE.CylinderGeometry(
    0.028,
    0.028,
    1,
    8
  );

  cg.translate(
    0,
    0.5,
    0
  );

  u.cables = [];

  for (const [fx, fz, ox, oz] of [
    [-0.26, -0.3, -0.2, -0.3],
    [0.26, 0.3, 0.2, 0.3],
  ]) {
    const m = new THREE.Mesh(
      cg,
      p.cable
    );

    m.castShadow = true;

    g.add(m);

    u.cables.push({
      mesh: m,
      from: V(
        A + fx,
        9.52,
        fz
      ),
      off: V(
        ox,
        0.44,
        oz
      ),
    });
  }

  u.beaconMat = p.beacon;

  u.bitPos = V(
    A,
    0.12,
    0
  );

  return g;
}

/* ---------------- SMALL RIG ---------------- */
function buildSmallRig(accent) {
  const p = palette(accent);
  const g = new THREE.Group();
  const u = g.userData;

  const A = 1.55;

  u.headTop = 4.75;
  u.headLow = 1.45;
  u.headOff = 0.3;

  const frame = box(
    3.0,
    0.32,
    1.5,
    p.body
  );

  frame.position.set(
    0.15,
    0.96,
    0
  );

  g.add(frame);

  g.add(
    bar(
      V(-1.35, 0.98, 0.34),
      V(-2.3, 0.68, 0.1),
      0.06,
      p.steel
    )
  );

  g.add(
    bar(
      V(-1.35, 0.98, -0.34),
      V(-2.3, 0.68, -0.1),
      0.06,
      p.steel
    )
  );

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(
      0.13,
      0.035,
      10,
      26
    ),
    p.steel
  );

  ring.rotation.y = Math.PI / 2;

  ring.position.set(
    -2.45,
    0.68,
    0
  );

  ring.castShadow = true;

  g.add(ring);

  for (const s of [-1, 1]) {
    const t = cyl(
      0.5,
      0.5,
      0.32,
      p.tire,
      22
    );

    t.rotation.x = Math.PI / 2;

    t.position.set(
      0.95,
      0.5,
      s * 0.86
    );

    g.add(t);

    const h = cyl(
      0.15,
      0.15,
      0.34,
      p.steel,
      10
    );

    h.rotation.x = Math.PI / 2;

    h.position.set(
      0.95,
      0.5,
      s * 0.86
    );

    g.add(h);

    const f = box(
      0.8,
      0.12,
      0.68,
      p.body
    );

    f.position.set(
      0.95,
      1.08,
      s * 0.86
    );

    g.add(f);
  }

  const mast = box(
    0.2,
    4.3,
    0.36,
    p.steel
  );

  mast.position.set(
    1.25,
    3.25,
    0
  );

  g.add(mast);

  const foot = box(
    0.42,
    0.26,
    0.6,
    p.dark
  );

  foot.position.set(
    1.25,
    1.2,
    0
  );

  g.add(foot);

  for (const s of [-1, 1]) {
    const rail = box(
      0.06,
      4.25,
      0.08,
      p.dark
    );

    rail.position.set(
      1.41,
      3.25,
      s * 0.15
    );

    g.add(rail);

    g.add(
      bar(
        V(1.2, 1.12, s * 0.62),
        V(1.32, 3.1, s * 0.13),
        0.05,
        p.steel
      )
    );
  }

  const plate = box(
    0.5,
    0.1,
    0.5,
    p.dark
  );

  plate.position.set(
    1.25,
    5.45,
    0
  );

  g.add(plate);

  const pulley = cyl(
    0.12,
    0.12,
    0.1,
    p.steel,
    14
  );

  pulley.rotation.x = Math.PI / 2;

  pulley.position.set(
    1.45,
    5.38,
    0
  );

  g.add(pulley);

  const bcn = cyl(
    0.06,
    0.06,
    0.16,
    p.beacon,
    10
  );

  bcn.position.set(
    1.25,
    5.6,
    0
  );

  g.add(bcn);

  u.head = new THREE.Group();

  u.head.position.set(
    A,
    u.headTop,
    0
  );

  u.head.add(
    box(
      0.4,
      0.48,
      0.42,
      p.body
    )
  );

  const mo = cyl(
    0.1,
    0.1,
    0.32,
    p.dark,
    10
  );

  mo.position.y = 0.36;

  u.head.add(mo);

  const hpl = box(
    0.42,
    0.08,
    0.44,
    p.steel
  );

  hpl.position.y = -0.26;

  u.head.add(hpl);

  g.add(u.head);

  const pg = new THREE.CylinderGeometry(
    0.05,
    0.05,
    1,
    12
  );

  pg.translate(
    0,
    -0.5,
    0
  );

  u.pipe = new THREE.Mesh(
    pg,
    p.pipe
  );

  u.pipe.castShadow = true;

  u.pipe.position.set(
    A,
    u.headTop - u.headOff,
    0
  );

  g.add(u.pipe);

  u.bit = cyl(
    0.08,
    0.015,
    0.24,
    p.steel,
    10
  );

  u.bit.position.set(
    A,
    0.12,
    0
  );

  g.add(u.bit);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(
      0.09,
      0.045,
      10,
      18
    ),
    p.dark
  );

  collar.rotation.x = Math.PI / 2;

  collar.position.set(
    A,
    0.28,
    0
  );

  collar.castShadow = true;

  g.add(collar);

  const cg = new THREE.CylinderGeometry(
    0.018,
    0.018,
    1,
    8
  );

  cg.translate(
    0,
    0.5,
    0
  );

  const cm = new THREE.Mesh(
    cg,
    p.cable
  );

  cm.castShadow = true;

  g.add(cm);

  u.cables = [
    {
      mesh: cm,
      from: V(
        1.45,
        5.35,
        0
      ),
      off: V(
        -0.1,
        0.28,
        0
      ),
    },
  ];

  const eng = box(
    0.85,
    0.55,
    0.75,
    p.dark
  );

  eng.position.set(
    -0.05,
    1.4,
    0
  );

  g.add(eng);

  const exh = cyl(
    0.04,
    0.04,
    0.5,
    p.dark,
    8
  );

  exh.position.set(
    -0.32,
    1.95,
    0.2
  );

  g.add(exh);

  const recoil = new THREE.Mesh(
    new THREE.TorusGeometry(
      0.09,
      0.02,
      8,
      20
    ),
    p.steel
  );

  recoil.position.set(
    -0.05,
    1.45,
    0.39
  );

  g.add(recoil);

  const fuel = cyl(
    0.16,
    0.16,
    0.72,
    p.body,
    14
  );

  fuel.rotation.z = Math.PI / 2;

  fuel.position.set(
    -0.95,
    1.32,
    0
  );

  g.add(fuel);

  const tbox = box(
    0.5,
    0.32,
    0.8,
    p.bodyDark
  );

  tbox.position.set(
    0.62,
    1.28,
    0
  );

  g.add(tbox);

  for (const s of [-1, 1]) {
    const leg = cyl(
      0.05,
      0.05,
      1.1,
      p.steel,
      8
    );

    leg.position.set(
      -1.2,
      0.59,
      s * 0.55
    );

    g.add(leg);

    const pad = cyl(
      0.14,
      0.16,
      0.08,
      p.dark,
      12
    );

    pad.position.set(
      -1.2,
      0.04,
      s * 0.55
    );

    g.add(pad);
  }

  for (const s of [-1, 1]) {
    g.add(
      bar(
        V(1.62, 1.06, s * 0.38),
        V(2.28, 1.52, s * 0.3),
        0.045,
        p.steel
      )
    );
  }

  const cross = cyl(
    0.04,
    0.04,
    0.66,
    p.dark,
    8
  );

  cross.rotation.x = Math.PI / 2;

  cross.position.set(
    2.28,
    1.54,
    0
  );

  g.add(cross);

  g.add(
    tube(
      [
        V(-0.05, 1.5, 0.38),
        V(0.35, 1.32, 0.6),
        V(0.95, 1.22, 0.4),
        V(1.2, 1.15, 0.18),
      ],
      0.035,
      p.dark
    )
  );

  u.beaconMat = p.beacon;

  u.bitPos = V(
    A,
    0.08,
    0
  );

  return g;
}

/* ---------------- turntable stage ---------------- */
function stageTexture(cssAccent) {
  const S = 512;

  const c = document.createElement(
    'canvas'
  );

  c.width = c.height = S;

  const x = c.getContext('2d');
  const cx = S / 2;

  x.fillStyle = '#0b111d';
  x.fillRect(
    0,
    0,
    S,
    S
  );

  x.strokeStyle =
    'rgba(255,255,255,.06)';

  x.lineWidth = 2;

  for (const f of [
    0.28,
    0.5,
    0.72,
  ]) {
    x.beginPath();

    x.arc(
      cx,
      cx,
      cx * f,
      0,
      Math.PI * 2
    );

    x.stroke();
  }

  x.strokeStyle =
    'rgba(255,255,255,.12)';

  x.beginPath();

  x.arc(
    cx,
    cx,
    cx * 0.94,
    0,
    Math.PI * 2
  );

  x.stroke();

  x.strokeStyle = cssAccent;
  x.globalAlpha = 0.28;
  x.lineWidth = 3;

  for (let i = 0; i < 36; i++) {
    const a =
      (i / 36) *
      Math.PI *
      2;

    const r1 = cx * 0.88;
    const r2 = cx * 0.955;

    x.beginPath();

    x.moveTo(
      cx + Math.cos(a) * r1,
      cx + Math.sin(a) * r1
    );

    x.lineTo(
      cx + Math.cos(a) * r2,
      cx + Math.sin(a) * r2
    );

    x.stroke();
  }

  x.globalAlpha = 0.5;

  x.strokeStyle =
    'rgba(255,255,255,.25)';

  x.lineWidth = 2;

  x.beginPath();

  x.moveTo(
    cx - 14,
    cx
  );

  x.lineTo(
    cx + 14,
    cx
  );

  x.moveTo(
    cx,
    cx - 14
  );

  x.lineTo(
    cx,
    cx + 14
  );

  x.stroke();

  x.globalAlpha = 1;

  const t =
    new THREE.CanvasTexture(c);

  t.colorSpace =
    THREE.SRGBColorSpace;

  t.anisotropy = 4;

  return t;
}

function buildStage(
  radius,
  accentHex,
  colorCss
) {
  const g =
    new THREE.Group();

  const top = std({
    color: 0xffffff,
    map: stageTexture(colorCss),
    roughness: 0.93,
    metalness: 0.08,
  });

  const side = std({
    color: 0x0a0f18,
    roughness: 0.85,
    metalness: 0.2,
  });

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      0.18,
      72
    ),
    [
      side,
      top,
      side,
    ]
  );

  disc.position.y = -0.09;

  disc.receiveShadow = true;

  g.add(disc);

  const ringMat = std({
    color: new THREE.Color(
      accentHex
    ).multiplyScalar(0.3),

    emissive: accentHex,

    emissiveIntensity: 1.1,

    roughness: 0.6,

    metalness: 0.1,
  });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(
      radius - 0.07,
      0.032,
      10,
      96
    ),
    ringMat
  );

  ring.rotation.x =
    Math.PI / 2;

  ring.position.y = 0.02;

  g.add(ring);

  g.userData.ringMat =
    ringMat;

  return g;
}

/* ---------------- drill dust ---------------- */
function makeSoftTex() {
  const c =
    document.createElement(
      'canvas'
    );

  c.width =
    c.height = 64;

  const x =
    c.getContext('2d');

  const gr =
    x.createRadialGradient(
      32,
      32,
      0,
      32,
      32,
      32
    );

  gr.addColorStop(
    0,
    'rgba(255,255,255,1)'
  );

  gr.addColorStop(
    0.35,
    'rgba(255,255,255,.5)'
  );

  gr.addColorStop(
    1,
    'rgba(255,255,255,0)'
  );

  x.fillStyle =
    gr;

  x.fillRect(
    0,
    0,
    64,
    64
  );

  const t =
    new THREE.CanvasTexture(c);

  t.colorSpace =
    THREE.SRGBColorSpace;

  return t;
}

class Dust {
  constructor(
    parent,
    origin,
    accentHex,
    size
  ) {
    this.N = 90;

    this.origin =
      origin;

    this.pos =
      new Float32Array(
        this.N * 3
      );

    this.col =
      new Float32Array(
        this.N * 3
      );

    this.parts = [];

    for (
      let i = 0;
      i < this.N;
      i++
    ) {
      this.parts.push({
        life: -1,
        ttl: 1,
        x: 0,
        y: -99,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
      });
    }

    const geo =
      new THREE.BufferGeometry();

    this.pa =
      new THREE.BufferAttribute(
        this.pos,
        3
      );

    this.ca =
      new THREE.BufferAttribute(
        this.col,
        3
      );

    this.pa.setUsage(
      THREE.DynamicDrawUsage
    );

    this.ca.setUsage(
      THREE.DynamicDrawUsage
    );

    geo.setAttribute(
      'position',
      this.pa
    );

    geo.setAttribute(
      'color',
      this.ca
    );

    this.pts =
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size,
          map: makeSoftTex(),
          transparent: true,
          depthWrite: false,
          blending:
            THREE.AdditiveBlending,
          vertexColors: true,
        })
      );

    this.pts.frustumCulled =
      false;

    this.base =
      new THREE.Color(
        0xc09a6e
      ).lerp(
        new THREE.Color(
          accentHex
        ),
        0.25
      );

    parent.add(
      this.pts
    );
  }

  burst(n) {
    for (
      let k = 0;
      k < n;
      k++
    ) {
      const i =
        this.parts.findIndex(
          (p) =>
            p.life < 0 ||
            p.life >= p.ttl
        );

      if (i < 0) return;

      const p =
        this.parts[i];

      const a =
        Math.random() *
        Math.PI *
        2;

      const sp =
        0.5 +
        Math.random() *
          1.3;

      p.x =
        this.origin.x +
        (Math.random() -
          0.5) *
          0.25;

      p.z =
        this.origin.z +
        (Math.random() -
          0.5) *
          0.25;

      p.y =
        this.origin.y +
        Math.random() *
          0.1;

      p.vx =
        Math.cos(a) *
        sp;

      p.vz =
        Math.sin(a) *
        sp;

      p.vy =
        0.9 +
        Math.random() *
          1.5;

      p.ttl =
        0.7 +
        Math.random() *
          0.7;

      p.life = 0;
    }
  }

  update(dt) {
    let any = false;

    for (
      let i = 0;
      i < this.N;
      i++
    ) {
      const p =
        this.parts[i];

      if (
        p.life >= 0 &&
        p.life < p.ttl
      ) {
        p.life += dt;

        p.vy -=
          dt * 1.6;

        p.vx *=
          Math.exp(
            -dt * 1.6
          );

        p.vz *=
          Math.exp(
            -dt * 1.6
          );

        p.x +=
          p.vx * dt;

        p.y +=
          p.vy * dt;

        p.z +=
          p.vz * dt;

        if (
          p.y < 0.05
        ) {
          p.y = 0.05;
          p.vy *= -0.25;
        }

        if (
          p.life >=
          p.ttl
        ) {
          this.pos[
            i * 3 + 1
          ] = -99;

          this.col[
            i * 3
          ] = 0;

          this.col[
            i * 3 + 1
          ] = 0;

          this.col[
            i * 3 + 2
          ] = 0;

          any = true;

          continue;
        }

        const k =
          1 -
          p.life /
            p.ttl;

        const f =
          k * k;

        this.pos[
          i * 3
        ] = p.x;

        this.pos[
          i * 3 + 1
        ] = p.y;

        this.pos[
          i * 3 + 2
        ] = p.z;

        this.col[
          i * 3
        ] =
          this.base.r *
          f;

        this.col[
          i * 3 + 1
        ] =
          this.base.g *
          f;

        this.col[
          i * 3 + 2
        ] =
          this.base.b *
          f;

        any = true;
      }
    }

    if (any) {
      this.pa.needsUpdate =
        true;

      this.ca.needsUpdate =
        true;
    }
  }
}

/* ---------------- interactive 3D viewer ---------------- */
const easeOutBack =
  (x) => {
    const c1 =
      1.70158;

    const c3 =
      c1 + 1;

    return (
      1 +
      c3 *
        Math.pow(
          x - 1,
          3
        ) +
      c1 *
        Math.pow(
          x - 1,
          2
        )
    );
  };

export class RigViewer {
  constructor({
    canvas,
    machine,
    dist,
  }) {
    const cfg =
      MACHINES[machine];

    this.cfg =
      cfg;

    this.canvas =
      canvas;

    this.active =
      true;

    this.w = 0;

    this.hover =
      0;

    this.hoverT =
      0;

    this.flash =
      0;

    this.idleT =
      0;

    this.orbit = {
      yaw: 0.78,
      pitch: 0.3,
      dist:
        dist ||
        cfg.view.dist,
      vYaw:
        REDUCED
          ? 0
          : 1.5,
    };

    this.target =
      V(
        0,
        cfg.view.targetY,
        0
      );

    this.born =
      performance.now() /
      1000;

    const r =
      (this.renderer =
        new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
        }));

    r.setPixelRatio(
      Math.min(
        window.devicePixelRatio ||
          1,
        2
      )
    );

    r.setClearColor(
      0x000000,
      0
    );

    r.shadowMap.enabled =
      true;

    r.shadowMap.type =
      THREE.PCFSoftShadowMap;

    r.toneMapping =
      THREE.ACESFilmicToneMapping;

    r.toneMappingExposure =
      1.12;

    const s =
      (this.scene =
        new THREE.Scene());

    this.root =
      new THREE.Group();

    s.add(
      this.root
    );

    const stage =
      buildStage(
        cfg.stageR,
        cfg.hex,
        cfg.color
      );

    this.ringMat =
      stage.userData.ringMat;

    this.rig =
      cfg.builder(
        cfg.hex
      );

    this.root.add(
      stage,
      this.rig
    );

    const u =
      this.rig.userData;

    this.camera =
      new THREE.PerspectiveCamera(
        40,
        1,
        0.1,
        140
      );

    s.add(
      new THREE.HemisphereLight(
        0x55637d,
        0x05070c,
        0.9
      )
    );

    const key =
      new THREE.DirectionalLight(
        0xffffff,
        2.3
      );

    key.position.set(
      7,
      10,
      5
    );

    key.castShadow =
      true;

    key.shadow.mapSize.set(
      1024,
      1024
    );

    const sc =
      key.shadow.camera;

    const R =
      cfg.shadowR;

    sc.left = -R;
    sc.right = R;
    sc.top = R;
    sc.bottom = -R;

    sc.near = 0.5;
    sc.far = 40;

    key.shadow.normalBias =
      0.03;

    key.shadow.bias =
      -0.0002;

    s.add(key);

    const rim =
      new THREE.DirectionalLight(
        0x2bd4bd,
        1.0
      );

    rim.position.set(
      -8,
      5,
      -7
    );

    s.add(rim);

    const fill =
      new THREE.DirectionalLight(
        cfg.hex,
        0.7
      );

    fill.position.set(
      5,
      2,
      -8
    );

    s.add(fill);

    this.accent =
      new THREE.PointLight(
        cfg.hex,
        55,
        22,
        2
      );

    this.accent.position.set(
      0,
      cfg.view.targetY +
        1.5,
      6.5
    );

    s.add(
      this.accent
    );

    this.dust =
      new Dust(
        this.root,
        u.bitPos.clone(),
        cfg.hex,
        cfg.drill.dustSize
      );

    this.dustAcc =
      0;

    /*
     * AUTOMATIC DRILLING
     *
     * Starts immediately.
     * Down -> bottom pause -> up -> repeat.
     */
    this.drill = {
      on: true,
      phase: 'down',
      headY:
        cfg.drill.headTop,
      wait: 0,
      depth: 0,
    };

    this._spin =
      0;

    this.onStroke =
      null;

    this.firstDragCb =
      null;

    this._bindControls();

    this._ro =
      new ResizeObserver(
        () =>
          this._resize()
      );

    this._ro.observe(
      canvas.parentElement
    );

    this._resize();
  }

  _resize() {
    const p =
      this.canvas
        .parentElement;

    const w =
      p.clientWidth;

    const h =
      p.clientHeight;

    if (
      !w ||
      !h
    ) {
      this.w = 0;
      return;
    }

    this.w = w;

    this.renderer.setSize(
      w,
      h,
      false
    );

    this.camera.aspect =
      w / h;

    this.camera.updateProjectionMatrix();
  }

  _bindControls() {
    const c =
      this.canvas;

    const ptrs =
      (this._ptrs =
        new Map());

    let lastPinch = 0;

    let downX = 0;
    let downY = 0;

    c.addEventListener(
      'pointerdown',
      (e) => {
        c.setPointerCapture(
          e.pointerId
        );

        ptrs.set(
          e.pointerId,
          {
            x: e.clientX,
            y: e.clientY,
          }
        );

        downX =
          e.clientX;

        downY =
          e.clientY;

        this.orbit.vYaw =
          0;

        this.idleT =
          0;
      }
    );

    c.addEventListener(
      'pointermove',
      (e) => {
        const prev =
          ptrs.get(
            e.pointerId
          );

        if (!prev)
          return;

        if (
          ptrs.size === 2
        ) {
          ptrs.set(
            e.pointerId,
            {
              x: e.clientX,
              y: e.clientY,
            }
          );

          const [
            a,
            b,
          ] = [
            ...ptrs.values(),
          ];

          const d =
            Math.hypot(
              a.x - b.x,
              a.y - b.y
            );

          if (
            lastPinch > 0
          ) {
            this.orbit.dist =
              clamp(
                (this.orbit.dist *
                  lastPinch) /
                  d,
                this.cfg.view.min,
                this.cfg.view.max
              );
          }

          lastPinch =
            d;

          return;
        }

        const dx =
          e.clientX -
          prev.x;

        const dy =
          e.clientY -
          prev.y;

        this.orbit.yaw -=
          dx * 0.0052;

        this.orbit.vYaw =
          -dx * 0.0052;

        this.orbit.pitch =
          clamp(
            this.orbit.pitch +
              dy * 0.0032,
            0.06,
            1.02
          );

        ptrs.set(
          e.pointerId,
          {
            x: e.clientX,
            y: e.clientY,
          }
        );

        if (
          this.firstDragCb &&
          Math.abs(
            e.clientX -
              downX
          ) +
            Math.abs(
              e.clientY -
                downY
            ) >
              8
        ) {
          this.firstDragCb();

          this.firstDragCb =
            null;
        }

        this.idleT =
          0;
      }
    );

    const up =
      (e) => {
        ptrs.delete(
          e.pointerId
        );

        if (
          ptrs.size < 2
        ) {
          lastPinch =
            0;
        }
      };

    c.addEventListener(
      'pointerup',
      up
    );

    c.addEventListener(
      'pointercancel',
      up
    );

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();

        this.orbit.dist =
          clamp(
            this.orbit.dist *
              Math.exp(
                e.deltaY *
                  0.0011
              ),
            this.cfg.view.min,
            this.cfg.view.max
          );
      },
      {
        passive: false,
      }
    );
  }

  setHover(h) {
    this.hoverT =
      h ? 1 : 0;
  }

  powerFlash() {
    this.flash =
      1;

    this.dust.burst(
      16
    );
  }

  startDrill() {
    if (
      !this.drill.on
    ) {
      this.drill.on =
        true;

      this.drill.phase =
        'down';
    }
  }

  stopDrill() {
    this.drill.on =
      false;

    this.drill.phase =
      'idle';
  }

  drillDepth() {
    const d =
      this.drill;

    const c =
      this.cfg.drill;

    const prog =
      d.phase ===
      'down'
        ? clamp(
            (c.headTop -
              d.headY) /
              (c.headTop -
                c.headLow),
            0,
            1
          )
        : 0;

    return (
      d.depth +
      prog *
        c.strokeFt
    );
  }

  update(dt, t) {
    const o =
      this.orbit;

    const drag =
      this._ptrs.size >
      0;

    if (!drag) {
      o.yaw +=
        o.vYaw;

      o.vYaw *=
        Math.exp(
          -dt * 3.1
        );

      this.idleT +=
        dt;

      if (
        this.idleT >
          2.2 &&
        !REDUCED
      ) {
        o.yaw +=
          (0.1 +
            0.12 *
              this.hover) *
          dt;
      }
    }

    this.hover +=
      (this.hoverT -
        this.hover) *
      Math.min(
        1,
        dt * 6
      );

    this.flash *=
      Math.exp(
        -dt * 2.6
      );

    const dist =
      o.dist *
      (1 -
        0.07 *
          (this.hover +
            this.flash));

    this.camera.position.set(
      this.target.x +
        dist *
          Math.cos(
            o.pitch
          ) *
          Math.sin(
            o.yaw
          ),

      this.target.y +
        dist *
          Math.sin(
            o.pitch
          ),

      this.target.z +
        dist *
          Math.cos(
            o.pitch
          ) *
          Math.cos(
            o.yaw
          )
    );

    this.camera.lookAt(
      this.target
    );

    const age =
      clamp(
        (t -
          this.born) /
          0.8,
        0,
        1
      );

    this.root.scale.setScalar(
      Math.max(
        0.001,
        REDUCED
          ? 1
          : easeOutBack(
              age
            )
      )
    );

    this.accent.intensity =
      50 +
      60 *
        this.hover +
      150 *
        this.flash;

    this.ringMat.emissiveIntensity =
      0.9 +
      0.9 *
        this.hover +
      2.4 *
        this.flash +
      0.12 *
        Math.sin(
          t * 1.6
        );

    const d =
      this.drill;

    const c =
      this.cfg.drill;

    const u =
      this.rig.userData;

    /*
     * AUTOMATIC BLINKING LIGHT
     *
     * Sharp repeating blink while drilling.
     */
    const blink =
      Math.sin(
        t * 15
      ) > 0;

    u.beaconMat.emissiveIntensity =
      d.on
        ? blink
          ? 3.4
          : 0.12
        : 1 +
          Math.sin(
            t * 2.2
          ) *
            0.7 +
          this.flash *
            3;

    /*
     * AUTOMATIC DRILL CYCLE
     *
     * DOWN
     *   ↓
     * BOTTOM
     *   ↓
     * UP
     *   ↓
     * DOWN AGAIN
     */
    if (d.on) {
      const span =
        c.headTop -
        c.headLow;

      if (
        d.phase ===
        'down'
      ) {
        d.headY -=
          (dt * span) /
          c.downSec;

        this.dustAcc +=
          dt * 20;

        while (
          this.dustAcc >
          1
        ) {
          this.dustAcc -=
            1;

          this.dust.burst(
            1
          );
        }

        if (
          d.headY <=
          c.headLow
        ) {
          d.headY =
            c.headLow;

          d.phase =
            'bottom';

          d.wait =
            0.55;

          d.depth +=
            c.strokeFt;

          this.dust.burst(
            26
          );

          if (
            this.onStroke
          ) {
            this.onStroke();
          }
        }
      } else if (
        d.phase ===
        'bottom'
      ) {
        d.wait -=
          dt;

        if (
          d.wait <=
          0
        ) {
          d.phase =
            'up';
        }
      } else if (
        d.phase ===
        'up'
      ) {
        d.headY +=
          (dt * span) /
          2.3;

        if (
          d.headY >=
          c.headTop
        ) {
          d.headY =
            c.headTop;

          d.phase =
            'down';
        }
      }
    }

    /*
     * DRILL ROTATION
     */
    const spin =
      (d.on
        ? d.phase ===
          'up'
          ? 0.25
          : 1
        : 0) *
        c.rpm *
        0.105 +
      this.flash *
        22;

    this._spin +=
      spin * dt;

    /*
     * MOVE DRILL HEAD
     */
    u.head.position.y =
      d.headY;

    u.head.rotation.y =
      this._spin;

    /*
     * MOVE DRILL PIPE
     */
    const pipeTop =
      d.headY -
      u.headOff;

    u.pipe.position.y =
      pipeTop;

    u.pipe.scale.y =
      pipeTop;

    /*
     * ROTATE DRILL BIT
     */
    u.bit.rotation.y =
      this._spin;

    /*
     * SMALL DRILL VIBRATION
     */
    u.bit.position.y =
      u.bitPos.y +
      (d.on
        ? 0.02 *
          Math.sin(
            t * 28
          )
        : 0);

    /*
     * FLEXIBLE CABLES
     */
    for (
      const cb of
        u.cables
    ) {
      updateBar(
        cb.mesh,
        cb.from,
        _tv
          .copy(
            u.head
              .position
          )
          .add(
            cb.off
          )
      );
    }

    /*
     * DUST
     */
    this.dust.update(
      dt
    );

    /*
     * RENDER
     */
    if (
      this.active &&
      this.w
    ) {
      this.renderer.render(
        this.scene,
        this.camera
      );
    }
  }

  dispose() {
    if (
      this._ro
    ) {
      this._ro.disconnect();
    }

    this.renderer.dispose();
  }
}