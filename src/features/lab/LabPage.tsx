import { Box, Building2, Check, CircleAlert, Compass, Footprints, Gauge, Map as MapIcon, Pause, Play, Sparkles, TriangleAlert } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { AgentPanel } from '@/components/agents/AgentPanel';
import { AGENT_COLOR } from '@/components/agents/AgentGlyph';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink, IconButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ProcessingIndicator } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/toast-context';
import { curated, skillName } from '@/data/catalog/store';
import { assessFreshness } from '@/domain/pipeline/freshness';
import { useAsync } from '@/hooks/useAsync';
import { Joystick } from '@/components/three/Joystick';
import { SceneBoundary } from '@/components/three/SceneBoundary';
import { hasWebGL, useDeviceProfile } from '@/hooks/useDeviceProfile';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useIsClient } from '@/hooks/useIsClient';
import { useEventFeed } from '@/hooks/useEventFeed';
import { readSession, writeSession } from '@/lib/storage';
import { cn } from '@/lib/cn';
import { useServices } from '@/services/context';
import type { AgentId } from '@/types/domain';
import { courseFacts, journeyStops, type JourneyKind } from './journey';
import { journeyContent } from './journey-content';
import { CoursePicker, JourneyPanel, type LiveMetric } from './JourneyPanel';
import { Minimap } from './hud/Minimap';
import { LabFloorPlan } from './LabFloorPlan';
import { createLabRuntime, STATION_ORDER } from './layout';
import { OpsCenter } from './OpsCenter';
import { buildHub, buildScreens, buildSideScreens } from './screen-content';
import { StationDetails } from './StationDetails';
import { universeLink } from './universe-link';

// three.js + R3F só são baixados quando o modo 3D é escolhido.
const LabScene = lazy(() => import('./scene/LabScene'));

type Mode = 'launcher' | '3d' | '2d';
const MODE_KEY = 'bz-lab-mode';

function savedMode(): Mode {
  const saved = readSession(MODE_KEY);
  if (saved === '2d') return '2d';
  if (saved === '3d' && hasWebGL()) return '3d';
  return 'launcher';
}

export default function LabPage() {
  const { m, locale, reducedMotion } = usePreferences();
  const l = m.lab;
  const services = useServices();
  const { notify } = useToast();
  const device = useDeviceProfile();
  // Até a hidratação terminar, renderiza como o HTML pré-gerado (sem saber do
  // aparelho nem da sessão); depois usa os valores reais.
  const isClient = useIsClient();
  const webgl = isClient ? hasWebGL() : true;
  const [chosenMode, setModeState] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (isClient ? savedMode() : 'launcher');
  const [quality, setQuality] = useState<'high' | 'low'>(() => (device.tier === 'high' ? 'high' : 'low'));
  const [effects, setEffects] = useState(!reducedMotion);
  const [near, setNear] = useState<AgentId | null>(null);
  const [open, setOpen] = useState<AgentId | 'hub' | null>(null);
  const [opsOpen, setOpsOpen] = useState(true);
  // `?setor=vigia` (link do painel de cada agente): o visitante começa de frente para o setor.
  const [params] = useSearchParams();
  const startAt = STATION_ORDER.find((id) => id === params.get('setor')) ?? null;
  // Objeto mutável compartilhado com a cena e o HUD (muda a cada quadro, fora do estado do React).
  const [runtime] = useState(() => createLabRuntime(startAt));
  const published = useMemo(() => curated().filter((c) => c.publicationStatus === 'published'), []);
  const jc = journeyContent[locale];
  const ul = universeLink[locale];

  // ---- Jornadas guiadas: tour pelo campus e "seguir um curso" ------------------------
  // `?curso=<slug>` (link da página do curso) já abre seguindo aquele registro.
  const [journey, setJourney] = useState<{ id: number; kind: JourneyKind; step: number; courseId?: string } | null>(() => {
    const course = published.find((c) => c.slug === params.get('curso'));
    return course ? { id: 1, kind: 'course', step: 0, courseId: course.id } : null;
  });
  const [arrivedKey, setArrivedKey] = useState('');
  const [playing, setPlaying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const journeyKey = journey ? `${journey.id}:${journey.step}` : '';
  const journeyKeyRef = useRef(journeyKey);
  useEffect(() => {
    journeyKeyRef.current = journeyKey;
  }, [journeyKey]);
  const stops = journey ? journeyStops(journey.kind) : [];
  const place = journey ? stops[journey.step]! : null;
  const course = journey?.kind === 'course' ? published.find((c) => c.id === journey.courseId) : undefined;
  // Sem o guia 3D (planta 2D), cada parada é "chegada" na hora.
  const arrived = !!journey && (mode !== '3d' || arrivedKey === journeyKey);

  const startJourney = (kind: JourneyKind, courseId?: string) => {
    setOpen(null);
    setPickerOpen(false);
    setPlaying(false);
    setJourney((j) => ({ id: (j?.id ?? 1) + 1, kind, step: 0, courseId }));
  };
  const goStep = useCallback((delta: number) => {
    setJourney((j) => {
      if (!j) return j;
      const next = j.step + delta;
      if (next >= journeyStops(j.kind).length) return null;
      return { ...j, step: Math.max(0, next) };
    });
  }, []);
  const exitJourney = useCallback(() => {
    setJourney(null);
    setPlaying(false);
  }, []);
  const onGuideArrive = useCallback(() => setArrivedKey(journeyKeyRef.current), []);

  // O palco 3D ocupa a tela abaixo do cabeçalho fixo: ao entrar, rola até que a
  // faixa de demonstração (acima do cabeçalho) saia de vista e nada fique cortado.
  const stageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (mode !== '3d') return;
    const id = requestAnimationFrame(() => stageRef.current?.scrollIntoView?.({ block: 'end' }));
    return () => cancelAnimationFrame(id);
  }, [mode]);
  useDocumentMeta({ title: m.meta.lab.title, description: m.meta.lab.description, path: '/lab' });

  const feed = useEventFeed();
  const agents = useAsync(() => services.agents.list(), []);
  const sources = useAsync(() => services.sources.list(), []);
  const insights = useAsync(() => services.skills.getInsights({}), []);

  const setMode = useCallback((next: Mode) => {
    if (next !== 'launcher') writeSession(MODE_KEY, next);
    setModeState(next);
  }, []);

  const names = useMemo(
    () => Object.fromEntries(STATION_ORDER.map((id) => [id, agents.data?.find((a) => a.id === id)?.name ?? id])) as Record<AgentId, string>,
    [agents.data],
  );
  const topSkills = useMemo(
    () => (insights.data?.skills ?? []).slice(0, 6).map((s) => ({ label: skillName(s.skillId, locale), count: s.courseCount })),
    [insights.data, locale],
  );
  // Prazos de reconferência calculados com as datas reais do catálogo verificado (agente Vigia).
  // (recalculado uma vez por dia: o relógio do feed bate a cada segundo).
  const today = Math.floor(feed.now.getTime() / 86_400_000);
  const freshness = useMemo(() => assessFreshness(published, new Date(today * 86_400_000)), [published, today]);
  const facts = useMemo(() => (course ? courseFacts(course, published, new Date(today * 86_400_000)) : undefined), [course, published, today]);
  const statuses = feed.agents;
  const screens = useMemo(
    () => buildScreens({ events: feed.events, metrics: feed.metrics, statuses, topSkills, names, freshness, m }),
    [feed.events, feed.metrics, statuses, topSkills, names, freshness, m],
  );
  const sideScreens = useMemo(
    () => buildSideScreens({ events: feed.events, metrics: feed.metrics, topSkills, freshness, m, locale }),
    [feed.events, feed.metrics, topSkills, freshness, m, locale],
  );
  const trendBars = useMemo(() => {
    const max = topSkills[0]?.count ?? 1;
    return topSkills.map((s) => s.count / max);
  }, [topSkills]);
  const hub = useMemo(() => buildHub(feed.metrics, m), [feed.metrics, m]);
  const statusMap = useMemo(() => Object.fromEntries(STATION_ORDER.map((id) => [id, statuses[id].status])) as Record<AgentId, (typeof statuses)['scout']['status']>, [statuses]);
  const lastEvent = feed.events.at(-1);
  const pulse = useMemo(() => (lastEvent ? { id: lastEvent.id, agentId: lastEvent.agentId, type: lastEvent.type, entityLabel: lastEvent.entityLabel } : null), [lastEvent]);
  // Bloom só em aparelho forte, com qualidade alta e efeitos ligados.
  const bloom = quality === 'high' && effects && device.tier === 'high' && !device.coarse;

  // Notificações discretas para publicações e falhas (simulação).
  const lastNotified = useRef<string | null>(null);
  useEffect(() => {
    if (!lastEvent || lastNotified.current === lastEvent.id) return;
    const first = lastNotified.current === null;
    lastNotified.current = lastEvent.id;
    if (first || mode === 'launcher') return;
    if (lastEvent.type === 'record.published' || lastEvent.type === 'agent.error') {
      notify({
        tone: lastEvent.type === 'agent.error' ? 'error' : 'demo',
        title: `${m.events.types[lastEvent.type]} · ${l.simulationBadge}`,
        message: lastEvent.entityLabel ?? lastEvent.summary,
        durationMs: 3500,
      });
    }
  }, [lastEvent, mode, notify, m, l.simulationBadge]);

  // Para onde o guia 3D deve ir (a cena o move; o visitante o acompanha).
  const guideTarget = useMemo(() => (journey && place ? { key: journeyKey, place, carrying: journey.kind === 'course' } : null), [journey, place, journeyKey]);

  // "Avançar sozinho": lê a parada por alguns segundos depois de chegar e segue.
  useEffect(() => {
    if (!playing || !journey || !arrived) return;
    const last = journey.step === journeyStops(journey.kind).length - 1;
    const t = setTimeout(() => (last ? setPlaying(false) : goStep(1)), 7000);
    return () => clearTimeout(t);
  }, [playing, journey, arrived, goStep]);

  // Teclado durante a jornada: ← → navegam, Esc sai.
  useEffect(() => {
    if (!journey) return;
    const onKey = (e: KeyboardEvent) => {
      if (open || pickerOpen || (e.target as HTMLElement | null)?.closest('input, textarea, select, dialog')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goStep(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goStep(-1);
      } else if (e.key === 'Escape') exitJourney();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [journey, open, pickerOpen, goStep, exitJourney]);

  const live: LiveMetric | null =
    journey?.kind === 'tour' && place
      ? place === 'hub'
        ? { label: l.ops.metrics.completed, value: String(feed.metrics.completedUpdates), detail: l.simulationBadge }
        : sideScreens[place].metric
      : null;

  const journeyPanel = journey && place && (
    <JourneyPanel
      kind={journey.kind}
      step={journey.step}
      total={stops.length}
      place={place}
      arrived={arrived}
      playing={playing}
      course={course}
      facts={facts}
      live={live}
      onPrev={() => goStep(-1)}
      onNext={() => goStep(1)}
      onExit={exitJourney}
      onTogglePlay={() => setPlaying((v) => !v)}
      onOpenStation={(id) => setOpen(id)}
    />
  );

  const journeyButtons = (className?: string) => (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      <Button variant="secondary" size="sm" className="glass" onClick={() => startJourney('tour')} iconLeft={<Compass className="size-4" />}>
        {jc.tour.start}
      </Button>
      <Button variant="secondary" size="sm" className="glass" onClick={() => setPickerOpen(true)} iconLeft={<Footprints className="size-4" />}>
        {jc.follow.start}
      </Button>
    </div>
  );

  // Tecla E abre a estação próxima (modo 3D).
  useEffect(() => {
    if (mode !== '3d') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'e' || open || (e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      if (runtime.near) setOpen(runtime.near);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, open, runtime]);

  const selected = open && open !== 'hub' ? agents.data?.find((a) => a.id === open) : undefined;

  const opsPanel = (
    <OpsCenter
      metrics={feed.metrics}
      events={feed.events}
      agents={agents.data ?? []}
      statuses={statuses}
      connection={feed.connection}
      runIndex={feed.runIndex}
      environmentMode={feed.environmentMode}
      onPause={feed.pause}
      onResume={feed.resume}
      onSelectAgent={(id) => setOpen(id)}
    />
  );

  const header = (
    <div className="container-page flex flex-wrap items-end justify-between gap-4 py-8">
      <div className="max-w-2xl">
        <p className="eyebrow">{l.eyebrow}</p>
        <h1 className="text-title mt-3">{l.title}</h1>
        <p className="mt-2 text-fg-muted">{l.lead}</p>
        {mode === 'launcher' && course && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-sm">
            <Footprints aria-hidden className="size-4 text-accent-text" /> {jc.follow.eyebrow}: {course.title}
          </p>
        )}
      </div>
      <div className="flex max-w-sm items-start gap-3 rounded-xl border border-demo/30 p-3 text-xs text-fg-muted hatch-demo">
        <Badge tone="demo">{l.simulationBadge}</Badge>
        <span>{l.simulationNote}</span>
      </div>
    </div>
  );

  return (
    <>
      {mode === 'launcher' && (
        <>
          {header}
          <section className="container-page pb-16">
            <h2 className="sr-only">{l.launcher.title}</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-bg-abyss via-surface to-bg p-8">
                <div aria-hidden className="bg-blueprint absolute inset-0 opacity-60" />
                <BezalelMark className="absolute -right-6 -top-6 size-40 text-fg opacity-10" />
                <div className="relative">
                  <Box aria-hidden className="size-8 text-accent-text" />
                  <h3 className="mt-5 text-2xl font-semibold">{l.launcher.enter3d}</h3>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className={cn('flex items-start gap-2', webgl ? 'text-fg-muted' : 'text-danger')}>
                      {webgl ? <Check aria-hidden className="mt-0.5 size-4 text-ok" /> : <TriangleAlert aria-hidden className="mt-0.5 size-4" />}
                      {webgl ? l.launcher.webglOk : l.launcher.webglMissing}
                    </li>
                    {isClient && webgl && device.tier !== 'high' && (
                      <li className="flex items-start gap-2 text-fg-muted">
                        <Gauge aria-hidden className="mt-0.5 size-4 text-warn" /> {l.launcher.lowPower}
                      </li>
                    )}
                    {reducedMotion && (
                      <li className="flex items-start gap-2 text-fg-muted">
                        <CircleAlert aria-hidden className="mt-0.5 size-4 text-warn" /> {l.launcher.reducedMotion}
                      </li>
                    )}
                    <li className="text-xs text-fg-subtle">{l.launcher.sizeNote}</li>
                  </ul>
                  <Button size="lg" className="mt-6" disabled={!webgl} onClick={() => setMode('3d')} iconLeft={<Box className="size-4" />}>
                    {l.launcher.enter3d}
                  </Button>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-8">
                <MapIcon aria-hidden className="size-8 text-accent-text" />
                <h3 className="mt-5 text-2xl font-semibold">{l.launcher.open2d}</h3>
                <p className="mt-4 text-sm text-fg-muted">{l.plan.lead}</p>
                <Button size="lg" variant="secondary" className="mt-6" onClick={() => setMode('2d')} iconLeft={<MapIcon className="size-4" />}>
                  {l.launcher.open2d}
                </Button>
              </div>
            </div>
            <div className="mt-5 flex flex-col items-start gap-4 rounded-2xl border border-accent/40 bg-accent-soft p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Building2 aria-hidden className="mt-0.5 size-6 shrink-0 text-accent-text" />
                <p className="text-sm text-fg-muted">
                  <span className="block text-base font-semibold text-fg">{ul.label}</span>
                  {ul.lead}
                </p>
              </div>
              <ButtonLink to="/universe" iconLeft={<Building2 className="size-4" />}>
                {ul.label}
              </ButtonLink>
            </div>
          </section>
        </>
      )}

      {mode === '3d' && (
        <section ref={stageRef} aria-label={l.title} className="relative h-[calc(100dvh-var(--header-h))] min-h-[560px] overflow-hidden bg-bg-abyss">
          <SceneBoundary
            onError={() => {
              notify({ tone: 'error', message: l.hud.webglLost });
              setMode('2d');
            }}
          >
            <Suspense
              fallback={
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-4">
                    <BezalelMark animated className="size-16 text-fg" />
                    <ProcessingIndicator label={l.launcher.loading3d} />
                  </div>
                </div>
              }
            >
              <LabScene
                runtime={runtime}
                quality={quality}
                effects={effects}
                bloom={bloom}
                inputEnabled={!open}
                screens={screens}
                sideScreens={sideScreens}
                trendBars={trendBars}
                hub={hub}
                statuses={statusMap}
                names={names}
                near={near}
                pulse={pulse}
                onSelectStation={(id) => setOpen(id)}
                onSelectHub={() => setOpsOpen(true)}
                onNearChange={setNear}
                guideTarget={guideTarget}
                onGuideArrive={onGuideArrive}
                onLowPerformance={() => {
                  setQuality('low');
                  notify({ tone: 'info', message: l.hud.fps });
                }}
                onContextLost={() => {
                  notify({ tone: 'error', message: l.hud.webglLost });
                  setMode('2d');
                }}
              />
            </Suspense>
          </SceneBoundary>

          {/* HUD superior */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 md:p-4">
            <div className="flex flex-col items-start gap-2">
              <div className="glass pointer-events-auto flex items-center gap-3 rounded-xl px-3 py-2">
                <BezalelMark className="size-6 text-fg" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{l.title}</p>
                  <p className="font-mono text-[0.68rem] uppercase tracking-wider text-demo">{l.simulationBadge}</p>
                </div>
              </div>
              {!journey && journeyButtons('pointer-events-auto')}
            </div>
            <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
              <div className="glass flex gap-1 rounded-xl p-1">
                <IconButton label={effects ? l.hud.pauseEffects : l.hud.resumeEffects} onClick={() => setEffects((v) => !v)} active={!effects} size="sm">
                  {effects ? <Pause className="size-4" /> : <Play className="size-4" />}
                </IconButton>
                <IconButton label={quality === 'high' ? l.hud.qualityLow : l.hud.qualityHigh} onClick={() => setQuality((q) => (q === 'high' ? 'low' : 'high'))} active={quality === 'low'} size="sm">
                  {quality === 'high' ? <Sparkles className="size-4" /> : <Gauge className="size-4" />}
                </IconButton>
                <IconButton label={l.hud.switchTo2d} onClick={() => setMode('2d')} size="sm">
                  <MapIcon className="size-4" />
                </IconButton>
              </div>
              <ButtonLink to="/universe" variant="secondary" size="sm" className="glass" iconLeft={<Building2 className="size-4" />}>
                {ul.short}
              </ButtonLink>
              {!opsOpen && (
                <Button variant="secondary" size="sm" className="glass" onClick={() => setOpsOpen(true)}>
                  {l.ops.expand}
                </Button>
              )}
            </div>
          </div>

          {/* Central de Operações (desktop: painel lateral; mobile: botão abre gaveta) */}
          {opsOpen && (
            <div className="glass absolute bottom-4 right-4 top-20 hidden w-[22rem] overflow-y-auto rounded-2xl p-4 lg:block">
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={() => setOpsOpen(false)} className="text-xs text-fg-subtle hover:text-fg">
                  {l.ops.collapse}
                </button>
              </div>
              {opsPanel}
            </div>
          )}

          {/* Minimapa */}
          <div className="pointer-events-none absolute left-4 top-36 hidden md:block">
            <Minimap runtime={runtime} />
          </div>

          {/* Jornada guiada (tour / seguir um curso) */}
          {journeyPanel && <div className="absolute inset-x-3 bottom-3 z-10 md:left-4 md:right-auto md:w-[27rem]">{journeyPanel}</div>}

          {/* Prompt de proximidade (na jornada, o painel já oferece abrir a estação) */}
          {near && !open && !journey && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 md:bottom-28">
              <button
                type="button"
                onClick={() => setOpen(near)}
                className="page-enter glass flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-3"
                style={{ borderColor: AGENT_COLOR[near] }}
              >
                <span className="kbd hidden md:inline">{l.hud.pressE}</span>
                <span className="md:hidden font-mono text-xs uppercase text-fg-subtle">{l.hud.tap}</span>
                <span className="font-medium">{l.hud.openStation(names[near])}</span>
              </button>
            </div>
          )}

          {/* Controles */}
          <div className={cn('absolute bottom-4 left-4 flex items-end gap-3', journey && 'hidden')}>
            {device.coarse ? (
              <Joystick runtime={runtime} label={l.hud.joystick} />
            ) : (
              <div className="glass hidden max-w-xs rounded-xl px-3 py-2.5 text-xs text-fg-muted md:block">
                <p className="font-mono uppercase tracking-wider text-fg-subtle">{l.hud.controls}</p>
                <p className="mt-1.5">
                  <span className="kbd">W</span> <span className="kbd">A</span> <span className="kbd">S</span> <span className="kbd">D</span> / ←↑↓→ · {l.hud.move}
                </p>
                <p className="mt-1">
                  <span className="kbd">E</span> · {l.hud.interact}
                </p>
                <p className="mt-1">{l.hud.clickWalk}</p>
              </div>
            )}
          </div>
          {device.coarse && !journey && <p className="glass absolute bottom-36 left-4 max-w-[14rem] rounded-lg px-3 py-2 text-xs text-fg-muted md:hidden">{l.hud.touchHint}</p>}
          {!journey && (
            <Button variant="secondary" size="sm" className="glass absolute bottom-4 right-4 lg:hidden" onClick={() => setOpen('hub')}>
              {l.ops.title}
            </Button>
          )}

          {/* Acesso por teclado/leitor de tela às estações */}
          <nav aria-label={l.stationsList} className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:left-4 focus-within:top-56 focus-within:z-10 focus-within:rounded-xl focus-within:bg-bg focus-within:p-3">
            <ul>
              {STATION_ORDER.map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => setOpen(id)} className="py-1 text-sm underline">
                    {l.hud.openStation(names[id])}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      )}

      {mode === '2d' && (
        <>
          {header}
          <section className="container-page grid grid-cols-1 gap-8 pb-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{l.plan.title}</h2>
                  <p className="text-sm text-fg-muted">{l.plan.lead}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {webgl && (
                    <Button variant="secondary" size="sm" onClick={() => setMode('3d')} iconLeft={<Box className="size-4" />}>
                      {l.hud.switchTo3d}
                    </Button>
                  )}
                  <ButtonLink to="/universe" variant="secondary" size="sm" iconLeft={<Building2 className="size-4" />}>
                    {ul.label}
                  </ButtonLink>
                </div>
              </div>
              {journeyPanel ? <div className="mt-6">{journeyPanel}</div> : journeyButtons('mt-4')}
              <div className="mt-6 rounded-2xl border border-line bg-bg-deep p-4">
                <LabFloorPlan
                  agents={agents.data ?? []}
                  statuses={statuses}
                  pulseAgent={place && place !== 'hub' ? place : (lastEvent?.agentId ?? null)}
                  onSelect={(id) => setOpen(id)}
                />
              </div>
            </div>
            <div className="panel p-5 lg:col-span-5">{opsPanel}</div>
          </section>
        </>
      )}

      <CoursePicker open={pickerOpen} courses={published} onClose={() => setPickerOpen(false)} onPick={(c) => startJourney('course', c.id)} />

      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        variant="drawer"
        title={open === 'hub' ? l.ops.title : selected ? l.stations[selected.id].title : ''}
        description={open === 'hub' ? undefined : selected ? l.stations[selected.id].subtitle : undefined}
        accent={selected ? AGENT_COLOR[selected.id] : undefined}
      >
        {open === 'hub' && opsPanel}
        {selected && (
          <AgentPanel
            agent={selected}
            status={statuses[selected.id].status}
            lastEvent={statuses[selected.id].lastEvent}
            taskCount={statuses[selected.id].taskCount}
            events={feed.events}
            now={feed.now}
            station={<StationDetails agent={selected.id} events={feed.events} metrics={feed.metrics} sources={sources.data ?? []} topSkills={topSkills} freshness={freshness} />}
          />
        )}
      </Dialog>
    </>
  );
}
