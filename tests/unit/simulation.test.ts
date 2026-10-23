import { describe, expect, it } from 'vitest';
import { createUniverseRuntime } from '@/features/universe/world/runtime';
import { advance, capturePoses, createClock, MAX_STEPS, renderWalker, SIM_STEP, type Pose } from '@/features/universe/world/simulation';

const pose = (): Pose => ({ x: 0, y: 0, z: 0, heading: 0 });

describe('Universe: simulação em passo fixo', () => {
  it('o mesmo tempo dá o mesmo número de passos, a 30, 60 ou 144 quadros por segundo', () => {
    for (const fps of [30, 60, 144]) {
      const clock = createClock();
      let steps = 0;
      for (let i = 0; i < fps * 2; i++) steps += advance(clock, 1 / fps, () => undefined);
      // 2 s de jogo = 120 passos de 1/60 s (±1 pelo resto acumulado).
      expect(Math.abs(steps - 120)).toBeLessThanOrEqual(1);
    }
  });

  it('num aparelho lento (5 quadros/s) o mundo anda no tempo certo, não em câmera lenta', () => {
    const clock = createClock();
    let simulated = 0;
    for (let i = 0; i < 10; i++) advance(clock, 0.2, (dt) => (simulated += dt));
    expect(simulated).toBeCloseTo(2, 1);
  });

  it('um travamento longo não vira uma corrida sem fim (no máximo 15 passos num quadro)', () => {
    const clock = createClock();
    expect(advance(clock, 3, () => undefined)).toBe(MAX_STEPS);
    expect(clock.acc).toBeLessThanOrEqual(SIM_STEP);
  });

  it('o desenho fica entre os dois últimos passos; um teletransporte não é interpolado', () => {
    const rt = createUniverseRuntime();
    const clock = createClock();
    rt.walker.x = 0;
    capturePoses(rt);
    rt.walker.x = 0.1;
    clock.alpha = 0.5;
    expect(renderWalker(rt, clock, pose()).x).toBeCloseTo(0.05, 6);
    capturePoses(rt);
    rt.walker.x = 40;
    expect(renderWalker(rt, clock, pose()).x).toBe(40);
  });
});
