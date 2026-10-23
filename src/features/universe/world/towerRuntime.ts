import type { Solid } from './city';
import { atCoreDoor, cabinSolids, ceilingY, createElevator, doorSolid, floorBounds, floorSolids, floorY, insideCabin, insideFloor, insideLobby, requestFloor, stepElevator, TOWER, type ElevatorRequest, type ElevatorState } from './tower';

/**
 * O visitante dentro da Torre Bezalel: em que andar está, se está viajando na cabina, o que ele pode fazer
 * agora (chamar o elevador, usar o painel) e com quais paredes colide. Mutável, como o resto do runtime;
 * a cena avança e o HUD lê.
 */
export interface TowerRuntime {
  /** Andar em que o visitante está (0 = térreo ou a rua). */
  level: number;
  elevator: ElevatorState;
  /** Está na cabina com a porta fechada (ou já viajando): a cabina o leva. */
  riding: boolean;
  /** Ação disponível agora (o HUD mostra o botão e a tecla E a executa). */
  prompt: 'call' | 'panel' | null;
  /** Resposta ao último pedido (para o HUD explicar um destino indisponível). */
  lastRequest: ElevatorRequest | null;
  /** Eventos do elevador para o som (a cena toca e esvazia). */
  events: Array<'arrived' | 'opened' | 'closed'>;
}

export function createTowerRuntime(): TowerRuntime {
  return { level: 0, elevator: createElevator(0), riding: false, prompt: null, lastRequest: null, events: [] };
}

/** Porta aberta o bastante para passar (e a cabina parada no andar dela). */
const doorPassable = (e: ElevatorState) => e.door > 0.85 && e.phase !== 'moving';

/** Alguém no vão da porta (entre a cabina e o andar): ela não fecha. */
function inDoorway(x: number, z: number): boolean {
  const { cabin: k, core: c } = TOWER;
  return Math.abs(x - TOWER.x) < k.doorHalf + 0.2 && z > k.maxZ - 0.45 && z < c.maxZ + 0.45;
}

/**
 * Onde o visitante pisa e com o que ele colide neste passo:
 * - na rua e no térreo: a cidade (o pódio oco, o núcleo) e, com a porta fechada, a porta do elevador;
 * - num andar da torre: as paredes dele (a fachada por dentro, o núcleo, os móveis);
 * - viajando: a cabina.
 */
export function towerContext(t: TowerRuntime, walker: { x: number; y: number; z: number }, citySolids: Solid[]): { solids: Solid[]; floor: number | null; ceiling: number | null } {
  const e = t.elevator;
  const open = doorPassable(e);
  if (t.riding) {
    // Chegou com a porta aberta: o andar e a cabina viram um espaço só (sai andando).
    if (open && e.target === null) return { solids: t.level === 0 ? citySolids : floorSolids(t.level, true), floor: floorY(t.level), ceiling: ceilingY(t.level) };
    return { solids: cabinSolids(e.y, false), floor: e.y, ceiling: e.y + TOWER.cabin.height };
  }
  if (t.level === 0) {
    const doorHere = open && e.floor === 0;
    const solids = doorHere ? citySolids : [...citySolids, doorSolid(TOWER.ground)];
    const inside = insideLobby(walker.x, walker.z) || insideCabin(walker.x, walker.z);
    return { solids, floor: null, ceiling: inside ? ceilingY(0) : null };
  }
  return { solids: floorSolids(t.level, open && e.floor === t.level), floor: floorY(t.level), ceiling: ceilingY(t.level) };
}

/**
 * Avança o elevador e o estado do visitante na torre (no passo fixo da simulação). Depois do passo do
 * visitante: decide se ele está viajando, em que andar desceu e qual ação está ao alcance.
 */
export function stepTower(t: TowerRuntime, walker: { x: number; y: number; z: number }, dt: number, onFoot: boolean): void {
  const e = t.elevator;
  const inCabin = onFoot && insideCabin(walker.x, walker.z) && Math.abs(walker.y - e.y) < 1.5;
  const ev = stepElevator(e, dt, onFoot && inDoorway(walker.x, walker.z) && Math.abs(walker.y - e.y) < 1.5);
  if (ev) t.events.push(ev);
  // Embarcou: está na cabina e a porta começou a fechar (ou a cabina já partiu).
  if (inCabin && (e.phase === 'closing' || e.phase === 'moving')) t.riding = true;
  if (t.riding) {
    walker.y = e.y;
    if (e.target === null && e.phase !== 'moving') t.level = e.floor;
    // Saiu da cabina (porta aberta): agora está no andar.
    if (!insideCabin(walker.x, walker.z) && doorPassable(e)) t.riding = false;
  }
  // Num andar da torre só se entra e sai pelo elevador: se algo o puser fora da planta (não deveria), ele
  // volta para dentro dela, em vez de cair na cidade lá embaixo.
  if (!t.riding && t.level > 0 && !insideFloor(t.level, walker.x, walker.z)) {
    const b = floorBounds(t.level);
    walker.x = Math.min(b.maxX - 0.5, Math.max(b.minX + 0.5, walker.x));
    walker.z = Math.min(b.maxZ - 0.5, Math.max(b.minZ + 0.5, walker.z));
    walker.y = floorY(t.level);
  }
  // A ação ao alcance.
  if (!onFoot) t.prompt = null;
  else if (inCabin && (doorPassable(e) || t.riding) && e.phase !== 'moving') t.prompt = 'panel';
  else if (atCoreDoor(walker.x, walker.z) && !(doorPassable(e) && e.floor === t.level)) t.prompt = 'call';
  else t.prompt = null;
}

/** Chamar o elevador ao andar do visitante. */
export function callElevator(t: TowerRuntime): ElevatorRequest {
  t.lastRequest = requestFloor(t.elevator, t.level);
  return t.lastRequest;
}

/** Escolher um destino no painel da cabina. */
export function chooseFloor(t: TowerRuntime, index: number): ElevatorRequest {
  t.lastRequest = requestFloor(t.elevator, index);
  return t.lastRequest;
}
