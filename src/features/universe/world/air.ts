import { STREET_LINES, type Quality } from './city';

/**
 * Trânsito aéreo: corredores sobre as avenidas (ruas não têm prédios — por
 * construção, nenhum voo atravessa um edifício; um teste confere amostrando
 * cada rota contra todos os sólidos da cidade).
 *
 * Separação vertical por eixo, como num controle de tráfego aéreo:
 *  - leste-oeste: 30 m e 42 m;
 *  - norte-sul: 56 m e 68 m;
 *  - drones de serviço: 15 m, no anel médio (abaixo dos telões e passarelas
 *    das quadras, acima dos postes).
 * Cada rota é um "autódromo": vai por uma avenida, faz o retorno além da
 * borda da cidade e volta pela avenida paralela. Na mesma rota, todos andam
 * à mesma velocidade e igualmente espaçados — nunca se alcançam.
 */

export type AirClass = 'taxi' | 'private' | 'cargo' | 'drone';

export interface AirRouteSpec {
  id: string;
  cls: AirClass;
  /** Eixo do corredor e as duas avenidas (índices em STREET_LINES) — ida por `a`, volta por `b`. */
  axis: 'ew' | 'ns' | 'ring';
  a: number;
  b: number;
  altitude: number;
  /** Deslocamento lateral do corredor em relação ao eixo da avenida (m). */
  offset: number;
  speed: number;
  count: Record<Quality, number>;
}

export const AIR_ROUTES: AirRouteSpec[] = [
  { id: 'ew-north-30', cls: 'taxi', axis: 'ew', a: 1, b: 2, altitude: 30, offset: 0, speed: 22, count: { low: 2, medium: 3, high: 4, ultra: 5 } },
  { id: 'ew-south-30', cls: 'private', axis: 'ew', a: 4, b: 3, altitude: 30, offset: 0, speed: 26, count: { low: 1, medium: 2, high: 3, ultra: 4 } },
  { id: 'ew-north-42', cls: 'cargo', axis: 'ew', a: 2, b: 1, altitude: 42, offset: 2, speed: 16, count: { low: 1, medium: 2, high: 2, ultra: 3 } },
  { id: 'ew-south-42', cls: 'taxi', axis: 'ew', a: 3, b: 4, altitude: 42, offset: 2, speed: 22, count: { low: 1, medium: 2, high: 3, ultra: 4 } },
  { id: 'ns-west-56', cls: 'private', axis: 'ns', a: 1, b: 2, altitude: 56, offset: 0, speed: 26, count: { low: 1, medium: 2, high: 3, ultra: 4 } },
  { id: 'ns-east-56', cls: 'taxi', axis: 'ns', a: 4, b: 3, altitude: 56, offset: 0, speed: 22, count: { low: 1, medium: 2, high: 3, ultra: 4 } },
  { id: 'ns-west-68', cls: 'taxi', axis: 'ns', a: 2, b: 1, altitude: 68, offset: 2, speed: 22, count: { low: 0, medium: 1, high: 2, ultra: 3 } },
  { id: 'ns-east-68', cls: 'cargo', axis: 'ns', a: 3, b: 4, altitude: 68, offset: 2, speed: 16, count: { low: 0, medium: 1, high: 2, ultra: 3 } },
  { id: 'drones-midtown', cls: 'drone', axis: 'ring', a: 1, b: 4, altitude: 15, offset: 0, speed: 12, count: { low: 2, medium: 4, high: 6, ultra: 8 } },
];

export interface AirPoint {
  x: number;
  y: number;
  z: number;
}

export interface AirRoute {
  spec: AirRouteSpec;
  points: AirPoint[];
  cumulative: number[];
  length: number;
}

/** Até onde o corredor vai além da última rua antes do retorno. */
const REACH = STREET_LINES[STREET_LINES.length - 1]! + 12;

function arc(cx: number, cz: number, r: number, from: number, to: number, y: number, steps = 14): AirPoint[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / steps;
    return { x: cx + Math.cos(t) * r, y, z: cz + Math.sin(t) * r };
  });
}

/** Constrói a polilinha fechada de uma rota (retas sobre as avenidas e retornos em semicírculo). */
export function buildAirRoute(spec: AirRouteSpec): AirRoute {
  const y = spec.altitude;
  let pts: AirPoint[];
  if (spec.axis === 'ring') {
    // Retângulo pelas avenidas do anel médio, cantos arredondados sobre os cruzamentos.
    const lo = STREET_LINES[spec.a]!;
    const hi = STREET_LINES[spec.b]!;
    const r = 8;
    pts = [
      ...arc(hi - r, lo + r, r, -Math.PI / 2, 0, y, 6),
      ...arc(hi - r, hi - r, r, 0, Math.PI / 2, y, 6),
      ...arc(lo + r, hi - r, r, Math.PI / 2, Math.PI, y, 6),
      ...arc(lo + r, lo + r, r, Math.PI, (3 * Math.PI) / 2, y, 6),
    ];
  } else {
    const la = STREET_LINES[spec.a]! + spec.offset * Math.sign(STREET_LINES[spec.b]! - STREET_LINES[spec.a]!);
    const lb = STREET_LINES[spec.b]! - spec.offset * Math.sign(STREET_LINES[spec.b]! - STREET_LINES[spec.a]!);
    const mid = (la + lb) / 2;
    const r = Math.abs(lb - la) / 2;
    const dir = Math.sign(lb - la);
    // Em coordenadas do corredor: `u` ao longo das avenidas, `v` entre elas.
    const loop: Array<[number, number]> = [
      [-REACH, la],
      [REACH, la],
      ...arc(REACH, mid, r, -Math.PI / 2 * dir, Math.PI / 2 * dir, 0).map((p) => [p.x, p.z] as [number, number]),
      [REACH, lb],
      [-REACH, lb],
      ...arc(-REACH, mid, r, Math.PI / 2 * dir, (3 * Math.PI) / 2 * dir, 0).map((p) => [p.x, p.z] as [number, number]),
    ];
    pts = loop.map(([u, v]) => (spec.axis === 'ew' ? { x: u, y, z: v } : { x: v, y, z: u }));
  }
  // Remove pontos repetidos (emendas entre retas e arcos).
  const points = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1]!.x, p.z - pts[i - 1]!.z) > 0.01);
  const cumulative = [0];
  for (let i = 1; i <= points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i % points.length]!;
    cumulative.push(cumulative[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  return { spec, points, cumulative, length: cumulative[points.length]! };
}

/** Posição, direção e curvatura (para inclinar nas curvas) a `s` metros do início. */
export function sampleAir(route: AirRoute, s: number): { x: number; y: number; z: number; heading: number; turn: number } {
  const L = route.length;
  const d = ((s % L) + L) % L;
  let lo = 0;
  let hi = route.points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (route.cumulative[mid]! <= d) lo = mid;
    else hi = mid - 1;
  }
  const n = route.points.length;
  const a = route.points[lo]!;
  const b = route.points[(lo + 1) % n]!;
  const c = route.points[(lo + 2) % n]!;
  const seg = route.cumulative[lo + 1]! - route.cumulative[lo]!;
  const t = seg > 0 ? (d - route.cumulative[lo]!) / seg : 0;
  const h1 = Math.atan2(b.x - a.x, b.z - a.z);
  const h2 = Math.atan2(c.x - b.x, c.z - b.z);
  const dh = Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, heading: h1 + dh * t, turn: dh / Math.max(seg, 1) };
}

export interface AirVehicle {
  route: number;
  /** Posição inicial no laço (m). */
  start: number;
  /** Fase da flutuação (cada um oscila de leve, fora de sincronia). */
  phase: number;
}

export function createAirTraffic(quality: Quality, specs: AirRouteSpec[] = AIR_ROUTES) {
  const routes = specs.map(buildAirRoute);
  const vehicles: AirVehicle[] = [];
  routes.forEach((r, i) => {
    const n = r.spec.count[quality];
    for (let k = 0; k < n; k++) vehicles.push({ route: i, start: (r.length * k) / n + i * 23, phase: (vehicles.length * 1.7) % (Math.PI * 2) });
  });
  return { routes, vehicles };
}

/** Onde um veículo aéreo está no instante `t` (s) — determinístico, sem estado acumulado. */
export function airPose(traffic: ReturnType<typeof createAirTraffic>, v: AirVehicle, t: number) {
  const r = traffic.routes[v.route]!;
  const p = sampleAir(r, v.start + r.spec.speed * t);
  return { ...p, y: p.y + Math.sin(t * 0.9 + v.phase) * 0.4, bank: Math.max(-0.5, Math.min(0.5, -p.turn * r.spec.speed * 0.9)), cls: r.spec.cls };
}
