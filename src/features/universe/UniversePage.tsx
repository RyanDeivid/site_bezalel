import { Box, Car, Check, CircleAlert, Clapperboard, Eye, Footprints, Volume2, VolumeX, Gauge, HelpCircle, Home, LogOut, Map as MapIcon, MapPin, Maximize, Minimize, Pause, Play, Plane, Smartphone, TriangleAlert } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink, IconButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ProcessingIndicator } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/toast-context';
import { SceneBoundary } from '@/components/three/SceneBoundary';
import { curated } from '@/data/catalog/store';
import { demoAgents } from '@/data/demo/agents';
import { hasWebGL, useDeviceProfile } from '@/hooks/useDeviceProfile';
import { fullscreenSupported, useFullscreen } from '@/hooks/useFullscreen';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useIsClient } from '@/hooks/useIsClient';
import { cn } from '@/lib/cn';
import { readSession, readStorage, writeSession, writeStorage } from '@/lib/storage';
import type { LandmarkTexts } from './scene/Landmarks';
import { PlaceBody } from './PlacePanel';
import { TouchControls } from './TouchControls';
import { universeContent } from './universe-content';
import { UniverseMap } from './UniverseMap';
import { CINEMA_SHOTS } from './world/cinema';
import { cityTowers, citySolids, PLACES, type PlaceId, type Quality } from './world/city';
import { PRODUCTS, productText } from './world/products';
import { arriveFromLab, attachDebug, cancelAutopilot, clearNotice, createUniverseRuntime, goToPlace, queueSound, requestExit, setCinema, toggleView, tryEnter, vehicleById } from './world/runtime';

// three.js + R3F + a cidade só são baixados quando o visitante escolhe explorar em 3D.
const UniverseScene = lazy(() => import('./scene/UniverseScene'));

type Mode = 'launcher' | '3d' | '2d';
const MODE_KEY = 'bz-universe-mode';
const QUALITY_KEY = 'bz-universe-quality';
const HELP_KEY = 'bz-universe-help-v2';
const ROTATE_KEY = 'bz-universe-rotate-dismissed';
const SOUND_KEY = 'bz-universe-sound';
const QUALITIES: Quality[] = ['low', 'medium', 'high', 'ultra'];
/** Nível em que a qualidade automática está (a sessão lembra o que o aparelho aguentou). */
const AUTO_LEVEL_KEY = 'bz-universe-auto-level';
/** Primeiro nível que já ficou pesado nesta sessão: o modo Auto não volta a subir até ele. */
const AUTO_CEILING_KEY = 'bz-universe-auto-ceiling';
/** Nível alcançado subindo, ainda em período de prova. */
const AUTO_TRIAL_KEY = 'bz-universe-auto-trial';
type QualityChoice = 'auto' | Quality;
const isQuality = (v: unknown): v is Quality => QUALITIES.includes(v as Quality);
const below = (q: Quality) => QUALITIES[Math.max(0, QUALITIES.indexOf(q) - 1)]!;
const above = (q: Quality): Quality | null => QUALITIES[QUALITIES.indexOf(q) + 1] ?? null;

/** Veio pela porta do laboratório 3D (`?from=lab`): entra direto no 3D, na porta do Laboratório de IA. */
const fromLab = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('from') === 'lab';

function savedMode(): Mode {
  if (fromLab() && hasWebGL()) return '3d';
  const saved = readSession(MODE_KEY);
  if (saved === '2d') return '2d';
  if (saved === '3d' && hasWebGL()) return '3d';
  return 'launcher';
}

/**
 * Ponto de partida da qualidade automática, simples e verificável: o nível do
 * aparelho (núcleos, memória, toque, economia de dados). Daí em diante o modo
 * Auto desce se pesar e sobe — até o Ultra, só em aparelho forte — se sobrar
 * fôlego (scene/AutoQuality.tsx).
 */
const autoQuality = (tier: 'low' | 'medium' | 'high'): Quality => tier;

interface Hud {
  mode: 'foot' | 'car' | 'hover';
  /** Transição de entrada/saída em andamento. */
  busy: boolean;
  vehicle: string | null;
  kmh: number;
  alt: number;
  notice: 'blocked' | 'braking' | 'landing' | null;
}

export default function UniversePage() {
  const { m, locale, reducedMotion } = usePreferences();
  const t = universeContent[locale];
  const { notify } = useToast();
  const device = useDeviceProfile();
  const isClient = useIsClient();
  const webgl = isClient ? hasWebGL() : true;
  useDocumentMeta({ title: m.meta.universe.title, description: m.meta.universe.description, path: '/universe' });

  const [chosenMode, setModeState] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (isClient ? savedMode() : 'launcher');
  // Escolha do visitante: um nível fixo ou "Auto" (padrão).
  const [choice, setChoice] = useState<QualityChoice>(() => {
    const saved = readSession(QUALITY_KEY);
    return isQuality(saved) ? saved : 'auto';
  });
  const [autoLevel, setAutoLevelState] = useState<Quality>(() => {
    const saved = readSession(AUTO_LEVEL_KEY);
    return isQuality(saved) ? saved : autoQuality(device.tier);
  });
  const [ceiling, setCeiling] = useState<Quality | null>(() => {
    const saved = readSession(AUTO_CEILING_KEY);
    return isQuality(saved) ? saved : null;
  });
  const [trial, setTrial] = useState<Quality | null>(() => {
    const saved = readSession(AUTO_TRIAL_KEY);
    return isQuality(saved) ? saved : null;
  });
  const quality: Quality = choice === 'auto' ? autoLevel : choice;
  const probation = choice === 'auto' && trial === autoLevel;
  const setTrialLevel = (q: Quality | null) => {
    writeSession(AUTO_TRIAL_KEY, q ?? '');
    setTrial(q);
  };
  const setAutoLevel = (q: Quality) => {
    writeSession(AUTO_LEVEL_KEY, q);
    setAutoLevelState(q);
  };
  const next = above(quality);
  const canUpgrade = choice === 'auto' && next !== null && (ceiling === null || QUALITIES.indexOf(next) < QUALITIES.indexOf(ceiling)) && (next !== 'ultra' || device.tier === 'high');
  const [effects, setEffects] = useState(!reducedMotion);
  const [near, setNear] = useState<PlaceId | null>(null);
  const [nearVehicle, setNearVehicle] = useState<string | null>(null);
  const [open, setOpen] = useState<PlaceId | null>(null);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [flying, setFlying] = useState<PlaceId | null>(null);
  const [presenting, setPresenting] = useState(false);
  // Som da cidade (lembrado no aparelho): ligado por padrão, com o botão no HUD e a tecla M.
  const [sound, setSoundState] = useState(() => readStorage(SOUND_KEY) !== 'off');
  const toggleSound = useCallback(() => {
    setSoundState((on) => {
      writeStorage(SOUND_KEY, on ? 'off' : 'on');
      return !on;
    });
  }, []);
  const [runtime] = useState(() => {
    const rt = createUniverseRuntime();
    if (fromLab()) arriveFromLab(rt);
    return rt;
  });
  // Câmera do veículo: de fora ou de dentro (primeira pessoa, com o painel). Tecla V.
  const [inside, setInside] = useState(false);
  const toggleInside = useCallback(() => {
    toggleView(runtime);
    setInside(runtime.camera.view === 'first');
  }, [runtime]);
  const [debug] = useState(() => readStorage('bz-universe-debug') === '1');
  // A cena só aparece depois de preparada (shaders e texturas); trocar a qualidade recria o canvas.
  const [readyQuality, setReadyQuality] = useState<Quality | null>(null);
  const sceneReady = readyQuality === quality;
  const solids = useMemo(() => citySolids(quality), [quality]);

  const setMode = useCallback((next: Mode) => {
    if (next !== 'launcher') writeSession(MODE_KEY, next);
    if (next !== '3d') setPresenting(false);
    setModeState(next);
  }, []);
  const setQuality = (q: QualityChoice) => {
    writeSession(QUALITY_KEY, q);
    setChoice(q);
  };

  // Orientação na primeira entrada no 3D (depois, fica no botão "Controles").
  const enter3d = () => {
    setMode('3d');
    if (readStorage(HELP_KEY) !== 'seen') setHelpOpen(true);
  };
  const closeHelp = () => {
    writeStorage(HELP_KEY, 'seen');
    setHelpOpen(false);
  };

  const published = useMemo(() => curated().filter((c) => c.publicationStatus === 'published'), []);
  const mapTowers = useMemo(() => cityTowers('low'), []);
  const facts = t.panel.facts(demoAgents.length, published.length);
  const liveProducts = useMemo(() => PRODUCTS.filter((p) => p.status === 'live').map((p) => productText(p, m)), [m]);
  const texts: LandmarkTexts = useMemo(
    () => ({
      names: Object.fromEntries(PLACES.map((p) => [p.id, t.places[p.id].name])) as Record<PlaceId, string>,
      labPanel: { title: t.places['ai-lab'].name, lines: demoAgents.map((a) => `${a.name} — ${a.role[locale]}`), footer: t.panel.labFooter(published.length) },
      productsPanel: { title: t.places['products-center'].name, lines: liveProducts.map((p) => p.title), footer: t.panel.productsFooter },
      hqSign: 'Bezalel',
      productsSign: t.places['products-center'].kicker,
    }),
    [t, locale, published.length, liveProducts],
  );
  const billboards = useMemo(() => liveProducts.map((p) => ({ title: p.title, line: p.description.split(/[.:—]/)[0]!.slice(0, 60) })), [liveProducts]);

  /** "Ir até aqui": voo automático (no carro voador) ou transporte rápido. */
  const goTo = useCallback(
    (id: PlaceId) => {
      setOpen(null);
      setPlacesOpen(false);
      const r = goToPlace(runtime, id, solids, reducedMotion);
      setFlying(r === 'flying' ? id : null);
    },
    [runtime, solids, reducedMotion],
  );
  // Modo apresentação: a câmera percorre a região principal em tomadas de cinema; a interface se recolhe.
  const startPresentation = useCallback(() => {
    setOpen(null);
    setPlacesOpen(false);
    setPresenting(true);
  }, []);
  const stopPresentation = useCallback(() => setPresenting(false), []);
  useEffect(() => setCinema(runtime, presenting), [runtime, presenting]);
  // Sinal suave ao abrir o painel de um local.
  useEffect(() => {
    if (open) queueSound(runtime, 'chime');
  }, [open, runtime]);
  const takeControl = () => {
    cancelAutopilot(runtime);
    setFlying(null);
  };

  /** Ação contextual (E, botão A do controle ou o botão central do HUD): entrar, sair ou abrir o local. */
  const interact = useCallback(() => {
    if (open || helpOpen) return;
    if (runtime.mode === 'driving') return requestExit(runtime);
    if (runtime.mode !== 'foot') return;
    if (tryEnter(runtime)) return;
    if (runtime.near) setOpen(runtime.near);
  }, [runtime, open, helpOpen]);

  // Gancho de inspeção só para os testes de navegador (ativado por localStorage).
  useEffect(() => {
    if (mode !== '3d' || !debug) return;
    return attachDebug(runtime);
  }, [mode, runtime, debug]);

  const stageRef = useRef<HTMLElement>(null);
  const fullscreen = useFullscreen(stageRef);
  const canFullscreen = isClient && fullscreenSupported();
  const portrait = useMediaQuery('(orientation: portrait)');
  const [rotateDismissed, setRotateDismissed] = useState(() => readSession(ROTATE_KEY) === '1');
  const showRotate = device.coarse && portrait && !rotateDismissed && mode === '3d';
  const dismissRotate = () => {
    writeSession(ROTATE_KEY, '1');
    setRotateDismissed(true);
  };
  const { active: fullscreenActive, enter: enterFullscreen, exit: exitFullscreen } = fullscreen;
  const toggleFullscreen = useCallback(
    () => (fullscreenActive ? exitFullscreen() : enterFullscreen({ landscape: device.coarse })),
    [fullscreenActive, enterFullscreen, exitFullscreen, device.coarse],
  );

  // Ações que a cena 3D chama. A cena é memorizada: se recebesse funções novas a cada atualização do HUD
  // (o velocímetro muda 5× por segundo dirigindo), o React reconciliaria a cidade inteira a cada vez —
  // um quadro perdido por atualização. As funções passadas são estáveis e chamam sempre a versão atual.
  const live = useRef<{ onAutopilotEnd: () => void; onInteract: () => void; onLowPerformance: () => void; onHeadroom: () => void; onContextLost: () => void } | null>(null);
  useLayoutEffect(() => {
    live.current = {
      onAutopilotEnd: () => setFlying(null),
      onInteract: interact,
      onLowPerformance: () => {
        if (quality === 'low') return;
        // No Auto, o nível que pesou vira o teto da sessão; num nível fixo, a escolha desce um.
        if (choice === 'auto') {
          writeSession(AUTO_CEILING_KEY, quality);
          setCeiling(quality);
          setAutoLevel(below(quality));
          setTrialLevel(null);
        } else setQuality(below(quality));
        notify({ tone: 'info', message: probation ? t.hud.trialFailed(t.hud.qualityNames[quality]) : t.hud.lowFps });
      },
      onHeadroom: () => {
        if (!canUpgrade || !next) return;
        setAutoLevel(next);
        setTrialLevel(next);
        notify({ tone: 'info', message: t.hud.highFps(t.hud.qualityNames[next]) });
      },
      onContextLost: () => {
        notify({ tone: 'error', message: t.hud.lost });
        setMode('2d');
      },
    };
  });
  const sceneHandlers = useMemo(
    () => ({
      onAutopilotEnd: () => live.current?.onAutopilotEnd(),
      onInteract: () => live.current?.onInteract(),
      onLowPerformance: () => live.current?.onLowPerformance(),
      onHeadroom: () => live.current?.onHeadroom(),
      onContextLost: () => live.current?.onContextLost(),
    }),
    [],
  );

  // Atalhos do palco: E (ação do momento), H (voltar ao início), F (tela cheia), C (apresentação; Esc sai dela).
  useEffect(() => {
    if (mode !== '3d') return;
    const onKey = (e: KeyboardEvent) => {
      if (open || helpOpen || (e.target as HTMLElement | null)?.closest('input, textarea, select, dialog')) return;
      const k = e.key.toLowerCase();
      if (presenting) {
        if (k === 'escape' || (k === 'c' && !e.repeat)) stopPresentation();
        else if (k === 'm' && !e.repeat) toggleSound();
        else if (k === 'f' && !e.repeat && canFullscreen) toggleFullscreen();
        return;
      }
      if (k === 'm' && !e.repeat) toggleSound();
      else if (k === 'v' && !e.repeat) toggleInside();
      else if (k === 'c' && !e.repeat) startPresentation();
      else if (k === 'e' && !e.repeat) interact();
      else if (k === 'h') goTo('arrival');
      else if (k === 'f' && !e.repeat && canFullscreen) toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, open, helpOpen, interact, goTo, canFullscreen, toggleFullscreen, presenting, startPresentation, stopPresentation, toggleSound, toggleInside]);

  useEffect(() => {
    if (mode !== '3d') void fullscreen.exit();
  }, [mode, fullscreen]);
  useEffect(() => {
    if (mode !== '3d') return;
    const id = requestAnimationFrame(() => stageRef.current?.scrollIntoView?.({ block: 'end' }));
    return () => cancelAnimationFrame(id);
  }, [mode]);

  // Estado do HUD (modo, veículo, velocidade, avisos) — lido do jogo 5× por segundo, não a cada quadro.
  const [hud, setHud] = useState<Hud>({ mode: 'foot', busy: false, vehicle: null, kmh: 0, alt: 0, notice: null });
  useEffect(() => {
    if (mode !== '3d') return;
    const id = setInterval(() => {
      const v = vehicleById(runtime, runtime.active);
      const inVehicle = runtime.mode === 'driving' && v;
      const speed = !inVehicle ? 0 : v.kind === 'car' ? v.car.speed : v.craft.speed;
      setHud((prev) => {
        const next: Hud = {
          mode: inVehicle ? (v.kind === 'car' ? 'car' : 'hover') : 'foot',
          busy: runtime.mode === 'entering' || runtime.mode === 'exiting',
          vehicle: v?.id ?? null,
          kmh: Math.round(Math.abs(speed) * 3.6),
          alt: inVehicle && v.kind === 'hover' ? Math.round(v.craft.y) : 0,
          notice: runtime.notice,
        };
        return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
      });
    }, 200);
    return () => clearInterval(id);
  }, [mode, runtime]);
  // O aviso de "sem espaço para descer" some sozinho.
  useEffect(() => {
    if (hud.notice !== 'blocked') return;
    const id = setTimeout(() => clearNotice(runtime), 2800);
    return () => clearTimeout(id);
  }, [hud.notice, runtime]);

  const vehicleName = (id: string | null) => (id ? (t.vehicles[id] ?? id) : '');
  const modeLabel = hud.mode === 'car' ? t.hud.modes.car(vehicleName(hud.vehicle)) : hud.mode === 'hover' ? t.hud.modes.hover : t.hud.modes.foot;
  const ModeIcon = hud.mode === 'car' ? Car : hud.mode === 'hover' ? Plane : Footprints;
  // Ação principal do momento (o mesmo que a tecla E).
  const action = hud.busy ? null : hud.mode !== 'foot' ? t.hud.exitVehicle : nearVehicle ? t.hud.enter(vehicleName(nearVehicle)) : near && !open ? t.hud.near(t.places[near].name) : null;

  const header = (
    <div className="container-page flex flex-wrap items-end justify-between gap-4 py-8">
      <div className="max-w-2xl">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="text-title mt-3">{t.title}</h1>
        <p className="mt-2 text-fg-muted">{t.lead}</p>
      </div>
      <div className="flex max-w-sm items-start gap-3 rounded-xl border border-demo/30 p-3 text-xs text-fg-muted hatch-demo">
        <Badge tone="demo">{t.hud.badge}</Badge>
        <span>{t.note}</span>
      </div>
    </div>
  );

  const placeCards = (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {PLACES.map((p) => (
        <li key={p.id} id={`universe-${p.id}`} className="panel scroll-mt-24 p-6">
          <p className="eyebrow">{t.places[p.id].kicker}</p>
          <h3 className="mt-2 text-xl font-semibold">{t.places[p.id].name}</h3>
          <div className="mt-3">
            <PlaceBody id={p.id} facts={facts} />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {mode === 'launcher' && (
        <>
          {header}
          <section className="container-page pb-16">
            <h2 className="sr-only">{t.launcher.enter3d}</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-bg-abyss via-surface to-bg p-8">
                <div aria-hidden className="bg-blueprint absolute inset-0 opacity-60" />
                <BezalelMark className="absolute -right-6 -top-6 size-40 text-fg opacity-10" />
                <div className="relative">
                  <Box aria-hidden className="size-8 text-accent-text" />
                  <h3 className="mt-5 text-2xl font-semibold">{t.launcher.enter3d}</h3>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className={cn('flex items-start gap-2', webgl ? 'text-fg-muted' : 'text-danger')}>
                      {webgl ? <Check aria-hidden className="mt-0.5 size-4 text-ok" /> : <TriangleAlert aria-hidden className="mt-0.5 size-4" />}
                      {webgl ? t.launcher.webglOk : t.launcher.webglMissing}
                    </li>
                    {isClient && webgl && device.tier !== 'high' && (
                      <li className="flex items-start gap-2 text-fg-muted">
                        <Gauge aria-hidden className="mt-0.5 size-4 text-warn" /> {t.launcher.lowPower}
                      </li>
                    )}
                    {reducedMotion && (
                      <li className="flex items-start gap-2 text-fg-muted">
                        <CircleAlert aria-hidden className="mt-0.5 size-4 text-warn" /> {t.launcher.reducedMotion}
                      </li>
                    )}
                    {isClient && device.coarse && (
                      <li className="flex items-start gap-2 text-fg-muted">
                        <Smartphone aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" /> {t.launcher.rotateTip}
                      </li>
                    )}
                    <li className="text-xs text-fg-subtle">{t.launcher.sizeNote}</li>
                  </ul>
                  <Button size="lg" className="mt-6" disabled={!webgl} onClick={enter3d} iconLeft={<Box className="size-4" />}>
                    {t.launcher.enter3d}
                  </Button>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-8">
                <MapIcon aria-hidden className="size-8 text-accent-text" />
                <h3 className="mt-5 text-2xl font-semibold">{t.launcher.open2d}</h3>
                <p className="mt-4 text-sm text-fg-muted">{t.launcher.mapLead}</p>
                <Button size="lg" variant="secondary" className="mt-6" onClick={() => setMode('2d')} iconLeft={<MapIcon className="size-4" />}>
                  {t.launcher.open2d}
                </Button>
              </div>
            </div>
          </section>
        </>
      )}

      {mode === '3d' && (
        <section
          ref={stageRef}
          data-universe-stage
          data-player-mode={hud.mode}
          aria-label={t.title}
          className={cn('relative overflow-hidden bg-bg-abyss', fullscreen.active ? 'h-[100dvh]' : 'h-[calc(100dvh-var(--header-h))] min-h-[min(560px,calc(100dvh-var(--header-h)))]')}
        >
          <SceneBoundary
            onError={() => {
              notify({ tone: 'error', message: t.hud.lost });
              setMode('2d');
            }}
          >
            <Suspense
              fallback={
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-4">
                    <BezalelMark animated className="size-16 text-fg" />
                    <ProcessingIndicator label={t.launcher.loading} />
                  </div>
                </div>
              }
            >
              <UniverseScene
                runtime={runtime}
                quality={quality}
                effects={effects}
                calmCamera={reducedMotion}
                presenting={presenting}
                sound={sound}
                inputEnabled={!open && !helpOpen && !presenting}
                near={near}
                texts={texts}
                billboards={billboards}
                onSelect={setOpen}
                onNearChange={setNear}
                onNearVehicleChange={setNearVehicle}
                onAutopilotEnd={sceneHandlers.onAutopilotEnd}
                onInteract={sceneHandlers.onInteract}
                canUpgrade={canUpgrade}
                probation={probation}
                onLowPerformance={sceneHandlers.onLowPerformance}
                onHeadroom={sceneHandlers.onHeadroom}
                debug={debug}
                onReady={setReadyQuality}
                onContextLost={sceneHandlers.onContextLost}
              />
            </Suspense>
          </SceneBoundary>
          {/* Enquanto o Warmup prepara a cena (o canvas ainda não desenha): a mesma tela do carregamento. */}
          {!sceneReady && (
            <div className="absolute inset-0 z-[1] grid place-items-center bg-bg-abyss" role="status" aria-live="polite">
              <div className="flex flex-col items-center gap-4">
                <BezalelMark animated className="size-16 text-fg" />
                <ProcessingIndicator label={t.launcher.preparing} />
              </div>
            </div>
          )}

          {presenting && <CinemaOverlay runtime={runtime} names={t.hud.cinemaShots} exitLabel={t.hud.exitPresent} onExit={stopPresentation} />}
          {!presenting && (
          <>
          {/* HUD superior: identidade, modo atual e locais | ajustes */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 md:p-4">
            <div className="flex flex-col items-start gap-2">
              <div className="glass pointer-events-auto flex items-center gap-3 rounded-xl px-3 py-2">
                <BezalelMark className="size-6 text-fg" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Bezalel Universe</p>
                  <p className="flex items-center gap-1.5 text-xs text-fg-muted" role="status">
                    <ModeIcon aria-hidden className="size-3.5 text-accent-text" />
                    {modeLabel}
                  </p>
                </div>
              </div>
              <div className="pointer-events-auto">
                <Button variant="secondary" size="sm" className="glass" aria-expanded={placesOpen} aria-controls="universe-places" onClick={() => setPlacesOpen((v) => !v)} iconLeft={<MapPin className="size-4" />}>
                  {t.hud.places}
                </Button>
                {placesOpen && (
                  <nav id="universe-places" aria-label={t.hud.places} className="glass mt-2 w-64 rounded-xl p-1.5">
                    <ul>
                      {PLACES.map((p) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => setOpen(p.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
                            <span>{t.places[p.id].name}</span>
                            <span className="font-mono text-[0.65rem] uppercase tracking-wider text-fg-subtle">{t.places[p.id].kicker}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </div>
            </div>
            <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
              <div className="glass flex items-center gap-1 rounded-xl p-1">
                <IconButton label={effects ? t.hud.pause : t.hud.resume} onClick={() => setEffects((v) => !v)} active={!effects} size="sm">
                  {effects ? <Pause className="size-4" /> : <Play className="size-4" />}
                </IconButton>
                <div role="radiogroup" aria-label={t.hud.quality} className="flex items-center rounded-lg border border-line px-0.5">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={choice === 'auto'}
                    title={t.hud.qualityAutoNow(t.hud.qualityNames[quality])}
                    onClick={() => setQuality('auto')}
                    className={cn('h-7 rounded-md px-2 text-xs transition-colors', choice === 'auto' ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-muted hover:text-fg')}
                  >
                    {t.hud.qualityAuto}
                  </button>
                  {QUALITIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      role="radio"
                      aria-checked={choice === q}
                      onClick={() => setQuality(q)}
                      className={cn(
                        'h-7 rounded-md px-2 text-xs transition-colors',
                        choice === q ? 'bg-accent-soft font-semibold text-fg' : choice === 'auto' && quality === q ? 'text-fg underline decoration-accent underline-offset-4' : 'text-fg-muted hover:text-fg',
                      )}
                    >
                      {t.hud.qualityNames[q]}
                    </button>
                  ))}
                </div>
                {hud.mode !== 'foot' && (
                  <IconButton label={`${inside ? t.hud.viewOutside : t.hud.viewInside} (V)`} onClick={toggleInside} active={inside} size="sm">
                    <Eye className="size-4" />
                  </IconButton>
                )}
                <IconButton label={`${sound ? t.hud.mute : t.hud.unmute} (M)`} onClick={toggleSound} active={!sound} size="sm">
                  {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </IconButton>
                <IconButton label={`${t.hud.present} (C)`} onClick={startPresentation} size="sm">
                  <Clapperboard className="size-4" />
                </IconButton>
                <IconButton label={t.hud.help} onClick={() => setHelpOpen(true)} size="sm">
                  <HelpCircle className="size-4" />
                </IconButton>
                <IconButton label={t.hud.map} onClick={() => setMode('2d')} size="sm">
                  <MapIcon className="size-4" />
                </IconButton>
              </div>
              {canFullscreen && (
                <Button
                  variant={fullscreen.active ? 'secondary' : 'primary'}
                  size="sm"
                  className={cn(fullscreen.active && 'glass')}
                  aria-pressed={fullscreen.active}
                  aria-keyshortcuts="F"
                  title={`${fullscreen.active ? t.hud.exitFullscreen : t.hud.fullscreen} (F)`}
                  onClick={toggleFullscreen}
                  iconLeft={fullscreen.active ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                >
                  <span className="max-md:sr-only">{fullscreen.active ? t.hud.exitFullscreen : t.hud.fullscreen}</span>
                  <span aria-hidden className="kbd ml-1 hidden lg:inline">
                    F
                  </span>
                </Button>
              )}
              <ButtonLink to="/" variant="secondary" size="sm" className="glass" iconLeft={<LogOut className="size-4" />}>
                <span className="max-sm:sr-only">{t.hud.exit}</span>
              </ButtonLink>
            </div>
          </div>

          {/* Centro inferior: piloto automático, aviso ou a ação do momento */}
          <div className={cn('absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2', device.coarse ? 'bottom-28 landscape:bottom-4' : 'bottom-6')}>
            {hud.notice && (
              <p className="glass rounded-lg px-3 py-1.5 text-sm" role="status">
                {t.hud.notices[hud.notice]}
              </p>
            )}
            {flying ? (
              <div className="glass page-enter flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm shadow-3" role="status">
                <span>{t.hud.flying(t.places[flying].name)}</span>
                <Button size="sm" variant="secondary" onClick={takeControl}>
                  {t.hud.cancel}
                </Button>
              </div>
            ) : (
              action && (
                <button type="button" onClick={interact} className="page-enter glass flex items-center gap-3 rounded-xl border border-accent/60 px-4 py-2.5 text-sm shadow-3">
                  <span className="kbd hidden md:inline">{t.hud.pressE}</span>
                  <span className="font-mono text-xs uppercase text-fg-subtle md:hidden">{t.hud.tap}</span>
                  <span className="font-medium">{action}</span>
                </button>
              )
            )}
          </div>

          {/* Painel do veículo: velocidade (e altitude, no voador) */}
          {hud.mode !== 'foot' && (
            <div className={cn('glass absolute rounded-xl px-4 py-2 text-right', device.coarse ? 'right-4 top-24' : 'bottom-6 right-4')} aria-hidden>
              <p className="font-mono text-2xl font-semibold tabular-nums">{hud.kmh}</p>
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-fg-subtle">km/h{hud.mode === 'hover' ? ` · ${t.hud.altitude(hud.alt)}` : ''}</p>
            </div>
          )}

          {/* Controles: toque (por modo) ou dica de teclado no desktop */}
          {device.coarse ? (
            !hud.busy && <TouchControls runtime={runtime} mode={hud.mode} labels={t.hud} />
          ) : (
            <div className="glass absolute bottom-4 left-4 hidden max-w-xs rounded-xl px-3 py-2.5 text-xs text-fg-muted md:block">
              <p>
                {hud.mode === 'foot' ? (
                  <>
                    <span className="kbd">WASD</span> · <span className="kbd">Shift</span> · <span className="kbd">E</span>
                  </>
                ) : hud.mode === 'car' ? (
                  <>
                    <span className="kbd">W</span>/<span className="kbd">S</span> · <span className="kbd">A</span>/<span className="kbd">D</span> · <span className="kbd">Espaço</span> · <span className="kbd">E</span>
                  </>
                ) : (
                  <>
                    <span className="kbd">WASD</span> · <span className="kbd">↑</span>/<span className="kbd">↓</span> {t.hud.liftHint} · <span className="kbd">E</span>
                  </>
                )}
              </p>
              <button type="button" onClick={() => setHelpOpen(true)} className="mt-1 underline underline-offset-2 hover:text-fg">
                {t.hud.help}
              </button>
            </div>
          )}

          {!device.coarse && hud.mode === 'foot' && (
            <div className="absolute bottom-4 right-4">
              <Button variant="secondary" size="sm" className="glass" onClick={() => goTo('arrival')} iconLeft={<Home className="size-4" />}>
                {t.hud.home}
              </Button>
            </div>
          )}
          {!effects && (
            <p className="glass absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-3 py-1 text-xs text-fg-muted" role="status">
              {t.hud.paused}
            </p>
          )}
          </>
          )}

          {/* Celular em pé: sugere deitar o aparelho (e a tela cheia na horizontal, onde existir) */}
          {showRotate && (
            <div className="absolute inset-x-3 top-1/2 z-10 -translate-y-1/2">
              <div className="glass page-enter mx-auto max-w-sm rounded-2xl p-5 text-center shadow-3" role="dialog" aria-labelledby="universe-rotate">
                <Smartphone aria-hidden className="bz-rotate-hint mx-auto size-10 text-accent-text" />
                <h2 id="universe-rotate" className="mt-3 text-lg font-semibold">
                  {t.rotate.title}
                </h2>
                <p className="mt-2 text-sm text-fg-muted">{t.rotate.body}</p>
                <div className="mt-4 flex flex-col gap-2">
                  {canFullscreen && (
                    <Button
                      onClick={() => {
                        dismissRotate();
                        void fullscreen.enter({ landscape: true });
                      }}
                      iconLeft={<Maximize className="size-4" />}
                    >
                      {t.rotate.fullscreen}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={dismissRotate}>
                    {t.rotate.dismiss}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {mode === '2d' && (
        <>
          {header}
          <section className="container-page grid grid-cols-1 gap-8 pb-16 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{t.map.title}</h2>
                  <p className="text-sm text-fg-muted">{t.map.lead}</p>
                </div>
                {webgl && (
                  <Button variant="secondary" size="sm" onClick={enter3d} iconLeft={<Box className="size-4" />}>
                    {t.map.switch3d}
                  </Button>
                )}
              </div>
              <div className="mt-6 rounded-2xl border border-line bg-bg-deep p-3 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
                <UniverseMap towers={mapTowers} />
              </div>
            </div>
            <div className="lg:col-span-7">{placeCards}</div>
          </section>
        </>
      )}

      {/* Painel do local */}
      <Dialog open={open !== null} onClose={() => setOpen(null)} variant="drawer" title={open ? t.places[open].name : ''} description={open ? t.places[open].kicker : undefined}>
        {open && <PlaceBody id={open} facts={facts} onFly={mode === '3d' && open !== near ? () => goTo(open) : undefined} />}
      </Dialog>

      {/* Orientação (primeira entrada e botão "Controles") */}
      <Dialog
        open={helpOpen}
        onClose={closeHelp}
        title={t.help.title}
        description={t.help.lead}
        footer={
          <Button onClick={closeHelp} className="w-full sm:w-auto">
            {t.help.start}
          </Button>
        }
      >
        <div className="space-y-4 text-sm">
          {[...t.help.sections, { title: '', keys: t.help.general }].map((sec, i) => (
            <div key={i}>
              {sec.title && <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{sec.title}</h3>}
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                {sec.keys.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt>
                      <span className="kbd">{k}</span>
                    </dt>
                    <dd className="text-fg-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <p className="text-fg-muted">{t.help.gamepad}</p>
          <p className="text-fg-muted">{t.help.touch}</p>
          <p>{t.help.places}</p>
        </div>
      </Dialog>
    </>
  );
}

/**
 * Moldura do modo apresentação: faixas de cinema em cima e embaixo, a fusão
 * para o escuro entre as tomadas (a opacidade vem da cena, quadro a quadro,
 * sem renderizar o React) e o nome da tomada, com o botão de sair.
 */
function CinemaOverlay({ runtime, names, exitLabel, onExit }: { runtime: ReturnType<typeof createUniverseRuntime>; names: Record<(typeof CINEMA_SHOTS)[number]['id'], string>; exitLabel: string; onExit: () => void }) {
  const fade = useRef<HTMLDivElement>(null);
  const [shot, setShot] = useState(0);
  useEffect(() => {
    let id = 0;
    let last = -1;
    const tick = () => {
      const c = runtime.cinema;
      if (c) {
        if (fade.current) fade.current.style.opacity = String(c.fade);
        if (c.shot !== last) {
          last = c.shot;
          setShot(c.shot);
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [runtime]);
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[9%] bg-bg-abyss" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[9%] bg-bg-abyss" />
      <div ref={fade} aria-hidden className="pointer-events-none absolute inset-0 bg-bg-abyss opacity-100" />
      <div className="absolute inset-x-0 bottom-[9%] flex items-end justify-between gap-3 p-4 md:p-6">
        <p className="glass rounded-lg px-3 py-1.5 text-sm font-semibold tracking-wide md:text-base" role="status" aria-live="polite">
          {names[CINEMA_SHOTS[shot]!.id]}
        </p>
        <Button variant="secondary" size="sm" className="glass" aria-keyshortcuts="Escape" onClick={onExit}>
          {exitLabel}
          <span aria-hidden className="kbd ml-1 hidden lg:inline">
            Esc
          </span>
        </Button>
      </div>
    </>
  );
}
