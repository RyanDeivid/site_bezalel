/**
 * O visitante a pé, sem dependências: o mesmo jeito de andar e a mesma câmera no Universe e no laboratório.
 * (Leve de propósito: o laboratório importa daqui sem trazer a cidade junto.)
 */

export const WALK_SPEED = 2.8;
export const RUN_SPEED = 6.2;
const ACCEL = 14;
const DECEL = 18;

export interface WalkInput {
  /** Direção desejada no mundo (já relativa à câmera), comprimento 0…1. */
  x: number;
  z: number;
  run: boolean;
}

/**
 * O jeito de andar do visitante, o mesmo no Universe e no laboratório: acelera e desacelera com peso, corre
 * com Shift, vira o corpo para onde anda e avança a passada pela distância percorrida. Quem chama diz o que
 * é parede (`constrain` empurra o ponto para fora; o que for empurrado sai da velocidade: desliza ao longo).
 */
export interface Mover {
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  stride: number;
}

/** Velocidade depois de um empurrão `push` (m/s) de uma parede: o que ia contra ela some, até zero, e só. */
function absorb(v: number, push: number): number {
  if (push > 0) return Math.min(v + push, Math.max(v, 0));
  if (push < 0) return Math.max(v + push, Math.min(v, 0));
  return v;
}

export function stepMotion(w: Mover, input: WalkInput, dt: number, constrain: (p: { x: number; z: number }) => void): void {
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
  constrain(p);
  // Encostou numa parede: perde a velocidade contra ela (desliza ao longo dela). A parede só tira
  // velocidade, nunca dá: um empurrão grande (cair dentro de um móvel ao ser posicionado) virava dezenas de
  // m/s no quadro seguinte e arremessava o visitante através da parede ao lado.
  if (dt > 0) {
    w.vx = absorb(w.vx, (p.x - before.x) / dt);
    w.vz = absorb(w.vz, (p.z - before.z) / dt);
  }
  w.x = p.x;
  w.z = p.z;
  const speed = Math.hypot(w.vx, w.vz);
  if (speed > 0.3) {
    const target = Math.atan2(w.vx, w.vz);
    const diff = Math.atan2(Math.sin(target - w.heading), Math.cos(target - w.heading));
    w.heading += diff * Math.min(1, dt * 10);
  }
  // A passada acompanha a distância percorrida (as pernas não "patinam").
  w.stride += speed * dt * 2.3;
}

/**
 * A câmera do visitante a pé, a mesma no Universe e no laboratório: atrás do ombro (1,55 m), a 6,5 m, quase
 * na horizontal, mirando um pouco à frente do robô; arrastar gira e inclina, roda e pinça aproximam; segue
 * amortecida (posição e mira).
 */
export const VISITOR_CAMERA = {
  pitch: { min: -0.15, max: 1.2, start: 0.28 },
  distance: { min: 2.5, max: 40, start: 6.5 },
  eye: 1.55,
  aim: { ahead: 1.2, height: 1.45 },
  follow: 7,
  look: 10,
  drag: { yaw: 0.006, pitch: 0.004 },
  wheel: 0.0012,
} as const;
