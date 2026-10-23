import { advance, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { writeSession } from '@/lib/storage';
import { AdaptiveResolution } from './AdaptiveResolution';
import { budgetMs, createPerfState, PACE_KEY, type PerfState } from './perfState';

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
  /** Nível de qualidade da cena (a resolução firmada é lembrada por nível). */
  level?: string;
  /** Pode usar o ritmo de 30 quadros por segundo (celular com placa de vídeo). */
  pace?: boolean;
}

/** Resolução adaptativa + qualidade automática, com as leituras compartilhadas (novas a cada cena). */
export function PerformanceGovernor({ min, max, canUpgrade, probation, onLow, onHeadroom, off, debug, level, pace = false }: Props) {
  const perf = useMemo(() => createPerfState(pace), [pace]);
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
      {pace && <FramePacer perf={perf} />}
      <AdaptiveResolution min={min} max={max} perf={perf} level={level} />
      <AutoQuality perf={perf} canUpgrade={canUpgrade} probation={probation} onLow={onLow} onHeadroom={onHeadroom} />
    </>
  );
}

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
 *    quadros atrasam (abaixo de ~45 fps, ou de ~23 fps no ritmo de 30) por 4
 *    janelas seguidas, e só se o quadro espera pela placa de vídeo: os níveis
 *    custam o mesmo ao processador, e descer por ele só perderia qualidade. A
 *    resolução é sempre a primeira a ceder: trocar de nível recria a cena.
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
    // Num celular ainda a 60, o ritmo de 30 vem antes de descer o nível.
    if (perf.paceable && perf.target === 60 && perf.lateShare > 0.15) {
      s.heavy = 0;
      s.calm = 0;
      return;
    }
    // Descer o nível só alivia a placa de vídeo: os níveis desenham a mesma cidade e custam o mesmo ao
    // processador (medido: Baixa e Média a ~37 ms por quadro no processador do Redmi emulado). Se baixar a
    // resolução já não aliviou (o processador segura o quadro), descer o nível só perderia qualidade: fica.
    // (A cerca não serve para isso: com o processador ocupado, a resposta dela chega depois do quadro
    // seguinte, e o quadro parece esperar pela placa.)
    s.heavy = perf.lateShare > 0.3 && perf.atFloor && !perf.cpuBound ? s.heavy + 1 : 0;
    const busy = perf.frameMs ?? perf.cpuMs;
    s.calm = perf.tightShare < 0.02 && perf.atMax && busy < budgetMs(perf) * UPGRADE_SHARE ? s.calm + 1 : 0;
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

/** Celular a 60 que atrasa: janelas seguidas com mais de 15% dos quadros abaixo de ~45 fps até ir para 30. */
const PACE_DOWN_WINDOWS = 2;
/** De volta a 60 só com folga medida: o quadro real (CPU + GPU) abaixo disto do orçamento de 60, por várias janelas. */
const PACE_UP_SHARE = 0.55;
const PACE_UP_WINDOWS = 10;

/**
 * Ritmo de 30 quadros por segundo para celulares que não sustentam 60, como fazem os jogos de celular.
 * Trinta quadros sempre iguais parecem mais lisos que 30–45 oscilando (a simulação já anda em passo fixo e
 * o desenho interpola), deixam a resolução e o nível de qualidade mais altos (o orçamento por quadro dobra)
 * e esquentam menos o aparelho, que assim não reduz o próprio relógio no meio da partida.
 *
 * Desenha um quadro a cada ~33 ms da tela (60, 90 ou 120 Hz), conduzindo o laço do React Three Fiber à mão
 * (`advance`). Volta a 60 se o custo real medido couber com folga. A decisão fica guardada na sessão: a
 * próxima cena (outro nível, outra entrada) já começa no ritmo em que o aparelho se firmou.
 */
function FramePacer({ perf }: { perf: PerfState }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const clock = useThree((s) => s.clock);
  const [target, setTarget] = useState(perf.target);
  const st = useRef({ seen: 0, late: 0, roomy: 0, demotions: 0 });
  useFrame(() => {
    const s = st.current;
    if (perf.windows === s.seen) return;
    s.seen = perf.windows;
    if (perf.windows < 3) return;
    if (perf.target === 60) {
      s.late = perf.lateShare > 0.15 ? s.late + 1 : 0;
      if (s.late >= PACE_DOWN_WINDOWS) {
        s.late = 0;
        s.demotions++;
        perf.target = 30;
        writeSession(PACE_KEY, '30');
        setTarget(30);
      }
    } else {
      const cost = perf.frameMs;
      // Depois de voltar e cair de novo, não tenta mais nesta cena (o vaivém seria ele mesmo um engasgo).
      s.roomy = s.demotions < 2 && cost !== null && cost < (1000 / 60) * PACE_UP_SHARE && perf.atMax ? s.roomy + 1 : 0;
      if (s.roomy >= PACE_UP_WINDOWS) {
        s.roomy = 0;
        perf.target = 60;
        writeSession(PACE_KEY, '60');
        setTarget(60);
      }
    }
  });
  useEffect(() => {
    if (target !== 30) return;
    setFrameloop('never');
    let id = 0;
    let last = 0;
    const tick = (t: number) => {
      id = requestAnimationFrame(tick);
      // Margem de meio quadro de 120 Hz: na tela de 60 Hz, um sim e um não; na de 120, um a cada quatro.
      if (t - last < 1000 / 30 - 4) return;
      // Com o laço à mão, o R3F calcula o intervalo como (instante − relógio.elapsedTime), em segundos:
      // o instante vai em segundos, e no primeiro quadro o relógio é alinhado a ele (origens diferentes).
      if (!last) clock.elapsedTime = t / 1000 - 1 / 30;
      last = t;
      advance(t / 1000);
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
      setFrameloop('always');
    };
  }, [target, setFrameloop, clock]);
  return null;
}
