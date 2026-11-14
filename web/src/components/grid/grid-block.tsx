"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
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

function Surface({ grid, scale, tone }: { grid: Grid; scale: number; tone: Tone }) {
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
      <mesh geometry={surface}>
        <meshStandardMaterial color={TONE[tone]} roughness={1} />
      </mesh>
      <mesh geometry={walls}>
        <meshStandardMaterial color="#3b3530" roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// another surface drawn as lines over the block
function Wire({ grid, scale }: { grid: Grid; scale: number }) {
  const geo = useMemo(() => surfaceGeometry(grid, 32, scale), [grid, scale]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={[0, 0.004, 0]}>
      <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.8} />
    </mesh>
  );
}

export type GridBlockProps = {
  grid: Grid;
  // vertical exaggeration
  relief?: number;
  tone: Tone;
  // a second surface over this one, with its own height scale
  wire?: { grid: Grid; scale: number };
  label: string;
};

// a 4 km block from a height grid: displaced mesh, walls, fixed light from the north-west, orbit camera
export default function GridBlock({ grid, relief = 1, tone, wire, label }: GridBlockProps) {
  const top = ((grid.hi - grid.lo) * relief) / 1000;
  return (
    <Canvas frameloop="demand" dpr={[1, 2]} camera={{ position: [-3.4, 4.4, 7.4], fov: 35 }} role="img" aria-label={label}>
      <ambientLight intensity={0.45} />
      <directionalLight position={[-5, 4, -5]} intensity={2.4} />
      <Surface grid={grid} scale={relief} tone={tone} />
      {wire && <Wire grid={wire.grid} scale={wire.scale} />}
      <OrbitControls makeDefault enablePan={false} target={[0, top / 2, 0]} minDistance={3} maxDistance={16} maxPolarAngle={Math.PI * 0.49} />
    </Canvas>
  );
}
