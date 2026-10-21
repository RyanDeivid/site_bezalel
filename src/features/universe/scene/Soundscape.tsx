import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { driveInput, manualInput, vehicleById, type UniverseRuntime } from '../world/runtime';
import { walkerSpeed } from '../world/walker';
import { createUniverseAudio } from './audio';

/**
 * Liga o som (audio.ts) ao jogo: a cada quadro lê o modo, a velocidade, o
 * acelerador, a altura e o carro do trânsito mais perto da câmera; toca os
 * passos no ritmo da passada e a porta ao entrar e sair. O contexto de áudio
 * nasce depois do clique de "Explorar em 3D" (o navegador já deixa tocar) e é
 * retomado no próximo toque ou tecla, se preciso.
 */
export function Soundscape({ runtime, enabled, debug }: { runtime: UniverseRuntime; enabled: boolean; /** Expõe o estado e o nível do som em `window.__bzUniverseAudio` (testes). */ debug?: boolean }) {
  const audio = useMemo(() => createUniverseAudio(), []);
  useEffect(() => () => audio?.dispose(), [audio]);
  useEffect(() => {
    if (!debug || !audio) return;
    const w = window as unknown as { __bzUniverseAudio?: { state: () => string; rms: () => number } };
    w.__bzUniverseAudio = { state: () => audio.ctx.state, rms: () => audio.rms() };
    return () => {
      delete w.__bzUniverseAudio;
    };
  }, [audio, debug]);
  useEffect(() => audio?.setEnabled(enabled), [audio, enabled]);
  useEffect(() => {
    if (!audio) return;
    const resume = () => audio.resume();
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
  }, [audio]);
  const st = useRef({ mode: runtime.mode, step: 0 });
  const tmp = useMemo(() => ({ right: new THREE.Vector3(), to: new THREE.Vector3() }), []);
  useFrame(({ camera }) => {
    if (!audio || !enabled) return;
    const s = st.current;
    // Porta: ao começar a entrar e ao começar a sair.
    if (runtime.mode !== s.mode) {
      if (runtime.mode === 'entering' || runtime.mode === 'exiting') audio.door();
      s.mode = runtime.mode;
    }
    for (const cue of runtime.sounds.splice(0)) if (cue === 'chime') audio.chime();
    const v = vehicleById(runtime, runtime.active);
    const inVehicle = runtime.mode === 'driving' && v;
    let speed: number;
    let throttle = 0;
    let altitude = 0;
    if (inVehicle && v.kind === 'car') {
      speed = Math.abs(v.car.speed);
      throttle = driveInput(runtime).throttle;
    } else if (inVehicle && v.kind === 'hover') {
      speed = Math.abs(v.craft.speed);
      const m = manualInput(runtime);
      throttle = Math.min(1, Math.max(Math.abs(m.throttle), Math.abs(m.lift) * 0.8, speed / 50, 0.15));
      altitude = v.craft.y;
    } else {
      speed = walkerSpeed(runtime.walker);
      // Passos: um a cada meia volta da passada (cada perna).
      const k = Math.floor(runtime.walker.stride / Math.PI);
      if (k !== s.step) {
        if (speed > 0.6) audio.step(speed > 3.2);
        s.step = k;
      }
    }
    // Carro do trânsito mais perto da câmera (os corpos de colisão do trânsito: três por carro).
    let best = Infinity;
    let pan = 0;
    tmp.right.setFromMatrixColumn(camera.matrixWorld, 0);
    for (const b of runtime.traffic) {
      const d = Math.hypot(b.x - camera.position.x, b.z - camera.position.z);
      if (d < best) {
        best = d;
        tmp.to.set(b.x - camera.position.x, 0, b.z - camera.position.z).normalize();
        pan = tmp.to.dot(tmp.right);
      }
    }
    audio.update({
      mode: inVehicle ? (v.kind === 'car' ? 'car' : 'hover') : 'foot',
      carClass: inVehicle && v.kind === 'car' ? v.cls : undefined,
      speed,
      throttle,
      altitude,
      traffic: best < 60 ? { distance: best, pan } : null,
    });
  });
  return null;
}
