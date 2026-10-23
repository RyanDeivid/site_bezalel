import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GROUND } from '../world/city';
import type { Quality, UniverseAssets } from './assets';
import { signTexture } from './textures';

/** Vagas de cada estacionamento (centros em x; os carros do parque de chegada ficam nelas). */
const STALL = 2.75;
const LOTS = [
  [-16.5, -13.75, -11, -8.25],
  [8.25, 11, 13.75, 16.5],
] as const;
/** Fundo e frente das vagas (os carros estacionam de frente para a praça, ao norte). */
const Z0 = 83.3;
const Z1 = 88.9;
/** Baia do ponto de táxi (onde fica o táxi do parque) e o abrigo ao lado. */
const TAXI = { x: -21, shelterX: -26 };

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

function merge(list: THREE.BufferGeometry[]) {
  const g = mergeGeometries(list)!;
  list.forEach((x) => x.dispose());
  return g;
}

/**
 * Parque de chegada: dois estacionamentos de asfalto com as vagas pintadas e
 * batentes de concreto, a baia do ponto de táxi (contorno dourado e "TAXI" no
 * chão) e um abrigo de embarque com cobertura de vidro, banco e a placa acesa.
 * Tudo estático, numa malha por material.
 */
export function ArrivalPark({ assets, quality }: { assets: UniverseAssets; quality: Quality }) {
  const m = assets.materials;
  const hi = quality !== 'low';
  const top = GROUND.block + 0.015;
  const geos = useMemo(() => {
    const lot: THREE.BufferGeometry[] = [];
    const paint: THREE.BufferGeometry[] = [];
    const gold: THREE.BufferGeometry[] = [];
    const stops: THREE.BufferGeometry[] = [];
    const steel: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    for (const xs of LOTS) {
      const minX = xs[0] - STALL / 2;
      const maxX = xs[xs.length - 1]! + STALL / 2;
      lot.push(box(maxX - minX + 1, 0.03, Z1 - Z0 + 1.6, (minX + maxX) / 2, top - 0.015, (Z0 + Z1) / 2));
      for (let k = 0; k <= xs.length; k++) paint.push(box(0.12, 0.012, Z1 - Z0, minX + k * STALL, top + 0.006, (Z0 + Z1) / 2));
      paint.push(box(maxX - minX, 0.012, 0.12, (minX + maxX) / 2, top + 0.006, Z0));
      for (const x of xs) stops.push(box(1.6, 0.14, 0.22, x, top + 0.07, Z0 + 0.55));
    }
    // Baia do táxi: contorno dourado.
    const bw = 2.9;
    for (const s of [-1, 1]) gold.push(box(0.14, 0.012, Z1 - Z0, TAXI.x + (s * bw) / 2, top + 0.006, (Z0 + Z1) / 2));
    gold.push(box(bw, 0.012, 0.14, TAXI.x, top + 0.006, Z0), box(bw, 0.012, 0.14, TAXI.x, top + 0.006, Z1));
    lot.push(box(bw + 1, 0.03, Z1 - Z0 + 1.6, TAXI.x, top - 0.015, (Z0 + Z1) / 2));
    // Abrigo de embarque: dois pilares, cobertura de vidro com beiral de aço, painel de fundo e banco.
    const sx = TAXI.shelterX;
    for (const z of [84.2, 87.8]) steel.push(box(0.12, 2.5, 0.12, sx - 0.8, GROUND.block + 1.25, z));
    steel.push(box(2.5, 0.12, 4.4, sx, GROUND.block + 2.56, 86));
    glass.push(box(2.3, 0.04, 4.2, sx, GROUND.block + 2.64, 86), box(0.04, 2.1, 3.4, sx - 0.86, GROUND.block + 1.25, 86));
    steel.push(box(0.5, 0.06, 2.6, sx - 0.5, GROUND.block + 0.48, 86), box(0.08, 0.45, 2.4, sx - 0.5, GROUND.block + 0.24, 86));
    // Mastro da placa.
    steel.push(box(0.12, 3.1, 0.12, TAXI.x - 2, GROUND.block + 1.55, Z1 + 0.6), box(1.5, 0.56, 0.2, TAXI.x - 2, GROUND.block + 3.25, Z1 + 0.6));
    return { lot: merge(lot), paint: merge(paint), gold: merge(gold), stops: merge(stops), steel: merge(steel), glass: merge(glass) };
  }, [top]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const sign = useMemo(() => signTexture('TAXI', hi ? 512 : 256, hi ? 160 : 80), [hi]);
  const ground = useMemo(() => signTexture('TAXI', hi ? 512 : 256, hi ? 160 : 80, '#d8c08a'), [hi]);
  useEffect(
    () => () => {
      sign.dispose();
      ground.dispose();
    },
    [sign, ground],
  );
  return (
    <group>
      <mesh geometry={geos.lot} material={m.lot} receiveShadow renderOrder={1} />
      <mesh geometry={geos.paint} material={m.paint} renderOrder={1} />
      <mesh geometry={geos.gold} material={m.paintGold} renderOrder={1} />
      <mesh geometry={geos.stops} material={m.stoneLight} castShadow />
      <mesh geometry={geos.steel} material={m.steel} castShadow />
      <mesh geometry={geos.glass} material={m.glass} />
      {/* "TAXI" pintado no chão da baia e a placa acesa (dois lados) no mastro. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[TAXI.x, top + 0.014, Z1 - 1.1]} renderOrder={2}>
        <planeGeometry args={[2.5, 0.78]} />
        <meshBasicMaterial map={ground} transparent depthWrite={false} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[TAXI.x - 2, GROUND.block + 3.25, Z1 + 0.6 + s * 0.105]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[1.4, 0.44]} />
          <meshBasicMaterial map={sign} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
