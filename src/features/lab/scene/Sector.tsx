import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SECTOR_SIZE, SECTOR_SPOTS, type StationLayout } from '../layout';
import { Machine } from './Machines';
import { drawLabel, drawLog, drawMetric, drawScreen, makeCanvasTexture, makeGlowTexture, type LogContent, type MetricContent, type ScreenContent } from './textures';

interface SectorProps {
  layout: StationLayout;
  color: string;
  name: string;
  screen: ScreenContent;
  side: { log: LogContent; metric: MetricContent };
  bars: number[];
  near: boolean;
  active: boolean;
  effects: boolean;
  quality: 'high' | 'low';
  onSelect: () => void;
}

const SCREEN_W = 3.8;
const SCREEN_H = 2.14;
const SIDE_W = 1.6;
const SIDE_H = 0.96;
const DECK = 0.25; // altura da plataforma do pavilhão

const drawNameLabel = (ctx: CanvasRenderingContext2D, w: number, h: number, c: { name: string; color: string }) => drawLabel(ctx, w, h, c.name, c.color);

/**
 * Textura de canvas redesenhada só quando o conteúdo muda de fato (e de novo
 * quando as fontes carregam). As métricas são recriadas a cada segundo pelo
 * relógio do feed; comparar o conteúdo serializado evita reenviar 18
 * texturas por segundo à placa de vídeo sem nada novo nelas.
 */
function useCanvasScreen<T>(width: number, height: number, content: T, draw: (ctx: CanvasRenderingContext2D, w: number, h: number, c: T) => void) {
  const tex = useMemo(() => makeCanvasTexture(width, height), [width, height]);
  const key = JSON.stringify(content);
  useEffect(() => {
    const data = JSON.parse(key) as T;
    const redraw = () => {
      draw(tex.ctx, width, height, data);
      tex.texture.needsUpdate = true;
    };
    redraw();
    void document.fonts?.ready.then(redraw);
  }, [key, tex, width, height, draw]);
  useEffect(() => () => tex.texture.dispose(), [tex]);
  return tex.texture;
}

/**
 * Setor de um agente: pavilhão hexagonal elevado com borda luminosa, console
 * voltado para a Central, parede de monitores (tela principal com os dados do
 * agente e duas laterais — trilha de eventos e indicador principal) e a
 * máquina própria do agente no meio. O operador (robô) fica entre o console e
 * a máquina (ver `Robots`). O setor inteiro é clicável/tocável.
 */
export function Sector({ layout, color, name, screen, side, bars, near, active, effects, quality, onSelect }: SectorProps) {
  const edgeMat = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(0);
  const main = useCanvasScreen(800, 450, screen, drawScreen);
  const log = useCanvasScreen(640, 384, side.log, drawLog);
  const metric = useCanvasScreen(640, 384, side.metric, drawMetric);
  const labelContent = useMemo(() => ({ name, color }), [name, color]);
  const label = useCanvasScreen(360, 96, labelContent, drawNameLabel);
  const glow = useMemo(() => makeGlowTexture(`rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},1)`), [color]);
  useEffect(() => () => glow.dispose(), [glow]);

  useFrame((_, dt) => {
    if (effects) t.current += dt;
    if (edgeMat.current) {
      const target = near ? 1 : active ? 0.7 + Math.sin(t.current * 4) * 0.15 : 0.42;
      edgeMat.current.opacity += (target - edgeMat.current.opacity) * Math.min(1, dt * 5);
    }
  });

  // A frente do setor (eixo +Z local) aponta para a Central.
  const rotationY = Math.atan2(-Math.cos(layout.angle), -Math.sin(layout.angle));
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    onSelect();
  };
  const { console: consoleZ, wall, sideScreen } = SECTOR_SPOTS;

  return (
    <group position={[layout.x, 0, layout.z]} rotation={[0, rotationY, 0]} onClick={click}>
      {/* Pavilhão: plataforma hexagonal (lado plano voltado para a Central) e borda luminosa. */}
      <mesh position={[0, DECK / 2, 0]} rotation={[0, Math.PI / 6, 0]}>
        <cylinderGeometry args={[SECTOR_SIZE, SECTOR_SIZE + 0.18, DECK, 6]} />
        <meshStandardMaterial color="#1a2a44" metalness={0.55} roughness={0.38} />
      </mesh>
      <mesh position={[0, DECK + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SECTOR_SIZE - 0.16, SECTOR_SIZE - 0.04, 6]} />
        <meshBasicMaterial ref={edgeMat} color={color} transparent opacity={0.42} toneMapped={false} />
      </mesh>
      <mesh position={[0, DECK + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[SECTOR_SIZE - 0.2, 6]} />
        <meshStandardMaterial color="#13213a" metalness={0.35} roughness={0.32} transparent opacity={0.85} />
      </mesh>

      {/* Console */}
      <group position={[0, DECK, consoleZ]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[2.2, 0.9, 0.8]} />
          <meshStandardMaterial color="#1e3149" metalness={0.6} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.92, -0.02]} rotation={[0.28, 0, 0]}>
          <boxGeometry args={[2.1, 0.04, 0.74]} />
          <meshStandardMaterial color="#0d1727" emissive={color} emissiveIntensity={active ? 0.45 : 0.18} metalness={0.4} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.88, 0.41]}>
          <boxGeometry args={[2.2, 0.03, 0.02]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>

      {/* Máquina do agente */}
      <group position={[0, DECK, SECTOR_SPOTS.machine]}>
        <Machine agent={layout.id} color={color} active={active} effects={effects} quality={quality} bars={bars} />
      </group>

      {/* Parede de monitores: tela principal e suportes */}
      <group position={[0, DECK, wall]}>
        <mesh position={[0, 2.75, -0.05]}>
          <boxGeometry args={[SCREEN_W + 0.16, SCREEN_H + 0.16, 0.08]} />
          <meshStandardMaterial color="#0d1727" metalness={0.75} roughness={0.25} />
        </mesh>
        <mesh position={[0, 2.75, 0]}>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial map={main} toneMapped={false} />
        </mesh>
        {[-1.4, 1.4].map((x) => (
          <mesh key={x} position={[x, 0.85, -0.12]}>
            <cylinderGeometry args={[0.06, 0.09, 1.7, 10]} />
            <meshStandardMaterial color="#263b54" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
        <sprite position={[0, 2.75, -0.2]} scale={[6, 3.6, 1]}>
          <spriteMaterial map={glow} transparent opacity={near ? 0.32 : 0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        <sprite position={[0, 4.35, 0]} scale={[1.6, 0.43, 1]}>
          <spriteMaterial map={label} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      </group>

      {/* Monitores laterais, inclinados para o console: eventos (esq.) e indicador (dir.). */}
      {(
        [
          [-sideScreen.side, 0.45, log],
          [sideScreen.side, -0.45, metric],
        ] as const
      ).map(([x, yaw, map]) => (
        <group key={x} position={[x, DECK, sideScreen.along]} rotation={[0, yaw, 0]}>
          <mesh position={[0, 0.6, -0.05]}>
            <cylinderGeometry args={[0.05, 0.08, 1.2, 10]} />
            <meshStandardMaterial color="#263b54" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.7, -0.04]}>
            <boxGeometry args={[SIDE_W + 0.1, SIDE_H + 0.1, 0.06]} />
            <meshStandardMaterial color="#0d1727" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 1.7, 0]}>
            <planeGeometry args={[SIDE_W, SIDE_H]} />
            <meshBasicMaterial map={map} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {quality === 'high' && <pointLight position={[0, 3.2, 0.5]} color={color} intensity={near ? 9 : 5} distance={9} decay={1.6} />}
    </group>
  );
}
