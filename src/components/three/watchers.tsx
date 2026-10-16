import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

/**
 * Observa perda real do contexto WebGL (driver, GPU, memória). O listener é
 * removido no desmonte — antes de o R3F forçar a perda do contexto ao
 * descartar o renderer —, então sair da página não é tratado como falha.
 */
export function ContextLossWatcher({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const handler = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener('webglcontextlost', handler);
    return () => el.removeEventListener('webglcontextlost', handler);
  }, [gl, onLost]);
  return null;
}

/** Observa o FPS e avisa uma vez se o desempenho ficar baixo por alguns segundos. */
export function PerformanceWatch({ onLow }: { onLow: () => void }) {
  const acc = useRef({ frames: 0, time: 0, strikes: 0, fired: false });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.fired) return;
    a.frames += 1;
    a.time += dt;
    if (a.time >= 2.5) {
      const fps = a.frames / a.time;
      a.strikes = fps < 28 ? a.strikes + 1 : 0;
      a.frames = 0;
      a.time = 0;
      if (a.strikes >= 2) {
        a.fired = true;
        onLow();
      }
    }
  });
  return null;
}
