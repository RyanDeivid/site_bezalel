import { ArrowDown, ArrowUp, Box, Check, CircleAlert, Gauge, HelpCircle, Home, LogOut, Map as MapIcon, MapPin, Maximize, Minimize, Pause, Play, Smartphone, Sparkles, TriangleAlert, Zap } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink, IconButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ProcessingIndicator } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/toast-context';
import { Joystick } from '@/components/three/Joystick';
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
import { universeContent } from './universe-content';
import { UniverseMap } from './UniverseMap';
import { citySolids, PLACES, placeById, skylineTowers, type PlaceId } from './world/city';
import { planAutopilot } from './world/flight';
import { PRODUCTS, productText } from './world/products';
import { cancelAutopilot, createUniverseRuntime, type UniverseRuntime } from './world/runtime';

// three.js + R3F + a cidade só são baixados quando o visitante escolhe pilotar em 3D.
const UniverseScene = lazy(() => import('./scene/UniverseScene'));

type Mode = 'launcher' | '3d' | '2d';
type Quality = 'high' | 'low';
const MODE_KEY = 'bz-universe-mode';
const QUALITY_KEY = 'bz-universe-quality';
const HELP_KEY = 'bz-universe-help-v1';
const ROTATE_KEY = 'bz-universe-rotate-dismissed';

function savedMode(): Mode {
  const saved = readSession(MODE_KEY);
  if (saved === '2d') return '2d';
  if (saved === '3d' && hasWebGL()) return '3d';
  return 'launcher';
}

/** Leva o carro até um local: voo com piloto automático ou, com movimento reduzido, direto. */
function sendTo(rt: UniverseRuntime, id: PlaceId, quality: Quality, instant: boolean) {
  const p = placeById(id);
  const to = { x: p.pad.x, z: p.pad.z, y: p.padAltitude, yaw: p.padHeading };
  const c = rt.craft;
  if (instant) {
    Object.assign(c, { x: to.x, y: to.y, z: to.z, yaw: to.yaw, speed: 0, climb: 0, turnRate: 0 });
    rt.autopilot = null;
    rt.camera.orbit = 0;
    return;
  }
  rt.autopilot = { ...planAutopilot(c, to, citySolids(quality)), place: id };
}

const holdButton = (rt: UniverseRuntime, key: 'up' | 'down' | 'boost') => ({
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    rt.buttons[key] = true;
  },
  onPointerUp: () => (rt.buttons[key] = false),
  onPointerCancel: () => (rt.buttons[key] = false),
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
});

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
  const [quality, setQualityState] = useState<Quality>(() => {
    const saved = readSession(QUALITY_KEY);
    return saved === 'high' || saved === 'low' ? saved : device.tier === 'high' ? 'high' : 'low';
  });
  const [effects, setEffects] = useState(!reducedMotion);
  const [near, setNear] = useState<PlaceId | null>(null);
  const [open, setOpen] = useState<PlaceId | null>(null);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [flying, setFlying] = useState<PlaceId | null>(null);
  const [runtime] = useState(createUniverseRuntime);

  const setMode = useCallback((next: Mode) => {
    if (next !== 'launcher') writeSession(MODE_KEY, next);
    setModeState(next);
  }, []);
  const setQuality = (q: Quality) => {
    writeSession(QUALITY_KEY, q);
    setQualityState(q);
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
  const towers = useMemo(() => skylineTowers('low'), []);
  const facts = t.panel.facts(demoAgents.length, published.length);
  const texts: LandmarkTexts = useMemo(
    () => ({
      names: Object.fromEntries(PLACES.map((p) => [p.id, t.places[p.id].name])) as Record<PlaceId, string>,
      labPanel: { title: t.places['ai-lab'].name, lines: demoAgents.map((a) => `${a.name} — ${a.role[locale]}`), footer: t.panel.labFooter(published.length) },
      productsPanel: { title: t.places['products-center'].name, lines: PRODUCTS.filter((p) => p.status === 'live').map((p) => productText(p, m).title), footer: t.panel.productsFooter },
      hqSign: 'Bezalel',
      productsSign: t.places['products-center'].kicker,
    }),
    [t, m, locale, published.length],
  );

  const flyTo = useCallback(
    (id: PlaceId) => {
      setOpen(null);
      setPlacesOpen(false);
      sendTo(runtime, id, quality, reducedMotion);
      setFlying(reducedMotion ? null : id);
    },
    [runtime, quality, reducedMotion],
  );
  const takeControl = () => {
    cancelAutopilot(runtime);
    setFlying(null);
  };

  // E abre o local próximo; H volta ao início (só no 3D, fora de campos e diálogos).
  useEffect(() => {
    if (mode !== '3d') return;
    const onKey = (e: KeyboardEvent) => {
      if (open || helpOpen || (e.target as HTMLElement | null)?.closest('input, textarea, select, dialog')) return;
      const k = e.key.toLowerCase();
      if (k === 'e' && runtime.near) setOpen(runtime.near);
      else if (k === 'h') flyTo('arrival');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, open, helpOpen, runtime, flyTo]);

  // O palco ocupa a tela abaixo do cabeçalho fixo: ao entrar, rola até que a faixa
  // de demonstração (acima do cabeçalho) saia de vista e nada fique cortado.
  const stageRef = useRef<HTMLElement>(null);
  // Tela cheia do palco (sem o cabeçalho do site) e, no celular, a sugestão de deitar o aparelho.
  const fullscreen = useFullscreen(stageRef);
  const canFullscreen = isClient && fullscreenSupported();
  const portrait = useMediaQuery('(orientation: portrait)');
  const [rotateDismissed, setRotateDismissed] = useState(() => readSession(ROTATE_KEY) === '1');
  const showRotate = device.coarse && portrait && !rotateDismissed && mode === '3d';
  const dismissRotate = () => {
    writeSession(ROTATE_KEY, '1');
    setRotateDismissed(true);
  };
  const toggleFullscreen = () => (fullscreen.active ? fullscreen.exit() : fullscreen.enter({ landscape: device.coarse }));
  useEffect(() => {
    if (mode !== '3d') void fullscreen.exit();
  }, [mode, fullscreen]);
  useEffect(() => {
    if (mode !== '3d') return;
    const id = requestAnimationFrame(() => stageRef.current?.scrollIntoView?.({ block: 'end' }));
    return () => cancelAnimationFrame(id);
  }, [mode]);

  // Velocidade e altitude no HUD (4× por segundo: não precisa de mais).
  const [telemetry, setTelemetry] = useState({ alt: 0, kmh: 0 });
  useEffect(() => {
    if (mode !== '3d') return;
    const id = setInterval(() => setTelemetry({ alt: Math.round(runtime.craft.y), kmh: Math.round(Math.abs(runtime.craft.speed) * 3.6) }), 250);
    return () => clearInterval(id);
  }, [mode, runtime]);

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
                inputEnabled={!open && !helpOpen}
                near={near}
                texts={texts}
                onSelect={setOpen}
                onNearChange={setNear}
                onAutopilotEnd={() => setFlying(null)}
                onLowPerformance={() => {
                  setQuality('low');
                  notify({ tone: 'info', message: t.hud.lowFps });
                }}
                onContextLost={() => {
                  notify({ tone: 'error', message: t.hud.lost });
                  setMode('2d');
                }}
              />
            </Suspense>
          </SceneBoundary>

          {/* HUD superior: identidade + locais | ajustes */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 md:p-4">
            <div className="flex flex-col items-start gap-2">
              <div className="glass pointer-events-auto flex items-center gap-3 rounded-xl px-3 py-2">
                <BezalelMark className="size-6 text-fg" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Bezalel Universe</p>
                  <p className="font-mono text-[0.68rem] uppercase tracking-wider text-fg-subtle">{t.hud.badge}</p>
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
              <div className="glass flex gap-1 rounded-xl p-1">
                <IconButton label={effects ? t.hud.pause : t.hud.resume} onClick={() => setEffects((v) => !v)} active={!effects} size="sm">
                  {effects ? <Pause className="size-4" /> : <Play className="size-4" />}
                </IconButton>
                <IconButton label={quality === 'high' ? t.hud.qualityLow : t.hud.qualityHigh} onClick={() => setQuality(quality === 'high' ? 'low' : 'high')} active={quality === 'low'} size="sm">
                  {quality === 'high' ? <Sparkles className="size-4" /> : <Gauge className="size-4" />}
                </IconButton>
                <IconButton label={t.hud.help} onClick={() => setHelpOpen(true)} size="sm">
                  <HelpCircle className="size-4" />
                </IconButton>
                <IconButton label={t.hud.map} onClick={() => setMode('2d')} size="sm">
                  <MapIcon className="size-4" />
                </IconButton>
                {canFullscreen && (
                  <IconButton label={fullscreen.active ? t.hud.exitFullscreen : t.hud.fullscreen} onClick={toggleFullscreen} active={fullscreen.active} size="sm">
                    {fullscreen.active ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                  </IconButton>
                )}
              </div>
              <ButtonLink to="/" variant="secondary" size="sm" className="glass" iconLeft={<LogOut className="size-4" />}>
                <span className="max-sm:sr-only">{t.hud.exit}</span>
              </ButtonLink>
            </div>
          </div>

          {/* Centro inferior: piloto automático ou convite para entrar no local próximo */}
          {/* No toque, acima do joystick e dos botões; no desktop, rente ao rodapé. */}
          <div className={cn('absolute left-1/2 -translate-x-1/2', device.coarse ? 'bottom-44 landscape:bottom-4' : 'bottom-24 md:bottom-6')}>
            {flying ? (
              <div className="glass page-enter flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm shadow-3" role="status">
                <span>{t.hud.flying(t.places[flying].name)}</span>
                <Button size="sm" variant="secondary" onClick={takeControl}>
                  {t.hud.cancel}
                </Button>
              </div>
            ) : (
              near &&
              !open && (
                <button type="button" onClick={() => setOpen(near)} className="page-enter glass flex items-center gap-3 rounded-xl border border-accent/60 px-4 py-2.5 text-sm shadow-3">
                  <span className="kbd hidden md:inline">{t.hud.pressE}</span>
                  <span className="font-mono text-xs uppercase text-fg-subtle md:hidden">{t.hud.tap}</span>
                  <span className="font-medium">{t.hud.near(t.places[near].name)}</span>
                </button>
              )
            )}
          </div>

          {/* Controles: joystick + subir/descer/turbo no toque; dica de teclas no desktop */}
          <div className="absolute bottom-4 left-4 flex items-end gap-3">
            {device.coarse ? (
              <>
                <Joystick runtime={runtime} label={t.hud.joystick} />
                <div className="flex flex-col gap-2">
                  {(
                    [
                      ['up', t.hud.up, <ArrowUp key="u" className="size-5" />],
                      ['down', t.hud.down, <ArrowDown key="d" className="size-5" />],
                      ['boost', t.hud.boost, <Zap key="b" className="size-5" />],
                    ] as const
                  ).map(([key, label, icon]) => (
                    <button key={key} type="button" aria-label={label} className="glass grid size-12 touch-none select-none place-items-center rounded-full border border-line-strong" {...holdButton(runtime, key)}>
                      {icon}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="glass hidden max-w-xs rounded-xl px-3 py-2.5 text-xs text-fg-muted md:block">
                <p>
                  <span className="kbd">W</span> <span className="kbd">A</span> <span className="kbd">S</span> <span className="kbd">D</span> · <span className="kbd">Espaço</span>/<span className="kbd">C</span> · <span className="kbd">E</span>
                </p>
                <button type="button" onClick={() => setHelpOpen(true)} className="mt-1 underline underline-offset-2 hover:text-fg">
                  {t.hud.help}
                </button>
              </div>
            )}
          </div>

          {/* Direita inferior: telemetria e voltar ao início */}
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <p className="glass rounded-lg px-3 py-1.5 font-mono text-xs text-fg-muted" aria-hidden>
              ALT {t.hud.altitude(telemetry.alt)} · {telemetry.kmh} km/h
            </p>
            <Button variant="secondary" size="sm" className="glass" onClick={() => flyTo('arrival')} iconLeft={<Home className="size-4" />}>
              {t.hud.home}
            </Button>
          </div>
          {!effects && (
            <p className="glass absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-3 py-1 text-xs text-fg-muted" role="status">
              {t.hud.paused}
            </p>
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
                <UniverseMap towers={towers} />
              </div>
            </div>
            <div className="lg:col-span-7">{placeCards}</div>
          </section>
        </>
      )}

      {/* Painel do local (3D) */}
      <Dialog open={open !== null} onClose={() => setOpen(null)} variant="drawer" title={open ? t.places[open].name : ''} description={open ? t.places[open].kicker : undefined}>
        {open && <PlaceBody id={open} facts={facts} onFly={mode === '3d' && open !== near ? () => flyTo(open) : undefined} />}
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
          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{t.help.keyboard}</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {t.help.keys.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>
                    <span className="kbd">{k}</span>
                  </dt>
                  <dd className="text-fg-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="text-fg-muted">{t.help.mouse}</p>
          <p className="text-fg-muted">{t.help.touch}</p>
          <p>{t.help.places}</p>
        </div>
      </Dialog>
    </>
  );
}
