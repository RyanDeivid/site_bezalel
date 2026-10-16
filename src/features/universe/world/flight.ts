import { CEILING, MIN_ALTITUDE, WORLD_HALF, type Solid } from './city';

/**
 * Voo do carro do visitante — cinemática simples, sem motor de física:
 * acelera e freia para a frente/trás, gira no próprio eixo (guinada), sobe e
 * desce. Tudo amortecido (resposta exponencial), então o carro desliza e
 * para com suavidade. Colisão por volumes: o carro (uma esfera de raio
 * `CRAFT_RADIUS`) não entra em nenhum `Solid` da cidade — é empurrado para
 * fora pela face mais próxima, ou pousa no telhado se vier de cima.
 *
 * Funções puras sobre um estado mutável (sem alocar por quadro).
 */

export interface CraftState {
  x: number;
  y: number;
  z: number;
  /** Guinada (rad): 0 = olhando para o sul (+z), π = norte. */
  yaw: number;
  /** Velocidade para a frente (m/s, negativa = ré). */
  speed: number;
  /** Velocidade vertical (m/s). */
  climb: number;
  /** Velocidade angular de guinada (rad/s) — a cena inclina o carro com ela. */
  turnRate: number;
}

export interface CraftInput {
  /** -1 (ré) … 1 (frente). */
  throttle: number;
  /** -1 (esquerda) … 1 (direita). */
  turn: number;
  /** -1 (descer) … 1 (subir). */
  lift: number;
  /** Turbo (Shift ou botão): mais velocidade máxima. */
  boost: boolean;
}

export const CRAFT_RADIUS = 2.2;
export const MAX_SPEED = 26;
const BOOST_SPEED = 42;
const REVERSE_SPEED = 10;
const MAX_CLIMB = 11;
const MAX_TURN = 1.7;

export function createCraft(at: { x: number; y: number; z: number; yaw: number }): CraftState {
  return { x: at.x, y: at.y, z: at.z, yaw: at.yaw, speed: 0, climb: 0, turnRate: 0 };
}

const approach = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));

/** Mantém o ponto fora de todos os sólidos (e dentro da cidade). Devolve true se houve contato. */
export function resolveCollisions(c: { x: number; y: number; z: number }, solids: Solid[], radius = CRAFT_RADIUS, prevY = c.y): boolean {
  let hit = false;
  for (const s of solids) {
    if (c.y - radius >= s.height) continue;
    const minX = s.minX - radius;
    const maxX = s.maxX + radius;
    const minZ = s.minZ - radius;
    const maxZ = s.maxZ + radius;
    if (c.x <= minX || c.x >= maxX || c.z <= minZ || c.z >= maxZ) continue;
    hit = true;
    // Vindo de cima (estava acima do telhado no passo anterior): pousa no telhado.
    if (prevY - radius >= s.height - 0.5) {
      c.y = s.height + radius;
      continue;
    }
    // Senão, sai pela face mais próxima.
    const pushes = [c.x - minX, maxX - c.x, c.z - minZ, maxZ - c.z];
    const k = pushes.indexOf(Math.min(...pushes));
    if (k === 0) c.x = minX;
    else if (k === 1) c.x = maxX;
    else if (k === 2) c.z = minZ;
    else c.z = maxZ;
  }
  c.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.x));
  c.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.z));
  c.y = Math.max(MIN_ALTITUDE, Math.min(CEILING, c.y));
  return hit;
}

/** Avança o voo `dt` segundos. */
export function stepCraft(c: CraftState, input: CraftInput, dt: number, solids: Solid[]): boolean {
  const top = input.boost ? BOOST_SPEED : MAX_SPEED;
  const target = input.throttle >= 0 ? input.throttle * top : input.throttle * REVERSE_SPEED;
  // Acelera devagar, freia mais rápido.
  c.speed = approach(c.speed, target, Math.abs(target) > Math.abs(c.speed) ? 1.6 : 2.6, dt);
  // Gira menos em alta velocidade (curvas largas, mais estáveis).
  const turnScale = 1 - Math.min(0.45, Math.abs(c.speed) / 90);
  c.turnRate = approach(c.turnRate, -input.turn * MAX_TURN * turnScale, 6, dt);
  c.yaw += c.turnRate * dt;
  c.climb = approach(c.climb, input.lift * MAX_CLIMB, 4, dt);
  const prevY = c.y;
  c.x += Math.sin(c.yaw) * c.speed * dt;
  c.z += Math.cos(c.yaw) * c.speed * dt;
  c.y += c.climb * dt;
  const hit = resolveCollisions(c, solids, CRAFT_RADIUS, prevY);
  if (hit) c.speed *= 0.6;
  return hit;
}

export interface Autopilot {
  x: number;
  z: number;
  y: number;
  yaw: number;
  /** Altitude de cruzeiro do trajeto (acima das torres do caminho). */
  cruise: number;
}

/** Diferença angular em (-π, π]. */
export const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Maior altura dos sólidos que cruzam o segmento (amostrado a cada 4 m, com folga lateral). */
export function obstacleHeightAlong(ax: number, az: number, bx: number, bz: number, solids: Solid[], margin = 6): number {
  const len = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(len / 4));
  let h = 0;
  for (let i = 0; i <= steps; i++) {
    const x = ax + ((bx - ax) * i) / steps;
    const z = az + ((bz - az) * i) / steps;
    for (const s of solids) if (x > s.minX - margin && x < s.maxX + margin && z > s.minZ - margin && z < s.maxZ + margin) h = Math.max(h, s.height);
  }
  return h;
}

/** Planeja um voo até um ponto: sobe acima de tudo no caminho, vai reto e desce no destino. */
export function planAutopilot(c: CraftState, to: { x: number; z: number; y: number; yaw: number }, solids: Solid[]): Autopilot {
  const over = obstacleHeightAlong(c.x, c.z, to.x, to.z, solids);
  return { ...to, cruise: Math.min(CEILING - 4, Math.max(to.y, c.y, over + 8)) };
}

/**
 * Comandos do piloto automático para este instante. Devolve `null` ao chegar
 * (perto do ponto, devagar e quase alinhado).
 */
export function autopilotInput(c: CraftState, ap: Autopilot): CraftInput | null {
  const dx = ap.x - c.x;
  const dz = ap.z - c.z;
  const dist = Math.hypot(dx, dz);
  // Sobe antes de seguir se houver prédios no caminho; desce perto do destino.
  const wantY = dist > 30 ? ap.cruise : ap.y + (ap.cruise - ap.y) * Math.max(0, (dist - 4) / 26);
  const lift = Math.max(-1, Math.min(1, (wantY - c.y) / 5));
  if (dist <= SETTLE_RADIUS) {
    // Chegou ao ponto: para, alinha com a direção final e acerta a altura.
    const err = angleDiff(ap.yaw, c.yaw);
    if (Math.abs(err) < 0.1 && Math.abs(ap.y - c.y) < 1.2 && Math.abs(c.speed) < 1.5) return null;
    return { throttle: 0, turn: Math.max(-1, Math.min(1, -err * 2)), lift, boost: false };
  }
  const err = angleDiff(Math.atan2(dx, dz), c.yaw);
  const turn = Math.max(-1, Math.min(1, -err * 2.2));
  // Só acelera quando já está apontado; a velocidade cai com a distância (chega devagar).
  const aligned = Math.max(0, Math.cos(err)) ** 3;
  const climbing = c.y < wantY - 3 && dist > 30;
  const throttle = Math.min(1, Math.max(0.08, dist / 30)) * aligned * (climbing ? 0.25 : 1);
  return { throttle, turn, lift, boost: false };
}

/** Distância do destino em que o piloto para de avançar e só se alinha. */
const SETTLE_RADIUS = 3.5;
