import { ArrowRight, Box, Search } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { Button, ButtonLink } from '@/components/ui/Button';
import { explorePath } from '@/domain/catalog/query-params';
import { LabSignal } from './LabSignal';

const QUICK = ['Python', 'IA generativa', 'LGPD', 'Linux'];

/**
 * Abertura da home: título, busca e chamadas. Fica na camada que rola por
 * cima do palco da Forja (ForjaSection) — é o primeiro "ato" da história.
 * Título e texto de apoio aparecem desde a primeira pintura (LCP).
 */
export function HeroIntro() {
  const { m } = usePreferences();
  const h = m.home.hero;
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="relative">
      {/* Legibilidade do texto sobre o palco da Forja (a cena fica atrás). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(7_13_23/0.55),rgb(7_13_23/0.25)_55%,transparent)] lg:bg-[linear-gradient(90deg,rgb(7_13_23/0.92)_0%,rgb(7_13_23/0.7)_45%,transparent_72%)]" />
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_25%_45%,black,transparent)]" />
      <div className="container-page relative grid min-h-[min(94svh,940px)] grid-cols-1 items-center gap-10 pb-28 pt-14 lg:grid-cols-12 lg:pt-10">
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
      </div>

      <div className="absolute inset-x-0 bottom-0">
        <LabSignal />
      </div>
    </div>
  );
}
