import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { readStorage } from '@/lib/storage';
import { ContextLossWatcher } from '@/components/three/watchers';
import { cityTowers, citySolids, skybridges, type PlaceId, type Quality } from '../world/city';
import { QUALITY_CONFIG } from './quality';
import type { UniverseRuntime } from '../world/runtime';
import { AirTraffic } from './AirTraffic';
import { useUniverseAssets, type UniverseAssets } from './assets';
import { PerformanceGovernor } from './PerformanceGovernor';
import { Avatar } from './Avatar';
import { Billboards, Skybridges, Towers } from './Buildings';
import { buildCarModels, buildFarCarModels, createCarMaterials, disposeCarMaterials, disposeCarModels, disposeFarCarModels } from './carModels';
import { City } from './City';
import { Landmarks, type LandmarkTexts } from './Landmarks';
import { PerfProbe } from './PerfProbe';
import { Warmup } from './Warmup';
import { PlayerController } from './PlayerController';
import { Sun } from './Sun';
import { Traffic } from './Traffic';
import { PlayerVehicles } from './Vehicles';

export interface UniverseSceneProps {
  runtime: UniverseRuntime;
  quality: Quality;
  /** Animações ambientes e trânsito (desligados com "Pausar" e com movimento reduzido). */
  effects: boolean;
  /** Câmera calma (movimento reduzido): sem mudança de campo de visão nem tremor. */
  calmCamera: boolean;
  inputEnabled: boolean;
  near: PlaceId | null;
  texts: LandmarkTexts;
  /** Mensagens dos telões (produtos reais do site). */
  billboards: Array<{ title: string; line: string }>;
  onSelect: (id: PlaceId) => void;
  onNearChange: (id: PlaceId | null) => void;
  onNearVehicleChange: (id: string | null) => void;
  onAutopilotEnd: () => void;
  onInteract: () => void;
  /** Desempenho baixo mesmo com a resolução no piso: descer um nível. */
  onLowPerformance: () => void;
  /** Folga de sobra (nenhum quadro atrasado na resolução máxima): pode subir um nível. */
  onHeadroom: () => void;
  /** A página permite subir de nível (modo Auto e há nível acima ainda não reprovado). */
  canUpgrade: boolean;
  /** O nível atual foi alcançado subindo: em período de prova. */
  probation: boolean;
  onContextLost: () => void;
  /** Sonda de desempenho dos testes (`bz-universe-debug`). */
  debug?: boolean;
  /** Shaders compilados e texturas enviadas: o laço de quadros começou. */
  onReady: () => void;
}

/** Céu em domo + estrelas fixas (determinísticas). */
function Sky({ assets, quality }: { assets: UniverseAssets; quality: Quality }) {
  const stars = useMemo(() => {
    const { stars: count, far } = QUALITY_CONFIG[quality];
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i * 137.508 * Math.PI) / 180;
      const elev = 0.12 + ((i * 7919) % 1000) / 1150;
      const r = far * 0.82;
      pos[i * 3] = Math.cos(a) * Math.cos(elev) * r;
      pos[i * 3 + 1] = Math.sin(elev) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(elev) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [quality]);
  useEffect(() => () => stars.dispose(), [stars]);
  return (
    <>
      <mesh material={assets.materials.sky} renderOrder={-1}>
        {/* O domo fica dentro do alcance da câmera (senão aparece recortado). */}
        <sphereGeometry args={[QUALITY_CONFIG[quality].far * 0.9, 32, 16]} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial color="#f2e8d5" size={1.6} sizeAttenuation={false} transparent opacity={0.7} depthWrite={false} fog={false} />
      </points>
    </>
  );
}

function World(props: UniverseSceneProps) {
  const { quality, effects, runtime } = props;
  const cfg = QUALITY_CONFIG[quality];
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const assets = useUniverseAssets(quality, Math.min(cfg.anisotropy, maxAniso));
  const towers = useMemo(() => cityTowers(quality), [quality]);
  const bridges = useMemo(() => skybridges(towers), [towers]);
  const solids = useMemo(() => citySolids(quality), [quality]);
  // Modelos e materiais dos carros: construídos uma vez, compartilhados por trânsito, voadores e carros do jogador.
  const carModels = useMemo(() => buildCarModels(), []);
  const farCarModels = useMemo(() => buildFarCarModels(), []);
  const carMaterials = useMemo(() => createCarMaterials(quality), [quality]);
  useEffect(() => () => disposeCarModels(carModels), [carModels]);
  useEffect(() => () => disposeFarCarModels(farCarModels), [farCarModels]);
  useEffect(() => () => disposeCarMaterials(carMaterials), [carMaterials]);
  return (
    <>
      <color attach="background" args={['#070d17']} />
      <fog attach="fog" args={['#0c1730', 120, cfg.fog]} />
      {/* O mapa de reflexos é gerado no Warmup, sem travar a página. */}
      <Sky assets={assets} quality={quality} />
      <hemisphereLight args={['#9fb8e0', '#0b1322', 0.85]} />
      <ambientLight intensity={0.22} />
      {/* Luar frio (sombras que acompanham a câmera, no médio e no alto) e um contraluz quente, discreto */}
      <Sun mapSize={cfg.shadows} range={cfg.shadowRange} every={cfg.shadowEvery} />
      <directionalLight position={[140, 50, -150]} intensity={0.4} color="#f2e8d5" />
      {/* Grupos com nome: a sonda de desempenho liga e desliga cada parte para medir o custo dela. */}
      <group name="city">
        <City assets={assets} quality={quality} />
      </group>
      <group name="towers">
        <Towers assets={assets} quality={quality} towers={towers} />
        <Skybridges assets={assets} bridges={bridges} />
      </group>
      <group name="billboards">
        <Billboards assets={assets} messages={props.billboards} animate={effects} />
      </group>
      <group name="landmarks">
        <Landmarks assets={assets} quality={quality} effects={effects} near={props.near} texts={props.texts} onSelect={props.onSelect} />
      </group>
      <group name="traffic">
        <Traffic quality={quality} running={effects} runtime={runtime} models={carModels} farModels={farCarModels} materials={carMaterials} lodDistance={cfg.carLod} shadows={quality !== 'low'} />
      </group>
      <group name="air">
        <AirTraffic quality={quality} running={effects} materials={carMaterials} lodDistance={cfg.airLod} />
      </group>
      <group name="player">
        <PlayerVehicles runtime={runtime} models={carModels} farModels={farCarModels} materials={carMaterials} assets={assets} effects={effects} lodDistance={cfg.carLod * 0.6} />
        <Avatar runtime={runtime} effects={effects} />
      </group>
      <PlayerController
        runtime={runtime}
        solids={solids}
        inputEnabled={props.inputEnabled}
        calmCamera={props.calmCamera}
        onNearChange={props.onNearChange}
        onNearVehicleChange={props.onNearVehicleChange}
        onAutopilotEnd={props.onAutopilotEnd}
        onInteract={props.onInteract}
      />
    </>
  );
}

/**
 * Cena 3D do Bezalel Universe (three.js + React Three Fiber). Este módulo e
 * suas dependências formam um chunk próprio, baixado só quando o visitante
 * entra no 3D. Trocar a qualidade recria o canvas (`key`), descartando e
 * recriando todos os recursos da GPU de forma previsível; sair da página
 * desmonta o canvas (o R3F encerra o laço de quadros e libera o contexto).
 */
export default function UniverseScene(props: UniverseSceneProps) {
  const cfg = QUALITY_CONFIG[props.quality];
  // Resolução: começa no que a tela pede (dentro da faixa do nível) e a AdaptiveResolution ajusta.
  // Só o Ultra sobe além da tela (superamostragem), e só se o aparelho aguentar.
  const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const startDpr = Math.max(cfg.dprMin, Math.min(cfg.dprMax, device));
  const maxDpr = props.quality === 'ultra' ? cfg.dprMax : startDpr;
  return (
    <Canvas
      key={props.quality}
      // Parado até o Warmup compilar os shaders e enviar as texturas (sem tela congelada na entrada).
      frameloop="never"
      shadows={cfg.shadows > 0 ? 'percentage' : false}
      dpr={startDpr}
      gl={{ antialias: cfg.antialias, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false }}
      camera={{ fov: 55, near: 0.2, far: cfg.far, position: [0, 6, 100] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
        // Ler o log de cada shader no primeiro uso força o navegador a esperar a compilação (e só serve
        // para depurar): ligado no desenvolvimento, desligado no site publicado.
        gl.debug.checkShaderErrors = import.meta.env.DEV;
      }}
      className="!absolute inset-0"
    >
      <World {...props} />
      <Warmup envIntensity={QUALITY_CONFIG[props.quality].envIntensity} envSize={QUALITY_CONFIG[props.quality].envSize} onReady={props.onReady} />
      <PerformanceGovernor min={cfg.dprMin} max={maxDpr} canUpgrade={props.canUpgrade} probation={props.probation} onLow={props.onLowPerformance} onHeadroom={props.onHeadroom} off={props.debug && readStorage('bz-universe-governor') === 'off'} debug={props.debug} />
      <ContextLossWatcher onLost={props.onContextLost} />
      {props.debug && <PerfProbe />}
    </Canvas>
  );
}
