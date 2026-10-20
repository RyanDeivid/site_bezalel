import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerfState } from './perfState';

/** Quadro "atrasado": abaixo de ~45 fps. */
const LATE_MS = 22;
/** Quadro "justo": acima de um quadro de 60 Hz com folga para a variação normal. */
const TIGHT_MS = 18.5;

/**
 * Resolução adaptativa: mantém o jogo liso mudando só a resolução de desenho
 * (`dpr`), sem trocar o nível de qualidade.
 *
 * A meta é 60 fps, qualquer que seja a tela (em 120/144 Hz, perseguir a taxa
 * da tela sacrificaria nitidez sem necessidade). A cada janela de ~1 s conta os
 * quadros atrasados (> 22 ms): mais de 15% → desce a resolução um degrau.
 * Quatro janelas seguidas com quase nenhum quadro acima de 18,5 ms → sobe um
 * degrau e testa; se passar a atrasar, volta. Se descer não melhorou nada, quem
 * segura o quadro é o processador (não a placa de vídeo): para de descer,
 * porque só perderia nitidez. O primeiro quadro depois de a aba voltar do
 * segundo plano é ignorado (o intervalo dele é o tempo em que ela ficou oculta).
 */
export function AdaptiveResolution({ min, max, perf }: { min: number; max: number; perf?: PerfState }) {
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);
  const st = useRef({ init: false, dpr: max, frames: 0, late: 0, tight: 0, time: 0, calm: 0, cooldown: 2, lastLateShare: 0, lastStep: '' as '' | 'down' | 'up', floor: min, skip: false });
  useEffect(() => {
    const onVisibility = () => void (st.current.skip = true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useFrame((_, dt) => {
    const s = st.current;
    if (!s.init) {
      s.init = true;
      s.dpr = gl.getPixelRatio();
    }
    const ms = dt * 1000;
    // Aba voltando do segundo plano: o intervalo é o tempo oculta, não custo de quadro. Um quadro longo
    // isolado (coleta de lixo) conta como um atraso só e pesa pouco na janela; num aparelho lento, todos contam.
    if (s.skip) {
      s.skip = false;
      return;
    }
    s.frames++;
    s.time += dt;
    if (ms > LATE_MS) s.late++;
    if (ms > TIGHT_MS) s.tight++;
    if (s.time < 1) return;
    const lateShare = s.late / s.frames;
    const tightShare = s.tight / s.frames;
    s.frames = 0;
    s.late = 0;
    s.tight = 0;
    s.time = 0;
    if (s.cooldown > 0) {
      s.cooldown--;
    } else {
      let next = s.dpr;
      if (lateShare > 0.15 && s.dpr > s.floor + 1e-3) {
        // Desceu e não melhorou: o gargalo não é a resolução — volta um degrau e trava aqui.
        if (s.lastStep === 'down' && lateShare >= s.lastLateShare * 0.9) {
          s.floor = Math.min(max, s.dpr / 0.88);
          next = s.floor;
        } else next = Math.max(s.floor, s.dpr * 0.88);
        s.lastStep = 'down';
        s.calm = 0;
        s.cooldown = 1;
      } else if (tightShare < 0.02) {
        s.calm++;
        if (s.calm >= 4 && s.dpr < max - 1e-3) {
          next = Math.min(max, s.dpr * 1.08);
          s.lastStep = 'up';
          s.calm = 0;
          s.cooldown = 1;
        }
      } else {
        s.calm = 0;
        // Subiu e passou a atrasar: volta.
        if (s.lastStep === 'up' && lateShare > 0.05) {
          next = Math.max(s.floor, s.dpr / 1.08);
          s.lastStep = '';
          s.cooldown = 3;
        }
      }
      s.lastLateShare = lateShare;
      if (Math.abs(next - s.dpr) > 1e-3) {
        s.dpr = next;
        setDpr(next);
      }
    }
    if (perf) {
      perf.windows++;
      perf.lateShare = lateShare;
      perf.tightShare = tightShare;
      perf.atFloor = s.dpr <= s.floor + 1e-3;
      perf.atMax = s.dpr >= max - 1e-3;
    }
  });
  return null;
}
