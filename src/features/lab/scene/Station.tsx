import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AgentStatus } from '@/types/domain';
import type { LabRuntime, StationLayout } from '../layout';
import { drawLabel, drawScreen, makeCanvasTexture, makeGlowTexture, type ScreenContent } from './textures';

interface StationProps {
  layout: StationLayout;
  color: string;
  name: string;
  status: AgentStatus;
  screen: ScreenContent;
  near: boolean;
  effects: boolean;
  runtime: LabRuntime;
  onSelect: () => void;
}

const SCREEN_W = 3.2;
const SCREEN_H = 1.8;

/** Robô estilizado: corpo em cápsula, visor na cor do agente, antena e anel de flutuação. */
function Robot({
  color,
  status,
  effects,
  lookAt,
  active,
  baseYaw,
  phase,
}: {
  color: string;
  status: AgentStatus;
  effects: boolean;
  lookAt: () => THREE.Vector3 | null;
  active: boolean;
  /** Rotação Y da estação: converte o alvo do mundo para o referencial local. */
  baseYaw: number;
  phase: number;
}) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const tip = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(phase);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (effects) t.current += dt;
    const time = t.current;
    if (root.current) root.current.position.y = Math.sin(time * 1.6) * 0.06;
    // Braços "digitam" quando o agente está ativo.
    const typing = status === 'active' ? 1 : 0.15;
    if (armL.current) armL.current.rotation.x = -1.1 + Math.sin(time * 9) * 0.12 * typing;
    if (armR.current) armR.current.rotation.x = -1.1 + Math.cos(time * 9) * 0.12 * typing;
    if (tip.current) {
      const base = status === 'failed' ? '#e57465' : color;
      tip.current.color.set(base);
      tip.current.opacity = status === 'failed' ? 0.5 + Math.abs(Math.sin(time * 6)) * 0.5 : 0.6 + Math.sin(time * 3) * 0.3;
    }
    if (head.current && root.current) {
      const target = active ? lookAt() : null;
      let yaw = Math.sin(time * 0.5) * 0.3;
      if (target) {
        root.current.getWorldPosition(tmp);
        yaw = Math.atan2(target.x - tmp.x, target.z - tmp.z) - baseYaw;
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        yaw = THREE.MathUtils.clamp(yaw, -1, 1);
      }
      head.current.rotation.y += (yaw - head.current.rotation.y) * Math.min(1, dt * 4);
    }
  });

  return (
    <group ref={root}>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.4, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <capsuleGeometry args={[0.3, 0.55, 6, 16]} />
        <meshStandardMaterial color="#d9dee6" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.305, 0.025, 8, 40]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={armL} position={[-0.38, 1.18, 0.05]}>
        <capsuleGeometry args={[0.07, 0.38, 4, 8]} />
        <meshStandardMaterial color="#b8c0cc" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh ref={armR} position={[0.38, 1.18, 0.05]}>
        <capsuleGeometry args={[0.07, 0.38, 4, 8]} />
        <meshStandardMaterial color="#b8c0cc" metalness={0.5} roughness={0.35} />
      </mesh>
      <group ref={head} position={[0, 1.78, 0]}>
        <mesh>
          <sphereGeometry args={[0.29, 24, 18]} />
          <meshStandardMaterial color="#e7ebf1" metalness={0.4} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.02, 0.24]}>
          <boxGeometry args={[0.4, 0.11, 0.1]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
          <meshStandardMaterial color="#a9b1bd" />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <sphereGeometry args={[0.045, 12, 8]} />
          <meshBasicMaterial ref={tip} color={color} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Estação de trabalho de um agente: console, robô, tela de dados ao vivo,
 * anel de interação no piso e rótulo flutuante. A estação inteira é
 * clicável/tocável; de perto, a tecla E abre o painel do agente.
 */
export function Station({ layout, color, name, status, screen, near, effects, runtime, onSelect }: StationProps) {
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(0);
  const screenTex = useMemo(() => makeCanvasTexture(800, 450), []);
  const label = useMemo(() => makeCanvasTexture(360, 96), []);
  const glow = useMemo(() => makeGlowTexture(`rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},1)`), [color]);
  const playerVec = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const redraw = () => {
      drawScreen(screenTex.ctx, 800, 450, screen);
      screenTex.texture.needsUpdate = true;
    };
    redraw();
    void document.fonts?.ready.then(redraw);
  }, [screen, screenTex]);

  useEffect(() => {
    const redraw = () => {
      drawLabel(label.ctx, 360, 96, name, color);
      label.texture.needsUpdate = true;
    };
    redraw();
    void document.fonts?.ready.then(redraw);
  }, [name, color, label]);

  useFrame((_, dt) => {
    if (effects) t.current += dt;
    if (ringMat.current) {
      const target = near ? 0.95 : 0.32 + Math.sin(t.current * 2) * 0.08;
      ringMat.current.opacity += (target - ringMat.current.opacity) * Math.min(1, dt * 6);
    }
  });

  // A frente da estação (eixo +Z local) aponta para a Central.
  const rotationY = Math.atan2(-Math.cos(layout.angle), -Math.sin(layout.angle));

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    onSelect();
  };

  return (
    <group position={[layout.x, 0, layout.z]} rotation={[0, rotationY, 0]} onClick={click}>
      {/* anel de interação */}
      <mesh position={[0, 0.03, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.05, 2.2, 72]} />
        <meshBasicMaterial ref={ringMat} color={color} transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.02, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.05, 48]} />
        <meshBasicMaterial color={color} transparent opacity={near ? 0.08 : 0.03} />
      </mesh>

      {/* console */}
      <mesh position={[0, 0.45, 0.35]}>
        <boxGeometry args={[2, 0.9, 0.8]} />
        <meshStandardMaterial color="#1a2a44" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.91, 0.35]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[1.9, 0.04, 0.72]} />
        <meshStandardMaterial color="#0d1727" emissive={color} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0.88, 0.76]}>
        <boxGeometry args={[2, 0.03, 0.02]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {/* robô atrás do console */}
      <group position={[0, 0, -0.55]}>
        <Robot
          color={color}
          status={status}
          effects={effects}
          active={near}
          baseYaw={rotationY}
          phase={layout.angle * 3}
          lookAt={() => playerVec.set(runtime.player.x, 1.5, runtime.player.z)}
        />
      </group>

      {/* tela de dados */}
      <group position={[0, 2.75, -1.55]}>
        <mesh position={[0, 0, -0.04]}>
          <boxGeometry args={[SCREEN_W + 0.14, SCREEN_H + 0.14, 0.06]} />
          <meshStandardMaterial color="#0d1727" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial map={screenTex.texture} toneMapped={false} />
        </mesh>
        <mesh position={[0, -SCREEN_H / 2 - 0.9, -0.1]}>
          <cylinderGeometry args={[0.05, 0.08, 1.8, 10]} />
          <meshStandardMaterial color="#263b54" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
      <sprite position={[0, 2.75, -1.75]} scale={[5, 3.4, 1]}>
        <spriteMaterial map={glow} transparent opacity={near ? 0.35 : 0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* rótulo */}
      <sprite position={[0, 4.2, -1.4]} scale={[1.5, 0.4, 1]}>
        <spriteMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}
