import { describe, expect, it } from 'vitest';
import { angleDelta, chapterAt, Crank, snapTarget, TURN } from '@/features/about/origem/crank';
import { buildGeometry, PALETTE, SHEETS } from '@/features/about/origem/formations';
import { originContent } from '@/features/about/origem/content';

/** Manivela com relógio e quadros controlados pelo teste. */
function rig(reduced = false) {
  let now = 0;
  let queue: Array<(t: number) => void> = [];
  const log = { changes: 0, detents: [] as Array<[number, number]>, ticks: 0, rests: [] as number[] };
  const crank = new Crank({
    max: 7,
    reducedMotion: () => reduced,
    now: () => now,
    frame: (cb) => {
      queue.push(cb);
      return queue.length;
    },
    cancelFrame: () => {
      queue = [];
    },
    onChange: () => log.changes++,
    onDetent: (i, d) => log.detents.push([i, d]),
    onTick: () => log.ticks++,
    onRest: (t) => log.rests.push(t),
  });
  const run = (ms: number, step = 16) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      const q = queue;
      queue = [];
      q.forEach((cb) => cb(now));
    }
  };
  const advance = (ms: number) => {
    now += ms;
  };
  return { crank, log, run, advance };
}

describe('manivela da origem', () => {
  it('ângulo atravessa ±π sem saltar', () => {
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(angleDelta(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(0, 0.5)).toBeCloseTo(0.5);
  });

  it('encaixa na direção do gesto (20% basta para completar ou desfazer)', () => {
    expect(snapTarget(2.25, 1, 7)).toBe(3);
    expect(snapTarget(2.15, 1, 7)).toBe(2);
    expect(snapTarget(2.75, -1, 7)).toBe(2);
    expect(snapTarget(2.85, -1, 7)).toBe(3);
    expect(snapTarget(2.6, 0, 7)).toBe(3);
    expect(snapTarget(6.9, 1, 7)).toBe(7);
    expect(snapTarget(0, -1, 7)).toBe(0);
  });

  it('capítulo exibido: 0 no início, k enquanto constrói e ao concluir k', () => {
    expect(chapterAt(0, 7)).toBe(0);
    expect(chapterAt(0.01, 7)).toBe(0);
    expect(chapterAt(0.5, 7)).toBe(1);
    expect(chapterAt(1, 7)).toBe(1);
    expect(chapterAt(3.4, 7)).toBe(4);
    expect(chapterAt(7, 7)).toBe(7);
  });

  it('arrastar soma voltas, faz cliques na catraca e cruza capítulos', () => {
    const { crank, log, advance } = rig();
    crank.grab();
    for (let i = 0; i < 30; i++) {
      advance(16);
      crank.drag(TURN / 24); // meia volta a cada 12 leituras
    }
    expect(crank.turns).toBeCloseTo(1.25);
    expect(log.ticks).toBe(15);
    expect(log.detents).toEqual([[1, 1]]);
    // Para trás desfaz.
    for (let i = 0; i < 12; i++) {
      advance(16);
      crank.drag(-TURN / 24);
    }
    expect(crank.turns).toBeCloseTo(0.75);
    expect(log.detents.at(-1)).toEqual([1, -1]);
  });

  it('não passa dos limites (0 e 7 voltas)', () => {
    const { crank, advance } = rig();
    crank.grab();
    advance(16);
    crank.drag(-1);
    expect(crank.turns).toBe(0);
    for (let i = 0; i < 100; i++) {
      advance(16);
      crank.drag(1);
    }
    expect(crank.turns).toBe(7);
  });

  it('solto devagar, encaixa no capítulo seguinte na direção do gesto', () => {
    const { crank, log, run, advance } = rig();
    crank.grab();
    advance(16);
    crank.drag(TURN * 0.3);
    advance(200); // parou antes de soltar: sem arremesso
    crank.release();
    run(2000);
    expect(crank.turns).toBe(1);
    expect(log.rests.at(-1)).toBe(1);
  });

  it('arremessado, segue no embalo e para encaixado', () => {
    const { crank, run, advance } = rig();
    crank.grab();
    for (let i = 0; i < 6; i++) {
      advance(16);
      crank.drag(TURN * 0.05);
    }
    crank.release();
    run(4000);
    expect(crank.turns).toBeGreaterThan(0.3);
    expect(Number.isInteger(crank.turns)).toBe(true);
  });

  it('com movimento reduzido, encaixa na hora (sem embalo nem animação)', () => {
    const { crank, log, advance } = rig(true);
    crank.grab();
    advance(16);
    crank.drag(TURN * 0.4);
    crank.release();
    expect(crank.turns).toBe(1);
    crank.goTo(5, 1500);
    expect(crank.turns).toBe(5);
    expect(log.rests).toEqual([1, 5]);
  });

  it('goTo com duração chega ao destino no tempo pedido e avisa ao parar', () => {
    const { crank, log, run } = rig();
    crank.step(1, 1000);
    run(500);
    expect(crank.turns).toBeGreaterThan(0.2);
    expect(crank.turns).toBeLessThan(0.8);
    run(600);
    expect(crank.turns).toBe(1);
    expect(log.rests).toEqual([1]);
    crank.step(-1, 1000);
    run(1200);
    expect(crank.turns).toBe(0);
  });
});

describe('geometria da planta', () => {
  const labels = originContent['pt-BR'].labels;
  const n = 600;
  const name = new Float32Array([-0.5, -0.1, 0, 0, 0.5, 0.1]);
  const geo = buildGeometry(n, name, labels);

  it('tem uma folha por capítulo + a inicial, com todas as partículas', () => {
    expect(geo.sheets).toHaveLength(SHEETS);
    for (const s of geo.sheets) {
      expect(s.points).toHaveLength(n * 2);
      expect(s.colors).toHaveLength(n);
      expect([...s.colors].every((c) => c < PALETTE.length)).toBe(true);
    }
  });

  it('tudo cabe na prancheta (sem partícula fora ou NaN)', () => {
    for (const s of geo.sheets) {
      for (let i = 0; i < n; i++) {
        const x = s.points[i * 2]!;
        const y = s.points[i * 2 + 1]!;
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(Math.abs(x)).toBeLessThanOrEqual(1.3);
        expect(Math.abs(y)).toBeLessThanOrEqual(0.95);
      }
      for (const l of s.labels) {
        expect(Math.abs(l.x)).toBeLessThanOrEqual(1.3);
        expect(Math.abs(l.y)).toBeLessThanOrEqual(0.95);
      }
    }
  });

  it('cada capítulo desenha traços; o cubo final vem do Santo dos Santos', () => {
    geo.sheets.slice(1).forEach((s) => expect(s.segments.length).toBeGreaterThan(0));
    expect(geo.holyEdges).toHaveLength(12);
    expect(geo.markEdges).toHaveLength(12);
    expect(geo.sheets[7]!.segments).toHaveLength(12);
    // Três arestas escondidas (atrás do volume) ficam fracas.
    expect(geo.sheets[7]!.segments.filter((s) => s.faint)).toHaveLength(3);
  });

  it('as medidas do texto aparecem como rótulos da planta', () => {
    const texts = geo.sheets[4]!.labels.map((l) => l.text).join(' | ');
    expect(texts).toContain('100 × 50');
    expect(texts).toContain('5 × 5 × 3');
    expect(texts).toContain('2,5 × 1,5 × 1,5');
  });
});

describe('textos da origem', () => {
  type Shape = Record<string, unknown>;
  const shape = (v: unknown): unknown => {
    if (typeof v === 'function') return 'fn';
    if (Array.isArray(v)) return v.map(shape);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as Shape).sort().map((k) => [k, shape((v as Shape)[k])]));
    return typeof v;
  };

  it('inglês tem a mesma estrutura do português (inclusive 7 capítulos)', () => {
    expect(shape(originContent.en)).toEqual(shape(originContent['pt-BR']));
    expect(originContent['pt-BR'].chapters).toHaveLength(7);
  });

  it('todo capítulo indica a referência da fonte', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      for (const c of originContent[locale].chapters) expect(c.ref.length).toBeGreaterThan(5);
    }
  });
});
