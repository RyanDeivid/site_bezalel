import { describe, expect, it } from 'vitest';
import { createLabRuntime } from '@/features/lab/layout';
import { RUN_SPEED, stepMotion, VISITOR_CAMERA, WALK_SPEED } from '@/features/universe/world/visitor';
import { CAMERA_DISTANCE, CAMERA_PITCH } from '@/features/universe/world/runtime';

const free = () => {};

describe('visitante: o mesmo no Universe e no laboratório', () => {
  it('anda, corre com Shift e acelera com peso (não arranca nem para de uma vez)', () => {
    const m = { x: 0, z: 0, vx: 0, vz: 0, heading: 0, stride: 0 };
    stepMotion(m, { x: 1, z: 0, run: false }, 1 / 60, free);
    expect(m.vx).toBeGreaterThan(0);
    expect(m.vx).toBeLessThan(WALK_SPEED);
    for (let i = 0; i < 120; i++) stepMotion(m, { x: 1, z: 0, run: false }, 1 / 60, free);
    expect(m.vx).toBeCloseTo(WALK_SPEED, 3);
    for (let i = 0; i < 120; i++) stepMotion(m, { x: 1, z: 0, run: true }, 1 / 60, free);
    expect(m.vx).toBeCloseTo(RUN_SPEED, 3);
    expect(m.heading).toBeCloseTo(Math.PI / 2, 2);
    expect(m.stride).toBeGreaterThan(0);
  });

  it('parede: o que ela empurra sai da velocidade (desliza ao longo)', () => {
    const m = { x: 0, z: 0, vx: 0, vz: 0, heading: 0, stride: 0 };
    const wall = (p: { x: number; z: number }) => {
      p.x = Math.min(p.x, 0);
    };
    for (let i = 0; i < 60; i++) stepMotion(m, { x: 0.7, z: 0.7, run: false }, 1 / 60, wall);
    expect(m.x).toBe(0);
    expect(Math.abs(m.vx)).toBeLessThan(1e-9);
    expect(m.vz).toBeGreaterThan(1);
  });

  it('o laboratório começa com a câmera do Universe', () => {
    expect(CAMERA_PITCH).toBe(VISITOR_CAMERA.pitch);
    expect(CAMERA_DISTANCE).toBe(VISITOR_CAMERA.distance);
    for (const at of [null, 'vigia' as const]) {
      const rt = createLabRuntime(at);
      expect(rt.camera.pitch).toBe(VISITOR_CAMERA.pitch.start);
      expect(rt.camera.distance).toBe(VISITOR_CAMERA.distance.start);
      expect(rt.player).toMatchObject({ vx: 0, vz: 0, stride: 0 });
    }
  });
});
