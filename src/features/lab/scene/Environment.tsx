import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LAB_RADIUS } from '../layout';
import { drawFloor, makeCanvasTexture } from './textures';

const PILLARS = 14;

/**
 * Arquitetura do laboratório: plataforma circular com grade, anel de pilares
 * com filetes dourados, coroa luminosa e campo de estrelas. Geometrias
 * reutilizadas e instanciadas para manter o custo de renderização baixo.
 */
export function Environment({ quality, effects, onFloorClick }: { quality: 'high' | 'low'; effects: boolean; onFloorClick: (p: THREE.Vector3) => void }) {
  const floorTex = useMemo(() => {
    const { ctx, texture } = makeCanvasTexture(1024, 1024);
    drawFloor(ctx, 1024);
    texture.needsUpdate = true;
    return texture;
  }, []);

  const pillarRef = useRef<THREE.InstancedMesh>(null);
  const stripRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const r = LAB_RADIUS + 0.9;
    for (let i = 0; i < PILLARS; i++) {
      const a = (i / PILLARS) * Math.PI * 2;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
      m.compose(new THREE.Vector3(Math.cos(a) * r, 3.5, Math.sin(a) * r), q, s);
      pillarRef.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(Math.cos(a) * (r - 0.27), 3.5, Math.sin(a) * (r - 0.27)), q, s);
      stripRef.current?.setMatrixAt(i, m);
    }
    if (pillarRef.current) pillarRef.current.instanceMatrix.needsUpdate = true;
    if (stripRef.current) stripRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  const stars = useMemo(() => {
    const count = quality === 'high' ? 420 : 160;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i * 137.508 * Math.PI) / 180;
      const y = 9 + ((i * 7919) % 100) / 6;
      const rr = 8 + ((i * 104729) % 1000) / 40;
      positions[i * 3] = Math.cos(a) * rr;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * rr;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [quality]);

  useFrame((_, dt) => {
    if (!effects || !crownRef.current) return;
    crownRef.current.rotation.z += dt * 0.03;
  });

  return (
    <group>
      <color attach="background" args={['#070d17']} />
      <fog attach="fog" args={['#070d17', 30, 70]} />
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#a9c4e8', '#1a2a44', 1.25]} />
      <directionalLight position={[10, 16, 8]} intensity={1.8} color="#f2e8d5" />
      <directionalLight position={[-12, 10, -10]} intensity={0.7} color="#7fa6f5" />
      <pointLight position={[0, 4.5, 0]} intensity={40} distance={26} color="#c7a86a" decay={1.4} />

      {/* Piso clicável: clique curto define o destino da caminhada */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return; // foi arraste de câmera, não clique
          e.stopPropagation();
          onFloorClick(e.point);
        }}
      >
        <circleGeometry args={[LAB_RADIUS + 0.6, 96]} />
        <meshStandardMaterial map={floorTex} roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Borda baixa */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[LAB_RADIUS + 0.6, LAB_RADIUS + 0.6, 0.6, 96, 1, true]} />
        <meshStandardMaterial color="#132136" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[LAB_RADIUS + 0.55, LAB_RADIUS + 0.65, 128]} />
        <meshBasicMaterial color="#c7a86a" transparent opacity={0.55} />
      </mesh>

      {/* Pilares e filetes luminosos */}
      <instancedMesh ref={pillarRef} args={[undefined, undefined, PILLARS]}>
        <boxGeometry args={[0.55, 7, 0.55]} />
        <meshStandardMaterial color="#1a2a44" roughness={0.6} metalness={0.35} />
      </instancedMesh>
      <instancedMesh ref={stripRef} args={[undefined, undefined, PILLARS]}>
        <boxGeometry args={[0.06, 6.2, 0.02]} />
        <meshBasicMaterial color="#c7a86a" toneMapped={false} />
      </instancedMesh>

      {/* Coroa */}
      <mesh ref={crownRef} position={[0, 7.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[LAB_RADIUS + 0.9, 0.06, 8, 160]} />
        <meshBasicMaterial color="#c7a86a" toneMapped={false} />
      </mesh>

      <points geometry={stars}>
        <pointsMaterial color="#f2e8d5" size={0.06} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
      </points>
    </group>
  );
}
