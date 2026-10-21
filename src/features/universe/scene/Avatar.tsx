import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { Humanoid, HumanoidFleet, restPose } from '@/features/lab/scene/robots/humanoid';
import { PALETTE } from './textures';
import { vehicleById, vehiclePose, type UniverseRuntime } from '../world/runtime';
import { CAR_SPECS, rightOf } from '../world/vehicles';
import { walkerSpeed, WALK_SPEED } from '../world/walker';
import { contactShadowGeometry, contactShadowMaterial } from './contactShadow';

/**
 * O visitante a pé: o mesmo robô humanoide articulado do laboratório (pernas,
 * braços e mãos animados pela passada real), com detalhes dourados — um
 * "explorador Bezalel". Ao entrar num veículo, caminha até a porta e encolhe
 * para dentro dele; ao sair, faz o caminho inverso (sem teletransporte seco).
 */
export function Avatar({ runtime, effects }: { runtime: UniverseRuntime; effects: boolean }) {
  const { robot, fleet, pose } = useMemo(() => {
    const robot = new Humanoid(PALETTE.gold);
    return { robot, fleet: new HumanoidFleet([robot]), pose: restPose() };
  }, []);
  useEffect(() => () => fleet.dispose(), [fleet]);
  // Sombra de contato do visitante (na Baixa, sem mapa de sombras, é ela que o põe no chão).
  const contact = useRef<THREE.Mesh>(null);
  const contactParts = useMemo(() => ({ geometry: contactShadowGeometry(0.95, 0.8), material: contactShadowMaterial(0.6) }), []);
  useEffect(
    () => () => {
      contactParts.geometry.dispose();
      contactParts.material.dispose();
    },
    [contactParts],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const w = runtime.walker;
    const mode = runtime.mode;
    const v = vehicleById(runtime, runtime.active);
    let x = w.x;
    let z = w.z;
    let y = w.y;
    let heading = w.heading;
    let scale = 1;
    if ((mode === 'entering' || mode === 'exiting') && v) {
      // Porta do motorista: lado esquerdo do veículo.
      const p = vehiclePose(v);
      const half = v.kind === 'car' ? CAR_SPECS[v.cls].width / 2 : 1.4;
      const r = rightOf(p.heading);
      const door = { x: p.x - r.x * half, z: p.z - r.z * half };
      // Entrando: do ponto onde estava até a porta, encolhendo; saindo: o inverso.
      const k = mode === 'entering' ? runtime.transition : 1 - runtime.transition;
      x = w.x + (door.x - w.x) * k;
      z = w.z + (door.z - w.z) * k;
      y = w.y + (p.y - w.y) * k;
      heading = Math.atan2(door.x - w.x, door.z - w.z) || heading;
      scale = Math.max(0.001, 1 - Math.max(0, (k - 0.55) / 0.45));
    } else if (mode === 'driving') scale = 0.001;
    robot.root.position.set(x, y, z);
    robot.root.rotation.y = heading;
    robot.root.scale.setScalar(scale);
    if (contact.current) {
      contact.current.position.set(x, y, z);
      contact.current.rotation.y = heading;
      contact.current.visible = scale > 0.2;
    }
    const speed = mode === 'foot' ? walkerSpeed(w) : mode === 'driving' ? 0 : 1.2;
    pose.walk = Math.min(1, speed / WALK_SPEED);
    pose.phase = mode === 'foot' ? w.stride : pose.phase + dt * 6;
    if (effects) pose.time += dt;
    // Correndo: braços e pernas mais amplos vêm da própria fase mais rápida.
    robot.apply(pose);
    fleet.sync();
  });

  return (
    <>
      <primitive object={fleet.group} />
      <mesh ref={contact} geometry={contactParts.geometry} material={contactParts.material} renderOrder={6} />
    </>
  );
}
