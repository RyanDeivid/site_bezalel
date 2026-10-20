import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { readStorage } from '@/lib/storage';
import { ContextLossWatcher } from '@/components/three/watchers';
import { cityTowers, citySolids, skybridges, type PlaceId, type Quality } from '../world/city';
import { QUALITY_CONFIG } from './quality';
import type { UniverseRuntime } from '../world/runtime';
import { AirTraffic } from './AirTraffic';
import { useUniverseAssets } from './assets';
import { PerformanceGovernor } from './PerformanceGovernor';
import { Avatar } from './Avatar';
import { Billboards, Skybridges, Towers } from './Buildings';
import { buildCarModels, buildFarCarModels, createCarMaterials, disposeCarMaterials, disposeCarModels, disposeFarCarModels } from './carModels';
import { City } from './City';
import { Landmarks, type LandmarkTexts } from './Landmarks';
import { PerfProbe } from './PerfProbe';
import { Warmup } from './Warmup';
import { PlayerController } from './PlayerController';
import { PostFX } from './PostFX';
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

/** Cores do céu noturno: zênite profundo, azul do meio e o brilho da cidade no horizonte (a mesma cor da névoa). */
const SKY = { zenith: '#04070f', mid: '#0b1631', horizon: '#3a3554', glow: '#6b4c5e', fog: '#1a2140' };

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // sempre no fundo
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 glow; uniform vec3 fogColor;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 c = mix(horizon, mid, smoothstep(0.02, 0.32, h));
  c = mix(c, zenith, smoothstep(0.3, 0.95, h));
  // Brilho quente da cidade, colado ao horizonte; abaixo dele, a cor da névoa (o chão some nela).
  c += glow * exp(-abs(h) * 14.0) * 0.55;
  c = mix(fogColor, c, smoothstep(-0.06, 0.02, h));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * Céu: um domo que acompanha a câmera (nunca fica além do alcance dela — antes,
 * na vista do alto, o lado oposto do domo era recortado e aparecia como um
 * círculo escuro), com gradiente do zênite ao brilho da cidade no horizonte, e
 * estrelas fixas só acima da linha do horizonte.
 */
function Sky({ quality }: { quality: Quality }) {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: {
          zenith: { value: new THREE.Color(SKY.zenith) },
          mid: { value: new THREE.Color(SKY.mid) },
          horizon: { value: new THREE.Color(SKY.horizon) },
          glow: { value: new THREE.Color(SKY.glow) },
          fogColor: { value: new THREE.Color(SKY.fog) },
        },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const stars = useMemo(() => {
    const count = QUALITY_CONFIG[quality].stars;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i * 137.508 * Math.PI) / 180;
      const elev = 0.18 + ((i * 7919) % 1000) / 1100;
      pos[i * 3] = Math.cos(a) * Math.cos(elev) * 90;
      pos[i * 3 + 1] = Math.sin(elev) * 90;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(elev) * 90;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [quality]);
  useEffect(() => () => [stars, material].forEach((x) => x.dispose()), [stars, material]);
  useFrame(({ camera }) => group.current?.position.copy(camera.position));
  return (
    <group ref={group}>
      <mesh material={material} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[100, 32, 16]} />
      </mesh>
      <points geometry={stars} renderOrder={-9} frustumCulled={false}>
        <pointsMaterial color="#e9e4f2" size={1.5} sizeAttenuation={false} transparent opacity={0.65} depthWrite={false} fog={false} />
      </points>
    </group>
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
      <color attach="background" args={[SKY.fog]} />
      {/* Névoa exponencial na cor do horizonte: a cidade se dissolve no brilho dela, em profundidade. */}
      <fogExp2 attach="fog" args={[SKY.fog, cfg.fogDensity]} />
      {/* O mapa de reflexos é gerado no Warmup, sem travar a página. */}
      <Sky quality={quality} />
      {/* Luz em papéis: luar frio (principal, com sombras que acompanham a câmera), céu frio por cima e o
          rebote quente da rua por baixo (hemisfério), e um contraluz quente e baixo que recorta as silhuetas. */}
      <hemisphereLight args={['#8ea2d6', '#403c3e', 0.85]} />
      <ambientLight intensity={0.06} />
      <Sun mapSize={cfg.shadows} range={cfg.shadowRange} every={cfg.shadowEvery} />
      <directionalLight position={[150, 38, -160]} intensity={0.5} color="#ffcfae" />
      {/* Grupos com nome: a sonda de desempenho liga e desliga cada parte para medir o custo dela. */}
      <group name="city">
        <City assets={assets} quality={quality} pools={cfg.lightPools} />
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
  // A Baixa começa em 85% (aparelho modesto: melhor começar folgado; a resolução adaptativa sobe se sobrar).
  const startDpr = Math.max(cfg.dprMin, Math.min(cfg.dprMax, device) * (props.quality === 'low' ? 0.85 : 1));
  const maxDpr = props.quality === 'ultra' ? cfg.dprMax : startDpr;
  return (
    <Canvas
      key={props.quality}
      // Parado até o Warmup compilar os shaders e enviar as texturas (sem tela congelada na entrada).
      frameloop="never"
      shadows={cfg.shadows > 0 ? 'percentage' : false}
      dpr={startDpr}
      // Com brilho, o antisserrilhado (MSAA) é feito na textura HDR da cena, não na tela.
      gl={{ antialias: cfg.antialias && !cfg.bloom, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false }}
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
      {cfg.bloom && <PostFX {...cfg.bloom} samples={cfg.antialias ? 4 : 0} />}
      <Warmup envIntensity={QUALITY_CONFIG[props.quality].envIntensity} envSize={QUALITY_CONFIG[props.quality].envSize} onReady={props.onReady} />
      <PerformanceGovernor min={cfg.dprMin} max={maxDpr} canUpgrade={props.canUpgrade} probation={props.probation} onLow={props.onLowPerformance} onHeadroom={props.onHeadroom} off={props.debug && readStorage('bz-universe-governor') === 'off'} debug={props.debug} />
      <ContextLossWatcher onLost={props.onContextLost} />
      {props.debug && <PerfProbe />}
    </Canvas>
  );
}
