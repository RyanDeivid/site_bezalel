import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCanvasTexture } from '@/features/lab/scene/textures';
import { Humanoid, HumanoidFleet, restPose } from '@/features/lab/scene/robots/humanoid';
import type { UniverseRuntime } from '../world/runtime';
import { FLOORS, floorBounds, floorY, FURNITURE, INTERIOR_REVEAL, RECEPTION_DESK, SECTOR_CAMERAS, TOP_FLOOR, TOWER, type SectorId } from '../world/tower';
import { fetchTowerLive, mergeSectorStatus, type LiveState, type SectorRow } from '../world/towerLive';
import { mergeStatic } from './staticMerge';

/** Textos da Torre que a cena desenha (placas, diretório, telas), no idioma da página. */
export interface TowerTexts {
  name: string;
  floor: (i: number) => string;
  sectors: Record<SectorId, string>;
  free: string;
  planned: string;
  directory: string;
  welcome: { title: string; lines: string[] };
  status: {
    title: string;
    demo: string;
    planned: string;
    demoTag: string;
    liveTag: string;
    unavailableTag: string;
    live: string;
    agents: string;
    none: string;
    noActivity: string;
    states: Record<'succeeded' | 'failed' | 'cancelled', string>;
    work: (running: number, queued: number) => string;
    last: (state: string, at: string | null) => string;
    failures: (n: number) => string;
  };
  camera: { title: (id: string, sector: string) => string; note: string };
  projects: { title: string; items: Array<{ title: string; line: string }> };
}

const FONT = "'Geist Variable', 'Geist', system-ui, sans-serif";
const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace";
const NAVY = '#101B2B';
const GOLD = '#C7A86A';
const WARM = '#F2E8D5';
/** Camada só da câmera do setor (a principal não a desenha): o andar visto pela tela da presidência. */
const FEED_LAYER = 3;
/** Camada onde `mergeStatic` guarda as peças originais (já desenhadas pelas malhas juntadas). */
const MERGED_AWAY = 1 << 31;

/** Uma tela/placa desenhada em canvas. */
function canvasPanel(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const { ctx, texture } = makeCanvasTexture(w, h);
  draw(ctx, w, h);
  texture.needsUpdate = true;
  return texture;
}

function header(ctx: CanvasRenderingContext2D, w: number, title: string, tag?: string) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, 9999);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, w, 6);
  ctx.fillStyle = WARM;
  ctx.font = `600 44px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText(title, 40, 34);
  if (tag) {
    ctx.font = `600 24px ${MONO}`;
    const tw = ctx.measureText(tag).width + 28;
    ctx.fillStyle = 'rgba(199,168,106,0.18)';
    ctx.fillRect(w - tw - 40, 36, tw, 40);
    ctx.fillStyle = GOLD;
    ctx.fillText(tag, w - tw - 26, 44);
  }
}

/** Diretório da recepção: todos os andares do registro, com o setor ou "em planejamento". */
function drawDirectory(ctx: CanvasRenderingContext2D, w: number, h: number, t: TowerTexts) {
  header(ctx, w, `${t.name} · ${t.directory}`);
  ctx.font = `500 30px ${FONT}`;
  const rows = [...FLOORS].reverse();
  const top = 110;
  const rh = (h - top - 20) / rows.length;
  rows.forEach((f, i) => {
    const y = top + i * rh;
    const open = f.status === 'open';
    ctx.fillStyle = i % 2 ? 'rgba(38,59,84,0.35)' : 'rgba(38,59,84,0.6)';
    ctx.fillRect(30, y, w - 60, rh - 4);
    ctx.fillStyle = open ? GOLD : '#7b8798';
    ctx.font = `600 30px ${MONO}`;
    ctx.fillText(f.index === 0 ? 'T' : String(f.index).padStart(2, '0'), 50, y + rh / 2 - 15);
    ctx.fillStyle = open ? WARM : '#9aa5b5';
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(f.sector ? t.sectors[f.sector] : t.free, 130, y + rh / 2 - 15);
    if (!open) {
      ctx.font = `500 22px ${MONO}`;
      ctx.fillStyle = '#7b8798';
      ctx.fillText(t.planned.toUpperCase(), w - 300, y + rh / 2 - 11);
    }
  });
}

function drawWelcome(ctx: CanvasRenderingContext2D, w: number, _h: number, t: TowerTexts) {
  header(ctx, w, t.welcome.title);
  ctx.fillStyle = WARM;
  ctx.font = `400 32px ${FONT}`;
  t.welcome.lines.forEach((l, i) => ctx.fillText(l, 40, 130 + i * 52));
}

/**
 * Estado dos setores: cada linha diz de onde vem. "Ao vivo" é o runtime de agentes do backend (números
 * gravados por ele); "demonstração" e "em planejamento" vêm da lista local. O cabeçalho diz se o runtime
 * respondeu, está fora do ar ou não está configurado.
 */
function drawStatus(ctx: CanvasRenderingContext2D, w: number, h: number, t: TowerTexts, rows: SectorRow[], live: LiveState) {
  const tag = live === 'live' ? t.status.liveTag : live === 'unavailable' ? t.status.unavailableTag : t.status.demoTag;
  header(ctx, w, t.status.title, tag);
  const top = 110;
  const rh = Math.min(84, (h - top - 20) / rows.length);
  rows.forEach((s, i) => {
    const y = top + i * rh;
    const isLive = s.source === 'live';
    ctx.fillStyle = isLive ? 'rgba(46,111,92,0.45)' : 'rgba(38,59,84,0.55)';
    ctx.fillRect(30, y, w - 60, rh - 8);
    ctx.fillStyle = isLive ? '#5fd3a5' : s.source === 'demo' ? GOLD : '#5d6878';
    ctx.beginPath();
    ctx.arc(60, y + rh / 2 - 4, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = WARM;
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(t.sectors[s.sector], 90, y + 12);
    ctx.font = `400 22px ${MONO}`;
    ctx.fillStyle = isLive ? '#bfe9d6' : '#9aa5b5';
    const agents = s.agents.length ? `${t.status.agents}: ${s.agents.join(', ')}` : t.status.none;
    let line: string;
    if (isLive) {
      const parts = [t.status.live, s.agents.join(', ') || t.status.none];
      if (s.running || s.queued) parts.push(t.status.work(s.running, s.queued));
      parts.push(s.lastResult ? t.status.last(t.status.states[s.lastResult.state], s.lastResult.finished_at) : t.status.noActivity);
      if (s.failures24h) parts.push(t.status.failures(s.failures24h));
      line = parts.join(' · ');
    } else line = `${s.source === 'demo' ? t.status.demo : t.status.planned} · ${agents}`;
    ctx.fillText(line.length > 84 ? line.slice(0, 83) + '…' : line, 90, y + 50);
  });
}

function drawProjects(ctx: CanvasRenderingContext2D, w: number, _h: number, t: TowerTexts) {
  header(ctx, w, t.projects.title);
  t.projects.items.slice(0, 4).forEach((p, i) => {
    const y = 120 + i * 92;
    ctx.fillStyle = GOLD;
    ctx.fillRect(40, y + 6, 6, 60);
    ctx.fillStyle = WARM;
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(p.title, 62, y);
    ctx.fillStyle = '#9aa5b5';
    ctx.font = `400 24px ${FONT}`;
    ctx.fillText(p.line.slice(0, 60), 62, y + 42);
  });
}

function drawSign(ctx: CanvasRenderingContext2D, w: number, h: number, big: string, small: string) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, h - 6, w, 6);
  ctx.fillStyle = WARM;
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(h * 0.4)}px ${FONT}`;
  ctx.fillText(big, 28, h * 0.42);
  ctx.fillStyle = GOLD;
  ctx.font = `500 ${Math.round(h * 0.2)}px ${MONO}`;
  ctx.fillText(small, 30, h * 0.78);
}

/** Mostrador do elevador: o andar e a seta do sentido. */
function drawIndicator(ctx: CanvasRenderingContext2D, w: number, h: number, label: string, dir: number) {
  ctx.fillStyle = '#05080d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = GOLD;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.round(h * 0.62)}px ${MONO}`;
  ctx.fillText(label, w * 0.58, h / 2 + 2);
  if (dir) {
    ctx.beginPath();
    const cx = w * 0.18;
    const s = h * 0.22;
    if (dir > 0) {
      ctx.moveTo(cx, h / 2 - s);
      ctx.lineTo(cx + s, h / 2 + s * 0.6);
      ctx.lineTo(cx - s, h / 2 + s * 0.6);
    } else {
      ctx.moveTo(cx, h / 2 + s);
      ctx.lineTo(cx + s, h / 2 - s * 0.6);
      ctx.lineTo(cx - s, h / 2 - s * 0.6);
    }
    ctx.fill();
  }
  ctx.textAlign = 'start';
}

/** Materiais do interior (luz própria discreta: os interiores ficam na sombra do prédio). */
function useInteriorMaterials() {
  const m = useMemo(() => {
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
    return {
      floor: std({ color: '#b9b0a0', roughness: 0.3, metalness: 0.05, emissive: new THREE.Color('#2a261f'), emissiveIntensity: 0.35 }),
      floorDark: std({ color: '#2a3241', roughness: 0.4, metalness: 0.1, emissive: new THREE.Color('#0d121b'), emissiveIntensity: 0.6 }),
      wall: std({ color: '#d8cdb8', roughness: 0.85, emissive: new THREE.Color('#3a342a'), emissiveIntensity: 0.35 }),
      ceiling: std({ color: '#1b2432', roughness: 0.9, emissive: new THREE.Color('#0b1019'), emissiveIntensity: 0.8 }),
      core: std({ color: '#283344', roughness: 0.5, metalness: 0.25, emissive: new THREE.Color('#0d1420'), emissiveIntensity: 0.7 }),
      bronze: std({ color: '#8a6d43', roughness: 0.3, metalness: 0.9, emissive: new THREE.Color('#2a1f10'), emissiveIntensity: 0.4 }),
      steel: std({ color: '#a2aab4', roughness: 0.28, metalness: 0.85, emissive: new THREE.Color('#1c2129'), emissiveIntensity: 0.5 }),
      desk: std({ color: '#f2e8d5', roughness: 0.4, metalness: 0.05, emissive: new THREE.Color('#4f473a'), emissiveIntensity: 0.45 }),
      dark: std({ color: '#151d2a', roughness: 0.6, metalness: 0.2, emissive: new THREE.Color('#06090f'), emissiveIntensity: 0.5 }),
      fabric: std({ color: '#263b54', roughness: 0.95, emissive: new THREE.Color('#0b1420'), emissiveIntensity: 0.6 }),
      plant: std({ color: '#2f5a3a', roughness: 0.9, emissive: new THREE.Color('#0b1a10'), emissiveIntensity: 0.5 }),
      light: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.35, 1.1), toneMapped: false }),
      gold: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.74, 0.42), toneMapped: false }),
      glass: std({ color: '#cbd8e6', roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 }),
      monitor: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.45, 0.62), toneMapped: false }),
    };
  }, []);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  return m;
}

type Mats = ReturnType<typeof useInteriorMaterials>;

/** Caixa (centro, tamanho) — o atalho dos interiores. */
function Box({ p, s, m, ry = 0 }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material; ry?: number }) {
  return (
    <mesh position={p} rotation={[0, ry, 0]} material={m}>
      <boxGeometry args={s} />
    </mesh>
  );
}

/** Plano com textura de canvas (placa, tela). `ry`: para onde a face olha. */
function Panel({ p, w, h, map, ry = 0 }: { p: [number, number, number]; w: number; h: number; map: THREE.Texture; ry?: number }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map, toneMapped: false }), [map]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh position={p} rotation={[0, ry, 0]} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

/** Junta as peças estáticas de um grupo (menos chamadas de desenho), como os marcos da cidade. */
function useMerged(ref: React.RefObject<THREE.Group | null>, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => (ref.current ? mergeStatic(ref.current) : undefined), deps);
}

/** Núcleo do elevador num andar: a caixa de pedra, o batente de bronze, as portas e o mostrador. */
function CoreFront({ y, top, m, doors, indicator }: { y: number; top: number; m: Mats; doors: React.RefObject<Array<THREE.Object3D | null>>; indicator: THREE.Texture }) {
  const c = TOWER.core;
  const k = TOWER.cabin;
  const h = top - y;
  const cx = (c.minX + c.maxX) / 2;
  const cz = (c.minZ + c.maxZ) / 2;
  const front = c.maxZ + 0.01;
  const doorH = k.height - 0.2;
  return (
    <group>
      {/* A caixa do núcleo, com o vão da porta: três blocos e a verga. */}
      <Box p={[(c.minX + -k.doorHalf) / 2, y + h / 2, cz]} s={[-k.doorHalf - c.minX, h, c.maxZ - c.minZ]} m={m.core} />
      <Box p={[(k.doorHalf + c.maxX) / 2, y + h / 2, cz]} s={[c.maxX - k.doorHalf, h, c.maxZ - c.minZ]} m={m.core} />
      <Box p={[cx, y + doorH + (h - doorH) / 2, (k.maxZ + c.maxZ) / 2]} s={[k.doorHalf * 2, h - doorH, c.maxZ - k.maxZ]} m={m.core} />
      {/* Batente de bronze. */}
      <Box p={[-k.doorHalf - 0.06, y + doorH / 2, front + 0.03]} s={[0.12, doorH, 0.08]} m={m.bronze} />
      <Box p={[k.doorHalf + 0.06, y + doorH / 2, front + 0.03]} s={[0.12, doorH, 0.08]} m={m.bronze} />
      <Box p={[0, y + doorH + 0.06, front + 0.03]} s={[k.doorHalf * 2 + 0.24, 0.12, 0.08]} m={m.bronze} />
      {/* Duas folhas de aço que correm para os lados (a cena move pelo estado da porta). */}
      {[-1, 1].map((s, i) => (
        <group key={s} ref={(o) => void (doors.current[i] = o)} userData={{ dynamic: true, side: s }}>
          <Box p={[(s * k.doorHalf) / 2, y + doorH / 2, front - 0.04]} s={[k.doorHalf, doorH, 0.05]} m={m.steel} />
        </group>
      ))}
      <group userData={{ dynamic: true }}>
        <Panel p={[0, y + doorH + 0.28, front + 0.02]} w={0.8} h={0.28} map={indicator} />
      </group>
    </group>
  );
}

/** A recepção, no pódio: piso, paredes, forro com luz, balcão, diretório, apresentação, espera. */
function Lobby({ m, texts, doors, indicator, entry }: { m: Mats; texts: TowerTexts; doors: React.RefObject<Array<THREE.Object3D | null>>; indicator: THREE.Texture; entry: React.RefObject<Array<THREE.Object3D | null>> }) {
  const p = TOWER.podium;
  const g = TOWER.ground;
  const ceil = TOWER.lobbyCeiling;
  const l = TOWER.lobby;
  const inner = { minX: p.minX + 0.31, maxX: p.maxX - 0.31, minZ: p.minZ + 0.31, maxZ: l.glassZ - 0.16 };
  const w = inner.maxX - inner.minX;
  const d = inner.maxZ - inner.minZ;
  const cz = (inner.minZ + inner.maxZ) / 2;
  const directory = useMemo(() => canvasPanel(1024, 1280, (c, w, h) => drawDirectory(c, w, h, texts)), [texts]);
  const welcome = useMemo(() => canvasPanel(1024, 512, (c, w, h) => drawWelcome(c, w, h, texts)), [texts]);
  const logo = useMemo(() => canvasPanel(1024, 256, (c, w, h) => drawSign(c, w, h, 'BEZALEL', texts.sectors.reception.toUpperCase())), [texts]);
  useEffect(() => () => [directory, welcome, logo].forEach((t) => t.dispose()), [directory, welcome, logo]);
  const lines = useMemo(() => {
    const list: THREE.BufferGeometry[] = [];
    for (let x = -15; x <= 15; x += 5) list.push(new THREE.BoxGeometry(0.12, 0.04, d - 4).translate(x, ceil - 0.03, cz));
    const g2 = mergeGeometries(list)!;
    list.forEach((x) => x.dispose());
    return g2;
  }, [ceil, cz, d]);
  useEffect(() => () => lines.dispose(), [lines]);
  const root = useRef<THREE.Group>(null);
  useMerged(root, [texts]);
  const desk = RECEPTION_DESK;
  return (
    <group ref={root}>
      {/* Piso de pedra clara com uma faixa dourada da porta ao elevador; forro escuro com linhas de luz. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, g + 0.012, cz]} material={m.floor}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, g + 0.016, (l.glassZ + TOWER.core.maxZ) / 2]} material={m.gold}>
        <planeGeometry args={[0.14, l.glassZ - TOWER.core.maxZ - 0.4]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ceil, cz]} material={m.ceiling}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh geometry={lines} material={m.light} />
      {/* Paredes por dentro (a pedra de fora só tem a face de fora). */}
      <mesh position={[inner.minX, g + (ceil - g) / 2, cz]} rotation={[0, Math.PI / 2, 0]} material={m.wall}>
        <planeGeometry args={[d, ceil - g]} />
      </mesh>
      <mesh position={[inner.maxX, g + (ceil - g) / 2, cz]} rotation={[0, -Math.PI / 2, 0]} material={m.wall}>
        <planeGeometry args={[d, ceil - g]} />
      </mesh>
      <mesh position={[0, g + (ceil - g) / 2, inner.minZ]} material={m.wall}>
        <planeGeometry args={[w, ceil - g]} />
      </mesh>
      {/* Faixa de bronze ao longo das paredes. */}
      <Box p={[inner.minX + 0.03, g + 1.1, cz]} s={[0.04, 0.06, d]} m={m.bronze} />
      <Box p={[inner.maxX - 0.03, g + 1.1, cz]} s={[0.04, 0.06, d]} m={m.bronze} />
      {/* Vidro de verdade do saguão (com o vão da porta) e as portas de correr. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * ((l.halfWidth + l.doorHalf) / 2), g + (l.top - g) / 2, l.glassZ]} material={m.glass}>
          <planeGeometry args={[l.halfWidth - l.doorHalf, l.top - g]} />
        </mesh>
      ))}
      <mesh position={[0, g + 3.2 + (l.top - g - 3.2) / 2, l.glassZ]} material={m.glass}>
        <planeGeometry args={[l.doorHalf * 2, l.top - g - 3.2]} />
      </mesh>
      {[-1, 1].map((s, i) => (
        <group key={s} ref={(o) => void (entry.current[i] = o)} userData={{ dynamic: true, side: s }}>
          <mesh position={[(s * l.doorHalf) / 2, g + 1.6, l.glassZ]} material={m.glass}>
            <planeGeometry args={[l.doorHalf, 3.2]} />
          </mesh>
          <Box p={[(s * l.doorHalf) / 2, g + 1.6, l.glassZ]} s={[0.04, 3.2, 0.06]} m={m.bronze} />
        </group>
      ))}
      {/* Balcão da recepção: branco quente com filete dourado e a marca na frente. */}
      <Box p={[desk.x, g + desk.height / 2, desk.z]} s={[desk.halfWidth * 2, desk.height, desk.depth]} m={m.desk} />
      <Box p={[desk.x, g + desk.height + 0.02, desk.z]} s={[desk.halfWidth * 2 + 0.1, 0.04, desk.depth + 0.1]} m={m.gold} />
      <Panel p={[desk.x, g + 0.62, desk.z + desk.depth / 2 + 0.01]} w={4} h={1} map={logo} />
      {/* Diretório (todos os andares do registro) ao lado do elevador e a apresentação na parede oeste. */}
      <Box p={[-5.2, g + 1.75, -80.8]} s={[1.9, 3.3, 0.18]} m={m.dark} />
      <Panel p={[-5.2, g + 1.85, -80.7]} w={1.7} h={2.9} map={directory} />
      <Panel p={[inner.minX + 0.02, g + 3.2, -80]} w={6} h={3} map={welcome} ry={Math.PI / 2} />
      {/* Espera: dois sofás, mesa baixa e plantas, a leste. */}
      {[-78.5, -73.5].map((z) => (
        <group key={z}>
          <Box p={[13.5, g + 0.25, z]} s={[3.2, 0.5, 1]} m={m.fabric} />
          <Box p={[13.5, g + 0.62, z + (z < -76 ? -0.4 : 0.4)]} s={[3.2, 0.7, 0.22]} m={m.fabric} />
        </group>
      ))}
      <Box p={[13.5, g + 0.22, -76]} s={[1.6, 0.44, 1.2]} m={m.desk} />
      {[
        [17.5, -71],
        [17.5, -90],
        [-17.5, -71],
        [-17.5, -90],
      ].map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x!, g + 0.35, z!]} material={m.dark}>
            <cylinderGeometry args={[0.4, 0.32, 0.7, 16]} />
          </mesh>
          <mesh position={[x!, g + 1.25, z!]} material={m.plant}>
            <sphereGeometry args={[0.75, 14, 10]} />
          </mesh>
        </group>
      ))}
      <CoreFront y={g} top={ceil} m={m} doors={doors} indicator={indicator} />
    </group>
  );
}

/** Casca comum de um andar da torre: piso, forro com luz, vidro por dentro da fachada, montantes. */
function FloorShell({ index, m }: { index: number; m: Mats }) {
  const y = floorY(index);
  const top = y + TOWER.clearHeight;
  const b = floorBounds(index);
  const w = b.maxX - b.minX + 0.6;
  const d = b.maxZ - b.minZ + 0.6;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const geo = useMemo(() => {
    const mull: THREE.BufferGeometry[] = [];
    const lights: THREE.BufferGeometry[] = [];
    for (let x = b.minX; x <= b.maxX + 0.01; x += 2.4) for (const z of [b.minZ - 0.12, b.maxZ + 0.12]) mull.push(new THREE.BoxGeometry(0.08, top - y, 0.08).translate(x, y + (top - y) / 2, z));
    for (let z = b.minZ; z <= b.maxZ + 0.01; z += 2.4) for (const x of [b.minX - 0.12, b.maxX + 0.12]) mull.push(new THREE.BoxGeometry(0.08, top - y, 0.08).translate(x, y + (top - y) / 2, z));
    for (let x = b.minX + 2; x <= b.maxX - 2; x += 3.2) lights.push(new THREE.BoxGeometry(0.1, 0.03, d - 3).translate(x, top - 0.02, cz));
    const out = { mull: mergeGeometries(mull)!, lights: mergeGeometries(lights)! };
    [...mull, ...lights].forEach((g) => g.dispose());
    return out;
  }, [b.minX, b.maxX, b.minZ, b.maxZ, y, top, d, cz]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, y + 0.01, cz]} material={m.floorDark}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, top, cz]} material={m.ceiling}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh geometry={geo.lights} material={m.light} />
      <mesh geometry={geo.mull} material={m.steel} />
      {/* Pilar no eixo da fachada sul: por fora, ali corre a fenda de luz dourada da sede, de alto a baixo;
          por dentro, é a estrutura (sem ela, a fenda virava uma coluna de luz no meio da vista). Idem ao norte. */}
      <Box p={[TOWER.x, y + (top - y) / 2, b.maxZ + 0.02]} s={[1.3, top - y, 0.38]} m={m.core} />
      <Box p={[TOWER.x, y + (top - y) / 2, b.minZ - 0.02]} s={[1.3, top - y, 0.38]} m={m.core} />
      {/* Vidro por dentro da fachada: reflexo e tom do vidro sobre a vista da cidade. */}
      <mesh position={[cx, y + (top - y) / 2, b.minZ - 0.14]} material={m.glass}>
        <planeGeometry args={[w, top - y]} />
      </mesh>
      <mesh position={[cx, y + (top - y) / 2, b.maxZ + 0.14]} material={m.glass}>
        <planeGeometry args={[w, top - y]} />
      </mesh>
      <mesh position={[b.minX - 0.14, y + (top - y) / 2, cz]} rotation={[0, Math.PI / 2, 0]} material={m.glass}>
        <planeGeometry args={[d, top - y]} />
      </mesh>
      <mesh position={[b.maxX + 0.14, y + (top - y) / 2, cz]} rotation={[0, Math.PI / 2, 0]} material={m.glass}>
        <planeGeometry args={[d, top - y]} />
      </mesh>
    </group>
  );
}

/** Engenharia e Construção (3º andar): bancadas, monitores, quadro de arquitetura, robôs trabalhando, a câmera ENG-01. */
function Engineering({ m, texts, doors, indicator, robots }: { m: Mats; texts: TowerTexts; doors: React.RefObject<Array<THREE.Object3D | null>>; indicator: THREE.Texture; robots: THREE.Group }) {
  const index = 3;
  const y = floorY(index);
  const sign = useMemo(() => canvasPanel(1024, 256, (c, w, h) => drawSign(c, w, h, texts.sectors.engineering, `${texts.floor(index).toUpperCase()} · ${texts.name.toUpperCase()}`)), [texts]);
  const board = useMemo(
    () =>
      canvasPanel(1024, 512, (c, w, h) => {
        header(c, w, 'tower-v1 · arquitetura');
        c.strokeStyle = GOLD;
        c.lineWidth = 3;
        const boxes: Array<[number, number, string]> = [
          [60, 150, 'world/tower.ts'],
          [400, 150, 'towerRuntime.ts'],
          [740, 150, 'TowerInterior'],
          [230, 330, 'FLOORS'],
          [570, 330, 'SECTOR_STATUS'],
        ];
        c.font = `500 24px ${MONO}`;
        for (const [x, yy, label] of boxes) {
          c.strokeRect(x, yy, 240, 90);
          c.fillStyle = WARM;
          c.fillText(label, x + 16, yy + 32);
        }
        c.beginPath();
        c.moveTo(300, 195);
        c.lineTo(400, 195);
        c.moveTo(640, 195);
        c.lineTo(740, 195);
        c.moveTo(350, 330);
        c.lineTo(450, 240);
        c.moveTo(690, 330);
        c.lineTo(620, 240);
        c.stroke();
        void h;
      }),
    [],
  );
  useEffect(() => () => [sign, board].forEach((t) => t.dispose()), [sign, board]);
  const root = useRef<THREE.Group>(null);
  useMerged(root, [texts]);
  const cam = SECTOR_CAMERAS[0]!;
  return (
    <group ref={root}>
      <FloorShell index={index} m={m} />
      <CoreFront y={y} top={y + TOWER.clearHeight} m={m} doors={doors} indicator={indicator} />
      <Panel p={[0, y + 3.18, TOWER.core.maxZ + 0.02]} w={2.6} h={0.65} map={sign} />
      <Panel p={[TOWER.core.maxX + 0.02, y + 1.8, -85]} w={4.6} h={2.3} map={board} ry={Math.PI / 2} />
      {(FURNITURE[index] ?? []).map((f, i) => {
        const cx = (f.minX + f.maxX) / 2;
        const cz = (f.minZ + f.maxZ) / 2;
        return (
          <group key={i}>
            <Box p={[cx, y + f.height - 0.03, cz]} s={[f.maxX - f.minX, 0.06, f.maxZ - f.minZ]} m={m.desk} />
            <Box p={[cx, y + (f.height - 0.06) / 2, cz]} s={[f.maxX - f.minX - 0.2, f.height - 0.06, 0.08]} m={m.dark} />
            {[-1.2, 1.2].map((dx) => (
              <group key={dx}>
                <Box p={[cx + dx, y + f.height + 0.28, cz - 0.3]} s={[0.9, 0.5, 0.04]} m={m.dark} />
                <Box p={[cx + dx, y + f.height + 0.28, cz - 0.275]} s={[0.84, 0.44, 0.01]} m={m.monitor} />
              </group>
            ))}
          </group>
        );
      })}
      {/* A câmera ENG-01: um domo no forro (a mesma posição da câmera que a presidência vê). */}
      <group userData={{ dynamic: true }}>
        <mesh position={[cam.position[0], y + TOWER.clearHeight - 0.12, cam.position[2]]} material={m.dark}>
          <sphereGeometry args={[0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[cam.position[0], y + TOWER.clearHeight - 0.2, cam.position[2]]} material={m.gold}>
          <sphereGeometry args={[0.03, 8, 6]} />
        </mesh>
      </group>
      <primitive object={robots} />
    </group>
  );
}

/** Presidência (último andar): mesa de frente para a cidade, reunião, estações, telas gigantes. */
function Presidency({ m, texts, doors, indicator, feed, rows, live }: { m: Mats; texts: TowerTexts; doors: React.RefObject<Array<THREE.Object3D | null>>; indicator: THREE.Texture; feed: THREE.Texture; rows: SectorRow[]; live: LiveState }) {
  const index = TOP_FLOOR;
  const y = floorY(index);
  const top = y + TOWER.clearHeight;
  const c = TOWER.core;
  const sign = useMemo(() => canvasPanel(1024, 256, (cx, w, h) => drawSign(cx, w, h, texts.sectors.presidency, `${texts.floor(index).toUpperCase()} · ${texts.name.toUpperCase()}`)), [texts, index]);
  const status = useMemo(() => canvasPanel(1280, 720, (cx, w, h) => drawStatus(cx, w, h, texts, rows, live)), [texts, rows, live]);
  const projects = useMemo(() => canvasPanel(1024, 512, (cx, w, h) => drawProjects(cx, w, h, texts)), [texts]);
  const camTitle = useMemo(
    () =>
      canvasPanel(1024, 128, (cx, w, h) => {
        cx.fillStyle = NAVY;
        cx.fillRect(0, 0, w, h);
        cx.fillStyle = '#e25b4b';
        cx.beginPath();
        cx.arc(40, h / 2, 12, 0, Math.PI * 2);
        cx.fill();
        cx.fillStyle = WARM;
        cx.font = `600 40px ${FONT}`;
        cx.textBaseline = 'middle';
        const cam = SECTOR_CAMERAS[0]!;
        cx.fillText(texts.camera.title(cam.id, texts.sectors[cam.sector]), 70, h / 2 - 14);
        cx.fillStyle = GOLD;
        cx.font = `500 24px ${MONO}`;
        cx.fillText(texts.camera.note, 70, h / 2 + 26);
      }),
    [texts],
  );
  useEffect(() => () => [sign, status, projects, camTitle].forEach((t) => t.dispose()), [sign, status, projects, camTitle]);
  const feedMat = useMemo(() => new THREE.MeshBasicMaterial({ map: feed, toneMapped: true }), [feed]);
  useEffect(() => () => feedMat.dispose(), [feedMat]);
  const root = useRef<THREE.Group>(null);
  useMerged(root, [texts, status]);
  return (
    <group ref={root}>
      <FloorShell index={index} m={m} />
      <CoreFront y={y} top={top} m={m} doors={doors} indicator={indicator} />
      <Panel p={[0, y + 3.18, c.maxZ + 0.02]} w={2.6} h={0.65} map={sign} />
      {/* Tapete e a mesa da presidência, de frente para a cidade (ao sul, a praça e a avenida). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.02, -77.8]} material={m.fabric}>
        <planeGeometry args={[7.5, 4.2]} />
      </mesh>
      <Box p={[0, y + 0.73, -77.3]} s={[5.2, 0.06, 1.2]} m={m.dark} />
      <Box p={[0, y + 0.37, -77.3]} s={[4.6, 0.7, 0.9]} m={m.desk} />
      <Box p={[0, y + 0.765, -76.72]} s={[5.2, 0.015, 0.03]} m={m.gold} />
      {[-0.9, 0.9].map((dx) => (
        <group key={dx}>
          <Box p={[dx, y + 1.0, -77.75]} s={[0.9, 0.5, 0.04]} m={m.dark} />
          <Box p={[dx, y + 1.0, -77.725]} s={[0.84, 0.44, 0.01]} m={m.monitor} />
        </group>
      ))}
      {/* Cadeira da presidência, de costas para o núcleo, olhando a vista. */}
      <Box p={[0, y + 0.5, -78.6]} s={[0.7, 0.12, 0.7]} m={m.dark} />
      <Box p={[0, y + 1.0, -78.95]} s={[0.7, 0.9, 0.12]} m={m.dark} />
      {/* Mesa de reuniões, a oeste, de frente para a tela da câmera e dos projetos. */}
      <Box p={[-6.8, y + 0.72, -83]} s={[3.2, 0.06, 5.2]} m={m.desk} />
      <Box p={[-6.8, y + 0.35, -83]} s={[0.4, 0.7, 4]} m={m.dark} />
      {[-85, -83, -81].flatMap((z) => [-8.9, -4.7].map((x) => <Box key={`${x}${z}`} p={[x, y + 0.45, z]} s={[0.55, 0.9, 0.55]} m={m.fabric} />))}
      {/* Estações de trabalho a leste, diante da tela do estado dos setores. */}
      {[-86, -83.5].map((z) => (
        <group key={z}>
          <Box p={[6.6, y + 0.74, z]} s={[1.6, 0.05, 1.1]} m={m.desk} />
          <Box p={[6.6, y + 0.37, z]} s={[0.1, 0.7, 0.9]} m={m.dark} />
          <Box p={[6.1, y + 1.05, z]} s={[0.04, 0.5, 0.9]} m={m.dark} />
          <Box p={[6.08, y + 1.05, z]} s={[0.01, 0.44, 0.84]} m={m.monitor} />
        </group>
      ))}
      {/* Telas gigantes nas faces do núcleo: estado dos setores (leste), câmera do setor e projetos (oeste). */}
      <Box p={[c.maxX + 0.06, y + 1.95, (c.minZ + c.maxZ) / 2]} s={[0.1, 3.0, 5.6]} m={m.dark} />
      <Panel p={[c.maxX + 0.12, y + 1.95, (c.minZ + c.maxZ) / 2]} w={5.33} h={3.0} map={status} ry={Math.PI / 2} />
      <Box p={[c.minX - 0.06, y + 1.95, (c.minZ + c.maxZ) / 2]} s={[0.1, 3.0, 5.6]} m={m.dark} />
      <group userData={{ dynamic: true }}>
        <mesh position={[c.minX - 0.12, y + 2.15, -85.95]} rotation={[0, -Math.PI / 2, 0]} material={feedMat}>
          <planeGeometry args={[3.6, 2.025]} />
        </mesh>
      </group>
      <Panel p={[c.minX - 0.12, y + 0.82, -85.95]} w={3.6} h={0.45} map={camTitle} ry={-Math.PI / 2} />
      <Panel p={[c.minX - 0.12, y + 1.95, -82.9]} w={2.2} h={1.1} map={projects} ry={-Math.PI / 2} />
    </group>
  );
}

/**
 * A Torre Bezalel por dentro. Só desenha o que o visitante pode ver: a recepção (com a câmera a até
 * `INTERIOR_REVEAL` metros), a cabina do elevador e o andar em que ele está. A Engenharia também é
 * desenhada para a câmera ENG-01 enquanto o visitante está na presidência, numa camada que a câmera
 * principal não vê. Tudo o que é estático vira poucas malhas (`mergeStatic`).
 */
export function TowerInterior({ runtime, texts }: { runtime: UniverseRuntime; texts: TowerTexts }) {
  const m = useInteriorMaterials();
  const { scene, gl } = useThree();
  const lobby = useRef<THREE.Group>(null);
  const eng = useRef<THREE.Group>(null);
  const pres = useRef<THREE.Group>(null);
  const cabin = useRef<THREE.Group>(null);
  // Folhas da porta do elevador em cada andar com interior (a cena as move pelo estado da porta).
  const doors0 = useRef<Array<THREE.Object3D | null>>([]);
  const doors3 = useRef<Array<THREE.Object3D | null>>([]);
  const doorsTop = useRef<Array<THREE.Object3D | null>>([]);
  const cabinDoors = useRef<Array<THREE.Object3D | null>>([]);
  const entry = useRef<Array<THREE.Object3D | null>>([]);
  // Mostradores: um por andar com interior e o da cabina (redesenhados quando o andar mostrado muda).
  const indicators = useMemo(() => {
    const make = () => makeCanvasTexture(256, 96);
    return { floor: make(), cabin: make() };
  }, []);
  useEffect(() => () => Object.values(indicators).forEach((i) => i.texture.dispose()), [indicators]);
  const shown = useRef('');
  // Imagem da câmera ENG-01 (o ambiente 3D de verdade), para a tela da presidência.
  const feed = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(512, 288, { samples: 0, depthBuffer: true });
    const c = SECTOR_CAMERAS[0]!;
    const cam = new THREE.PerspectiveCamera(c.fov, 16 / 9, 0.1, 40);
    cam.position.set(...c.position);
    cam.lookAt(...c.target);
    cam.layers.set(FEED_LAYER);
    cam.updateMatrixWorld();
    return { target, cam, elapsed: 0, clear: new THREE.Color() };
  }, []);
  useEffect(() => () => feed.target.dispose(), [feed]);
  // Três robôs trabalhando nas bancadas da Engenharia (representação: não são agentes operacionais).
  const crew = useMemo(() => {
    const colors = [GOLD, '#4f8bd6', '#5fb39a'];
    const bots = colors.map((c) => new Humanoid(c));
    const spots: Array<[number, number, number]> = [
      [-8.2, -80.9, 0],
      [6.2, -80.9, 0],
      [-5.8, -77.9, 0],
    ];
    bots.forEach((b, i) => {
      const [x, z, h] = spots[i]!;
      b.root.position.set(x, floorY(3), z);
      b.root.rotation.y = h;
    });
    const fleet = new HumanoidFleet(bots);
    return { bots, fleet, pose: { ...restPose(), type: 1 } };
  }, []);
  useEffect(() => () => crew.fleet.dispose(), [crew]);
  const engLayer = useRef(0);
  // Estado real dos setores, do runtime do backend (se configurado): ao montar e, com o visitante na
  // presidência, de minuto em minuto. Sem backend, a demonstração segue marcada.
  const [live, setLive] = useState<{ state: LiveState; rows: SectorRow[] }>(() => ({ state: 'off', rows: mergeSectorStatus(null) }));
  useEffect(() => {
    const ctl = new AbortController();
    let last = 0;
    const load = () => {
      last = Date.now();
      void fetchTowerLive(ctl.signal).then((r) => {
        if (!ctl.signal.aborted) setLive({ state: r.state, rows: mergeSectorStatus(r.data) });
      });
    };
    load();
    const id = setInterval(() => {
      if (runtime.tower.level === TOP_FLOOR && Date.now() - last > 60_000) load();
    }, 5000);
    return () => {
      ctl.abort();
      clearInterval(id);
    };
  }, [runtime]);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = runtime.tower;
    const e = t.elevator;
    const nearTower = Math.hypot(camera.position.x - TOWER.x, camera.position.z - (TOWER.z + 6)) < INTERIOR_REVEAL;
    // Viajando, nenhum andar é desenhado: só a cabina (senão a laje e o forro do andar que a cabina
    // cruza atravessavam a cabina). Parada num andar, ele volta (a porta se abre para ele).
    const moving = t.riding && e.phase === 'moving';
    const level = moving ? -1 : t.riding ? e.floor : t.level;
    const inside = nearTower && (t.level > 0 || t.riding || camera.position.y < TOWER.towerBase + 0.5);
    if (lobby.current) lobby.current.visible = nearTower && level === 0 && camera.position.y < TOWER.towerBase + 2;
    if (pres.current) pres.current.visible = inside && level === TOP_FLOOR;
    // Engenharia: no andar dela, pela câmera principal; na presidência, só pela câmera ENG-01.
    const engMain = inside && level === 3;
    const engFeed = inside && level === TOP_FLOOR;
    if (eng.current) {
      eng.current.visible = engMain || engFeed;
      const layer = engMain ? 0 : FEED_LAYER;
      if (layer !== engLayer.current) {
        engLayer.current = layer;
        // As peças originais que a junção escondeu ficam escondidas (senão seriam desenhadas duas vezes).
        eng.current.traverse((o) => {
          if (o.layers.mask !== MERGED_AWAY) o.layers.set(layer);
        });
      }
    }
    // Cabina: acompanha o elevador; visível com o visitante por perto (térreo) ou dentro da torre.
    if (cabin.current) {
      cabin.current.visible = nearTower && (inside || level === 0 || moving);
      cabin.current.position.y = e.y - TOWER.ground;
    }
    // Portas: as do andar onde a cabina está abrem com ela; as outras ficam fechadas.
    const open = e.door;
    for (const [k, list] of [
      [0, doors0.current],
      [3, doors3.current],
      [TOP_FLOOR, doorsTop.current],
    ] as const) {
      const here = k === e.floor && e.phase !== 'moving' ? open : 0;
      list.forEach((d) => d && (d.position.x = (d.userData.side as number) * here * TOWER.cabin.doorHalf * 0.98));
    }
    cabinDoors.current.forEach((d) => d && (d.position.x = (d.userData.side as number) * open * TOWER.cabin.doorHalf * 0.98));
    // Portas de vidro da entrada: abrem com alguém por perto.
    const w = runtime.walker;
    const entering = Math.abs(w.x - TOWER.x) < 3.5 && Math.abs(w.z - TOWER.lobby.glassZ) < 3 && t.level === 0;
    entry.current.forEach((d) => {
      if (!d) return;
      const want = entering ? 1 : 0;
      const cur = (d.userData.open as number | undefined) ?? 0;
      const next = cur + (want - cur) * Math.min(1, dt * 4);
      d.userData.open = next;
      d.position.x = (d.userData.side as number) * next * TOWER.lobby.doorHalf * 0.95;
    });
    // Mostradores: o andar da cabina e o sentido.
    const dir = e.phase === 'moving' && e.target !== null ? Math.sign(e.target - e.floor) || Math.sign(e.v) : 0;
    const label = `${e.floor === 0 ? 'T' : e.floor}|${dir}`;
    if (label !== shown.current) {
      shown.current = label;
      for (const ind of Object.values(indicators)) {
        drawIndicator(ind.ctx, 256, 96, e.floor === 0 ? 'T' : String(e.floor), dir);
        ind.texture.needsUpdate = true;
      }
    }
    // Robôs da Engenharia: digitando (só quando aparecem).
    if (eng.current?.visible) {
      crew.pose.time += dt;
      crew.bots.forEach((b) => b.apply(crew.pose));
      crew.fleet.sync();
    }
    // A câmera ENG-01 (≈4 vezes por segundo, só na presidência): o andar dela, pela camada própria.
    feed.elapsed += dt;
    if (engFeed && feed.elapsed >= 0.25) {
      feed.elapsed = 0;
      const prev = gl.getRenderTarget();
      // Sem refazer o mapa de sombras para esta vista (nos níveis com sombra dinâmica, ele seria
      // redesenhado a cada chamada de render).
      const shadows = gl.shadowMap.autoUpdate;
      gl.shadowMap.autoUpdate = false;
      gl.getClearColor(feed.clear);
      const alpha = gl.getClearAlpha();
      gl.setClearColor('#1a2140', 1);
      gl.setRenderTarget(feed.target);
      gl.clear();
      gl.render(scene, feed.cam);
      gl.setRenderTarget(prev);
      gl.setClearColor(feed.clear, alpha);
      gl.shadowMap.autoUpdate = shadows;
    }
  });

  const k = TOWER.cabin;
  const cabinCz = (k.minZ + k.maxZ) / 2;
  const cabinW = k.maxX - k.minX;
  const cabinD = k.maxZ - k.minZ;
  const g = TOWER.ground;
  return (
    <group>
      <group ref={lobby}>
        <Lobby m={m} texts={texts} doors={doors0} indicator={indicators.floor.texture} entry={entry} />
      </group>
      <group ref={eng} visible={false}>
        <Engineering m={m} texts={texts} doors={doors3} indicator={indicators.floor.texture} robots={crew.fleet.group} />
      </group>
      <group ref={pres} visible={false}>
        <Presidency m={m} texts={texts} doors={doorsTop} indicator={indicators.floor.texture} feed={feed.target.texture} rows={live.rows} live={live.state} />
      </group>
      {/* Cabina: piso, paredes e forro por dentro, luz, painel de botões e o mostrador sobre a porta. */}
      <group ref={cabin}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, g + 0.015, cabinCz]} material={m.floorDark}>
          <planeGeometry args={[cabinW, cabinD]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, g + k.height, cabinCz]} material={m.ceiling}>
          <planeGeometry args={[cabinW, cabinD]} />
        </mesh>
        <Box p={[0, g + k.height - 0.02, cabinCz]} s={[1.2, 0.02, 1.6]} m={m.light} />
        <mesh position={[k.minX + 0.005, g + k.height / 2, cabinCz]} rotation={[0, Math.PI / 2, 0]} material={m.wall}>
          <planeGeometry args={[cabinD, k.height]} />
        </mesh>
        <mesh position={[k.maxX - 0.005, g + k.height / 2, cabinCz]} rotation={[0, -Math.PI / 2, 0]} material={m.wall}>
          <planeGeometry args={[cabinD, k.height]} />
        </mesh>
        <mesh position={[0, g + k.height / 2, k.minZ + 0.005]} material={m.bronze}>
          <planeGeometry args={[cabinW, k.height]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (k.doorHalf + (k.maxX - k.doorHalf) / 2), g + k.height / 2, k.maxZ - 0.01]} rotation={[0, Math.PI, 0]} material={m.wall}>
            <planeGeometry args={[k.maxX - k.doorHalf, k.height]} />
          </mesh>
        ))}
        <mesh position={[0, g + k.height - 0.1, k.maxZ - 0.01]} rotation={[0, Math.PI, 0]} material={m.wall}>
          <planeGeometry args={[k.doorHalf * 2, 0.2]} />
        </mesh>
        <Box p={[k.maxX - 0.03, g + 1.25, k.maxZ - 0.5]} s={[0.04, 0.9, 0.36]} m={m.dark} />
        {FLOORS.filter((f) => f.status === 'open').map((f, i) => (
          <Box key={f.index} p={[k.maxX - 0.055, g + 1.0 + i * 0.22, k.maxZ - 0.5]} s={[0.01, 0.1, 0.1]} m={m.gold} />
        ))}
        {[-1, 1].map((s, i) => (
          <group key={s} ref={(o) => void (cabinDoors.current[i] = o)} userData={{ side: s }}>
            <Box p={[(s * k.doorHalf) / 2, g + (k.height - 0.2) / 2, k.maxZ - 0.06]} s={[k.doorHalf, k.height - 0.2, 0.04]} m={m.steel} />
          </group>
        ))}
        <Panel p={[0, g + k.height - 0.22, k.maxZ - 0.09]} w={0.7} h={0.26} map={indicators.cabin.texture} ry={Math.PI} />
      </group>
    </group>
  );
}
