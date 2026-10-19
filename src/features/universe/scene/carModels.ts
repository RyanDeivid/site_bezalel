import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR_SPECS, type CarClass } from '../world/vehicles';

/**
 * Modelos procedurais dos carros (sem arquivos externos). Cada classe nasce
 * de perfis laterais desenhados com curvas e extrudados com chanfro — dá a
 * silhueta (capô, para-brisa, teto, traseira) e recorta os arcos das rodas —
 * mais as peças que mais pesam na leitura de um carro: estufa de vidro,
 * barras de faróis e lanternas, saias e para-choques escuros, frisos, câmeras
 * no lugar dos retrovisores e rodas com pneu, aro de raios e cubo.
 *
 * Saída: geometrias mescladas por material (`slot`) — o trânsito as desenha
 * instanciadas; o carro do jogador, como malhas comuns.
 */

export type CarSlot = 'paint' | 'glass' | 'trim' | 'chrome' | 'gold' | 'head' | 'tail' | 'sign' | 'sensor';

export interface CarModel {
  slots: Map<CarSlot, THREE.BufferGeometry>;
  /** Pneu e aro de uma roda (centrados na origem, eixo em x). */
  tire: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  /** Centros das quatro rodas (frente-esquerda, frente-direita, trás-esquerda, trás-direita). */
  wheels: Array<[number, number, number]>;
  /** Altura das lanternas (para o halo de freio). */
  tailY: number;
}

type P = [number, number];
type Seg = { line: P } | { quad: [P, P] } | { arc: [number, number, number] };

/** Perfil lateral (x = comprimento, frente positiva; y = altura) com retas, curvas e arcos de roda. */
function profile(start: P, segs: Seg[]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(start[0], start[1]);
  for (const g of segs) {
    if ('line' in g) s.lineTo(g.line[0], g.line[1]);
    else if ('quad' in g) s.quadraticCurveTo(g.quad[0][0], g.quad[0][1], g.quad[1][0], g.quad[1][1]);
    // Arco de roda: semicírculo por cima (do lado da frente para o de trás).
    else s.absarc(g.arc[0], g.arc[1], g.arc[2], 0, Math.PI, false);
  }
  s.closePath();
  return s;
}

/** Extruda um perfil na largura (com chanfro) e o deixa no referencial do carro: frente = +z, centro em x = 0. */
function extrude(shape: THREE.Shape, width: number, bevel: number, curveSegments = 10): THREE.BufferGeometry {
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 4, curveSegments, steps: 1 });
  // Perfil em XY extrudado em +Z → girar para o comprimento ficar em +Z e a largura em X.
  g.rotateY(-Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(-(bb.min.x + bb.max.x) / 2, 0, 0);
  g.deleteAttribute('uv');
  return g;
}

/**
 * Onde fica a superfície da carroceria (comprimento, já com o chanfro da
 * extrusão, que incha o perfil) numa dada altura: na frente (`front`) ou na
 * traseira. Faróis, lanternas e para-choques são montados aí — não por número
 * fixo, que os deixaria enterrados na pintura ou flutuando.
 */
function surfaceZ(shape: THREE.Shape, bevel: number, y: number, front: boolean): number {
  const pts = shape.getPoints(24);
  let best = front ? -Infinity : Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) continue;
    const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
    best = front ? Math.max(best, x) : Math.min(best, x);
  }
  return best + (front ? 1 : -1) * bevel * 0.85;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  g.deleteAttribute('uv');
  return g;
};
const cyl = (r: number, h: number, x: number, y: number, z: number, seg = 16) => {
  const g = new THREE.CylinderGeometry(r, r, h, seg).translate(x, y, z);
  g.deleteAttribute('uv');
  return g;
};

/** Os dois lados (x positivo e negativo) de uma peça. */
const mirrored = (make: (s: 1 | -1) => THREE.BufferGeometry) => [make(1), make(-1)];

function wheel(r: number, sporty: boolean) {
  const tire = new THREE.CylinderGeometry(r, r, 0.27, 28).rotateZ(Math.PI / 2);
  // Ombros do pneu: um toro achatado de cada lado arredonda o perfil.
  const shoulders = mirrored((s) => new THREE.TorusGeometry(r - 0.05, 0.05, 6, 28).rotateY(Math.PI / 2).translate(0.12 * s, 0, 0));
  const spokes = sporty ? 10 : 5;
  const rimParts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.2, 24).rotateZ(Math.PI / 2), new THREE.CylinderGeometry(r * 0.17, r * 0.17, 0.3, 12).rotateZ(Math.PI / 2)];
  for (let i = 0; i < spokes; i++) rimParts.push(new THREE.BoxGeometry(0.05, r * 0.56, sporty ? 0.035 : 0.06).translate(0.11, r * 0.3, 0).rotateX((i / spokes) * Math.PI * 2));
  [tire, ...shoulders, ...rimParts].forEach((g) => g.deleteAttribute('uv'));
  return { tire: mergeGeometries([tire, ...shoulders])!, rim: mergeGeometries(rimParts)! };
}

function build(cls: CarClass): CarModel {
  const spec = CAR_SPECS[cls];
  const w = spec.width;
  const slots = new Map<CarSlot, THREE.BufferGeometry[]>();
  const add = (slot: CarSlot, ...g: THREE.BufferGeometry[]) => slots.set(slot, [...(slots.get(slot) ?? []), ...g]);
  const wb = spec.wheelbase / 2;
  const r = spec.wheelRadius;
  // Folga do arco de roda; o chanfro da extrusão incha o perfil e fecharia o arco sobre o pneu.
  const arcFor = (bevel: number) => r + 0.08 + bevel * 0.85;
  let arcR: number;
  let tailY: number;

  if (cls === 'sedan') {
    // Sedã: capô longo, para-brisa inclinado, teto em arco, traseira curta.
    const bevel = 0.22;
    arcR = arcFor(bevel);
    const body = profile([-2.35, 0.42], [
          { line: [-2.38, 0.8] },
          { quad: [[-2.36, 1.0], [-2.08, 1.02]] },
          { line: [-1.25, 1.03] },
          { line: [1.02, 1.0] },
          { quad: [[1.95, 0.95], [2.27, 0.78]] },
          { quad: [[2.42, 0.7], [2.36, 0.48]] },
          { line: [2.22, 0.36] },
          { line: [wb + arcR, 0.36] },
          { arc: [wb, 0.36, arcR] },
          { line: [-wb + arcR, 0.36] },
          { arc: [-wb, 0.36, arcR] },
          { line: [-2.35, 0.42] },
        ]);
    add('paint', extrude(body, w, bevel, 14));
    const front = (y: number, out = 0.012) => surfaceZ(body, bevel, y, true) + out;
    const rear = (y: number, out = 0.012) => surfaceZ(body, bevel, y, false) - out;
    add('glass', extrude(profile([-1.25, 1.0], [{ line: [-0.92, 1.33] }, { quad: [[-0.68, 1.45], [-0.3, 1.46]] }, { line: [0.36, 1.46] }, { quad: [[0.72, 1.44], [1.06, 0.98]] }]), w * 0.86, 0.05));
    add('paint', extrude(profile([-0.82, 1.42], [{ quad: [[-0.6, 1.48], [-0.3, 1.49]] }, { line: [0.36, 1.49] }, { quad: [[0.6, 1.48], [0.74, 1.42]] }]), w * 0.8, 0.03));
    // Colunas B (pintadas) e friso cromado da linha de cintura.
    add('paint', ...mirrored((s) => box(0.03, 0.42, 0.1, s * w * 0.43, 1.22, -0.18)));
    add('chrome', ...mirrored((s) => box(0.025, 0.035, 2.2, s * (w / 2 - 0.05), 1.02, -0.1)));
    add('head', box(w * 0.78, 0.055, 0.05, 0, 0.73, front(0.73)), ...mirrored((s) => box(0.32, 0.09, 0.05, s * w * 0.32, 0.64, front(0.64))));
    add('tail', box(w * 0.86, 0.08, 0.05, 0, 0.88, rear(0.88)), ...mirrored((s) => box(0.26, 0.16, 0.05, s * w * 0.36, 0.8, rear(0.8))));
    add('trim', box(w * 0.8, 0.16, 0.08, 0, 0.47, front(0.47)), box(w * 0.86, 0.14, 0.08, 0, 0.5, rear(0.5)), ...mirrored((s) => box(0.06, 0.12, 1.5, s * (w / 2 - 0.02), 0.46, 0)));
    add('trim', ...mirrored((s) => box(0.14, 0.07, 0.18, s * (w / 2 + 0.04), 1.06, 0.95)));
    tailY = 0.88;
  } else if (cls === 'sport') {
    // Esportivo: perfil baixo, capô longo e afilado, cabine recuada, traseira "ducktail".
    const bevel = 0.18;
    arcR = arcFor(bevel);
    const body = profile([-2.27, 0.36], [
          { line: [-2.3, 0.66] },
          { quad: [[-2.26, 0.84], [-2.0, 0.86]] },
          { line: [-1.1, 0.85] },
          { line: [0.7, 0.8] },
          { quad: [[1.7, 0.72], [2.2, 0.5]] },
          { quad: [[2.33, 0.44], [2.29, 0.32]] },
          { line: [wb + arcR, 0.3] },
          { arc: [wb, 0.3, arcR] },
          { line: [-wb + arcR, 0.3] },
          { arc: [-wb, 0.3, arcR] },
          { line: [-2.27, 0.36] },
        ]);
    add('paint', extrude(body, w, bevel, 12));
    const front = (y: number, out = 0.012) => surfaceZ(body, bevel, y, true) + out;
    const rear = (y: number, out = 0.012) => surfaceZ(body, bevel, y, false) - out;
    add('glass', extrude(profile([-1.15, 0.84], [{ quad: [[-0.55, 1.12], [-0.1, 1.14]] }, { line: [0.25, 1.14] }, { quad: [[0.55, 1.1], [0.95, 0.8]] }]), w * 0.78, 0.05));
    // Aerofólio sobre dois suportes.
    add('trim', box(w * 0.92, 0.05, 0.36, 0, 1.06, -2.0), ...mirrored((s) => box(0.05, 0.2, 0.12, s * w * 0.32, 0.95, -2.0)));
    add('gold', box(w * 0.92, 0.02, 0.04, 0, 1.09, -1.82));
    // Entradas de ar laterais e difusor.
    add('trim', ...mirrored((s) => box(0.06, 0.18, 0.6, s * (w / 2 - 0.02), 0.62, -0.75)));
    for (let i = -2; i <= 2; i++) add('trim', box(0.04, 0.16, 0.3, i * 0.26, 0.4, rear(0.4, -0.1)));
    add('head', ...mirrored((s) => box(0.5, 0.04, 0.05, s * w * 0.3, 0.5, front(0.5))), box(w * 0.3, 0.03, 0.05, 0, 0.44, front(0.44)));
    add('tail', box(w * 0.88, 0.06, 0.05, 0, 0.72, rear(0.72)));
    add('trim', box(w * 0.7, 0.1, 0.08, 0, 0.36, front(0.36)), ...mirrored((s) => box(0.05, 0.09, 1.6, s * (w / 2 - 0.02), 0.36, 0)));
    add('trim', ...mirrored((s) => box(0.12, 0.06, 0.16, s * (w / 2 + 0.03), 0.9, 0.6)));
    tailY = 0.72;
  } else {
    // Táxi autônomo: cápsula alta, estufa de vidro ampla, teto com letreiro e sensor.
    const bevel = 0.16;
    arcR = arcFor(bevel);
    const body = profile([-2.18, 0.42], [
          { line: [-2.22, 0.98] },
          { quad: [[-2.2, 1.14], [-2.0, 1.15]] },
          { line: [1.25, 1.14] },
          { quad: [[1.95, 1.06], [2.16, 0.8]] },
          { quad: [[2.26, 0.62], [2.2, 0.45]] },
          { line: [wb + arcR, 0.36] },
          { arc: [wb, 0.36, arcR] },
          { line: [-wb + arcR, 0.36] },
          { arc: [-wb, 0.36, arcR] },
          { line: [-2.18, 0.42] },
        ]);
    add('paint', extrude(body, w, bevel));
    const front = (y: number, out = 0.012) => surfaceZ(body, bevel, y, true) + out;
    const rear = (y: number, out = 0.012) => surfaceZ(body, bevel, y, false) - out;
    add('glass', extrude(profile([-2.0, 1.12], [{ line: [-1.96, 1.66] }, { quad: [[-1.92, 1.78], [-1.6, 1.79]] }, { line: [0.7, 1.79] }, { quad: [[1.12, 1.76], [1.62, 1.12]] }]), w * 0.9, 0.06));
    add('paint', box(w * 0.82, 0.06, 2.3, 0, 1.82, -0.45));
    add('gold', ...mirrored((s) => box(0.025, 0.06, 3.6, s * (w / 2 - 0.02), 1.0, -0.2)));
    // Letreiro e sensor (lidar) no teto.
    add('sign', box(0.9, 0.22, 0.3, 0, 1.97, -0.2));
    add('trim', cyl(0.2, 0.12, 0, 1.92, 0.55), cyl(0.12, 0.05, 0, 2.01, 0.55));
    add('sensor', cyl(0.205, 0.03, 0, 1.94, 0.55));
    add('head', box(w * 0.8, 0.07, 0.05, 0, 0.8, front(0.8)));
    add('tail', box(w * 0.84, 0.08, 0.05, 0, 1.0, rear(1.0)), ...mirrored((s) => box(0.06, 0.4, 0.05, s * (w / 2 - 0.16), 0.74, rear(0.74))));
    add('trim', box(w * 0.86, 0.18, 0.08, 0, 0.5, front(0.5)), box(w * 0.86, 0.18, 0.08, 0, 0.52, rear(0.52)), ...mirrored((s) => box(0.06, 0.14, 1.6, s * (w / 2 - 0.02), 0.46, 0)));
    // Linha da porta de correr.
    add('trim', ...mirrored((s) => box(0.02, 1.0, 0.03, s * (w / 2 + 0.005), 1.0, 0.25)));
    tailY = 1.0;
  }

  // Assoalho escuro (fecha a vista de baixo entre as rodas).
  add('trim', box(w * 0.86, 0.06, spec.length * 0.86, 0, 0.32, 0));

  const merged = new Map<CarSlot, THREE.BufferGeometry>();
  for (const [slot, list] of slots) {
    const nonIndexed = list.map((g) => (g.index ? g.toNonIndexed() : g));
    merged.set(slot, mergeGeometries(nonIndexed)!);
    list.forEach((g) => g.dispose());
    nonIndexed.forEach((g) => g.dispose());
  }
  const { tire, rim } = wheel(r, cls === 'sport');
  const tx = w / 2 - 0.2;
  return {
    slots: merged,
    tire,
    rim,
    wheels: [
      [tx, r, wb],
      [-tx, r, wb],
      [tx, r, -wb],
      [-tx, r, -wb],
    ],
    tailY,
  };
}

/** Os três modelos, construídos uma vez e compartilhados por trânsito e carros do jogador. */
export function buildCarModels(): Record<CarClass, CarModel> {
  return { sedan: build('sedan'), sport: build('sport'), taxi: build('taxi') };
}

export function disposeCarModels(models: Record<CarClass, CarModel>) {
  for (const m of Object.values(models)) {
    m.slots.forEach((g) => g.dispose());
    m.tire.dispose();
    m.rim.dispose();
  }
}

/** Materiais automotivos (PBR): pintura com verniz, vidro escuro espelhado, borracha, aro metálico. */
export function createCarMaterials(quality: 'low' | 'medium' | 'high') {
  const physical = quality !== 'low';
  const paint = physical
    ? new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.15 })
    : new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.3, envMapIntensity: 1.1 });
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256;
  signCanvas.height = 64;
  const ctx = signCanvas.getContext('2d')!;
  ctx.fillStyle = '#c7a86a';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#101b2b';
  ctx.font = "700 40px 'Geist Variable', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TÁXI', 128, 34);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  return {
    paint,
    glass: new THREE.MeshStandardMaterial({ color: '#0a1322', metalness: 0.9, roughness: 0.06, envMapIntensity: 1.6 }),
    trim: new THREE.MeshStandardMaterial({ color: '#0e1219', metalness: 0.2, roughness: 0.75 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#cfd5dc', metalness: 1, roughness: 0.15, envMapIntensity: 1.4 }),
    gold: new THREE.MeshStandardMaterial({ color: '#c7a86a', metalness: 1, roughness: 0.22, envMapIntensity: 1.2 }),
    head: new THREE.MeshBasicMaterial({ color: '#f6f1e7', toneMapped: false }),
    tail: new THREE.MeshBasicMaterial({ color: '#e0452a', toneMapped: false }),
    sign: new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }),
    sensor: new THREE.MeshBasicMaterial({ color: '#7fa6f5', toneMapped: false }),
    tire: new THREE.MeshStandardMaterial({ color: '#121417', metalness: 0, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: '#a7afb9', metalness: 1, roughness: 0.25, envMapIntensity: 1.3 }),
    signTex,
  };
}

export type CarMaterials = ReturnType<typeof createCarMaterials>;

export function disposeCarMaterials(m: CarMaterials) {
  Object.values(m).forEach((x) => x.dispose());
}

/** Material de cada slot (a pintura é a mesma para todos: a cor vem por instância ou por cópia). */
export function slotMaterial(m: CarMaterials, slot: CarSlot): THREE.Material {
  return m[slot];
}
