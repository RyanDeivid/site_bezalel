import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Quality } from '../world/city';
import type { CarClass } from '../world/vehicles';
import { designCar } from './carDesign';

/**
 * Modelos dos carros (sem arquivos externos): a forma vem de carDesign.ts
 * (superfícies "loft" por seções, como no design automotivo); aqui ficam os
 * materiais e a versão de longe juntada em 3 malhas.
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

/** Os três modelos, construídos uma vez e compartilhados por trânsito e carros do jogador. `far` = versão de longe. */
export function buildCarModels(far = false): Record<CarClass, CarModel> {
  const build = (cls: CarClass): CarModel => {
    const d = designCar(cls, far);
    return { slots: d.parts as Map<CarSlot, THREE.BufferGeometry>, tire: d.tire, rim: d.rim, wheels: d.wheels, tailY: d.tailY };
  };
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
export function createCarMaterials(quality: Quality) {
  const physical = quality !== 'low';
  const paint = physical
    ? new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0.62, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.25 })
    : new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.3, envMapIntensity: 1.1 });
  // Luzes acima de 1 (HDR): com o brilho ligado elas "acendem"; sem ele, ficam como sempre (saturam em 1).
  const hot = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);
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
    // Vidro escuro espelhado (reflete o céu e as luzes pelo mapa de ambiente), plástico texturizado fosco.
    glass: new THREE.MeshStandardMaterial({ color: '#0c1628', metalness: 0.95, roughness: 0.035, envMapIntensity: 2.1 }),
    trim: new THREE.MeshStandardMaterial({ color: '#0b0e13', metalness: 0.15, roughness: 0.82 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#cfd5dc', metalness: 1, roughness: 0.15, envMapIntensity: 1.4 }),
    gold: new THREE.MeshStandardMaterial({ color: '#c7a86a', metalness: 1, roughness: 0.22, envMapIntensity: 1.2 }),
    head: new THREE.MeshBasicMaterial({ color: hot('#f6f1e7', 3.2), toneMapped: false }),
    tail: new THREE.MeshBasicMaterial({ color: hot('#e0452a', 2.4), toneMapped: false }),
    sign: new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }),
    sensor: new THREE.MeshBasicMaterial({ color: '#7fa6f5', toneMapped: false }),
    tire: new THREE.MeshStandardMaterial({ color: '#16181c', metalness: 0, roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: '#b4bcc6', metalness: 1, roughness: 0.24, envMapIntensity: 1.4 }),
    // Versão de longe: tudo o que não é pintura nem luz numa malha só, com a cor por vértice.
    farRest: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.4, envMapIntensity: 1.2 }),
    farLights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: hot('#ffffff', 2.4) }),
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

/** Carro de longe em três malhas: pintura (cor por instância ou por cópia), o resto e as luzes. */
export interface FarCarModel {
  paint: THREE.BufferGeometry;
  rest: THREE.BufferGeometry;
  lights: THREE.BufferGeometry;
}

/** Cor de cada peça na malha única da versão de longe (a mesma dos materiais de perto). */
const FAR_COLORS: Record<string, string> = {
  glass: '#0a1322',
  trim: '#0e1219',
  chrome: '#cfd5dc',
  gold: '#c7a86a',
  sign: '#c7a86a',
  sensor: '#7fa6f5',
  tire: '#121417',
  rim: '#a7afb9',
  head: '#f6f1e7',
  tail: '#e0452a',
};

const painted = (g: THREE.BufferGeometry, hex: string) => {
  const out = g.index ? g.toNonIndexed() : g.clone();
  const c = new THREE.Color(hex).convertSRGBToLinear();
  const n = out.attributes.position!.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return out;
};

/**
 * Os três modelos de longe, já juntados: 3 chamadas de desenho por carro em vez
 * de 15 (7 peças + 8 de rodas). As rodas ficam paradas (de longe não se vê o
 * giro). Cada chamada custa ~23 µs de CPU no Intel Iris Xe.
 */
export function buildFarCarModels(): Record<CarClass, FarCarModel> {
  const base = buildCarModels(true);
  const out = {} as Record<CarClass, FarCarModel>;
  for (const cls of Object.keys(base) as CarClass[]) {
    const m = base[cls];
    const rest: THREE.BufferGeometry[] = [];
    const lights: THREE.BufferGeometry[] = [];
    for (const [slot, geo] of m.slots) {
      if (slot === 'paint') continue;
      (slot === 'head' || slot === 'tail' ? lights : rest).push(painted(geo, FAR_COLORS[slot] ?? '#555a62'));
    }
    for (const [x, y, z] of m.wheels) {
      rest.push(painted(m.tire.clone().translate(x, y, z), FAR_COLORS.tire!));
      rest.push(painted(m.rim.clone().translate(x, y, z), FAR_COLORS.rim!));
    }
    const paint = m.slots.get('paint')!;
    // Malha vazia (só por garantia): um triângulo degenerado, para o instanciamento não quebrar.
    const merge = (list: THREE.BufferGeometry[]) => (list.length ? mergeGeometries(list)! : painted(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3)).setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(9), 3)), '#000000'));
    out[cls] = { paint: paint.index ? paint.toNonIndexed() : paint.clone(), rest: merge(rest), lights: merge(lights) };
    [...rest, ...lights].forEach((g) => g.dispose());
  }
  disposeCarModels(base);
  return out;
}

export function disposeFarCarModels(models: Record<CarClass, FarCarModel>) {
  for (const m of Object.values(models)) [m.paint, m.rest, m.lights].forEach((g) => g.dispose());
}
