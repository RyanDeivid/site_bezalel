import type { AgentEvent, AgentId } from '@/types/domain';

/**
 * Planta do campus do laboratório, compartilhada pela cena 3D, pela planta 2D
 * e pelo minimapa: uma única fonte de verdade para posições.
 *
 * Coordenadas em metros no plano XZ; o centro (0,0) é a Central de Operações.
 * X cresce para a direita e Z "para baixo" na planta (em direção a quem entra).
 *
 * v2 · Fase 3: o campus tem ~3× a área do laboratório da v1 (raio 16 → 28 m)
 * e seis setores — um por agente — em volta da Central. A entrada fica ao
 * sul, no vão entre os setores de Sol e Trend.
 */
export const LAB_RADIUS = 28;
/** Distância do centro de cada setor até a Central. */
export const SECTOR_RADIUS = 17;
/** Raio do pavilhão hexagonal de cada setor (centro → vértice). */
export const SECTOR_SIZE = 5.4;
export const HUB_RADIUS = 3.2;
/** Praça em volta da Central (piso de pedra clara). */
export const PLAZA_RADIUS = 6.4;
/** Anel de circulação entre a praça e os pavilhões: por onde os robôs carregam registros. */
export const RING_RADIUS = 10.6;
/** Dentro deste raio do centro de um setor, o visitante está "no setor". */
export const INTERACT_DISTANCE = 6.4;

/**
 * Ângulo de cada setor (rad, a partir de +X no sentido horário da planta).
 * O pipeline corre no sentido horário a partir da entrada: Sol recebe quem
 * chega, Scout descobre, Verifier valida, Vigia reconfere (vizinho do
 * Verifier, para quem devolve os vencidos), Atlas relaciona e Trend analisa.
 */
const deg = (d: number) => (d * Math.PI) / 180;
const SECTOR_ANGLES: Record<AgentId, number> = {
  sol: deg(120),
  scout: deg(180),
  verifier: deg(240),
  vigia: deg(300),
  atlas: deg(0),
  trend: deg(60),
};

/** Ordem dos agentes no pipeline (listas, teclado, leitores de tela). */
export const STATION_ORDER: AgentId[] = ['scout', 'verifier', 'vigia', 'atlas', 'trend', 'sol'];

export interface StationLayout {
  id: AgentId;
  x: number;
  z: number;
  /** Ângulo (rad) do setor a partir do centro; o console fica voltado para a Central. */
  angle: number;
}

export const STATIONS: StationLayout[] = STATION_ORDER.map((id) => {
  const angle = SECTOR_ANGLES[id];
  return { id, angle, x: Math.cos(angle) * SECTOR_RADIUS, z: Math.sin(angle) * SECTOR_RADIUS };
});

export const stationById = (id: AgentId) => STATIONS.find((s) => s.id === id)!;

/** Ângulo da entrada do campus (sul). */
export const ENTRANCE_ANGLE = deg(90);

/** Fluxos de dados entre setores (além de cada setor ↔ Central). */
export const STATION_LINKS: Array<[AgentId, AgentId]> = [
  ['scout', 'verifier'],
  ['verifier', 'atlas'],
  ['vigia', 'verifier'],
  ['atlas', 'trend'],
];

/** Posição inicial do visitante: logo depois da entrada, olhando para a Central. */
export const SPAWN = { x: 0, z: 13.5 };

// ---- Obstáculos (colisão simples por círculos) ------------------------------------

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

/** Ponto a `along` metros do centro do setor, na direção da Central (negativo = para o fundo). */
export function sectorPoint(s: StationLayout, along: number, side = 0): { x: number; z: number } {
  // Eixo "frente" do setor aponta para a Central; "lado" é perpendicular.
  const fx = -Math.cos(s.angle);
  const fz = -Math.sin(s.angle);
  return { x: s.x + fx * along - fz * side, z: s.z + fz * along + fx * side };
}

/** Posições dos equipamentos de um setor (eixo "frente" = em direção à Central). */
export const SECTOR_SPOTS = {
  console: 2.1,
  operator: 1.15,
  machine: -0.9,
  wall: -3.6,
  sideScreen: { along: -2.9, side: 2.75 },
} as const;

/** Console (frente do pavilhão), máquina do agente (centro) e monitores (fundo). */
export const OBSTACLES: Obstacle[] = STATIONS.flatMap((s) => [
  { ...sectorPoint(s, SECTOR_SPOTS.console), r: 1.3 },
  { ...sectorPoint(s, SECTOR_SPOTS.machine), r: 1.45 },
  { ...sectorPoint(s, SECTOR_SPOTS.wall, -1), r: 1 },
  { ...sectorPoint(s, SECTOR_SPOTS.wall, 1), r: 1 },
  { ...sectorPoint(s, SECTOR_SPOTS.sideScreen.along, -SECTOR_SPOTS.sideScreen.side), r: 0.6 },
  { ...sectorPoint(s, SECTOR_SPOTS.sideScreen.along, SECTOR_SPOTS.sideScreen.side), r: 0.6 },
]);

// ---- Estado de execução -------------------------------------------------------------

/**
 * Estado mutável compartilhado entre a cena 3D e o HUD (minimapa, joystick).
 * Fica fora do estado do React de propósito: muda a cada quadro.
 */
export interface LabRuntime {
  keys: Set<string>;
  joystick: { x: number; y: number };
  player: { x: number; z: number; heading: number };
  target: { x: number; z: number } | null;
  camera: { yaw: number; pitch: number; distance: number };
  near: AgentId | null;
}

/** Onde o visitante começa: na entrada ou, com `?setor=`, de frente para um setor. */
export function spawnPose(at?: AgentId | null): { player: LabRuntime['player']; camera: LabRuntime['camera'] } {
  if (!at) return { player: { x: SPAWN.x, z: SPAWN.z, heading: Math.PI }, camera: { yaw: 0, pitch: 0.6, distance: 13 } };
  const s = stationById(at);
  // Na frente do balcão, olhando para o setor; câmera atrás, do lado da Central.
  const p = sectorPoint(s, 6.2);
  const toHub = Math.atan2(-Math.cos(s.angle), -Math.sin(s.angle));
  return { player: { x: p.x, z: p.z, heading: toHub + Math.PI }, camera: { yaw: toHub, pitch: 0.5, distance: 9 } };
}

export function createLabRuntime(at?: AgentId | null): LabRuntime {
  const pose = spawnPose(at);
  return {
    keys: new Set(),
    joystick: { x: 0, y: 0 },
    player: pose.player,
    target: null,
    camera: pose.camera,
    near: null,
  };
}

/** Mantém um ponto dentro do campus e fora da Central e dos equipamentos (colisão simples). */
export function constrainToFloor(x: number, z: number): { x: number; z: number } {
  let px = x;
  let pz = z;
  const r = Math.hypot(px, pz);
  const max = LAB_RADIUS - 1.4;
  if (r > max) {
    px = (px / r) * max;
    pz = (pz / r) * max;
  }
  const hubMin = HUB_RADIUS + 0.7;
  const rr = Math.hypot(px, pz);
  if (rr < hubMin && rr > 0.0001) {
    px = (px / rr) * hubMin;
    pz = (pz / rr) * hubMin;
  }
  // Equipamentos vizinhos se encostam: algumas passadas resolvem empurrões em cadeia.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of OBSTACLES) {
      const dx = px - o.x;
      const dz = pz - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + 0.45;
      if (d < min && d > 0.0001) {
        px = o.x + (dx / d) * min;
        pz = o.z + (dz / d) * min;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: px, z: pz };
}

export function nearestStation(x: number, z: number): { id: AgentId; distance: number } {
  let best = { id: STATIONS[0]!.id, distance: Number.POSITIVE_INFINITY };
  for (const s of STATIONS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < best.distance) best = { id: s.id, distance: d };
  }
  return best;
}

// ---- Rotas dos robôs carregadores ---------------------------------------------------

export type Place = AgentId | 'hub';
/** O que a cena precisa saber do último evento (pulso nos fluxos, entrega dos robôs). */
export type LabPulse = Pick<AgentEvent, 'id' | 'agentId' | 'type' | 'entityLabel'>;
export interface Point2 {
  x: number;
  z: number;
}

/** Doca de um setor: onde o anel de circulação encontra o caminho do setor. */
export function dockOf(id: AgentId): Point2 {
  const a = SECTOR_ANGLES[id];
  return { x: Math.cos(a) * RING_RADIUS, z: Math.sin(a) * RING_RADIUS };
}

/** Borda da praça da Central na direção de um ângulo. */
function hubPort(angle: number): Point2 {
  const r = PLAZA_RADIUS - 0.6;
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

/** Balcão de entrega dentro do setor (na frente do console). */
function counterOf(id: AgentId): Point2 {
  return sectorPoint(stationById(id), 4.1);
}

/** Menor diferença angular de `a` para `b`, em (-π, π]. */
function angleTo(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Caminho (pontos no piso) de um lugar a outro: do balcão do setor até a doca,
 * pelo anel de circulação no sentido mais curto, e da doca ao balcão de
 * destino. A Central é alcançada pelo caminho radial do setor.
 */
export function routePath(from: Place, to: Place): Point2[] {
  if (from === to) return [];
  if (from === 'hub' && to !== 'hub') {
    const a = SECTOR_ANGLES[to];
    return [hubPort(a), dockOf(to), counterOf(to)];
  }
  if (to === 'hub' && from !== 'hub') {
    const a = SECTOR_ANGLES[from];
    return [counterOf(from), dockOf(from), hubPort(a)];
  }
  const a0 = SECTOR_ANGLES[from as AgentId];
  const delta = angleTo(a0, SECTOR_ANGLES[to as AgentId]);
  const steps = Math.max(2, Math.ceil(Math.abs(delta) / deg(12)));
  const arc: Point2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (delta * i) / steps;
    arc.push({ x: Math.cos(a) * RING_RADIUS, z: Math.sin(a) * RING_RADIUS });
  }
  return [counterOf(from as AgentId), ...arc, counterOf(to as AgentId)];
}

export function pathLength(path: Point2[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
  return total;
}

/** Ponto a `distance` metros do início do caminho e a direção (rad) do trecho. */
export function pointAlong(path: Point2[], distance: number): { x: number; z: number; heading: number } {
  let left = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= len || i === path.length - 1) {
      const t = len > 0 ? Math.min(1, left / len) : 1;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    left -= len;
  }
  const p = path[0] ?? { x: 0, z: 0 };
  return { x: p.x, z: p.z, heading: 0 };
}

/**
 * Que entrega um evento representa no campus (de onde para onde um robô leva
 * o registro). `null` = o trabalho acontece dentro do próprio setor.
 */
export function deliveryFor(event: Pick<AgentEvent, 'agentId' | 'type' | 'entityLabel'>): { from: Place; to: Place } | null {
  switch (event.type) {
    case 'opportunity.discovered':
      return { from: 'scout', to: 'verifier' };
    case 'record.published':
      return { from: 'verifier', to: 'hub' };
    case 'record.outdated':
      return { from: 'vigia', to: 'verifier' };
    case 'freshness.checked':
      return { from: 'hub', to: 'vigia' };
    case 'graph.linked':
      return event.entityLabel === 'skill-graph' ? { from: 'atlas', to: 'hub' } : { from: 'hub', to: 'atlas' };
    case 'trend.analyzed':
      return { from: 'hub', to: 'trend' };
    case 'assistant.query':
      return { from: 'hub', to: 'sol' };
    default:
      return null;
  }
}

/**
 * Caminho entre dois pontos da área de circulação (entre a praça e os
 * pavilhões): sai radialmente até o anel, segue por ele no sentido mais curto
 * e entra radialmente. Nunca corta a Central nem os pavilhões.
 */
export function travelPath(a: Point2, b: Point2): Point2[] {
  const a0 = Math.atan2(a.z, a.x);
  const delta = angleTo(a0, Math.atan2(b.z, b.x));
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / deg(12)));
  const arc: Point2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = a0 + (delta * i) / steps;
    arc.push({ x: Math.cos(t) * RING_RADIUS, z: Math.sin(t) * RING_RADIUS });
  }
  return [a, ...arc, b];
}

/** Vagas dos robôs carregadores na borda da praça, longe do caminho da entrada. */
const PARKING_ANGLES = [deg(15), deg(165), deg(195), deg(345), deg(225), deg(315), deg(255), deg(285)];
export const PARKING_SPOTS = PARKING_ANGLES.length;

export function parkingSpot(i: number): Point2 {
  const a = PARKING_ANGLES[i % PARKING_ANGLES.length]!;
  const r = PLAZA_RADIUS + 1.2;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}
