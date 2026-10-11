import { ArrowDown, ArrowRight, Box, Check, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { ButtonLink } from '@/components/ui/Button';
import { categories, skillDefinitions } from '@/data/catalog/taxonomy';
import { explorePath } from '@/domain/catalog/query-params';
import { useAsync } from '@/hooks/useAsync';
import { useDeviceProfile } from '@/hooks/useDeviceProfile';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { readStorage, writeStorage } from '@/lib/storage';
import { combine } from '@/lib/sync-promise';
import { useServices } from '@/services/context';
import type { CategoryId } from '@/types/domain';
import { HeroIntro } from '../HeroIntro';
import type { ForjaData, ForjaQuality, ForjaScene } from './scene';
import { ACT_START, ACTS, actAt, areaColor, clamp01, phasesAt } from './timeline';

const INTERESTS_KEY = 'bz-interests';
const MAX_INTERESTS = 3;
const STORY_ACTS = [1, 2, 3, 4] as const;

/** O modo (palco 3D ou história em cartões) é decidido no index.html antes da pintura. */
const isFullMode = () => typeof document !== 'undefined' && document.documentElement.dataset.forja === 'full';

/** Dados reais do catálogo para a cena e para os textos dos atos. */
function useForjaData() {
  const services = useServices();
  const result = useAsync(
    () =>
      combine([services.catalog.getFacets(), services.catalog.listRegistry(), services.skills.getInsights({})] as const, ([facets, registry, insights]) => {
        const courses = registry.filter((c) => c.origin === 'curated' && c.publicationStatus === 'published');
        const usedSkills = skillDefinitions.filter((s) => courses.some((c) => c.skills.includes(s.id)));
        const skillIndex = new Map(usedSkills.map((s, i) => [s.id, i]));
        const links: Array<[number, number]> = [];
        courses.forEach((c, i) => c.skills.forEach((id) => skillIndex.has(id) && links.push([i, skillIndex.get(id)!])));
        const counts = new Map(facets.categories.map((c) => [c.value, c.count]));
        const scene: ForjaData = {
          areaWeights: categories.map((c) => counts.get(c.id) ?? 0),
          courseAreas: courses.map((c) => Math.max(0, categories.findIndex((cat) => cat.id === c.category))),
          skillCount: usedSkills.length,
          links,
        };
        return {
          scene,
          courses,
          counts,
          total: facets.total,
          providers: facets.providers,
          lastCheckedAt: facets.lastCheckedAt,
          skills: insights.skills.length,
          links: links.length,
        };
      }),
    [],
  );
  return result.data;
}

/**
 * A Forja: a abertura da home vira a história de uma construção, dirigida
 * pela rolagem. O palco (cena 3D em three.js, carregada sob demanda) fica
 * preso à tela enquanto o texto do hero rola por cima e, depois, os atos
 * aparecem: Descobrir → Verificar → Conectar → Construir → Entrar.
 *
 * Os números exibidos são do catálogo verificado (não há estatística
 * inventada); a triagem animada é uma ilustração das regras reais.
 */
export function ForjaSection() {
  const { m, locale, reducedMotion } = usePreferences();
  const f = m.home.forja;
  const data = useForjaData();
  const device = useDeviceProfile();
  const sectionRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ForjaScene | null>(null);
  const progressRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [interests, setInterests] = useState<CategoryId[]>([]);

  // Escolhas anteriores do visitante (só no navegador, depois da hidratação).
  useEffect(() => {
    const saved = (readStorage(INTERESTS_KEY) ?? '').split(',').filter((id): id is CategoryId => categories.some((c) => c.id === id));
    if (saved.length) {
      const id = requestAnimationFrame(() => setInterests(saved.slice(0, MAX_INTERESTS)));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  const interestAreas = useMemo(() => interests.map((id) => categories.findIndex((c) => c.id === id)), [interests]);
  const interestAreasRef = useRef(interestAreas);
  useEffect(() => {
    interestAreasRef.current = interestAreas;
    sceneRef.current?.setInterests(interestAreas);
  }, [interestAreas]);

  const toggleInterest = (id: CategoryId) => {
    setInterests((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_INTERESTS ? [...cur.slice(1), id] : [...cur, id];
      writeStorage(INTERESTS_KEY, next.join(','));
      return next;
    });
  };

  // ---- Rolagem → progresso → ato -------------------------------------------------
  /** Distância rolada dentro da seção para um progresso da linha do tempo (inverso de `progressAt`). */
  const geometry = useCallback(() => {
    const section = sectionRef.current;
    const hero = heroRef.current;
    if (!section || !hero) return null;
    const vh = window.innerHeight;
    const total = Math.max(1, section.offsetHeight - vh);
    const heroOut = Math.min(total * 0.5, Math.max(1, hero.offsetHeight - vh * 0.3));
    return { section, total, heroOut };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !isFullMode()) return;
    let raf = 0;
    let lastAct = -1;
    const measure = () => {
      raf = 0;
      const g = geometry();
      if (!g) return;
      const scrolled = -g.section.getBoundingClientRect().top;
      const p =
        scrolled <= g.heroOut
          ? clamp01(scrolled / g.heroOut) * ACT_START.discover
          : ACT_START.discover + clamp01((scrolled - g.heroOut) / Math.max(1, g.total - g.heroOut)) * (1 - ACT_START.discover);
      progressRef.current = p;
      sceneRef.current?.setProgress(p);
      const act = actAt(p);
      if (act !== lastAct) {
        lastAct = act;
        g.section.dataset.act = String(act);
      }
      // Barra de progresso: só a fase de construção (atos 1–4) conta.
      const build = clamp01((p - ACT_START.discover) / (ACT_START.enter - ACT_START.discover));
      const mobile = window.innerWidth < 768;
      if (fillRef.current) fillRef.current.style.transform = mobile ? `scaleX(${build})` : `scaleY(${build})`;
      if (pctRef.current) pctRef.current.textContent = f.progress(Math.round(build * 100));
      if (fadeRef.current) fadeRef.current.style.opacity = String(phasesAt(p).enter * 0.92);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [geometry, f]);

  const goToAct = (index: number) => {
    const g = geometry();
    if (!g) return;
    const p = ACT_START[ACTS[index]!] + 0.02;
    const scrolled = p <= ACT_START.discover ? (p / ACT_START.discover) * g.heroOut : g.heroOut + ((p - ACT_START.discover) / (1 - ACT_START.discover)) * (g.total - g.heroOut);
    const top = g.section.getBoundingClientRect().top + window.scrollY + scrolled;
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  // Teclado/leitor de tela: focar algo num ato invisível rola até ele.
  const onFocusAct = (e: FocusEvent<HTMLElement>) => {
    const index = Number(e.currentTarget.dataset.act);
    if (!isFullMode() || actAt(progressRef.current) === index) return;
    goToAct(index);
  };

  // ---- Cena 3D sob demanda ----------------------------------------------------------
  const quality: ForjaQuality = device.coarse ? 'mobile' : device.tier === 'high' ? 'high' : 'medium';
  const sceneData = data?.scene;

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section || !sceneData || !isFullMode()) return;
    let disposed = false;
    let scene: ForjaScene | null = null;
    let visible = true;
    const sync = () => scene?.setActive(visible && !document.hidden);
    const framing = () => {
      const w = window.innerWidth;
      if (w >= 1024) scene?.setFraming(0.2, 0.02);
      else if (w >= 768) scene?.setFraming(0.14, 0.04);
      else scene?.setFraming(0, 0.17);
    };

    const load = async () => {
      if (disposed || scene) return;
      const { createForjaScene } = await import('./scene');
      if (disposed) return;
      try {
        scene = createForjaScene({
          canvas,
          quality,
          data: sceneData,
          onLock: () => {
            navigator.vibrate?.(22);
            section.dataset.locked = '';
            setTimeout(() => delete section.dataset.locked, 900);
          },
          onContextLost: () => setReady(false),
        });
      } catch {
        return; // sem WebGL: o pôster continua (a história segue nos textos)
      }
      sceneRef.current = scene;
      framing();
      const rect = canvas.getBoundingClientRect();
      scene.resize(rect.width, rect.height);
      scene.setProgress(progressRef.current);
      scene.setInterests(interestAreasRef.current);
      sync();
      setReady(true);
    };

    // Carrega na primeira interação ou quando a página fica ociosa — nunca
    // disputando o carregamento inicial.
    const events = ['scroll', 'pointerdown', 'touchstart', 'keydown', 'wheel'] as const;
    const trigger = () => {
      events.forEach((ev) => window.removeEventListener(ev, trigger));
      void load();
    };
    events.forEach((ev) => window.addEventListener(ev, trigger, { passive: true, once: true }));
    const idle = window.setTimeout(trigger, 3500);

    const ro = new ResizeObserver(() => {
      framing();
      const rect = canvas.getBoundingClientRect();
      scene?.resize(rect.width, rect.height);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      sync();
    });
    io.observe(section);
    document.addEventListener('visibilitychange', sync);

    return () => {
      disposed = true;
      clearTimeout(idle);
      events.forEach((ev) => window.removeEventListener(ev, trigger));
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [sceneData, quality]);

  // Movimento reduzido ligado durante a visita: a história vira cartões, sem 3D.
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion && root.dataset.forja === 'full') root.dataset.forja = 'lite';
  }, [reducedMotion]);

  // ---- Textos ---------------------------------------------------------------------------
  const mine = data ? data.courses.filter((c) => interests.includes(c.category)) : [];
  const areaNames = interests.map((id) => categories.find((c) => c.id === id)?.name[locale] ?? id);
  const buildTitle = interests.length && data ? f.build.titleMine(mine.length, areaNames.join(' + ')) : f.build.titleDefault;
  const checked = data?.lastCheckedAt ? formatDate(data.lastCheckedAt, locale) : null;
  const actNames = [f.discover.eyebrow, f.verify.eyebrow, f.connect.eyebrow, f.build.eyebrow];

  return (
    <section ref={sectionRef} id="forja" aria-label={f.label} data-act="0" className="bz-forja bz-cinema">
      <a href="#depois-da-forja" className="sr-only z-30 rounded-md bg-accent px-4 py-2 font-medium text-accent-fg focus:not-sr-only focus:absolute focus:left-4 focus:top-20">
        {f.skip}
      </a>

      {/* Palco: cena 3D, pôster enquanto carrega, atos, trilho. */}
      <div className="bz-forja-stage">
        <div aria-hidden className="bz-forja-poster" />
        <canvas ref={canvasRef} aria-hidden className="bz-forja-canvas" data-ready={ready ? '' : undefined} />
        <div aria-hidden className="bz-forja-scrim" />
        <div ref={fadeRef} aria-hidden className="bz-forja-fade" />

        <div className="container-page relative">
          <h2 className="pt-0 pb-6 text-title [:root[data-forja='full']_&]:sr-only">{f.storyTitle}</h2>
        </div>
        <div className="bz-forja-acts container-page">
          {/* 01 · Descobrir — com a escolha de interesses (personaliza a construção). */}
          <article data-act="1" className="bz-act" onFocusCapture={onFocusAct}>
            <div className="bz-act-card">
              <p className="eyebrow">{f.discover.eyebrow}</p>
              <h3 className="bz-act-title text-title mt-3">{f.discover.title}</h3>
              <p className="mt-3 text-fg-muted">{data ? f.discover.lead(data.providers, categories.length) : null}</p>
              <p className="mt-5 text-sm font-medium">{f.discover.interests}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {categories.map((cat, i) => {
                  const on = interests.includes(cat.id);
                  const [r, g, b] = areaColor(i, categories.length);
                  return (
                    <li key={cat.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleInterest(cat.id)}
                        className={cn(
                          'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
                          on ? 'border-accent bg-accent-soft text-fg' : 'border-line-strong bg-surface/80 text-fg-muted hover:text-fg',
                        )}
                        style={{ '--area': `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})` } as CSSProperties}
                      >
                        <span aria-hidden className="size-2 rounded-full bg-[var(--area)] shadow-[0_0_8px_var(--area)]" />
                        {cat.name[locale]}
                        {on && <Check aria-hidden className="size-3.5 text-accent-text" />}
                      </button>
                    </li>
                  );
                })}
                {interests.length > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setInterests([]);
                        writeStorage(INTERESTS_KEY, '');
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1 text-sm text-fg-subtle hover:text-fg"
                    >
                      <X aria-hidden className="size-3.5" /> {f.discover.clear}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </article>

          {/* 02 · Verificar */}
          <article data-act="2" className="bz-act" onFocusCapture={onFocusAct}>
            <div className="bz-act-card">
              <p className="eyebrow">{f.verify.eyebrow}</p>
              <h3 className="bz-act-title text-title mt-3">{f.verify.title}</h3>
              <p className="mt-3 text-fg-muted">{f.verify.lead}</p>
              {data && (
                <ul className="mt-5 flex flex-wrap gap-2 font-mono text-xs">
                  <li className="rounded-full border border-ok/40 bg-ok-soft px-3 py-1 text-ok">● {f.verify.verified(data.total)}</li>
                  {checked && <li className="rounded-full border border-line-strong px-3 py-1 text-fg-muted">{f.verify.checked(checked)}</li>}
                </ul>
              )}
            </div>
          </article>

          {/* 03 · Conectar */}
          <article data-act="3" className="bz-act" onFocusCapture={onFocusAct}>
            <div className="bz-act-card">
              <p className="eyebrow">{f.connect.eyebrow}</p>
              <h3 className="bz-act-title text-title mt-3">{f.connect.title}</h3>
              <p className="mt-3 text-fg-muted">{data ? f.connect.lead(data.skills, data.courses.length, data.links) : null}</p>
            </div>
          </article>

          {/* 04 · Construir — personalizado pelos interesses. */}
          <article data-act="4" className="bz-act" onFocusCapture={onFocusAct}>
            <div className="bz-act-card">
              <p className="eyebrow">{f.build.eyebrow}</p>
              <h3 className="bz-act-title bz-lock-glow text-title mt-3">{buildTitle}</h3>
              <p className="mt-3 font-serif-accent text-xl text-accent-text">{f.build.lead}</p>
              <ButtonLink
                to={interests.length ? explorePath({ categories: interests }) : '/explore'}
                className="mt-6"
                iconRight={<ArrowRight className="size-4" />}
              >
                {interests.length ? f.build.ctaMine : f.build.ctaAll}
              </ButtonLink>
            </div>
          </article>

          {/* 05 · Entrar */}
          <article data-act="5" className="bz-act" onFocusCapture={onFocusAct}>
            <div className="bz-act-card">
              <p className="eyebrow">{f.enter.eyebrow}</p>
              <h3 className="bz-act-title text-title mt-3">{f.enter.title}</h3>
              <p className="mt-3 text-fg-muted">{f.enter.lead}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink to="/lab" iconLeft={<Box className="size-4" />}>
                  {f.enter.lab}
                </ButtonLink>
                <ButtonLink to="/explore" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
                  {f.enter.explore}
                </ButtonLink>
              </div>
            </div>
          </article>
        </div>

        {/* Trilho: em que etapa da construção você está (e atalhos para cada uma). */}
        <nav aria-label={f.railLabel} className="bz-forja-rail">
          <span className="relative block h-1 flex-1 overflow-hidden rounded-full bg-line-strong md:absolute md:right-[0.4rem] md:top-0 md:h-full md:w-px md:flex-none">
            <span ref={fillRef} className="bz-forja-rail-fill absolute inset-0 bg-accent" />
          </span>
          <span ref={pctRef} aria-live="off" className="font-mono text-[0.7rem] uppercase tracking-wider text-fg-muted md:hidden">
            {f.progress(0)}
          </span>
          <ol className="hidden flex-col gap-5 md:flex">
            {STORY_ACTS.map((act, i) => (
              <li key={act}>
                <button
                  type="button"
                  onClick={() => goToAct(act)}
                  aria-label={f.goTo(actNames[i]!)}
                  className="group flex items-center justify-end gap-3 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle hover:text-fg"
                >
                  <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{actNames[i]}</span>
                  <span className="bz-rail-dot block size-3 rounded-full border border-line-strong bg-bg-abyss" data-act={act} />
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <a href="#depois-da-forja" className="bz-forja-skip items-center gap-1.5 rounded-full border border-line-strong bg-bg-abyss/80 px-3 py-1.5 text-xs text-fg-muted hover:text-fg">
          {f.skipShort} <ArrowDown aria-hidden className="size-3.5" />
        </a>
      </div>

      {/* O hero rola por cima do palco (primeiro ato). */}
      <div ref={heroRef} className="bz-forja-hero">
        <HeroIntro />
      </div>

      {/* Fim da Forja (alvo do "pular"). */}
      <span id="depois-da-forja" aria-hidden className="absolute bottom-0 left-0 h-px w-px" />
    </section>
  );
}
