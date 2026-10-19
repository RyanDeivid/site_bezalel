import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Quality } from '../world/city';
import { onFoot, vehiclePose, type UniverseRuntime } from '../world/runtime';
import { createTraffic, stepTraffic, TRAFFIC_STEP, type TrafficObstacle } from '../world/traffic';
import { CAR_SPECS, carCircles, type CarClass } from '../world/vehicles';
import type { CarMaterials, CarModel, CarSlot } from './carModels';

/** Cores das carrocerias do trânsito (paleta da marca: marfim, aço, marinho e um dourado discreto). */
const PAINT = ['#e6dfd0', '#4d6a8c', '#1a2a44', '#b8995c'];
const TAXI_PAINT = '#efe6d3';

interface Props {
  quality: Quality;
  running: boolean;
  runtime: UniverseRuntime;
  models: Record<CarClass, CarModel>;
  materials: CarMaterials;
}

/**
 * Trânsito terrestre: a simulação (world/traffic.ts) roda em passo fixo de
 * 1/30 s, separada da taxa de quadros; a cena interpola entre os dois últimos
 * passos. Cada modelo é desenhado com uma InstancedMesh por material, mais
 * pneus e aros instanciados (4 por carro) — cerca de 25 chamadas de desenho
 * para todo o trânsito, qualquer que seja a quantidade.
 */
export function Traffic({ quality, running, runtime, models, materials }: Props) {
  const state = useMemo(() => createTraffic(quality), [quality]);
  const prev = useMemo(() => state.vehicles.map((v) => ({ x: v.x, z: v.z, heading: v.heading })), [state]);
  const spin = useMemo(() => state.vehicles.map(() => 0), [state]);
  const acc = useRef(0);
  const byClass = useMemo(() => {
    const out: Record<CarClass, number[]> = { sedan: [], sport: [], taxi: [] };
    state.vehicles.forEach((v, i) => out[v.cls].push(i));
    return out;
  }, [state]);

  const obstacles = useMemo<TrafficObstacle[]>(() => [], []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), w: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0), x: new THREE.Vector3(1, 0, 0) }), []);
  const groups = useRef<Record<CarClass, { slots: Array<THREE.InstancedMesh | null>; tire: THREE.InstancedMesh | null; rim: THREE.InstancedMesh | null }>>({
    sedan: { slots: [], tire: null, rim: null },
    sport: { slots: [], tire: null, rim: null },
    taxi: { slots: [], tire: null, rim: null },
  });

  // Pintura por veículo (táxis sempre na cor da frota).
  useLayoutEffect(() => {
    const color = new THREE.Color();
    (['sedan', 'sport', 'taxi'] as CarClass[]).forEach((cls) => {
      const paintMesh = groups.current[cls].slots[0];
      byClass[cls].forEach((vi, k) => paintMesh?.setColorAt(k, color.set(cls === 'taxi' ? TAXI_PAINT : PAINT[state.vehicles[vi]!.paint]!)));
      if (paintMesh?.instanceColor) paintMesh.instanceColor.needsUpdate = true;
    });
  }, [byClass, state]);

  useEffect(() => () => void (runtime.traffic = []), [runtime]);

  useFrame((_, rawDt) => {
    // O jogador (a pé ou no carro) é um obstáculo que o trânsito respeita.
    obstacles.length = 0;
    if (onFoot(runtime)) obstacles.push({ x: runtime.walker.x, z: runtime.walker.z });
    for (const v of runtime.vehicles) {
      if (v.kind === 'hover' && v.craft.y > 4) continue;
      const p = vehiclePose(v);
      obstacles.push({ x: p.x, z: p.z });
    }
    if (running) {
      acc.current += Math.min(rawDt, 0.1);
      let steps = 0;
      while (acc.current >= TRAFFIC_STEP && steps < 4) {
        state.vehicles.forEach((v, i) => {
          const p = prev[i]!;
          p.x = v.x;
          p.z = v.z;
          p.heading = v.heading;
        });
        stepTraffic(state, obstacles);
        acc.current -= TRAFFIC_STEP;
        steps++;
      }
      if (steps === 4) acc.current = 0;
    }
    const alpha = running ? acc.current / TRAFFIC_STEP : 1;
    const bodies = runtime.traffic;
    bodies.length = 0;
    (['sedan', 'sport', 'taxi'] as CarClass[]).forEach((cls) => {
      const g = groups.current[cls];
      const model = models[cls];
      byClass[cls].forEach((vi, k) => {
        const v = state.vehicles[vi]!;
        const p = prev[vi]!;
        const dh = Math.atan2(Math.sin(v.heading - p.heading), Math.cos(v.heading - p.heading));
        const x = p.x + (v.x - p.x) * alpha;
        const z = p.z + (v.z - p.z) * alpha;
        const h = p.heading + dh * alpha;
        tmp.p.set(x, 0.03, z);
        tmp.q.setFromAxisAngle(tmp.up, h);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        for (const mesh of g.slots) mesh?.setMatrixAt(k, tmp.m);
        // Rodas: giram com a velocidade de cada carro.
        if (running) spin[vi] = spin[vi]! + (v.speed / CAR_SPECS[cls].wheelRadius) * Math.min(rawDt, 0.1);
        model.wheels.forEach((wp, wi) => {
          tmp.w.makeRotationX(spin[vi]!).setPosition(wp[0], wp[1], wp[2]);
          tmp.w.premultiply(tmp.m);
          g.tire?.setMatrixAt(k * 4 + wi, tmp.w);
          g.rim?.setMatrixAt(k * 4 + wi, tmp.w);
        });
        bodies.push(...carCircles({ x, z, heading: h }, CAR_SPECS[cls]));
      });
      for (const mesh of [...g.slots, g.tire, g.rim]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
    });
  });

  const shadows = quality === 'high';
  return (
    <group>
      {(['sedan', 'sport', 'taxi'] as CarClass[]).map((cls) => {
        const n = byClass[cls].length;
        if (!n) return null;
        const model = models[cls];
        const slots = [...model.slots.entries()].sort(([a], [b]) => (a === 'paint' ? -1 : b === 'paint' ? 1 : 0));
        return (
          <group key={cls}>
            {slots.map(([slot, geo], i) => (
              <instancedMesh
                key={slot}
                ref={(m) => void (groups.current[cls].slots[i] = m)}
                args={[geo, materials[slot as CarSlot], n]}
                castShadow={shadows && (slot === 'paint' || slot === 'glass')}
                frustumCulled={false}
              />
            ))}
            <instancedMesh ref={(m) => void (groups.current[cls].tire = m)} args={[model.tire, materials.tire, n * 4]} frustumCulled={false} />
            <instancedMesh ref={(m) => void (groups.current[cls].rim = m)} args={[model.rim, materials.rim, n * 4]} frustumCulled={false} />
          </group>
        );
      })}
    </group>
  );
}
