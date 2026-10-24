import { groundHeight, insideSolid, WORLD_HALF, type Point2, type Solid } from './city';

/**
 * Carros do Universe: modelos (classes), direção e saída segura.
 *
 * Direção "arcade" no padrão dos jogos de mundo aberto (o que o jogador
 * espera sem ler manual):
 *  - W/↑ acelera; S/↓ freia e, parado, engata a ré; soltar tudo = o carro
 *    perde velocidade aos poucos (resistência ao rolamento + ar);
 *  - o volante vira menos em alta velocidade (esterço sensível à velocidade)
 *    e volta sozinho ao centro: curvas estáveis sem precisar dosar a tecla;
 *  - modelo de bicicleta (giro = velocidade × tan(esterço) / entre-eixos): o
 *    carro gira em torno do eixo traseiro, como um carro de verdade, e não
 *    "patina" de lado sem motivo;
 *  - freio de mão (Espaço) reduz a aderência: a traseira sai de lado, para
 *    curvas fechadas — o único caso em que há escorregamento lateral;
 *  - colisão: o carro é três círculos ao longo do comprimento; batendo de
 *    frente perde quase toda a velocidade, de raspão perde um pouco.
 */

export type CarClass = 'sedan' | 'sport' | 'taxi';

export interface CarSpec {
  cls: CarClass;
  /** Dimensões (m): comprimento, largura e altura. */
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  wheelRadius: number;
  /** Velocidade máxima à frente e em ré (m/s). */
  maxSpeed: number;
  reverseSpeed: number;
  /** Aceleração e frenagem (m/s²). */
  accel: number;
  brake: number;
  /** Esterço máximo das rodas (rad), parado. */
  maxSteer: number;
  /** Aderência lateral (quanto maior, menos o carro escorrega). */
  grip: number;
}

export const CAR_SPECS: Record<CarClass, CarSpec> = {
  sedan: { cls: 'sedan', length: 4.7, width: 1.95, height: 1.45, wheelbase: 2.85, wheelRadius: 0.36, maxSpeed: 32, reverseSpeed: 9, accel: 7.5, brake: 17, maxSteer: 0.56, grip: 10 },
  sport: { cls: 'sport', length: 4.55, width: 2.02, height: 1.16, wheelbase: 2.65, wheelRadius: 0.37, maxSpeed: 44, reverseSpeed: 9, accel: 11.5, brake: 21, maxSteer: 0.5, grip: 12 },
  taxi: { cls: 'taxi', length: 4.4, width: 1.95, height: 1.85, wheelbase: 2.95, wheelRadius: 0.36, maxSpeed: 25, reverseSpeed: 8, accel: 6.2, brake: 15, maxSteer: 0.62, grip: 9 },
};

export interface CarState {
  x: number;
  y: number;
  z: number;
  /** Direção (rad): 0 = sul (+z). */
  heading: number;
  /** Velocidade para a frente (m/s, negativa = ré). */
  speed: number;
  /** Velocidade lateral (m/s, só com o freio de mão). */
  slide: number;
  /** Ângulo atual das rodas dianteiras (rad, positivo = direita). */
  steer: number;
  /** Giro das rodas (rad) — só para o desenho. */
  wheelSpin: number;
  /** Freando (acende as lanternas). */
  braking: boolean;
}

export interface DriveInput {
  /** 0…1 */
  throttle: number;
  /** 0…1 (freio; parado, ré). */
  brake: number;
  /** -1 (esquerda) … 1 (direita). */
  steer: number;
  handbrake: boolean;
}

export const NO_DRIVE: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

/**
 * Comando que para o carro em qualquer sentido (a saída pedida freia sozinha).
 * Não é o mesmo que segurar S: em ré, S acelera a ré; quem freia a ré é o acelerador.
 */
export const stopInput = (c: Pick<CarState, 'speed'>): DriveInput => (c.speed >= 0 ? { ...NO_DRIVE, brake: 1 } : { ...NO_DRIVE, throttle: 1 });

export function createCar(at: { x: number; z: number; heading: number }): CarState {
  return { x: at.x, y: groundHeight(at.x, at.z), z: at.z, heading: at.heading, speed: 0, slide: 0, steer: 0, wheelSpin: 0, braking: false };
}

export const forwardOf = (h: number): Point2 => ({ x: Math.sin(h), z: Math.cos(h) });
/** À direita de quem olha na direção `h` (x leste, z sul). */
export const rightOf = (h: number): Point2 => ({ x: -Math.cos(h), z: Math.sin(h) });

/** Outro corpo que o carro não atravessa (veículo, pedestre): um círculo. */
export interface Body {
  x: number;
  z: number;
  r: number;
}

/** Os três círculos que formam o carro (frente, meio e traseira). */
export function carCircles(c: Pick<CarState, 'x' | 'z' | 'heading'>, spec: CarSpec): Body[] {
  const f = forwardOf(c.heading);
  const r = spec.width / 2;
  const off = spec.length / 2 - r;
  return [-off, 0, off].map((k) => ({ x: c.x + f.x * k, z: c.z + f.z * k, r }));
}

/** Empurra um círculo para fora dos sólidos (no nível do chão). Devolve a normal do empurrão, se houve. */
export function pushOutOfSolids(p: { x: number; z: number }, r: number, solids: Solid[], y = 0.5): Point2 | null {
  let normal: Point2 | null = null;
  for (const s of solids) {
    if ((s.base ?? 0) > y + 1.5 || s.height < y) continue;
    const minX = s.minX - r;
    const maxX = s.maxX + r;
    const minZ = s.minZ - r;
    const maxZ = s.maxZ + r;
    if (p.x <= minX || p.x >= maxX || p.z <= minZ || p.z >= maxZ) continue;
    // Fora do retângulo, perto de uma quina: a quina é redonda (círculo contra retângulo). Quem raspa
    // nela contorna, em vez de ser empurrado para trás por uma quina "quadrada" de raio r.
    const qx = Math.max(s.minX, Math.min(s.maxX, p.x));
    const qz = Math.max(s.minZ, Math.min(s.maxZ, p.z));
    const outside = qx !== p.x || qz !== p.z;
    if (outside) {
      const dx = p.x - qx;
      const dz = p.z - qz;
      const d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d > 1e-9) {
        p.x = qx + (dx / d) * r;
        p.z = qz + (dz / d) * r;
        normal = { x: dx / d, z: dz / d };
        continue;
      }
    }
    const pushes = [p.x - minX, maxX - p.x, p.z - minZ, maxZ - p.z];
    const k = pushes.indexOf(Math.min(...pushes));
    if (k === 0) {
      p.x = minX;
      normal = { x: -1, z: 0 };
    } else if (k === 1) {
      p.x = maxX;
      normal = { x: 1, z: 0 };
    } else if (k === 2) {
      p.z = minZ;
      normal = { x: 0, z: -1 };
    } else {
      p.z = maxZ;
      normal = { x: 0, z: 1 };
    }
  }
  return normal;
}

/** Afasta um círculo de outros corpos. Devolve a normal do contato, se houve. */
export function pushOutOfBodies(p: { x: number; z: number }, r: number, bodies: Body[]): Point2 | null {
  let normal: Point2 | null = null;
  for (const b of bodies) {
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    const d = Math.hypot(dx, dz);
    const min = r + b.r;
    if (d >= min || d < 1e-6) continue;
    const nx = dx / d;
    const nz = dz / d;
    p.x = b.x + nx * min;
    p.z = b.z + nz * min;
    normal = { x: nx, z: nz };
  }
  return normal;
}

const approach = (v: number, target: number, rate: number, dt: number) => (v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt));

/**
 * Avança o carro `dt` segundos. Devolve a intensidade de uma batida (0 = nenhuma),
 * para a câmera reagir de leve.
 */
export function stepCar(c: CarState, spec: CarSpec, input: DriveInput, dt: number, solids: Solid[], bodies: Body[] = []): number {
  // ---- Acelerador, freio e ré (S freia; parado, dá ré) ----------------------------
  let braking = false;
  if (input.throttle > 0 && c.speed > -0.5) {
    const k = 1 - (c.speed / spec.maxSpeed) ** 2;
    c.speed += spec.accel * input.throttle * Math.max(0, k) * dt;
  } else if (input.throttle > 0) {
    c.speed = approach(c.speed, 0, spec.brake * input.throttle, dt);
    braking = true;
  }
  if (input.brake > 0) {
    if (c.speed > 0.5) {
      c.speed = approach(c.speed, 0, spec.brake * input.brake, dt);
      braking = true;
    } else c.speed = approach(c.speed, -spec.reverseSpeed * input.brake, spec.accel * 0.7, dt);
  }
  if (input.throttle === 0 && input.brake === 0) {
    // Rolamento + resistência do ar: o carro "embala" e para sozinho.
    c.speed = approach(c.speed, 0, 1.4 + 0.0016 * c.speed * c.speed, dt);
  }
  if (input.handbrake) {
    c.speed = approach(c.speed, 0, 7, dt);
    braking = true;
  }
  c.speed = Math.max(-spec.reverseSpeed, Math.min(spec.maxSpeed, c.speed));
  c.braking = braking;

  // ---- Volante: sensível à velocidade e com retorno ao centro --------------------
  const maxSteer = spec.maxSteer / (1 + Math.abs(c.speed) / 13);
  const target = Math.max(-1, Math.min(1, input.steer)) * maxSteer;
  c.steer = approach(c.steer, target, input.steer === 0 ? 4.5 : 3, dt);

  // ---- Giro (modelo de bicicleta) e escorregamento só com freio de mão ----------
  const yawRate = (-c.speed * Math.tan(c.steer)) / spec.wheelbase;
  const handbrakeTurn = input.handbrake ? 1.35 : 1;
  c.heading += yawRate * handbrakeTurn * dt;
  if (input.handbrake && Math.abs(c.speed) > 6) c.slide += yawRate * c.speed * 0.18 * dt;
  const grip = input.handbrake ? spec.grip * 0.25 : spec.grip;
  c.slide *= Math.exp(-grip * dt);

  const f = forwardOf(c.heading);
  const r = rightOf(c.heading);
  c.x += (f.x * c.speed - r.x * c.slide) * dt;
  c.z += (f.z * c.speed - r.z * c.slide) * dt;
  c.wheelSpin += (c.speed / spec.wheelRadius) * dt;

  // ---- Colisões --------------------------------------------------------------------
  let impact = 0;
  const circles = carCircles(c, spec);
  for (const circle of circles) {
    const before = { x: circle.x, z: circle.z };
    const n = pushOutOfSolids(circle, circle.r, solids) ?? pushOutOfBodies(circle, circle.r, bodies);
    if (!n) continue;
    c.x += circle.x - before.x;
    c.z += circle.z - before.z;
    // Quanto do movimento ia contra a parede: de frente perde tudo, de raspão perde pouco.
    const into = -(f.x * n.x + f.z * n.z) * Math.sign(c.speed || 1);
    if (into > 0.35) {
      impact = Math.max(impact, Math.abs(c.speed));
      c.speed *= -0.15;
    } else c.speed *= 0.93;
    c.slide *= 0.5;
  }
  c.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.x));
  c.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.z));
  // Acompanha o chão (rua, meio-fio, quadra) com suavidade.
  c.y += (groundHeight(c.x, c.z) - c.y) * (1 - Math.exp(-dt * 12));
  return impact;
}

/**
 * Onde o motorista pode descer: pelo lado esquerdo (porta do motorista), pelo
 * direito, por trás ou pela frente — o primeiro lugar livre de paredes,
 * veículos e limites. `null` se o carro estiver encaixotado.
 */
export function exitSpot(c: Pick<CarState, 'x' | 'z' | 'heading'>, spec: CarSpec, solids: Solid[], bodies: Body[], personRadius = 0.45): Point2 | null {
  const f = forwardOf(c.heading);
  const r = rightOf(c.heading);
  const side = spec.width / 2 + personRadius + 0.35;
  const end = spec.length / 2 + personRadius + 0.4;
  const candidates: Point2[] = [];
  for (const extra of [0, 1.2, 2.6])
    candidates.push(
      { x: c.x - r.x * (side + extra), z: c.z - r.z * (side + extra) },
      { x: c.x + r.x * (side + extra), z: c.z + r.z * (side + extra) },
      { x: c.x - f.x * (end + extra), z: c.z - f.z * (end + extra) },
      { x: c.x + f.x * (end + extra), z: c.z + f.z * (end + extra) },
    );
  return (
    candidates.find(
      (p) =>
        Math.abs(p.x) < WORLD_HALF - 1 &&
        Math.abs(p.z) < WORLD_HALF - 1 &&
        !insideSolid(p.x, p.z, 0.9, personRadius, solids) &&
        bodies.every((b) => Math.hypot(p.x - b.x, p.z - b.z) > b.r + personRadius),
    ) ?? null
  );
}
