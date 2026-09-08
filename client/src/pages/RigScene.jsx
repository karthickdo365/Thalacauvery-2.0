import { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  ContactShadows,
  Sparkles,
  Loader,
} from '@react-three/drei';
import * as THREE from 'three';

const CROWN_Y = 4.4;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/** Procedural amber/black hazard-stripe canvas texture — no image asset needed */
function useHazardTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#14181f';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth = 18;
    for (let x = -size; x < size * 2; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, size);
      ctx.lineTo(x + size, 0);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    return tex;
  }, []);
}

/** A single steel strut drawn as a cylinder oriented between two points */
function Strut({ start, end, radius = 0.035, color = '#8a94a3', roughness = 0.35 }) {
  const { position, quaternion, length } = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const dir = new THREE.Vector3().subVectors(e, s);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    return { position: mid, quaternion: quat, length: len };
  }, [start, end]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={0.85} roughness={roughness} />
    </mesh>
  );
}

/** Tapering lattice derrick tower, generated level by level */
function DerrickTower() {
  const levels = 4;
  const height = CROWN_Y;
  const baseHalf = 0.85;
  const topHalf = 0.32;
  const levelH = height / levels;

  const levelPoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= levels; i++) {
      const h = i * levelH;
      const half = THREE.MathUtils.lerp(baseHalf, topHalf, i / levels);
      pts.push([
        [half, h, half],
        [half, h, -half],
        [-half, h, -half],
        [-half, h, half],
      ]);
    }
    return pts;
  }, []);

  const struts = [];
  for (let i = 0; i < levels; i++) {
    const lower = levelPoints[i];
    const upper = levelPoints[i + 1];

    for (let c = 0; c < 4; c++) {
      struts.push(<Strut key={`leg-${i}-${c}`} start={lower[c]} end={upper[c]} radius={0.045} />);
    }
    for (let c = 0; c < 4; c++) {
      struts.push(
        <Strut key={`ring-${i}-${c}`} start={lower[c]} end={lower[(c + 1) % 4]} radius={0.03} color="#6b7482" />
      );
    }
    for (let c = 0; c < 4; c++) {
      const c2 = (c + 1) % 4;
      struts.push(
        <Strut key={`x1-${i}-${c}`} start={lower[c]} end={upper[c2]} radius={0.022} color="#f5a623" roughness={0.5} />
      );
      struts.push(
        <Strut key={`x2-${i}-${c}`} start={lower[c2]} end={upper[c]} radius={0.022} color="#f5a623" roughness={0.5} />
      );
    }
  }
  const top = levelPoints[levels];
  for (let c = 0; c < 4; c++) {
    struts.push(<Strut key={`ring-top-${c}`} start={top[c]} end={top[(c + 1) % 4]} radius={0.03} color="#6b7482" />);
  }

  return <group>{struts}</group>;
}

/** Crown block, cable, bobbing/spinning drill bit, warning beacon, sparks */
function DrillString({ reduced }) {
  const crownRef = useRef();
  const beaconRef = useRef();
  const bobRef = useRef();
  const spinRef = useRef();
  const cableRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (crownRef.current && !reduced) crownRef.current.rotation.y = t * 1.4;

    const bob = 3.6 + Math.sin(t * 0.9) * 0.32;
    if (bobRef.current) bobRef.current.position.y = bob;
    if (spinRef.current && !reduced) spinRef.current.rotation.y = t * 9;

    if (cableRef.current) {
      const len = CROWN_Y - bob;
      cableRef.current.scale.y = len;
      cableRef.current.position.y = bob + len / 2;
    }
    if (beaconRef.current) {
      beaconRef.current.material.emissiveIntensity = 1.4 + Math.sin(t * 4) * 0.9;
    }
  });

  return (
    <group>
      <group ref={crownRef} position={[0, CROWN_Y, 0]}>
        <mesh>
          <torusGeometry args={[0.22, 0.05, 8, 20]} />
          <meshStandardMaterial color="#8a94a3" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>

      <mesh ref={beaconRef} position={[0, CROWN_Y + 0.3, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#f5a623" emissive="#f5a623" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, CROWN_Y + 0.3, 0]} color="#f5a623" intensity={1.2} distance={3} />

      <mesh ref={cableRef} position={[0, 4, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1, 6]} />
        <meshStandardMaterial color="#2b3038" metalness={0.6} roughness={0.5} />
      </mesh>

      <group ref={bobRef} position={[0, 3.6, 0]}>
        <group ref={spinRef}>
          <mesh position={[0, -0.25, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.5, 10]} />
            <meshStandardMaterial color="#c2410c" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.62, 0]}>
            <coneGeometry args={[0.12, 0.3, 10]} />
            <meshStandardMaterial color="#f5a623" metalness={0.7} roughness={0.35} />
          </mesh>
        </group>
        <Sparkles count={30} scale={0.6} size={2.5} speed={reduced ? 0 : 0.5} color="#f5a623" position={[0, -0.75, 0]} />
      </group>
    </group>
  );
}

/** Hazard-striped base platform */
function BasePlatform() {
  const hazardTex = useHazardTexture();
  return (
    <group>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[1.3, 1.4, 0.18, 24]} />
        <meshStandardMaterial map={hazardTex} metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[1.55, 1.55, 0.04, 32]} />
        <meshStandardMaterial color="#0d1117" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function RigModel({ reduced }) {
  return (
    <group position={[0, -1.6, 0]}>
      <BasePlatform />
      <DerrickTower />
      <DrillString reduced={reduced} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported scene                                                     */
/* ------------------------------------------------------------------ */

export default function RigScene({ height = 400 }) {
  const reduced = useReducedMotion();

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      <Canvas dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }} shadows={false}>
        <PerspectiveCamera makeDefault position={[6.5, 3.6, 7]} fov={38} />
        <fog attach="fog" args={['#05070a', 9, 20]} />

        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 8, 4]} intensity={1.1} color="#fff3e0" />
        <directionalLight position={[-6, 3, -4]} intensity={0.5} color="#20bea5" />

        <Suspense fallback={null}>
          <RigModel reduced={reduced} />
          <ContactShadows position={[0, -1.62, 0]} opacity={0.55} scale={10} blur={2.2} far={3} />
          <Environment preset="warehouse" />
        </Suspense>

        <OrbitControls
          autoRotate={!reduced}
          autoRotateSpeed={0.7}
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 2.15}
          minPolarAngle={Math.PI / 3.4}
        />
      </Canvas>
      <Loader
        containerStyles={{ background: 'transparent' }}
        innerStyles={{ background: '#f5a623' }}
        barStyles={{ background: '#161b22' }}
        dataStyles={{ color: '#f5a623', fontFamily: '"IBM Plex Sans", sans-serif', fontSize: '0.7rem' }}
      />
    </div>
  );
}