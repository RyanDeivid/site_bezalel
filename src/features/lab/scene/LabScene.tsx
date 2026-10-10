import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import type { AgentId, AgentStatus } from '@/types/domain';
import { STATIONS, type LabRuntime } from '../layout';
import { Environment } from './Environment';
import { Flows } from './Flows';
import { Hub } from './Hub';
import { PerformanceWatch, Player } from './Player';
import { Station } from './Station';
import type { HubContent, ScreenContent } from './textures';

export interface LabSceneProps {
  runtime: LabRuntime;
  quality: 'high' | 'low';
  effects: boolean;
  inputEnabled: boolean;
  screens: Record<AgentId, ScreenContent>;
  hub: HubContent;
  statuses: Record<AgentId, AgentStatus>;
  names: Record<AgentId, string>;
  near: AgentId | null;
  pulse: { id: string; agent: AgentId } | null;
  onSelectStation: (id: AgentId) => void;
  onSelectHub: () => void;
  onNearChange: (id: AgentId | null) => void;
  onLowPerformance: () => void;
  onContextLost: () => void;
}

/**
 * Observa perda real do contexto WebGL (driver, GPU, memória). O listener é
 * removido no desmonte — antes de o R3F forçar a perda do contexto ao
 * descartar o renderer —, então sair da página não é tratado como falha.
 */
function ContextLossWatcher({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const handler = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener('webglcontextlost', handler);
    return () => el.removeEventListener('webglcontextlost', handler);
  }, [gl, onLost]);
  return null;
}

/**
 * Cena 3D do laboratório (three.js + React Three Fiber). Este módulo e suas
 * dependências formam um chunk separado, baixado apenas quando o visitante
 * escolhe o modo 3D.
 */
export default function LabScene(props: LabSceneProps) {
  const { runtime, quality, effects, inputEnabled, screens, hub, statuses, names, near, pulse } = props;
  return (
    <Canvas
      key={quality}
      dpr={quality === 'high' ? [1, 1.75] : 1}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false }}
      camera={{ fov: 50, near: 0.1, far: 140, position: [0, 9, 26] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.35;
      }}
      className="!absolute inset-0"
    >
      <Environment quality={quality} effects={effects} onFloorClick={(p) => (runtime.target = { x: p.x, z: p.z })} />
      <Hub content={hub} effects={effects} onSelect={props.onSelectHub} />
      {STATIONS.map((s) => (
        <Station
          key={s.id}
          layout={s}
          color={AGENT_HEX[s.id]}
          name={names[s.id]}
          status={statuses[s.id]}
          screen={screens[s.id]}
          near={near === s.id}
          effects={effects}
          runtime={runtime}
          onSelect={() => props.onSelectStation(s.id)}
        />
      ))}
      <Flows key={quality} effects={effects} quality={quality} pulse={pulse} />
      <Player runtime={runtime} inputEnabled={inputEnabled} effects={effects} onNearChange={props.onNearChange} />
      {quality === 'high' && <PerformanceWatch onLow={props.onLowPerformance} />}
      <ContextLossWatcher onLost={props.onContextLost} />
    </Canvas>
  );
}
