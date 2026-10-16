import { Canvas } from '@react-three/fiber';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import { ContextLossWatcher, PerformanceWatch } from '@/components/three/watchers';
import type { AgentId, AgentStatus } from '@/types/domain';
import type { GuideTarget } from '../journey';
import { STATIONS, type LabPulse, type LabRuntime } from '../layout';
import { Environment } from './Environment';
import { Flows } from './Flows';
import { Hub } from './Hub';
import { Player } from './Player';
import { Bloom } from './post/Bloom';
import { Robots } from './Robots';
import { Sector } from './Sector';
import type { HubContent, LogContent, MetricContent, ScreenContent } from './textures';

export interface LabSceneProps {
  runtime: LabRuntime;
  quality: 'high' | 'low';
  effects: boolean;
  /** Brilho (bloom) — só em aparelho forte, qualidade alta e efeitos ligados. */
  bloom: boolean;
  inputEnabled: boolean;
  screens: Record<AgentId, ScreenContent>;
  sideScreens: Record<AgentId, { log: LogContent; metric: MetricContent }>;
  /** Alturas relativas (0–1) das barras do setor Trend. */
  trendBars: number[];
  hub: HubContent;
  statuses: Record<AgentId, AgentStatus>;
  names: Record<AgentId, string>;
  near: AgentId | null;
  pulse: LabPulse | null;
  onSelectStation: (id: AgentId) => void;
  onSelectHub: () => void;
  onNearChange: (id: AgentId | null) => void;
  onLowPerformance: () => void;
  onContextLost: () => void;
  /** Parada atual da jornada guiada (tour / seguir um curso), ou nenhuma. */
  guideTarget: GuideTarget | null;
  /** O guia chegou à parada. */
  onGuideArrive: () => void;
}

/**
 * Cena 3D do campus do laboratório (three.js + React Three Fiber). Este
 * módulo e suas dependências formam um chunk separado, baixado apenas quando
 * o visitante escolhe o modo 3D; o pós-processamento (bloom) é outro chunk,
 * baixado só em aparelho forte.
 */
export default function LabScene(props: LabSceneProps) {
  const { runtime, quality, effects, inputEnabled, screens, sideScreens, trendBars, hub, statuses, names, near, pulse } = props;
  return (
    <Canvas
      key={quality}
      dpr={quality === 'high' ? [1, 1.75] : 1}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false }}
      camera={{ fov: 50, near: 0.1, far: 170, position: [0, 10, 30] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.3;
      }}
      className="!absolute inset-0"
    >
      <Environment quality={quality} effects={effects} onFloorClick={(p) => (runtime.target = { x: p.x, z: p.z })} />
      <Hub content={hub} effects={effects} onSelect={props.onSelectHub} />
      {STATIONS.map((s) => (
        <Sector
          key={s.id}
          layout={s}
          color={AGENT_HEX[s.id]}
          name={names[s.id]}
          screen={screens[s.id]}
          side={sideScreens[s.id]}
          bars={trendBars}
          near={near === s.id}
          active={statuses[s.id] === 'active'}
          effects={effects}
          quality={quality}
          onSelect={() => props.onSelectStation(s.id)}
        />
      ))}
      <Robots runtime={runtime} statuses={statuses} near={near} pulse={pulse} effects={effects} carriers={quality === 'high' ? 6 : 3} guideTarget={props.guideTarget} onGuideArrive={props.onGuideArrive} />
      <Flows key={quality} effects={effects} quality={quality} pulse={pulse} />
      <Player runtime={runtime} inputEnabled={inputEnabled} effects={effects} onNearChange={props.onNearChange} />
      {quality === 'high' && <PerformanceWatch onLow={props.onLowPerformance} />}
      {props.bloom && <Bloom />}
      <ContextLossWatcher onLost={props.onContextLost} />
    </Canvas>
  );
}
