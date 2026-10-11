import { useEffect, useRef } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { useDeviceProfile } from '@/hooks/useDeviceProfile';
import { cn } from '@/lib/cn';
import { ParticleEngine, type ParticleMessage, type ParticleOptions } from './particles/engine';

interface Host {
  post(msg: ParticleMessage): void;
}

const lineColor = (theme: string) => (theme === 'dark' ? '242,232,213' : '16,27,43');
/** Ouro da marca (--accent nos dois temas). Lido do CSS só fora da hidratação, num rAF. */
const DEFAULT_ACCENT = '#c7a86a';
const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || DEFAULT_ACCENT;

/**
 * Rede de partículas conectadas por linhas, com pulsos dourados percorrendo
 * as conexões ("informação em circulação") e parallax suave pelo ponteiro.
 *
 * Desempenho: o desenho roda num Web Worker com OffscreenCanvas (fora da
 * thread principal — a página continua respondendo ao toque e à rolagem);
 * sem suporte, o mesmo motor roda aqui. Pausa fora da viewport e com a aba
 * oculta, limita a 30 fps em celulares e aparelhos modestos, e com movimento
 * reduzido desenha um único quadro estático.
 */
export function ParticleField({ className, density = 1, seed = 7 }: { className?: string; density?: number; seed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<Host | null>(null);
  const syncRef = useRef<(() => void) | null>(null);
  const { reducedMotion, theme } = usePreferences();
  const { tier, coarse } = useDeviceProfile();
  const motionRef = useRef(reducedMotion);
  const themeRef = useRef(theme);

  useEffect(() => {
    motionRef.current = reducedMotion;
    themeRef.current = theme;
  });

  // Ciclo de vida do motor: um por elemento <canvas> (ver `key` abaixo — um
  // canvas transferido para o worker não pode ser transferido de novo).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const options: ParticleOptions = {
      density,
      seed,
      tierFactor: tier === 'low' ? 0.45 : tier === 'medium' ? 0.7 : 1,
      maxPulses: tier === 'low' ? 3 : 7,
      fps: coarse || tier !== 'high' ? 30 : 60,
      lineRgb: lineColor(themeRef.current),
      accent: DEFAULT_ACCENT,
    };
    const dpr = Math.min(window.devicePixelRatio || 1, tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1);

    let host: Host | null = null;
    let worker: Worker | null = null;
    if (typeof Worker === 'function' && typeof canvas.transferControlToOffscreen === 'function') {
      try {
        const offscreen = canvas.transferControlToOffscreen();
        worker = new Worker(new URL('./particles/worker.ts', import.meta.url), { type: 'module', name: 'bz-particles' });
        worker.postMessage({ type: 'init', canvas: offscreen, options } satisfies ParticleMessage, [offscreen]);
        const w = worker;
        host = { post: (msg) => w.postMessage(msg) };
      } catch {
        worker?.terminate();
        worker = null;
      }
    }
    if (!host) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const engine = new ParticleEngine(canvas, ctx, options);
      host = { post: (msg) => engine.handle(msg) };
    }
    hostRef.current = host;
    const h = host;

    let visible = true;
    const sync = () => h.post({ type: 'running', value: visible && !document.hidden && !motionRef.current });
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      h.post({ type: 'resize', width: rect.width, height: rect.height, dpr });
    };
    measure();
    sync();
    syncRef.current = sync;

    const ro = new ResizeObserver(measure);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', sync);

    const onPointer = (e: PointerEvent) => h.post({ type: 'pointer', x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 });
    if (!coarse) window.addEventListener('pointermove', onPointer, { passive: true });

    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', onPointer);
      h.post({ type: 'destroy' });
      worker?.terminate();
      hostRef.current = null;
      syncRef.current = null;
    };
  }, [tier, coarse, density, seed]);

  // Movimento reduzido: para o motor (o último quadro fica como imagem estática).
  useEffect(() => {
    syncRef.current?.();
  }, [reducedMotion]);

  // Troca de tema: só as cores mudam. Lê o token após o <html> receber o novo tema.
  useEffect(() => {
    const id = requestAnimationFrame(() => hostRef.current?.post({ type: 'colors', lineRgb: lineColor(theme), accent: accentColor() }));
    return () => cancelAnimationFrame(id);
  }, [theme]);

  return <canvas key={`${tier}-${coarse}-${density}-${seed}`} ref={canvasRef} aria-hidden className={cn('pointer-events-none absolute inset-0 size-full', className)} />;
}
