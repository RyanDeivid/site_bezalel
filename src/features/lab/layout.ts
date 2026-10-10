import type { AgentId } from '@/types/domain';

/**
 * Planta do laboratório, compartilhada pela cena 3D, pela planta 2D e pelo
 * minimapa: uma única fonte de verdade para posições.
 *
 * Coordenadas em metros no plano XZ; o centro (0,0) é a Central de Operações.
 */
export const LAB_RADIUS = 16;
export const STATION_RADIUS = 9.5;
export const HUB_RADIUS = 3;
export const INTERACT_DISTANCE = 3.6;

/** Ordem das estações no sentido horário, a partir do norte (fundo da sala). */
export const STATION_ORDER: AgentId[] = ['scout', 'verifier', 'atlas', 'trend', 'sol'];

export interface StationLayout {
  id: AgentId;
  x: number;
  z: number;
  /** Ângulo (rad) da estação a partir do centro; a mesa fica voltada para o centro. */
  angle: number;
}

export const STATIONS: StationLayout[] = STATION_ORDER.map((id, i) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STATION_ORDER.length;
  return { id, angle, x: Math.cos(angle) * STATION_RADIUS, z: Math.sin(angle) * STATION_RADIUS };
});

export const stationById = (id: AgentId) => STATIONS.find((s) => s.id === id)!;

/** Fluxos de dados entre estações (além de cada estação ↔ central). */
export const STATION_LINKS: Array<[AgentId, AgentId]> = [
  ['scout', 'verifier'],
  ['verifier', 'atlas'],
  ['atlas', 'trend'],
];

/** Posição inicial do visitante: entre a Central e as estações do sul, olhando para a central. */
export const SPAWN = { x: 0, z: 6.5 };

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

export function createLabRuntime(): LabRuntime {
  return {
    keys: new Set(),
    joystick: { x: 0, y: 0 },
    player: { x: SPAWN.x, z: SPAWN.z, heading: Math.PI },
    target: null,
    camera: { yaw: 0, pitch: 0.62, distance: 11 },
    near: null,
  };
}

/** Mantém um ponto dentro da sala e fora das mesas e da central (colisão simples). */
export function constrainToFloor(x: number, z: number): { x: number; z: number } {
  let px = x;
  let pz = z;
  const r = Math.hypot(px, pz);
  const max = LAB_RADIUS - 1.2;
  if (r > max) {
    px = (px / r) * max;
    pz = (pz / r) * max;
  }
  const hubMin = HUB_RADIUS + 0.6;
  const rr = Math.hypot(px, pz);
  if (rr < hubMin && rr > 0.0001) {
    px = (px / rr) * hubMin;
    pz = (pz / rr) * hubMin;
  }
  for (const s of STATIONS) {
    const dx = px - s.x;
    const dz = pz - s.z;
    const d = Math.hypot(dx, dz);
    const min = 1.9;
    if (d < min && d > 0.0001) {
      px = s.x + (dx / d) * min;
      pz = s.z + (dz / d) * min;
    }
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
