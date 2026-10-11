import { ArrowRight, Box, Search } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { AgentGlyph } from '@/components/agents/AgentGlyph';
import { Button, ButtonLink } from '@/components/ui/Button';
import { GeometryCore } from '@/components/visual/GeometryCore';
import { ParticleField } from '@/components/visual/ParticleField';
import { explorePath } from '@/domain/catalog/query-params';
import { useAsync } from '@/hooks/useAsync';
import { formatDate } from '@/lib/format';
import { useServices } from '@/services/context';
import { LabSignal } from './LabSignal';

const QUICK = ['Python', 'IA generativa', 'LGPD', 'Linux'];

export function HeroSection() {
  const { m, locale } = usePreferences();
  const h = m.home.hero;
  const navigate = useNavigate();
  const services = useServices();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const facets = useAsync(() => services.catalog.getFacets(), []);

  // Atalho "/" foca a busca (padrão de ferramentas de pesquisa).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === '/' && !target?.closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(explorePath({ q }), { viewTransition: true });
  }

  const checked = facets.data?.lastCheckedAt ? formatDate(facets.data.lastCheckedAt, locale) : null;

  return (
    <section className="relative isolate overflow-hidden border-b border-line bg-bg-abyss">
      {/* Camadas de profundidade: grade, partículas, brilho e vinheta */}
      <div aria-hidden className="bg-blueprint absolute inset-0 opacity-80 [mask-image:radial-gradient(ellipse_80%_70%_at_70%_40%,black,transparent)]" />
      <ParticleField className="opacity-90" density={1} />
      <div aria-hidden className="absolute -right-40 top-10 size-[44rem] rounded-full bg-[radial-gradient(circle,rgb(199_168_106/0.14),transparent_62%)] blur-2xl" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />

      <div className="container-page relative grid grid-cols-1 min-h-[min(92dvh,920px)] items-center gap-10 pb-28 pt-14 lg:grid-cols-12 lg:pt-10">
        <div className="lg:col-span-7">
          <p className="eyebrow bz-hero-in">{h.eyebrow}</p>
          <p className="bz-hero-in mt-6 font-mono text-sm tracking-[0.3em] text-accent-text [--d:60ms]">{h.kicker}</p>
          {/* Título e texto de apoio ficam visíveis desde a primeira pintura (são o
              conteúdo principal da página — LCP); a vida fica no traço dourado. */}
          <h1 className="text-hero mt-4 font-semibold">
            {h.titleStart} <span className="bz-accent-underline font-serif-accent text-accent-text">{h.titleAccent}</span>{' '}
            <span className="block text-[0.55em] font-medium tracking-[-0.03em] text-fg-muted">{h.titleEnd}</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-fg-muted">{h.lead}</p>

          {/* action/method: sem JavaScript (ou antes da hidratação) a busca ainda leva ao catálogo filtrado. */}
          <form
            id="hero-search-form"
            action={`${import.meta.env.BASE_URL}explore/`}
            method="get"
            onSubmit={onSubmit}
            role="search"
            className="bz-hero-in mt-9 max-w-xl [--d:300ms]"
          >
            <label htmlFor="hero-search" className="sr-only">
              {h.searchLabel}
            </label>
            <div className="group flex items-center gap-2 rounded-2xl border border-line-strong bg-surface/90 p-1.5 pl-4 shadow-2 transition-[border-color,box-shadow] duration-300 focus-within:border-accent/70 focus-within:shadow-[var(--glow-accent)]">
              <Search aria-hidden className="size-5 shrink-0 text-fg-subtle group-focus-within:text-accent-text" />
              <input
                ref={inputRef}
                id="hero-search"
                name="q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={h.searchPlaceholder}
                maxLength={120}
                autoComplete="off"
                className="h-11 min-w-0 flex-1 bg-transparent text-base text-fg placeholder:text-fg-subtle focus:outline-none"
              />
              <span aria-hidden className="kbd hidden sm:inline">/</span>
              <Button type="submit" size="md" iconRight={<ArrowRight className="size-4" />}>
                {h.searchSubmit}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-xs uppercase tracking-wider text-fg-subtle">{h.quick}</span>
              {QUICK.map((term) => (
                <Link
                  key={term}
                  to={explorePath({ q: term })}
                  viewTransition
                  className="rounded-full border border-line px-3 py-1 text-fg-muted transition-colors hover:border-accent/50 hover:text-fg"
                >
                  {term}
                </Link>
              ))}
              <Link
                to={explorePath({ priceTypes: ['free'], withCertificate: true })}
                viewTransition
                className="rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-accent-text transition-colors hover:border-accent"
              >
                {h.quickFreeCert}
              </Link>
            </div>
          </form>

          <div className="bz-hero-in mt-9 flex flex-wrap gap-3 [--d:360ms]">
            <ButtonLink to="/explore" size="lg" iconRight={<ArrowRight className="size-4" />}>
              {h.ctaPrimary}
            </ButtonLink>
            <ButtonLink to="/lab" size="lg" variant="secondary" iconLeft={<Box className="size-4" />}>
              {h.ctaSecondary}
            </ButtonLink>
          </div>
        </div>

        <div className="relative hidden aspect-square w-full lg:col-span-5 lg:block">
          <GeometryCore className="absolute inset-0" />
          <div className="bz-float bz-hero-card absolute left-0 top-[16%] rounded-xl px-4 py-3 shadow-2 [--float-delay:0s]">
            <p className="font-mono text-[0.7rem] uppercase tracking-wider text-ok">● {m.common.curated}</p>
            <p className="mt-1 text-sm font-medium">{facets.data ? h.floatVerified(facets.data.total) : '—'}</p>
          </div>
          <div className="bz-float bz-hero-card absolute right-0 top-[52%] rounded-xl px-4 py-3 shadow-2 [--float-delay:-2s]">
            <p className="font-mono text-[0.7rem] uppercase tracking-wider text-fg-subtle">{m.common.lastChecked}</p>
            <p className="mt-1 text-sm font-medium">{checked ? h.floatChecked(checked) : '—'}</p>
          </div>
          <div className="bz-float bz-hero-card absolute bottom-[8%] left-[12%] flex items-center gap-3 rounded-xl px-4 py-3 shadow-2 [--float-delay:-4s]">
            <span className="flex -space-x-1.5">
              {(['scout', 'verifier', 'atlas', 'trend', 'sol'] as const).map((id) => (
                <span key={id} className="grid size-7 place-items-center rounded-full border border-line bg-bg" style={{ color: `var(--agent-${id})` }}>
                  <AgentGlyph agent={id} className="size-4" />
                </span>
              ))}
            </span>
            <span className="text-sm text-fg-muted">{h.floatAgents}</span>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0">
        <LabSignal />
      </div>
    </section>
  );
}
