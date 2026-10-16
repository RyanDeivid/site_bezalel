import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { EnvironmentMap } from '@/components/three/EnvironmentMap';
import { ContextLossWatcher, PerformanceWatch } from '@/components/three/watchers';
import { citySolids, skylineTowers, type PlaceId } from '../world/city';
import type { UniverseRuntime } from '../world/runtime';
import { useUniverseAssets, type Quality, type UniverseAssets } from './assets';
import { City } from './City';
import { Craft } from './Craft';
import { Landmarks, type LandmarkTexts } from './Landmarks';
import { Traffic } from './Traffic';

export interface UniverseSceneProps {
  runtime: UniverseRuntime;
  quality: Quality;
  /** Animações ambientes e trânsito (desligados com "Pausar" e com movimento reduzido). */
  effects: boolean;
  inputEnabled: boolean;
  near: PlaceId | null;
  texts: LandmarkTexts;
  onSelect: (id: PlaceId) => void;
  onNearChange: (id: PlaceId | null) => void;
  onAutopilotEnd: () => void;
  onLowPerformance: () => void;
  onContextLost: () => void;
}

/** Céu em domo + estrelas fixas (determinísticas). */
function Sky({ assets, quality }: { assets: UniverseAssets; quality: Quality }) {
  const stars = useMemo(() => {
    const count = quality === 'high' ? 1400 : 500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i * 137.508 * Math.PI) / 180;
      const elev = 0.12 + ((i * 7919) % 1000) / 1150;
      const r = 520;
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
        <sphereGeometry args={[600, 32, 16]} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial color="#f2e8d5" size={1.6} sizeAttenuation={false} transparent opacity={0.7} depthWrite={false} fog={false} />
      </points>
    </>
  );
}

function World(props: UniverseSceneProps) {
  const { quality, effects } = props;
  const hi = quality === 'high';
  const assets = useUniverseAssets(quality);
  const towers = useMemo(() => skylineTowers(quality), [quality]);
  const solids = useMemo(() => citySolids(quality), [quality]);
  return (
    <>
      <color attach="background" args={['#070d17']} />
      <fog attach="fog" args={['#0c1730', 110, hi ? 430 : 330]} />
      <EnvironmentMap intensity={hi ? 0.5 : 0.38} />
      <Sky assets={assets} quality={quality} />
      <hemisphereLight args={['#9fb8e0', '#0b1322', 0.85]} />
      <ambientLight intensity={0.22} />
      {/* Luar frio (sombras só na qualidade alta) e um contraluz quente, discreto */}
      <directionalLight
        position={[-90, 130, 70]}
        intensity={1.25}
        color="#cfd9ff"
        castShadow={hi}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-far={400}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[110, 40, -120]} intensity={0.4} color="#f2e8d5" />
      <City assets={assets} quality={quality} towers={towers} />
      <Landmarks assets={assets} quality={quality} effects={effects} near={props.near} texts={props.texts} onSelect={props.onSelect} />
      <Traffic assets={assets} quality={quality} running={effects} />
      <Craft
        runtime={props.runtime}
        assets={assets}
        solids={solids}
        inputEnabled={props.inputEnabled}
        effects={effects}
        onNearChange={props.onNearChange}
        onAutopilotEnd={props.onAutopilotEnd}
      />
    </>
  );
}

/**
 * Cena 3D do Bezalel Universe (three.js + React Three Fiber). Este módulo e
 * suas dependências formam um chunk próprio, baixado só quando o visitante
 * escolhe pilotar em 3D. Trocar a qualidade recria o canvas (`key`), o que
 * descarta e recria todos os recursos da GPU de forma previsível.
 */
export default function UniverseScene(props: UniverseSceneProps) {
  const hi = props.quality === 'high';
  return (
    <Canvas
      key={props.quality}
      shadows={hi ? 'percentage' : false}
      dpr={hi ? [1, 1.75] : 1}
      gl={{ antialias: hi, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false }}
      camera={{ fov: 55, near: 0.3, far: 900, position: [0, 12, 100] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
      }}
      className="!absolute inset-0"
    >
      <World {...props} />
      {hi && <PerformanceWatch onLow={props.onLowPerformance} />}
      <ContextLossWatcher onLost={props.onContextLost} />
    </Canvas>
  );
}
