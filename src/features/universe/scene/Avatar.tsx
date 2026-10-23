import { useMemo } from 'react';
import { vehicleById, vehiclePose, type UniverseRuntime } from '../world/runtime';
import { CAR_SPECS, rightOf } from '../world/vehicles';
import { renderWalker, type Pose } from '../world/simulation';
import { walkerSpeed, WALK_SPEED } from '../world/walker';
import { VisitorBody, type VisitorFrame } from './VisitorBody';

/**
 * O visitante a pé: o mesmo robô humanoide articulado do laboratório (pernas,
 * braços e mãos animados pela passada real), com detalhes dourados — um
 * "explorador Bezalel". Ao entrar num veículo, caminha até a porta e encolhe
 * para dentro dele; ao sair, faz o caminho inverso (sem teletransporte seco).
 */
export function Avatar({ runtime, effects }: { runtime: UniverseRuntime; effects: boolean }) {
  const pose3 = useMemo<Pose>(() => ({ x: 0, y: 0, z: 0, heading: 0 }), []);
  const frame = (dt: number, out: VisitorFrame) => {
    const w = runtime.walker;
    const mode = runtime.mode;
    const v = vehicleById(runtime, runtime.active);
    // A pose desenhada fica entre os dois últimos passos da simulação (passo fixo).
    const drawn = renderWalker(runtime, runtime.clock, pose3);
    out.x = drawn.x;
    out.z = drawn.z;
    out.y = drawn.y;
    out.heading = drawn.heading;
    out.scale = 1;
    if ((mode === 'entering' || mode === 'exiting') && v) {
      // Porta do motorista: lado esquerdo do veículo.
      const p = vehiclePose(v);
      const half = v.kind === 'car' ? CAR_SPECS[v.cls].width / 2 : 1.4;
      const r = rightOf(p.heading);
      const door = { x: p.x - r.x * half, z: p.z - r.z * half };
      // Entrando: do ponto onde estava até a porta, encolhendo; saindo: o inverso.
      const k = mode === 'entering' ? runtime.transition : 1 - runtime.transition;
      out.x = w.x + (door.x - w.x) * k;
      out.z = w.z + (door.z - w.z) * k;
      out.y = w.y + (p.y - w.y) * k;
      out.heading = Math.atan2(door.x - w.x, door.z - w.z) || out.heading;
      out.scale = 1 - Math.max(0, (k - 0.55) / 0.45);
    } else if (mode === 'driving') out.scale = 0.001;
    const speed = mode === 'foot' ? walkerSpeed(w) : mode === 'driving' ? 0 : 1.2;
    out.walk = Math.min(1, speed / WALK_SPEED);
    out.phase = mode === 'foot' ? w.stride : out.phase + dt * 6;
  };
  return <VisitorBody effects={effects} frame={frame} />;
}
