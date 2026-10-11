/**
 * A manivela: transforma o gesto circular do visitante em "voltas" (0 → max).
 * Uma volta completa constrói um capítulo. Lógica pura (sem DOM) para poder
 * ser testada; quem desenha e quem ouve o ponteiro é o componente.
 *
 * - Arrastar em círculo soma o ângulo percorrido (horário = avança).
 * - Ao soltar, a manivela segue no embalo (volante) e perde força aos poucos.
 * - Quase parada, ela "encaixa" no capítulo mais próximo na direção do gesto
 *   (detentes magnéticos), para cada capítulo terminar inteiro.
 * - Com movimento reduzido não há embalo nem transição: o encaixe é imediato.
 */

export const TURN = Math.PI * 2;
/** Marcas (cliques da catraca) por volta. */
export const TICKS_PER_TURN = 12;

/** Diferença entre duas leituras de ângulo, levada para (-π, π] (o atan2 salta em ±π). */
export function angleDelta(prev: number, next: number): number {
  let d = next - prev;
  while (d > Math.PI) d -= TURN;
  while (d <= -Math.PI) d += TURN;
  return d;
}

/**
 * Para onde a manivela encaixa ao parar. Na direção do gesto basta ter
 * passado de 20% do capítulo para completá-lo (ou 20% para desfazê-lo, ao
 * voltar); sem direção, vai ao mais próximo.
 */
export function snapTarget(turns: number, direction: number, max: number): number {
  const lo = Math.floor(turns);
  const frac = turns - lo;
  let target: number;
  if (frac < 1e-6) target = lo;
  else if (direction > 0) target = frac > 0.2 ? lo + 1 : lo;
  else if (direction < 0) target = frac < 0.8 ? lo : lo + 1;
  else target = Math.round(turns);
  return Math.min(max, Math.max(0, target));
}

export interface CrankEvents {
  /** Nova posição (em voltas). Chamado a cada quadro de movimento. */
  onChange(turns: number): void;
  /** Cruzou um capítulo inteiro (índice = número da volta). */
  onDetent?(index: number, direction: 1 | -1): void;
  /** Clique da catraca (a cada 1/12 de volta). */
  onTick?(): void;
  /** Parou de vez (encaixada). */
  onRest?(turns: number): void;
}

export interface CrankOptions extends CrankEvents {
  max: number;
  reducedMotion(): boolean;
  /** Relógio e agendador injetáveis (testes). */
  now?: () => number;
  frame?: (cb: (t: number) => void) => number;
  cancelFrame?: (id: number) => void;
}

const FRICTION_MS = 420; // meia-vida aproximada do embalo
const SETTLE_MS = 110; // constante de tempo do encaixe
const STOP_SPEED = 0.00035; // voltas/ms abaixo das quais o embalo vira encaixe
const MAX_SPEED = 0.006; // limite do arremesso (~6 voltas/s)

export class Crank {
  turns = 0;
  private velocity = 0; // voltas/ms
  private direction = 0;
  private dragging = false;
  private target: number | null = null;
  private tween: { from: number; to: number; start: number; duration: number } | null = null;
  private raf = 0;
  private last = 0;
  private lastDrag = 0;
  private readonly opts: CrankOptions;
  private readonly now: () => number;
  private readonly frame: (cb: (t: number) => void) => number;
  private readonly cancel: (id: number) => void;

  constructor(opts: CrankOptions) {
    this.opts = opts;
    this.now = opts.now ?? (() => performance.now());
    this.frame = opts.frame ?? ((cb) => requestAnimationFrame(cb));
    this.cancel = opts.cancelFrame ?? ((id) => cancelAnimationFrame(id));
  }

  get moving(): boolean {
    return this.dragging || this.raf !== 0;
  }

  /** Começo do arraste: segura a manivela (para qualquer embalo). */
  grab(): void {
    this.stop();
    this.dragging = true;
    this.velocity = 0;
    this.lastDrag = this.now();
  }

  /** Arraste: `radians` percorridos desde a última leitura. */
  drag(radians: number): void {
    if (!this.dragging || radians === 0) return;
    const t = this.now();
    const dt = Math.max(1, t - this.lastDrag);
    this.lastDrag = t;
    const before = this.turns;
    this.set(this.turns + radians / TURN);
    const moved = this.turns - before;
    if (moved !== 0) this.direction = Math.sign(moved);
    // Velocidade suavizada: o arremesso usa a média dos últimos movimentos.
    const v = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, moved / dt));
    this.velocity = this.velocity * 0.6 + v * 0.4;
  }

  /** Soltou: segue no embalo (ou encaixa já, com movimento reduzido). */
  release(): void {
    if (!this.dragging) return;
    this.dragging = false;
    // Parado há um tempo antes de soltar = sem arremesso.
    if (this.now() - this.lastDrag > 90) this.velocity = 0;
    if (this.opts.reducedMotion()) {
      this.jump(snapTarget(this.turns, this.direction, this.opts.max));
      return;
    }
    if (Math.abs(this.velocity) < STOP_SPEED) this.target = snapTarget(this.turns, this.direction, this.opts.max);
    this.start();
  }

  /**
   * Gira até uma posição (botões, teclado, "girar para mim"). Com `durationMs`
   * a volta tem ritmo marcado (dá para ver a construção); sem, encaixa rápido.
   */
  goTo(turns: number, durationMs?: number): void {
    const to = Math.min(this.opts.max, Math.max(0, turns));
    this.stop();
    this.dragging = false;
    this.velocity = 0;
    this.direction = Math.sign(to - this.turns);
    if (this.opts.reducedMotion() || to === this.turns) {
      this.jump(to);
      return;
    }
    if (durationMs) this.tween = { from: this.turns, to, start: this.now(), duration: durationMs };
    else this.target = to;
    this.start();
  }

  /** Avança/volta `n` capítulos a partir do capítulo atual. */
  step(n: number, durationMs?: number): void {
    const base = n > 0 ? Math.floor(this.turns + 1e-6) : Math.ceil(this.turns - 1e-6);
    this.goTo(base + n, durationMs ? durationMs * Math.min(3, Math.abs(base + n - this.turns)) : undefined);
  }

  /** Empurrão fino (teclado): fração de volta, sem encaixe forçado. */
  nudge(turns: number): void {
    this.stop();
    this.direction = Math.sign(turns);
    this.set(this.turns + turns);
    this.opts.onRest?.(this.turns);
  }

  destroy(): void {
    this.stop();
  }

  private jump(to: number): void {
    this.stop();
    this.set(to);
    this.opts.onRest?.(this.turns);
  }

  private stop(): void {
    if (this.raf) this.cancel(this.raf);
    this.raf = 0;
    this.target = null;
    this.tween = null;
  }

  private start(): void {
    if (this.raf) return;
    this.last = this.now();
    this.raf = this.frame(this.loop);
  }

  private loop = (): void => {
    const t = this.now();
    const dt = Math.min(48, Math.max(1, t - this.last));
    this.last = t;
    if (this.tween) {
      // Volta com ritmo marcado (entrada e saída suaves).
      const { from, to, start, duration } = this.tween;
      const u = Math.min(1, (t - start) / duration);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      this.set(from + (to - from) * e);
      if (u >= 1) {
        this.raf = 0;
        this.tween = null;
        this.opts.onRest?.(this.turns);
        return;
      }
    } else if (this.target === null) {
      // Embalo do volante.
      this.set(this.turns + this.velocity * dt);
      this.velocity *= Math.exp(-dt / FRICTION_MS);
      const atLimit = this.turns <= 0 || this.turns >= this.opts.max;
      if (atLimit || Math.abs(this.velocity) < STOP_SPEED) {
        this.velocity = 0;
        this.target = snapTarget(this.turns, this.direction, this.opts.max);
      }
    } else {
      // Encaixe suave (aproximação exponencial).
      const next = this.turns + (this.target - this.turns) * (1 - Math.exp(-dt / SETTLE_MS));
      if (Math.abs(this.target - next) < 0.0015) {
        this.set(this.target);
        this.raf = 0;
        this.target = null;
        this.opts.onRest?.(this.turns);
        return;
      }
      this.set(next);
    }
    this.raf = this.frame(this.loop);
  };

  private set(value: number): void {
    const v = Math.min(this.opts.max, Math.max(0, value));
    const prev = this.turns;
    if (v === prev) return;
    this.turns = v;
    const tickPrev = Math.floor(prev * TICKS_PER_TURN + 1e-9);
    const tickNext = Math.floor(v * TICKS_PER_TURN + 1e-9);
    if (tickPrev !== tickNext) this.opts.onTick?.();
    const fullPrev = Math.floor(prev + 1e-9);
    const fullNext = Math.floor(v + 1e-9);
    if (fullNext > fullPrev) this.opts.onDetent?.(fullNext, 1);
    else if (fullNext < fullPrev) this.opts.onDetent?.(fullPrev, -1);
    this.opts.onChange(v);
  }
}

/** Capítulo exibido para uma posição: 0 = início; k = construindo/concluído o capítulo k. */
export function chapterAt(turns: number, total: number): number {
  return Math.min(total, Math.max(0, Math.ceil(turns - 0.02)));
}
