/**
 * Geometria das "folhas" da planta: uma por capítulo. Cada folha diz onde
 * cada partícula deve pousar (`points`), de que cor (`colors`, índice na
 * paleta), quais traços desenhar e em que ordem (`segments`) e quais rótulos
 * aparecem (`labels`). A mesma matéria (as partículas) passa de folha em
 * folha — o visitante vê a obra ser refeita a cada volta da manivela.
 *
 * Coordenadas do "mundo": centro em (0, 0), y para baixo; a planta cabe em
 * x ∈ [-1,25, 1,25] e y ∈ [-0,9, 0,9]. Puro (sem DOM): o nome em hebraico é
 * amostrado fora daqui (precisa de canvas) e chega pronto em `nameSamples`.
 */

/** Tintas da planta (índices em `PALETTE`). */
export const Ink = {
  Dust: 0,
  Gold: 1,
  Ivory: 2,
  Steel: 3,
  Cyan: 4,
  Silver: 5,
  Bronze: 6,
  Ruby: 7,
  Emerald: 8,
  Sapphire: 9,
  Wood: 10,
} as const;
export type Ink = (typeof Ink)[keyof typeof Ink];

export const PALETTE: readonly string[] = [
  '#cfc6b4', // Dust
  '#e6c27a', // Gold
  '#f4ead8', // Ivory
  '#86a9d6', // Steel
  '#7fd6f2', // Cyan
  '#d3dae3', // Silver
  '#cd8550', // Bronze
  '#ee5f7d', // Ruby
  '#45d69a', // Emerald
  '#6c8bff', // Sapphire
  '#b07a45', // Wood
];

export type Point = readonly [number, number];

export interface Segment {
  a: Point;
  b: Point;
  ink: Ink;
  /** Traço mais forte (destaques: arca, portão, nó central). */
  strong?: boolean;
  /** Aresta escondida (atrás do volume): traço fraco, como numa planta. */
  faint?: boolean;
}

export interface Label {
  x: number;
  y: number;
  text: string;
  ink: Ink;
  /** Em que fração do desenho o rótulo aparece (0–1). */
  at: number;
  align?: CanvasTextAlign;
  size?: number;
  /** Fonte hebraica (letras do alfabeto). */
  hebrew?: boolean;
}

export interface Sheet {
  points: Float32Array;
  colors: Uint8Array;
  segments: Segment[];
  labels: Label[];
}

export interface SheetLabels {
  latinName: string;
  meaning: string;
  gifts: readonly string[];
  verbs: readonly string[];
  materials: readonly string[];
  court: string;
  altar: string;
  ark: string;
  holy: string;
  teacher: string;
  partner: string;
  learners: string;
  code: string;
  faces: readonly string[];
}

/** Gerador pseudoaleatório determinístico (a mesma planta a cada visita). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- utilidades ----------------------------------------------------------------

const C30 = Math.cos(Math.PI / 6);

/** Projeção isométrica (X, Z no chão; Y para cima). */
export function iso(x: number, y: number, z: number): Point {
  return [(x - z) * C30, (x + z) * 0.5 - y];
}

function boxEdges(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Array<[Point, Point]> {
  const p = (x: number, y: number, z: number) => iso(x, y, z);
  const e: Array<[Point, Point]> = [];
  for (const y of [y0, y1]) {
    e.push([p(x0, y, z0), p(x1, y, z0)], [p(x1, y, z0), p(x1, y, z1)], [p(x1, y, z1), p(x0, y, z1)], [p(x0, y, z1), p(x0, y, z0)]);
  }
  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ] as const)
    e.push([p(x, y0, z), p(x, y1, z)]);
  return e;
}

const len = (s: { a: Point; b: Point }) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);

/**
 * Distribui `n` partículas ao longo dos traços, na ordem do desenho (o
 * índice da partícula acompanha o lápis), proporcional ao comprimento × peso.
 */
function alongSegments(
  segs: Array<Segment & { weight?: number }>,
  n: number,
  points: Float32Array,
  colors: Uint8Array,
  offset: number,
  random: () => number,
  jitter = 0.004,
) {
  const w = segs.map((s) => len(s) * (s.weight ?? 1));
  const total = w.reduce((a, b) => a + b, 0) || 1;
  let i = 0;
  segs.forEach((s, k) => {
    const share = k === segs.length - 1 ? n - i : Math.round((n * w[k]!) / total);
    for (let j = 0; j < share && i < n; j++, i++) {
      const u = (j + random()) / Math.max(1, share);
      const idx = offset + i;
      points[idx * 2] = s.a[0] + (s.b[0] - s.a[0]) * u + (random() - 0.5) * jitter;
      points[idx * 2 + 1] = s.a[1] + (s.b[1] - s.a[1]) * u + (random() - 0.5) * jitter;
      colors[idx] = s.ink;
    }
  });
  // Arredondamentos: completa com o último traço.
  for (; i < n; i++) {
    const s = segs[segs.length - 1]!;
    points[(offset + i) * 2] = s.b[0];
    points[(offset + i) * 2 + 1] = s.b[1];
    colors[offset + i] = s.ink;
  }
}

function circle(cx: number, cy: number, r: number, steps: number, ink: Ink, sx = 1, start = -Math.PI / 2): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < steps; i++) {
    const a0 = start + (i / steps) * Math.PI * 2;
    const a1 = start + ((i + 1) / steps) * Math.PI * 2;
    out.push({ a: [cx + Math.cos(a0) * r * sx, cy + Math.sin(a0) * r], b: [cx + Math.cos(a1) * r * sx, cy + Math.sin(a1) * r], ink });
  }
  return out;
}

function fit(segs: Segment[], width: number, height: number, cy = 0): { segs: Segment[]; map: (p: Point) => Point } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of segs)
    for (const p of [s.a, s.b]) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
  const k = Math.min(width / (maxX - minX), height / (maxY - minY));
  const ox = (minX + maxX) / 2;
  const oy = (minY + maxY) / 2;
  const map = (p: Point): Point => [(p[0] - ox) * k, (p[1] - oy) * k + cy];
  return { segs: segs.map((s) => ({ ...s, a: map(s.a), b: map(s.b) })), map };
}

// ---- as folhas -------------------------------------------------------------------

/** Quantas folhas: 0 (matéria espalhada) + 7 capítulos. */
export const SHEETS = 8;

/** Santo dos Santos: cubo de 10 côvados no fundo da tenda — e o símbolo, ao final. */
const HOLY = { x0: 10, x1: 20, z0: 20, z1: 30 };

/** Em `boxEdges`, as três arestas que tocam o vértice escondido (0, 0, 0). */
const HIDDEN_EDGES = new Set([0, 3, 8]);

export interface Geometry {
  sheets: Sheet[];
  /** Arestas do Santo dos Santos na folha 4 (ponto de partida do cubo final). */
  holyEdges: Array<[Point, Point]>;
  /** Arestas do cubo-símbolo na folha 7, na mesma ordem. */
  markEdges: Array<[Point, Point]>;
  /** Altura do cubo-símbolo (unidades do mundo), para alinhar o SVG da marca. */
  markHeight: number;
}

export function buildGeometry(n: number, nameSamples: Float32Array, labels: SheetLabels): Geometry {
  const sheets: Sheet[] = [];
  const blank = (): Sheet => ({ points: new Float32Array(n * 2), colors: new Uint8Array(n), segments: [], labels: [] });

  // 0 · Matéria espalhada -------------------------------------------------------------
  {
    const s = blank();
    const r = rng(11);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      s.points[i * 2] = Math.cos(a) * d * 1.25;
      s.points[i * 2 + 1] = Math.sin(a) * d * 0.88;
      s.colors[i] = Ink.Dust;
    }
    sheets.push(s);
  }

  // 1 · O nome -------------------------------------------------------------------------
  {
    const s = blank();
    const r = rng(23);
    const count = nameSamples.length / 2;
    const W = 1.75;
    for (let i = 0; i < n; i++) {
      const k = count ? Math.floor(r() * count) : 0;
      s.points[i * 2] = count ? nameSamples[k * 2]! * W : 0;
      s.points[i * 2 + 1] = count ? nameSamples[k * 2 + 1]! * W - 0.05 : 0;
      s.colors[i] = Ink.Gold;
    }
    // Cota de desenho técnico sob o nome (linha de chamada + traços de extremidade).
    const y = 0.42;
    s.segments.push(
      { a: [-0.875, y - 0.05], b: [-0.875, y + 0.05], ink: Ink.Cyan },
      { a: [-0.875, y], b: [0.875, y], ink: Ink.Cyan },
      { a: [0.875, y - 0.05], b: [0.875, y + 0.05], ink: Ink.Cyan },
      { a: [-1.05, -0.48], b: [1.05, -0.48], ink: Ink.Cyan },
    );
    s.labels.push(
      { x: 0, y: -0.56, text: labels.latinName, ink: Ink.Ivory, at: 0.2, size: 1.15 },
      { x: 0, y: y + 0.13, text: labels.meaning, ink: Ink.Gold, at: 0.65, size: 1.15 },
    );
    sheets.push(s);
  }

  // 2 · Os dons: três anéis que se cruzam ------------------------------------------------
  {
    const s = blank();
    const r = rng(37);
    const R = 0.4;
    const centers: Point[] = [-90, 30, 150].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return [Math.cos(a) * 0.29, Math.sin(a) * 0.29 + 0.04] as const;
    });
    const inks = [Ink.Gold, Ink.Ivory, Ink.Steel];
    for (let i = 0; i < n; i++) {
      const ring = i % 3;
      const c = centers[ring]!;
      const a = r() * Math.PI * 2;
      const rr = R + (r() - 0.5) * 0.025;
      s.points[i * 2] = c[0] + Math.cos(a) * rr;
      s.points[i * 2 + 1] = c[1] + Math.sin(a) * rr;
      s.colors[i] = inks[ring]!;
    }
    centers.forEach((c, k) => s.segments.push(...circle(c[0], c[1], R, 56, inks[k]!)));
    centers.forEach((c, k) => {
      // Rótulo no "lóbulo" exclusivo de cada anel (fora da interseção).
      const dx = c[0];
      const dy = c[1] - 0.04;
      const d = Math.hypot(dx, dy) || 1;
      const lx = (dx / d) * 0.5;
      const ly = 0.04 + (dy / d) * 0.5;
      s.labels.push(
        { x: lx, y: ly - 0.03, text: labels.gifts[k]!, ink: inks[k]!, at: 0.25 + k * 0.2, size: 1.1 },
        { x: lx, y: ly + 0.06, text: labels.verbs[k]!, ink: Ink.Cyan, at: 0.35 + k * 0.2, size: 0.85 },
      );
    });
    sheets.push(s);
  }

  // 3 · A matéria: cinco materiais em pentágono ------------------------------------------
  {
    const s = blank();
    const inks = [Ink.Gold, Ink.Silver, Ink.Bronze, Ink.Ruby, Ink.Wood];
    const gems = [Ink.Ruby, Ink.Emerald, Ink.Sapphire];
    const centers: Point[] = inks.map((_, k) => {
      const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
      return [Math.cos(a) * 0.68, Math.sin(a) * 0.6 + 0.04] as const;
    });
    for (let i = 0; i < n; i++) {
      const m = i % 5;
      const k = Math.floor(i / 5);
      const total = Math.ceil(n / 5);
      const rr = 0.15 * Math.sqrt((k + 0.5) / total);
      const a = k * 2.399963; // ângulo áureo: discos bem distribuídos
      const c = centers[m]!;
      s.points[i * 2] = c[0] + Math.cos(a) * rr;
      s.points[i * 2 + 1] = c[1] + Math.sin(a) * rr;
      s.colors[i] = m === 3 ? gems[k % 3]! : inks[m]!;
    }
    centers.forEach((c, k) => {
      // Placa hexagonal (lapidação) em volta de cada material.
      for (let j = 0; j < 6; j++) {
        const a0 = (j / 6) * Math.PI * 2;
        const a1 = ((j + 1) / 6) * Math.PI * 2;
        s.segments.push({ a: [c[0] + Math.cos(a0) * 0.19, c[1] + Math.sin(a0) * 0.19], b: [c[0] + Math.cos(a1) * 0.19, c[1] + Math.sin(a1) * 0.19], ink: inks[k]! });
      }
    });
    // Tudo converge para o projeto, no centro.
    centers.forEach((c, k) => {
      const d = Math.hypot(c[0], c[1] - 0.04) || 1;
      s.segments.push({ a: [c[0] - (c[0] / d) * 0.2, c[1] - ((c[1] - 0.04) / d) * 0.2], b: [0, 0.04], ink: Ink.Cyan });
      s.labels.push({ x: c[0], y: c[1] + 0.27, text: labels.materials[k]!, ink: inks[k]!, at: 0.15 + k * 0.15, size: 1 });
    });
    sheets.push(s);
  }

  // 4 · A obra: o Tabernáculo em isométrica (côvados) ------------------------------------
  // X = 0 no oeste (fundo) → 100 no leste (entrada, perto de quem olha); Z = norte → sul.
  let holyEdges: Array<[Point, Point]>;
  {
    const raw: Array<Segment & { weight?: number; tag?: string }> = [];
    const add = (edges: Array<[Point, Point]>, ink: Ink, weight = 1, strong = false, tag?: string) =>
      edges.forEach(([a, b]) => raw.push({ a, b, ink, weight, strong, tag }));
    // Pátio: base, colunas a cada 5 côvados e o topo das cortinas (5 côvados).
    const H = 5;
    const ring: Array<[number, number]> = [];
    for (let x = 0; x <= 100; x += 5) ring.push([x, 0]);
    for (let z = 5; z <= 50; z += 5) ring.push([100, z]);
    for (let x = 95; x >= 0; x -= 5) ring.push([x, 50]);
    for (let z = 45; z > 0; z -= 5) ring.push([0, z]);
    for (let i = 0; i < ring.length; i++) {
      const [x0, z0] = ring[i]!;
      const [x1, z1] = ring[(i + 1) % ring.length]!;
      raw.push({ a: iso(x0, 0, z0), b: iso(x1, 0, z1), ink: Ink.Cyan, weight: 0.5 });
    }
    for (const [x, z] of ring) {
      const gate = x === 100 && z >= 15 && z <= 35; // portão de 20 côvados no leste
      raw.push({ a: iso(x, 0, z), b: iso(x, H, z), ink: gate ? Ink.Gold : Ink.Cyan, weight: 0.6, strong: gate });
    }
    for (let i = 0; i < ring.length; i++) {
      const [x0, z0] = ring[i]!;
      const [x1, z1] = ring[(i + 1) % ring.length]!;
      raw.push({ a: iso(x0, H, z0), b: iso(x1, H, z1), ink: Ink.Cyan, weight: 0.4 });
    }
    // Tenda (30 × 10 × 10) e, no fundo, o Santo dos Santos (10 × 10 × 10).
    add(boxEdges(10, 40, 0, 10, 20, 30), Ink.Ivory, 1.4);
    holyEdges = boxEdges(HOLY.x0, HOLY.x1, 0, 10, HOLY.z0, HOLY.z1);
    add(holyEdges, Ink.Gold, 1.6, true, 'holy');
    // Altar de bronze (5 × 5 × 3) perto da entrada; pia entre o altar e a tenda.
    add(boxEdges(77.5, 82.5, 0, 3, 22.5, 27.5), Ink.Bronze, 3, true);
    const laver: Array<[Point, Point]> = [];
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2;
      const a1 = ((i + 1) / 16) * Math.PI * 2;
      laver.push([iso(60 + Math.cos(a0) * 1.6, 0, 25 + Math.sin(a0) * 1.6), iso(60 + Math.cos(a1) * 1.6, 0, 25 + Math.sin(a1) * 1.6)]);
    }
    add(laver, Ink.Silver, 3);
    // Arca (2,5 × 1,5 × 1,5) no centro do Santo dos Santos.
    add(boxEdges(14.25, 15.75, 0, 1.5, 23.75, 26.25), Ink.Gold, 9, true);

    const { segs, map } = fit(raw, 2.35, 1.5, 0.02);
    holyEdges = holyEdges.map(([a, b]) => [map(a), map(b)]);
    const s = blank();
    s.segments = segs;
    alongSegments(segs, n, s.points, s.colors, 0, rng(41), 0.006);
    const at = (x: number, y: number, z: number) => map(iso(x, y, z));
    const court = at(100, 0, 50);
    const altar = at(80, 3, 22.5);
    const holy = at(10, 10, 25);
    s.labels.push(
      { x: court[0] - 0.02, y: court[1] + 0.09, text: labels.court, ink: Ink.Cyan, at: 0.3, size: 0.9, align: 'right' },
      // Chamadas acima da parede noroeste (área livre da prancheta), empilhadas.
      // Um bloco só (a arca fica dentro do Santo dos Santos) e uma linha de chamada.
      { x: holy[0] - 0.18, y: holy[1] - 0.34, text: labels.holy, ink: Ink.Gold, at: 0.62, size: 0.9 },
      { x: holy[0] - 0.18, y: holy[1] - 0.25, text: labels.ark, ink: Ink.Gold, at: 0.84, size: 0.9 },
      { x: altar[0] + 0.03, y: altar[1] - 0.13, text: labels.altar, ink: Ink.Bronze, at: 0.74, size: 0.9 },
    );
    s.segments.push({ a: holy, b: [holy[0] - 0.12, holy[1] - 0.19], ink: Ink.Gold });
    sheets.push(s);
  }

  // 5 · O ensino: uma rede que se multiplica ---------------------------------------------
  {
    interface Node {
      p: Point;
      level: number;
      parent: number;
    }
    const nodes: Node[] = [{ p: [0, 0.04], level: 0, parent: -1 }];
    const sx = 1.32;
    const radii = [0, 0.25, 0.5, 0.74];
    const angles: number[] = [-Math.PI / 2];
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k / 6) * Math.PI * 2;
      angles.push(a);
      nodes.push({ p: [Math.cos(a) * radii[1]! * sx, Math.sin(a) * radii[1]! + 0.04], level: 1, parent: 0 });
    }
    const spread = [0, 0, 0.3, 0.13];
    for (const [level, kids] of [
      [2, 3],
      [3, 2],
    ] as const) {
      const parents = nodes.map((nd, i) => [nd, i] as const).filter(([nd]) => nd.level === level - 1);
      for (const [, pi] of parents) {
        for (let c = 0; c < kids; c++) {
          const a = angles[pi]! + (c - (kids - 1) / 2) * spread[level]!;
          angles.push(a);
          nodes.push({ p: [Math.cos(a) * radii[level]! * sx, Math.sin(a) * radii[level]! + 0.04], level, parent: pi });
        }
      }
    }
    const inkOf = (nd: Node, i: number) => (nd.level === 0 ? Ink.Gold : i === 1 ? Ink.Ivory : nd.level === 1 ? Ink.Ivory : Ink.Cyan);
    const s = blank();
    s.segments = nodes.slice(1).map((nd, k) => ({ a: nodes[nd.parent]!.p, b: nd.p, ink: nd.level === 1 ? Ink.Ivory : Ink.Cyan, strong: k === 0 }));
    // 55% das partículas nas arestas (na ordem das gerações), 45% nos nós.
    const onEdges = Math.floor(n * 0.55);
    alongSegments(s.segments, onEdges, s.points, s.colors, 0, rng(53), 0.004);
    const r = rng(59);
    for (let i = onEdges; i < n; i++) {
      // Nós de gerações mais novas recebem menos matéria; a raiz, mais.
      const k = Math.floor(Math.pow(r(), 1.6) * nodes.length);
      const nd = nodes[k]!;
      const rad = (nd.level === 0 ? 0.05 : nd.level === 1 ? 0.03 : 0.016) * Math.sqrt(r());
      const a = r() * Math.PI * 2;
      s.points[i * 2] = nd.p[0] + Math.cos(a) * rad;
      s.points[i * 2 + 1] = nd.p[1] + Math.sin(a) * rad;
      s.colors[i] = inkOf(nd, k);
    }
    const partner = nodes[1]!.p;
    s.labels.push(
      { x: 0.07, y: 0.04 + 0.08, text: labels.teacher, ink: Ink.Gold, at: 0.05, size: 1.05, align: 'left' },
      { x: partner[0] + 0.05, y: partner[1] + 0.02, text: labels.partner, ink: Ink.Ivory, at: 0.25, size: 0.95, align: 'left' },
      { x: 0, y: 0.04 + radii[3]! + 0.1, text: labels.learners, ink: Ink.Cyan, at: 0.8, size: 0.9 },
    );
    sheets.push(s);
  }

  // 6 · As letras: 22 letras em roda, combinadas -----------------------------------------
  {
    const letters = 'אבגדהוזחטיכלמנסעפצקרשת';
    const R = 0.6;
    const cy = 0;
    const pos = (i: number, rad = R): Point => {
      const a = -Math.PI / 2 + (i / 22) * Math.PI * 2;
      return [Math.cos(a) * rad, Math.sin(a) * rad + cy];
    };
    const s = blank();
    const chords: Segment[] = [];
    for (const step of [5, 9]) for (let i = 0; i < 22; i++) chords.push({ a: pos(i), b: pos((i + step) % 22), ink: step === 5 ? Ink.Cyan : Ink.Gold });
    s.segments = [...circle(0, cy, R, 66, Ink.Gold), ...chords];
    alongSegments(s.segments, n, s.points, s.colors, 0, rng(67), 0.004);
    [...letters].forEach((ch, i) => {
      const p = pos(i, R + 0.11);
      s.labels.push({ x: p[0], y: p[1] + 0.025, text: ch, ink: Ink.Gold, at: (i / 22) * 0.5, size: 1.25, hebrew: true });
    });
    s.labels.push({ x: 0, y: cy + R + 0.26, text: labels.code, ink: Ink.Cyan, at: 0.85, size: 0.95 });
    sheets.push(s);
  }

  // 7 · O legado: o cubo do centro da obra vira o símbolo --------------------------------
  // O cubo isométrico de lado 1 ocupa y ∈ [-1, 1] e x ∈ [-0,87, 0,87]: já
  // nasce centrado, com o vértice das três faces (o "nó" da marca) em (0, 0).
  const side = 0.62;
  const cube = (x: number, y: number, z: number): Point => iso(x * side, y * side, z * side);
  const markEdges: Array<[Point, Point]> = boxEdges(0, side, 0, side, 0, side);
  {
    const s = blank();
    const r = rng(71);
    // Faces visíveis (como na marca): topo = Descobrir (ouro), esquerda (z = 1) =
    // Aprender (marfim), direita (x = 1) = Construir (aço).
    const faces: Array<{ o: Point; u: Point; v: Point; ink: Ink; share: number }> = [
      { o: cube(1, 1, 1), u: sub(cube(0, 1, 1), cube(1, 1, 1)), v: sub(cube(1, 1, 0), cube(1, 1, 1)), ink: Ink.Gold, share: 0.42 },
      { o: cube(1, 0, 1), u: sub(cube(1, 1, 1), cube(1, 0, 1)), v: sub(cube(0, 0, 1), cube(1, 0, 1)), ink: Ink.Ivory, share: 0.27 },
      { o: cube(1, 0, 0), u: sub(cube(1, 1, 0), cube(1, 0, 0)), v: sub(cube(1, 0, 1), cube(1, 0, 0)), ink: Ink.Steel, share: 0.31 },
    ];
    let i = 0;
    faces.forEach((f, k) => {
      const count = k === faces.length - 1 ? n - i : Math.round(n * f.share);
      for (let j = 0; j < count; j++, i++) {
        const u = 0.04 + r() * 0.92;
        const v = 0.04 + r() * 0.92;
        s.points[i * 2] = f.o[0] + f.u[0] * u + f.v[0] * v;
        s.points[i * 2 + 1] = f.o[1] + f.u[1] * u + f.v[1] * v;
        s.colors[i] = f.ink;
      }
    });
    s.segments = markEdges.map(([a, b], k) => ({ a, b, ink: Ink.Gold, strong: !HIDDEN_EDGES.has(k), faint: HIDDEN_EDGES.has(k) }));
    const top = cube(0.5, 1, 0.5);
    const left = cube(0.5, 0.5, 1);
    const right = cube(1, 0.5, 0.5);
    s.labels.push(
      { x: top[0], y: top[1] - 0.42, text: labels.faces[0]!, ink: Ink.Gold, at: 0.55, size: 0.95 },
      { x: left[0] - 0.42, y: left[1] + 0.02, text: labels.faces[1]!, ink: Ink.Ivory, at: 0.7, size: 0.95, align: 'right' },
      { x: right[0] + 0.42, y: right[1] + 0.02, text: labels.faces[2]!, ink: Ink.Steel, at: 0.85, size: 0.95, align: 'left' },
    );
    sheets.push(s);
  }

  return { sheets, holyEdges, markEdges, markHeight: 2 * side };
}

function sub(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1]];
}
