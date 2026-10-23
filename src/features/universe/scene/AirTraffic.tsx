import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { airDebug, airPose, createAirTraffic, type AirClass } from '../world/air';
import type { Quality } from '../world/city';
import { AIR_CLASSES, AIR_PAINT, buildFarAirModels, buildNearAirModels, disposeFarAirModels, type NearAirSlot } from './airModels';
import type { CarMaterials } from './carModels';
import { shareMatrices } from './sharedInstances';

/**
 * Trânsito aéreo: cada veículo está, a cada instante, onde a rota diz
 * (`airPose`, sem estado acumulado — determinístico e barato). Inclina nas
 * curvas, flutua de leve e as luzes de navegação piscam. Dois conjuntos
 * instanciados por classe: o detalhado (uma InstancedMesh por material) para os
 * que estão a menos de `lodDistance` da câmera, e o de longe (3 malhas, um
 * terço das divisões) para os demais — quase sempre a maioria, lá no alto.
 */
export function AirTraffic({ quality, running, materials, lodDistance, shadows = false }: { quality: Quality; running: boolean; materials: CarMaterials; lodDistance: number; /** Projetam sombra no mapa (só com as sombras dinâmicas). */ shadows?: boolean }) {
  const traffic = useMemo(() => createAirTraffic(quality), [quality]);
  const models = useMemo(() => buildNearAirModels(), []);
  const farModels = useMemo(() => buildFarAirModels(), []);
  useEffect(() => () => Object.values(models).forEach((m) => m.forEach((g) => g.dispose())), [models]);
  useEffect(() => () => disposeFarAirModels(farModels), [farModels]);
  const near = useMemo(() => traffic.vehicles.map(() => false), [traffic]);

  // Materiais próprios: casco por classe, rotor translúcido e as luzes de navegação (que piscam).
  const mats = useMemo(() => {
    const hull = Object.fromEntries(
      AIR_CLASSES.map((c) => [c, new THREE.MeshStandardMaterial({ color: AIR_PAINT[c], metalness: 0.6, roughness: 0.3, envMapIntensity: 1.1 })]),
    ) as Record<AirClass, THREE.MeshStandardMaterial>;
    return {
      hull,
      rotor: new THREE.MeshBasicMaterial({ color: '#a9b1bd', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
      // Vermelha e verde numa malha só (a cor vem do vértice), acima de 1 para acender com o brilho.
      nav: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2) }),
      navWhite: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false }),
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(mats.hull).forEach((m) => m.dispose());
      [mats.rotor, mats.nav, mats.navWhite].forEach((m) => m.dispose());
    },
    [mats],
  );
  const material = (cls: AirClass, slot: NearAirSlot): THREE.Material => {
    switch (slot) {
      case 'hull':
        return mats.hull[cls];
      case 'glass':
        return materials.glass;
      case 'rotor':
        return mats.rotor;
      case 'rest':
        return materials.farRest;
      case 'lights':
        return materials.farLights;
      case 'nav':
        return mats.nav;
      case 'navWhite':
        return mats.navWhite;
    }
  };

  const byClass = useMemo(() => {
    const out: Record<AirClass, number[]> = { taxi: [], private: [], cargo: [], drone: [] };
    traffic.vehicles.forEach((v, i) => out[traffic.routes[v.route]!.spec.cls].push(i));
    return out;
  }, [traffic]);
  const meshes = useRef<Record<AirClass, Array<THREE.InstancedMesh | null>>>({ taxi: [], private: [], cargo: [], drone: [] });
  const farMeshes = useRef<Record<AirClass, Array<THREE.InstancedMesh | null>>>({ taxi: [], private: [], cargo: [], drone: [] });
  const clock = useRef(0);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), e: new THREE.Euler(0, 0, 0, 'YXZ'), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }), []);

  useEffect(() => {
    airDebug.traffic = traffic;
    return () => {
      airDebug.traffic = null;
    };
  }, [traffic]);

  useFrame(({ camera }, dt) => {
    if (running && !airDebug.frozen) clock.current += Math.min(dt, 0.1);
    const t = (airDebug.t = clock.current);
    // Luzes de navegação piscam em ciclo (a branca, de leve).
    mats.nav.visible = (t * 1.2) % 1 < 0.75;
    mats.navWhite.visible = (t * 0.8) % 1 < 0.2;
    const enter = lodDistance * lodDistance;
    const leave = (lodDistance * 1.12) ** 2;
    const c = camera.position;
    AIR_CLASSES.forEach((cls) => {
      let nNear = 0;
      let nFar = 0;
      // As peças de cada modelo compartilham um buffer de matrizes (ver `shareMatrices`).
      const leadNear = shareMatrices(meshes.current[cls]);
      const leadFar = shareMatrices(farMeshes.current[cls]);
      byClass[cls].forEach((vi) => {
        const pose = airPose(traffic, traffic.vehicles[vi]!, t);
        const d2 = (pose.x - c.x) ** 2 + (pose.y - c.y) ** 2 + (pose.z - c.z) ** 2;
        near[vi] = near[vi] ? d2 < leave : d2 < enter;
        tmp.e.set(0, pose.heading, pose.bank);
        tmp.q.setFromEuler(tmp.e);
        tmp.m.compose(tmp.p.set(pose.x, pose.y, pose.z), tmp.q, tmp.s);
        if (near[vi]) {
          const k = nNear++;
          leadNear?.setMatrixAt(k, tmp.m);
        } else {
          const k = nFar++;
          leadFar?.setMatrixAt(k, tmp.m);
        }
      });
      for (const [list, n] of [
        [meshes.current[cls], nNear],
        [farMeshes.current[cls], nFar],
      ] as const)
        for (const mesh of list) {
          if (!mesh) continue;
          mesh.count = n;
          // Vazio, não desenha (a chamada com zero instâncias ainda custa CPU).
          mesh.visible = n > 0;
          if (n) mesh.instanceMatrix.needsUpdate = true;
        }
    });
  });

  return (
    <group>
      {AIR_CLASSES.map((cls) => {
        const n = byClass[cls].length;
        if (!n) return null;
        const far = farModels[cls];
        return [
          ...[...models[cls].entries()].map(([slot, geo], i) => (
            <instancedMesh key={`${cls}-${slot}`} ref={(m) => void (meshes.current[cls][i] = m)} args={[geo, material(cls, slot), n]} count={0} frustumCulled={false} castShadow={shadows && slot === 'hull'} />
          )),
          ...(
            [
              [far.hull, mats.hull[cls]],
              [far.rest, materials.farRest],
              [far.lights, materials.farLights],
            ] as const
          ).map(([geo, mat], i) => <instancedMesh key={`${cls}-far-${i}`} ref={(m) => void (farMeshes.current[cls][i] = m)} args={[geo, mat, n]} count={0} frustumCulled={false} />),
        ];
      })}
    </group>
  );
}
