import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { readStorage } from '@/lib/storage';
import { ContextLossWatcher } from '@/components/three/watchers';
import { cityTowers, citySolids, skybridges, type PlaceId, type Quality } from '../world/city';
import { softwareWebGL } from '@/hooks/useDeviceProfile';
import { QUALITY_CONFIG, renderConfig } from './quality';
import type { UniverseRuntime } from '../world/runtime';
import { AirTraffic } from './AirTraffic';
import { useUniverseAssets } from './assets';
import { PerformanceGovernor } from './PerformanceGovernor';
import { settledDpr } from './perfState';
import { Avatar } from './Avatar';
import { Billboards, Skybridges, Towers } from './Buildings';
import { buildCarModels, buildFarCarModels, buildTrafficCarModels, createCarMaterials, disposeCarMaterials, disposeCarModels, disposeFarCarModels, disposeTrafficCarModels } from './carModels';
import { ArrivalPark } from './ArrivalPark';
import { City } from './City';
import { Landmarks, type LandmarkTexts } from './Landmarks';
import { Pedestrians } from './Pedestrians';
import { PerfProbe } from './PerfProbe';
import { Warmup } from './Warmup';
import { PlayerController } from './PlayerController';
import { PostFX } from './PostFX';
import { headlightBeam } from './lightDecals';
import { Soundscape } from './Soundscape';
import { Sun } from './Sun';
import { Traffic } from './Traffic';
import { mergeStatic } from './staticMerge';
import { PlayerVehicles } from './Vehicles';

export interface UniverseSceneProps {
  runtime: UniverseRuntime;
  quality: Quality;
  /** Animações ambientes e trânsito (desligados com "Pausar" e com movimento reduzido). */
  effects: boolean;
  /** Câmera calma (movimento reduzido): sem mudança de campo de visão nem tremor. */
  calmCamera: boolean;
  /** Modo apresentação: esconde os marcadores dos locais (feixes, losangos e nomes). */
  presenting?: boolean;
  /** Som da cidade ligado. */
  sound?: boolean;
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
  /** A cena deste nível ficou pronta (recebe o nível, para a página saber qual). */
  onReady: (quality: Quality) => void;
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

const World = memo(function World(props: UniverseSceneProps) {
  const { quality: render, effects, runtime } = props;
  const cfg = renderConfig(render, softwareWebGL());
  // Conteúdo × desenho. O que existe na cidade (densidade de torres, fachadas detalhadas, árvores, holofotes,
  // trânsito, pedestres, texturas de 1024 px) é o do Ultra em qualquer nível: medido num celular emulado, o
  // gargalo é o processador (chamadas de desenho), e esse conteúdo entra em malhas já juntas ou instanciadas —
  // custa triângulos, não chamadas. Os níveis mudam o desenho: resolução, mapa de sombras, brilho. Sem placa
  // de vídeo (WebGL por software: CI, aparelhos sem aceleração), a cidade leve de antes.
  const quality: Quality = softwareWebGL() ? 'low' : 'ultra';
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const assets = useUniverseAssets(quality, Math.min(cfg.anisotropy, maxAniso));
  const dynamicShadows = !cfg.shadowCache;
  const towers = useMemo(() => cityTowers(quality), [quality]);
  const bridges = useMemo(() => skybridges(towers), [towers]);
  const solids = useMemo(() => citySolids(quality), [quality]);
  // Modelos e materiais dos carros: construídos uma vez, compartilhados por trânsito, voadores e carros do jogador.
  // Três níveis de detalhe dos carros: completo (o do jogador e os estacionados de perto), intermediário
  // (o trânsito de perto, instanciado) e o de longe (3 malhas).
  const carModels = useMemo(() => buildCarModels('near'), []);
  const midCarModels = useMemo(() => buildCarModels('mid'), []);
  const trafficCarModels = useMemo(() => buildTrafficCarModels(), []);
  // Facho dos faróis no asfalto (trânsito e carro em uso), da Média para cima.
  const beam = useMemo(() => (cfg.lightPools ? headlightBeam() : null), [cfg.lightPools]);
  useEffect(
    () => () => {
      beam?.geometry.dispose();
      beam?.material.dispose();
      beam?.texture.dispose();
    },
    [beam],
  );
  const farCarModels = useMemo(() => buildFarCarModels(), []);
  const carMaterials = useMemo(() => createCarMaterials(render), [render]);
  useEffect(() => () => disposeCarModels(carModels), [carModels]);
  useEffect(() => () => disposeCarModels(midCarModels), [midCarModels]);
  useEffect(() => () => disposeTrafficCarModels(trafficCarModels), [trafficCarModels]);
  useEffect(() => () => disposeFarCarModels(farCarModels), [farCarModels]);
  useEffect(() => () => disposeCarMaterials(carMaterials), [carMaterials]);
  return (
    <>
      <color attach="background" args={[SKY.fog]} />
      {/* Névoa exponencial na cor do horizonte: a cidade se dissolve no brilho dela, em profundidade. */}
      <fogExp2 attach="fog" args={[SKY.fog, cfg.fogDensity]} />
      {/* O mapa de reflexos é gerado no Warmup, sem travar a página. */}
      <Sky quality={render} />
      {/* Luz em papéis: luar frio (principal, com sombras que acompanham a câmera), céu frio por cima e o
          rebote quente da rua por baixo (hemisfério), e um contraluz quente e baixo que recorta as silhuetas. */}
      <hemisphereLight args={['#8ea2d6', '#403c3e', 0.85]} />
      <ambientLight intensity={0.06} />
      <Sun mapSize={cfg.shadows} range={cfg.shadowRange} every={cfg.shadowEvery} cached={cfg.shadowCache} />
      <directionalLight position={[150, 38, -160]} intensity={0.5} color="#ffcfae" />
      {/* Grupos com nome: a sonda de desempenho liga e desliga cada parte para medir o custo dela. */}
      <StaticBatch name="city" deps={[quality, assets, cfg.lightPools]}>
        <City assets={assets} quality={quality} pools={cfg.lightPools} animate={effects} />
        <ArrivalPark assets={assets} quality={quality} />
      </StaticBatch>
      <group name="towers">
        <Towers assets={assets} quality={quality} towers={towers} />
        <Skybridges assets={assets} bridges={bridges} />
      </group>
      <group name="billboards">
        <Billboards assets={assets} messages={props.billboards} animate={effects} />
      </group>
      <group name="landmarks">
        <Landmarks assets={assets} quality={quality} effects={effects} near={props.near} markers={!props.presenting} texts={props.texts} onSelect={props.onSelect} />
      </group>
      <group name="traffic">
        <Traffic quality={quality} running={effects} runtime={runtime} models={trafficCarModels} farModels={farCarModels} materials={carMaterials} lodDistance={cfg.carLod} shadows={dynamicShadows} beam={beam} />
      </group>
      {/* Depois do trânsito: os pedestres entram na lista de corpos que ele zera a cada quadro. */}
      <group name="pedestrians">
        <Pedestrians quality={quality} runtime={runtime} running={effects} shadows={dynamicShadows} />
      </group>
      <group name="air">
        <AirTraffic quality={quality} running={effects} materials={carMaterials} lodDistance={cfg.airLod} shadows={dynamicShadows} />
      </group>
      <group name="player">
        <PlayerVehicles runtime={runtime} models={carModels} midModels={midCarModels} farModels={farCarModels} materials={carMaterials} assets={assets} effects={effects} lodDistance={cfg.carLod * 0.6} beam={beam} shadows={dynamicShadows} />
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
});

/**
 * Cena 3D do Bezalel Universe (three.js + React Three Fiber). Este módulo e
 * suas dependências formam um chunk próprio, baixado só quando o visitante
 * entra no 3D. Trocar a qualidade recria o canvas (`key`), descartando e
 * recriando todos os recursos da GPU de forma previsível; sair da página
 * desmonta o canvas (o R3F encerra o laço de quadros e libera o contexto).
 */
/**
 * Memorizada: a página atualiza o HUD várias vezes por segundo, e cada nova renderização daqui faria o
 * React reconciliar a cidade inteira (centenas de elementos) — um quadro perdido a cada atualização.
 */
export default memo(function UniverseScene(props: UniverseSceneProps) {
  const cfg = renderConfig(props.quality, softwareWebGL());
  // Resolução: começa no que a tela pede (dentro da faixa do nível) e a AdaptiveResolution ajusta.
  // Só o Ultra sobe além da tela (superamostragem), e só se o aparelho aguentar.
  const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  // A Baixa começa em 85% (aparelho modesto: melhor começar folgado; a resolução adaptativa sobe se sobrar).
  // Numa nova entrada na mesma sessão, começa na resolução em que o aparelho já se firmou (sem os degraus
  // do início, cada um uma pequena travada).
  const settled = props.debug && readStorage('bz-universe-governor') === 'off' ? null : settledDpr(props.quality);
  const naturalDpr = Math.max(cfg.dprMin, Math.min(cfg.dprMax, device) * (props.quality === 'low' ? 0.85 : 1));
  // Com o brilho, o canvas fica na resolução da tela e a resolução firmada vira a escala interna da cena
  // (resolução dinâmica, sem realocar o canvas); sem ele (Baixa), o canvas já nasce na resolução firmada.
  const firm = settled === null ? null : Math.max(cfg.dprMin, Math.min(cfg.dprMax, settled));
  const startDpr = cfg.bloom ? naturalDpr : (firm ?? naturalDpr);
  const startScale = cfg.bloom && firm !== null ? Math.min(1, firm / naturalDpr) : 1;
  // A Baixa pode subir dos 85% do início até o teto do nível se o aparelho tiver folga (antes o teto era o
  // próprio valor inicial: a resolução adaptativa nunca subia, e a Baixa ficava sempre borrada).
  const maxDpr = props.quality === 'ultra' ? cfg.dprMax : props.quality === 'low' ? Math.max(naturalDpr, Math.min(cfg.dprMax, device)) : naturalDpr;
  // O Canvas reaplica o `dpr` a cada renderização: passar sempre o valor inicial desfazia o ajuste da
  // resolução adaptativa toda vez que a cena renderizava de novo (entrar na apresentação, chegar perto de
  // um local...). Aqui vai sempre a resolução atual, espelhada de dentro do Canvas.
  const [seenDpr, setSeenDpr] = useState<{ quality: Quality; value: number } | null>(null);
  const currentDpr = seenDpr?.quality === props.quality ? seenDpr.value : startDpr;
  return (
    <Canvas
      key={props.quality}
      // Parado até o Warmup compilar os shaders e enviar as texturas (sem tela congelada na entrada).
      frameloop="never"
      shadows={cfg.shadows > 0 ? 'percentage' : false}
      dpr={currentDpr}
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
      <DprMirror quality={props.quality} onChange={setSeenDpr} />
      <World {...props} />
      <Soundscape runtime={props.runtime} enabled={props.sound ?? true} debug={props.debug} />
      {cfg.bloom && <PostFX {...cfg.bloom} multisample={cfg.antialias} scale={startScale} />}
      <Warmup envIntensity={QUALITY_CONFIG[props.quality].envIntensity} envSize={QUALITY_CONFIG[props.quality].envSize} onReady={() => props.onReady(props.quality)} />
      <PerformanceGovernor level={props.quality} min={cfg.dprMin} max={maxDpr} canUpgrade={props.canUpgrade} probation={props.probation} onLow={props.onLowPerformance} onHeadroom={props.onHeadroom} off={props.debug && readStorage('bz-universe-governor') === 'off'} debug={props.debug} />
      <ContextLossWatcher onLost={props.onContextLost} />
      {props.debug && <PerfProbe />}
    </Canvas>
  );
});

/** Avisa a resolução atual do Canvas (que a resolução adaptativa muda), para a próxima renderização mantê-la. */
function DprMirror({ quality, onChange }: { quality: Quality; onChange: (v: { quality: Quality; value: number }) => void }) {
  const value = useThree((s) => s.viewport.dpr);
  useEffect(() => onChange({ quality, value }), [quality, value, onChange]);
  return null;
}

/**
 * Um grupo estático: depois de montado (os filhos montam antes), as peças que
 * compartilham material viram uma malha só (`mergeStatic`) — menos chamadas de
 * desenho, o que mais pesa no processador de um celular.
 */
function StaticBatch({ name, deps, children }: { name: string; deps: unknown[]; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => (ref.current ? mergeStatic(ref.current) : undefined), deps);
  return (
    <group ref={ref} name={name}>
      {children}
    </group>
  );
}

