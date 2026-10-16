/**
 * Bezalel Universe — planta da cidade, descrita por dados (sem three.js).
 *
 * Coordenadas em metros: x cresce para o leste, z para o sul, y para cima
 * (o mesmo referencial do three.js). A cidade é uma grade de superquadras:
 * quatro linhas de rua em cada eixo (`STREET_LINES`) formam 3 × 3 quadras.
 * A quadra central é a praça; as do norte, leste e oeste, os edifícios
 * institucionais; a do sul, o parque de chegada; as dos cantos, a cidade
 * em volta (torres sem interação). Novas quadras ou distritos entram aqui —
 * a cena, o mapa 2D, as colisões e o trânsito são todos derivados destes dados.
 */

export type DistrictId = 'plaza' | 'hq' | 'ai-lab' | 'products' | 'arrival' | 'skyline';
export type BuildingId = 'bezalel-hq' | 'ai-lab' | 'products-center';
export type PlaceId = BuildingId | 'plaza' | 'arrival';

export interface Point2 {
  x: number;
  z: number;
}

/** Caixa sólida (pegada retangular alinhada aos eixos + altura): usada nas colisões do voo. */
export interface Solid {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export interface District {
  id: DistrictId;
  /** Índices da quadra na grade (0–2). */
  block: [number, number];
}

export interface BuildingSpec {
  id: BuildingId;
  district: DistrictId;
  /** Centro da pegada. */
  x: number;
  z: number;
  /** Para onde a fachada principal (a entrada) aponta, em radianos (0 = sul / +z). */
  facing: number;
  /** Volumes sólidos do edifício (colisão do carro e da câmera). */
  solids: Solid[];
  /** Altura total (para a câmera e o mapa). */
  height: number;
}

export interface PlaceSpec {
  id: PlaceId;
  /** Onde o carro estaciona para "entrar" (heliponto em frente à entrada). */
  pad: Point2;
  /** Para onde o carro olha ao chegar. */
  padHeading: number;
  /** Altura de pairar sobre o pad. */
  padAltitude: number;
  /** Distância horizontal do pad em que o local é considerado "próximo". */
  reach: number;
}

export const STREET_LINES = [-110, -40, 40, 110] as const;
export const ROAD_WIDTH = 12;
export const LANE_OFFSET = 3;
export const SIDEWALK = 3.5;
/** Limite do voo (metade do lado) e teto. */
export const WORLD_HALF = 165;
export const CEILING = 90;
export const MIN_ALTITUDE = 1.6;

/** Limites internos de uma quadra (sem rua nem calçada). */
export function blockBounds(bx: number, bz: number): Solid {
  const inset = ROAD_WIDTH / 2 + SIDEWALK;
  return {
    minX: STREET_LINES[bx]! + inset,
    maxX: STREET_LINES[bx + 1]! - inset,
    minZ: STREET_LINES[bz]! + inset,
    maxZ: STREET_LINES[bz + 1]! - inset,
    height: 0,
  };
}

export const DISTRICTS: District[] = [
  { id: 'plaza', block: [1, 1] },
  { id: 'hq', block: [1, 0] },
  { id: 'ai-lab', block: [2, 1] },
  { id: 'products', block: [0, 1] },
  { id: 'arrival', block: [1, 2] },
];

/** Raio da praça central (o resto da quadra é jardim e calçada). */
export const PLAZA_RADIUS = 27;

const box = (cx: number, cz: number, w: number, d: number, height: number): Solid => ({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height });

/**
 * Edifícios institucionais. As medidas dos volumes aqui são as mesmas que a
 * cena desenha (Landmarks.tsx lê estes números).
 */
export const BUILDINGS: BuildingSpec[] = [
  {
    // Sede: pódio + torre + coroa (o cubo do símbolo). Entrada voltada para a praça (sul).
    id: 'bezalel-hq',
    district: 'hq',
    x: 0,
    z: -80,
    facing: 0,
    height: 78,
    solids: [box(0, -80, 40, 26, 9), box(0, -82, 22, 16, 58), box(0, -82, 17, 17, 78)],
  },
  {
    // Laboratório de IA: salão octogonal de vidro com núcleo. Entrada voltada para a praça (oeste).
    id: 'ai-lab',
    district: 'ai-lab',
    x: 80,
    z: 0,
    facing: -Math.PI / 2,
    height: 24.5,
    solids: [box(80, 0, 34, 34, 1.6), box(80, 0, 27, 27, 18.4), box(80, 0, 2, 2, 24.5)],
  },
  {
    // Centro de Produtos: galerias empilhadas e deslocadas. Entrada voltada para a praça (leste).
    id: 'products-center',
    district: 'products',
    x: -80,
    z: 0,
    facing: Math.PI / 2,
    height: 30,
    solids: [box(-80, 0, 36, 30, 10), box(-83, 2, 30, 24, 20), box(-78, -2, 24, 20, 30)],
  },
];

/**
 * O monumento no centro da praça: o símbolo da Bezalel em 3D, um cubo
 * equilibrado num vértice (a diagonal fica na vertical), de modo que as três
 * faces da marca — dourada, de camadas e de aço — ficam no alto, como no logotipo.
 */
export const MONUMENT = { x: 0, z: 0, pedestal: 3.2, size: 6, gap: 1.2 };
/** Altura e alcance horizontal de um cubo de lado `s` apoiado num vértice. */
export const cubeOnVertex = (s: number) => ({ height: s * Math.sqrt(3), radius: s * Math.sqrt(2 / 3) });
export const MONUMENT_SOLID: Solid = box(MONUMENT.x, MONUMENT.z, 11, 11, MONUMENT.pedestal + MONUMENT.gap + cubeOnVertex(MONUMENT.size).height);

export const buildingById = (id: BuildingId) => BUILDINGS.find((b) => b.id === id)!;

/** Locais com painel e piloto automático (edifícios, praça e o ponto de chegada). */
export const PLACES: PlaceSpec[] = [
  { id: 'bezalel-hq', pad: { x: 0, z: -56 }, padHeading: Math.PI, padAltitude: 3, reach: 20 },
  { id: 'ai-lab', pad: { x: 56, z: 0 }, padHeading: Math.PI / 2, padAltitude: 3, reach: 18 },
  { id: 'products-center', pad: { x: -52, z: 0 }, padHeading: -Math.PI / 2, padAltitude: 3, reach: 18 },
  { id: 'plaza', pad: { x: 0, z: 18 }, padHeading: Math.PI, padAltitude: 7, reach: 24 },
  { id: 'arrival', pad: { x: 0, z: 78 }, padHeading: Math.PI, padAltitude: 4, reach: 16 },
];

export const placeById = (id: PlaceId) => PLACES.find((p) => p.id === id)!;

/** Onde o visitante começa: no parque de chegada, de frente para a praça e a sede. */
export const SPAWN = { x: 0, y: 4, z: 78, yaw: Math.PI };

/**
 * Torres da cidade em volta (sem interação), geradas de forma determinística:
 * mesma semente → mesma cidade, no navegador e nos testes. `variant` escolhe
 * uma das formas pré-construídas (a cena instancia cada forma).
 */
export interface TowerSpec {
  x: number;
  z: number;
  variant: number;
  rotation: number;
}

export interface TowerVariant {
  w: number;
  d: number;
  h: number;
}

/** Pegadas de até 14 m: cabem na grade 3 × 3 de uma quadra de canto (células de 17 m) com folga. */
export const TOWER_VARIANTS: TowerVariant[] = [
  { w: 14, d: 14, h: 26 },
  { w: 11, d: 14, h: 38 },
  { w: 14, d: 10, h: 18 },
  { w: 10, d: 10, h: 44 },
  { w: 13, d: 13, h: 32 },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Torres nas quadras dos cantos (grade 2 × 2 por quadra) e um anel distante para o horizonte. */
export function skylineTowers(count: 'high' | 'low'): TowerSpec[] {
  const rand = rng(7);
  const out: TowerSpec[] = [];
  for (const [bx, bz] of [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ] as const) {
    const b = blockBounds(bx, bz);
    const cells = count === 'high' ? 3 : 2;
    const step = (b.maxX - b.minX) / cells;
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < cells; j++) {
        const variant = Math.floor(rand() * TOWER_VARIANTS.length);
        out.push({ x: b.minX + step * (i + 0.5), z: b.minZ + step * (j + 0.5), variant, rotation: rand() < 0.5 ? 0 : Math.PI / 2 });
      }
  }
  // Anel externo (além da avenida de contorno): só silhueta no horizonte, num
  // quadrado em volta da cidade.
  const ring = count === 'high' ? 44 : 24;
  for (let i = 0; i < ring; i++) {
    const p = (i / ring) * 4;
    const side = Math.floor(p);
    const along = -150 + (p - side) * 300;
    const off = 134 + rand() * 18;
    const [x, z] = side === 0 ? [along, -off] : side === 1 ? [off, along] : side === 2 ? [-along, off] : [-off, -along];
    out.push({ x, z, variant: Math.floor(rand() * TOWER_VARIANTS.length), rotation: 0 });
  }
  return out;
}

/** Volumes sólidos de uma torre (pegada girada 0° ou 90°; no anel externo, a caixa envolvente). */
export function towerSolid(t: TowerSpec): Solid {
  const v = TOWER_VARIANTS[t.variant]!;
  const c = Math.abs(Math.cos(t.rotation));
  const s = Math.abs(Math.sin(t.rotation));
  const w = v.w * c + v.d * s;
  const d = v.w * s + v.d * c;
  return box(t.x, t.z, w, d, v.h);
}

/** Todos os sólidos da cidade (edifícios + torres): a colisão do voo e da câmera usa esta lista. */
export function citySolids(quality: 'high' | 'low'): Solid[] {
  return [...BUILDINGS.flatMap((b) => b.solids), MONUMENT_SOLID, ...skylineTowers(quality).map(towerSolid)];
}
