import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HUB_RADIUS } from '../layout';
import { drawHubPanel, makeCanvasTexture, makeGlowTexture, type HubContent } from './textures';

const PANEL_W = 2.8;
const PANEL_H = 1.6;

/**
 * Central de Operações: base, núcleo cristalino, anéis orbitais e três
 * painéis holográficos com as métricas ao vivo (simulação nesta versão).
 */
export function Hub({ content, effects, onSelect }: { content: HubContent; effects: boolean; onSelect: () => void }) {
  const panelsRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Mesh>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const time = useRef(0);

  const screen = useMemo(() => makeCanvasTexture(720, 412), []);
  const glow = useMemo(() => makeGlowTexture('rgba(199,168,106,1)'), []);

  useEffect(() => {
    const redraw = () => {
      drawHubPanel(screen.ctx, 720, 412, content);
      screen.texture.needsUpdate = true;
    };
    redraw();
    void document.fonts?.ready.then(redraw);
  }, [content, screen]);

  useFrame((_, dt) => {
    if (!effects) return;
    time.current += dt;
    const t = time.current;
    if (panelsRef.current) panelsRef.current.rotation.y += dt * 0.08;
    if (crystalRef.current) {
      crystalRef.current.rotation.y += dt * 0.6;
      crystalRef.current.position.y = 2.55 + Math.sin(t * 1.4) * 0.12;
    }
    if (ring1.current) ring1.current.rotation.z += dt * 0.4;
    if (ring2.current) ring2.current.rotation.z -= dt * 0.25;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    onSelect();
  };

  return (
    <group onClick={click}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[HUB_RADIUS - 0.4, HUB_RADIUS, 0.7, 64]} />
        <meshStandardMaterial color="#172840" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.71, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[HUB_RADIUS - 0.75, HUB_RADIUS - 0.45, 96]} />
        <meshBasicMaterial color="#c7a86a" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[HUB_RADIUS - 0.8, 64]} />
        <meshStandardMaterial color="#0d1727" emissive="#263b54" emissiveIntensity={0.4} />
      </mesh>

      <mesh ref={crystalRef} position={[0, 2.55, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#ead9b2" emissive="#c7a86a" emissiveIntensity={1.4} metalness={0.3} roughness={0.15} flatShading />
      </mesh>
      <sprite position={[0, 2.55, 0]} scale={[3.4, 3.4, 1]}>
        <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.55} />
      </sprite>
      <mesh ref={ring1} position={[0, 2.55, 0]} rotation={[Math.PI / 2.4, 0.2, 0]}>
        <torusGeometry args={[1.25, 0.018, 8, 120]} />
        <meshBasicMaterial color="#c7a86a" toneMapped={false} />
      </mesh>
      <mesh ref={ring2} position={[0, 2.55, 0]} rotation={[Math.PI / 1.7, -0.4, 0]}>
        <torusGeometry args={[1.7, 0.012, 8, 120]} />
        <meshBasicMaterial color="#7fa6f5" transparent opacity={0.7} />
      </mesh>
      {/* Coluna de luz */}
      <mesh position={[0, 2.1, 0]}>
        <cylinderGeometry args={[0.04, 0.3, 2.8, 16, 1, true]} />
        <meshBasicMaterial color="#c7a86a" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <group ref={panelsRef} position={[0, 4.15, 0]}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 1.65, 0, Math.cos(a) * 1.65]} rotation={[0, a, 0]}>
              <planeGeometry args={[PANEL_W, PANEL_H]} />
              <meshBasicMaterial map={screen.texture} transparent side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
