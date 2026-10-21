import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AirClass } from '../world/air';

/**
 * Veículos aéreos procedurais — cada classe com volume e linguagem próprios
 * (não são cubos luminosos): a frente é +z, o centro de massa na origem.
 * As luzes de navegação seguem a convenção da aviação (vermelha à esquerda,
 * verde à direita, branca na cauda) e os propulsores têm geometria (carenagem,
 * rotor), com o brilho só como complemento.
 */

export type AirSlot = 'hull' | 'glass' | 'frame' | 'gold' | 'thrust' | 'rotor' | 'navRed' | 'navGreen' | 'navWhite' | 'sign';

export interface AirModel {
  slots: Map<AirSlot, THREE.BufferGeometry>;
}

/** Divisões das curvas: cheias no modelo de perto, poucas no de longe (definido por `build`). */
let low = false;
const seg = (n: number) => (low ? Math.max(4, Math.round(n / 3)) : n);

const prep = (g: THREE.BufferGeometry) => {
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
};
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => prep(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
const sphere = (r: number, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0, n = 20) => prep(new THREE.SphereGeometry(r, seg(n), Math.max(3, Math.round(seg(n) * 0.6))).scale(sx, sy, sz).translate(x, y, z));
const ring = (r: number, tube: number, x: number, y: number, z: number) => prep(new THREE.TorusGeometry(r, tube, low ? 3 : 8, seg(28)).rotateX(Math.PI / 2).translate(x, y, z));
const disc = (r: number, x: number, y: number, z: number) => prep(new THREE.CircleGeometry(r, seg(20)).rotateX(-Math.PI / 2).translate(x, y, z));
const cyl = (r1: number, r2: number, h: number, x = 0, y = 0, z = 0, rot?: 'x' | 'z') => {
  const g = new THREE.CylinderGeometry(r1, r2, h, seg(16));
  if (rot === 'x') g.rotateX(Math.PI / 2);
  if (rot === 'z') g.rotateZ(Math.PI / 2);
  return prep(g.translate(x, y, z));
};

/** Perfis torneados (raio ao longo do comprimento, da cauda ao nariz) dos cascos. */
const TAXI_PROFILE: Array<[number, number]> = [
  [0, -2.35],
  [0.24, -2.25],
  [0.46, -1.8],
  [0.82, -1.0],
  [1.0, -0.2],
  [0.98, 0.6],
  [0.86, 1.3],
  [0.62, 1.8],
  [0.34, 2.1],
  [0, 2.2],
];
const PRIVATE_PROFILE: Array<[number, number]> = [
  [0.16, -2.8],
  [0.42, -2.4],
  [0.7, -1.4],
  [0.78, -0.2],
  [0.7, 0.9],
  [0.5, 1.9],
  [0.26, 2.5],
  [0, 2.8],
];

/** Casco: o perfil suavizado (curva que passa pelos pontos) girado em volta do eixo z. */
function fuselage(profile: Array<[number, number]>, sx: number, sy: number, y: number) {
  const curve = new THREE.SplineCurve(profile.map(([r, z]) => new THREE.Vector2(r, z)));
  const pts = curve.getPoints(seg(28)).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return prep(new THREE.LatheGeometry(pts, seg(24)).rotateX(Math.PI / 2).scale(sx, sy, 1).translate(0, y, 0));
}

/** Braço reto de seção quadrada entre dois pontos. */
function strut(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, t: number) {
  const a = new THREE.Vector3(x0, y0, z0);
  const dir = new THREE.Vector3(x1, y1, z1).sub(a);
  const L = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.divideScalar(L));
  return prep(new THREE.BoxGeometry(t, L, t * 0.7).applyQuaternion(q).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
}

/** Asa enflechada com espessura (perfil extrudado), do lado `s` (1 = direita). */
function wing(s: number) {
  const shape = new THREE.Shape([new THREE.Vector2(s * 0.5, 0.4), new THREE.Vector2(s * 2.65, -0.55), new THREE.Vector2(s * 2.65, -1.1), new THREE.Vector2(s * 0.5, -1.45)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: !low, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  return prep(g.rotateX(Math.PI / 2).translate(0, 0.0, 0));
}

/** Leme da cauda em V, inclinado para fora. */
function vfin(s: number) {
  const shape = new THREE.Shape([new THREE.Vector2(-1.75, 0.15), new THREE.Vector2(-2.55, 1.0), new THREE.Vector2(-2.9, 1.0), new THREE.Vector2(-2.7, 0.15)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
  return prep(g.rotateY(-Math.PI / 2).rotateZ(-s * 0.5).translate(s * 0.25, 0.1, 0));
}

function build(cls: AirClass, far = false): AirModel {
  low = far;
  const slots = new Map<AirSlot, THREE.BufferGeometry[]>();
  const add = (slot: AirSlot, ...g: THREE.BufferGeometry[]) => slots.set(slot, [...(slots.get(slot) ?? []), ...g]);
  if (cls === 'taxi') {
    // Táxi aéreo (eVTOL): fuselagem em gota (perfil torneado, como um casco de verdade), cabine
    // envidraçada, esquis de pouso, estabilizador com placas nas pontas e quatro rotores carenados
    // em braços inclinados para trás.
    add('hull', fuselage(TAXI_PROFILE, 1.2, 0.82, 0));
    add('glass', sphere(1, 0.9, 0.6, 1.35, 0, 0.36, 0.75));
    add('gold', prep(new THREE.TorusGeometry(1, 0.03, low ? 3 : 6, seg(40)).rotateX(Math.PI / 2).scale(1.21, 1, 2.05).translate(0, -0.08, 0.05)));
    add('hull', box(2.1, 0.08, 0.5, 0, 0.12, -2.05));
    for (const s of [1, -1]) {
      add('hull', box(0.06, 0.55, 0.62, s * 1.05, 0.25, -2.08));
      // Esquis: tubo com as pontas viradas e dois montantes.
      add('frame', cyl(0.05, 0.05, 2.6, s * 0.72, -1.0, 0.1, 'x'), cyl(0.04, 0.04, 0.5, s * 0.66, -0.78, 0.8), cyl(0.04, 0.04, 0.5, s * 0.66, -0.78, -0.6));
    }
    for (const [x, z] of [
      [1.95, 1.15],
      [-1.95, 1.15],
      [1.95, -1.35],
      [-1.95, -1.35],
    ] as const) {
      add('frame', strut(Math.sign(x) * 0.8, -0.05, z * 0.55, x, -0.02, z, 0.16));
      add('hull', ring(0.72, 0.13, x, 0, z));
      add('frame', cyl(0.1, 0.1, 0.2, x, 0, z));
      add('rotor', disc(0.62, x, 0.02, z));
      add('thrust', disc(0.5, x, -0.12, z));
    }
    add('sign', box(0.8, 0.2, 0.35, 0, 0.84, -0.15));
    // Barra de luz branca na frente e a vermelha atrás, como nos carros.
    add('navWhite', box(0.9, 0.05, 0.05, 0, -0.18, 2.13));
    add('navRed', box(0.7, 0.05, 0.05, 0, 0.12, -2.31));
    add('navRed', sphere(0.09, 1, 1, 1, -2.7, 0, 1.15, 8));
    add('navGreen', sphere(0.09, 1, 1, 1, 2.7, 0, 1.15, 8));
    add('navWhite', sphere(0.1, 1, 1, 1, 0, 0.55, -2.1, 8));
  } else if (cls === 'private') {
    // Particular: fuselagem longa e achatada, bolha de cabine alongada, asas enflechadas com
    // espessura, cauda em V e dois propulsores em naceles na raiz da cauda.
    add('hull', fuselage(PRIVATE_PROFILE, 1.15, 0.62, 0));
    add('glass', sphere(1, 0.68, 0.4, 1.55, 0, 0.3, 0.75));
    for (const s of [1, -1]) {
      add('hull', wing(s), vfin(s));
      add('hull', cyl(0.32, 0.28, 1.5, s * 0.95, 0.12, -1.75, 'x'));
      add('thrust', prep(new THREE.CircleGeometry(0.25, seg(18)).rotateY(Math.PI).translate(s * 0.95, 0.12, -2.51)));
      add('gold', cyl(0.34, 0.34, 0.08, s * 0.95, 0.12, -1.0, 'x'));
    }
    add('gold', prep(new THREE.TorusGeometry(1, 0.025, low ? 3 : 6, seg(40)).rotateX(Math.PI / 2).scale(0.9, 1, 2.3).translate(0, -0.02, 0.2)));
    add('navRed', sphere(0.08, 1, 1, 1, -2.62, 0, -0.85, 8));
    add('navGreen', sphere(0.08, 1, 1, 1, 2.62, 0, -0.85, 8));
    add('navWhite', sphere(0.09, 1, 1, 1, 0, 0.1, -2.78, 8), box(0.6, 0.04, 0.04, 0, -0.12, 2.55));
  } else if (cls === 'cargo') {
    // Cargueiro: contêiner com nervuras pendurado numa estrutura de quatro rotores.
    add('hull', box(2.4, 1.6, 4.2, 0, -0.6, 0));
    for (let z = -1.8; z <= 1.8; z += 0.6) add('frame', box(2.46, 1.66, 0.08, 0, -0.6, z));
    add('frame', box(3.6, 0.3, 0.3, 0, 0.45, 1.6), box(3.6, 0.3, 0.3, 0, 0.45, -1.6), box(0.3, 0.3, 3.5, 1.6, 0.45, 0), box(0.3, 0.3, 3.5, -1.6, 0.45, 0));
    add('glass', box(1.6, 0.5, 0.06, 0, 0.0, 2.12));
    for (const [x, z] of [
      [2.3, 2.1],
      [-2.3, 2.1],
      [2.3, -2.1],
      [-2.3, -2.1],
    ] as const) {
      add('hull', ring(0.95, 0.14, x, 0.55, z));
      add('rotor', disc(0.85, x, 0.56, z));
      add('thrust', disc(0.7, x, 0.42, z));
    }
    add('gold', box(2.42, 0.12, 4.22, 0, -0.1, 0));
    add('navRed', sphere(0.1, 1, 1, 1, -3.3, 0.55, 2.1, 8));
    add('navGreen', sphere(0.1, 1, 1, 1, 3.3, 0.55, 2.1, 8));
    add('navWhite', sphere(0.12, 1, 1, 1, 0, 0.7, -2.2, 8));
  } else {
    // Drone de serviço: quadricóptero compacto.
    add('hull', box(0.6, 0.22, 0.6), sphere(0.2, 1, 0.6, 1, 0, -0.16, 0.12, 10));
    for (const [x, z] of [
      [0.55, 0.55],
      [-0.55, 0.55],
      [0.55, -0.55],
      [-0.55, -0.55],
    ] as const) {
      add('frame', box(0.06, 0.05, 0.75, x / 2, 0, z / 2).rotateY(0));
      add('hull', ring(0.26, 0.04, x, 0.04, z));
      add('rotor', disc(0.23, x, 0.06, z));
    }
    add('navRed', sphere(0.05, 1, 1, 1, -0.3, 0, 0.3, 6));
    add('navGreen', sphere(0.05, 1, 1, 1, 0.3, 0, 0.3, 6));
    add('navWhite', sphere(0.05, 1, 1, 1, 0, 0.12, -0.3, 6));
  }
  const merged = new Map<AirSlot, THREE.BufferGeometry>();
  for (const [slot, list] of slots) {
    merged.set(slot, mergeGeometries(list)!);
    list.forEach((g) => g.dispose());
  }
  low = false;
  return { slots: merged };
}

export const AIR_CLASSES: AirClass[] = ['taxi', 'private', 'cargo', 'drone'];

/** Um modelo de perto (o carro voador do jogador usa o do táxi aéreo). */
export const buildAirModel = (cls: AirClass) => build(cls);

export function buildAirModels(): Record<AirClass, AirModel> {
  return { taxi: build('taxi'), private: build('private'), cargo: build('cargo'), drone: build('drone') };
}

export function disposeAirModels(models: Record<AirClass, AirModel>) {
  Object.values(models).forEach((m) => m.slots.forEach((g) => g.dispose()));
}

/** Voador de longe em três malhas: casco (material da classe), o resto (cor por vértice) e as luzes. */
export interface FarAirModel {
  hull: THREE.BufferGeometry;
  rest: THREE.BufferGeometry;
  lights: THREE.BufferGeometry;
}

const FAR_COLORS: Partial<Record<AirSlot, string>> = { glass: '#0a1322', frame: '#0e1219', gold: '#c7a86a', sign: '#c7a86a', thrust: '#7fa6f5', navRed: '#ff4a3d', navGreen: '#3dff8a', navWhite: '#ffffff' };
const LIGHT_SLOTS = new Set<AirSlot>(['thrust', 'navRed', 'navGreen', 'navWhite']);

const painted = (g: THREE.BufferGeometry, hex: string) => {
  const out = g.clone();
  const c = new THREE.Color(hex).convertSRGBToLinear();
  const n = out.attributes.position!.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return out;
};

/**
 * Os quatro voadores de longe: um terço das divisões nas curvas e 3 chamadas de
 * desenho por classe em vez de ~8. Os rotores translúcidos ficam de fora (de
 * longe não se veem) e as luzes não piscam.
 */
export function buildFarAirModels(): Record<AirClass, FarAirModel> {
  const out = {} as Record<AirClass, FarAirModel>;
  for (const cls of AIR_CLASSES) {
    const m = build(cls, true);
    const rest: THREE.BufferGeometry[] = [];
    const lights: THREE.BufferGeometry[] = [];
    for (const [slot, geo] of m.slots) {
      if (slot === 'hull' || slot === 'rotor') continue;
      (LIGHT_SLOTS.has(slot) ? lights : rest).push(painted(geo, FAR_COLORS[slot] ?? '#555a62'));
    }
    out[cls] = { hull: m.slots.get('hull')!.clone(), rest: mergeGeometries(rest)!, lights: mergeGeometries(lights)! };
    [...rest, ...lights].forEach((g) => g.dispose());
    m.slots.forEach((g) => g.dispose());
  }
  return out;
}

export function disposeFarAirModels(models: Record<AirClass, FarAirModel>) {
  Object.values(models).forEach((m) => [m.hull, m.rest, m.lights].forEach((g) => g.dispose()));
}

/** Pintura de cada classe (a mesma linguagem da marca: pérola, marinho, grafite). */
export const AIR_PAINT: Record<AirClass, string> = { taxi: '#efe6d3', private: '#22344f', cargo: '#5d6b7f', drone: '#2c3440' };

/** Voador de perto, com as peças juntas por material: casco, vidro, rotores, acabamentos (cor no vértice), luzes fixas e as de navegação. */
export type NearAirSlot = 'hull' | 'glass' | 'rotor' | 'rest' | 'lights' | 'nav' | 'navWhite';

/**
 * Os quatro voadores de perto para o trânsito instanciado: estrutura, frisos e
 * letreiro numa malha com a cor no vértice; propulsores numa malha de luz;
 * vermelha e verde (piscam juntas) noutra. 7 conjuntos por classe em vez de 10.
 */
export function buildNearAirModels(): Record<AirClass, Map<NearAirSlot, THREE.BufferGeometry>> {
  const out = {} as Record<AirClass, Map<NearAirSlot, THREE.BufferGeometry>>;
  for (const cls of AIR_CLASSES) {
    const m = build(cls);
    const rest: THREE.BufferGeometry[] = [];
    const lights: THREE.BufferGeometry[] = [];
    const nav: THREE.BufferGeometry[] = [];
    const slots = new Map<NearAirSlot, THREE.BufferGeometry>();
    for (const [slot, geo] of m.slots) {
      if (slot === 'hull' || slot === 'glass' || slot === 'rotor' || slot === 'navWhite') slots.set(slot, geo.clone());
      else if (slot === 'navRed' || slot === 'navGreen') nav.push(painted(geo, FAR_COLORS[slot]!));
      else if (slot === 'thrust') lights.push(painted(geo, FAR_COLORS.thrust!));
      else rest.push(painted(geo, FAR_COLORS[slot] ?? '#555a62'));
    }
    if (rest.length) slots.set('rest', mergeGeometries(rest)!);
    if (lights.length) slots.set('lights', mergeGeometries(lights)!);
    if (nav.length) slots.set('nav', mergeGeometries(nav)!);
    [...rest, ...lights, ...nav].forEach((g) => g.dispose());
    m.slots.forEach((g) => g.dispose());
    out[cls] = slots;
  }
  return out;
}
