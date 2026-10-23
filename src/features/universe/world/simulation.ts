import type { PlayerVehicle, UniverseRuntime } from './runtime';

/**
 * Passo fixo da simulação do jogador, separado do desenho.
 *
 * A física (andar, dirigir, voar, entrar e sair) avança sempre em passos de
 * `SIM_STEP`, quantos couberem no tempo que passou (um acumulador): o
 * resultado não depende da taxa de quadros, e um aparelho lento não deixa o
 * jogo em câmera lenta (antes, o passo era o tempo do quadro limitado a 50 ms —
 * a 5 quadros/s, o mundo andava a um quarto da velocidade). O desenho lê a pose
 * interpolada entre os dois últimos passos (`renderPose`): suave a 30, 45, 60
 * ou 120 Hz. É a base para reproduzir partidas e, no futuro, simular na rede.
 */
export const SIM_STEP = 1 / 60;
/** No máximo 15 passos por quadro (0,25 s): num travamento longo, o mundo não "corre atrás" sem fim. */
export const MAX_STEPS = 15;
/** Acima disso entre dois passos é teletransporte (ir a um local, sair do veículo): sem interpolar. */
const SNAP = 6;

export interface Pose {
  x: number;
  y: number;
  z: number;
  heading: number;
}

export interface SimClock {
  acc: number;
  /** Fração do passo seguinte já decorrida (0..1): quanto avançar a pose desenhada além do último passo. */
  alpha: number;
  tick: number;
}

export const createClock = (): SimClock => ({ acc: 0, alpha: 1, tick: 0 });

/**
 * Avança o relógio pelo tempo do quadro e chama `step` quantas vezes couber.
 * Devolve quantos passos rodaram.
 */
export function advance(clock: SimClock, frameDt: number, step: (dt: number) => void): number {
  clock.acc += Math.max(0, Math.min(frameDt, MAX_STEPS * SIM_STEP));
  let n = 0;
  while (clock.acc >= SIM_STEP && n < MAX_STEPS) {
    step(SIM_STEP);
    clock.acc -= SIM_STEP;
    clock.tick++;
    n++;
  }
  if (n === MAX_STEPS) clock.acc = Math.min(clock.acc, SIM_STEP);
  clock.alpha = clock.acc / SIM_STEP;
  return n;
}

// ---- Poses anteriores (para interpolar o desenho) ----

const previous = new WeakMap<object, Pose>();

const walkerPose = (rt: UniverseRuntime): Pose => ({ x: rt.walker.x, y: rt.walker.y, z: rt.walker.z, heading: rt.walker.heading });
const vehiclePoseOf = (v: PlayerVehicle): Pose => (v.kind === 'car' ? { x: v.car.x, y: v.car.y, z: v.car.z, heading: v.car.heading } : { x: v.craft.x, y: v.craft.y, z: v.craft.z, heading: v.craft.yaw });

/** Guarda a pose atual de tudo que o jogador move, antes de um passo. */
export function capturePoses(rt: UniverseRuntime) {
  set(rt.walker, walkerPose(rt));
  for (const v of rt.vehicles) set(v, vehiclePoseOf(v));
}

function set(key: object, p: Pose) {
  const old = previous.get(key);
  if (old) Object.assign(old, p);
  else previous.set(key, p);
}

const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function blend(prev: Pose | undefined, cur: Pose, alpha: number, out: Pose): Pose {
  if (!prev || Math.hypot(cur.x - prev.x, cur.z - prev.z) > SNAP || Math.abs(cur.y - prev.y) > SNAP) return Object.assign(out, cur);
  out.x = prev.x + (cur.x - prev.x) * alpha;
  out.y = prev.y + (cur.y - prev.y) * alpha;
  out.z = prev.z + (cur.z - prev.z) * alpha;
  out.heading = lerpAngle(prev.heading, cur.heading, alpha);
  return out;
}

/** Pose do visitante a pé para desenhar (entre os dois últimos passos). */
export function renderWalker(rt: UniverseRuntime, clock: SimClock, out: Pose): Pose {
  return blend(previous.get(rt.walker), walkerPose(rt), clock.alpha, out);
}

/** Pose de um veículo para desenhar (entre os dois últimos passos). */
export function renderVehicle(v: PlayerVehicle, clock: SimClock, out: Pose): Pose {
  return blend(previous.get(v), vehiclePoseOf(v), clock.alpha, out);
}
