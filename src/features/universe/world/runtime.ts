import { placeById, SPAWN, type PlaceId, type Solid } from './city';
import { createCraft, planAutopilot, type Autopilot, type CraftState } from './flight';
import { CAR_SPECS, carCircles, createCar, exitSpot, type Body, type CarClass, type CarState } from './vehicles';
import { createWalker, PERSON_RADIUS, type WalkerState } from './walker';

/**
 * Estado do jogador e dos veículos que ele pode usar — mutável, compartilhado
 * entre a cena, o HUD e a página (muda a cada quadro, fora do estado do React).
 *
 * Máquina de estados do jogador:
 *
 *   a pé ──E perto de um veículo──▶ entrando (0,55 s) ──▶ dirigindo
 *     ▲                                                     │ E
 *     └──────── saindo (0,5 s) ◀── (freia / pousa) ◀────────┘
 *
 * Ao sair, o veículo fica onde parou e o jogador aparece num ponto livre ao
 * lado dele (nunca dentro de parede ou de outro veículo). Se não houver ponto
 * livre, ele continua dentro e o HUD avisa.
 */

export type PlayerMode = 'foot' | 'entering' | 'driving' | 'exiting';

export type PlayerVehicle = { id: string; kind: 'car'; cls: CarClass; paint: string; car: CarState } | { id: string; kind: 'hover'; craft: CraftState };

export type Notice = 'blocked' | 'braking' | 'landing' | null;

export interface UniverseRuntime {
  mode: PlayerMode;
  /** Progresso da transição de entrada/saída (0…1). */
  transition: number;
  walker: WalkerState;
  vehicles: PlayerVehicle[];
  /** Veículo em que o jogador está (entrando, dirigindo ou saindo). */
  active: string | null;
  /** Pediu para sair: o carro freia (ou o voador pousa) e então ele desce. */
  pendingExit: boolean;
  notice: Notice;
  /** Teclas pressionadas (minúsculas). */
  keys: Set<string>;
  /** Joystick de toque: x = lado, y = frente (-1…1). */
  joystick: { x: number; y: number };
  /** Exigido pelo joystick compartilhado (não há destino clicado). */
  target: null;
  /** Botões de toque segurados. */
  buttons: { up: boolean; down: boolean; run: boolean; gas: boolean; brake: boolean; handbrake: boolean };
  /**
   * Câmera: a pé, `yaw` é a direção para onde ela olha (absoluta; o jogador anda relativo a ela);
   * num veículo, `orbit` é um giro extra em volta dele que volta a zero sozinho.
   */
  camera: { yaw: number; pitch: number; distance: number; orbit: number };
  /** Câmera fixa (vista de apresentação / capturas): posição e ponto olhado. Null = câmera do jogo. */
  shot: { x: number; y: number; z: number; tx: number; ty: number; tz: number; fov?: number } | null;
  autopilot: (Autopilot & { place: PlaceId }) | null;
  near: PlaceId | null;
  nearVehicle: string | null;
  /** Corpos do trânsito (atualizados pela cena): o jogador não os atravessa. */
  traffic: Body[];
}

export const CAMERA_PITCH = { min: -0.15, max: 1.2, start: 0.28 };
export const CAMERA_DISTANCE = { min: 2.5, max: 40, start: 6.5 };

/** Veículos estacionados que o jogador pode usar (posição e direção iniciais). */
export const PARKED: Array<{ id: string; kind: 'car'; cls: CarClass; paint: string; x: number; z: number; heading: number } | { id: string; kind: 'hover'; x: number; z: number; heading: number }> = [
  // Parque de chegada: um de cada modelo e o carro voador no heliponto.
  { id: 'aurora', kind: 'car', cls: 'sedan', paint: '#1d3a5f', x: -11, z: 86, heading: Math.PI },
  { id: 'vento', kind: 'car', cls: 'sport', paint: '#b8955a', x: 11, z: 86, heading: Math.PI },
  { id: 'taxi-1', kind: 'car', cls: 'taxi', paint: '#f2e8d5', x: -21, z: 86, heading: Math.PI },
  { id: 'hover', kind: 'hover', x: 0, z: 78, heading: Math.PI },
  // Pela cidade, perto dos edifícios.
  { id: 'marinho', kind: 'car', cls: 'sedan', paint: '#e8e1d2', x: -16, z: -52, heading: Math.PI },
  { id: 'taxi-2', kind: 'car', cls: 'taxi', paint: '#f2e8d5', x: 56, z: -16, heading: -Math.PI / 2 },
  { id: 'grafite', kind: 'car', cls: 'sport', paint: '#2c3440', x: -52, z: 16, heading: Math.PI / 2 },
];

export function createUniverseRuntime(): UniverseRuntime {
  return {
    mode: 'foot',
    transition: 0,
    walker: createWalker(SPAWN),
    vehicles: PARKED.map((p) =>
      p.kind === 'car' ? { id: p.id, kind: 'car', cls: p.cls, paint: p.paint, car: createCar(p) } : { id: p.id, kind: 'hover', craft: createCraft({ x: p.x, y: 1.8, z: p.z, yaw: p.heading }) },
    ),
    active: null,
    pendingExit: false,
    notice: null,
    keys: new Set(),
    joystick: { x: 0, y: 0 },
    target: null,
    buttons: { up: false, down: false, run: false, gas: false, brake: false, handbrake: false },
    camera: { yaw: SPAWN.yaw, pitch: CAMERA_PITCH.start, distance: CAMERA_DISTANCE.start, orbit: 0 },
    shot: null,
    autopilot: null,
    near: null,
    nearVehicle: null,
    traffic: [],
  };
}

export const KEYS = {
  forward: ['w', 'arrowup'],
  back: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
  /** Subir (voador) e freio de mão (carro). */
  up: [' ', 'r'],
  down: ['c', 'q'],
  /** Correr (a pé) e turbo (voador). */
  run: ['shift'],
} as const;

const ALL_KEYS = new Set<string>(Object.values(KEYS).flat());
export const isControlKey = (k: string) => ALL_KEYS.has(k);
const has = (rt: UniverseRuntime, list: readonly string[]) => list.some((k) => rt.keys.has(k));

/** Eixos crus (teclado + joystick de toque), -1…1. */
export function axes(rt: UniverseRuntime) {
  const forward = Math.max(-1, Math.min(1, (has(rt, KEYS.forward) ? 1 : 0) - (has(rt, KEYS.back) ? 1 : 0) + rt.joystick.y));
  const side = Math.max(-1, Math.min(1, (has(rt, KEYS.right) ? 1 : 0) - (has(rt, KEYS.left) ? 1 : 0) + rt.joystick.x));
  const lift = (has(rt, KEYS.up) || rt.buttons.up ? 1 : 0) - (has(rt, KEYS.down) || rt.buttons.down ? 1 : 0);
  return { forward, side, lift, run: has(rt, KEYS.run) || rt.buttons.run, space: has(rt, KEYS.up) };
}

/** Comandos do carro: teclado (W/S/A/D/Espaço) ou pedais e volante de toque. */
export function driveInput(rt: UniverseRuntime) {
  const a = axes(rt);
  return {
    throttle: Math.max(0, a.forward) || (rt.buttons.gas ? 1 : 0),
    brake: Math.max(0, -a.forward) || (rt.buttons.brake ? 1 : 0),
    steer: a.side,
    handbrake: a.space || rt.buttons.handbrake,
  };
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Comandos do carro voador. Aqui as setas ↑/↓ sobem e descem (como Espaço/R e
 * C/Q); W/S aceleram e freiam, e A/D ou ←/→ viram.
 */
export function manualInput(rt: UniverseRuntime) {
  const a = axes(rt);
  const throttle = clamp1((rt.keys.has('w') ? 1 : 0) - (rt.keys.has('s') ? 1 : 0) + rt.joystick.y);
  const lift = clamp1(a.lift + (rt.keys.has('arrowup') ? 1 : 0) - (rt.keys.has('arrowdown') ? 1 : 0));
  return { throttle, turn: a.side, lift, boost: a.run };
}

export const hasManualInput = (i: ReturnType<typeof manualInput>) => i.throttle !== 0 || i.turn !== 0 || i.lift !== 0;

export const vehicleById = (rt: UniverseRuntime, id: string | null) => rt.vehicles.find((v) => v.id === id) ?? null;

/** Posição e direção de um veículo no chão (x, z, direção). */
export function vehiclePose(v: PlayerVehicle): { x: number; y: number; z: number; heading: number } {
  return v.kind === 'car' ? { x: v.car.x, y: v.car.y, z: v.car.z, heading: v.car.heading } : { x: v.craft.x, y: v.craft.y, z: v.craft.z, heading: v.craft.yaw };
}

/** Corpos de um veículo para colisões (o voador só conta quando está perto do chão). */
export function vehicleBodies(v: PlayerVehicle): Body[] {
  if (v.kind === 'car') return carCircles(v.car, CAR_SPECS[v.cls]);
  return v.craft.y < 4 ? [{ x: v.craft.x, z: v.craft.z, r: 1.6 }] : [];
}

/** Até onde dá para entrar num veículo (distância do centro). */
export const enterRange = (v: PlayerVehicle) => (v.kind === 'car' ? CAR_SPECS[v.cls].length / 2 + 1.4 : 3.4);

/** Veículo mais próximo do jogador a pé, ao alcance. */
export function nearestVehicle(rt: UniverseRuntime): PlayerVehicle | null {
  let best: PlayerVehicle | null = null;
  let bestD = Infinity;
  for (const v of rt.vehicles) {
    const p = vehiclePose(v);
    if (v.kind === 'hover' && p.y > 4) continue;
    const d = Math.hypot(p.x - rt.walker.x, p.z - rt.walker.z);
    if (d < enterRange(v) && d < bestD) {
      best = v;
      bestD = d;
    }
  }
  return best;
}

/** Começa a entrar no veículo ao alcance. Devolve true se começou. */
export function tryEnter(rt: UniverseRuntime): boolean {
  if (rt.mode !== 'foot') return false;
  const v = nearestVehicle(rt);
  if (!v) return false;
  rt.mode = 'entering';
  rt.transition = 0;
  rt.active = v.id;
  rt.notice = null;
  rt.walker.vx = 0;
  rt.walker.vz = 0;
  return true;
}

/** Pede para sair: o carro freia (o voador pousa) e o jogador desce quando der. */
export function requestExit(rt: UniverseRuntime): void {
  if (rt.mode === 'driving') rt.pendingExit = true;
}

const ENTER_TIME = 0.55;
const EXIT_TIME = 0.5;

/**
 * Avança as transições e a saída pendente. Devolve os comandos "forçados" do
 * veículo enquanto ele freia ou pousa para a saída (ou null).
 */
export function updatePlayer(rt: UniverseRuntime, dt: number, solids: Solid[]): { brake: boolean; descend: boolean } | null {
  if (rt.mode === 'entering') {
    rt.transition = Math.min(1, rt.transition + dt / ENTER_TIME);
    if (rt.transition >= 1) {
      rt.mode = 'driving';
      rt.transition = 0;
      rt.camera.orbit = 0;
    }
    return null;
  }
  if (rt.mode === 'exiting') {
    rt.transition = Math.min(1, rt.transition + dt / EXIT_TIME);
    if (rt.transition >= 1) {
      rt.mode = 'foot';
      rt.transition = 0;
      rt.active = null;
    }
    return null;
  }
  if (rt.mode !== 'driving' || !rt.pendingExit) return null;
  const v = vehicleById(rt, rt.active);
  if (!v) {
    rt.mode = 'foot';
    rt.pendingExit = false;
    return null;
  }
  if (v.kind === 'car' && Math.abs(v.car.speed) > 1.2) {
    rt.notice = 'braking';
    return { brake: true, descend: false };
  }
  if (v.kind === 'hover' && v.craft.y > 2.4) {
    rt.notice = 'landing';
    return { brake: true, descend: true };
  }
  const others = rt.vehicles.filter((o) => o !== v).flatMap(vehicleBodies);
  const spot =
    v.kind === 'car'
      ? exitSpot(v.car, CAR_SPECS[v.cls], solids, [...others, ...rt.traffic])
      : exitSpot({ x: v.craft.x, z: v.craft.z, heading: v.craft.yaw }, { ...CAR_SPECS.sedan, width: 3.2, length: 5.2 }, solids, [...others, ...rt.traffic]);
  rt.pendingExit = false;
  if (!spot) {
    rt.notice = 'blocked';
    return null;
  }
  const pose = vehiclePose(v);
  if (v.kind === 'car') {
    v.car.speed = 0;
    v.car.slide = 0;
  } else {
    v.craft.speed = 0;
    v.craft.climb = 0;
    rt.autopilot = null;
  }
  rt.walker.x = spot.x;
  rt.walker.z = spot.z;
  rt.walker.y = pose.y;
  rt.walker.vx = 0;
  rt.walker.vz = 0;
  rt.walker.heading = Math.atan2(spot.x - pose.x, spot.z - pose.z);
  // A câmera a pé começa olhando na mesma direção em que se dirigia.
  rt.camera.yaw = pose.heading;
  rt.mode = 'exiting';
  rt.transition = 0;
  rt.notice = null;
  return null;
}

/** O jogador está "no mundo" como pedestre (para colisões e para o trânsito respeitar)? */
export const onFoot = (rt: UniverseRuntime) => rt.mode === 'foot' || rt.mode === 'exiting';

/**
 * Ir até um local pelo menu "Locais":
 *  - no carro voador, o piloto automático voa até lá (`'flying'`);
 *  - a pé ou num carro, transporte rápido: o jogador aparece a pé em frente ao
 *    local (`'travelled'`) e o carro fica estacionado onde estava.
 * Com `instant` (movimento reduzido), o carro voador também vai direto.
 */
export function goToPlace(rt: UniverseRuntime, id: PlaceId, solids: Solid[], instant: boolean): 'flying' | 'travelled' {
  const p = placeById(id);
  const v = vehicleById(rt, rt.active);
  if (rt.mode === 'driving' && v?.kind === 'hover') {
    const to = { x: p.pad.x, z: p.pad.z, y: p.padAltitude, yaw: p.padHeading };
    if (instant) {
      Object.assign(v.craft, { x: to.x, y: to.y, z: to.z, yaw: to.yaw, speed: 0, climb: 0, turnRate: 0 });
      rt.autopilot = null;
      return 'travelled';
    }
    rt.autopilot = { ...planAutopilot(v.craft, to, solids), place: id };
    return 'flying';
  }
  if (v?.kind === 'car') {
    v.car.speed = 0;
    v.car.slide = 0;
  }
  rt.mode = 'foot';
  rt.active = null;
  rt.pendingExit = false;
  rt.transition = 0;
  rt.notice = null;
  // Um pouco antes do heliponto, de frente para a entrada.
  const back = 4;
  const x = p.pad.x - Math.sin(p.padHeading) * back;
  const z = p.pad.z - Math.cos(p.padHeading) * back;
  Object.assign(rt.walker, { x, z, vx: 0, vz: 0, heading: p.padHeading });
  rt.camera.yaw = p.padHeading;
  rt.camera.orbit = 0;
  return 'travelled';
}

/** Some com o aviso atual (o HUD o esconde depois de alguns segundos). */
export function clearNotice(rt: UniverseRuntime) {
  rt.notice = null;
}

/**
 * Gancho de inspeção para os testes de navegador (só com
 * `localStorage['bz-universe-debug'] = '1'`): lê o estado e posiciona o
 * jogador — os testes validam entrar, dirigir e sair sem depender de pilotar
 * com a renderização lenta do navegador de teste. Devolve a função que o remove.
 */
export function attachDebug(rt: UniverseRuntime): () => void {
  const api = {
    state: () => ({
      mode: rt.mode,
      active: rt.active,
      walker: { x: rt.walker.x, y: rt.walker.y, z: rt.walker.z },
      vehicles: rt.vehicles.map((v) => ({ id: v.id, ...vehiclePose(v), speed: v.kind === 'car' ? v.car.speed : v.craft.speed })),
      traffic: rt.traffic.length,
      nearVehicle: rt.nearVehicle,
      notice: rt.notice,
    }),
    placeWalker: (x: number, z: number, yaw = rt.camera.yaw) => {
      Object.assign(rt.walker, { x, z, vx: 0, vz: 0 });
      rt.camera.yaw = yaw;
    },
    /** Câmera fixa para capturas (null volta à câmera do jogo). */
    shot: (s: UniverseRuntime['shot']) => {
      rt.shot = s;
    },
    placeVehicle: (id: string, x: number, z: number, heading: number) => {
      const v = vehicleById(rt, id);
      if (v?.kind === 'car') Object.assign(v.car, { x, z, heading, speed: 0, slide: 0 });
      if (v?.kind === 'hover') Object.assign(v.craft, { x, z, yaw: heading, speed: 0 });
    },
  };
  (window as unknown as { __bzUniverse?: typeof api }).__bzUniverse = api;
  return () => {
    delete (window as unknown as { __bzUniverse?: typeof api }).__bzUniverse;
  };
}

/** Devolve o controle (botão "Assumir o controle" do piloto automático). */
export function cancelAutopilot(rt: UniverseRuntime) {
  rt.autopilot = null;
}

export { PERSON_RADIUS };
