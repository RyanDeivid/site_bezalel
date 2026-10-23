import { LANE_OFFSET, STREET_LINES, type Point2, type Quality } from './city';
import type { CarClass } from './vehicles';

/**
 * Trânsito do Bezalel Universe: rotas descritas por dados (sequências de
 * cruzamentos) e uma simulação pura, de passo fixo, determinística — o mesmo
 * estado inicial produz sempre o mesmo trânsito, no navegador e nos testes.
 *
 * Mão de direção: pela direita. Cada rota vira um laço de pontos na faixa da
 * direita, com as esquinas arredondadas. Os veículos mantêm distância de quem
 * está à frente na mesma trajetória (inclusive quem cruza a frente num
 * cruzamento) — sem física, só uma regra de seguimento.
 *
 * Rotas aéreas (`kind: 'air'`) já cabem no tipo: a altitude vai em `altitude`
 * e a mesma simulação serve; nesta fase só há rotas terrestres.
 */

export type RouteId = string;
export type VehicleKind = 'ground' | 'air';

export interface RouteSpec {
  id: RouteId;
  kind: VehicleKind;
  /** Cruzamentos em ordem, como índices em STREET_LINES: [coluna (x), linha (z)]. O laço fecha sozinho. */
  nodes: Array<[number, number]>;
  /** Altitude de cruzeiro (rotas aéreas). */
  altitude?: number;
  /** Quantos veículos em cada nível de qualidade. */
  vehicles: Record<Quality, number>;
}

export interface Route {
  id: RouteId;
  kind: VehicleKind;
  altitude: number;
  points: Point2[];
  /** Distância acumulada até cada ponto (o último fecha o laço). */
  cumulative: number[];
  length: number;
}

export const ROUTES: RouteSpec[] = [
  // Anel em volta da praça, nos dois sentidos.
  { id: 'plaza-ring-cw', kind: 'ground', nodes: [[2, 2], [3, 2], [3, 3], [2, 3]], vehicles: { ultra: 4, high: 4, medium: 3, low: 2 } },
  { id: 'plaza-ring-ccw', kind: 'ground', nodes: [[2, 3], [3, 3], [3, 2], [2, 2]], vehicles: { ultra: 3, high: 3, medium: 2, low: 1 } },
  // Anel médio (em volta das quadras institucionais).
  { id: 'midtown-cw', kind: 'ground', nodes: [[1, 1], [4, 1], [4, 4], [1, 4]], vehicles: { ultra: 6, high: 5, medium: 3, low: 2 } },
  { id: 'midtown-ccw', kind: 'ground', nodes: [[1, 4], [4, 4], [4, 1], [1, 1]], vehicles: { ultra: 5, high: 4, medium: 3, low: 1 } },
  // Avenida de contorno da cidade.
  { id: 'outer-cw', kind: 'ground', nodes: [[0, 0], [5, 0], [5, 5], [0, 5]], vehicles: { ultra: 8, high: 6, medium: 4, low: 2 } },
  { id: 'outer-ccw', kind: 'ground', nodes: [[0, 5], [5, 5], [5, 0], [0, 0]], vehicles: { ultra: 7, high: 5, medium: 3, low: 1 } },
  // Laços de quadra: passam pela frente da sede, do laboratório e do centro de produtos.
  { id: 'hq-loop', kind: 'ground', nodes: [[2, 1], [3, 1], [3, 2], [2, 2]], vehicles: { ultra: 3, high: 2, medium: 1, low: 1 } },
  { id: 'lab-loop', kind: 'ground', nodes: [[3, 2], [4, 2], [4, 3], [3, 3]], vehicles: { ultra: 3, high: 2, medium: 1, low: 1 } },
  { id: 'products-loop', kind: 'ground', nodes: [[1, 3], [2, 3], [2, 2], [1, 2]], vehicles: { ultra: 3, high: 2, medium: 1, low: 0 } },
  // Travessias: atravessam a cidade de ponta a ponta pelas avenidas do centro.
  { id: 'cross-north-south', kind: 'ground', nodes: [[2, 0], [3, 0], [3, 5], [2, 5]], vehicles: { ultra: 3, high: 3, medium: 2, low: 1 } },
  { id: 'cross-east-west', kind: 'ground', nodes: [[0, 2], [5, 2], [5, 3], [0, 3]], vehicles: { ultra: 3, high: 3, medium: 2, low: 1 } },
];

const CORNER_RADIUS = 5;

/** Ponto de um cruzamento. */
export const nodePoint = ([i, j]: [number, number]): Point2 => ({ x: STREET_LINES[i]!, z: STREET_LINES[j]! });

const unit = (a: Point2, b: Point2): Point2 => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz) || 1;
  return { x: dx / d, z: dz / d };
};
/** À direita de quem anda na direção `d` (x leste, z sul). */
const rightOf = (d: Point2): Point2 => ({ x: -d.z, z: d.x });

/** Constrói o laço da faixa da direita, com esquinas arredondadas. */
export function buildRoute(spec: RouteSpec): Route {
  const nodes = spec.nodes.map(nodePoint);
  const n = nodes.length;
  const points: Point2[] = [];
  for (let k = 0; k < n; k++) {
    const prev = nodes[(k - 1 + n) % n]!;
    const here = nodes[k]!;
    const next = nodes[(k + 1) % n]!;
    const dIn = unit(prev, here);
    const dOut = unit(here, next);
    const rIn = rightOf(dIn);
    const rOut = rightOf(dOut);
    const straight = Math.abs(dIn.x * dOut.x + dIn.z * dOut.z) > 0.99;
    const corner = straight
      ? { x: here.x + rIn.x * LANE_OFFSET, z: here.z + rIn.z * LANE_OFFSET }
      : { x: here.x + (rIn.x + rOut.x) * LANE_OFFSET, z: here.z + (rIn.z + rOut.z) * LANE_OFFSET };
    if (straight) {
      points.push(corner);
      continue;
    }
    // Curva: entra R metros antes da esquina e sai R metros depois, por uma Bézier quadrática.
    const a = { x: corner.x - dIn.x * CORNER_RADIUS, z: corner.z - dIn.z * CORNER_RADIUS };
    const b = { x: corner.x + dOut.x * CORNER_RADIUS, z: corner.z + dOut.z * CORNER_RADIUS };
    for (let t = 0; t <= 4; t++) {
      const u = t / 4;
      points.push({
        x: (1 - u) ** 2 * a.x + 2 * (1 - u) * u * corner.x + u ** 2 * b.x,
        z: (1 - u) ** 2 * a.z + 2 * (1 - u) * u * corner.z + u ** 2 * b.z,
      });
    }
  }
  const cumulative = [0];
  for (let k = 1; k <= points.length; k++) {
    const a = points[k - 1]!;
    const b = points[k % points.length]!;
    cumulative.push(cumulative[k - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  return { id: spec.id, kind: spec.kind, altitude: spec.altitude ?? 0, points, cumulative, length: cumulative[points.length]! };
}

/** Posição e direção a `s` metros do início do laço. */
export function sampleRoute(route: Route, s: number): { x: number; z: number; heading: number } {
  const L = route.length;
  const d = ((s % L) + L) % L;
  // Busca binária no comprimento acumulado.
  let lo = 0;
  let hi = route.points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (route.cumulative[mid]! <= d) lo = mid;
    else hi = mid - 1;
  }
  const a = route.points[lo]!;
  const b = route.points[(lo + 1) % route.points.length]!;
  const seg = route.cumulative[lo + 1]! - route.cumulative[lo]!;
  const t = seg > 0 ? (d - route.cumulative[lo]!) / seg : 0;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}

export interface Vehicle {
  id: number;
  route: number;
  /** Distância percorrida no laço (cresce sem parar; a posição usa o resto). */
  s: number;
  speed: number;
  x: number;
  z: number;
  heading: number;
  /** Cor da carroceria (índice na paleta da cena). */
  paint: number;
  /** Modelo (sedã, esportivo, táxi): cada um tem velocidade e desenho próprios. */
  cls: CarClass;
  /** Velocidade de cruzeiro deste veículo (m/s): varia por modelo e um pouco por motorista. */
  cruise: number;
  /** Há quanto tempo (s) espera na porta de um cruzamento: quem chegou antes passa antes. */
  wait: number;
}

/** Obstáculo externo que o trânsito respeita (o visitante a pé ou o carro que ele dirige). */
export interface TrafficObstacle {
  x: number;
  z: number;
}

export interface TrafficState {
  routes: Route[];
  vehicles: Vehicle[];
  time: number;
}

/** Passo fixo da simulação (s): independe da taxa de quadros. */
export const TRAFFIC_STEP = 1 / 30;
export const CRUISE_SPEED = 10;
const CLASSES: CarClass[] = ['sedan', 'taxi', 'sedan', 'sport', 'taxi', 'sedan', 'sport'];
const CLASS_PACE: Record<CarClass, number> = { sedan: 1, sport: 1.12, taxi: 0.9 };
const ACCEL = 3.5;
const BRAKE = 10;
/** Frenagem de conforto que o perfil de aproximação usa (abaixo de BRAKE: sempre dá para seguir o perfil). */
const COMFORT_BRAKE = 4.5;
const LOOK_AHEAD = 12;
const LANE_HALF = 3.2;
const MIN_GAP = 5.5;
/** Raio da zona de um cruzamento: só um veículo dentro por vez. */
export const ZONE_RADIUS = 10;
/** Faixa antes da zona em que o veículo já decide se para (cabe a frenagem a partir da velocidade de cruzeiro). */
const ZONE_BAND = 12;
export const MIN_SPAWN_GAP = 9;
const STOP_LINE = 1.5;

function place(v: Vehicle, routes: Route[]) {
  const p = sampleRoute(routes[v.route]!, v.s);
  v.x = p.x;
  v.z = p.z;
  v.heading = p.heading;
}

/** Estado inicial: veículos espaçados ao longo de cada rota, sem ninguém em cima de ninguém. */
export function createTraffic(quality: Quality, specs: RouteSpec[] = ROUTES): TrafficState {
  const routes = specs.map(buildRoute);
  const vehicles: Vehicle[] = [];
  routes.forEach((route, r) => {
    const count = specs[r]!.vehicles[quality];
    for (let k = 0; k < count; k++) {
      const id = vehicles.length;
      const cls = CLASSES[id % CLASSES.length]!;
      // Variação determinística de ±5% por motorista (nem todos andam igual).
      const cruise = CRUISE_SPEED * CLASS_PACE[cls] * (0.95 + ((id * 37) % 11) / 100);
      const v: Vehicle = { id, route: r, s: (route.length * k) / count + r * 17, speed: cruise * 0.6, x: 0, z: 0, heading: 0, paint: id % 4, cls, cruise, wait: 0 };
      place(v, routes);
      // Rotas compartilham trechos: avança até achar um lugar livre.
      for (let tries = 0; tries < 60 && vehicles.some((o) => Math.hypot(o.x - v.x, o.z - v.z) < MIN_SPAWN_GAP); tries++) {
        v.s += MIN_SPAWN_GAP;
        place(v, routes);
      }
      vehicles.push(v);
    }
  });
  return { routes, vehicles, time: 0 };
}

/** Distância até o primeiro veículo na trajetória à frente (Infinity se livre). */
function gapAhead(v: Vehicle, all: Vehicle[], routes: Route[], ignore: (o: Vehicle) => boolean, obstacles: TrafficObstacle[]): { gap: number; blocker: number } {
  const dx = Math.sin(v.heading);
  const dz = Math.cos(v.heading);
  let gap = Infinity;
  let blocker = -1;
  for (const o of all) {
    if (o === v || ignore(o)) continue;
    if (o.route === v.route) {
      // Mesma rota: a distância ao longo do laço é exata, inclusive nas curvas.
      const L = routes[v.route]!.length;
      const along = (((o.s - v.s) % L) + L) % L;
      if (along > 0 && along <= LOOK_AHEAD && along < gap) {
        gap = along;
        blocker = o.id;
      }
      continue;
    }
    const rx = o.x - v.x;
    const rz = o.z - v.z;
    const f = rx * dx + rz * dz;
    if (f <= 0 || f > LOOK_AHEAD) continue;
    const lateral = Math.abs(rx * dz - rz * dx);
    if (lateral < LANE_HALF && f < gap) {
      gap = f;
      blocker = o.id;
    }
  }
  // O visitante (a pé ou dirigindo) na frente: freia e espera.
  for (const o of obstacles) {
    const rx = o.x - v.x;
    const rz = o.z - v.z;
    const f = rx * dx + rz * dz;
    if (f > 0 && f <= LOOK_AHEAD && Math.abs(rx * dz - rz * dx) < LANE_HALF && f < gap) {
      gap = f;
      blocker = -2;
    }
  }
  return { gap, blocker };
}

const NODES: Point2[] = STREET_LINES.flatMap((x) => STREET_LINES.map((z) => ({ x, z })));

/** Índice da rua mais próxima de uma coordenada (a primeira, no empate). */
function nearestLine(c: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < STREET_LINES.length; i++) {
    const d = Math.abs(STREET_LINES[i]! - c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Cruzamento mais próximo, a distância até ele e se o veículo está indo na direção dele. Os cruzamentos
 * formam uma grade (toda rua x com toda rua z): o mais próximo é o da rua mais próxima em cada eixo. São
 * duas buscas curtas em vez de medir a distância até todos os cruzamentos, para cada carro, a cada passo.
 */
function nearestNode(v: Vehicle): { node: number; distance: number; approaching: boolean } {
  const best = nearestLine(v.x) * STREET_LINES.length + nearestLine(v.z);
  const n = NODES[best]!;
  const bestD = Math.hypot(n.x - v.x, n.z - v.z);
  return { node: best, distance: bestD, approaching: (n.x - v.x) * Math.sin(v.heading) + (n.z - v.z) * Math.cos(v.heading) > 0 };
}

/**
 * Cruzamentos como zonas exclusivas (um semáforo implícito): quem está fora só
 * entra se a zona estiver vazia e ninguém mais perto dela estiver também na
 * porta — a prioridade é de quem espera há mais tempo (ordem de chegada),
 * depois de quem está mais perto, e por fim do menor id. Resolve as convergências de faixa — numa curva, quem entra na faixa
 * de outro não "corta a frente" de quem vem atrás. Devolve a distância até a
 * linha de parada, ou Infinity se pode seguir.
 */
function zoneGaps(vs: Vehicle[]): { gaps: number[]; inside: boolean[]; contending: boolean[] } {
  const at = vs.map(nearestNode);
  const inside = at.map((a) => a.distance < ZONE_RADIUS);
  const contending = at.map((a, i) => !inside[i] && a.approaching && a.distance <= ZONE_RADIUS + ZONE_BAND);
  /** j tem prioridade sobre i na mesma porta? */
  const before = (j: number, i: number) => {
    const dw = vs[j]!.wait - vs[i]!.wait;
    if (Math.abs(dw) > 0.05) return dw > 0;
    const dd = at[j]!.distance - at[i]!.distance;
    return Math.abs(dd) > 0.01 ? dd < 0 : j < i;
  };
  // Quem já não consegue parar antes da linha (a distância de frenagem passa dela)
  // ocupa a zona como se estivesse dentro: ninguém mais recebe passagem.
  const committed = vs.map((v, i) => !inside[i] && at[i]!.approaching && v.speed > 0.5 && at[i]!.distance - ZONE_RADIUS < (v.speed * v.speed) / (2 * BRAKE));
  const occupies = (j: number) => inside[j]! || committed[j]!;
  const gaps = vs.map((_, i) => {
    const a = at[i]!;
    if (occupies(i) || !contending[i]) return Infinity;
    const busy = vs.some((_, j) => j !== i && at[j]!.node === a.node && (occupies(j) || (contending[j] && before(j, i))));
    // A linha de parada fica STOP_LINE metros antes da zona: quem para nela nunca "escorrega" para dentro.
    return busy ? Math.max(0, a.distance - ZONE_RADIUS - STOP_LINE) + MIN_GAP : Infinity;
  });
  return { gaps, inside, contending };
}

/** Avança a simulação um passo fixo. Muta e devolve o mesmo estado (sem alocar por quadro). */
export function stepTraffic(state: TrafficState, obstacles: TrafficObstacle[] = []): TrafficState {
  const dt = TRAFFIC_STEP;
  const vs = state.vehicles;
  const zone = zoneGaps(vs);
  // Quem já está num cruzamento não espera por quem está retido na linha de
  // parada dele (a zona é exclusiva; sem isto, os dois se esperariam).
  const ahead = vs.map((v, i) => gapAhead(v, vs, state.routes, (o) => zone.inside[i]! && zone.gaps[o.id]! !== Infinity, obstacles));
  vs.forEach((v, i) => {
    const a = ahead[i]!;
    let gap = a.gap;
    // Dois veículos que se bloqueiam mutuamente (raro, num cruzamento): o de menor id passa.
    if (a.blocker >= 0 && ahead[a.blocker]?.blocker === v.id && v.id < a.blocker) gap = Infinity;
    gap = Math.min(gap, zone.gaps[i]!);
    // Perfil de frenagem cinemático (v = √(2·a·d)): chega parado a MIN_GAP do obstáculo
    // sem nunca pedir mais desaceleração do que BRAKE permite.
    const target = gap === Infinity ? v.cruise : Math.min(v.cruise, Math.sqrt(2 * COMFORT_BRAKE * Math.max(0, gap - MIN_GAP)));
    const rate = target > v.speed ? ACCEL : BRAKE;
    v.speed += Math.max(-rate * dt, Math.min(rate * dt, target - v.speed));
    v.s += v.speed * dt;
  });
  vs.forEach((v, i) => {
    v.wait = zone.contending[i] ? v.wait + dt : 0;
    place(v, state.routes);
  });
  state.time += dt;
  return state;
}
