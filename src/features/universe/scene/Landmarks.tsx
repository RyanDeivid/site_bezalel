import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import { drawLabel, makeCanvasTexture } from '@/features/lab/scene/textures';
import { STATION_ORDER } from '@/features/lab/layout';
import { atLeast, BUILDINGS, cubeOnVertex, MONUMENT, MONUMENT_SOLID, PLACES, type PlaceId } from '../world/city';
import type { Quality, UniverseAssets } from './assets';
import { towerSlotMaterial } from './towerMaterial';
import { buildHq, buildLab, buildProductsCenter, HQ, LAB, type HqSlot } from './landmarkGeometry';
import { searchlightBeam } from './lightDecals';
import { panelTexture, PALETTE, signTexture } from './textures';
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
  /** Feixes, losangos e nomes dos locais (some no modo apresentação). */
  markers: boolean;
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
    // À noite o símbolo tem luz própria (não depende do reflexo): cada face da marca com um brilho
    // discreto na cor dela, e as arestas acesas acima de 1 (o brilho as contorna).
    const layers = (m.layers as THREE.MeshStandardMaterial).clone();
    layers.emissiveMap = layers.map;
    layers.emissive = new THREE.Color('#ffffff');
    layers.emissiveIntensity = 0.42;
    const gold = (m.gold as THREE.MeshStandardMaterial).clone();
    gold.emissive = new THREE.Color(PALETTE.gold);
    gold.emissiveIntensity = 0.38;
    const steel = (m.steelLight as THREE.MeshStandardMaterial).clone();
    steel.emissive = new THREE.Color('#5f7fa8');
    steel.emissiveIntensity = 0.3;
    // Ordem das faces: +x, -x, +y, -y, +z, -z. As três que se encontram no vértice de
    // cima (+x, +y, +z) são as da marca: camadas (Aprender), dourada (Descobrir) e aço (Construir).
    const materials = [layers, steel, gold, m.stone, steel, layers];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.goldLight).multiplyScalar(2.6), toneMapped: false });
    return { materials, own: [layers, gold, steel], geo, edges, line };
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

export function Landmarks({ assets, quality, effects, near, markers, texts, onSelect }: Props) {
  const m = assets.materials;
  const hi = atLeast(quality, 'high');
  const cube = useMarkCube(assets);
  useEffect(() => () => {
    cube.geo.dispose();
    cube.edges.dispose();
    cube.line.dispose();
    cube.own.forEach((x) => x.dispose());
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

  // Sede e Centro de Produtos: geometria por material (fachadas, pedra, saguão e acabamentos com cor no vértice).
  const detail = quality !== 'low';
  const hq = useMemo(() => buildHq(detail), [detail]);
  const products = useMemo(() => buildProductsCenter(detail, -80, 0), [detail]);
  const hitbox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const lab = useMemo(() => buildLab(detail), [detail]);
  useEffect(() => () => lab.forEach((g) => g.dispose()), [lab]);
  const holo = useMemo(() => STATION_ORDER.map((id) => new THREE.MeshBasicMaterial({ color: new THREE.Color(AGENT_HEX[id]).multiplyScalar(0.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })), []);
  useEffect(() => () => holo.forEach((h) => h.dispose()), [holo]);
  const agentLabels = useMemo(() => texts.labPanel.lines.slice(0, STATION_ORDER.length).map((l) => signTexture(l.split(' — ')[0] ?? l, 512 * tex, 96 * tex)), [texts.labPanel, tex]);
  useEffect(() => () => agentLabels.forEach((t) => t.dispose()), [agentLabels]);
  const labSign = useDisposable(useMemo(() => signTexture(texts.names['ai-lab'], 1024 * tex, 82 * tex), [texts.names, tex]));
  // Portas de correr: abrem quando a câmera (e quem ela segue) chega perto da entrada.
  const doors = useRef<Array<THREE.Mesh | null>>([]);
  const doorOpen = useRef(0);
  // Holofotes da Sede: dois fachos dourados que varrem o céu devagar (da Média para cima).
  const searchlight = useMemo(() => (quality !== 'low' ? searchlightBeam(260) : null), [quality]);
  useEffect(
    () => () => {
      searchlight?.geometry.dispose();
      searchlight?.material.dispose();
      searchlight?.texture.dispose();
    },
    [searchlight],
  );
  const sweep = useRef<THREE.Group>(null);
  useEffect(() => () => hitbox.dispose(), [hitbox]);
  const washes = useMemo(() => {
    const spots: Array<[number, number, number]> = [
      [-18.5, HQ.z + 13.06, 0],
      [18.5, HQ.z + 13.06, 0],
      ...[-88, -80, -72].flatMap((z): Array<[number, number, number]> => [
        [-20.06, z, -Math.PI / 2],
        [20.06, z, Math.PI / 2],
      ]),
    ];
    const list = spots.map(([x, z, ry]) => new THREE.PlaneGeometry(3.4, 7.2).rotateY(ry).translate(x, HQ.base + 3.6, z));
    const g = mergeGeometries(list)!;
    list.forEach((x) => x.dispose());
    return g;
  }, []);
  useEffect(() => () => [...hq.values(), ...products.values(), washes].forEach((g) => g.dispose()), [hq, products, washes]);
  const hqMaterial = (slot: HqSlot): THREE.Material =>
    slot === 'hqGlass' ? m.towerChampagne : slot === 'stone' ? m.podiumLight : slot === 'lobby' ? m.lobby : towerSlotMaterial(slot, assets);
  const solid = (slot: string) => slot !== 'glow' && slot !== 'lobby';

  // Animações discretas (pausam com "Pausar animações" e com movimento reduzido).
  const monument = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const latticeRef = useRef<THREE.LineSegments>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame(({ camera }, dt) => {
    const near = Math.hypot(camera.position.x - (LAB.x - LAB.half), camera.position.z - LAB.z) < 11;
    doorOpen.current += ((near ? 1 : 0) - doorOpen.current) * Math.min(1, dt * 4);
    doors.current.forEach((d, i) => d && (d.position.z = LAB.z + (i ? 1 : -1) * LAB.door.half * (0.5 + doorOpen.current * 0.95)));
    if (!effects) return;
    t.current += Math.min(dt, 0.05);
    const k = t.current;
    if (monument.current) {
      monument.current.rotation.y = k * 0.18;
      monument.current.position.y = MONUMENT_Y + Math.sin(k * 0.9) * 0.25;
    }
    if (halo.current) halo.current.rotation.z = k * 0.12;
    if (sweep.current) sweep.current.rotation.y = k * 0.16;
    if (latticeRef.current) latticeRef.current.rotation.set(k * 0.15, k * 0.22, 0);
    if (beacon.current) beacon.current.visible = Math.sin(k * 3) > -0.2;
  });


  // Peças estáticas juntadas numa malha por material (menos chamadas de desenho); as animadas
  // e os marcadores dos locais têm `userData.dynamic` e ficam como estão.
  const root = useRef<THREE.Group>(null);
  useLayoutEffect(() => (root.current ? mergeStatic(root.current) : undefined), [quality, hq, products, lab, hqSign, productsSign, labPanel, productsPanel, labSign, agentLabels]);

  return (
    <group ref={root}>
      {/* ---------------- Sede Bezalel ---------------- */}
      <group>
        {[...hq].map(([slot, geo]) => (
          <mesh key={slot} geometry={geo} material={hqMaterial(slot)} castShadow={hi && solid(slot)} receiveShadow={solid(slot)} />
        ))}
        {/* Refletores no chão lavando os pilares e as laterais do pódio (uma malha só). */}
        <mesh geometry={washes} material={m.wash} renderOrder={6} />
        {/* Letreiro em letras soltas sobre o pódio, de frente para a avenida. */}
        <mesh material={m.steel} position={[0, HQ.podiumTop + 0.15, HQ.lobby.z + 0.6]}>
          <boxGeometry args={[18.6, 0.3, 0.35]} />
        </mesh>
        <mesh position={[0, HQ.podiumTop + 1.75, HQ.lobby.z + 0.75]}>
          <planeGeometry args={[18, 2.8]} />
          <meshBasicMaterial map={hqSign} transparent toneMapped={false} depthWrite={false} />
        </mesh>
        {searchlight && (
          <group ref={sweep} position={[0, HQ.lanternTop + 0.6, HQ.towerZ]} userData={{ dynamic: true }}>
            {[1, -1].map((s) => (
              <mesh key={s} geometry={searchlight.geometry} material={searchlight.material} position={[s * 5.5, 0, 0]} rotation={[0.22 * s, 0, -0.6 * s]} renderOrder={8} />
            ))}
          </group>
        )}
        {/* Coroa: o cubo do símbolo sobre um plinto, acima da lanterna, com um halo dourado */}
        <mesh material={m.steel} position={[0, HQ.plinthY, HQ.towerZ]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[9, 1.6, 9]} />
        </mesh>
        <group position={[0, HQ.cubeY, HQ.towerZ]}>
          <MarkCube size={CROWN} cube={cube} />
          <mesh ref={halo} rotation={[Math.PI / 2, 0, 0]} material={m.glowGold} userData={{ dynamic: true }}>
            <torusGeometry args={[cubeOnVertex(CROWN).radius + 1.2, 0.09, 6, hi ? 128 : 64]} />
          </mesh>
        </group>
      </group>

      {/* ---------------- Laboratório de IA ----------------
          Pavilhão de vidro em que se entra a pé: as portas correm quando alguém chega perto. Dentro, o
          núcleo (a rede neural girando) e as seis estações dos agentes, cada uma com a sua luz e o nome. */}
      <group>
        {[...lab].map(([slot, geo]) => (
          <mesh key={slot} geometry={geo} material={slot === 'labGlass' ? m.glass : towerSlotMaterial(slot, assets)} castShadow={hi && slot === 'metal'} receiveShadow={slot === 'matte'} />
        ))}
        {[-1, 1].map((s, i) => (
          <mesh key={s} ref={(el) => void (doors.current[i] = el)} material={m.glass} position={[LAB.x - LAB.half, LAB.base + LAB.door.height / 2, LAB.z + s * LAB.door.half * 0.5]} userData={{ dynamic: true }}>
            <boxGeometry args={[0.08, LAB.door.height, LAB.door.half]} />
          </mesh>
        ))}
        <mesh material={m.glass} position={[LAB.x, LAB.base + 5.4, LAB.z]}>
          <cylinderGeometry args={[LAB.core, LAB.core, 10.8, 32, 1, true]} />
        </mesh>
        <mesh material={m.darkGlass} position={[LAB.x, LAB.base + 5.4, LAB.z]}>
          <cylinderGeometry args={[0.6, 0.6, 10.8, 16]} />
        </mesh>
        <mesh material={local.core} position={[LAB.x, 5.6, LAB.z]}>
          <sphereGeometry args={[1.3, 24, 16]} />
        </mesh>
        <lineSegments ref={latticeRef} geometry={lattice} material={local.lattice} position={[LAB.x, 5.6, LAB.z]} scale={0.42} userData={{ dynamic: true }} />
        {local.agents.map((mat, i) => {
          const a = (i / local.agents.length) * Math.PI * 2;
          const x = LAB.x + Math.cos(a) * LAB.ring;
          const z = LAB.z + Math.sin(a) * LAB.ring;
          return (
            <group key={i} position={[x, LAB.base, z]}>
              <mesh material={mat} position={[0, 2.6, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 3.4, 8]} />
              </mesh>
              <mesh material={holo[i]} position={[0, 2.4, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 2.9, 20, 1, true]} />
              </mesh>
              <sprite position={[0, 4.35, 0]} scale={[2.6, 0.49, 1]}>
                <spriteMaterial map={agentLabels[i]} transparent toneMapped={false} depthWrite={false} />
              </sprite>
            </group>
          );
        })}
        {/* Nome na faixa de metal, acima da porta. */}
        <mesh position={[LAB.x - LAB.half - 0.08, LAB.wallTop - 0.55, LAB.z]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[13, 1.05]} />
          <meshBasicMaterial map={labSign} transparent toneMapped={false} depthWrite={false} />
        </mesh>
        {/* Mastro e farol no alto do teto. */}
        <mesh material={m.steel} position={[LAB.x, LAB.roofTop + 2, LAB.z]}>
          <cylinderGeometry args={[0.15, 0.25, 4, 8]} />
        </mesh>
        <mesh ref={beacon} material={m.glowBlue} position={[LAB.x, LAB.roofTop + 4.3, LAB.z]} userData={{ dynamic: true }}>
          <sphereGeometry args={[0.35, 12, 8]} />
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
      <group>
        {[...products].map(([slot, geo]) => (
          <mesh key={slot} geometry={geo} material={towerSlotMaterial(slot, assets)} castShadow={hi && solid(slot)} receiveShadow={solid(slot)} />
        ))}
        {/* Letreiro */}
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
      <group>
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

      {/* ---------------- Alvos do clique ----------------
          Caixas invisíveis do tamanho de cada edifício (os mesmos volumes da colisão) e do monumento. O
          clique e o "passar por cima" são testados contra elas a cada movimento do ponteiro: contra a
          geometria detalhada (centenas de milhares de triângulos), cada movimento do mouse custava
          dezenas de milissegundos — girar a câmera arrastando perdia quadros (medido). */}
      {[...BUILDINGS.flatMap((b) => b.solids.map((s) => [b.id, s] as const)), ['plaza', MONUMENT_SOLID] as const].map(([id, s], i) => (
        <mesh
          key={i}
          visible={false}
          geometry={hitbox}
          material={m.glowGold}
          position={[(s.minX + s.maxX) / 2, ((s.base ?? 0) + s.height) / 2, (s.minZ + s.maxZ) / 2]}
          scale={[s.maxX - s.minX, s.height - (s.base ?? 0), s.maxZ - s.minZ]}
          userData={{ dynamic: true }}
          {...pointer(onSelect, id)}
        />
      ))}

      {/* ---------------- Helipontos e marcadores dos locais ---------------- */}
      {PLACES.map((p, i) => (
        <PlaceMarker
          key={p.id}
          place={p.id}
          x={p.pad.x}
          z={p.pad.z}
          ground={p.id === 'plaza' ? 0.42 : 0.4}
          name={texts.names[p.id]}
          active={near === p.id || !markers}
          assets={assets}
          scale={tex}
          index={i}
          effects={effects}
          onSelect={onSelect}
          hitbox={hitbox}
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
  hitbox: THREE.BufferGeometry;
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
    <group position={[props.x, 0, props.z]} userData={{ dynamic: true }}>
      {/* Alvo do clique: uma coluna invisível no lugar do heliponto, do feixe e do nome. */}
      <mesh visible={false} position={[0, 7, 0]} scale={[10, 14, 10]} geometry={props.hitbox} material={m.glowGold} userData={{ dynamic: true }} {...pointer(props.onSelect, props.place)} />
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
