/**
 * A escultura do leão como um campo de distância (SDF): a superfície é onde a
 * função vale zero. Ela é feita como um escultor faria em argila — massas
 * principais (tronco, peito, quadris), membros, cabeça e a juba em mechas —,
 * cada peça fundida às vizinhas por uma união suave (`smin`), o que dá as
 * transições de músculo e pelagem sem emendas. Detalhes finos (olhos, narinas,
 * vinco da boca, dedos) entram só no último estágio.
 *
 * Funções puras, sem three.js: rodam num Web Worker (malha) e nos testes.
 * Unidades em metros; o leão olha para +x, o chão é y = 0 e o lado do
 * visitante é +z.
 */

export type Vec3 = [number, number, number];

/** Grupo de cada peça: decide em que estágio da construção ela aparece. */
export type Part = 'body' | 'limb' | 'head' | 'mane' | 'tail' | 'detail';

interface Base {
  part: Part;
  /** Raio da união suave com o que já existe (0 = união seca). */
  k: number;
  /** 0 = soma; 1 = escavação (olhos, narinas, boca); 2 = soma depois da escavação (olhos, focinho). */
  phase: 0 | 1 | 2;
  /** Esfera que contém a peça (para descartar peças longe de um ponto). */
  bc: Vec3;
  br: number;
}
export interface Sphere extends Base {
  t: 0;
  c: Vec3;
  r: number;
}
export interface Ellipsoid extends Base {
  t: 1;
  c: Vec3;
  r: Vec3;
  /** Rotação inversa (linha a linha), ou null se alinhado aos eixos. */
  inv: number[] | null;
}
export interface RoundCone extends Base {
  t: 2;
  a: Vec3;
  b: Vec3;
  ra: number;
  rb: number;
}
export type Prim = Sphere | Ellipsoid | RoundCone;

// ---- Construção ----------------------------------------------------------------

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => scale(a, 1 / (len(a) || 1));

/** Rotação em torno de y (guinada) e de z (arfagem), aplicada nessa ordem: z primeiro. */
function rotYZ(yaw: number, pitch: number) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cz = Math.cos(pitch);
  const sz = Math.sin(pitch);
  // R = Ry · Rz
  const m = [cy * cz, -cy * sz, sy, sz, cz, 0, -sy * cz, sy * sz, cy];
  return {
    apply: (v: Vec3): Vec3 => [m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2], m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2], m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2]],
    /** Inversa = transposta. */
    inverse: [m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!],
  };
}

const sphere = (part: Part, c: Vec3, r: number, k: number, phase: 0 | 1 | 2 = 0): Sphere => ({ t: 0, part, c, r, k, phase, bc: c, br: r });
const ellipsoid = (part: Part, c: Vec3, r: Vec3, k: number, inv: number[] | null = null, phase: 0 | 1 | 2 = 0): Ellipsoid => ({ t: 1, part, c, r, inv, k, phase, bc: c, br: Math.max(...r) });
const cone = (part: Part, a: Vec3, ra: number, b: Vec3, rb: number, k: number, phase: 0 | 1 | 2 = 0): RoundCone => ({
  t: 2,
  part,
  a,
  b,
  ra,
  rb,
  k,
  phase,
  bc: scale(add(a, b), 0.5),
  br: len(sub(b, a)) / 2 + Math.max(ra, rb),
});

/** Gerador pseudoaleatório com semente (a juba sai igual em todo aparelho e em todo teste). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export interface Bone {
  a: Vec3;
  b: Vec3;
  /** Espessura da haste da armação (as da juba são finas). */
  r: number;
}

export interface LionModel {
  prims: Prim[];
  /** Armação: o "esqueleto" de hastes que o escultor monta antes da argila. */
  bones: Bone[];
  bounds: { min: Vec3; max: Vec3 };
}

/** Nível de detalhe da escultura (um por estágio da construção). */
export type Level = 'block' | 'form' | 'final';

/**
 * Monta o leão. `block`: só as massas (o bloco de estudo, sem juba em mechas);
 * `form`: tudo, menos os detalhes finos; `final`: completo.
 */
export function buildLion(level: Level): LionModel {
  const prims: Prim[] = [];
  const bones: Bone[] = [];
  const block = level === 'block';
  const bone = (a: Vec3, b: Vec3, r = 0.016) => bones.push({ a, b, r });

  // ---- Tronco: garupa e cernelha, caixa torácica, peito fundo, cintura recolhida, quadris, escápulas ----
  const rump: Vec3 = [-0.68, 0.98, 0];
  const withers: Vec3 = [0.4, 1.12, 0];
  prims.push(cone('body', rump, 0.25, withers, 0.3, 0));
  prims.push(ellipsoid('body', [0.46, 0.9, 0], [0.3, 0.36, 0.27], 0.16));
  prims.push(ellipsoid('body', [0.1, 0.93, 0], [0.42, 0.27, 0.27], 0.18));
  prims.push(ellipsoid('body', [-0.3, 0.92, 0], [0.36, 0.19, 0.21], 0.2));
  prims.push(ellipsoid('body', [-0.6, 0.95, 0], [0.26, 0.26, 0.24], 0.14));
  if (!block) for (const s of [1, -1]) prims.push(ellipsoid('body', [0.34, 1.0, 0.17 * s], [0.2, 0.26, 0.1], 0.1));
  bone(rump, [-0.12, 1.04, 0]);
  bone([-0.12, 1.04, 0], withers);

  // ---- Membros (o da frente, do lado do visitante, avança: o leão "passante" dos brasões) ----
  for (const s of [1, -1]) {
    const z = 0.15 * s;
    const lifted = s === 1;
    // Dianteiros: braço, cotovelo (para trás, como no felino), antebraço e pata.
    const shoulder: Vec3 = [0.42, 0.86, z];
    const elbow: Vec3 = lifted ? [0.5, 0.56, z] : [0.37, 0.52, z];
    const wrist: Vec3 = lifted ? [0.7, 0.3, z] : [0.43, 0.15, z];
    const paw: Vec3 = lifted ? [0.78, 0.26, z] : [0.51, 0.042, z];
    const pawR: Vec3 = [0.11, 0.055, 0.085];
    const pawInv = lifted ? rotYZ(0, -0.5).inverse : null;
    if (block) {
      prims.push(cone('limb', shoulder, 0.14, wrist, 0.075, 0.1));
      prims.push(ellipsoid('limb', paw, pawR, 0.05, pawInv));
    } else {
      prims.push(cone('limb', shoulder, 0.13, elbow, 0.095, 0.08));
      prims.push(cone('limb', elbow, 0.095, wrist, 0.066, 0.05));
      prims.push(ellipsoid('limb', paw, pawR, 0.045, pawInv));
    }
    bone(shoulder, elbow);
    bone(elbow, wrist);
    bone(wrist, paw);
    // Traseiros: coxa, jarrete (a perna dobra para trás), metatarso e pata; o tendão desenha o contorno de trás.
    const hip: Vec3 = [-0.6, 0.86, z];
    const knee: Vec3 = [-0.5, 0.58, z];
    const hock: Vec3 = [-0.74, 0.3, z];
    const ankle: Vec3 = [-0.66, 0.1, z];
    const hpaw: Vec3 = [-0.58, 0.042, z];
    if (block) {
      prims.push(cone('limb', hip, 0.2, hock, 0.07, 0.1));
      prims.push(cone('limb', hock, 0.065, ankle, 0.058, 0.04));
      prims.push(ellipsoid('limb', hpaw, pawR, 0.05));
    } else {
      prims.push(ellipsoid('limb', [-0.6, 0.8, z * 1.05], [0.24, 0.3, 0.12], 0.12));
      prims.push(cone('limb', knee, 0.11, hock, 0.06, 0.06));
      prims.push(cone('limb', [-0.78, 0.85, z], 0.09, hock, 0.05, 0.07));
      prims.push(cone('limb', hock, 0.058, ankle, 0.055, 0.04));
      prims.push(ellipsoid('limb', hpaw, pawR, 0.045));
    }
    bone(hip, knee);
    bone(knee, hock);
    bone(hock, ankle);
    bone(ankle, hpaw);
    // Dedos (quatro por pata), só no fim.
    if (level === 'final')
      for (const p of [paw, hpaw])
        for (const dz of [-0.05, -0.017, 0.017, 0.05]) {
          const up = p === paw && lifted ? -0.03 : 0;
          prims.push(sphere('detail', [p[0] + 0.075 - Math.abs(dz) * 0.35, p[1] - 0.008 + up, p[2] + dz], 0.028, 0.016));
        }
  }

  // ---- Cauda: uma curva que desce, com o tufo na ponta ----
  const tail: Vec3[] = [
    [-0.88, 1.04, 0],
    [-1.12, 0.92, 0.02],
    [-1.27, 0.68, 0.06],
    [-1.3, 0.44, 0.1],
    [-1.22, 0.27, 0.13],
  ];
  const tailR = [0.062, 0.054, 0.046, 0.041, 0.038];
  if (block) prims.push(cone('tail', tail[0]!, 0.058, tail[3]!, 0.037, 0.05));
  else for (let i = 0; i < tail.length - 1; i++) prims.push(cone('tail', tail[i]!, tailR[i]!, tail[i + 1]!, tailR[i + 1]!, 0.07));
  if (!block) prims.push(ellipsoid('tail', [-1.18, 0.21, 0.13], [0.065, 0.1, 0.065], 0.03));
  for (let i = 0; i < tail.length - 1; i++) bone(tail[i]!, tail[i + 1]!, 0.012);
  bone(rump, tail[0]!, 0.012);

  // ---- Pescoço e cabeça (virada um pouco para o visitante, o queixo erguido) ----
  const neckBase: Vec3 = [0.45, 1.06, 0];
  const H: Vec3 = [0.9, 1.44, 0.02];
  prims.push(cone('body', neckBase, 0.26, [0.74, 1.34, 0.01], 0.2, 0.1));
  bone(withers, neckBase);
  bone(neckBase, H);
  // Guinada negativa: o focinho vira para +z (o lado do visitante). A cabeça é desenhada em escala 1,12.
  const head = rotYZ(-0.32, 0.08);
  const HS = 1.12;
  const at = (v: Vec3): Vec3 => add(H, head.apply(scale(v, HS)));
  const hInv = head.inverse;
  const E = (part: Part, c: Vec3, r: Vec3, k: number, phase: 0 | 1 | 2 = 0) => prims.push(ellipsoid(part, at(c), scale(r, HS), k * HS, hInv, phase));
  const C = (part: Part, a: Vec3, ra: number, b: Vec3, rb: number, k: number, phase: 0 | 1 | 2 = 0) => prims.push(cone(part, at(a), ra * HS, at(b), rb * HS, k * HS, phase));
  const S = (part: Part, c: Vec3, r: number, k: number, phase: 0 | 1 | 2 = 0) => prims.push(sphere(part, at(c), r * HS, k * HS, phase));

  if (block) {
    E('head', [0.02, 0, 0], [0.24, 0.21, 0.2], 0.08);
    E('head', [0.22, -0.08, 0], [0.18, 0.12, 0.13], 0.07);
    // A juba no bloco de estudo: um só volume em volta da cabeça, do pescoço e do peito.
    E('mane', [-0.2, -0.1, 0], [0.36, 0.46, 0.42], 0.12);
    prims.push(ellipsoid('mane', [0.62, 1.0, 0], [0.2, 0.32, 0.24], 0.12));
  } else {
    // Crânio, testa, focinho, cana do nariz, almofadas dos bigodes, queixo e bochechas.
    E('head', [0, 0.02, 0], [0.21, 0.19, 0.18], 0.08);
    E('head', [0.12, 0.08, 0], [0.14, 0.08, 0.15], 0.06);
    E('head', [0.2, -0.07, 0], [0.16, 0.1, 0.12], 0.06);
    C('head', [0.06, 0.075, 0], 0.08, [0.32, 0.0, 0], 0.066, 0.04);
    for (const s of [1, -1]) {
      E('head', [0.28, -0.1, 0.055 * s], [0.095, 0.072, 0.07], 0.03);
      E('head', [0.06, -0.06, 0.11 * s], [0.13, 0.11, 0.08], 0.07);
      // Arcada das sobrancelhas (marcada: faz sombra nos olhos) e orelhas (quase escondidas pela juba).
      C('head', [0.23, 0.085, 0.03 * s], 0.04, [0.16, 0.1, 0.13 * s], 0.032, 0.025);
      E('head', [-0.06, 0.2, 0.14 * s], [0.05, 0.075, 0.035], 0.03);
    }
    E('head', [0.16, -0.19, 0], [0.11, 0.055, 0.085], 0.045);
    if (level === 'final') {
      // Escavações: órbitas, narinas e o vinco da boca; depois, os olhos e a ponta do nariz.
      for (const s of [1, -1]) {
        S('detail', [0.19, 0.035, 0.085 * s], 0.034, 0.015, 1);
        S('detail', [0.372, -0.03, 0.025 * s], 0.014, 0.006, 1);
        C('detail', [0.35, -0.14, 0.01 * s], 0.007, [0.2, -0.135, 0.095 * s], 0.006, 0.008, 1);
        S('detail', [0.172, 0.034, 0.08 * s], 0.026, 0.006, 2);
      }
      E('detail', [0.375, -0.02, 0], [0.04, 0.042, 0.065], 0.018, 2);
    }

    // ---- A juba: uma massa que envolve a nuca, o pescoço, a cernelha e o peito, coberta de mechas ----
    const mc: Vec3 = [-0.2, -0.1, 0];
    const mr: Vec3 = [0.36, 0.44, 0.42];
    E('mane', mc, mr, 0.12);
    prims.push(ellipsoid('mane', [0.62, 1.0, 0], [0.2, 0.32, 0.24], 0.12));
    prims.push(ellipsoid('mane', [0.38, 1.13, 0], [0.26, 0.2, 0.26], 0.14));
    const rand = rng(5);
    // Uma mecha: larga na raiz, deitada sobre a massa e fundida a ela (as frestas entre mechas é que desenham
    // a juba); a ponta se dobra para baixo, com o peso do pelo.
    let locks = 0;
    const lock = (base: Vec3, dir: Vec3, L: number, r0: number) => {
      const tip = add(base, scale(dir, L));
      const end = add(tip, scale(norm(add(dir, [0, -0.6, 0])), L * 0.3));
      C('mane', base, r0, tip, r0 * 0.55, 0.05);
      C('mane', tip, r0 * 0.52, end, 0.018, 0.03);
      // Na armação, só uma mecha em cada três (o desenho das linhas da juba, não um emaranhado).
      if (locks++ % 3 === 0) bones.push({ a: at(base), b: at(tip), r: 0.006 });
    };
    // Mechas espalhadas pela massa (uma espiral de Fibonacci sobre o elipsoide), correndo para trás e para baixo.
    const N = 140;
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N;
      const rad = Math.sqrt(1 - y * y);
      const th = i * 2.39996323;
      const u: Vec3 = [rad * Math.cos(th), y, rad * Math.sin(th)];
      const p: Vec3 = [mc[0] + u[0] * mr[0], mc[1] + u[1] * mr[1], mc[2] + u[2] * mr[2]];
      // Fora do rosto, e nem tão para trás (onde a juba já se fundiu ao corpo).
      if (p[0] > 0.06 || p[0] < -0.5) continue;
      if (p[0] > -0.05 && Math.hypot(p[1] + 0.03, p[2]) < 0.2) continue;
      const n = norm([u[0] / mr[0], u[1] / mr[1], u[2] / mr[2]]);
      // Fluxo: para trás e para baixo, projetado no plano da superfície, com um pouco para fora.
      const flow: Vec3 = [-0.8, -0.55 - (p[1] < -0.1 ? 0.35 : 0), 0];
      const along = flow[0] * n[0] + flow[1] * n[1] + flow[2] * n[2];
      const tangent = norm(sub(flow, scale(n, along)));
      const dir = norm(add(tangent, scale(n, 0.1 + rand() * 0.1)));
      const base = add(mc, [u[0] * mr[0] * 0.93, u[1] * mr[1] * 0.93, u[2] * mr[2] * 0.93]);
      lock(base, dir, 0.14 + rand() * 0.08 + (p[1] < -0.1 ? 0.07 : 0), 0.076 - rand() * 0.016);
    }
    // A moldura do rosto: mechas curtas em volta da face, para fora e para trás.
    for (let i = 0; i < 16; i++) {
      const th = (i / 16) * Math.PI * 2 + 0.2;
      const base: Vec3 = [-0.05, Math.cos(th) * 0.23 - 0.05, Math.sin(th) * 0.24];
      lock(base, norm([-0.85, Math.cos(th) * 0.45 - 0.2, Math.sin(th) * 0.45]), 0.1 + rand() * 0.04, 0.058);
    }
  }

  // Limites (com folga): de onde a malha é amostrada.
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    if (p.phase === 1) continue;
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a]!, p.bc[a]! - p.br - p.k);
      max[a] = Math.max(max[a]!, p.bc[a]! + p.br + p.k);
    }
  }
  min[1] = Math.max(min[1], -0.02);
  return { prims, bones, bounds: { min, max } };
}

// ---- Avaliação ------------------------------------------------------------------

/** União suave polinomial (Quilez): igual a `min` longe da junção, arredondada perto. */
export function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function primDistance(p: Prim, x: number, y: number, z: number): number {
  if (p.t === 0) return Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2]) - p.r;
  if (p.t === 1) {
    let qx = x - p.c[0];
    let qy = y - p.c[1];
    let qz = z - p.c[2];
    if (p.inv) {
      const m = p.inv;
      const tx = m[0]! * qx + m[1]! * qy + m[2]! * qz;
      const ty = m[3]! * qx + m[4]! * qy + m[5]! * qz;
      const tz = m[6]! * qx + m[7]! * qy + m[8]! * qz;
      qx = tx;
      qy = ty;
      qz = tz;
    }
    // Aproximação de distância ao elipsoide (Quilez): boa perto da superfície.
    const k0 = Math.hypot(qx / p.r[0], qy / p.r[1], qz / p.r[2]);
    const k1 = Math.hypot(qx / (p.r[0] * p.r[0]), qy / (p.r[1] * p.r[1]), qz / (p.r[2] * p.r[2]));
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(p.r[0], p.r[1], p.r[2]);
  }
  // Cone arredondado entre dois pontos (Quilez, sdRoundCone).
  const bax = p.b[0] - p.a[0];
  const bay = p.b[1] - p.a[1];
  const baz = p.b[2] - p.a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = p.ra - p.rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = x - p.a[0];
  const pay = y - p.a[1];
  const paz = z - p.a[2];
  const yv = pax * bax + pay * bay + paz * baz;
  const zv = yv - l2;
  const cx = pax * l2 - bax * yv;
  const cy = pay * l2 - bay * yv;
  const cz = paz * l2 - baz * yv;
  const x2 = cx * cx + cy * cy + cz * cz;
  const y2 = yv * yv * l2;
  const z2 = zv * zv * l2;
  const kk = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zv) * a2 * z2 > kk) return Math.sqrt(x2 + z2) * il2 - p.rb;
  if (Math.sign(yv) * a2 * y2 < kk) return Math.sqrt(x2 + y2) * il2 - p.ra;
  return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - p.ra;
}

/**
 * Distância no ponto, usando só as peças da lista (as que podem chegar perto).
 * Somas, escavações e somas finais, nessa ordem.
 */
export function evaluate(prims: readonly Prim[], x: number, y: number, z: number): number {
  let d = 1e9;
  for (const p of prims) if (p.phase === 0) d = smin(d, primDistance(p, x, y, z), p.k);
  for (const p of prims) if (p.phase === 1) d = -smin(-d, primDistance(p, x, y, z), p.k);
  for (const p of prims) if (p.phase === 2) d = smin(d, primDistance(p, x, y, z), p.k);
  return d;
}

/** Lista de peças já separada por fase (avaliar é uma passada por fase, sem testes). */
export interface PrimList {
  add: Prim[];
  carve: Prim[];
  finish: Prim[];
  size: number;
}

function evaluateSplit(l: PrimList, x: number, y: number, z: number): number {
  let d = 1e9;
  for (let i = 0; i < l.add.length; i++) {
    const p = l.add[i]!;
    d = smin(d, primDistance(p, x, y, z), p.k);
  }
  for (let i = 0; i < l.carve.length; i++) {
    const p = l.carve[i]!;
    d = -smin(-d, primDistance(p, x, y, z), p.k);
  }
  for (let i = 0; i < l.finish.length; i++) {
    const p = l.finish[i]!;
    d = smin(d, primDistance(p, x, y, z), p.k);
  }
  return d;
}

/**
 * Índice espacial das peças: para cada bloco de uma grade grossa, as peças que
 * podem influir num ponto dele (a até `band` metros da superfície). Avaliar só
 * essas é o que deixa a malha fina rápida o bastante para um celular.
 */
export function primIndex(model: LionModel, cell: number, band: number) {
  const { min, max } = model.bounds;
  const nx = Math.max(1, Math.ceil((max[0] - min[0]) / cell));
  const ny = Math.max(1, Math.ceil((max[1] - min[1]) / cell));
  const nz = Math.max(1, Math.ceil((max[2] - min[2]) / cell));
  const half = (cell * Math.sqrt(3)) / 2;
  const lists: PrimList[] = Array.from({ length: nx * ny * nz }, () => ({ add: [], carve: [], finish: [], size: 0 }));
  // Cada peça entra só nas células que a esfera dela (mais a folga) alcança — na ordem original, que a
  // união suave respeita.
  for (const p of model.prims) {
    const reach = p.br + p.k + band;
    const range = (a: 0 | 1 | 2, n: number) => [Math.max(0, Math.floor((p.bc[a] - reach - half - min[a]) / cell)), Math.min(n - 1, Math.floor((p.bc[a] + reach + half - min[a]) / cell))] as const;
    const [i0, i1] = range(0, nx);
    const [j0, j1] = range(1, ny);
    const [k0, k1] = range(2, nz);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++)
        for (let k = k0; k <= k1; k++) {
          const cx = min[0] + (i + 0.5) * cell;
          const cy = min[1] + (j + 0.5) * cell;
          const cz = min[2] + (k + 0.5) * cell;
          if (Math.hypot(cx - p.bc[0], cy - p.bc[1], cz - p.bc[2]) - reach >= half) continue;
          const l = lists[(i * ny + j) * nz + k]!;
          (p.phase === 0 ? l.add : p.phase === 1 ? l.carve : l.finish).push(p);
          if (p.phase === 0) l.size++;
        }
  }
  return {
    /**
     * Peças perto do ponto. Fora dos limites vale a célula mais próxima (a camada de blocos que o chão corta
     * tem o centro um pouco abaixo deles; uma lista vazia ali apagava as patas na malha grossa). Longe de
     * tudo, a lista da borda dá uma distância grande, como deve.
     */
    at(x: number, y: number, z: number): PrimList {
      const i = Math.min(nx - 1, Math.max(0, Math.floor((x - min[0]) / cell)));
      const j = Math.min(ny - 1, Math.max(0, Math.floor((y - min[1]) / cell)));
      const k = Math.min(nz - 1, Math.max(0, Math.floor((z - min[2]) / cell)));
      return lists[(i * ny + j) * nz + k]!;
    },
    /** Distância com uma lista já buscada (para quem avalia vários pontos vizinhos). */
    with(list: PrimList, x: number, y: number, z: number) {
      return list.size ? evaluateSplit(list, x, y, z) : band * 4;
    },
    distance(x: number, y: number, z: number) {
      return this.with(this.at(x, y, z), x, y, z);
    },
  };
}
