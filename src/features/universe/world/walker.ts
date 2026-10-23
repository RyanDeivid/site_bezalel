import { groundHeight, WORLD_HALF, type Solid } from './city';
import { pushOutOfBodies, pushOutOfSolids, type Body } from './vehicles';
import { stepMotion, type WalkInput } from './visitor';

export { RUN_SPEED, stepMotion, VISITOR_CAMERA, WALK_SPEED, type Mover, type WalkInput } from './visitor';

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


export const PERSON_RADIUS = 0.45;



export function createWalker(at: { x: number; z: number; yaw: number }): WalkerState {
  return { x: at.x, y: groundHeight(at.x, at.z), z: at.z, heading: at.yaw, vx: 0, vz: 0, stride: 0 };
}

export const walkerSpeed = (w: WalkerState) => Math.hypot(w.vx, w.vz);

export function stepWalker(w: WalkerState, input: WalkInput, dt: number, solids: Solid[], bodies: Body[] = []): void {
  stepMotion(w, input, dt, (p) => {
    pushOutOfSolids(p, PERSON_RADIUS, solids, w.y + 0.2);
    pushOutOfBodies(p, PERSON_RADIUS, bodies);
  });
  w.x = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, w.x));
  w.z = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, w.z));
  w.y += (groundHeight(w.x, w.z) - w.y) * (1 - Math.exp(-dt * 14));
}
