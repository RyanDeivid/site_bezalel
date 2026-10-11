/**
 * Linha do tempo da Forja: a rolagem (0 → 1) atravessa seis atos. Funções
 * puras, compartilhadas pela camada de texto (React) e pela cena 3D.
 */

export const ACTS = ['hero', 'discover', 'verify', 'connect', 'build', 'enter'] as const;
export type ActId = (typeof ACTS)[number];

/** Início de cada ato no progresso total (o último vai até 1). */
export const ACT_START: Record<ActId, number> = {
  hero: 0,
  discover: 0.12,
  verify: 0.34,
  connect: 0.54,
  build: 0.72,
  enter: 0.92,
};

/** Índice do ato ativo para um progresso. */
export function actAt(progress: number): number {
  let index = 0;
  ACTS.forEach((id, i) => {
    if (progress >= ACT_START[id]) index = i;
  });
  return index;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 0 antes de `a`, 1 depois de `b`, curva suave no meio. */
export function smooth(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Progresso de cada etapa da construção, derivado do progresso total. */
export interface Phases {
  /** Partículas chegando das bordas (Descobrir). */
  gather: number;
  /** Triagem: aprovadas vão para a estrutura, reprovadas caem (Verificar). */
  sort: number;
  /** Arestas e conexões se desenham (Conectar). */
  connect: number;
  /** Placas encaixam e a estrutura ganha matéria (Construir). */
  build: number;
  /** Câmera mergulha no núcleo (Entrar). */
  enter: number;
  /** Braços robóticos emergem do piso. */
  arms: number;
}

export function phasesAt(p: number): Phases {
  return {
    gather: smooth(0.06, 0.3, p),
    sort: smooth(0.34, 0.52, p),
    connect: smooth(0.54, 0.7, p),
    build: smooth(0.72, 0.88, p),
    enter: smooth(0.92, 1, p),
    arms: smooth(0.24, 0.4, p) * (1 - smooth(0.9, 0.98, p)),
  };
}

/** Momento do "encaixe" final da estrutura (vibração, clarão). */
export const LOCK_AT = 0.875;

/**
 * Cinemática inversa de dois segmentos (ombro → cotovelo → punho) num plano
 * vertical. `r` é a distância horizontal até o alvo e `h` a altura relativa
 * ao ombro. Devolve os ângulos com o cotovelo "para cima": `shoulder` medido
 * a partir da horizontal e `elbow` como a dobra relativa ao braço (negativa
 * = para baixo). Alvos fora do alcance são aproximados ao limite.
 */
export function solveTwoBone(r: number, h: number, upper: number, fore: number): { shoulder: number; elbow: number; reach: number } {
  const min = Math.abs(upper - fore) + 1e-4;
  const max = upper + fore - 1e-4;
  const d = Math.min(max, Math.max(min, Math.hypot(r, h)));
  const toTarget = Math.atan2(h, r);
  const cosShoulder = (upper * upper + d * d - fore * fore) / (2 * upper * d);
  const cosElbow = (upper * upper + fore * fore - d * d) / (2 * upper * fore);
  const shoulder = toTarget + Math.acos(Math.min(1, Math.max(-1, cosShoulder)));
  const interior = Math.acos(Math.min(1, Math.max(-1, cosElbow)));
  return { shoulder, elbow: -(Math.PI - interior), reach: d };
}

/** Cor por área do conhecimento: matiz distribuído no círculo, estável pela ordem. */
export function areaColor(index: number, total: number): [number, number, number] {
  const h = ((index / Math.max(1, total)) * 360 + 200) % 360;
  return hslToRgb(h, 0.68, 0.62);
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
