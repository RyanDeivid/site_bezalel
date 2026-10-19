import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { airPose, createAirTraffic, type AirClass } from '../world/air';
import type { Quality } from '../world/city';
import { AIR_CLASSES, AIR_PAINT, buildAirModels, disposeAirModels, type AirSlot } from './airModels';
import type { CarMaterials } from './carModels';

/**
 * Trânsito aéreo: cada veículo está, a cada instante, onde a rota diz
 * (`airPose`, sem estado acumulado — determinístico e barato). Inclina nas
 * curvas, flutua de leve e as luzes de navegação piscam. Uma InstancedMesh por
 * (classe × material).
 */
export function AirTraffic({ quality, running, materials }: { quality: Quality; running: boolean; materials: CarMaterials }) {
  const traffic = useMemo(() => createAirTraffic(quality), [quality]);
  const models = useMemo(() => buildAirModels(), []);
  useEffect(() => () => disposeAirModels(models), [models]);

  // Materiais próprios: casco por classe, rotor translúcido, brilhos.
  const mats = useMemo(() => {
    const hull = Object.fromEntries(
      AIR_CLASSES.map((c) => [c, new THREE.MeshStandardMaterial({ color: AIR_PAINT[c], metalness: 0.6, roughness: 0.3, envMapIntensity: 1.1 })]),
    ) as Record<AirClass, THREE.MeshStandardMaterial>;
    return {
      hull,
      rotor: new THREE.MeshBasicMaterial({ color: '#a9b1bd', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
      thrust: new THREE.MeshBasicMaterial({ color: '#7fa6f5', toneMapped: false, side: THREE.DoubleSide }),
      navRed: new THREE.MeshBasicMaterial({ color: '#ff4a3d', toneMapped: false }),
      navGreen: new THREE.MeshBasicMaterial({ color: '#3dff8a', toneMapped: false }),
      navWhite: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(mats.hull).forEach((m) => m.dispose());
      [mats.rotor, mats.thrust, mats.navRed, mats.navGreen, mats.navWhite].forEach((m) => m.dispose());
    },
    [mats],
  );
  const material = (cls: AirClass, slot: AirSlot): THREE.Material => {
    switch (slot) {
      case 'hull':
        return mats.hull[cls];
      case 'glass':
        return materials.glass;
      case 'frame':
        return materials.trim;
      case 'gold':
        return materials.gold;
      case 'sign':
        return materials.sign;
      default:
        return mats[slot];
    }
  };

  const byClass = useMemo(() => {
    const out: Record<AirClass, number[]> = { taxi: [], private: [], cargo: [], drone: [] };
    traffic.vehicles.forEach((v, i) => out[traffic.routes[v.route]!.spec.cls].push(i));
    return out;
  }, [traffic]);
  const meshes = useRef<Record<AirClass, Array<THREE.InstancedMesh | null>>>({ taxi: [], private: [], cargo: [], drone: [] });
  const clock = useRef(0);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), e: new THREE.Euler(0, 0, 0, 'YXZ'), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }), []);

  useFrame((_, dt) => {
    if (running) clock.current += Math.min(dt, 0.1);
    const t = clock.current;
    // Luzes de navegação piscam em ciclo (a branca, de leve).
    mats.navRed.visible = mats.navGreen.visible = (t * 1.2) % 1 < 0.75;
    mats.navWhite.visible = (t * 0.8) % 1 < 0.2;
    AIR_CLASSES.forEach((cls) => {
      byClass[cls].forEach((vi, k) => {
        const pose = airPose(traffic, traffic.vehicles[vi]!, t);
        tmp.e.set(0, pose.heading, pose.bank);
        tmp.q.setFromEuler(tmp.e);
        tmp.m.compose(tmp.p.set(pose.x, pose.y, pose.z), tmp.q, tmp.s);
        meshes.current[cls].forEach((mesh) => mesh?.setMatrixAt(k, tmp.m));
      });
      meshes.current[cls].forEach((mesh) => mesh && (mesh.instanceMatrix.needsUpdate = true));
    });
  });

  return (
    <group>
      {AIR_CLASSES.map((cls) => {
        const n = byClass[cls].length;
        if (!n) return null;
        return [...models[cls].slots.entries()].map(([slot, geo], i) => (
          <instancedMesh key={`${cls}-${slot}`} ref={(m) => void (meshes.current[cls][i] = m)} args={[geo, material(cls, slot), n]} frustumCulled={false} castShadow={quality === 'high' && slot === 'hull'} />
        ));
      })}
    </group>
  );
}
