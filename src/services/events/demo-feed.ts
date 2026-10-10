import type { PlannedEvent } from '@/domain/pipeline';
import type { AgentEvent } from '@/types/domain';
import type { EventService, FeedState } from '../types';

/**
 * Feed de eventos SIMULADO. Reproduz roteiros determinísticos de execução do
 * pipeline em ritmo legível, carimbando cada evento com `environmentMode:
 * 'demo'`. Implementa o mesmo contrato `EventService` que o canal real
 * (SSE/WebSocket) implementará — trocar a fonte não exige mudar a interface.
 */

export interface DemoFeedOptions {
  buildRun: (runIndex: number, now: Date) => { runId: string; events: PlannedEvent[] };
  intervalMs?: number;
  /** Pausa entre execuções consecutivas. */
  runGapMs?: number;
  maxEvents?: number;
  /** Pré-carrega a execução 0 como histórico, com horários retroativos. */
  seedHistory?: boolean;
  now?: () => Date;
}

export class DemoEventFeed implements EventService {
  private state: FeedState = { events: [], connection: 'connecting', environmentMode: 'demo', runId: null, runIndex: 0 };
  private listeners = new Set<() => void>();
  private queue: PlannedEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private seq = 0;
  private readonly opts: Required<Omit<DemoFeedOptions, 'buildRun' | 'now'>> & Pick<DemoFeedOptions, 'buildRun'> & { now: () => Date };

  constructor(options: DemoFeedOptions) {
    this.opts = {
      intervalMs: 2200,
      runGapMs: 6000,
      maxEvents: 240,
      seedHistory: true,
      now: () => new Date(),
      ...options,
    };
  }

  getState = (): FeedState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  start(): void {
    if (this.started) return;
    this.started = true;
    let runIndex = 0;
    if (this.opts.seedHistory) {
      const now = this.opts.now();
      const { runId, events } = this.opts.buildRun(0, now);
      const span = events.length * this.opts.intervalMs;
      const seeded = events.map((e, i) => this.stamp(e, runId, new Date(now.getTime() - span - 60_000 + i * this.opts.intervalMs)));
      this.setState({ events: seeded.slice(-this.opts.maxEvents), runId, runIndex: 0 });
      runIndex = 1;
    }
    this.loadRun(runIndex);
    this.setState({ connection: 'live' });
    this.schedule(this.opts.intervalMs);
  }

  pause(): void {
    if (!this.started || this.state.connection === 'paused') return;
    this.clearTimer();
    this.setState({ connection: 'paused' });
  }

  resume(): void {
    if (!this.started) return this.start();
    if (this.state.connection !== 'paused') return;
    this.setState({ connection: 'live' });
    this.schedule(this.opts.intervalMs);
  }

  /** Para todos os timers (usado em testes e no desmonte da aplicação). */
  dispose(): void {
    this.clearTimer();
    this.listeners.clear();
    this.started = false;
  }

  private loadRun(runIndex: number): void {
    const { runId, events } = this.opts.buildRun(runIndex, this.opts.now());
    this.queue = [...events];
    this.setState({ runId, runIndex });
  }

  private tick = (): void => {
    this.timer = null;
    const next = this.queue.shift();
    if (next) {
      const event = this.stamp(next, this.state.runId ?? 'demo', this.opts.now());
      const events = [...this.state.events, event].slice(-this.opts.maxEvents);
      this.setState({ events });
    }
    if (this.queue.length === 0) {
      this.loadRun(this.state.runIndex + 1);
      this.schedule(this.opts.runGapMs);
    } else {
      this.schedule(this.opts.intervalMs);
    }
  };

  private schedule(ms: number): void {
    this.clearTimer();
    this.timer = setTimeout(this.tick, ms);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private stamp(planned: PlannedEvent, runId: string, at: Date): AgentEvent {
    this.seq += 1;
    return {
      ...planned,
      id: `${runId}-${this.seq}`,
      timestamp: at.toISOString(),
      runId,
      environmentMode: 'demo',
    };
  }

  private setState(patch: Partial<FeedState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
}
