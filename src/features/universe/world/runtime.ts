import { SPAWN, type PlaceId } from './city';
import { createCraft, type Autopilot, type CraftState } from './flight';

/**
 * Estado mutável compartilhado entre a cena, o HUD e a página — muda a cada
 * quadro, então fica fora do estado do React (o mesmo padrão do laboratório).
 */
export interface UniverseRuntime {
  craft: CraftState;
  /** Teclas pressionadas (minúsculas). */
  keys: Set<string>;
  /** Joystick de toque: x = virar, y = acelerar (-1…1). */
  joystick: { x: number; y: number };
  /** Exigido pelo joystick compartilhado (não há destino clicado no voo). */
  target: null;
  /** Botões de toque segurados. */
  buttons: { up: boolean; down: boolean; boost: boolean };
  /** Câmera: giro em volta do carro (rad, além da guinada dele), inclinação e distância. */
  camera: { orbit: number; pitch: number; distance: number };
  autopilot: (Autopilot & { place: PlaceId }) | null;
  near: PlaceId | null;
}

export const CAMERA_PITCH = { min: 0.05, max: 1.2, start: 0.32 };
export const CAMERA_DISTANCE = { min: 7, max: 40, start: 15 };

export function createUniverseRuntime(): UniverseRuntime {
  return {
    craft: createCraft(SPAWN),
    keys: new Set(),
    joystick: { x: 0, y: 0 },
    target: null,
    buttons: { up: false, down: false, boost: false },
    camera: { orbit: 0, pitch: CAMERA_PITCH.start, distance: CAMERA_DISTANCE.start },
    autopilot: null,
    near: null,
  };
}

export const KEYS = {
  forward: ['w', 'arrowup'],
  back: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
  up: [' ', 'r'],
  down: ['c', 'f'],
  boost: ['shift'],
} as const;

const ALL_KEYS = new Set<string>(Object.values(KEYS).flat());
export const isFlightKey = (k: string) => ALL_KEYS.has(k);

/** Comandos de voo a partir do teclado, do joystick e dos botões de toque. */
export function manualInput(rt: UniverseRuntime) {
  const has = (list: readonly string[]) => list.some((k) => rt.keys.has(k));
  let throttle = (has(KEYS.forward) ? 1 : 0) - (has(KEYS.back) ? 1 : 0) + rt.joystick.y;
  let turn = (has(KEYS.right) ? 1 : 0) - (has(KEYS.left) ? 1 : 0) + rt.joystick.x;
  const lift = (has(KEYS.up) || rt.buttons.up ? 1 : 0) - (has(KEYS.down) || rt.buttons.down ? 1 : 0);
  throttle = Math.max(-1, Math.min(1, throttle));
  turn = Math.max(-1, Math.min(1, turn));
  return { throttle, turn, lift, boost: has(KEYS.boost) || rt.buttons.boost };
}

export const hasManualInput = (i: ReturnType<typeof manualInput>) => i.throttle !== 0 || i.turn !== 0 || i.lift !== 0;

/** Devolve o controle ao visitante (botão "Assumir o controle"). */
export function cancelAutopilot(rt: UniverseRuntime) {
  rt.autopilot = null;
}
