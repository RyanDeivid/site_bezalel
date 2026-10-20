import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Quality } from '../world/city';
import { onFoot, vehiclePose, type UniverseRuntime } from '../world/runtime';
import { createTraffic, stepTraffic, TRAFFIC_STEP, type TrafficObstacle } from '../world/traffic';
import { CAR_SPECS, type Body, type CarClass } from '../world/vehicles';
import type { CarMaterials, CarModel, CarSlot, FarCarModel } from './carModels';

/** Cores das carrocerias do trânsito (paleta da marca: marfim, aço, marinho e um dourado discreto). */
const PAINT = ['#e6dfd0', '#4d6a8c', '#1a2a44', '#b8995c'];
const TAXI_PAINT = '#efe6d3';
const CLASSES: CarClass[] = ['sedan', 'sport', 'taxi'];
const LODS = ['near', 'far'] as const;

interface Props {
  quality: Quality;
  running: boolean;
  runtime: UniverseRuntime;
  /** Modelo detalhado (perto) e a versão leve, já juntada em 3 malhas (longe), de cada classe. */
  models: Record<CarClass, CarModel>;
  farModels: Record<CarClass, FarCarModel>;
  materials: CarMaterials;
  /** Até que distância da câmera (m) o carro usa o modelo detalhado. */
  lodDistance: number;
  shadows: boolean;
}

type InstSet = { slots: Array<THREE.InstancedMesh | null>; tire: THREE.InstancedMesh | null; rim: THREE.InstancedMesh | null };
const emptySets = () => Object.fromEntries(CLASSES.map((c) => [c, { slots: [], tire: null, rim: null }])) as unknown as Record<CarClass, InstSet>;

/**
 * Trânsito terrestre: a simulação (world/traffic.ts) roda em passo fixo de
 * 1/30 s, separada da taxa de quadros; a cena interpola entre os dois últimos
 * passos. Cada modelo tem dois conjuntos instanciados — o detalhado (peças +
 * rodas girando) e o de longe (3 malhas: pintura, resto e luzes) — e a cada
 * quadro cada carro vai para um deles pela distância à câmera (nível de
 * detalhe, com margem para não ficar trocando na fronteira). Só os de perto
 * projetam sombra. As chamadas de desenho não crescem com a quantidade de carros.
 */
export function Traffic({ quality, running, runtime, models, farModels, materials, lodDistance, shadows }: Props) {
  const state = useMemo(() => createTraffic(quality), [quality]);
  const prev = useMemo(() => state.vehicles.map((v) => ({ x: v.x, z: v.z, heading: v.heading })), [state]);
  const spin = useMemo(() => state.vehicles.map(() => 0), [state]);
  const near = useMemo(() => state.vehicles.map(() => false), [state]);
  const acc = useRef(0);
  const byClass = useMemo(() => {
    const out: Record<CarClass, number[]> = { sedan: [], sport: [], taxi: [] };
    state.vehicles.forEach((v, i) => out[v.cls].push(i));
    return out;
  }, [state]);
  const paints = useMemo(() => state.vehicles.map((v) => new THREE.Color(v.cls === 'taxi' ? TAXI_PAINT : PAINT[v.paint]!)), [state]);

  const obstacles = useMemo<TrafficObstacle[]>(() => [], []);
  // Corpos de colisão do trânsito (3 círculos por carro), reaproveitados a cada quadro: sem lixo para o coletor.
  const pool = useMemo<Body[]>(() => state.vehicles.flatMap(() => [0, 1, 2].map(() => ({ x: 0, z: 0, r: 0 }))), [state]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), w: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0) }), []);
  const sets = useRef<Record<(typeof LODS)[number], Record<CarClass, InstSet>>>({ near: emptySets(), far: emptySets() });

  useLayoutEffect(() => {
    // A cor por instância precisa existir antes do preparo (Warmup): ela muda o shader da pintura,
    // e criá-la só no primeiro quadro recompilaria durante o jogo.
    for (const lod of LODS)
      for (const cls of CLASSES) {
        const s = sets.current[lod][cls];
        const paint = s.slots[0];
        if (paint) for (let k = 0; k < paint.count; k++) paint.setColorAt(k, paints[0]!);
        // Começa vazio: a contagem de cada conjunto é definida a cada quadro.
        for (const m of [...s.slots, s.tire, s.rim]) if (m) m.count = 0;
      }
  }, [state, paints]);
  useEffect(() => () => void (runtime.traffic = []), [runtime]);

  useFrame(({ camera }, rawDt) => {
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
    const cx = camera.position.x;
    const cz = camera.position.z;
    const enter = lodDistance * lodDistance;
    const leave = (lodDistance * 1.12) ** 2;
    for (const cls of CLASSES) {
      const spec = CAR_SPECS[cls];
      const counts = { near: 0, far: 0 };
      for (const vi of byClass[cls]) {
        const v = state.vehicles[vi]!;
        const p = prev[vi]!;
        const dh = Math.atan2(Math.sin(v.heading - p.heading), Math.cos(v.heading - p.heading));
        const x = p.x + (v.x - p.x) * alpha;
        const z = p.z + (v.z - p.z) * alpha;
        const h = p.heading + dh * alpha;
        const d2 = (x - cx) ** 2 + (z - cz) ** 2;
        near[vi] = near[vi] ? d2 < leave : d2 < enter;
        const lod = near[vi] ? 'near' : 'far';
        const set = sets.current[lod][cls];
        const k = counts[lod]++;
        tmp.p.set(x, 0.03, z);
        tmp.q.setFromAxisAngle(tmp.up, h);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        for (const mesh of set.slots) mesh?.setMatrixAt(k, tmp.m);
        set.slots[0]?.setColorAt(k, paints[vi]!);
        // Rodas (só no modelo de perto; de longe elas fazem parte da malha): giram com a velocidade.
        if (running) spin[vi] = spin[vi]! + (v.speed / spec.wheelRadius) * Math.min(rawDt, 0.1);
        if (lod === 'near')
          models[cls].wheels.forEach((wp, wi) => {
            tmp.w.makeRotationX(spin[vi]!).setPosition(wp[0], wp[1], wp[2]);
            tmp.w.premultiply(tmp.m);
            set.tire?.setMatrixAt(k * 4 + wi, tmp.w);
            set.rim?.setMatrixAt(k * 4 + wi, tmp.w);
          });
        // Três círculos ao longo do carro (traseira, meio e frente), para as colisões do jogador.
        const fx = Math.sin(h);
        const fz = Math.cos(h);
        const r = spec.width / 2;
        const off = spec.length / 2 - r;
        for (let c = 0; c < 3; c++) {
          const b = pool[vi * 3 + c]!;
          b.x = x + fx * (c - 1) * off;
          b.z = z + fz * (c - 1) * off;
          b.r = r;
          bodies.push(b);
        }
      }
      for (const lod of LODS) {
        const set = sets.current[lod][cls];
        const n = counts[lod];
        for (const mesh of set.slots) {
          if (!mesh) continue;
          mesh.count = n;
          mesh.instanceMatrix.needsUpdate = true;
        }
        if (set.slots[0]?.instanceColor) set.slots[0].instanceColor.needsUpdate = true;
        for (const mesh of [set.tire, set.rim]) {
          if (!mesh) continue;
          mesh.count = n * 4;
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
  });

  return (
    <group>
      {LODS.map((lod) =>
        CLASSES.map((cls) => {
          const n = byClass[cls].length;
          if (!n) return null;
          if (lod === 'far') {
            const far = farModels[cls];
            const parts: Array<[THREE.BufferGeometry, THREE.Material]> = [
              [far.paint, materials.paint],
              [far.rest, materials.farRest],
              [far.lights, materials.farLights],
            ];
            return (
              <group key={`far-${cls}`}>
                {parts.map(([geo, mat], i) => (
                  <instancedMesh key={i} ref={(m) => void (sets.current.far[cls].slots[i] = m)} args={[geo, mat, n]} frustumCulled={false} />
                ))}
              </group>
            );
          }
          const model = models[cls];
          const slots = [...model.slots.entries()].sort(([a], [b]) => (a === 'paint' ? -1 : b === 'paint' ? 1 : 0));
          return (
            <group key={`near-${cls}`}>
              {slots.map(([slot, geo], i) => (
                <instancedMesh
                  key={slot}
                  ref={(m) => void (sets.current.near[cls].slots[i] = m)}
                  args={[geo, materials[slot as CarSlot], n]}
                  castShadow={shadows && (slot === 'paint' || slot === 'glass')}
                  frustumCulled={false}
                />
              ))}
              <instancedMesh ref={(m) => void (sets.current.near[cls].tire = m)} args={[model.tire, materials.tire, n * 4]} frustumCulled={false} />
              <instancedMesh ref={(m) => void (sets.current.near[cls].rim = m)} args={[model.rim, materials.rim, n * 4]} frustumCulled={false} />
            </group>
          );
        }),
      )}
    </group>
  );
}
