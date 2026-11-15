"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Grid } from "@/lib/grid";
import { BLOCK_KM, meshHeights } from "@/lib/grid-mesh";

const TONE = { earth: "#a3927c", moon: "#9b9a9e", mars: "#b0714f" } as const;
export type Tone = keyof typeof TONE;

// a grid laid over the block as a displaced plane
function surfaceGeometry(g: Grid, segs: number, scale: number) {
  const geo = new THREE.PlaneGeometry(BLOCK_KM, BLOCK_KM, segs, segs);
  // the plane's top row becomes -z, which is north
  geo.rotateX(-Math.PI / 2);
  const h = meshHeights(g, segs, scale);
  const pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setY(k, h[k]);
  geo.computeVertexNormals();
  return geo;
}

// side walls from the surface edge down to a flat base
function wallGeometry(surface: THREE.BufferGeometry, segs: number, base: number) {
  const pos = surface.attributes.position;
  const n = segs + 1;
  const edge: number[] = [];
  for (let c = 0; c < n; c++) edge.push(c);
  for (let r = 1; r < n; r++) edge.push(r * n + segs);
  for (let c = segs - 1; c >= 0; c--) edge.push(segs * n + c);
  for (let r = segs - 1; r >= 0; r--) edge.push(r * n);
  const verts: number[] = [];
  for (let k = 0; k + 1 < edge.length; k++) {
    const [a, b] = [edge[k], edge[k + 1]];
    const [ax, ay, az, bx, by, bz] = [pos.getX(a), pos.getY(a), pos.getZ(a), pos.getX(b), pos.getY(b), pos.getZ(b)];
    verts.push(ax, ay, az, ax, base, az, bx, by, bz, bx, by, bz, ax, base, az, bx, base, bz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function Surface({ grid, scale, tone, grey }: { grid: Grid; scale: number; tone: Tone; grey: boolean }) {
  const segs = grid.n - 1;
  const [surface, walls] = useMemo(() => {
    const s = surfaceGeometry(grid, segs, scale);
    const top = ((grid.hi - grid.lo) * scale) / 1000;
    return [s, wallGeometry(s, segs, -Math.max(0.35, top * 0.35))];
  }, [grid, segs, scale]);
  useEffect(
    () => () => {
      surface.dispose();
      walls.dispose();
    },
    [surface, walls],
  );
  return (
    <>
      <mesh geometry={surface} castShadow receiveShadow>
        <meshStandardMaterial color={grey ? "#b4b4b4" : TONE[tone]} roughness={1} />
      </mesh>
      <mesh geometry={walls}>
        <meshStandardMaterial color="#3b3530" roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// another surface drawn as lines over the block
function Wire({ grid, scale }: { grid: Grid; scale: number }) {
  const geo = useMemo(() => {
    const g = surfaceGeometry(grid, 32, scale);
    // lines colored by height, low blue to high yellow, so altitude reads at a glance
    const pos = g.attributes.position;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < pos.count; k++) {
      lo = Math.min(lo, pos.getY(k));
      hi = Math.max(hi, pos.getY(k));
    }
    const c = new THREE.Color(), cols = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      const t = hi > lo ? (pos.getY(k) - lo) / (hi - lo) : 0.5;
      c.setHSL(0.6 - t * 0.45, 1, 0.6 + t * 0.1).toArray(cols, k * 3);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }, [grid, scale]);
  useEffect(() => () => geo.dispose(), [geo]);
  // drawn over the block, unlit and untonemapped, so the ground never hides or dulls it
  return (
    <mesh geometry={geo} position={[0, 0.004, 0]} renderOrder={1}>
      <meshBasicMaterial vertexColors wireframe depthTest={false} toneMapped={false} />
    </mesh>
  );
}

// one camera position shared by several blocks, so rotating one rotates all
export type CameraLink = { pos: THREE.Vector3 | null; subs: Set<() => void> };
export const cameraLink = (): CameraLink => ({ pos: null, subs: new Set() });

type Controls = { update: () => void; addEventListener: (t: "change", f: () => void) => void; removeEventListener: (t: "change", f: () => void) => void };

function joinLink(link: CameraLink, camera: THREE.Camera, controls: Controls, invalidate: () => void) {
  let applying = false;
  const pull = () => {
    if (!link.pos) return;
    // the update below fires a change, which must not be sent back out
    applying = true;
    camera.position.copy(link.pos);
    controls.update();
    applying = false;
    invalidate();
  };
  const push = () => {
    if (applying) return;
    link.pos = camera.position.clone();
    link.subs.forEach((f) => f !== pull && f());
  };
  link.subs.add(pull);
  controls.addEventListener("change", push);
  pull();
  return () => {
    link.subs.delete(pull);
    controls.removeEventListener("change", push);
  };
}

function LinkedCamera({ link }: { link: CameraLink }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as Controls | null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (controls) return joinLink(link, camera, controls, invalidate);
  }, [link, camera, controls, invalidate]);
  return null;
}

export type GridBlockProps = {
  grid: Grid;
  // vertical exaggeration
  relief?: number;
  tone: Tone;
  // a second surface over this one, with its own height scale
  wire?: { grid: Grid; scale: number };
  label: string;
  // share the camera with the other blocks on the page
  link?: CameraLink;
  // moon light: grey ground lit from this many degrees above the horizon, with cast shadows
  moonSun?: number | null;
};

// a 4 km block from a height grid: displaced mesh, walls, fixed light from the north-west, orbit camera
export default function GridBlock({ grid, relief = 1, tone, wire, label, link, moonSun = null }: GridBlockProps) {
  const top = ((grid.hi - grid.lo) * relief) / 1000;
  return (
    <Canvas shadows frameloop="demand" dpr={[1, 2]} camera={{ position: [-3.4, 4.4, 7.4], fov: 35 }} role="img" aria-label={label}>
      {moonSun === null ? (
        <>
          <ambientLight intensity={0.45} />
          <directionalLight position={[-5, 4, -5]} intensity={2.4} />
        </>
      ) : (
        <>
          <ambientLight intensity={0.18} />
          {/* from the north-west like the normal light, the shadow box covers the whole block */}
          <directionalLight
            castShadow
            position={[-8.5 * Math.cos((moonSun * Math.PI) / 180), 12 * Math.sin((moonSun * Math.PI) / 180) + top / 2, -8.5 * Math.cos((moonSun * Math.PI) / 180)]}
            intensity={3.2}
            shadow-mapSize={[2048, 2048]}
            shadow-normalBias={0.03}
          >
            <orthographicCamera attach="shadow-camera" args={[-3.2, 3.2, 3.2, -3.2, 0.1, 30]} />
          </directionalLight>
        </>
      )}
      <Surface grid={grid} scale={relief} tone={tone} grey={moonSun !== null} />
      {wire && <Wire grid={wire.grid} scale={wire.scale} />}
      {/* linked blocks orbit one shared point, or the same camera would frame each differently */}
      <OrbitControls makeDefault enablePan={false} target={[0, link ? 0.2 : top / 2, 0]} minDistance={3} maxDistance={16} maxPolarAngle={Math.PI * 0.49} />
      {link && <LinkedCamera link={link} />}
    </Canvas>
  );
}
