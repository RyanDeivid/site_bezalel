/**
 * Modo apresentação: a câmera percorre a região principal da cidade em
 * tomadas de cinema (travelling pela avenida, órbita no monumento, grua na
 * fachada da sede, travellings laterais no Laboratório e no Centro de
 * Produtos e um plano aéreo), com fusão para o preto entre elas. Cada tomada
 * vai de um enquadramento a outro com aceleração e frenagem suaves.
 *
 * Os caminhos passam só sobre ruas, calçadas largas e a praça — longe dos
 * volumes dos prédios (um teste confere amostrando cada tomada contra os
 * sólidos da cidade). Com movimento reduzido, cada tomada vira um plano fixo
 * e as trocas são cortes secos.
 */

export type CinemaShotId = 'avenue' | 'plaza' | 'hq' | 'lab' | 'products' | 'aerial';

type V3 = readonly [number, number, number];

interface Dolly {
  id: CinemaShotId;
  kind: 'dolly';
  from: V3;
  to: V3;
  lookFrom: V3;
  lookTo: V3;
  fov: number;
  seconds: number;
}

interface Orbit {
  id: CinemaShotId;
  kind: 'orbit';
  center: V3;
  radius: number;
  /** Ângulos (rad) de início e fim, e alturas da câmera no início e no fim. */
  from: number;
  to: number;
  y0: number;
  y1: number;
  fov: number;
  seconds: number;
}

export type CinemaShot = Dolly | Orbit;

export const CINEMA_SHOTS: CinemaShot[] = [
  { id: 'avenue', kind: 'dolly', from: [5, 3.5, 98], to: [3, 4.5, 36], lookFrom: [0, 14, -40], lookTo: [0, 22, -82], fov: 52, seconds: 12 },
  { id: 'plaza', kind: 'orbit', center: [0, 8.5, 0], radius: 25, from: Math.PI * 0.62, to: Math.PI * 1.12, y0: 5, y1: 9.5, fov: 50, seconds: 11 },
  { id: 'hq', kind: 'dolly', from: [14, 5, -49], to: [9, 66, -50], lookFrom: [0, 10, -68], lookTo: [0, 70, -82], fov: 56, seconds: 11 },
  { id: 'lab', kind: 'dolly', from: [44, 9, 32], to: [44, 10, -32], lookFrom: [80, 9, 10], lookTo: [80, 9, -10], fov: 50, seconds: 9 },
  { id: 'products', kind: 'dolly', from: [-44, 10, -30], to: [-44, 8, 30], lookFrom: [-80, 15, -8], lookTo: [-80, 13, 8], fov: 50, seconds: 9 },
  { id: 'aerial', kind: 'dolly', from: [40, 72, 110], to: [40, 102, 178], lookFrom: [0, 22, -24], lookTo: [0, 24, -44], fov: 50, seconds: 12 },
];

/** Tempo de fusão (s) no começo e no fim de cada tomada. */
const FADE = 0.7;
/** Com movimento reduzido: cada plano fixo dura isto. */
const STILL = 6;

export const cinemaLength = (calm: boolean) => CINEMA_SHOTS.reduce((s, c) => s + (calm ? STILL : c.seconds), 0);

const smooth = (k: number) => k * k * (3 - 2 * k);
const mix = (a: V3, b: V3, k: number): [number, number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export interface CinemaPose {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
  /** 0 = imagem cheia, 1 = preto (fusão entre tomadas). */
  fade: number;
  shot: number;
}

/** Enquadramento de uma tomada no ponto `k` (0…1) do movimento. */
export function shotPose(s: CinemaShot, k: number): Omit<CinemaPose, 'fade' | 'shot'> {
  if (s.kind === 'orbit') {
    const a = s.from + (s.to - s.from) * k;
    return { x: s.center[0] + Math.cos(a) * s.radius, y: s.y0 + (s.y1 - s.y0) * k, z: s.center[2] + Math.sin(a) * s.radius, tx: s.center[0], ty: s.center[1], tz: s.center[2], fov: s.fov };
  }
  const [x, y, z] = mix(s.from, s.to, k);
  const [tx, ty, tz] = mix(s.lookFrom, s.lookTo, k);
  return { x, y, z, tx, ty, tz, fov: s.fov };
}

/** Pose da câmera no instante `t` (s) da apresentação, que se repete em ciclo. */
export function cinemaPose(t: number, calm: boolean): CinemaPose {
  let rest = ((t % cinemaLength(calm)) + cinemaLength(calm)) % cinemaLength(calm);
  for (let i = 0; i < CINEMA_SHOTS.length; i++) {
    const s = CINEMA_SHOTS[i]!;
    const len = calm ? STILL : s.seconds;
    if (rest <= len || i === CINEMA_SHOTS.length - 1) {
      if (calm) return { ...shotPose(s, 0.5), fade: 0, shot: i };
      const fade = Math.max(0, 1 - Math.min(rest, len - rest) / FADE);
      return { ...shotPose(s, smooth(Math.min(1, rest / len))), fade, shot: i };
    }
    rest -= len;
  }
  return { ...shotPose(CINEMA_SHOTS[0]!, 0), fade: 0, shot: 0 };
}
