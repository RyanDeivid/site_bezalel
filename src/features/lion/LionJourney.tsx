import { ArrowDown, MousePointer2 } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { hasWebGL, useDeviceProfile } from '@/hooks/useDeviceProfile';
import { useIsClient } from '@/hooks/useIsClient';
import { cn } from '@/lib/cn';
import { lionContent } from './content';
import { ACT_ORDER, ACTS, clamp01, textOpacity } from './journey';
import type { RevelationQuality, RevelationScene } from './scene/RevelationScene';
import type { SculptMessage } from './sculpture/worker';

type Mode = 'idle' | '3d' | 'no-webgl' | 'software';

/** Altura do trilho de rolagem (o palco fica preso à tela enquanto ele passa). */
const TRACK = '640svh';

/**
 * A experiência conduzida pela rolagem: um trilho alto com o palco preso à
 * tela; a fração rolada vai para a cena (que a persegue com suavidade) e
 * decide qual citação aparece. O cursor vai para a cena como uma luz.
 *
 * Com "reduzir movimento", não há trilho: a cena aparece parada no último
 * momento e as citações viram uma lista. Sem WebGL (ou só por software), fica
 * o contorno do leão em desenho e a mesma lista.
 */
export function LionJourney() {
  const { locale, reducedMotion } = usePreferences();
  const t = lionContent[locale];
  const isClient = useIsClient();
  const device = useDeviceProfile();
  const track = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<RevelationScene | null>(null);
  const quotes = useRef<Array<HTMLElement | null>>([]);
  const bar = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState(false);
  const [outline, setOutline] = useState<string | null>(null);
  const noWebgl = isClient && near && !hasWebGL();
  const fallback = noWebgl || mode === 'no-webgl' || mode === 'software';
  const still = reducedMotion;

  // Perto da tela, a cena é montada; fora dela, para de desenhar.
  useEffect(() => {
    const el = track.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting) setNear(true);
        scene.current?.setVisible(e.isIntersecting);
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !isClient || !hasWebGL()) return;
    let cancelled = false;
    let created: RevelationScene | null = null;
    const quality: RevelationQuality = device.tier === 'low' ? 'low' : device.tier === 'medium' || device.coarse ? 'medium' : 'high';
    void import('./scene/RevelationScene').then(({ createRevelationScene, SoftwareRendererError }) => {
      if (cancelled || !canvas.current) return;
      try {
        created = createRevelationScene({
          canvas: canvas.current,
          quality,
          reducedMotion,
          allowSoftware: import.meta.env.DEV && new URLSearchParams(location.search).has('software'),
          onReady: () => setReady(true),
          onContextLost: () => setMode('no-webgl'),
        });
        scene.current = created;
        setMode('3d');
        update();
      } catch (err) {
        setMode(err instanceof SoftwareRendererError ? 'software' : 'no-webgl');
      }
    });
    return () => {
      cancelled = true;
      created?.dispose();
      scene.current = null;
    };
    // Uma cena por visita (o idioma só muda os textos, que são HTML).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, isClient]);

  // Rolagem → cena, citações e barra de progresso (direto no DOM: nada de renderizar o React a cada quadro).
  function update() {
    const el = track.current;
    if (!el || still) return;
    const rect = el.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const p = total > 0 ? clamp01(-rect.top / total) : 0;
    scene.current?.setProgress(p);
    ACT_ORDER.forEach((id, i) => {
      const q = quotes.current[i];
      if (!q) return;
      const o = textOpacity(id, p);
      q.style.opacity = String(o);
      q.style.transform = `translate3d(0, ${(1 - o) * 14}px, 0)`;
      q.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    });
    if (bar.current) bar.current.style.transform = `scaleY(${p})`;
    if (hint.current) hint.current.style.opacity = String(1 - clamp01(p * 30));
  }
  useEffect(() => {
    if (still || fallback) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
    const onResize = () => {
      scene.current?.resize();
      onScroll();
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, fallback]);

  // Sem 3D: o contorno do leão vira um desenho em SVG.
  useEffect(() => {
    if (!fallback) return;
    const worker = new Worker(new URL('./sculpture/worker.ts', import.meta.url), { type: 'module', name: 'bz-lion-outline' });
    worker.onmessage = (e: MessageEvent<SculptMessage>) => {
      if (e.data.kind !== 'outline') return;
      const s = e.data.silhouette;
      let d = '';
      for (let i = 0; i < s.length; i += 4) d += `M${s[i]!.toFixed(3)} ${(-s[i + 1]!).toFixed(3)}L${s[i + 2]!.toFixed(3)} ${(-s[i + 3]!).toFixed(3)}`;
      setOutline(d);
      worker.terminate();
    };
    worker.postMessage({ kind: 'outline' });
    return () => worker.terminate();
  }, [fallback]);

  const onPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    scene.current?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  };

  const list = (
    <ol className="space-y-6">
      {ACT_ORDER.map((id) => (
        <li key={id}>
          <figure>
            <blockquote className="font-serif-accent text-2xl leading-snug text-fg md:text-3xl">
              <p>“{t.acts[id].quote}”</p>
            </blockquote>
            <figcaption className="mt-2 font-mono text-sm text-accent-text">{t.acts[id].ref}</figcaption>
          </figure>
        </li>
      ))}
    </ol>
  );

  // ---- Sem trilho: movimento reduzido ou sem 3D ----
  if (still || fallback) {
    return (
      <section aria-label={t.stageLabel} className="container-page pt-10">
        <div className="bz-cinema relative overflow-hidden rounded-2xl border border-line bg-bg-abyss text-fg" data-lion-stage={fallback ? (mode === 'software' ? 'software' : 'no-webgl') : mode} ref={track}>
          <div className="relative h-[60svh] min-h-[360px]">
            {!fallback && <canvas ref={canvas} aria-hidden className="absolute inset-0 size-full" />}
            {fallback && outline && (
              <svg viewBox="-1.6 -2 3.2 2.1" className="absolute inset-0 m-auto h-3/4 w-full max-w-3xl text-accent" aria-hidden>
                <path d={outline} fill="none" stroke="currentColor" strokeWidth="0.006" strokeLinecap="round" />
              </svg>
            )}
            <p className="glass absolute inset-x-4 bottom-4 rounded-xl px-4 py-3 text-sm md:inset-x-auto md:left-4 md:max-w-md">{fallback ? (mode === 'software' ? t.software : t.noWebgl) : t.still}</p>
          </div>
          <div className="border-t border-line p-6 md:p-10">{list}</div>
        </div>
      </section>
    );
  }

  // ---- O trilho: a cena presa à tela enquanto a página rola ----
  return (
    <section aria-label={t.stageLabel} className="relative">
      <div ref={track} className="relative" style={{ height: TRACK }} data-lion-stage={mode} data-ready={ready ? '1' : '0'}>
        <div className="bz-cinema sticky top-0 h-svh overflow-hidden bg-bg-abyss text-fg" onPointerMove={onPointer} onPointerLeave={() => scene.current?.setPointer(null, 0)}>
          <canvas ref={canvas} aria-hidden className="absolute inset-0 size-full" />
          {/* As citações de cada momento (literais, com a referência), uma por vez. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-[9svh] md:bottom-[12svh]">
            <div className="container-page relative min-h-[11rem]">
              {ACT_ORDER.map((id, i) => (
                <figure
                  key={id}
                  ref={(el) => void (quotes.current[i] = el)}
                  className="absolute bottom-0 max-w-3xl"
                  // As mesmas margens do container (um elemento absoluto ignora o padding dele).
                  style={{ left: 'clamp(1rem, 4vw, 2rem)', right: 'clamp(1rem, 4vw, 2rem)', opacity: i === 0 ? 1 : 0, visibility: i === 0 ? 'visible' : 'hidden' }}
                  data-act={id}
                >
                  <blockquote className="font-serif-accent text-3xl leading-snug text-fg [text-shadow:0_2px_24px_rgb(3_6_13/0.9)] md:text-4xl">
                    <p>“{t.acts[id].quote}”</p>
                  </blockquote>
                  <figcaption className="mt-3 font-mono text-sm uppercase tracking-[0.18em] text-accent-text">{t.acts[id].ref}</figcaption>
                </figure>
              ))}
            </div>
          </div>
          {/* Progresso: uma linha fina à direita, com uma marca por momento. */}
          <div className="pointer-events-none absolute right-4 top-1/2 h-48 w-px -translate-y-1/2 bg-line-strong md:right-8" role="presentation">
            <div ref={bar} className="absolute inset-0 origin-top scale-y-0 bg-accent" />
            {ACT_ORDER.map((id) => (
              <span key={id} className="absolute -left-[3px] size-[7px] rounded-full border border-accent bg-bg-abyss" style={{ top: `${ACTS[id].from * 100}%` }} />
            ))}
          </div>
          <div ref={hint} className="pointer-events-none absolute inset-x-0 top-[18svh] flex flex-col items-center gap-2 text-sm text-fg-muted">
            <span className="flex items-center gap-2">
              <ArrowDown aria-hidden className="size-4 animate-bounce text-accent-text" />
              {t.scrollHint}
            </span>
            {!device.coarse && (
              <span className="flex items-center gap-2 text-xs text-fg-subtle">
                <MousePointer2 aria-hidden className="size-3.5" />
                {t.pointerHint}
              </span>
            )}
          </div>
          <a href="#lion-text" className={cn('glass absolute left-4 top-20 rounded-lg px-3 py-1.5 text-sm', 'sr-only focus:not-sr-only')}>
            {t.skip}
          </a>
        </div>
      </div>
    </section>
  );
}
