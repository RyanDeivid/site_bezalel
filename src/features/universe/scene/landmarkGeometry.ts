import * as THREE from 'three';
import { cubeOnVertex, type TowerVariant } from '../world/city';
import { FACADE_TILE } from './textures';
import { buildParts, C, cap, loft, outline, segment, slotBuilders, walls, type P2, type Slot } from './towerGeometry';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const hdr = (r: number, g: number, b: number, k: number) => new THREE.Color().setRGB(r * k, g * k, b * k);
const CHAMPAGNE = new THREE.Color('#b39b70');
const GOLD = hdr(1, 0.78, 0.42, 2.4);
const LANTERN = hdr(1, 0.82, 0.55, 1.1);

/**
 * Medidas da sede (em metros, no mundo). O pódio vai do chão da quadra a
 * 9,3 m; a torre afina de 22 × 16 para 19 × 13,5 até 57,3 m; a lanterna de
 * vidro aceso vai a 61,8 m e o cubo da marca fica em cima de um plinto. Os
 * sólidos de colisão (city.ts) seguem estes números.
 */
export const HQ = {
  z: -80,
  towerZ: -82,
  base: 0.3,
  podiumTop: 9.3,
  towerTop: 57.3,
  lanternTop: 61.8,
  /** Centro do plinto (9 × 1,6 × 9, girado 45°) e do cubo (lado 10). */
  plinthY: 62.6,
  cubeY: 63.4 + cubeOnVertex(10).height / 2,
  lobby: { z: -68.4, x: 17, top: 7.7 },
} as const;

export type HqSlot = Slot | 'hqGlass' | 'stone' | 'lobby';

/**
 * A sede da Bezalel como marco: pódio de pedra clara com um saguão envidraçado
 * de pé-direito duplo (recuado, com pilares e marquise em balanço), torre de
 * vidro champanhe que afina para cima com aletas de bronze e uma fenda de luz
 * dourada de alto a baixo na fachada que encara a avenida, coroa com lanterna
 * acesa e o cubo do símbolo. Nada na cidade tem esse vidro nem essa fenda: de
 * qualquer ponto, a sede é reconhecível.
 */
export function buildHq(detail: boolean): Map<HqSlot, THREE.BufferGeometry> {
  const { ctx, finish } = slotBuilders<HqSlot>();
  const { base, podiumTop: pt, towerTop: tt, lanternTop: lt, lobby } = HQ;
  const stone = ctx.get('stone');
  const tile = (x: number, y: number): P2 => [x / 6, y / 3];

  // Pódio: três faces inteiras e, na frente, a faixa de pedra acima do saguão e os dois pilares das pontas.
  const podium = outline('box', 40, 26, 0, 0, HQ.z);
  walls(stone, podium, base, pt - base, false, 6, 3, [0, HQ.z], (e) => e !== 2);
  const front = HQ.z + 13;
  const quadZ = (x0: number, x1: number, y0: number, y1: number, z: number, nz: number) =>
    stone.poly([V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z)], [V(0, 0, nz), V(0, 0, nz), V(0, 0, nz), V(0, 0, nz)], [tile(x0, y0), tile(x1, y0), tile(x1, y1), tile(x0, y1)], V(0, 0, nz));
  quadZ(-20, 20, lobby.top, pt, front, 1);
  quadZ(-20, -lobby.x, base, lobby.top, front, 1);
  quadZ(lobby.x, 20, base, lobby.top, front, 1);
  // Retornos laterais e o forro do recuo.
  for (const s of [-1, 1]) {
    const x = s * lobby.x;
    const n = V(-s, 0, 0);
    stone.poly([V(x, base, lobby.z), V(x, base, front), V(x, lobby.top, front), V(x, lobby.top, lobby.z)], [n, n, n, n], [tile(lobby.z, base), tile(front, base), tile(front, lobby.top), tile(lobby.z, lobby.top)], n);
  }
  const down = V(0, -1, 0);
  stone.poly([V(-lobby.x, lobby.top, lobby.z), V(lobby.x, lobby.top, lobby.z), V(lobby.x, lobby.top, front), V(-lobby.x, lobby.top, front)], [down, down, down, down], [tile(-lobby.x, 0), tile(lobby.x, 0), tile(lobby.x, 1.4), tile(-lobby.x, 1.4)], down);
  // Vidro do saguão (a imagem cobre o vão inteiro) e os montantes de bronze em relevo.
  const glassN = V(0, 0, 1);
  ctx.get('lobby').poly(
    [V(-lobby.x, base, lobby.z), V(lobby.x, base, lobby.z), V(lobby.x, lobby.top, lobby.z), V(-lobby.x, lobby.top, lobby.z)],
    [glassN, glassN, glassN, glassN],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    glassN,
  );
  const bronze = ctx.get('metal', C.bronze);
  for (let x = -lobby.x; x <= lobby.x + 0.01; x += 2.5) segment(bronze, V(x, base, lobby.z + 0.1), V(x, lobby.top, lobby.z + 0.1), 0.16);
  segment(bronze, V(-lobby.x, base + 3.8, lobby.z + 0.1), V(lobby.x, base + 3.8, lobby.z + 0.1), 0.14);
  // Cornija de metal champanhe no alto do pódio; cobertura com um filete dourado na borda da frente.
  walls(ctx.get('metal', CHAMPAGNE), outline('box', 40, 26, 0.15, 0, HQ.z), pt - 0.45, 0.45, false);
  cap(ctx.get('matte', new THREE.Color('#3b3c41')), outline('box', 40, 26, 0.15, 0, HQ.z), pt);
  segment(ctx.get('glow', GOLD), V(-20, pt - 0.6, front + 0.2), V(20, pt - 0.6, front + 0.2), 0.1);

  // Marquise em balanço sobre a área de embarque, com bordas acesas, luzes embutidas e dois pilares de bronze.
  const canopyY = 6.9;
  const roof = outline('box', 24, 9.4, 0, 0, lobby.z + 4.7);
  const graphite = ctx.get('metal', C.graphite);
  walls(graphite, roof, canopyY, 0.35, false);
  cap(graphite, roof, canopyY + 0.35);
  cap(graphite, roof, canopyY, false);
  const glow = ctx.get('glow', GOLD);
  const cz = lobby.z + 9.4;
  segment(glow, V(-12.02, canopyY + 0.17, cz + 0.02), V(12.02, canopyY + 0.17, cz + 0.02), 0.12);
  for (const s of [-1, 1]) segment(glow, V(s * 12.02, canopyY + 0.17, lobby.z), V(s * 12.02, canopyY + 0.17, cz), 0.12);
  const warm = ctx.get('glow', C.warm);
  for (const x of [-9, -3, 3, 9]) for (const z of [lobby.z + 3, lobby.z + 6.8]) warm.add(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12).translate(x, canopyY - 0.02, z));
  for (const s of [-1, 1]) segment(ctx.get('metal', C.bronze), V(s * 10.5, base, cz - 0.6), V(s * 10.5, canopyY, cz - 0.6), 0.36);

  // Torre afunilada de vidro champanhe.
  const lo = outline('chamfer', 22, 16, 0, 0, HQ.towerZ);
  const hi = outline('chamfer', 19, 13.5, 0, 0, HQ.towerZ);
  loft(ctx.get('hqGlass'), lo, hi, pt, tt, FACADE_TILE.w, FACADE_TILE.h);
  if (detail) {
    // Aletas de bronze a cada 3 m, acompanhando a inclinação das faces.
    const fin = ctx.get('metal', C.bronze);
    for (let i = 0; i < lo.length; i++) {
      const j = (i + 1) % lo.length;
      const [ax, az] = lo[i]!;
      const [bx, bz] = lo[j]!;
      const L = Math.hypot(bx - ax, bz - az);
      const nx = (bz - az) / L;
      const nz = -(bx - ax) / L;
      const n = Math.max(1, Math.round(L / 3));
      for (let k = 1; k < n; k++) {
        const f = k / n;
        const p0 = V(ax + (bx - ax) * f + nx * 0.25, pt, az + (bz - az) * f + nz * 0.25);
        const p1 = V(hi[i]![0] + (hi[j]![0] - hi[i]![0]) * f + nx * 0.25, tt - 0.4, hi[i]![1] + (hi[j]![1] - hi[i]![1]) * f + nz * 0.25);
        segment(fin, p0, p1, 0.3);
      }
    }
  }
  // A fenda de luz dourada: no meio da fachada da frente (para a avenida) e da de trás, de alto a baixo.
  for (const [e, s] of [
    [4, 1],
    [0, -1],
  ] as const) {
    const mid = (pts: P2[]): P2 => [(pts[e]![0] + pts[e + 1]![0]) / 2, (pts[e]![1] + pts[e + 1]![1]) / 2];
    const [x0, z0] = mid(lo);
    const [x1, z1] = mid(hi);
    segment(ctx.get('glow', GOLD), V(x0, pt, z0 + s * 0.14), V(x1, tt, z1 + s * 0.14), 0.55);
  }
  // Coroa: faixa dourada, cornija, lanterna de vidro aceso com montantes e a tampa onde pousa o plinto do cubo.
  walls(ctx.get('glow', GOLD), outline('chamfer', 19, 13.5, 0.06, 0, HQ.towerZ), tt - 1.2, 0.2, false);
  const rim = outline('chamfer', 19, 13.5, 0.25, 0, HQ.towerZ);
  walls(ctx.get('metal', CHAMPAGNE), rim, tt - 0.5, 0.6, false);
  cap(ctx.get('matte', C.roof), rim, tt + 0.1);
  const lantern = outline('chamfer', 15, 11, 0, 0, HQ.towerZ);
  walls(ctx.get('glow', LANTERN), lantern, tt + 0.1, lt - tt - 0.1, false);
  if (detail) {
    const mullion = ctx.get('metal', CHAMPAGNE);
    for (let i = 0; i < lantern.length; i++) {
      const [ax, az] = lantern[i]!;
      const [bx, bz] = lantern[(i + 1) % lantern.length]!;
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(L / 1.5));
      for (let k = 0; k < n; k++) {
        const f = k / n;
        const x = ax + (bx - ax) * f + ((bz - az) / L) * 0.08;
        const z = az + (bz - az) * f - ((bx - ax) / L) * 0.08;
        segment(mullion, V(x, tt + 0.1, z), V(x, lt, z), 0.14);
      }
    }
  }
  const lid = outline('chamfer', 15, 11, 0.3, 0, HQ.towerZ);
  const lidMetal = ctx.get('metal', CHAMPAGNE);
  walls(lidMetal, lid, lt, 0.4, false);
  cap(lidMetal, lid, lt + 0.4);
  return finish();
}

/**
 * Centro de Produtos: galerias empilhadas e deslocadas, cada uma com um
 * sistema de fachada — lojas no térreo, faixa de painéis metálicos, vitrine de
 * vidro escuro (onde fica o painel com os produtos reais) e a galeria de cima
 * em vidro bronze com aletas — e filetes dourados na borda de cada laje.
 */
export const PRODUCTS_CENTER: TowerVariant = {
  name: 'centro de produtos',
  parts: [
    { w: 36, d: 30, h: 6, material: 'storefront' },
    { w: 36, d: 30, h: 4, material: 'metalPanel' },
    { w: 30, d: 24, h: 10, material: 'darkGlass', dx: -3, dz: 2 },
    { w: 24, d: 20, h: 10, material: 'glassBronze', dx: 2, dz: -2, fins: true },
  ],
  roof: 'units',
};

export function buildProductsCenter(detail: boolean, x: number, z: number): Map<Slot, THREE.BufferGeometry> {
  const { ctx, finish } = slotBuilders<Slot>();
  buildParts(ctx, PRODUCTS_CENTER, detail);
  let y = 0;
  for (const p of PRODUCTS_CENTER.parts) {
    y += p.h;
    if (p.material === 'storefront') continue;
    walls(ctx.get('glow', GOLD), outline(p.shape, p.w, p.d, 0.26, p.dx ?? 0, p.dz ?? 0), y - 0.75, 0.12, false);
  }
  const out = finish();
  out.forEach((g) => g.translate(x, HQ.base, z));
  return out;
}

/**
 * Medidas do Laboratório de IA (pavilhão de pesquisa). Caixa de vidro de
 * 28 × 28 m sob um teto circular flutuante (raio 20 m), com a entrada a oeste
 * (para a praça): portas de vidro de correr num vão de 5 m. Dentro, o núcleo
 * de IA no centro e as seis estações dos agentes num anel. Os sólidos de
 * colisão (city.ts) seguem estes números — dá para entrar a pé.
 */
export const LAB = {
  x: 80,
  z: 0,
  half: 14,
  base: 0.3,
  wallTop: 11.3,
  roofBase: 12.2,
  roofTop: 13.0,
  roofRadius: 20,
  door: { half: 2.5, height: 4 },
  core: 2.2,
  ring: 8,
} as const;

export type LabSlot = Slot | 'labGlass';

/** Pavilhão do laboratório (a parte fixa; portas, núcleo animado e hologramas ficam na cena). */
export function buildLab(detail: boolean): Map<LabSlot, THREE.BufferGeometry> {
  const { ctx, finish } = slotBuilders<LabSlot>();
  const { x: cx, z: cz, half, base, wallTop } = LAB;
  const pts = outline('box', half * 2, half * 2, 0, cx, cz);
  const westEdge = 3; // aresta (−hw, hd) → (−hw, −hd): a face oeste
  // Vidro: três faces inteiras; a oeste, os dois trechos ao lado da porta e a bandeira acima dela.
  const glass = ctx.get('labGlass');
  walls(glass, pts, base, wallTop - base - 1.1, false, 4, 4, [cx, cz], (e) => e !== westEdge);
  const wx = cx - half;
  const n = V(-1, 0, 0);
  const pane = (z0: number, z1: number, y0: number, y1: number) =>
    glass.poly([V(wx, y0, z0), V(wx, y0, z1), V(wx, y1, z1), V(wx, y1, z0)], [n, n, n, n], [[0, 0], [1, 0], [1, 1], [0, 1]], n);
  pane(cz - half, cz - LAB.door.half, base, wallTop - 1.1);
  pane(cz + LAB.door.half, cz + half, base, wallTop - 1.1);
  pane(cz - LAB.door.half, cz + LAB.door.half, base + LAB.door.height, wallTop - 1.1);
  // Faixa de metal no alto (a cornija) e o forro por dentro, com linhas de luz.
  const metal = ctx.get('metal', C.graphite);
  walls(metal, outline('box', half * 2, half * 2, 0.05, cx, cz), wallTop - 1.1, 1.1, false);
  cap(ctx.get('matte', new THREE.Color('#2a2d34')), pts, wallTop - 1.1, false);
  cap(ctx.get('matte', new THREE.Color('#2b2e35')), pts, base + 0.02);
  if (detail) {
    // Montantes a cada 2,8 m e duas travessas.
    const mullion = ctx.get('metal', C.aluminum);
    for (let k = -half; k <= half + 0.01; k += 2.8)
      for (const [ax, az] of [
        [cx + k, cz - half],
        [cx + k, cz + half],
        [cx + half, cz + k],
        [cx - half, cz + k],
      ] as const) {
        if (ax === cx - half && Math.abs(az - cz) < LAB.door.half + 0.1) continue;
        segment(mullion, V(ax, base, az), V(ax, wallTop - 1.1, az), 0.12);
      }
    for (const y of [base + 4, base + 7.6]) walls(mullion, outline('box', half * 2, half * 2, 0.06, cx, cz), y, 0.1, false, 4, 4, [cx, cz], (e) => e !== westEdge);
  }
  const light = ctx.get('glow', hdr(0.9, 0.95, 1.1, 1.6));
  for (let k = -half + 3.5; k < half - 1; k += 3.5) {
    segment(light, V(cx - half + 1, wallTop - 1.16, cz + k), V(cx + half - 1, wallTop - 1.16, cz + k), 0.12);
  }
  // Teto flutuante: disco com a borda acesa (ciano) e oito pilares finos.
  const roof = ctx.get('metal', new THREE.Color('#d7dbe0'));
  roof.add(new THREE.CylinderGeometry(LAB.roofRadius, LAB.roofRadius * 0.96, LAB.roofTop - LAB.roofBase, 64).translate(cx, (LAB.roofBase + LAB.roofTop) / 2, cz));
  const cyan = ctx.get('glow', hdr(0.3, 0.85, 1.0, 2.2));
  cyan.add(new THREE.TorusGeometry(LAB.roofRadius * 0.98, 0.12, 6, 96).rotateX(Math.PI / 2).translate(cx, LAB.roofBase - 0.02, cz));
  cyan.add(new THREE.TorusGeometry(LAB.roofRadius + 0.02, 0.08, 6, 96).rotateX(Math.PI / 2).translate(cx, LAB.roofTop, cz));
  const post = ctx.get('metal', C.graphite);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = half + 3.2;
    segment(post, V(cx + Math.cos(a) * r, base, cz + Math.sin(a) * r), V(cx + Math.cos(a) * r, LAB.roofBase, cz + Math.sin(a) * r), 0.3);
  }
  // Entre a caixa e o teto: um anel de vidro escuro recuado (some a vista do teto "solto").
  walls(ctx.get('metal', C.graphite), outline('round', half * 1.5, half * 1.5, 0, cx, cz), wallTop, LAB.roofBase - wallTop, true, 4, 4, [cx, cz]);
  // Pórtico da entrada: dois montantes e a verga em bronze, com um filete de luz por baixo.
  const bronze = ctx.get('metal', C.bronze);
  for (const s of [-1, 1]) segment(bronze, V(wx - 0.3, base, cz + s * (LAB.door.half + 0.25)), V(wx - 0.3, base + LAB.door.height + 0.4, cz + s * (LAB.door.half + 0.25)), 0.45);
  segment(bronze, V(wx - 0.3, base + LAB.door.height + 0.4, cz - LAB.door.half - 0.5), V(wx - 0.3, base + LAB.door.height + 0.4, cz + LAB.door.half + 0.5), 0.5);
  segment(ctx.get('glow', hdr(0.3, 0.85, 1.0, 2.2)), V(wx - 0.56, base + LAB.door.height + 0.12, cz - LAB.door.half), V(wx - 0.56, base + LAB.door.height + 0.12, cz + LAB.door.half), 0.06);
  // Balizas na frente da porta: passa gente, não passa carro.
  const bollard = ctx.get('metal', C.graphite);
  for (const z of [-2.0, -0.7, 0.6, 1.9]) bollard.add(new THREE.CylinderGeometry(0.15, 0.15, 0.9, 10).translate(wx - 3.5, base + 0.45, cz + z));
  // Chão: dois anéis de luz em volta do núcleo.
  for (const r of [LAB.core + 1.2, LAB.ring + 2.2]) cyan.add(new THREE.TorusGeometry(r, 0.05, 4, 64).rotateX(Math.PI / 2).translate(cx, base + 0.04, cz));
  // Estações dos agentes: console (o holograma e a tela ficam na cena).
  const desk = ctx.get('metal', C.graphite);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    desk.add(new THREE.BoxGeometry(1.5, 0.95, 0.8).rotateY(-a).translate(cx + Math.cos(a) * LAB.ring, base + 0.47, cz + Math.sin(a) * LAB.ring));
  }
  return finish();
}
