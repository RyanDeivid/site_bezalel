import { blockBounds, DISTRICTS, groundHeight, SIDEWALK, type Quality } from './city';

/**
 * Pedestres da região principal: andam pelas calçadas das quadras do centro
 * (praça, Sede, Laboratório, Centro de Produtos e parque de chegada), em volta
 * da quadra, e pelos anéis da praça. Cada um tem a sua faixa da calçada (uma
 * por sentido, longe dos postes, que ficam a 1 m do meio-fio), velocidade de
 * gente andando (1,1–1,6 m/s) e ponto de partida próprio.
 *
 * Como o trânsito aéreo, a pose é função do tempo (sem estado acumulado):
 * determinística, barata e testável — um teste confere que ninguém sai da
 * calçada nem entra num edifício.
 */

export interface PedestrianSpec {
  /** Quadra (volta pela calçada) ou anel da praça. */
  route: { kind: 'block'; block: [number, number]; offset: number } | { kind: 'plaza'; radius: number };
  dir: 1 | -1;
  speed: number;
  start: number;
  /** Variação visual: cor da roupa (índice) e tom de pele (0–1). */
  tint: number;
  skin: number;
  height: number;
}

export interface PedestrianPose {
  x: number;
  y: number;
  z: number;
  heading: number;
}

const COUNT: Record<Quality, number> = { low: 24, medium: 48, high: 72, ultra: 96 };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Perímetro de uma volta (retângulo com cantos arredondados em volta da quadra, a `offset` m da borda dela). */
function blockLoop(block: [number, number], offset: number) {
  const b = blockBounds(block[0], block[1]);
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const arc = (Math.PI / 2) * offset;
  return { b, w, d, arc, length: 2 * (w + d) + 4 * arc };
}

export function createPedestrians(quality: Quality): PedestrianSpec[] {
  const rand = rng(29);
  const out: PedestrianSpec[] = [];
  const blocks = DISTRICTS.map((d) => d.block);
  for (let i = 0; i < COUNT[quality]; i++) {
    const dir: 1 | -1 = rand() < 0.5 ? 1 : -1;
    // Um em cada cinco anda pela praça; os outros, pelas calçadas (faixa da direita de quem anda).
    const route: PedestrianSpec['route'] =
      i % 5 === 4 ? { kind: 'plaza', radius: rand() < 0.5 ? 15.5 : 22.5 } : { kind: 'block', block: blocks[i % blocks.length]!, offset: dir > 0 ? 0.8 : 1.7 };
    out.push({ route, dir, speed: 1.1 + rand() * 0.5, start: rand() * 400, tint: Math.floor(rand() * 8), skin: rand(), height: 0.92 + rand() * 0.14 });
  }
  return out;
}

/** Onde o pedestre está no instante `t` (s) e para onde olha. */
export function pedestrianPose(p: PedestrianSpec, t: number): PedestrianPose {
  const dist = p.start + p.dir * p.speed * t;
  if (p.route.kind === 'plaza') {
    const r = p.route.radius;
    const a = dist / r;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // Tangente ao círculo no sentido do passo.
    return { x, y: groundHeight(x, z), z, heading: Math.atan2(-Math.sin(a) * p.dir, Math.cos(a) * p.dir) };
  }
  const { b, w, d, arc, length } = blockLoop(p.route.block, p.route.offset);
  const o = p.route.offset;
  let s = ((dist % length) + length) % length;
  // Volta pela calçada: lado sul (+x), canto, leste (−z), canto, norte (−x), canto, oeste (+z), canto.
  // Nos cantos, um quarto de círculo em volta da quina da quadra (raio = afastamento da borda).
  const legs: Array<{ len: number; at: (k: number) => [number, number] }> = [
    { len: w, at: (k) => [b.minX + k, b.maxZ + o] },
    { len: arc, at: (k) => [b.maxX + o * Math.sin(k / o), b.maxZ + o * Math.cos(k / o)] },
    { len: d, at: (k) => [b.maxX + o, b.maxZ - k] },
    { len: arc, at: (k) => [b.maxX + o * Math.cos(k / o), b.minZ - o * Math.sin(k / o)] },
    { len: w, at: (k) => [b.maxX - k, b.minZ - o] },
    { len: arc, at: (k) => [b.minX - o * Math.sin(k / o), b.minZ - o * Math.cos(k / o)] },
    { len: d, at: (k) => [b.minX - o, b.minZ + k] },
    { len: arc, at: (k) => [b.minX - o * Math.cos(k / o), b.maxZ + o * Math.sin(k / o)] },
  ];
  for (const leg of legs) {
    if (s <= leg.len) {
      const [x, z] = leg.at(s);
      // Direção: diferença ao longo do percurso (vale para retas e arcos), no sentido do passo.
      const [x2, z2] = leg.at(Math.min(leg.len, s + 0.05));
      const [x1, z1] = leg.at(Math.max(0, s - 0.05));
      const dx = (x2 - x1) * p.dir;
      const dz = (z2 - z1) * p.dir;
      return { x, y: groundHeight(x, z), z, heading: Math.atan2(dx, dz) };
    }
    s -= leg.len;
  }
  const [x, z] = legs[0]!.at(0);
  return { x, y: groundHeight(x, z), z, heading: Math.PI / 2 };
}

/** Largura útil da calçada (para os testes). */
export const SIDEWALK_WIDTH = SIDEWALK;
