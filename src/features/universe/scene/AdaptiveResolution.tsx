import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { writeSession } from '@/lib/storage';
import { postFor } from './bloom';
import { budgetMs, SETTLED_KEY, type PerfState } from './perfState';

/** Quadro "atrasado": a 60 fps, abaixo de ~45 fps (22 ms); no ritmo de 30, abaixo de ~23 fps. */
const LATE = 1.32;
/** Quadro "justo": um quadro do alvo perdido, com folga para a variação normal (18,5 ms a 60 fps). */
const TIGHT = 1.11;
/** Degraus de resolução: desce 12%, sobe 8%. */
const DOWN = 0.88;
const UP = 1.08;

/**
 * Resolução adaptativa: mantém o jogo liso mudando só a resolução de desenho
 * (`dpr`), sem trocar o nível de qualidade.
 *
 * A meta é 60 fps sem quadros perdidos, qualquer que seja a tela (em 120/144 Hz,
 * perseguir a taxa da tela sacrificaria nitidez sem necessidade). A cada janela
 * de ~1 s:
 *  - **desce um degrau** quando mais de 15% dos quadros atrasam (> 22 ms) ou
 *    quando, por duas janelas seguidas, mais de 6% perdem um quadro de 60 Hz
 *    (> 18,5 ms) — na tela, isso é o "engasgo" que se sente mesmo com a média
 *    boa. Se descer não melhorou, quem segura o quadro é o processador: volta
 *    um degrau e trava ali, porque só perderia nitidez;
 *  - **sobe um degrau** só com folga medida: várias janelas sem quadros
 *    perdidos **e** o custo real do quadro (CPU + GPU, da cerca do
 *    `FrameCost`), aumentado pelo degrau, abaixo de 80% do orçamento. Se depois
 *    de subir voltar a perder quadros, desce e espera o dobro antes de tentar
 *    de novo (até ~1 min): cada troca de resolução realoca o canvas e as
 *    texturas do brilho, e o vaivém de antes (sobe, perde, desce, a cada
 *    poucos segundos) era ele mesmo um engasgo.
 * O primeiro quadro depois de a aba voltar do segundo plano é ignorado (o
 * intervalo dele é o tempo em que ela ficou oculta).
 */
export function AdaptiveResolution({ min, max, perf, level }: { min: number; max: number; perf?: PerfState; /** Nível de qualidade (para lembrar a resolução firmada). */ level?: string }) {
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);
  const st = useRef({
    init: false,
    dpr: max,
    frames: 0,
    late: 0,
    tight: 0,
    time: 0,
    calm: 0,
    // Os primeiros segundos depois do preparo não contam (a cena ainda assenta).
    cooldown: 3,
    lastShare: 0,
    target: 60,
    lastStep: '' as '' | 'down' | 'up',
    floor: min,
    skip: false,
    tightRun: 0,
    upWait: 4,
    steady: 0,
  });
  useEffect(() => {
    const onVisibility = () => void (st.current.skip = true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useFrame((_, dt) => {
    const s = st.current;
    if (!s.init) {
      s.init = true;
      s.dpr = gl.getPixelRatio() * (postFor(gl)?.scale ?? 1);
    }
    const ms = dt * 1000;
    if (s.skip) {
      s.skip = false;
      return;
    }
    // O alvo mudou (60 ↔ 30): os quadros mudam de duração; a janela recomeça e espera assentar.
    const target = perf?.target ?? 60;
    if (target !== s.target) {
      s.target = target;
      s.frames = s.late = s.tight = s.time = 0;
      s.cooldown = Math.max(s.cooldown, 2);
      s.calm = 0;
      s.tightRun = 0;
      return;
    }
    const BUDGET_MS = budgetMs(perf);
    const LATE_MS = BUDGET_MS * LATE;
    const TIGHT_MS = BUDGET_MS * TIGHT;
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
    s.tightRun = tightShare > 0.06 ? s.tightRun + 1 : 0;
    if (s.cooldown > 0) {
      s.cooldown--;
    } else {
      let next = s.dpr;
      // Num celular a 60, quem age primeiro é o ritmo de 30 (mais nítido que baixar a resolução).
      const deferToPacer = !!perf?.paceable && target === 60;
      const struggling = (lateShare > 0.15 || s.tightRun >= 2) && !deferToPacer;
      const share = Math.max(lateShare, tightShare);
      if (struggling && s.dpr > s.floor + 1e-3) {
        if (s.lastStep === 'down' && share >= s.lastShare * 0.9) {
          // Desceu e não melhorou: o gargalo não é a resolução — volta um degrau e trava aqui.
          s.floor = Math.min(max, s.dpr / DOWN);
          next = s.floor;
          if (perf) perf.cpuBound = true;
        } else {
          next = Math.max(s.floor, s.dpr * DOWN);
          // Subiu há pouco e passou a perder quadros: a próxima tentativa espera o dobro.
          if (s.lastStep === 'up') s.upWait = Math.min(64, s.upWait * 2);
        }
        s.lastStep = 'down';
        s.calm = 0;
        s.tightRun = 0;
        s.cooldown = 1;
      } else if (tightShare < 0.02) {
        s.calm++;
        const cost = perf?.frameMs ?? null;
        const headroom = cost === null || cost * UP * UP < BUDGET_MS * 0.8;
        if (s.calm >= s.upWait && headroom && s.dpr < max - 1e-3) {
          next = Math.min(max, s.dpr * UP);
          s.lastStep = 'up';
          s.calm = 0;
          s.cooldown = 1;
        }
      } else s.calm = 0;
      s.lastShare = share;
      if (Math.abs(next - s.dpr) > 1e-3) {
        s.dpr = next;
        s.steady = 0;
        // Com o brilho, a resolução muda dentro da textura da cena (escala), sem realocar o canvas;
        // só acima da resolução do canvas (superamostragem do Ultra) o canvas muda de tamanho.
        const post = postFor(gl);
        const canvas = gl.getPixelRatio();
        if (post && next <= canvas + 1e-3) post.scale = next / canvas;
        else {
          if (post) post.scale = 1;
          setDpr(next);
        }
      } else if (level && ++s.steady === 8) writeSession(SETTLED_KEY(level), s.dpr.toFixed(3));
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
