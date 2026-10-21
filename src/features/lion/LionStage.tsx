import { ChevronLeft, ChevronRight, Hand, Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { Button, IconButton } from '@/components/ui/Button';
import { hasWebGL, useDeviceProfile } from '@/hooks/useDeviceProfile';
import { useIsClient } from '@/hooks/useIsClient';
import { cn } from '@/lib/cn';
import { lionContent } from './content';
import type { LionQuality, LionScene, LionView } from './scene/LionScene';
import type { SculptMessage } from './sculpture/worker';

const STAGES = 6;
/** Quanto cada estágio fica na tela na sequência automática (a transição inclusa). */
const HOLD_MS = [3400, 3400, 3300, 3700, 3500];
const VIEWS: LionView[] = ['full', 'head', 'mane', 'paws', 'tail'];

type Mode = 'idle' | '3d' | 'no-webgl' | 'software';

/**
 * O palco da escultura: a cena 3D (baixada só quando o palco chega perto da
 * tela), os controles dos estágios e dos detalhes e, sem 3D, o desenho do
 * contorno. A sequência roda sozinha uma vez, quando o palco aparece; qualquer
 * escolha do visitante a interrompe. Com movimento reduzido, a obra já
 * aparece pronta e as trocas de estágio são cortes secos.
 */
export function LionStage() {
  const { locale, reducedMotion } = usePreferences();
  const t = lionContent[locale];
  const isClient = useIsClient();
  const device = useDeviceProfile();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<LionScene | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [stage, setStage] = useState(reducedMotion ? STAGES - 1 : 0);
  const [ready, setReady] = useState<number[]>([]);
  const [playing, setPlaying] = useState(!reducedMotion);
  const [view, setView] = useState<LionView>('full');
  const [touchActive, setTouchActive] = useState(false);
  const [outline, setOutline] = useState<string | null>(null);
  const [near, setNear] = useState(false);
  const touch = device.coarse;

  // Perto da tela (com folga), a cena é montada; fora dela, para de desenhar.
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e) return;
      if (e.isIntersecting) setNear(true);
      scene.current?.setVisible(e.isIntersecting);
    }, { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !isClient || !hasWebGL()) return;
    let cancelled = false;
    let created: LionScene | null = null;
    const quality: LionQuality = device.tier === 'low' ? 'low' : device.tier === 'medium' || device.coarse ? 'medium' : 'high';
    void import('./scene/LionScene').then(({ createLionScene, SoftwareRendererError }) => {
      if (cancelled || !canvas.current) return;
      try {
        created = createLionScene({
          canvas: canvas.current,
          quality,
          reducedMotion,
          plaque: [t.plaque[0]!, t.plaque[1]!],
          allowSoftware: import.meta.env.DEV && new URLSearchParams(location.search).has('software'),
          onReady: (s) => setReady((r) => (r.includes(s) ? r : [...r, s])),
          onContextLost: () => setMode('no-webgl'),
        });
        scene.current = created;
        setMode('3d');
      } catch (err) {
        setMode(err instanceof SoftwareRendererError ? 'software' : 'no-webgl');
      }
    });
    return () => {
      cancelled = true;
      created?.dispose();
      scene.current = null;
    };
    // A cena é criada uma vez (trocar o idioma só muda a placa: não vale recriar tudo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, isClient]);

  // Sem WebGL (ou só por software, ou com o contexto perdido): fica o desenho.
  const noWebgl = isClient && near && !hasWebGL();
  const fallback = noWebgl || mode === 'no-webgl' || mode === 'software';
  // Sem 3D: o contorno vira um desenho em SVG (o mesmo traço do primeiro estágio).
  useEffect(() => {
    if (!fallback) return;
    const worker = new Worker(new URL('./sculpture/worker.ts', import.meta.url), { type: 'module', name: 'bz-lion-outline' });
    worker.onmessage = (e: MessageEvent<SculptMessage>) => {
      if (e.data.kind !== 'lines') return;
      const s = e.data.silhouette;
      let d = '';
      for (let i = 0; i < s.length; i += 4) d += `M${s[i]!.toFixed(3)} ${(-s[i + 1]!).toFixed(3)}L${s[i + 2]!.toFixed(3)} ${(-s[i + 3]!).toFixed(3)}`;
      setOutline(d);
      worker.terminate();
    };
    worker.postMessage({ finalCell: 0, formCell: 0, linesOnly: true });
    return () => worker.terminate();
  }, [fallback]);

  // Estágio pedido → cena.
  const animate = useRef(true);
  useEffect(() => {
    scene.current?.setStage(stage, animate.current && !reducedMotion);
  }, [stage, mode, reducedMotion]);

  // Sequência automática: avança quando o estágio seguinte já está esculpido (e para na obra pronta).
  const autoplay = playing && stage < STAGES - 1;
  useEffect(() => {
    if (!autoplay || mode !== '3d' || !ready.includes(stage)) return;
    const id = window.setTimeout(() => {
      if (ready.includes(stage + 1)) {
        animate.current = true;
        setStage(stage + 1);
      }
    }, HOLD_MS[stage]);
    return () => window.clearTimeout(id);
  }, [autoplay, mode, stage, ready]);

  const choose = useCallback((s: number) => {
    animate.current = true;
    setPlaying(false);
    setStage(Math.max(0, Math.min(STAGES - 1, s)));
  }, []);
  const restart = () => {
    animate.current = true;
    setStage(0);
    setPlaying(!reducedMotion);
  };
  const look = (v: LionView) => {
    setView(v);
    scene.current?.setView(v);
  };
  useEffect(() => {
    scene.current?.setInteractive(!touch || touchActive);
  }, [touch, touchActive, mode]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const s = scene.current;
    if (!s) return;
    const step = 0.12;
    const map: Record<string, [number, number, number]> = {
      ArrowLeft: [-step, 0, 1],
      ArrowRight: [step, 0, 1],
      ArrowUp: [0, -step * 0.6, 1],
      ArrowDown: [0, step * 0.6, 1],
      '+': [0, 0, 0.88],
      '=': [0, 0, 0.88],
      '-': [0, 0, 1.14],
    };
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    s.nudge(...m);
  };

  const current = t.stages[stage]!;
  const waiting = mode === '3d' && !ready.includes(stage);
  return (
    <section aria-label={t.stageLabel} className="relative">
      <div
        ref={wrap}
        className={cn(
          'bz-cinema relative overflow-hidden rounded-2xl border border-line bg-bg-abyss text-fg shadow-3',
          'h-[70svh] min-h-[420px] md:h-auto md:aspect-[16/9] md:min-h-0',
        )}
        data-lion-stage={mode}
        data-stage={stage}
      >
        <canvas ref={canvas} aria-hidden className={cn('absolute inset-0 size-full', touch && !touchActive ? 'touch-pan-y' : 'touch-none', fallback && 'hidden')} />
        {/* A escultura para quem não a vê: o estágio, o que ele mostra, e os controles por teclado (setas, + e −). */}
        <div
          role="img"
          tabIndex={mode === '3d' ? 0 : -1}
          aria-label={`${t.stageStatus(stage + 1, STAGES, current.name)}. ${current.text}`}
          onKeyDown={onKey}
          className="pointer-events-none absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
        />
        {fallback && (
          <div className="absolute inset-0 grid place-items-center p-6">
            {outline && (
              <svg viewBox="-1.6 -2 3.2 2.1" className="h-3/4 w-full max-w-3xl text-accent" aria-hidden>
                <path d={outline} fill="none" stroke="currentColor" strokeWidth="0.006" strokeLinecap="round" />
              </svg>
            )}
            <p className="glass absolute inset-x-4 bottom-4 rounded-xl px-4 py-3 text-sm text-fg md:inset-x-auto md:left-4 md:max-w-md">{mode === 'software' ? t.software : t.noWebgl}</p>
          </div>
        )}

        {/* Legenda do estágio (no alto, à esquerda). */}
        {!fallback && (
          <div className="pointer-events-none absolute left-4 top-4 max-w-[min(26rem,calc(100%-2rem))]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent-text">{t.stageStatus(stage + 1, STAGES, current.name)}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{waiting ? t.sculpting : current.text}</p>
          </div>
        )}

        {/* Toque: o arrastar só gira a escultura depois de o visitante pedir (senão a página não rola). */}
        {mode === '3d' && touch && (
          <div className="absolute right-4 top-4">
            <Button size="sm" variant={touchActive ? 'primary' : 'secondary'} className={cn(!touchActive && 'glass')} onClick={() => setTouchActive((v) => !v)} iconLeft={<Hand className="size-4" />} aria-pressed={touchActive}>
              {touchActive ? t.touchDone : t.touchStart}
            </Button>
          </div>
        )}

        {/* Detalhes (à direita no computador, embaixo no celular). */}
        {mode === '3d' && (
          <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2 md:inset-x-auto md:bottom-auto md:right-4 md:top-1/2 md:-translate-y-1/2" role="group" aria-label={t.views}>
            <div className="glass flex gap-1 overflow-x-auto rounded-xl p-1 md:flex-col">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => look(v)}
                  className={cn('shrink-0 rounded-lg px-3 py-1.5 text-left text-xs transition-colors', view === v ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-muted hover:text-fg')}
                >
                  {t.viewNames[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === '3d' && !touch && <p className="pointer-events-none absolute bottom-4 left-4 hidden max-w-sm text-xs text-fg-subtle md:block">{t.hint}</p>}
      </div>

      {/* Estágios da construção: sempre fora do palco (não cobrem a escultura e funcionam sem 3D). */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <nav aria-label={t.stagesNav} className="min-w-0 flex-1">
          <ol className="flex gap-1.5 overflow-x-auto pb-1">
            {t.stages.map((s, i) => (
              <li key={s.name} className="shrink-0">
                <button
                  type="button"
                  onClick={() => choose(i)}
                  aria-current={stage === i ? 'step' : undefined}
                  disabled={fallback}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
                    stage === i ? 'border-accent bg-accent-soft font-medium text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
                  )}
                >
                  <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                  {s.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex items-center gap-1">
          <IconButton label={t.prev} onClick={() => choose(stage - 1)} disabled={fallback || stage === 0}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <IconButton label={t.next} onClick={() => choose(stage + 1)} disabled={fallback || stage === STAGES - 1}>
            <ChevronRight className="size-4" />
          </IconButton>
          {!reducedMotion && (
            <IconButton label={autoplay ? t.pause : t.play} onClick={() => setPlaying((p) => !p)} disabled={fallback || stage === STAGES - 1} active={autoplay}>
              {autoplay ? <Pause className="size-4" /> : <Play className="size-4" />}
            </IconButton>
          )}
          <IconButton label={t.restart} onClick={restart} disabled={fallback}>
            <RotateCcw className="size-4" />
          </IconButton>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {mode === '3d' ? t.stageStatus(stage + 1, STAGES, current.name) : ''}
      </p>
    </section>
  );
}
