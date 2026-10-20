import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdaptiveResolution } from './AdaptiveResolution';
import { createPerfState, type PerfState } from './perfState';

interface Props {
  min: number;
  max: number;
  canUpgrade: boolean;
  /** O nível atual foi alcançado subindo (modo Auto): está em período de prova. */
  probation: boolean;
  onLow: () => void;
  onHeadroom: () => void;
  /** Desligado para medir a cena com resolução e nível fixos (só nas medições). */
  off?: boolean;
  /** Expõe as leituras em `window.__bzUniversePerf` (testes). */
  debug?: boolean;
}

/** Resolução adaptativa + qualidade automática, com as leituras compartilhadas (novas a cada cena). */
export function PerformanceGovernor({ min, max, canUpgrade, probation, onLow, onHeadroom, off, debug }: Props) {
  const perf = useMemo(() => createPerfState(), []);
  useEffect(() => {
    if (!debug) return;
    const w = window as unknown as { __bzUniversePerf?: PerfState };
    w.__bzUniversePerf = perf;
    return () => {
      delete w.__bzUniversePerf;
    };
  }, [debug, perf]);
  if (off) return null;
  return (
    <>
      <FrameCost perf={perf} />
      <AdaptiveResolution min={min} max={max} perf={perf} />
      <AutoQuality perf={perf} canUpgrade={canUpgrade} probation={probation} onLow={onLow} onHeadroom={onHeadroom} />
    </>
  );
}

/** Orçamento de um quadro a 60 fps. */
const BUDGET_MS = 1000 / 60;
/** O nível de cima custa ~1,3–1,6× o atual (medido): só sobe com o quadro usando menos que isto do orçamento. */
const UPGRADE_SHARE = 0.55;

/**
 * Mede o trabalho real de cada quadro, independente da trava de 60 Hz e de
 * quantas passadas de desenho o quadro tenha (com brilho são ~10).
 *  - CPU: do início do quadro ao fim do último desenho dele.
 *  - Quadro inteiro (CPU + GPU): a cada 20 quadros, no início do quadro
 *    seguinte (quando todo o desenho do anterior já foi enviado), uma cerca
 *    (`fenceSync`) é posta e consultada sem bloquear, num laço de mensagens; o
 *    momento em que a placa de vídeo a alcança, contado do início do quadro
 *    medido, é o custo dele — seja quem for o gargalo. Funciona em qualquer
 *    navegador com WebGL2 (o cronômetro da GPU quase nunca está disponível).
 */
function FrameCost({ perf }: { perf: PerfState }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ start: 0, lastEnd: 0, cpu: 0, cpuN: 0, e2e: 0, e2eN: 0, frame: 0, probing: false });
  const fence = useRef<((start: number) => void) | null>(null);
  useFrame(() => {
    const a = acc.current;
    const now = performance.now();
    // Fecha o quadro anterior: CPU até o último desenho dele; e, de vez em quando, a cerca.
    if (a.start && a.lastEnd > a.start) {
      a.cpu += a.lastEnd - a.start;
      a.cpuN++;
      if (!a.probing && a.frame++ % 20 === 0) fence.current?.(a.start);
    }
    a.start = now;
  }, -1000);
  useEffect(() => {
    const a = acc.current;
    const ctx = gl.getContext() as WebGL2RenderingContext;
    const channel = new MessageChannel();
    let alive = true;
    const render = gl.render;
    const timed: typeof gl.render = function (this: typeof gl, sc, cam) {
      render.call(gl, sc, cam);
      a.lastEnd = performance.now();
    };
    gl.render = timed;
    if (typeof ctx.fenceSync === 'function')
      fence.current = (start) => {
        const sync = ctx.fenceSync(ctx.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (!sync) return;
        ctx.flush();
        a.probing = true;
        const poll = () => {
          if (!alive) return ctx.deleteSync(sync);
          if (ctx.getSyncParameter(sync, ctx.SYNC_STATUS) === ctx.SIGNALED) {
            const e2e = performance.now() - start;
            ctx.deleteSync(sync);
            a.probing = false;
            // Mais de 100 ms: a aba ficou em segundo plano, não é custo do quadro.
            if (e2e < 100) {
              a.e2e += e2e;
              a.e2eN++;
            }
            return;
          }
          channel.port2.postMessage(0);
        };
        channel.port1.onmessage = poll;
        channel.port2.postMessage(0);
      };
    return () => {
      alive = false;
      fence.current = null;
      channel.port1.onmessage = null;
      channel.port1.close();
      if (gl.render === timed) gl.render = render;
    };
  }, [gl]);
  // Fecha a média a cada janela da AdaptiveResolution.
  const seen = useRef(0);
  useFrame(() => {
    const a = acc.current;
    if (perf.windows === seen.current) return;
    seen.current = perf.windows;
    if (a.cpuN) perf.cpuMs = a.cpu / a.cpuN;
    if (a.e2eN) perf.frameMs = a.e2e / a.e2eN;
    a.cpu = a.cpuN = a.e2e = a.e2eN = 0;
  });
  return null;
}

/**
 * Qualidade automática: decide, com o que a AdaptiveResolution mediu, se o
 * nível de qualidade deve mudar. Os primeiros segundos depois do preparo não
 * contam (a cena ainda assenta). Cada sinal é dado uma vez por cena (a página
 * decide e recria a cena).
 *  - Desce um nível quando, mesmo com a resolução no piso, mais de 30% dos
 *    quadros atrasam (< ~45 fps) por 4 janelas seguidas. A resolução é sempre
 *    a primeira a ceder: trocar de nível recria a cena.
 *  - Sobe um nível (`canUpgrade`) depois de 8 janelas seguidas com quase nenhum
 *    quadro acima de um quadro de 60 Hz, a resolução no máximo e o custo real
 *    do quadro (CPU + GPU, medido pela cerca) abaixo de 55% do orçamento de
 *    60 fps — o nível de cima custa ~1,3–1,6× o atual. O período de prova
 *    cobre o que a medida não previr.
 *  - Período de prova: num nível alcançado subindo, se nas 10 primeiras janelas
 *    mais de 8% dos quadros, em média, perderem os 60 Hz, ele volta (e a
 *    página não sobe de novo até ele nesta sessão). Subir só vale se continuar
 *    liso; "quase liso" não basta.
 */
function AutoQuality({ perf, canUpgrade, probation, onLow, onHeadroom }: { perf: PerfState; canUpgrade: boolean; probation: boolean; onLow: () => void; onHeadroom: () => void }) {
  const st = useRef({ seen: 0, heavy: 0, calm: 0, trial: [] as number[], fired: false });
  useFrame(() => {
    const s = st.current;
    if (s.fired || perf.windows === s.seen) return;
    s.seen = perf.windows;
    if (perf.windows < 5) return;
    if (probation && s.trial.length < 10) {
      s.trial.push(perf.tightShare);
      if (s.trial.length === 10 && s.trial.reduce((a, b) => a + b, 0) / 10 > 0.08) {
        s.fired = true;
        onLow();
        return;
      }
    }
    s.heavy = perf.lateShare > 0.3 && perf.atFloor ? s.heavy + 1 : 0;
    const busy = perf.frameMs ?? perf.cpuMs;
    s.calm = perf.tightShare < 0.02 && perf.atMax && busy < BUDGET_MS * UPGRADE_SHARE ? s.calm + 1 : 0;
    if (s.heavy >= 4) {
      s.fired = true;
      onLow();
    } else if (canUpgrade && s.calm >= 8) {
      s.fired = true;
      onHeadroom();
    }
  });
  return null;
}
