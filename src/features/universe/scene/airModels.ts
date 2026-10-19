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

const prep = (g: THREE.BufferGeometry) => {
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
};
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => prep(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
const sphere = (r: number, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0, seg = 20) => prep(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.6)).scale(sx, sy, sz).translate(x, y, z));
const ring = (r: number, tube: number, x: number, y: number, z: number) => prep(new THREE.TorusGeometry(r, tube, 8, 28).rotateX(Math.PI / 2).translate(x, y, z));
const disc = (r: number, x: number, y: number, z: number) => prep(new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2).translate(x, y, z));
const cyl = (r1: number, r2: number, h: number, x = 0, y = 0, z = 0, rot?: 'x' | 'z') => {
  const g = new THREE.CylinderGeometry(r1, r2, h, 16);
  if (rot === 'x') g.rotateX(Math.PI / 2);
  if (rot === 'z') g.rotateZ(Math.PI / 2);
  return prep(g.translate(x, y, z));
};

function build(cls: AirClass): AirModel {
  const slots = new Map<AirSlot, THREE.BufferGeometry[]>();
  const add = (slot: AirSlot, ...g: THREE.BufferGeometry[]) => slots.set(slot, [...(slots.get(slot) ?? []), ...g]);
  if (cls === 'taxi') {
    // Táxi aéreo: cápsula com cabine envidraçada e quatro rotores carenados nos braços.
    add('hull', sphere(1, 1.25, 0.8, 2.3), box(0.9, 0.35, 0.5, 0, -0.55, -1.6));
    add('glass', sphere(1, 0.95, 0.62, 1.25, 0, 0.32, 0.65));
    add('gold', prep(new THREE.TorusGeometry(1, 0.03, 6, 40).rotateX(Math.PI / 2).scale(1.27, 1, 2.32).translate(0, -0.05, 0)));
    for (const [x, z] of [
      [1.9, 1.3],
      [-1.9, 1.3],
      [1.9, -1.3],
      [-1.9, -1.3],
    ] as const) {
      add('frame', box(Math.abs(x) - 0.6, 0.12, 0.25, x / 2 + Math.sign(x) * 0.3, -0.1, z * 0.75));
      add('hull', ring(0.72, 0.13, x, 0, z));
      add('rotor', disc(0.62, x, 0.02, z));
      add('thrust', disc(0.5, x, -0.12, z));
    }
    add('sign', box(0.8, 0.2, 0.35, 0, 0.82, -0.1));
    add('navRed', sphere(0.09, 1, 1, 1, -2.55, 0, 1.3, 8));
    add('navGreen', sphere(0.09, 1, 1, 1, 2.55, 0, 1.3, 8));
    add('navWhite', sphere(0.1, 1, 1, 1, 0, 0.1, -2.35, 8));
  } else if (cls === 'private') {
    // Particular: fuselagem em cunha, asas curtas e dois propulsores traseiros.
    add('hull', sphere(1, 1.05, 0.55, 2.6), box(4.2, 0.12, 1.2, 0, -0.05, -0.6));
    add('glass', sphere(1, 0.72, 0.42, 1.3, 0, 0.3, 0.75));
    add('frame', box(0.12, 0.7, 0.9, 0, 0.45, -2.0));
    for (const s of [1, -1]) {
      add('hull', cyl(0.38, 0.32, 1.7, s * 1.25, 0.05, -1.5, 'x'));
      add('thrust', prep(new THREE.CircleGeometry(0.3, 18).rotateY(Math.PI).translate(s * 1.25, 0.05, -2.36)));
      add('gold', cyl(0.4, 0.4, 0.08, s * 1.25, 0.05, -0.66, 'x'));
    }
    add('navRed', sphere(0.08, 1, 1, 1, -2.1, -0.05, -0.6, 8));
    add('navGreen', sphere(0.08, 1, 1, 1, 2.1, -0.05, -0.6, 8));
    add('navWhite', sphere(0.09, 1, 1, 1, 0, 0.82, -2.4, 8));
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
  return { slots: merged };
}

export const AIR_CLASSES: AirClass[] = ['taxi', 'private', 'cargo', 'drone'];

export function buildAirModels(): Record<AirClass, AirModel> {
  return { taxi: build('taxi'), private: build('private'), cargo: build('cargo'), drone: build('drone') };
}

export function disposeAirModels(models: Record<AirClass, AirModel>) {
  Object.values(models).forEach((m) => m.slots.forEach((g) => g.dispose()));
}

/** Pintura de cada classe (a mesma linguagem da marca: pérola, marinho, grafite). */
export const AIR_PAINT: Record<AirClass, string> = { taxi: '#efe6d3', private: '#22344f', cargo: '#5d6b7f', drone: '#2c3440' };
