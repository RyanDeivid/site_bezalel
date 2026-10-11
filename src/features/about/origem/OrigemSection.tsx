import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { readStorage, writeStorage } from '@/lib/storage';
import type { Blueprint } from './blueprint';
import { originContent } from './content';
import { angleDelta, chapterAt, Crank, snapTarget, TICKS_PER_TURN } from './crank';
import { gearPath, GEARS } from './gear';
import type { Clicker } from './sound';

const TOTAL = 7;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const SOUND_KEY = 'bz-crank-sound';
/** Ritmo do "girar para mim" e dos botões: tempo de uma volta e pausa para ler. */
const TURN_MS = 2600;
const STEP_MS = 1500;
const READ_MS = 3800;

// Montagem da manivela num quadro de 300 × 220 (posições em %; as peças giram por CSS).
const VIEW = { w: 300, h: 220 };
const CROWN = { x: 190, y: 110 };
const IDLER = { x: 91.33, y: 74.09 };
const PINION = { x: 40.81, y: 103.26 };
const box = (x: number, y: number, r: number): CSSProperties => ({
  left: `${((x - r) / VIEW.w) * 100}%`,
  top: `${((y - r) / VIEW.h) * 100}%`,
  width: `${((2 * r) / VIEW.w) * 100}%`,
  height: `${((2 * r) / VIEW.h) * 100}%`,
});
const PROGRESS_R = 27;
const PROGRESS_LEN = 2 * Math.PI * PROGRESS_R;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A origem (página Sobre): a história de Bezalel construída à mão. O
 * visitante gira uma manivela — arrastando em círculo, pelo teclado ou pelos
 * botões — e cada volta completa ergue um capítulo na planta: o nome, os
 * dons, a matéria, o Tabernáculo, o ensino, as letras e o legado, que termina
 * no símbolo da Bezalel.
 *
 * O texto de todos os capítulos está no HTML pré-renderizado (sem JavaScript
 * ele aparece como lista); a planta em canvas só é carregada quando a seção
 * se aproxima da tela.
 */
export function OrigemSection() {
  const { locale, reducedMotion } = usePreferences();
  const o = originContent[locale];
  const uid = useId().replace(/:/g, '');
  const [chapter, setChapter] = useState(0);
  const [touched, setTouched] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const crownRef = useRef<HTMLDivElement>(null);
  const idlerRef = useRef<HTMLDivElement>(null);
  const pinionRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const crankRef = useRef<Crank | null>(null);
  const blueprintRef = useRef<Blueprint | null>(null);
  const clickerRef = useRef<Clicker | null>(null);
  const reducedRef = useRef(reducedMotion);
  const soundRef = useRef(false);
  const playRef = useRef(false);
  const playTimer = useRef(0);
  const userDriving = useRef(false);
  const drag = useRef<{ id: number; angle: number } | null>(null);

  // ---- desenho: manivela, engrenagens, planta ---------------------------------------
  const paint = useCallback((turns: number) => {
    const deg = turns * 360;
    if (crownRef.current) crownRef.current.style.transform = `rotate(${deg}deg)`;
    if (armRef.current) armRef.current.style.transform = `rotate(${deg}deg)`;
    // Engrenamento: intermediária ao contrário (2×), pinhão a favor (3×); +15° alinha os dentes.
    if (idlerRef.current) idlerRef.current.style.transform = `rotate(${15 - deg * (GEARS.crown.teeth / GEARS.idler.teeth)}deg)`;
    if (pinionRef.current) pinionRef.current.style.transform = `rotate(${15 + deg * (GEARS.crown.teeth / GEARS.pinion.teeth)}deg)`;
    if (ringRef.current) ringRef.current.style.strokeDashoffset = String(PROGRESS_LEN * (1 - turns / TOTAL));
    if (markRef.current) markRef.current.style.opacity = String(smooth(TOTAL - 0.22, TOTAL, turns));
    // Movimento reduzido: a planta pula de capítulo pronto em capítulo pronto (sem voo).
    blueprintRef.current?.setProgress(reducedRef.current ? chapterAt(turns, TOTAL) : turns);
    setChapter(chapterAt(turns, TOTAL));
  }, []);

  const stopPlay = useCallback(() => {
    playRef.current = false;
    window.clearTimeout(playTimer.current);
    setPlaying(false);
  }, []);

  useEffect(() => {
    reducedRef.current = reducedMotion;
    const c = crankRef.current;
    if (c) {
      blueprintRef.current?.setCalm(reducedMotion);
      blueprintRef.current?.setProgress(reducedMotion ? chapterAt(c.turns, TOTAL) : c.turns);
    }
  }, [reducedMotion]);

  // ---- a manivela ---------------------------------------------------------------------
  useEffect(() => {
    soundRef.current = readStorage(SOUND_KEY) === 'on';
    if (soundRef.current) {
      const id = requestAnimationFrame(() => setSound(true));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  useEffect(() => {
    const crank = new Crank({
      max: TOTAL,
      reducedMotion: () => reducedRef.current,
      onChange: paint,
      onTick: () => {
        if (soundRef.current) clickerRef.current?.tick();
      },
      onDetent: (_index, direction) => {
        if (soundRef.current) clickerRef.current?.detent();
        if (userDriving.current && direction > 0) navigator.vibrate?.(12);
      },
      onRest: (turns) => {
        if (!playRef.current) return;
        if (turns >= TOTAL) {
          stopPlay();
          return;
        }
        window.clearTimeout(playTimer.current);
        playTimer.current = window.setTimeout(() => crank.step(1, TURN_MS), turns === 0 ? 400 : READ_MS);
      },
    });
    crankRef.current = crank;
    return () => {
      crank.destroy();
      window.clearTimeout(playTimer.current);
      crankRef.current = null;
    };
  }, [paint, stopPlay]);

  // ---- a planta (carregada perto da tela) ---------------------------------------------
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas || !document.documentElement.dataset.origem) return;
    let disposed = false;
    let visible = false;
    const labels = o.labels;
    const load = () => {
      if (blueprintRef.current || disposed) return;
      void import('./blueprint').then(({ createBlueprint }) => {
        if (disposed) return;
        try {
          const bp = createBlueprint(canvas, {
            quality: document.documentElement.dataset.origem === 'lite' ? 'lite' : 'full',
            touch: window.matchMedia('(pointer: coarse)').matches,
            labels: { ...labels },
            font: getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace',
            onLayout: ({ x, y, scale, markHeight }) => {
              const mark = markRef.current;
              if (!mark) return;
              // O cubo do SVG ocupa 40 de 48 unidades de altura: alinha com o cubo de partículas.
              const size = ((markHeight * 48) / 40) * scale;
              mark.style.width = `${size}px`;
              mark.style.height = `${size}px`;
              mark.style.left = `${x - size / 2}px`;
              mark.style.top = `${y - size / 2}px`;
            },
          });
          blueprintRef.current = bp;
          bp.setCalm(reducedRef.current);
          const turns = crankRef.current?.turns ?? 0;
          bp.setProgress(reducedRef.current ? chapterAt(turns, TOTAL) : turns);
          bp.setActive(visible);
          section.dataset.ready = 'true';
        } catch {
          // Sem canvas 2D: fica a história em texto, com a manivela funcionando.
        }
      });
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === section) {
            visible = e.isIntersecting;
            blueprintRef.current?.setActive(visible);
          } else if (e.isIntersecting) load();
        }
      },
      { rootMargin: '0px' },
    );
    io.observe(section);
    // Carrega um pouco antes de a seção chegar.
    const early = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && load(), { rootMargin: '600px 0px' });
    early.observe(section);
    return () => {
      disposed = true;
      io.disconnect();
      early.disconnect();
      blueprintRef.current?.destroy();
      blueprintRef.current = null;
      delete section.dataset.ready;
    };
  }, [o.labels, locale]);

  // ---- entrada: arrastar, teclado, roda do mouse (com foco), botões -----------------
  const begin = () => {
    setTouched(true);
    stopPlay();
    userDriving.current = true;
  };

  const angleAt = (clientX: number, clientY: number) => {
    const r = dialRef.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return { a: Math.atan2(clientY - cy, clientX - cx), d: Math.hypot(clientX - cx, clientY - cy), r: r.width / 2 };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const { a, d } = angleAt(e.clientX, e.clientY);
    if (d < 6) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, angle: a };
    begin();
    crankRef.current?.grab();
    e.currentTarget.focus({ preventScroll: true });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    const { a, d, r } = angleAt(e.clientX, e.clientY);
    // Perto do eixo o ângulo fica instável: ignora.
    if (d < r * 0.12) return;
    crankRef.current?.drag(angleDelta(g.angle, a));
    g.angle = a;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    crankRef.current?.release();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const c = crankRef.current;
    if (!c) return;
    const fine = 1 / TICKS_PER_TURN;
    const actions: Record<string, () => void> = {
      ArrowRight: () => c.nudge(fine),
      ArrowUp: () => c.nudge(fine),
      ArrowLeft: () => c.nudge(-fine),
      ArrowDown: () => c.nudge(-fine),
      PageUp: () => c.step(1, STEP_MS),
      PageDown: () => c.step(-1, STEP_MS),
      Enter: () => c.step(1, STEP_MS),
      ' ': () => c.step(1, STEP_MS),
      Home: () => c.goTo(0, STEP_MS),
      End: () => c.goTo(TOTAL, STEP_MS),
    };
    const act = actions[e.key];
    if (!act) return;
    e.preventDefault();
    begin();
    act();
  };

  // Roda do mouse só gira a manivela com ela em foco (não sequestra a rolagem da página).
  useEffect(() => {
    const dial = dialRef.current;
    if (!dial) return;
    let settle = 0;
    let dir = 0;
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== dial) return;
      const c = crankRef.current;
      if (!c) return;
      e.preventDefault();
      setTouched(true);
      stopPlay();
      dir = Math.sign(e.deltaY);
      c.nudge(Math.max(-0.25, Math.min(0.25, e.deltaY / 1500)));
      window.clearTimeout(settle);
      settle = window.setTimeout(() => c.goTo(snapTarget(c.turns, dir, TOTAL)), 180);
    };
    dial.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      dial.removeEventListener('wheel', onWheel);
      window.clearTimeout(settle);
    };
  }, [stopPlay]);

  const go = (n: number) => {
    begin();
    userDriving.current = false;
    crankRef.current?.step(n, STEP_MS);
  };

  const togglePlay = () => {
    const c = crankRef.current;
    if (!c) return;
    if (playRef.current) {
      stopPlay();
      return;
    }
    setTouched(true);
    userDriving.current = false;
    playRef.current = true;
    setPlaying(true);
    if (c.turns >= TOTAL - 1e-3) c.goTo(0, STEP_MS);
    else c.step(1, TURN_MS);
  };

  const restart = () => {
    stopPlay();
    userDriving.current = false;
    crankRef.current?.goTo(0, STEP_MS * 1.6);
    dialRef.current?.focus({ preventScroll: true });
  };

  const toggleSound = () => {
    const next = !soundRef.current;
    soundRef.current = next;
    setSound(next);
    writeStorage(SOUND_KEY, next ? 'on' : 'off');
    if (next && !clickerRef.current) {
      void import('./sound').then(({ createClicker }) => {
        clickerRef.current = createClicker();
        clickerRef.current?.detent();
      });
    } else if (next) clickerRef.current?.detent();
  };

  useEffect(() => () => clickerRef.current?.close(), []);

  const current = chapter > 0 ? o.chapters[chapter - 1] : undefined;
  const sheetNo = chapter > 0 ? ROMAN[chapter - 1] : '0';

  return (
    <section ref={sectionRef} id="origem" aria-labelledby="origem-title" className="bz-origem bz-cinema" data-chapter={chapter}>
      <div aria-hidden className="bz-origem-glow" />
      <div className="container-page relative">
        <header className="bz-origem-head">
          <p className="eyebrow">{o.eyebrow}</p>
          <h2 id="origem-title" className="text-title mt-4 max-w-3xl md:text-5xl">
            {o.title}
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-fg-muted">{o.lead}</p>
        </header>

        <div className="bz-origem-stage">
          {/* Prancheta: a planta em canvas, o carimbo da folha e o símbolo final. */}
          <div className="bz-origem-sheet" aria-hidden>
            <canvas ref={canvasRef} className="bz-origem-canvas" />
            <div className="bz-origem-titleblock">
              <span>{o.sheetTitle}</span>
              <span>
                {o.sheet} {sheetNo} / VII
              </span>
            </div>
            <div className="bz-origem-crosshair" />
            {/* No celular a história fica abaixo da manivela: a legenda mantém o capítulo à vista. */}
            <div className="bz-origem-caption">
              <span>{current ? `${o.chapterLabel(ROMAN[chapter - 1]!)} · ${current.kicker}` : `${o.sheet} 0`}</span>
              <strong>{current?.title ?? o.introTitle}</strong>
            </div>
            <div ref={markRef} className="bz-origem-mark">
              <BezalelMark className="size-full" />
            </div>
          </div>

          {/* História: todos os capítulos no HTML; no modo manivela, só o atual aparece. */}
          <div className="bz-origem-story" aria-live="polite">
            <div className={cn('bz-origem-intro', chapter === 0 && 'is-active')}>
              <p className="eyebrow">{o.sheet} 0</p>
              <h3 className="mt-3 text-2xl font-semibold md:text-3xl">{o.introTitle}</h3>
              <p className="mt-3 text-fg-muted">{o.introText}</p>
            </div>
            <ol className="bz-origem-chapters">
              {o.chapters.map((c, i) => (
                <li key={c.title} className={cn('bz-origem-chapter', chapter === i + 1 && 'is-active')}>
                  <p className="eyebrow">
                    {o.chapterLabel(ROMAN[i]!)} · {c.kicker}
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold md:text-3xl">{c.title}</h3>
                  <p className="mt-3 leading-relaxed text-fg-muted">{c.text}</p>
                  <p className="mt-4 font-mono text-xs uppercase tracking-wider text-accent-text">
                    {o.source}: {c.ref}
                  </p>
                </li>
              ))}
            </ol>
            <div className={cn('bz-origem-end', chapter === TOTAL && 'is-active')}>
              <ButtonLink to="/explore" iconRight={<ArrowRight className="size-4" />}>
                {o.explore}
              </ButtonLink>
              <button type="button" onClick={restart} className="bz-origem-chip">
                <RotateCcw aria-hidden className="size-4" /> {o.restart}
              </button>
            </div>
          </div>

          {/* A manivela e seus controles. */}
          <div className="bz-origem-controls">
            <div className={cn('bz-crank', !touched && chapter === 0 && 'is-idle')}>
              <svg className="bz-crank-defs" aria-hidden width="0" height="0">
                <defs>
                  <linearGradient id={`brass-${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f0d79c" />
                    <stop offset="0.5" stopColor="#c7a86a" />
                    <stop offset="1" stopColor="#7d5f2c" />
                  </linearGradient>
                  <linearGradient id={`steel-${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#a9bdd6" />
                    <stop offset="1" stopColor="#3b5272" />
                  </linearGradient>
                </defs>
              </svg>
              <div ref={pinionRef} className="bz-gear" style={box(PINION.x, PINION.y, 30)} aria-hidden>
                <svg viewBox="-30 -30 60 60">
                  <path d={gearPath(GEARS.pinion.teeth, GEARS.pinion.pitch)} fill={`url(#brass-${uid})`} fillRule="evenodd" />
                </svg>
              </div>
              <div ref={idlerRef} className="bz-gear" style={box(IDLER.x, IDLER.y, 42)} aria-hidden>
                <svg viewBox="-42 -42 84 84">
                  <path d={gearPath(GEARS.idler.teeth, GEARS.idler.pitch, { windows: 5 })} fill={`url(#steel-${uid})`} fillRule="evenodd" />
                </svg>
              </div>
              <div ref={crownRef} className="bz-gear" style={box(CROWN.x, CROWN.y, 77)} aria-hidden>
                <svg viewBox="-77 -77 154 154">
                  <path d={gearPath(GEARS.crown.teeth, GEARS.crown.pitch, { windows: 6 })} fill={`url(#brass-${uid})`} fillRule="evenodd" />
                </svg>
              </div>
              {/* Mostrador fixo: catraca (12 marcas) e anel de progresso dos 7 capítulos. */}
              <svg className="bz-crank-face" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden>
                <circle cx={CROWN.x} cy={CROWN.y} r="58" className="bz-crank-plate" />
                {Array.from({ length: TICKS_PER_TURN }, (_, i) => {
                  const a = (i / TICKS_PER_TURN) * Math.PI * 2;
                  return (
                    <line
                      key={i}
                      x1={CROWN.x + Math.sin(a) * 49}
                      y1={CROWN.y - Math.cos(a) * 49}
                      x2={CROWN.x + Math.sin(a) * (i % 3 === 0 ? 55 : 53)}
                      y2={CROWN.y - Math.cos(a) * (i % 3 === 0 ? 55 : 53)}
                      className="bz-crank-tick"
                    />
                  );
                })}
                <circle cx={CROWN.x} cy={CROWN.y} r={PROGRESS_R} className="bz-crank-track" />
                <circle
                  ref={ringRef}
                  cx={CROWN.x}
                  cy={CROWN.y}
                  r={PROGRESS_R}
                  className="bz-crank-progress"
                  strokeDasharray={PROGRESS_LEN}
                  strokeDashoffset={PROGRESS_LEN}
                  transform={`rotate(-90 ${CROWN.x} ${CROWN.y})`}
                />
                {ROMAN.map((_, i) => {
                  const a = (i / TOTAL) * Math.PI * 2;
                  return (
                    <line
                      key={i}
                      x1={CROWN.x + Math.sin(a) * (PROGRESS_R - 4)}
                      y1={CROWN.y - Math.cos(a) * (PROGRESS_R - 4)}
                      x2={CROWN.x + Math.sin(a) * (PROGRESS_R + 4)}
                      y2={CROWN.y - Math.cos(a) * (PROGRESS_R + 4)}
                      className="bz-crank-sep"
                    />
                  );
                })}
              </svg>
              <div ref={armRef} className="bz-crank-arm" style={box(CROWN.x, CROWN.y, 58)} aria-hidden>
                <div className="bz-crank-arm-inner">
                  <svg viewBox="-58 -58 116 116">
                    <path d="M-5 -14 L-4.2 -40 L4.2 -40 L5 -14 Z" className="bz-crank-bar" />
                    <circle cx="0" cy="-44" r="11" className="bz-crank-knob" />
                    <circle cx="0" cy="-44" r="4.5" className="bz-crank-knob-core" />
                  </svg>
                </div>
              </div>
              <div className="bz-crank-hub" style={box(CROWN.x, CROWN.y, 17)} aria-hidden>
                <span>{sheetNo}</span>
              </div>
              <div
                ref={dialRef}
                role="slider"
                tabIndex={0}
                aria-label={o.dial}
                aria-valuemin={0}
                aria-valuemax={TOTAL}
                aria-valuenow={chapter}
                aria-valuetext={o.valueText(chapter, TOTAL, current?.title ?? '')}
                className="bz-crank-hit"
                style={box(CROWN.x, CROWN.y, 80)}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
              />
              <span aria-hidden className="bz-crank-hint">
                {o.hint}
              </span>
            </div>
            <div className="bz-origem-buttons">
              <button type="button" className="bz-origem-chip" onClick={() => go(-1)} disabled={chapter === 0} aria-label={o.prev}>
                <ArrowLeft aria-hidden className="size-4" />
              </button>
              <button type="button" className="bz-origem-chip" onClick={togglePlay} aria-pressed={playing}>
                {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
                <span>{playing ? o.pause : o.play}</span>
              </button>
              <button type="button" className="bz-origem-chip" onClick={() => go(1)} disabled={chapter === TOTAL} aria-label={o.next}>
                <ArrowRight aria-hidden className="size-4" />
              </button>
              <button type="button" className="bz-origem-chip" onClick={toggleSound} aria-pressed={sound} aria-label={o.sound} title={o.sound}>
                {sound ? <Volume2 aria-hidden className="size-4" /> : <VolumeX aria-hidden className="size-4" />}
              </button>
            </div>
          </div>
        </div>
        <p className="bz-origem-note">{o.note}</p>
      </div>
    </section>
  );
}
