import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR_SPECS, type CarClass } from '../world/vehicles';

/**
 * Desenho dos carros do Universe por superfícies "loft", como no design
 * automotivo: a carroceria é uma sequência de seções transversais ao longo do
 * comprimento, cada uma uma curva suave (ombro, flanco, estreitamento da
 * cabine), e as seções são interpoladas por curvas de altura, cintura, teto e
 * largura de cada modelo. O resultado é uma superfície contínua — capô,
 * para-lamas, ombros, para-brisa e traseira saem da mesma pele — e não uma
 * caixa extrudada.
 *
 * Os arcos das rodas nascem da própria superfície: perto de cada eixo, a borda
 * inferior da seção sobe acompanhando um círculo em volta do pneu. Vidro,
 * pintura, colunas e acabamento inferior são regiões da mesma pele (cortes
 * nítidos, normais contínuas). Faróis e lanternas são faixas desenhadas na
 * frente e na traseira, frisos e vincos das portas acompanham a superfície.
 *
 * Coordenadas do carro: x = largura, y = altura, z = comprimento (frente +z).
 */

export type BodyPart = 'paint' | 'glass' | 'trim' | 'chrome' | 'gold' | 'head' | 'tail' | 'sign' | 'sensor';

type Key = Array<[number, number]>;

/** Interpolação cúbica monótona (Fritsch–Carlson): suave e sem "calombos" entre pontos de controle. */
function curve(keys: Key): (u: number) => number {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]! || 1));
  const m: number[] = [d[0]!];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2);
  m.push(d[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i]!;
      m[i + 1] = t * b * d[i]!;
    }
  }
  return (u: number) => {
    if (u <= xs[0]!) return ys[0]!;
    if (u >= xs[n - 1]!) return ys[n - 1]!;
    let i = 0;
    while (u > xs[i + 1]!) i++;
    const h = xs[i + 1]! - xs[i]!;
    const t = (u - xs[i]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * h * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * h * m[i + 1]!;
  };
}

/** Desenho de um modelo: curvas em u (0 = traseira, 1 = frente), em metros. */
interface Design {
  /** Altura da linha central de cima (para-choque, porta-malas, vidro traseiro, teto, para-brisa, capô, bico). */
  top: Key;
  /** Linha de cintura (base dos vidros). */
  belt: Key;
  /** Borda inferior (soleira), antes de recortar os arcos. */
  bottom: Key;
  /** Meias-larguras: no ombro (a mais larga), em cima e na soleira. */
  shoulder: Key;
  roof: Key;
  /** Faixa da cabine (onde há vidro acima da cintura). */
  cabin: [number, number];
  /** Colunas pintadas (centro em u, meia-largura em u). */
  pillars: Array<[number, number]>;
  /** Teto pintado (de u a u); fora dele, a estufa é vidro até o teto. */
  roofPaint?: [number, number];
  /** Arcos: folga acima do pneu e alargamento do para-lama. */
  archGap: number;
  flare: number;
  /** Abaulamento do teto (m) e quanto o flanco "entra" embaixo. */
  crown: number;
  /** Altura das faixas de luz na frente e atrás. */
  headY: number;
  tailY: number;
  /**
   * Faixas de luz como regiões da própria pele, em fileiras do perfil (0 = fundo, 4 = ombro, 5 = cintura,
   * 9 = centro do teto): [de, até, fração da largura apagada no meio]. Pelas fileiras, a borda da luz é uma
   * linha contínua do desenho (acompanha o ombro), e não uma escada de faces.
   */
  headBand: [number, number, number];
  tailBand: [number, number, number];
  /** Barras de luz de ponta a ponta, nas fileiras de cima das pontas (borda do capô / do porta-malas): faixa em u. */
  headBar: [number, number];
  tailBar: [number, number];
  /** As tampas das pontas (para-choques) em acabamento escuro: painel frontal e difusor. */
  darkCaps: boolean;
}

const DESIGNS: Record<CarClass, Design> = {
  // Sedã premium "fastback": capô longo, para-brisa deitado, teto que desce contínuo até o porta-malas curto.
  sedan: {
    top: [[0, 0.6], [0.04, 0.84], [0.13, 0.92], [0.24, 0.98], [0.34, 1.24], [0.44, 1.41], [0.55, 1.45], [0.63, 1.37], [0.71, 1.06], [0.77, 0.96], [0.9, 0.86], [0.97, 0.74], [1, 0.58]],
    belt: [[0, 0.62], [0.08, 0.84], [0.24, 0.96], [0.5, 0.99], [0.72, 0.95], [0.86, 0.86], [1, 0.62]],
    bottom: [[0, 0.4], [0.06, 0.3], [0.5, 0.25], [0.93, 0.28], [1, 0.38]],
    shoulder: [[0, 0.84], [0.06, 0.93], [0.2, 0.975], [0.45, 0.95], [0.72, 0.965], [0.9, 0.93], [1, 0.8]],
    roof: [[0, 0.66], [0.2, 0.72], [0.36, 0.64], [0.5, 0.6], [0.66, 0.64], [0.78, 0.76], [0.92, 0.78], [1, 0.66]],
    cabin: [0.27, 0.74],
    pillars: [[0.505, 0.012]],
    roofPaint: [0.42, 0.62],
    archGap: 0.07,
    flare: 0.025,
    crown: 0.04,
    headY: 0.68,
    tailY: 0.82,
    headBand: [3.55, 4.25, 0],
    tailBand: [4.0, 4.7, 0],
    headBar: [0.968, 0.982],
    tailBar: [0.02, 0.029],
    darkCaps: true,
  },
  // Esportivo de motor central: cunha baixa, cabine recuada, para-lamas traseiros largos, traseira cortada.
  sport: {
    top: [[0, 0.72], [0.05, 0.94], [0.16, 0.97], [0.3, 1.05], [0.42, 1.15], [0.52, 1.16], [0.6, 1.08], [0.68, 0.86], [0.8, 0.74], [0.92, 0.6], [1, 0.42]],
    belt: [[0, 0.7], [0.2, 0.86], [0.42, 0.88], [0.62, 0.82], [0.8, 0.7], [1, 0.42]],
    bottom: [[0, 0.32], [0.08, 0.2], [0.5, 0.17], [0.92, 0.2], [1, 0.28]],
    shoulder: [[0, 0.92], [0.12, 1.01], [0.26, 1.0], [0.46, 0.9], [0.6, 0.93], [0.76, 0.99], [0.92, 0.94], [1, 0.74]],
    roof: [[0, 0.82], [0.22, 0.82], [0.38, 0.56], [0.5, 0.52], [0.6, 0.58], [0.72, 0.84], [0.92, 0.8], [1, 0.6]],
    cabin: [0.37, 0.69],
    pillars: [],
    archGap: 0.05,
    flare: 0.05,
    crown: 0.03,
    headY: 0.5,
    tailY: 0.82,
    headBand: [3.7, 4.2, 0.42],
    tailBand: [4.3, 4.75, 0],
    headBar: [0.976, 0.986],
    tailBar: [0.014, 0.028],
    darkCaps: true,
  },
  // Táxi autônomo: cápsula alta de portas de correr, estufa ampla quase sem colunas, bico curto.
  taxi: {
    top: [[0, 1.12], [0.05, 1.5], [0.14, 1.74], [0.3, 1.82], [0.6, 1.83], [0.78, 1.72], [0.88, 1.38], [0.95, 1.02], [1, 0.84]],
    belt: [[0, 0.98], [0.3, 0.99], [0.8, 0.99], [0.92, 0.94], [1, 0.82]],
    bottom: [[0, 0.42], [0.06, 0.32], [0.5, 0.3], [0.94, 0.32], [1, 0.42]],
    shoulder: [[0, 0.88], [0.08, 0.95], [0.3, 0.975], [0.75, 0.975], [0.92, 0.95], [1, 0.84]],
    roof: [[0, 0.74], [0.12, 0.86], [0.5, 0.88], [0.8, 0.86], [0.92, 0.8], [1, 0.74]],
    cabin: [0.07, 0.9],
    pillars: [[0.42, 0.01], [0.66, 0.008]],
    roofPaint: [0.18, 0.84],
    archGap: 0.06,
    flare: 0.015,
    crown: 0.05,
    headY: 0.78,
    tailY: 1.02,
    headBand: [3.8, 4.5, 0],
    tailBand: [4.2, 4.9, 0],
    headBar: [0.955, 0.972],
    tailBar: [0.03, 0.05],
    darkCaps: false,
  },
};

export interface DesignedCar {
  parts: Map<BodyPart, THREE.BufferGeometry>;
  tire: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  wheels: Array<[number, number, number]>;
  tailY: number;
}

/** Corta e devolve as faces de uma pele (posições e normais compartilhadas) como geometria própria. */
function subset(positions: Float32Array, normals: Float32Array, indices: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setIndex(indices);
  // Fica só com os vértices usados (sem carregar a pele inteira em cada material).
  const out = g.toNonIndexed();
  g.dispose();
  return out;
}

/** Medidas da cabine de um modelo (coordenadas do carro: frente em +z, motorista à esquerda, em +x, chão em y = 0). */
export interface Cabin {
  /** Base do para-brisa e do vidro traseiro (z). */
  front: number;
  back: number;
  /** Altura da cintura (base dos vidros) na frente da cabine: o alto do painel. */
  dash: number;
  /** Olhos do motorista. */
  head: [number, number, number];
  /** Meia-largura interna na altura da cintura. */
  half: number;
  /** Altura do teto sobre o motorista. */
  roof: number;
}

/**
 * Onde fica a cabine, tirado das curvas do próprio desenho (o mesmo de onde
 * sai a carroceria): o painel na base do para-brisa, o motorista ~1 m atrás,
 * os olhos ~20 cm abaixo do teto. Serve ao interior e à câmera em primeira pessoa.
 */
export function cabinOf(cls: CarClass): Cabin {
  const D = DESIGNS[cls];
  const L = CAR_SPECS[cls].length;
  const top = curve(D.top);
  const belt = curve(D.belt);
  const shoulder = curve(D.shoulder);
  const zOf = (u: number) => (u - 0.5) * L;
  const uOf = (z: number) => z / L + 0.5;
  const front = zOf(D.cabin[1]);
  const back = zOf(D.cabin[0]);
  const headZ = front - (cls === 'sport' ? 0.95 : cls === 'taxi' ? 1.0 : 1.05);
  const u = uOf(headZ);
  const roof = top(u);
  const headY = Math.min(roof - 0.2, belt(u) + 0.38);
  return { front, back, dash: belt(D.cabin[1]), head: [0.38, headY, headZ], half: shoulder(u) - 0.1, roof };
}

/**
 * Monta um carro em um de três níveis de detalhe: `near` (o do jogador e os
 * de até ~18 m), `mid` (o trânsito de perto: a mesma pele e os mesmos
 * detalhes com cerca de um terço dos triângulos) e `far` (poucas seções, sem
 * frisos nem vincos).
 */
export type CarLod = 'near' | 'mid' | 'far';

export function designCar(cls: CarClass, lod: CarLod = 'near'): DesignedCar {
  const far = lod === 'far';
  const mid = lod === 'mid';
  const spec = CAR_SPECS[cls];
  const D = DESIGNS[cls];
  const L = spec.length;
  const half = spec.width / 2;
  const r = spec.wheelRadius;
  const wb = spec.wheelbase / 2;
  const f = { top: curve(D.top), belt: curve(D.belt), bottom: curve(D.bottom), shoulder: curve(D.shoulder), roof: curve(D.roof) };
  const zOf = (u: number) => (u - 0.5) * L;
  const archR = r + D.archGap;
  /** Quanto o arco "sobe" a soleira nesta estação (0 fora dos arcos). */
  const archLift = (z: number) => {
    let y = 0;
    let k = 0;
    for (const zw of [wb, -wb]) {
      const dz = z - zw;
      if (Math.abs(dz) < archR) {
        y = Math.max(y, r + Math.sqrt(archR * archR - dz * dz));
        k = Math.max(k, 1 - Math.abs(dz) / archR);
      }
    }
    return { y, k };
  };

  // ---- Estações ao longo do comprimento: mais densas nas pontas e em volta dos arcos ----
  const stations: number[] = [];
  const S = far ? 16 : mid ? 26 : 64;
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    stations.push(0.5 - 0.5 * Math.cos(Math.PI * t)); // mais estações perto das pontas
  }
  if (!far)
    for (const zw of [wb, -wb])
      for (let k = -1; k <= 1; k += mid ? 1 / 5 : 1 / 12) {
        const u = (zw + k * archR) / L + 0.5;
        if (u > 0.02 && u < 0.98) stations.push(u);
      }
  stations.sort((a, b) => a - b);
  const us = stations.filter((u, i) => i === 0 || u - stations[i - 1]! > 1e-4);

  // ---- Seção transversal: meio perfil (lado +x) de baixo ao centro do teto ----
  // Pontos por meio perfil: múltiplo dos 9 trechos entre pontos de controle (as fileiras caem nas linhas do desenho).
  const PER = far ? 1 : mid ? 2 : 3;
  const N = 9 * PER;
  const section = (u: number) => {
    const z = zOf(u);
    const top = f.top(u);
    const belt = Math.min(f.belt(u), top - 0.04);
    const arch = archLift(z);
    const bottom = Math.max(f.bottom(u), arch.y);
    const hwS = f.shoulder(u) * half + D.flare * arch.k;
    const hwT = Math.min(f.roof(u) * half, hwS - 0.03);
    const hwL = hwS - 0.05;
    // Flanco em frações do vão soleira–cintura: a curva sobe sempre (não dobra sobre si quando o arco
    // aproxima a soleira da cintura — o que invertia as normais e manchava os para-lamas).
    const span = Math.max(0.04, belt - bottom);
    const pts = [
      new THREE.Vector3(0, bottom, z),
      new THREE.Vector3(hwL * 0.82, bottom, z),
      new THREE.Vector3(hwL, bottom + span * 0.14, z),
      new THREE.Vector3(hwS * 0.995, bottom + span * 0.46, z),
      new THREE.Vector3(hwS, bottom + span * 0.78, z),
      new THREE.Vector3(hwS * 0.985, belt, z),
      new THREE.Vector3(hwT + (hwS - hwT) * 0.5, belt + (top - belt) * 0.55, z),
      new THREE.Vector3(hwT, top - 0.025, z),
      new THREE.Vector3(hwT * 0.55, top + D.crown * 0.6, z),
      new THREE.Vector3(0, top + D.crown, z),
    ];
    const spline = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    // Amostragem por parâmetro (não por comprimento): o ponto j de toda seção corresponde ao mesmo trecho do
    // desenho — as faces entre seções vizinhas não torcem (era o que manchava os para-lamas perto dos arcos).
    const sampled: THREE.Vector3[] = [];
    for (let j = 0; j <= N; j++) sampled.push(spline.getPoint(j / N));
    return { pts: sampled, top, belt, bottom, base: f.bottom(u), hwS, hwT };
  };

  const rings = us.map((u) => ({ u, ...section(u) }));
  // Anel completo: lado +x (de baixo ao topo) e o espelho -x (do topo de volta para baixo).
  const ringSize = 2 * N;
  const positions = new Float32Array((rings.length * ringSize + 2) * 3);
  rings.forEach((ring, i) => {
    for (let j = 0; j <= N; j++) {
      const p = ring.pts[j]!;
      positions.set([p.x, p.y, p.z], (i * ringSize + j) * 3);
    }
    for (let j = 1; j < N; j++) {
      const p = ring.pts[N - j]!;
      positions.set([-p.x, p.y, p.z], (i * ringSize + N + j) * 3);
    }
  });
  const rearC = rings.length * ringSize;
  const frontC = rearC + 1;
  const centroid = (ring: (typeof rings)[number]) => ring.pts.reduce((a, p) => a + p.y, 0) / ring.pts.length;
  positions.set([0, centroid(rings[0]!), rings[0]!.pts[0]!.z], rearC * 3);
  positions.set([0, centroid(rings.at(-1)!), rings.at(-1)!.pts[0]!.z], frontC * 3);

  // ---- Faces, já separadas por região ----
  const idx: Record<'paint' | 'glass' | 'trim' | 'head' | 'tail', number[]> = { paint: [], glass: [], trim: [], head: [], tail: [] };
  const vy = (v: number) => positions[v * 3 + 1]!;
  const vx = (v: number) => Math.abs(positions[v * 3]!);
  /** Posição da face no perfil, em trechos (0 = fundo … 9 = centro do teto), dos dois lados. */
  const rowOf = (j: number) => (j < N ? j + 0.5 : 2 * N - j - 0.5) / PER;
  const region = (ring: (typeof rings)[number], next: (typeof rings)[number], a: number, b: number, c: number, d: number, row: number): 'paint' | 'glass' | 'trim' | 'head' | 'tail' => {
    const u = (ring.u + next.u) / 2;
    const y = (vy(a) + vy(b) + vy(c) + vy(d)) / 4;
    const x = (vx(a) + vx(b) + vx(c) + vx(d)) / 4;
    const belt = (ring.belt + next.belt) / 2;
    const bottom = (ring.bottom + next.bottom) / 2;
    const base = (ring.base + next.base) / 2;
    const hw = (ring.hwS + next.hwS) / 2;
    // Luzes: faixas da própria pele perto das pontas (acompanham a curvatura; nunca soltas nem enterradas).
    // Na versão de longe há uma fileira por trecho: a faixa vira a fileira que a contém.
    const band = (b: [number, number, number]) => (far ? Math.floor(row) === Math.floor((b[0] + b[1]) / 2) : row > b[0] && row < b[1]) && x > hw * b[2];
    if (u > 0.93 && band(D.headBand)) return 'head';
    if (u < 0.07 && band(D.tailBand)) return 'tail';
    // Barras de ponta a ponta na borda de cima de cada extremidade (fecham a assinatura de luz).
    if (row > 6.3 && u > D.headBar[0] && u < D.headBar[1]) return 'head';
    if (row > 6.3 && u > D.tailBar[0] && u < D.tailBar[1]) return 'tail';
    // Saia (pela soleira original, não a levantada pelo arco), friso fino em volta do arco e o fundo.
    if (y < base + 0.11 || y < bottom + 0.03) return 'trim';
    void belt;
    // Estufa: acima da fileira da cintura (5), dentro da cabine; teto a partir da borda do teto (7).
    if (u > D.cabin[0] && u < D.cabin[1] && row > 5) {
      const onRoof = row > 7.4;
      if (onRoof && D.roofPaint && u > D.roofPaint[0] && u < D.roofPaint[1]) return 'paint';
      if (!onRoof && D.pillars.some(([pu, pw]) => Math.abs(u - pu) < pw)) return 'paint';
      return 'glass';
    }
    return 'paint';
  };
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < ringSize; j++) {
      const a = i * ringSize + j;
      const b = i * ringSize + ((j + 1) % ringSize);
      const c = (i + 1) * ringSize + j;
      const d = (i + 1) * ringSize + ((j + 1) % ringSize);
      const part = region(rings[i]!, rings[i + 1]!, a, b, c, d, rowOf(j));
      // Normais para fora: (a, b, c) e (b, d, c) — o anel sobe no lado +x e as estações avançam em +z.
      idx[part].push(a, b, c, b, d, c);
    }
  // Tampas da traseira e da frente: painel frontal e difusor escuros (ou pintura, no táxi).
  const last = (rings.length - 1) * ringSize;
  const caps = D.darkCaps ? idx.trim : idx.paint;
  for (let j = 0; j < ringSize; j++) {
    const j2 = (j + 1) % ringSize;
    caps.push(rearC, j2, j);
    caps.push(frontC, last + j, last + j2);
  }
  // Normais da pele inteira (contínuas entre vidro e pintura).
  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  skin.setIndex([...idx.paint, ...idx.glass, ...idx.trim]);
  skin.computeVertexNormals();
  const normals = skin.attributes.normal!.array as Float32Array;
  skin.dispose();

  const parts = new Map<BodyPart, THREE.BufferGeometry[]>();
  const add = (p: BodyPart, ...g: THREE.BufferGeometry[]) => parts.set(p, [...(parts.get(p) ?? []), ...g]);
  add('paint', subset(positions, normals, idx.paint));
  add('glass', subset(positions, normals, idx.glass));
  add('trim', subset(positions, normals, idx.trim));
  if (idx.head.length) add('head', subset(positions, normals, idx.head));
  if (idx.tail.length) add('tail', subset(positions, normals, idx.tail));

  // ---- Peças desenhadas sobre a pele ----
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed();
  const zR = zOf(0);
  if (cls === 'sport') {
    // Difusor e entradas laterais (escuras), asa traseira sobre dois pilares.
    for (let i = -3; i <= 3; i++) add('trim', box(0.035, 0.16, 0.42, i * 0.22, 0.26, zR + 0.2));
    add('trim', ...[1, -1].map((s) => box(0.05, 0.22, 0.55, s * (f.shoulder(0.32) * half - 0.015), 0.62, zOf(0.32))));
    add('paint', box(spec.width * 0.86, 0.04, 0.32, 0, 1.12, zOf(0.06)), ...[1, -1].map((s) => box(0.05, 0.16, 0.16, s * 0.55, 1.03, zOf(0.06))));
  } else if (cls === 'taxi') {
    // Letreiro e sensor (lidar) no teto.
    add('sign', box(0.9, 0.2, 0.3, 0, f.top(0.48) + 0.13, zOf(0.48)));
    add('trim', new THREE.CylinderGeometry(0.2, 0.22, 0.12, 20).translate(0, f.top(0.72) + 0.06, zOf(0.72)).toNonIndexed());
    add('sensor', new THREE.CylinderGeometry(0.205, 0.205, 0.03, 20).translate(0, f.top(0.72) + 0.08, zOf(0.72)).toNonIndexed());
  }
  if (!far) {
    // Frisos que acompanham a superfície: cromado na base dos vidros e, no táxi, a faixa dourada da frota.
    const along = (part: BodyPart, u0: number, u1: number, yAt: (u: number) => number, width: number, outward = 0.006) => {
      const pts: THREE.Vector3[] = [];
      const steps = mid ? 10 : 24;
      for (let k = 0; k <= steps; k++) {
        const u = u0 + ((u1 - u0) * k) / steps;
        const ring = section(u);
        const y = yAt(u);
        // Ponto do flanco nessa altura (interpolado no meio perfil).
        let x = ring.hwS;
        for (let j = 0; j < ring.pts.length - 1; j++) {
          const a = ring.pts[j]!;
          const b = ring.pts[j + 1]!;
          if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) {
            x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
            break;
          }
        }
        pts.push(new THREE.Vector3(x + outward, y, zOf(u)));
      }
      for (const s of [1, -1]) {
        const strip: THREE.BufferGeometry[] = [];
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k]!;
          const b = pts[k + 1]!;
          const len = a.distanceTo(b);
          const g = new THREE.BoxGeometry(0.008, width, len * 1.02);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
          g.applyQuaternion(q).translate(s * mid.x, mid.y, mid.z);
          strip.push(g.toNonIndexed());
        }
        add(part, ...strip);
      }
    };
    along('chrome', D.cabin[0] + 0.02, D.cabin[1] - 0.02, (u) => Math.min(f.belt(u), f.top(u) - 0.04) + 0.006, 0.018);
    if (cls === 'taxi') along('gold', 0.04, 0.96, () => 0.74, 0.05);
    if (cls === 'sedan') along('chrome', 0.1, 0.9, () => 0.5, 0.012, 0.004);
    // Vincos das portas (escuros, verticais) e maçanetas embutidas.
    const seams: Record<CarClass, number[]> = { sedan: [0.355, 0.5, 0.69], sport: [0.42, 0.66], taxi: [0.4, 0.68] };
    for (const u of seams[cls]) {
      const ring = section(u);
      const y0 = ring.bottom + 0.12;
      const y1 = Math.min(f.belt(u), f.top(u) - 0.04) - 0.01;
      for (const s of [1, -1]) add('trim', box(0.012, y1 - y0, 0.012, s * (ring.hwS + 0.003), (y0 + y1) / 2, zOf(u)));
    }
    for (const u of cls === 'sport' ? [0.5] : cls === 'taxi' ? [0.36, 0.62] : [0.43, 0.6])
      for (const s of [1, -1]) add('chrome', box(0.014, 0.025, 0.16, s * (section(u).hwS + 0.004), Math.min(f.belt(u), f.top(u) - 0.04) - 0.12, zOf(u)));
    // Câmeras no lugar dos retrovisores, na base do para-brisa.
    const uA = D.cabin[1] - 0.04;
    for (const s of [1, -1]) {
      const g = new THREE.SphereGeometry(0.06, mid ? 8 : 14, mid ? 6 : 10).scale(0.7, 0.55, 1.6);
      g.translate(s * (section(uA).hwS + 0.07), Math.min(f.belt(uA), f.top(uA)) + 0.06, zOf(uA));
      add('trim', g.toNonIndexed());
    }
  }

  // ---- Rodas ----
  const { tire, rim } = wheel(r, cls, lod);
  const tx = half - 0.16;
  const merged = new Map<BodyPart, THREE.BufferGeometry>();
  for (const [p, list] of parts) {
    for (const g of list) {
      g.deleteAttribute('uv');
      if (!g.attributes.normal) g.computeVertexNormals();
    }
    merged.set(p, mergeGeometries(list)!);
    list.forEach((g) => g.dispose());
  }
  return {
    parts: merged,
    tire,
    rim,
    wheels: [
      [tx, r, wb],
      [-tx, r, wb],
      [tx, r, -wb],
      [-tx, r, -wb],
    ],
    tailY: D.tailY,
  };
}

/**
 * Roda simétrica (o mesmo desenho visto de qualquer lado, para instanciar sem
 * espelhar): pneu revolvido com flanco e ombro arredondado; aro com cubo
 * côncavo, raios e disco de freio. Sedã: 5 raios duplos; esportivo: 10 raios
 * finos e pinça dourada; táxi: calota aerodinâmica com fendas.
 */
function wheel(r: number, cls: CarClass, lod: CarLod) {
  const far = lod === 'far';
  const w = 0.27;
  const seg = far ? 10 : lod === 'mid' ? 16 : 32;
  // Perfil do pneu (x = raio, y = posição no eixo), girado em volta do eixo: flanco abaulado, ombro
  // arredondado e banda de rodagem levemente curva.
  const inner = r - 0.115;
  const sh = 0.045;
  const arc = far ? 2 : lod === 'mid' ? 3 : 6;
  const prof: THREE.Vector2[] = [new THREE.Vector2(inner, -w / 2 + 0.01), new THREE.Vector2(r - 0.07, -w / 2 - 0.006), new THREE.Vector2(r - sh, -w / 2)];
  for (let k = 1; k <= arc; k++) {
    const a = -Math.PI / 2 + (k / arc) * (Math.PI / 2);
    prof.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, -w / 2 + sh + Math.sin(a) * sh));
  }
  prof.push(new THREE.Vector2(r + 0.004, 0));
  for (let k = 0; k < arc; k++) {
    const a = (k / arc) * (Math.PI / 2);
    prof.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, w / 2 - sh + Math.sin(a) * sh));
  }
  prof.push(new THREE.Vector2(r - sh, w / 2), new THREE.Vector2(r - 0.07, w / 2 + 0.006), new THREE.Vector2(inner, w / 2 - 0.01));
  const tire = new THREE.LatheGeometry(prof, seg);
  // O torno gira em volta de y: deita para o eixo x.
  tire.rotateZ(Math.PI / 2);

  const rimParts: THREE.BufferGeometry[] = [];
  const rr = inner + 0.005;
  // Aro: barril e um cubo côncavo dos dois lados (simétrico).
  const dish = new THREE.LatheGeometry([new THREE.Vector2(0.06, -0.035), new THREE.Vector2(rr * 0.35, -0.06), new THREE.Vector2(rr * 0.9, -0.1), new THREE.Vector2(rr, -0.12), new THREE.Vector2(rr, 0.12), new THREE.Vector2(rr * 0.9, 0.1), new THREE.Vector2(rr * 0.35, 0.06), new THREE.Vector2(0.06, 0.035)], seg);
  dish.rotateZ(Math.PI / 2);
  rimParts.push(dish);
  if (!far) {
    const spokes = cls === 'sport' ? 10 : cls === 'sedan' ? 5 : 0;
    for (let i = 0; i < spokes; i++)
      for (const side of [1, -1]) {
        const a = (i / spokes) * Math.PI * 2;
        const twin = cls === 'sedan' ? [-0.09, 0.09] : [0];
        for (const off of twin) {
          const g = new THREE.BoxGeometry(0.035, rr * 0.82, cls === 'sport' ? 0.028 : 0.045);
          g.translate(side * 0.1, rr * 0.47, 0).rotateX(a + off);
          rimParts.push(g);
        }
      }
    if (cls === 'taxi') {
      // Calota aerodinâmica com fendas radiais.
      for (const side of [1, -1]) {
        const cap = new THREE.CylinderGeometry(rr * 0.96, rr * 0.96, 0.02, seg).rotateZ(Math.PI / 2).translate(side * 0.115, 0, 0);
        rimParts.push(cap);
        for (let i = 0; i < 7; i++) {
          const slot = new THREE.BoxGeometry(0.03, rr * 0.4, 0.035).translate(side * 0.128, rr * 0.55, 0).rotateX((i / 7) * Math.PI * 2);
          rimParts.push(slot);
        }
      }
    }
    // Disco de freio e pinça (no esportivo, a pinça é dourada — vai junto com o aro, cor do metal).
    rimParts.push(new THREE.CylinderGeometry(rr * 0.78, rr * 0.78, 0.03, seg).rotateZ(Math.PI / 2));
    rimParts.push(new THREE.BoxGeometry(0.08, 0.1, 0.16).translate(0, rr * 0.62, -rr * 0.2));
  }
  for (const g of rimParts) g.deleteAttribute('uv');
  tire.deleteAttribute('uv');
  const rim = mergeGeometries(rimParts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  rimParts.forEach((g) => g.dispose());
  return { tire, rim };
}
