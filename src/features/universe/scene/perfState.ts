import { readSession } from '@/lib/storage';

/** Leituras compartilhadas com o AutoQuality (atualizadas a cada janela de ~1 s). */
export interface PerfState {
  windows: number;
  /** Fração de quadros acima de 22 ms (abaixo de ~45 fps) na última janela. */
  lateShare: number;
  /** Fração de quadros acima de 18,5 ms (perdendo um quadro de 60 Hz) na última janela. */
  tightShare: number;
  /** A resolução já está no piso (ou travada nele porque o gargalo é o processador). */
  atFloor: boolean;
  /** A resolução está no máximo do nível. */
  atMax: boolean;
  /** Trabalho real do quadro (ms, média da janela): CPU (lógica + envio do desenho) e o quadro inteiro até a GPU terminar (null até a 1ª medida). */
  cpuMs: number;
  frameMs: number | null;
  /**
   * Quadros por segundo perseguidos: 60, ou 30 estáveis num celular que não sustenta 60 (ver `FramePacer`).
   * Os atrasos e as folgas são medidos contra esse alvo.
   */
  target: 60 | 30;
  /** O aparelho pode usar o ritmo de 30 (celular com placa de vídeo). */
  paceable: boolean;
  /** Baixar a resolução não aliviou o quadro: quem o segura é o processador (a resolução travou). */
  cpuBound: boolean;
}

export const createPerfState = (paceable = false): PerfState => ({ windows: 0, lateShare: 0, tightShare: 0, atFloor: false, atMax: true, cpuMs: 0, frameMs: null, target: paceable && readSession(PACE_KEY) === '30' ? 30 : 60, paceable, cpuBound: false });

/** O aparelho já se firmou em 30 quadros por segundo nesta sessão: as próximas cenas começam assim. */
export const PACE_KEY = 'bz-universe-pace';

/** Orçamento de um quadro no alvo atual (ms). */
export const budgetMs = (perf?: PerfState) => 1000 / (perf?.target ?? 60);

/** Resolução em que o aparelho se firmou, por nível, guardada na sessão: a próxima entrada já começa nela. */
export const SETTLED_KEY = (level: string) => `bz-universe-dpr-${level}`;
export function settledDpr(level: string): number | null {
  const v = Number(readSession(SETTLED_KEY(level)));
  return Number.isFinite(v) && v > 0 ? v : null;
}
