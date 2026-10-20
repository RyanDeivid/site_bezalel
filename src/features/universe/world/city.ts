/**
 * Bezalel Universe — planta da cidade, descrita por dados (sem three.js).
 *
 * Coordenadas em metros: x cresce para o leste, z para o sul, y para cima
 * (o mesmo referencial do three.js). A cidade é uma grade de superquadras:
 * seis linhas de rua em cada eixo (`STREET_LINES`) formam 5 × 5 quadras. No
 * centro ficam a praça e os edifícios institucionais (sede ao norte,
 * laboratório a leste, produtos a oeste, parque de chegada ao sul); em volta,
 * a cidade: torres compostas (pódio, corpo e coroamento), passarelas e painéis.
 * Novas quadras ou distritos entram aqui — a cena, o mapa 2D, as colisões, o
 * trânsito e os corredores aéreos são todos derivados destes dados.
 */

export type DistrictId = 'plaza' | 'hq' | 'ai-lab' | 'products' | 'arrival' | 'midtown' | 'skyline';
export type BuildingId = 'bezalel-hq' | 'ai-lab' | 'products-center';
export type PlaceId = BuildingId | 'plaza' | 'arrival';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
/** Ordem dos níveis de qualidade (para "a partir do alto", por exemplo). */
export const QUALITY_LEVELS: Quality[] = ['low', 'medium', 'high', 'ultra'];
export const atLeast = (q: Quality, level: Quality) => QUALITY_LEVELS.indexOf(q) >= QUALITY_LEVELS.indexOf(level);

export interface Point2 {
  x: number;
  z: number;
}

/** Caixa sólida (pegada retangular alinhada aos eixos + altura): colisões de quem anda, dirige e voa. */
export interface Solid {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  /** Base (padrão 0): passarelas são sólidos suspensos. */
  base?: number;
}

export interface District {
  id: DistrictId;
  /** Índices da quadra na grade (0–4). */
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
  /** Volumes sólidos do edifício (colisões). */
  solids: Solid[];
  /** Altura total (para a câmera e o mapa). */
  height: number;
}

export interface PlaceSpec {
  id: PlaceId;
  /** Heliponto em frente à entrada: onde se chega a pé, de carro ou voando. */
  pad: Point2;
  /** Para onde se olha ao chegar. */
  padHeading: number;
  /** Altura de pairar sobre o pad (carro voador). */
  padAltitude: number;
  /** Distância horizontal do pad em que o local é considerado "próximo". */
  reach: number;
}

export const STREET_LINES = [-180, -110, -40, 40, 110, 180] as const;
export const BLOCKS = STREET_LINES.length - 1;
export const ROAD_WIDTH = 12;
export const LANE_OFFSET = 3;
export const SIDEWALK = 3.5;
/** Limite da cidade (metade do lado) e teto do voo. */
export const WORLD_HALF = 230;
export const CEILING = 110;
export const MIN_ALTITUDE = 1.6;

/** Alturas do chão: rua, calçada (meio-fio) e quadra. */
export const GROUND = { road: 0.03, sidewalk: 0.22, block: 0.3, plaza: 0.36 } as const;

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

/** Quadra que contém o ponto (ou null, se estiver numa rua ou fora da grade). */
export function blockAt(x: number, z: number): [number, number] | null {
  for (let bx = 0; bx < BLOCKS; bx++)
    for (let bz = 0; bz < BLOCKS; bz++) {
      const b = blockBounds(bx, bz);
      if (x >= b.minX - SIDEWALK && x <= b.maxX + SIDEWALK && z >= b.minZ - SIDEWALK && z <= b.maxZ + SIDEWALK) return [bx, bz];
    }
  return null;
}

export const DISTRICTS: District[] = [
  { id: 'plaza', block: [2, 2] },
  { id: 'hq', block: [2, 1] },
  { id: 'ai-lab', block: [3, 2] },
  { id: 'products', block: [1, 2] },
  { id: 'arrival', block: [2, 3] },
];

/** Raio da praça central (o resto da quadra é jardim e calçada). */
export const PLAZA_RADIUS = 27;

/** Altura do chão num ponto (rua, calçada, quadra ou praça). Quem anda e quem dirige acompanha. */
export function groundHeight(x: number, z: number): number {
  if (Math.hypot(x, z) < PLAZA_RADIUS) return GROUND.plaza;
  const b = blockAt(x, z);
  if (!b) return GROUND.road;
  const bb = blockBounds(b[0], b[1]);
  return x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ ? GROUND.block : GROUND.sidewalk;
}

const box = (cx: number, cz: number, w: number, d: number, height: number, base = 0): Solid => ({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height, ...(base ? { base } : {}) });

/**
 * Edifícios institucionais. As medidas dos volumes aqui são as mesmas que a
 * cena desenha (Landmarks.tsx lê estes números).
 */
export const BUILDINGS: BuildingSpec[] = [
  {
    // Sede: pódio + torre afunilada + lanterna e coroa (o cubo do símbolo). Entrada voltada para a praça (sul).
    // As medidas são as de `HQ` (landmarkGeometry.ts).
    id: 'bezalel-hq',
    district: 'hq',
    x: 0,
    z: -80,
    facing: 0,
    height: 81,
    solids: [box(0, -80, 40, 26, 9.3), box(0, -82, 22, 16, 57.3), box(0, -82, 17, 17, 81)],
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
/** Só o pedestal bloqueia quem anda; o cubo flutua acima (o voo desvia do conjunto todo). */
export const MONUMENT_SOLID: Solid = box(MONUMENT.x, MONUMENT.z, 11, 11, MONUMENT.pedestal + MONUMENT.gap + cubeOnVertex(MONUMENT.size).height);

export const buildingById = (id: BuildingId) => BUILDINGS.find((b) => b.id === id)!;

/** Locais com painel e transporte rápido (edifícios, praça e o ponto de chegada). */
export const PLACES: PlaceSpec[] = [
  { id: 'bezalel-hq', pad: { x: 0, z: -56 }, padHeading: Math.PI, padAltitude: 3, reach: 20 },
  { id: 'ai-lab', pad: { x: 56, z: 0 }, padHeading: Math.PI / 2, padAltitude: 3, reach: 18 },
  { id: 'products-center', pad: { x: -52, z: 0 }, padHeading: -Math.PI / 2, padAltitude: 3, reach: 18 },
  { id: 'plaza', pad: { x: 0, z: 18 }, padHeading: Math.PI, padAltitude: 7, reach: 24 },
  { id: 'arrival', pad: { x: 0, z: 78 }, padHeading: Math.PI, padAltitude: 4, reach: 16 },
];

export const placeById = (id: PlaceId) => PLACES.find((p) => p.id === id)!;

/** Onde o visitante começa (a pé): no parque de chegada, de frente para a praça e a sede. */
export const SPAWN = { x: 0, y: GROUND.block, z: 88, yaw: Math.PI };

// ---- Cidade em volta: torres compostas -----------------------------------------------------

/** Telões de LED sobre pilares, nas pracinhas das esquinas em volta do centro. */
export interface Billboard {
  x: number;
  z: number;
  y: number;
  /** Para onde a tela olha (rad, 0 = sul). */
  facing: number;
  w: number;
  h: number;
}

/** Quatro telões, cada um voltado para o cruzamento da esquina do anel central. */
export const BILLBOARDS: Billboard[] = [
  { x: -58, z: -58, y: 12, facing: Math.PI / 4, w: 14, h: 8 },
  { x: 58, z: -58, y: 12, facing: -Math.PI / 4, w: 14, h: 8 },
  { x: -58, z: 58, y: 12, facing: (3 * Math.PI) / 4, w: 14, h: 8 },
  { x: 58, z: 58, y: 12, facing: (-3 * Math.PI) / 4, w: 14, h: 8 },
];

/** Pilar do telão (o resto fica acima da cabeça de quem passa). */
export const billboardSolid = (b: Billboard): Solid => box(b.x, b.z, 1.6, 1.6, b.y + b.h / 2);



/**
 * Materiais de fachada: cada um é um sistema construtivo, não só uma cor —
 * pele de vidro com montantes (azul-esverdeado ou bronze), concreto claro com
 * janelas recortadas, pedra grafite com janelas em fenda, painéis metálicos
 * com janelas em fita, vidro escuro e o embasamento de lojas. As alturas são
 * múltiplos de 3,5 m (um andar), para os andares baterem com a textura.
 */
export type TowerMaterial = 'glassBlue' | 'glassBronze' | 'whiteConcrete' | 'charcoal' | 'metalPanel' | 'darkGlass' | 'storefront';

/** Um volume da torre (empilhados de baixo para cima, centrados no eixo, com deslocamento opcional). */
export interface TowerPart {
  w: number;
  d: number;
  h: number;
  material: TowerMaterial;
  /** Forma da planta: retângulo, cantos chanfrados (octógono) ou redonda. A colisão usa a caixa w × d. */
  shape?: 'box' | 'chamfer' | 'round';
  /** Deslocamento do centro em relação ao eixo da torre (recuos assimétricos). */
  dx?: number;
  dz?: number;
  /** Detalhes da fachada (só perto: o anel de fora usa a versão econômica). */
  fins?: boolean;
  balconies?: boolean;
  diagrid?: boolean;
  /** Arestas verticais de LED (cor de destaque). */
  led?: 'cyan' | 'amber';
}

export interface TowerVariant {
  name: string;
  parts: TowerPart[];
  /** Coroamento: aletas que passam do teto, topo inclinado, anel de luz, mastro com luz de sinalização, jardim, heliponto ou equipamentos. */
  roof: 'crownFins' | 'slope' | 'ring' | 'antenna' | 'garden' | 'helipad' | 'units' | 'none';
}

/**
 * Sete famílias arquitetônicas, cada uma com silhueta, sistema de fachada e
 * coroamento próprios (não é a mesma caixa com outra cor). Pegadas de até
 * 15 m: cabem nas células de 17 m.
 */
export const TOWER_VARIANTS: TowerVariant[] = [
  {
    name: 'lâmina de vidro azul (cantos chanfrados, aletas)',
    parts: [
      { w: 15, d: 15, h: 6, material: 'storefront' },
      { w: 12, d: 12, h: 56, material: 'glassBlue', shape: 'chamfer', fins: true },
    ],
    roof: 'crownFins',
  },
  {
    name: 'residencial branco em terraços',
    parts: [
      { w: 15, d: 12, h: 17.5, material: 'whiteConcrete', balconies: true },
      { w: 12, d: 10, h: 14, material: 'whiteConcrete', balconies: true, dx: 1 },
      { w: 9, d: 8, h: 10.5, material: 'whiteConcrete', balconies: true, dx: 2 },
    ],
    roof: 'garden',
  },
  {
    name: 'monólito grafite com arestas de LED',
    parts: [
      { w: 12, d: 12, h: 4, material: 'storefront' },
      { w: 11, d: 11, h: 45.5, material: 'charcoal', led: 'cyan' },
    ],
    roof: 'ring',
  },
  {
    name: 'torre redonda com diagrid',
    parts: [
      { w: 15, d: 15, h: 5, material: 'storefront', shape: 'round' },
      { w: 13, d: 13, h: 66.5, material: 'glassBronze', shape: 'round', diagrid: true },
    ],
    roof: 'ring',
  },
  {
    name: 'comercial médio com fitas de janelas',
    parts: [
      { w: 15, d: 14, h: 6, material: 'storefront' },
      { w: 15, d: 13, h: 17.5, material: 'metalPanel' },
    ],
    roof: 'units',
  },
  {
    name: 'torre escalonada de bronze',
    parts: [
      { w: 13, d: 13, h: 31.5, material: 'glassBronze', shape: 'chamfer', fins: true },
      { w: 10, d: 10, h: 24.5, material: 'glassBronze', shape: 'chamfer' },
      { w: 7, d: 7, h: 14, material: 'darkGlass', shape: 'chamfer', led: 'amber' },
    ],
    roof: 'antenna',
  },
  {
    name: 'lâmina corporativa escura',
    parts: [
      { w: 15, d: 11, h: 5, material: 'storefront' },
      { w: 14, d: 9, h: 52.5, material: 'darkGlass', fins: true },
    ],
    roof: 'slope',
  },
];

export const towerHeight = (v: TowerVariant) => v.parts.reduce((h, p) => h + p.h, 0);

export interface TowerSpec {
  x: number;
  z: number;
  variant: number;
  /** 0 ou π/2 (as pegadas continuam alinhadas aos eixos). */
  rotation: number;
  /** Anel da cidade: em volta da praça (região de demonstração, detalhe completo) ou o horizonte (versão econômica). */
  ring: 'midtown' | 'skyline';
  /** Semente da variação de fachada (que janelas estão acesas). */
  seed: number;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const CENTRAL = new Set(DISTRICTS.map((d) => d.block.join(',')));
/**
 * Famílias por anel: em volta da praça (a região de demonstração), prédios
 * médios e variados que emolduram os marcos; no anel de fora, as torres altas
 * que fazem a silhueta do horizonte.
 */
const MIDTOWN_VARIANTS = [1, 4, 2, 6, 1, 4];
const SKYLINE_VARIANTS = [0, 5, 6, 3, 0, 5, 6, 2, 1];

/** Torres de cada quadra que não é institucional, numa grade por quadra (densidade pela qualidade). */
export function cityTowers(quality: Quality): TowerSpec[] {
  const rand = rng(7);
  const out: TowerSpec[] = [];
  for (let bx = 0; bx < BLOCKS; bx++)
    for (let bz = 0; bz < BLOCKS; bz++) {
      if (CENTRAL.has(`${bx},${bz}`)) continue;
      const midtown = bx >= 1 && bx <= 3 && bz >= 1 && bz <= 3;
      const b = blockBounds(bx, bz);
      const cells = quality === 'low' ? 2 : 3;
      // Passo próprio em cada eixo: a coluna central da grade é mais larga (80 m) que as outras (70 m).
      const stepX = (b.maxX - b.minX) / cells;
      const stepZ = (b.maxZ - b.minZ) / cells;
      for (let i = 0; i < cells; i++)
        for (let j = 0; j < cells; j++) {
          const pool = midtown ? MIDTOWN_VARIANTS : SKYLINE_VARIANTS;
          const cx = b.minX + stepX * (i + 0.5);
          const cz = b.minZ + stepZ * (j + 0.5);
          // Nas quadras de esquina em volta do centro, a célula mais perto da praça é uma
          // pracinha com um telão (BILLBOARDS), sem torre.
          if (BILLBOARDS.some((bb) => Math.abs(bb.x - cx) < stepX / 2 && Math.abs(bb.z - cz) < stepZ / 2)) {
            rand();
            rand();
            continue;
          }
          // No médio, a célula central de cada quadra vira praça interna (menos geometria).
          if (quality === 'medium' && i === 1 && j === 1) {
            rand();
            continue;
          }
          const variant = pool[Math.floor(rand() * pool.length)]!;
          out.push({ x: cx, z: cz, variant, rotation: rand() < 0.5 ? 0 : Math.PI / 2, ring: midtown ? 'midtown' : 'skyline', seed: out.length * 7919 + 13 });
        }
    }
  return out;
}

/** Volumes sólidos de uma torre (um por parte; pegadas giradas 0° ou 90°). */
export function towerSolids(t: TowerSpec): Solid[] {
  const v = TOWER_VARIANTS[t.variant]!;
  const turned = Math.abs(Math.sin(t.rotation)) > 0.5;
  let y = 0;
  return v.parts.map((p) => {
    const w = turned ? p.d : p.w;
    const d = turned ? p.w : p.d;
    // Giro de 90° em torno de y: (x, z) local → (z, -x) no mundo (a mesma matriz da cena).
    const dx = turned ? (p.dz ?? 0) : (p.dx ?? 0);
    const dz = turned ? -(p.dx ?? 0) : (p.dz ?? 0);
    const s = box(t.x + dx, t.z + dz, w, d, y + p.h, y || undefined);
    y += p.h;
    return s;
  });
}

/** Passarela envidraçada entre duas torres vizinhas da mesma quadra. */
export interface Skybridge {
  a: Point2;
  b: Point2;
  /** Altura do piso da passarela. */
  y: number;
  width: number;
}

/**
 * Passarelas entre pares de torres altas (corpo acima de 30 m) lado a lado
 * na mesma linha de uma quadra — em pontos fixos (determinísticos).
 */
export function skybridges(towers: TowerSpec[]): Skybridge[] {
  const out: Skybridge[] = [];
  const used = new Set<number>();
  towers.forEach((a, i) => {
    if (used.has(i) || towerHeight(TOWER_VARIANTS[a.variant]!) < 36) return;
    const j = towers.findIndex((b, k) => k > i && !used.has(k) && Math.abs(b.z - a.z) < 0.5 && b.x > a.x && b.x - a.x < 18.5 && towerHeight(TOWER_VARIANTS[b.variant]!) >= 36);
    if (j < 0 || out.length >= 10) return;
    const b = towers[j]!;
    used.add(i);
    used.add(j);
    out.push({ a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z }, y: 24 + (out.length % 3) * 4, width: 3 });
  });
  return out;
}

export const skybridgeSolid = (s: Skybridge): Solid => ({
  minX: Math.min(s.a.x, s.b.x),
  maxX: Math.max(s.a.x, s.b.x),
  minZ: s.a.z - s.width / 2,
  maxZ: s.a.z + s.width / 2,
  base: s.y,
  height: s.y + 3,
});

/** Todos os sólidos da cidade: edifícios, monumento, torres e passarelas. */
export function citySolids(quality: Quality): Solid[] {
  const towers = cityTowers(quality);
  return [...BUILDINGS.flatMap((b) => b.solids), MONUMENT_SOLID, ...BILLBOARDS.map(billboardSolid), ...towers.flatMap(towerSolids), ...skybridges(towers).map(skybridgeSolid)];
}

/** O ponto (com raio) está dentro de algum sólido, na altura dada? */
export function insideSolid(x: number, z: number, y: number, radius: number, solids: Solid[]): boolean {
  return solids.some((s) => y >= (s.base ?? 0) - 0.01 && y < s.height && x > s.minX - radius && x < s.maxX + radius && z > s.minZ - radius && z < s.maxZ + radius);
}
