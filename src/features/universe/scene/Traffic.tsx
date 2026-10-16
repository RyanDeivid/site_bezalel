import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createTraffic, stepTraffic, TRAFFIC_STEP } from '../world/traffic';
import type { Quality, UniverseAssets } from './assets';

/** Cores das carrocerias (paleta da marca: marfim, aço, marinho e um dourado discreto). */
const PAINT = ['#e6dfd0', '#4d6a8c', '#1a2a44', '#b8995c'];

/**
 * Trânsito terrestre: a simulação (world/traffic.ts) roda em passo fixo de
 * 1/30 s, separada da taxa de quadros; a cena interpola entre os dois últimos
 * passos. Quatro InstancedMesh desenham todos os veículos (4 chamadas de
 * desenho, qualquer que seja a quantidade). Pausado = carros parados no lugar.
 */
export function Traffic({ assets, quality, running }: { assets: UniverseAssets; quality: Quality; running: boolean }) {
  const state = useMemo(() => createTraffic(quality), [quality]);
  const n = state.vehicles.length;
  const prev = useMemo(() => state.vehicles.map((v) => ({ x: v.x, z: v.z, heading: v.heading })), [state]);
  const acc = useRef(0);
  const body = useRef<THREE.InstancedMesh>(null);
  const cabin = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const tail = useRef<THREE.InstancedMesh>(null);

  const geos = useMemo(() => {
    const b = new THREE.BoxGeometry(1.9, 0.62, 4.1);
    b.translate(0, 0.58, 0);
    const c = new THREE.BoxGeometry(1.6, 0.5, 2.1);
    c.translate(0, 1.12, -0.25);
    const h = new THREE.BoxGeometry(1.6, 0.08, 0.05);
    h.translate(0, 0.72, 2.06);
    const t = new THREE.BoxGeometry(1.7, 0.08, 0.05);
    t.translate(0, 0.74, -2.06);
    return { b, c, h, t };
  }, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  // Cor por instância (pintura determinística por veículo).
  useEffect(() => {
    const color = new THREE.Color();
    state.vehicles.forEach((v, i) => body.current?.setColorAt(i, color.set(PAINT[v.paint]!)));
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true;
  }, [state]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0) }), []);

  useFrame((_, rawDt) => {
    if (running) {
      acc.current += Math.min(rawDt, 0.1);
      // No máximo alguns passos por quadro (aba que volta do segundo plano não "acelera" o trânsito).
      let steps = 0;
      while (acc.current >= TRAFFIC_STEP && steps < 4) {
        state.vehicles.forEach((v, i) => {
          const p = prev[i]!;
          p.x = v.x;
          p.z = v.z;
          p.heading = v.heading;
        });
        stepTraffic(state);
        acc.current -= TRAFFIC_STEP;
        steps++;
      }
      if (steps === 4) acc.current = 0;
    }
    const alpha = running ? acc.current / TRAFFIC_STEP : 1;
    const meshes = [body.current, cabin.current, head.current, tail.current];
    state.vehicles.forEach((v, i) => {
      const p = prev[i]!;
      const dh = Math.atan2(Math.sin(v.heading - p.heading), Math.cos(v.heading - p.heading));
      tmp.p.set(p.x + (v.x - p.x) * alpha, 0.3, p.z + (v.z - p.z) * alpha);
      tmp.q.setFromAxisAngle(tmp.up, p.heading + dh * alpha);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      for (const mesh of meshes) mesh?.setMatrixAt(i, tmp.m);
    });
    for (const mesh of meshes) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  });

  const m = assets.materials;
  const hi = quality === 'high';
  return (
    <group>
      <instancedMesh ref={body} args={[geos.b, m.pearl, n]} castShadow={hi} frustumCulled={false} />
      <instancedMesh ref={cabin} args={[geos.c, m.darkGlass, n]} frustumCulled={false} />
      <instancedMesh ref={head} args={[geos.h, m.glowIvory, n]} frustumCulled={false} />
      <instancedMesh ref={tail} args={[geos.t, m.glowBrake, n]} frustumCulled={false} />
    </group>
  );
}
