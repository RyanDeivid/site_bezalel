import { describe, expect, it } from 'vitest';
import { ACT_START, ACTS, actAt, areaColor, LOCK_AT, phasesAt, smooth, solveTwoBone } from '@/features/home/forja/timeline';

describe('linha do tempo da Forja', () => {
  it('os atos começam em ordem e cobrem 0 → 1', () => {
    const starts = ACTS.map((id) => ACT_START[id]);
    expect(starts[0]).toBe(0);
    for (let i = 1; i < starts.length; i++) expect(starts[i]!).toBeGreaterThan(starts[i - 1]!);
    expect(starts.at(-1)!).toBeLessThan(1);
  });

  it('actAt devolve o ato de cada trecho, inclusive nas bordas', () => {
    expect(actAt(0)).toBe(0);
    expect(actAt(ACT_START.discover - 0.001)).toBe(0);
    expect(actAt(ACT_START.discover)).toBe(1);
    expect(actAt(ACT_START.verify + 0.01)).toBe(2);
    expect(actAt(ACT_START.connect + 0.01)).toBe(3);
    expect(actAt(ACT_START.build + 0.01)).toBe(4);
    expect(actAt(1)).toBe(5);
  });

  it('as fases da construção só avançam com a rolagem e terminam completas', () => {
    let prev = phasesAt(0);
    for (let p = 0.01; p <= 1.0001; p += 0.01) {
      const cur = phasesAt(p);
      for (const key of ['gather', 'sort', 'connect', 'build', 'enter'] as const) expect(cur[key]).toBeGreaterThanOrEqual(prev[key] - 1e-9);
      prev = cur;
    }
    const end = phasesAt(1);
    expect(end).toMatchObject({ gather: 1, sort: 1, connect: 1, build: 1, enter: 1 });
  });

  it('o encaixe acontece no ato Construir, com as placas quase todas no lugar', () => {
    expect(actAt(LOCK_AT)).toBe(4);
    expect(phasesAt(LOCK_AT).build).toBeGreaterThan(0.9);
  });

  it('os braços entram na triagem e saem antes do mergulho final', () => {
    expect(phasesAt(0.1).arms).toBe(0);
    expect(phasesAt(0.5).arms).toBe(1);
    expect(phasesAt(1).arms).toBe(0);
  });

  it('smooth é limitada a [0, 1]', () => {
    expect(smooth(0.2, 0.4, 0)).toBe(0);
    expect(smooth(0.2, 0.4, 1)).toBe(1);
    expect(smooth(0.2, 0.4, 0.3)).toBeCloseTo(0.5);
  });
});

describe('cinemática inversa dos braços robóticos', () => {
  const forward = (sh: number, el: number, upper: number, fore: number) => {
    const ex = upper * Math.cos(sh);
    const ey = upper * Math.sin(sh);
    return { x: ex + fore * Math.cos(sh + el), y: ey + fore * Math.sin(sh + el), ey };
  };

  it.each([
    [2, 1],
    [3, -0.5],
    [1.2, 2.4],
    [0.5, -1.5],
  ])('a ponta chega exatamente ao alvo alcançável (%s, %s)', (r, h) => {
    const { shoulder, elbow } = solveTwoBone(r, h, 2.05, 1.8);
    const tip = forward(shoulder, elbow, 2.05, 1.8);
    expect(tip.x).toBeCloseTo(r, 6);
    expect(tip.y).toBeCloseTo(h, 6);
  });

  it('cotovelo fica "para cima" (acima da reta ombro→alvo)', () => {
    const { shoulder, elbow } = solveTwoBone(3, 0, 2.05, 1.8);
    expect(forward(shoulder, elbow, 2.05, 1.8).ey).toBeGreaterThan(0);
  });

  it('alvo fora do alcance: o braço estica na direção certa, sem NaN', () => {
    const { shoulder, elbow, reach } = solveTwoBone(10, 0, 2.05, 1.8);
    expect(Number.isFinite(shoulder) && Number.isFinite(elbow)).toBe(true);
    expect(reach).toBeCloseTo(3.85, 3);
    const tip = forward(shoulder, elbow, 2.05, 1.8);
    expect(tip.y).toBeCloseTo(0, 2);
  });
});

describe('cores por área', () => {
  it('são válidas e distintas para áreas vizinhas', () => {
    const a = areaColor(0, 18);
    const b = areaColor(1, 18);
    for (const c of [...a, ...b]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    expect(a).not.toEqual(b);
  });
});
