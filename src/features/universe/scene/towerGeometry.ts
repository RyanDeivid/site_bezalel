import * as THREE from 'three';
import type { TowerMaterial, TowerPart, TowerVariant } from '../world/city';
import { FACADE_TILE } from './textures';

/**
 * Materiais das torres: os seis sistemas de fachada e as lojas (com textura),
 * mais três materiais de acabamento que levam a cor em cada vértice — `metal`
 * (aletas, caixilhos, mastros: alumínio, grafite ou bronze), `matte` (lajes,
 * coberturas, floreiras) e `glow` (LEDs, coroas de luz e luzes de
 * sinalização). Assim, uma quadra inteira cabe em ~10 chamadas de desenho.
 */
export type Slot = TowerMaterial | 'metal' | 'matte' | 'glow';

export const FACADE_SLOTS: ReadonlySet<Slot> = new Set<Slot>(['glassBlue', 'glassBronze', 'whiteConcrete', 'charcoal', 'metalPanel', 'darkGlass', 'storefront']);
const COLORED: ReadonlySet<Slot> = new Set<Slot>(['metal', 'matte', 'glow']);

export type P2 = [number, number];
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const DOWN = V(0, -1, 0);
/** Cor HDR (acima de 1): com o brilho ligado, LEDs e coroas acendem de verdade. */
const hdr = (r: number, g: number, b: number, k: number) => new THREE.Color().setRGB(r * k, g * k, b * k);

export const C = {
  aluminum: new THREE.Color('#7a8189'),
  graphite: new THREE.Color('#2b2f37'),
  bronze: new THREE.Color('#9a7d55'),
  concrete: new THREE.Color('#bdb7ab'),
  roof: new THREE.Color('#2a2c31'),
  planter: new THREE.Color('#716d66'),
  leaf: new THREE.Color('#2d4a35'),
  warm: hdr(1, 0.86, 0.66, 2.2),
  halo: hdr(1, 0.9, 0.76, 1.5),
  cyan: hdr(0.3, 0.8, 1, 1.4),
  amber: hdr(1, 0.5, 0.16, 1.6),
  red: hdr(1, 0.08, 0.05, 3),
};

/** Arremate de cada sistema de fachada (aletas, cornijas): vidro azul com alumínio claro, bronze com bronze, concreto com concreto. */
const TRIM: Record<TowerMaterial, { slot: 'metal' | 'matte'; color: THREE.Color }> = {
  glassBlue: { slot: 'metal', color: C.aluminum },
  glassBronze: { slot: 'metal', color: C.bronze },
  darkGlass: { slot: 'metal', color: C.graphite },
  charcoal: { slot: 'metal', color: C.graphite },
  metalPanel: { slot: 'metal', color: C.aluminum },
  whiteConcrete: { slot: 'matte', color: C.concrete },
  storefront: { slot: 'metal', color: C.graphite },
};

/** Junta triângulos com posição, normal, uv e cor (a cor só entra na geometria dos acabamentos). */
export class Builder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];
  readonly col: number[] = [];
  readonly idx: number[] = [];
  color = new THREE.Color(1, 1, 1);

  private vert(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.col.push(this.color.r, this.color.g, this.color.b);
  }

  /** Polígono convexo (em volta); a ordem dos triângulos segue `face`, a normal que deve apontar para fora. */
  poly(ps: THREE.Vector3[], ns: THREE.Vector3[], uvs: P2[], face: THREE.Vector3) {
    const base = this.pos.length / 3;
    ps.forEach((p, i) => this.vert(p, ns[i]!, uvs[i]![0], uvs[i]![1]));
    const flip = ps[1]!.clone().sub(ps[0]!).cross(ps[2]!.clone().sub(ps[0]!)).dot(face) < 0;
    for (let i = 1; i < ps.length - 1; i++) {
      if (flip) this.idx.push(base, base + i + 1, base + i);
      else this.idx.push(base, base + i, base + i + 1);
    }
  }

  /** Acrescenta uma geometria pronta do three (caixas, cilindros…) e a descarta. */
  add(g: THREE.BufferGeometry) {
    const base = this.pos.length / 3;
    const p = g.attributes.position!;
    const n = g.attributes.normal!;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      this.col.push(this.color.r, this.color.g, this.color.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    g.dispose();
  }

  geometry(colored: boolean) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (colored) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

/**
 * Planta de um volume: retângulo, octógono (cantos chanfrados a 45°) ou
 * elipse de 24 lados. `grow` afasta todas as faces da mesma distância (para
 * cornijas e marquises que contornam o volume).
 */
export function outline(shape: TowerPart['shape'], w: number, d: number, grow = 0, cx = 0, cz = 0): P2[] {
  const hw = w / 2 + grow;
  const hd = d / 2 + grow;
  let pts: P2[];
  if (shape === 'round') {
    pts = Array.from({ length: 24 }, (_, i): P2 => {
      const a = (i / 24) * Math.PI * 2;
      return [Math.cos(a) * hw, Math.sin(a) * hd];
    });
  } else if (shape === 'chamfer') {
    const c = Math.min(w, d) * 0.2 + grow * (2 - Math.SQRT2);
    pts = [
      [-hw + c, -hd],
      [hw - c, -hd],
      [hw, -hd + c],
      [hw, hd - c],
      [hw - c, hd],
      [-hw + c, hd],
      [-hw, hd - c],
      [-hw, -hd + c],
    ];
  } else
    pts = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
  return pts.map(([x, z]) => [x + cx, z + cz]);
}

/**
 * Paredes de um prisma com UVs em metros (u corre em volta da planta: a fachada continua nas quinas).
 * `only` escolhe as faces (pelo índice da aresta da planta) — para deixar um vão, como o de um saguão.
 */
export function walls(b: Builder, pts: P2[], y0: number, h: number, smooth: boolean, tileW = 4, tileH = 4, center: P2 = [0, 0], only?: (edge: number) => boolean) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[(i + 1) % pts.length]!;
    const L = Math.hypot(bx - ax, bz - az);
    if (only && !only(i)) {
      s += L;
      continue;
    }
    const face = V((bz - az) / L, 0, -(bx - ax) / L);
    const na = smooth ? V(ax - center[0], 0, az - center[1]).normalize() : face;
    const nb = smooth ? V(bx - center[0], 0, bz - center[1]).normalize() : face;
    const u0 = s / tileW;
    const u1 = (s + L) / tileW;
    const v1 = h / tileH;
    b.poly(
      [V(ax, y0, az), V(bx, y0, bz), V(bx, y0 + h, bz), V(ax, y0 + h, az)],
      [na, nb, nb, na],
      [
        [u0, 0],
        [u1, 0],
        [u1, v1],
        [u0, v1],
      ],
      face,
    );
    s += L;
  }
}

/**
 * Paredes inclinadas entre duas plantas com o mesmo número de pontos (torre
 * que afina para cima). O u é o mesmo em baixo e em cima: os montantes
 * convergem, como num prédio afunilado de verdade.
 */
export function loft(b: Builder, lo: P2[], hi: P2[], y0: number, y1: number, tileW: number, tileH: number) {
  let s = 0;
  for (let i = 0; i < lo.length; i++) {
    const j = (i + 1) % lo.length;
    const a0 = V(lo[i]![0], y0, lo[i]![1]);
    const b0 = V(lo[j]![0], y0, lo[j]![1]);
    const a1 = V(hi[i]![0], y1, hi[i]![1]);
    const b1 = V(hi[j]![0], y1, hi[j]![1]);
    const L = a0.distanceTo(b0);
    const face = a1.clone().sub(a0).cross(b0.clone().sub(a0)).normalize();
    const v1 = Math.hypot(y1 - y0, a1.x - a0.x, a1.z - a0.z) / tileH;
    b.poly(
      [a0, b0, b1, a1],
      [face, face, face, face],
      [
        [s / tileW, 0],
        [(s + L) / tileW, 0],
        [(s + L) / tileW, v1],
        [s / tileW, v1],
      ],
      face,
    );
    s += L;
  }
}

/** Tampa plana (para cima ou para baixo) de uma planta convexa. */
export function cap(b: Builder, pts: P2[], y: number, up = true) {
  const n = up ? UP : DOWN;
  b.poly(
    pts.map(([x, z]) => V(x, y, z)),
    pts.map(() => n),
    pts.map(([x, z]): P2 => [x / 4, z / 4]),
    n,
  );
}

/** Barra reta de seção quadrada entre dois pontos (diagrid, mastros, contornos de LED). */
export function segment(b: Builder, a: THREE.Vector3, c: THREE.Vector3, thick: number) {
  const dir = c.clone().sub(a);
  const L = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.divideScalar(L));
  b.add(
    new THREE.BoxGeometry(thick, L, thick)
      .applyQuaternion(q)
      .translate((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2),
  );
}

/**
 * Aletas verticais salientes em volta da planta, alinhadas aos montantes da
 * textura (a cada `every` metros do perímetro): profundidade de verdade na
 * fachada, que pega luz e faz sombra.
 */
function fins(b: Builder, pts: P2[], y0: number, h: number, every: number, depth: number, thick: number) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[(i + 1) % pts.length]!;
    const L = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / L;
    const tz = (bz - az) / L;
    for (let k = Math.ceil((s + 0.4) / every) * every; k < s + L - 0.4; k += every) {
      const f = k - s;
      b.add(
        new THREE.BoxGeometry(thick, h, depth)
          .rotateY(Math.atan2(-tz, tx))
          .translate(ax + tx * f + (tz * depth) / 2, y0 + h / 2, az + tz * f - (tx * depth) / 2),
      );
    }
    s += L;
  }
}

export interface Ctx {
  get(slot: Slot, color?: THREE.Color): Builder;
}

/** Varandas em todos os andares das duas faces compridas: laje de concreto, guarda-corpo e paredes laterais. */
function balconies(ctx: Ctx, p: TowerPart, cx: number, cz: number, y0: number) {
  const alongX = p.w >= p.d;
  const len = (alongX ? p.w : p.d) * 0.88;
  const half = (alongX ? p.d : p.w) / 2;
  const at = (along: number, out: number, s: number): [number, number] => (alongX ? [cx + along, cz + s * out] : [cx + s * out, cz + along]);
  const dims = (a: number, h: number, o: number) => (alongX ? new THREE.BoxGeometry(a, h, o) : new THREE.BoxGeometry(o, h, a));
  for (let k = 1; FACADE_TILE.floor * k < p.h - 1; k++) {
    const y = y0 + FACADE_TILE.floor * k;
    for (const s of [-1, 1]) {
      const [x, z] = at(0, half + 0.65, s);
      ctx.get('matte', C.concrete).add(dims(len, 0.22, 1.3).translate(x, y - 0.11, z));
      const [rx, rz] = at(0, half + 1.26, s);
      ctx.get('metal', C.graphite).add(dims(len, 0.06, 0.06).translate(rx, y + 1.02, rz));
      for (const e of [-1, 1]) {
        const [ex, ez] = at((e * len) / 2, half + 0.65, s);
        ctx.get('matte', C.concrete).add(dims(0.18, 1.05, 1.3).translate(ex, y + 0.52, ez));
      }
    }
  }
}

/** Estrutura diagonal externa (diagrid) da torre redonda, com anéis a cada dois andares. */
function diagrid(ctx: Ctx, p: TowerPart, cx: number, cz: number, y0: number) {
  const b = ctx.get('metal', C.bronze);
  const r = Math.min(p.w, p.d) / 2 + 0.35;
  const n = 12;
  const band = FACADE_TILE.floor * 2;
  const at = (a: number, y: number) => V(cx + Math.cos(a) * r, y0 + y, cz + Math.sin(a) * r);
  for (let y = 0; y + 0.1 < p.h; y += band) {
    const y1 = Math.min(y + band, p.h);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      segment(b, at(a0, y), at(a1, y1), 0.32);
      segment(b, at(a1, y), at(a0, y1), 0.32);
    }
    walls(b, outline('round', 2 * r, 2 * r, 0.1, cx, cz), y0 + y1 - 0.2, 0.4, true, 4, 4, [cx, cz]);
  }
}

/** Arestas verticais de LED e (se o coroamento não tiver a sua própria moldura de luz) uma linha de luz no alto do volume. */
function ledEdges(ctx: Ctx, p: TowerPart, cx: number, cz: number, y0: number, color: THREE.Color, band: boolean) {
  const b = ctx.get('glow', color);
  const pts = outline(p.shape, p.w, p.d, 0.12, cx, cz);
  const mid = (i: number): P2 => {
    const a = pts[i]!;
    const c = pts[(i + 1) % pts.length]!;
    return [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  };
  const spots = p.shape === 'chamfer' ? [1, 3, 5, 7].map(mid) : p.shape === 'round' ? [3, 9, 15, 21].map((i) => pts[i]!) : pts;
  for (const [x, z] of spots) b.add(new THREE.BoxGeometry(0.2, p.h - 1.2, 0.2).translate(x, y0 + p.h / 2, z));
  if (band) walls(b, outline(p.shape, p.w, p.d, 0.14, cx, cz), y0 + p.h - 1.5, 0.2, p.shape === 'round', 4, 4, [cx, cz]);
}

/**
 * Marquise das lojas: contorna o embasamento a ~4 m do chão, com o lado de
 * baixo visível da calçada e uma linha de luz na borda.
 */
function canopy(ctx: Ctx, p: TowerPart, cx: number, cz: number, y0: number) {
  const y = y0 + Math.min(4.2, Math.max(2.8, p.h - 1.4));
  const pts = outline(p.shape, p.w, p.d, 1.6, cx, cz);
  const metal = ctx.get('metal', C.graphite);
  walls(metal, pts, y, 0.28, p.shape === 'round', 4, 4, [cx, cz]);
  cap(metal, pts, y + 0.28, true);
  cap(metal, pts, y, false);
  walls(ctx.get('glow', C.warm), outline(p.shape, p.w, p.d, 1.62, cx, cz), y - 0.07, 0.07, p.shape === 'round', 4, 4, [cx, cz]);
}

/** Coroamento: o que dá a cada família uma silhueta própria no horizonte. */
function crown(ctx: Ctx, v: TowerVariant, top: TowerPart, y: number, detail: boolean) {
  const tx = top.dx ?? 0;
  const tz = top.dz ?? 0;
  const smooth = top.shape === 'round';
  const trim = TRIM[top.material];
  const light = top.led === 'cyan' ? C.cyan : top.led === 'amber' ? C.amber : C.halo;
  switch (v.roof) {
    case 'crownFins': {
      // As aletas da fachada sobem 5,5 m além do teto, com uma faixa de luz por dentro.
      fins(ctx.get(trim.slot, trim.color), outline(top.shape, top.w, top.d, 0, tx, tz), y, 5.5, 1.5, 0.5, 0.18);
      walls(ctx.get('glow', C.warm), outline(top.shape, top.w, top.d, -0.5, tx, tz), y + 4.4, 0.3, smooth, 4, 4, [tx, tz]);
      const core = ctx.get('metal', C.graphite);
      const pts = outline('box', top.w * 0.45, top.d * 0.45, 0, tx, tz);
      walls(core, pts, y, 3, false);
      cap(ctx.get('matte', C.roof), pts, y + 3);
      break;
    }
    case 'slope': {
      // Topo inclinado de vidro (sobe ao longo da profundidade), com a cumeeira acesa.
      const hw = top.w / 2;
      const hd = top.d / 2;
      const H = top.d * 0.8;
      const g = ctx.get(top.material);
      const slopeLen = Math.hypot(top.d, H);
      const n = V(0, top.d, -H).normalize();
      const p = (x: number, yy: number, z: number) => V(tx + x, yy, tz + z);
      const tw = FACADE_TILE.w;
      const th = FACADE_TILE.h;
      g.poly(
        [p(-hw, y, -hd), p(hw, y, -hd), p(hw, y + H, hd), p(-hw, y + H, hd)],
        [n, n, n, n],
        [
          [0, 0],
          [top.w / tw, 0],
          [top.w / tw, slopeLen / th],
          [0, slopeLen / th],
        ],
        n,
      );
      const back = V(0, 0, 1);
      g.poly(
        [p(-hw, y, hd), p(hw, y, hd), p(hw, y + H, hd), p(-hw, y + H, hd)],
        [back, back, back, back],
        [
          [0, 0],
          [top.w / tw, 0],
          [top.w / tw, H / th],
          [0, H / th],
        ],
        back,
      );
      for (const s of [-1, 1]) {
        const side = V(s, 0, 0);
        g.poly(
          [p(s * hw, y, -hd), p(s * hw, y, hd), p(s * hw, y + H, hd)],
          [side, side, side],
          [
            [0, 0],
            [top.d / tw, 0],
            [top.d / tw, H / th],
          ],
          side,
        );
      }
      const glow = ctx.get('glow', C.warm);
      segment(glow, p(-hw, y + H, hd + 0.08), p(hw, y + H, hd + 0.08), 0.18);
      for (const s of [-1, 1]) segment(glow, p(s * (hw + 0.08), y, -hd), p(s * (hw + 0.08), y + H, hd), 0.14);
      break;
    }
    case 'ring': {
      const metal = ctx.get('metal', C.graphite);
      const glow = ctx.get('glow', light);
      if (smooth) {
        // Halo: dois anéis de luz acima da cobertura, presos por montantes.
        const R = top.w / 2 + 0.8;
        glow.add(new THREE.TorusGeometry(R, 0.15, 6, 48).rotateX(Math.PI / 2).translate(tx, y + 2.6, tz));
        glow.add(new THREE.TorusGeometry(R * 0.62, 0.11, 6, 36).rotateX(Math.PI / 2).translate(tx, y + 4.6, tz));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          segment(metal, V(tx + Math.cos(a) * R * 0.92, y, tz + Math.sin(a) * R * 0.92), V(tx + Math.cos(a) * R, y + 2.6, tz + Math.sin(a) * R), 0.2);
          segment(metal, V(tx + Math.cos(a) * R, y + 2.6, tz + Math.sin(a) * R), V(tx + Math.cos(a) * R * 0.62, y + 4.6, tz + Math.sin(a) * R * 0.62), 0.16);
        }
      } else {
        // Moldura de LED acima da cobertura e um volume recuado de vidro escuro.
        const pts = outline(top.shape, top.w, top.d, 0.3, tx, tz);
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i]!;
          const c = pts[(i + 1) % pts.length]!;
          segment(glow, V(a[0], y + 1.8, a[1]), V(c[0], y + 1.8, c[1]), 0.2);
          segment(metal, V(a[0], y, a[1]), V(a[0], y + 1.8, a[1]), 0.2);
        }
        const pent = outline('box', top.w * 0.62, top.d * 0.62, 0, tx, tz);
        walls(ctx.get('darkGlass'), pent, y, 4.2, false, FACADE_TILE.w, FACADE_TILE.h);
        cap(ctx.get('matte', C.roof), pent, y + 4.2);
      }
      break;
    }
    case 'antenna': {
      const metal = ctx.get('metal', C.graphite);
      const base = outline('box', 3.2, 3.2, 0, tx, tz);
      walls(metal, base, y, 2.2, false);
      cap(metal, base, y + 2.2);
      metal.add(new THREE.CylinderGeometry(0.16, 0.3, 14, 8).translate(tx, y + 9.2, tz));
      metal.add(new THREE.BoxGeometry(3, 0.12, 0.12).translate(tx, y + 11, tz));
      const red = ctx.get('glow', C.red);
      red.add(new THREE.SphereGeometry(0.22, 8, 6).translate(tx, y + 16.4, tz));
      red.add(new THREE.SphereGeometry(0.15, 8, 6).translate(tx - 1.5, y + 11, tz));
      red.add(new THREE.SphereGeometry(0.15, 8, 6).translate(tx + 1.5, y + 11, tz));
      break;
    }
    case 'garden': {
      // Cobertura verde: floreiras no contorno, arbustos e um pergolado.
      const pts = outline(top.shape, top.w, top.d, -0.9, tx, tz);
      const planter = ctx.get('matte', C.planter);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const c = pts[(i + 1) % pts.length]!;
        segment(planter, V(a[0], y + 0.4, a[1]), V(c[0], y + 0.4, c[1]), 0.8);
      }
      const leaf = ctx.get('matte', C.leaf);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const c = pts[(i + 1) % pts.length]!;
        segment(leaf, V(a[0], y + 0.95, a[1]), V(c[0], y + 0.95, c[1]), 0.6);
      }
      if (detail)
        for (const [x, z, r] of [
          [-top.w * 0.22, -top.d * 0.15, 1.1],
          [top.w * 0.18, top.d * 0.2, 0.9],
          [top.w * 0.25, -top.d * 0.22, 0.7],
        ] as const)
          leaf.add(new THREE.IcosahedronGeometry(r, 0).translate(tx + x, y + r * 0.8, tz + z));
      const metal = ctx.get('metal', C.graphite);
      const px = tx - top.w * 0.1;
      for (const [x, z] of [
        [-1.6, -1.6],
        [1.6, -1.6],
        [1.6, 1.6],
        [-1.6, 1.6],
      ] as const)
        metal.add(new THREE.BoxGeometry(0.14, 2.8, 0.14).translate(px + x, y + 1.4, tz + z));
      for (let k = -2; k <= 2; k++) metal.add(new THREE.BoxGeometry(3.6, 0.12, 0.16).translate(px, y + 2.8, tz + k * 0.8));
      break;
    }
    case 'helipad': {
      ctx.get('matte', C.roof).add(new THREE.CylinderGeometry(top.w * 0.42, top.w * 0.42, 0.3, 24).translate(tx, y + 0.6, tz));
      ctx.get('glow', C.warm).add(new THREE.TorusGeometry(top.w * 0.36, 0.08, 4, 32).rotateX(Math.PI / 2).translate(tx, y + 0.8, tz));
      break;
    }
    case 'units': {
      const metal = ctx.get('metal', C.graphite);
      for (const [x, z, w] of [
        [-top.w * 0.25, 0, 3],
        [top.w * 0.2, -top.d * 0.15, 2.2],
        [top.w * 0.2, top.d * 0.22, 1.6],
      ] as const)
        metal.add(new THREE.BoxGeometry(w, 1.8, w).translate(tx + x, y + 0.9, tz + z));
      ctx.get('matte', C.concrete).add(new THREE.CylinderGeometry(1.3, 1.3, 3, 12).translate(tx + top.w * 0.32, y + 1.5, tz - top.d * 0.3));
      break;
    }
    case 'none':
      break;
  }
}

/**
 * Monta uma família arquitetônica em geometrias por material: os volumes (com
 * UVs em metros, para que andares e módulos da fachada tenham o tamanho certo
 * em qualquer planta), as cornijas e coberturas, a marquise das lojas, os
 * detalhes que dão profundidade (aletas, varandas, diagrid, LEDs) e o
 * coroamento. `detail` falso (qualidade baixa) deixa só os volumes, as
 * cornijas e o coroamento.
 */
export function buildTowerGeometry(v: TowerVariant, detail: boolean): Map<Slot, THREE.BufferGeometry> {
  const { ctx, finish } = slotBuilders<Slot>();
  buildParts(ctx, v, detail);
  return finish();
}

/** Um Builder por material, criado quando é usado; `finish` entrega as geometrias (com cor nos acabamentos). */
export function slotBuilders<S extends string>() {
  const builders = new Map<S, Builder>();
  const ctx = {
    get(slot: S, color?: THREE.Color) {
      let b = builders.get(slot);
      if (!b) builders.set(slot, (b = new Builder()));
      if (color) b.color = color;
      return b;
    },
  };
  const finish = () => {
    const out = new Map<S, THREE.BufferGeometry>();
    for (const [slot, b] of builders) out.set(slot, b.geometry(COLORED.has(slot as Slot)));
    return out;
  };
  return { ctx, finish };
}

/** Os volumes empilhados de uma família (ou de um marco descrito do mesmo jeito) e o coroamento. */
export function buildParts(ctx: Ctx, v: TowerVariant, detail: boolean) {
  let y = 0;
  let top = v.parts[0]!;
  for (const p of v.parts) {
    const cx = p.dx ?? 0;
    const cz = p.dz ?? 0;
    const pts = outline(p.shape, p.w, p.d, 0, cx, cz);
    const smooth = p.shape === 'round';
    const store = p.material === 'storefront';
    walls(ctx.get(p.material), pts, y, p.h, smooth, store ? 16 : FACADE_TILE.w, store ? p.h : FACADE_TILE.h, [cx, cz]);
    // Cornija no alto de cada volume; a tampa dela é a cobertura (ou o terraço, se o volume de cima for menor).
    const trim = TRIM[p.material];
    const rim = outline(p.shape, p.w, p.d, 0.22, cx, cz);
    walls(ctx.get(trim.slot, trim.color), rim, y + p.h - 0.55, 0.55, smooth, 4, 4, [cx, cz]);
    cap(ctx.get('matte', C.roof), rim, y + p.h);
    if (store && detail) canopy(ctx, p, cx, cz, y);
    if (detail && p.fins) fins(ctx.get(trim.slot, trim.color), pts, y + 0.2, p.h - 0.75, 3, 0.55, 0.22);
    if (detail && p.balconies) balconies(ctx, p, cx, cz, y);
    if (detail && p.diagrid) diagrid(ctx, p, cx, cz, y);
    if (p.led) ledEdges(ctx, p, cx, cz, y, p.led === 'cyan' ? C.cyan : C.amber, !(v.roof === 'ring' && p === v.parts[v.parts.length - 1]));
    y += p.h;
    top = p;
  }
  crown(ctx, v, top, y, detail);
}
