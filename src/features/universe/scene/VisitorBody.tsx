import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { Humanoid, HumanoidFleet, restPose } from '@/features/lab/scene/robots/humanoid';
import { PALETTE } from './textures';
import { contactShadowGeometry, contactShadowMaterial } from './contactShadow';

/** O que o corpo desenha neste quadro (quem o controla preenche). */
export interface VisitorFrame {
  x: number;
  y: number;
  z: number;
  heading: number;
  scale: number;
  /** 0 parado … 1 andando (a corrida vem da fase mais rápida). */
  walk: number;
  /** Fase da passada (a distância percorrida, para as pernas não patinarem). */
  phase: number;
}

/**
 * O corpo do visitante, o mesmo no Universe e no laboratório: o robô humanoide articulado com detalhes
 * dourados (o "explorador Bezalel"), animado pela passada real, com sombra de contato (que o põe no chão
 * mesmo sem mapa de sombras). `frame` é chamado a cada quadro para dizer onde e como ele está.
 */
export function VisitorBody({ effects, frame }: { effects: boolean; frame: (dt: number, out: VisitorFrame) => void }) {
  const { robot, fleet, pose } = useMemo(() => {
    const robot = new Humanoid(PALETTE.gold);
    return { robot, fleet: new HumanoidFleet([robot]), pose: restPose() };
  }, []);
  useEffect(() => () => fleet.dispose(), [fleet]);
  const out = useMemo<VisitorFrame>(() => ({ x: 0, y: 0, z: 0, heading: 0, scale: 1, walk: 0, phase: 0 }), []);
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
    frame(dt, out);
    robot.root.position.set(out.x, out.y, out.z);
    robot.root.rotation.y = out.heading;
    robot.root.scale.setScalar(Math.max(0.001, out.scale));
    if (contact.current) {
      contact.current.position.set(out.x, out.y, out.z);
      contact.current.rotation.y = out.heading;
      contact.current.visible = out.scale > 0.2;
    }
    pose.walk = out.walk;
    pose.phase = out.phase;
    if (effects) pose.time += dt;
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
