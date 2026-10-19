import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { EnvironmentMap } from '@/components/three/EnvironmentMap';
import { ContextLossWatcher, PerformanceWatch } from '@/components/three/watchers';
import { cityTowers, citySolids, skybridges, type PlaceId, type Quality } from '../world/city';
import { QUALITY_CONFIG } from './quality';
import type { UniverseRuntime } from '../world/runtime';
import { AirTraffic } from './AirTraffic';
import { useUniverseAssets, type UniverseAssets } from './assets';
import { Avatar } from './Avatar';
import { Billboards, Skybridges, Towers } from './Buildings';
import { buildCarModels, createCarMaterials, disposeCarMaterials, disposeCarModels } from './carModels';
import { City } from './City';
import { Landmarks, type LandmarkTexts } from './Landmarks';
import { PlayerController } from './PlayerController';
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
  onLowPerformance: () => void;
  onContextLost: () => void;
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
  const assets = useUniverseAssets(quality);
  const towers = useMemo(() => cityTowers(quality), [quality]);
  const bridges = useMemo(() => skybridges(towers), [towers]);
  const solids = useMemo(() => citySolids(quality), [quality]);
  // Modelos e materiais dos carros: construídos uma vez, compartilhados por trânsito, voadores e carros do jogador.
  const carModels = useMemo(() => buildCarModels(), []);
  const carMaterials = useMemo(() => createCarMaterials(quality), [quality]);
  useEffect(() => () => disposeCarModels(carModels), [carModels]);
  useEffect(() => () => disposeCarMaterials(carMaterials), [carMaterials]);
  const half = 230;
  return (
    <>
      <color attach="background" args={['#070d17']} />
      <fog attach="fog" args={['#0c1730', 120, cfg.fog]} />
      <EnvironmentMap intensity={cfg.envIntensity} />
      <Sky assets={assets} quality={quality} />
      <hemisphereLight args={['#9fb8e0', '#0b1322', 0.85]} />
      <ambientLight intensity={0.22} />
      {/* Luar frio (sombras no médio e no alto) e um contraluz quente, discreto */}
      <directionalLight
        position={[-120, 170, 90]}
        intensity={1.25}
        color="#cfd9ff"
        castShadow={cfg.shadows > 0}
        shadow-mapSize={[cfg.shadows || 512, cfg.shadows || 512]}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-far={520}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[140, 50, -150]} intensity={0.4} color="#f2e8d5" />
      <City assets={assets} quality={quality} />
      <Towers assets={assets} quality={quality} towers={towers} />
      <Skybridges assets={assets} bridges={bridges} />
      <Billboards assets={assets} messages={props.billboards} animate={effects} />
      <Landmarks assets={assets} quality={quality} effects={effects} near={props.near} texts={props.texts} onSelect={props.onSelect} />
      <Traffic quality={quality} running={effects} runtime={runtime} models={carModels} materials={carMaterials} />
      <AirTraffic quality={quality} running={effects} materials={carMaterials} />
      <PlayerVehicles runtime={runtime} models={carModels} materials={carMaterials} assets={assets} effects={effects} />
      <Avatar runtime={runtime} effects={effects} />
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
  return (
    <Canvas
      key={props.quality}
      shadows={cfg.shadows > 0 ? 'percentage' : false}
      dpr={cfg.dpr}
      gl={{ antialias: cfg.antialias, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false }}
      camera={{ fov: 55, near: 0.2, far: cfg.far, position: [0, 6, 100] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
      }}
      className="!absolute inset-0"
    >
      <World {...props} />
      {props.quality !== 'low' && <PerformanceWatch onLow={props.onLowPerformance} />}
      <ContextLossWatcher onLost={props.onContextLost} />
    </Canvas>
  );
}
