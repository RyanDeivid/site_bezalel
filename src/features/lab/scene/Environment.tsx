import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import { EnvironmentMap } from '@/components/three/EnvironmentMap';
import { ENTRANCE_ANGLE, LAB_RADIUS, PLAZA_RADIUS, RING_RADIUS, SECTOR_RADIUS, SECTOR_SIZE, STATIONS } from '../layout';
import { drawCampusFloor, makeCanvasTexture } from './textures';

const WALL_R = LAB_RADIUS + 0.9;
/** Metade da abertura do portal de entrada (rad). */
const GATE_HALF = 0.13;
const PILLARS = 36;

/** Ângulos dos pilares, sem os que cairiam no vão do portal. */
const pillarAngles = Array.from({ length: PILLARS }, (_, i) => (i / PILLARS) * Math.PI * 2 + ENTRANCE_ANGLE + Math.PI / PILLARS).filter(
  (a) => Math.abs(Math.atan2(Math.sin(a - ENTRANCE_ANGLE), Math.cos(a - ENTRANCE_ANGLE))) > GATE_HALF + 0.04,
);

/**
 * Arquitetura do campus: piso com praça, anel de circulação e caminhos até os
 * setores; muro baixo com pilares e filetes dourados, portal de entrada ao
 * sul; coroa luminosa e campo de estrelas. Geometrias instanciadas para
 * manter o custo de renderização baixo.
 */
export function Environment({ quality, effects, onFloorClick }: { quality: 'high' | 'low'; effects: boolean; onFloorClick: (p: THREE.Vector3) => void }) {
  const floorTex = useMemo(() => {
    const size = quality === 'high' ? 2048 : 1024;
    const { ctx, texture } = makeCanvasTexture(size, size);
    drawCampusFloor(ctx, size, {
      radius: LAB_RADIUS + 0.8,
      plaza: PLAZA_RADIUS,
      ring: RING_RADIUS,
      sectorRadius: SECTOR_RADIUS,
      sectorSize: SECTOR_SIZE,
      entrance: ENTRANCE_ANGLE,
      sectors: STATIONS.map((s) => ({ angle: s.angle, color: AGENT_HEX[s.id] })),
    });
    texture.needsUpdate = true;
    return texture;
  }, [quality]);
  useEffect(() => () => floorTex.dispose(), [floorTex]);

  const pillarRef = useRef<THREE.InstancedMesh>(null);
  const stripRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    pillarAngles.forEach((a, i) => {
      q.setFromAxisAngle(up, -a + Math.PI / 2);
      m.compose(new THREE.Vector3(Math.cos(a) * WALL_R, 3.5, Math.sin(a) * WALL_R), q, s);
      pillarRef.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(Math.cos(a) * (WALL_R - 0.31), 3.5, Math.sin(a) * (WALL_R - 0.31)), q, s);
      stripRef.current?.setMatrixAt(i, m);
    });
    if (pillarRef.current) pillarRef.current.instanceMatrix.needsUpdate = true;
    if (stripRef.current) stripRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  const stars = useMemo(() => {
    const count = quality === 'high' ? 700 : 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i * 137.508 * Math.PI) / 180;
      const y = 14 + ((i * 7919) % 100) / 4;
      const rr = 10 + ((i * 104729) % 1000) / 22;
      positions[i * 3] = Math.cos(a) * rr;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * rr;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [quality]);
  useEffect(() => () => stars.dispose(), [stars]);

  useFrame((_, dt) => {
    if (!effects || !crownRef.current) return;
    crownRef.current.rotation.z += dt * 0.02;
  });

  // Muro baixo: um cilindro aberto com o vão do portal.
  const wallStart = ENTRANCE_ANGLE + GATE_HALF;
  const wallLength = Math.PI * 2 - GATE_HALF * 2;
  const gate = { x: Math.cos(ENTRANCE_ANGLE), z: Math.sin(ENTRANCE_ANGLE) };
  // CylinderGeometry mede theta a partir de +Z em direção a +X; a planta mede a partir de +X em direção a +Z.
  const toThetaStart = (a: number, len: number) => Math.PI / 2 - a - len;

  return (
    <group>
      <color attach="background" args={['#070d17']} />
      <fog attach="fog" args={['#070d17', 46, 110]} />
      <EnvironmentMap intensity={quality === 'high' ? 0.55 : 0.4} />
      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#a9c4e8', '#1a2a44', 1.15]} />
      <directionalLight position={[14, 22, 10]} intensity={1.7} color="#f2e8d5" />
      <directionalLight position={[-16, 12, -14]} intensity={0.65} color="#7fa6f5" />
      <pointLight position={[0, 5, 0]} intensity={42} distance={30} color="#c7a86a" decay={1.4} />

      {/* Piso clicável: clique curto define o destino da caminhada */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return; // foi arraste de câmera, não clique
          e.stopPropagation();
          onFloorClick(e.point);
        }}
      >
        <circleGeometry args={[LAB_RADIUS + 0.8, 128]} />
        <meshStandardMaterial map={floorTex} roughness={0.58} metalness={0.12} envMapIntensity={0.22} />
      </mesh>

      {/* Muro baixo com o vão do portal e filete dourado no topo */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[LAB_RADIUS + 0.8, LAB_RADIUS + 0.8, 0.7, 160, 1, true, toThetaStart(wallStart, wallLength), wallLength]} />
        <meshStandardMaterial color="#132136" side={THREE.DoubleSide} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[LAB_RADIUS + 0.74, LAB_RADIUS + 0.86, 160, 1, -(wallStart + wallLength), wallLength]} />
        <meshBasicMaterial color="#c7a86a" transparent opacity={0.6} toneMapped={false} />
      </mesh>

      {/* Pilares e filetes luminosos */}
      <instancedMesh ref={pillarRef} args={[undefined, undefined, pillarAngles.length]}>
        <boxGeometry args={[0.6, 7, 0.6]} />
        <meshStandardMaterial color="#1a2a44" roughness={0.45} metalness={0.55} />
      </instancedMesh>
      <instancedMesh ref={stripRef} args={[undefined, undefined, pillarAngles.length]}>
        <boxGeometry args={[0.07, 6.2, 0.02]} />
        <meshBasicMaterial color="#c7a86a" toneMapped={false} />
      </instancedMesh>

      {/* Portal de entrada (sul): dois pilones e uma viga com a linha dourada */}
      <group position={[gate.x * WALL_R, 0, gate.z * WALL_R]} rotation={[0, Math.atan2(gate.x, gate.z), 0]}>
        {[-2.6, 2.6].map((x) => (
          <mesh key={x} position={[x, 3.4, 0]}>
            <boxGeometry args={[0.9, 6.8, 0.9]} />
            <meshStandardMaterial color="#1e3149" roughness={0.35} metalness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 6.6, 0]}>
          <boxGeometry args={[6.1, 0.5, 0.9]} />
          <meshStandardMaterial color="#1e3149" roughness={0.35} metalness={0.7} />
        </mesh>
        <mesh position={[0, 6.6, -0.46]}>
          <boxGeometry args={[5.4, 0.06, 0.02]} />
          <meshBasicMaterial color="#ead9b2" toneMapped={false} />
        </mesh>
      </group>

      {/* Coroa */}
      <mesh ref={crownRef} position={[0, 7.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[WALL_R, 0.07, 8, 220]} />
        <meshBasicMaterial color="#c7a86a" toneMapped={false} />
      </mesh>

      <points geometry={stars}>
        <pointsMaterial color="#f2e8d5" size={0.08} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
      </points>
    </group>
  );
}
