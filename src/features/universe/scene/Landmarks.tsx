import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import { drawLabel, makeCanvasTexture } from '@/features/lab/scene/textures';
import { STATION_ORDER } from '@/features/lab/layout';
import { atLeast, cubeOnVertex, MONUMENT, PLACES, type PlaceId } from '../world/city';
import type { Quality, UniverseAssets } from './assets';
import { boxWithMeterUVs, panelTexture, PALETTE, signTexture } from './textures';
import { mergeStatic } from './staticMerge';

export interface LandmarkTexts {
  names: Record<PlaceId, string>;
  /** Painel do laboratório (números reais: agentes do site e cursos verificados). */
  labPanel: { title: string; lines: string[]; footer: string };
  /** Painel do centro de produtos (produtos reais do site). */
  productsPanel: { title: string; lines: string[]; footer: string };
  hqSign: string;
  productsSign: string;
}

interface Props {
  assets: UniverseAssets;
  quality: Quality;
  effects: boolean;
  near: PlaceId | null;
  texts: LandmarkTexts;
  onSelect: (id: PlaceId) => void;
}

/** Lado do cubo da coroa da sede e altura do centro do cubo do monumento. */
const CROWN = 10;
const MONUMENT_Y = MONUMENT.pedestal + MONUMENT.gap + cubeOnVertex(MONUMENT.size).height / 2 + 0.36;

/** Clique curto (não arraste de câmera) abre o local. */
const clickTo = (onSelect: (id: PlaceId) => void, id: PlaceId) => (e: ThreeEvent<MouseEvent>) => {
  if (e.delta > 6) return;
  e.stopPropagation();
  onSelect(id);
};
const hover = (on: boolean) => () => {
  document.body.style.cursor = on ? 'pointer' : '';
};
const pointer = (onSelect: (id: PlaceId) => void, id: PlaceId) => ({ onClick: clickTo(onSelect, id), onPointerOver: hover(true), onPointerOut: hover(false) });

/** Cubo do símbolo Bezalel: face dourada (Descobrir), de camadas (Aprender) e de aço (Construir). */
function useMarkCube(assets: UniverseAssets) {
  return useMemo(() => {
    const m = assets.materials;
    // Ordem das faces: +x, -x, +y, -y, +z, -z. As três que se encontram no vértice de
    // cima (+x, +y, +z) são as da marca: camadas (Aprender), dourada (Descobrir) e aço (Construir).
    const materials = [m.layers, m.steelLight, m.gold, m.stone, m.steelLight, m.layers];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineBasicMaterial({ color: PALETTE.goldLight, toneMapped: false });
    return { materials, geo, edges, line };
  }, [assets]);
}

/** Gira o cubo para a diagonal (1, 1, 1) apontar para cima: ele fica apoiado num vértice. */
const ON_VERTEX = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 1, 0));

function MarkCube({ size, cube }: { size: number; cube: ReturnType<typeof useMarkCube> }) {
  return (
    <group quaternion={ON_VERTEX} scale={size}>
      <mesh geometry={cube.geo} material={cube.materials} castShadow />
      <lineSegments geometry={cube.edges} material={cube.line} />
    </group>
  );
}

/** Descarta a textura quando ela for trocada ou a cena sair. */
function useDisposable<T extends { dispose: () => void }>(t: T): T {
  useEffect(() => () => t.dispose(), [t]);
  return t;
}

export function Landmarks({ assets, quality, effects, near, texts, onSelect }: Props) {
  const m = assets.materials;
  const hi = atLeast(quality, 'high');
  const cube = useMarkCube(assets);
  useEffect(() => () => {
    cube.geo.dispose();
    cube.edges.dispose();
    cube.line.dispose();
    document.body.style.cursor = '';
  }, [cube]);

  // Materiais próprios dos marcos (saguão iluminado, colunas dos agentes).
  const local = useMemo(
    () => ({
      core: new THREE.MeshBasicMaterial({ color: PALETTE.blueSoft, transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }),
      agents: STATION_ORDER.map((id) => new THREE.MeshBasicMaterial({ color: AGENT_HEX[id], toneMapped: false })),
      lattice: new THREE.LineBasicMaterial({ color: PALETTE.blueSoft, toneMapped: false, transparent: true, opacity: 0.9 }),
    }),
    [],
  );
  const lattice = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(4.6, 1)), []);
  useEffect(
    () => () => {
      local.core.dispose();
      local.lattice.dispose();
      local.agents.forEach((a) => a.dispose());
      lattice.dispose();
    },
    [local, lattice],
  );

  const tex = atLeast(assets.quality, 'high') ? 1 : 0.5;
  const hqSign = useDisposable(useMemo(() => signTexture(texts.hqSign, 1024 * tex, 160 * tex), [texts.hqSign, tex]));
  const productsSign = useDisposable(useMemo(() => signTexture(texts.productsSign, 1024 * tex, 160 * tex), [texts.productsSign, tex]));
  const labPanel = useDisposable(useMemo(() => panelTexture(texts.labPanel.title, texts.labPanel.lines, texts.labPanel.footer, PALETTE.blueSoft), [texts.labPanel]));
  const productsPanel = useDisposable(
    useMemo(() => panelTexture(texts.productsPanel.title, texts.productsPanel.lines, texts.productsPanel.footer, PALETTE.gold, 1280, 760), [texts.productsPanel]),
  );

  // Geometrias com UVs em metros (janelas sem esticar).
  const geos = useMemo(
    () => ({
      hqTower: boxWithMeterUVs(22, 49, 16),
      hqPodium: boxWithMeterUVs(40, 9.6, 26, 6, 3),
      hqLobby: boxWithMeterUVs(30, 6, 0.4, 12, 6),
      prodBase: boxWithMeterUVs(36, 9.7, 30, 6, 3),
      prodLobby: boxWithMeterUVs(0.4, 6.4, 22, 12, 6.4),
      prodMid: boxWithMeterUVs(30, 10, 24),
      prodTop: boxWithMeterUVs(24, 10, 20),
    }),
    [],
  );
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  // Animações discretas (pausam com "Pausar animações" e com movimento reduzido).
  const monument = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const latticeRef = useRef<THREE.LineSegments>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!effects) return;
    t.current += Math.min(dt, 0.05);
    const k = t.current;
    if (monument.current) {
      monument.current.rotation.y = k * 0.18;
      monument.current.position.y = MONUMENT_Y + Math.sin(k * 0.9) * 0.25;
    }
    if (halo.current) halo.current.rotation.z = k * 0.12;
    if (latticeRef.current) latticeRef.current.rotation.set(k * 0.15, k * 0.22, 0);
    if (beacon.current) beacon.current.visible = Math.sin(k * 3) > -0.2;
  });

  // Fachada principal voltada para a praça; aletas de bronze nas faces norte e sul da torre.
  const fins = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let x = -9.9; x <= 9.9; x += 2.2) for (const z of [-73.7, -90.3]) out.push(new THREE.Matrix4().makeTranslation(x, 33.5, z));
    for (let z = -88; z <= -76; z += 2.4) for (const x of [-11.3, 11.3]) out.push(new THREE.Matrix4().makeTranslation(x, 33.5, z).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
    return out;
  }, []);
  const finRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    fins.forEach((mx, i) => finRef.current?.setMatrixAt(i, mx));
    if (finRef.current) finRef.current.instanceMatrix.needsUpdate = true;
  }, [fins]);

  const octa = (r: number) => Array.from({ length: 8 }, (_, i) => ({ x: r * Math.sin((i * Math.PI) / 4), z: r * Math.cos((i * Math.PI) / 4) }));

  // Peças estáticas juntadas numa malha por material (menos chamadas de desenho); as animadas
  // e os marcadores dos locais têm `userData.dynamic` e ficam como estão.
  const root = useRef<THREE.Group>(null);
  useLayoutEffect(() => (root.current ? mergeStatic(root.current) : undefined), [quality, geos, hqSign, productsSign, labPanel, productsPanel]);

  return (
    <group ref={root}>
      {/* ---------------- Sede Bezalel ---------------- */}
      <group {...pointer(onSelect, 'bezalel-hq')}>
        <mesh geometry={geos.hqPodium} material={m.podiumDark} position={[0, 4.8, -80]} castShadow={hi} receiveShadow />
        <mesh geometry={geos.hqLobby} material={m.storefront} position={[0, 3.3, -66.9]} />
        {/* Marquise da entrada, com filete dourado, e pórtico em bronze */}
        <mesh material={m.steel} position={[0, 6.7, -63.4]} castShadow={hi}>
          <boxGeometry args={[16, 0.45, 7]} />
        </mesh>
        <mesh material={m.glowGold} position={[0, 6.45, -59.95]}>
          <boxGeometry args={[15.6, 0.08, 0.12]} />
        </mesh>
        {[-7.4, 7.4].map((x) => (
          <mesh key={x} material={m.bronze} position={[x, 3.4, -60.4]} castShadow={hi}>
            <boxGeometry args={[0.7, 6.7, 0.7]} />
          </mesh>
        ))}
        <mesh position={[0, 8, -66.6]}>
          <planeGeometry args={[18, 2.8]} />
          <meshBasicMaterial map={hqSign} transparent toneMapped={false} depthWrite={false} />
        </mesh>
        {/* Torre: fachada de vidro com janelas, aletas e cantos iluminados */}
        <mesh geometry={geos.hqTower} material={m.facadeHq} position={[0, 33.5, -82]} castShadow={hi} />
        <instancedMesh ref={finRef} args={[undefined, m.bronze, fins.length]} castShadow={hi}>
          <boxGeometry args={[0.35, 49, 0.7]} />
        </instancedMesh>
        {[
          [-11.05, -73.95],
          [11.05, -73.95],
          [-11.05, -90.05],
          [11.05, -90.05],
        ].map(([x, z]) => (
          <mesh key={`${x},${z}`} material={m.glowGoldSoft} position={[x!, 33.5, z!]}>
            <boxGeometry args={[0.16, 49, 0.16]} />
          </mesh>
        ))}
        <mesh material={m.steel} position={[0, 58.3, -82]}>
          <boxGeometry args={[23, 0.6, 17]} />
        </mesh>
        {/* Coroa: o cubo do símbolo sobre um plinto, com um halo dourado */}
        <mesh material={m.steel} position={[0, 59.4, -82]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[9, 1.6, 9]} />
        </mesh>
        <group position={[0, 60.2 + cubeOnVertex(CROWN).height / 2, -82]}>
          <MarkCube size={CROWN} cube={cube} />
          <mesh ref={halo} rotation={[Math.PI / 2, 0, 0]} material={m.glowGold} userData={{ dynamic: true }}>
            <torusGeometry args={[cubeOnVertex(CROWN).radius + 1.2, 0.09, 6, hi ? 128 : 64]} />
          </mesh>
        </group>
      </group>

      {/* ---------------- Laboratório de IA ---------------- */}
      <group {...pointer(onSelect, 'ai-lab')}>
        <mesh material={m.stone} position={[80, 0.9, 0]} receiveShadow>
          <cylinderGeometry args={[17, 17.4, 1.2, 8]} />
        </mesh>
        {/* Salão de vidro octogonal */}
        <mesh material={m.glass} position={[80, 9.5, 0]}>
          <cylinderGeometry args={[13, 13, 16, 8, 1, true]} />
        </mesh>
        {octa(13).map((p, i) => (
          <mesh key={i} material={m.steel} position={[80 + p.x, 9.5, p.z]} castShadow={hi}>
            <boxGeometry args={[0.35, 16, 0.35]} />
          </mesh>
        ))}
        {[1.7, 9.5, 17.4].map((y) => (
          <mesh key={y} material={m.steel} position={[80, y, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]}>
            <torusGeometry args={[13 / Math.cos(Math.PI / 8) - 0.02, 0.14, 4, 8]} />
          </mesh>
        ))}
        {/* Pisos internos com borda luminosa */}
        {[6.2, 11.6].map((y) => (
          <group key={y}>
            <mesh material={m.stone} position={[80, y, 0]}>
              <cylinderGeometry args={[11.6, 11.6, 0.3, 8]} />
            </mesh>
            <mesh material={m.glowBlue} position={[80, y + 0.17, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]}>
              <torusGeometry args={[11.6 / Math.cos(Math.PI / 8), 0.05, 3, 8]} />
            </mesh>
          </group>
        ))}
        {/* Núcleo: treliça (rede neural) girando e as seis colunas, uma por agente da Bezalel */}
        <mesh material={m.darkGlass} position={[80, 9.5, 0]}>
          <cylinderGeometry args={[1.1, 1.1, 15, 12]} />
        </mesh>
        <mesh material={local.core} position={[80, 9.5, 0]}>
          <sphereGeometry args={[2.6, 24, 16]} />
        </mesh>
        <lineSegments ref={latticeRef} geometry={lattice} material={local.lattice} position={[80, 9.5, 0]} />
        {local.agents.map((mat, i) => {
          const a = (i / local.agents.length) * Math.PI * 2;
          return (
            <mesh key={i} material={mat} position={[80 + Math.cos(a) * 7.5, 9, Math.sin(a) * 7.5]}>
              <cylinderGeometry args={[0.22, 0.22, 13, 8]} />
            </mesh>
          );
        })}
        {/* Cobertura com anel de luz, mastro e farol */}
        <mesh material={m.steel} position={[80, 17.9, 0]} castShadow={hi}>
          <cylinderGeometry args={[13.5, 13.5, 0.8, 8]} />
        </mesh>
        <mesh material={m.glowBlue} position={[80, 18.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[9.5, 0.12, 4, 48]} />
        </mesh>
        <mesh material={m.steel} position={[80, 21.3, 0]}>
          <cylinderGeometry args={[0.18, 0.3, 6, 6]} />
        </mesh>
        <mesh ref={beacon} material={m.glowBlue} position={[80, 24.4, 0]} userData={{ dynamic: true }}>
          <sphereGeometry args={[0.35, 12, 8]} />
        </mesh>
        {/* Pórtico de entrada (oeste) */}
        {[-4.2, 4.2].map((z) => (
          <mesh key={z} material={m.bronze} position={[66.2, 3.9, z]} castShadow={hi}>
            <boxGeometry args={[0.8, 7, 0.8]} />
          </mesh>
        ))}
        <mesh material={m.bronze} position={[66.2, 7.6, 0]}>
          <boxGeometry args={[0.8, 0.6, 9.2]} />
        </mesh>
        <mesh material={m.glowBlue} position={[65.75, 7.3, 0]}>
          <boxGeometry args={[0.06, 0.08, 8.4]} />
        </mesh>
        {/* Painel informativo ao lado da entrada */}
        <group position={[63.5, 0, -12]} rotation={[0, -Math.PI / 2, 0]}>
          {[-2.6, 2.6].map((x) => (
            <mesh key={x} material={m.steel} position={[x, 2, 0]}>
              <boxGeometry args={[0.18, 4, 0.18]} />
            </mesh>
          ))}
          <mesh position={[0, 3.3, 0.1]}>
            <planeGeometry args={[6, 3.75]} />
            <meshBasicMaterial map={labPanel} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* ---------------- Centro de Produtos ---------------- */}
      <group {...pointer(onSelect, 'products-center')}>
        <mesh geometry={geos.prodBase} material={m.podiumLight} position={[-80, 5.15, 0]} castShadow={hi} receiveShadow />
        <mesh geometry={geos.prodLobby} material={m.storefront} position={[-61.9, 3.6, 0]} />
        <mesh geometry={geos.prodMid} material={m.facadeB} position={[-83, 15, 2]} castShadow={hi} />
        <mesh geometry={geos.prodTop} material={m.facadeA} position={[-78, 25, -2]} castShadow={hi} />
        {/* Filetes dourados nas lajes de cada galeria */}
        {[
          { x: -80, z: 0, w: 36, d: 30, y: 10.05 },
          { x: -83, z: 2, w: 30, d: 24, y: 20.05 },
          { x: -78, z: -2, w: 24, d: 20, y: 30.05 },
        ].map((f) => (
          <mesh key={f.y} material={m.glowGoldSoft} position={[f.x, f.y, f.z]}>
            <boxGeometry args={[f.w + 0.2, 0.14, f.d + 0.2]} />
          </mesh>
        ))}
        {/* Marquise em balanço e letreiro */}
        <mesh material={m.steel} position={[-58.6, 7.2, 0]} castShadow={hi}>
          <boxGeometry args={[7, 0.4, 14]} />
        </mesh>
        <mesh material={m.glowGold} position={[-55.1, 6.98, 0]}>
          <boxGeometry args={[0.12, 0.08, 13.6]} />
        </mesh>
        <mesh position={[-61.6, 8.6, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[16, 2.5]} />
          <meshBasicMaterial map={productsSign} transparent toneMapped={false} depthWrite={false} />
        </mesh>
        {/* Vitrine: os produtos reais do site, na fachada leste da galeria do meio */}
        <mesh position={[-67.85, 15, 2]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[16, 9.5]} />
          <meshBasicMaterial map={productsPanel} toneMapped={false} />
        </mesh>
      </group>

      {/* ---------------- Monumento da praça ---------------- */}
      <group {...pointer(onSelect, 'plaza')}>
        <mesh material={m.stone} position={[0, MONUMENT.pedestal / 2 + 0.36, 0]} castShadow={hi}>
          <cylinderGeometry args={[3.4, 3.9, MONUMENT.pedestal, 8]} />
        </mesh>
        <mesh material={m.glowGold} position={[0, MONUMENT.pedestal + 0.3, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]}>
          <torusGeometry args={[3.45 / Math.cos(Math.PI / 8), 0.07, 3, 8]} />
        </mesh>
        <group ref={monument} position={[0, MONUMENT_Y, 0]} userData={{ dynamic: true }}>
          <MarkCube size={MONUMENT.size} cube={cube} />
        </group>
        <pointLight position={[0, MONUMENT.pedestal + 1.2, 0]} color={PALETTE.gold} intensity={hi ? 60 : 30} distance={34} decay={1.6} />
      </group>

      {/* ---------------- Helipontos e marcadores dos locais ---------------- */}
      {PLACES.map((p, i) => (
        <PlaceMarker
          key={p.id}
          place={p.id}
          x={p.pad.x}
          z={p.pad.z}
          ground={p.id === 'plaza' ? 0.42 : 0.4}
          name={texts.names[p.id]}
          active={near === p.id}
          assets={assets}
          scale={tex}
          index={i}
          effects={effects}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function PlaceMarker(props: {
  place: PlaceId;
  x: number;
  z: number;
  ground: number;
  name: string;
  active: boolean;
  assets: UniverseAssets;
  scale: number;
  index: number;
  effects: boolean;
  onSelect: (id: PlaceId) => void;
}) {
  const m = props.assets.materials;
  // Losango girando e flutuando: indica que o local é interativo (além do nome e do feixe).
  const marker = useRef<THREE.Group>(null);
  const t = useRef(props.index);
  useFrame((_, dt) => {
    if (!props.effects || !marker.current) return;
    t.current += Math.min(dt, 0.05);
    marker.current.rotation.y = t.current * 0.8;
    marker.current.position.y = 10.5 + Math.sin(t.current * 1.6) * 0.3;
  });
  const label = useMemo(() => {
    const w = 640 * props.scale;
    const h = 112 * props.scale;
    const { ctx, texture } = makeCanvasTexture(w, h);
    drawLabel(ctx, w, h, props.name, PALETTE.gold);
    texture.needsUpdate = true;
    return texture;
  }, [props.name, props.scale]);
  useEffect(() => () => label.dispose(), [label]);
  return (
    <group position={[props.x, 0, props.z]} {...pointer(props.onSelect, props.place)} userData={{ dynamic: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, props.ground, 0]} material={m.pad}>
        <circleGeometry args={[5, 48]} />
      </mesh>
      {/* Feixe, losango e nome: o local é visível e identificável de longe. Quando você
          já está nele, somem (estariam colados na câmera) e o HUD oferece "Entrar". */}
      <group visible={!props.active}>
        <mesh position={[0, 13, 0]} material={m.beam}>
          <cylinderGeometry args={[0.6, 0.6, 26, 16, 1, true]} />
        </mesh>
        <group ref={marker} position={[0, 10.5, 0]}>
          <mesh material={m.gold}>
            <octahedronGeometry args={[0.95, 0]} />
          </mesh>
        </group>
        <sprite position={[0, 13.4, 0]} scale={[7.2, 1.26, 1]}>
          <spriteMaterial map={label} toneMapped={false} depthWrite={false} />
        </sprite>
      </group>
    </group>
  );
}
