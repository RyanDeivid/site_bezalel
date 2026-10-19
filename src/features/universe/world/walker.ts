import { groundHeight, WORLD_HALF, type Solid } from './city';
import { pushOutOfBodies, pushOutOfSolids, type Body } from './vehicles';

/**
 * Exploração a pé: o visitante (um robô explorador da Bezalel) anda em
 * qualquer direção relativa à câmera, acelera e desacelera com suavidade
 * (tem peso: não para nem arranca instantaneamente), corre com Shift, sobe e
 * desce o meio-fio acompanhando o chão e não atravessa prédios, carros nem
 * pilares. Funções puras sobre um estado mutável.
 */

export interface WalkerState {
  x: number;
  y: number;
  z: number;
  /** Para onde o corpo está virado (rad, 0 = sul). */
  heading: number;
  vx: number;
  vz: number;
  /** Fase da passada (rad): o desenho anima as pernas com ela. */
  stride: number;
}

export interface WalkInput {
  /** Direção desejada no mundo (já relativa à câmera), comprimento 0…1. */
  x: number;
  z: number;
  run: boolean;
}

export const WALK_SPEED = 2.8;
export const RUN_SPEED = 6.2;
export const PERSON_RADIUS = 0.45;
const ACCEL = 14;
const DECEL = 18;

export function createWalker(at: { x: number; z: number; yaw: number }): WalkerState {
  return { x: at.x, y: groundHeight(at.x, at.z), z: at.z, heading: at.yaw, vx: 0, vz: 0, stride: 0 };
}

export const walkerSpeed = (w: WalkerState) => Math.hypot(w.vx, w.vz);

export function stepWalker(w: WalkerState, input: WalkInput, dt: number, solids: Solid[], bodies: Body[] = []): void {
  const len = Math.min(1, Math.hypot(input.x, input.z));
  const top = input.run ? RUN_SPEED : WALK_SPEED;
  const tx = len > 0 ? (input.x / Math.hypot(input.x, input.z)) * top * len : 0;
  const tz = len > 0 ? (input.z / Math.hypot(input.x, input.z)) * top * len : 0;
  // Acelera rumo à velocidade desejada (mais rápido para parar do que para arrancar).
  const rate = len > 0 ? ACCEL : DECEL;
  const dvx = tx - w.vx;
  const dvz = tz - w.vz;
  const dv = Math.hypot(dvx, dvz);
  const step = Math.min(dv, rate * dt);
  if (dv > 1e-6) {
    w.vx += (dvx / dv) * step;
    w.vz += (dvz / dv) * step;
  }
  const before = { x: w.x + w.vx * dt, z: w.z + w.vz * dt };
  const p = { ...before };
  pushOutOfSolids(p, PERSON_RADIUS, solids, w.y + 0.2);
  pushOutOfBodies(p, PERSON_RADIUS, bodies);
  // Encostou numa parede: perde a velocidade contra ela (desliza ao longo dela).
  if (dt > 0) {
    w.vx += (p.x - before.x) / dt;
    w.vz += (p.z - before.z) / dt;
  }
  w.x = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, p.x));
  w.z = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, p.z));
  w.y += (groundHeight(w.x, w.z) - w.y) * (1 - Math.exp(-dt * 14));
  const speed = walkerSpeed(w);
  if (speed > 0.3) {
    const target = Math.atan2(w.vx, w.vz);
    const diff = Math.atan2(Math.sin(target - w.heading), Math.cos(target - w.heading));
    w.heading += diff * Math.min(1, dt * 10);
  }
  // A passada acompanha a distância percorrida (as pernas não "patinam").
  w.stride += speed * dt * 2.3;
}
