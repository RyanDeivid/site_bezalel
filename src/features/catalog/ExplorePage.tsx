import { ArrowDown, ArrowUp, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { NextStep } from '@/components/layout/NextStep';
import { PageHero } from '@/components/layout/PageHero';
import { thumbPrimary, thumbSecondary } from '@/components/layout/thumb';
import { ThumbBar } from '@/components/layout/ThumbBar';
import { categoryGroupOf } from '@/data/catalog/taxonomy';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton, StateView } from '@/components/ui/StateView';
import { countActiveFilters, paramsFromQuery, queryFromParams } from '@/domain/catalog/query-params';
import type { CatalogQuery, SortOption } from '@/domain/catalog/search';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useServices } from '@/services/context';
import type { Course } from '@/types/domain';
import { CourseCard } from './CourseCard';
import { CourseQuickView } from './CourseQuickView';
import { FilterPanel } from './FilterPanel';

export default function ExplorePage() {
  const { m } = usePreferences();
  const e = m.explore;
  const services = useServices();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => queryFromParams(params), [params]);
  const [page, setPage] = useState(1);
  const [text, setText] = useState(query.q ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quick, setQuick] = useState<Course | null>(null);

  // Navegação externa (link, voltar/avançar) muda a URL: sincroniza o campo
  // de texto e volta à primeira página — ajuste de estado durante a
  // renderização, padrão recomendado pelo React para estado derivado.
  const paramsKey = params.toString();
  const [prevKey, setPrevKey] = useState(paramsKey);
  if (paramsKey !== prevKey) {
    setPrevKey(paramsKey);
    setPage(1);
    if ((query.q ?? '') !== text) setText(query.q ?? '');
  }

  useDocumentMeta({ title: m.meta.explore.title, description: m.meta.explore.description, path: '/explore' });

  // Atualiza a URL com debounce enquanto o usuário digita.
  useEffect(() => {
    if (text === (query.q ?? '')) return;
    const t = setTimeout(() => {
      setParams(paramsFromQuery({ ...query, q: text }), { replace: true });
      setPage(1);
    }, 280);
    return () => clearTimeout(t);
  }, [text, query, setParams]);

  const result = useAsync(() => services.catalog.search({ ...query, page, pageSize: 12 }), [query, page]);
  const facets = useAsync(() => services.catalog.getFacets({ includeDemo: query.includeDemo }), [query.includeDemo]);

  function update(patch: Partial<CatalogQuery>) {
    setParams(paramsFromQuery({ ...query, q: text, ...patch }), { replace: false });
    setPage(1);
  }

  function clearAll() {
    setText('');
    setParams(new URLSearchParams(), { replace: false });
    setPage(1);
  }

  const active = countActiveFilters(query);
  const chips: Array<{ key: string; label: string; remove: () => void }> = [
    ...(query.categories ?? []).map((v) => ({ key: `c-${v}`, label: m.enums.category[v], remove: () => update({ categories: query.categories?.filter((x) => x !== v) }) })),
    ...(query.priceTypes ?? []).map((v) => ({ key: `p-${v}`, label: m.enums.priceType[v], remove: () => update({ priceTypes: query.priceTypes?.filter((x) => x !== v) }) })),
    ...(query.levels ?? []).map((v) => ({ key: `l-${v}`, label: m.enums.level[v], remove: () => update({ levels: query.levels?.filter((x) => x !== v) }) })),
    ...(query.modalities ?? []).map((v) => ({ key: `mo-${v}`, label: m.enums.modality[v], remove: () => update({ modalities: query.modalities?.filter((x) => x !== v) }) })),
    ...(query.types ?? []).map((v) => ({ key: `t-${v}`, label: m.enums.opportunityType[v], remove: () => update({ types: query.types?.filter((x) => x !== v) }) })),
    ...(query.withCertificate ? [{ key: 'cert', label: e.withCertificate, remove: () => update({ withCertificate: false }) }] : []),
  ];

  const data = result.data;
  // Um único tema filtrado? A trilha já começa nele.
  const themes = [...new Set((query.categories ?? []).map((c) => categoryGroupOf[c]))];
  const trailLink = themes.length === 1 ? `/trail?tema=${themes[0]}` : '/trail';
  const filterPanel = <FilterPanel query={query} facets={facets.data} onChange={update} />;

  return (
    <>
      <PageHero eyebrow={e.eyebrow} title={e.title} lead={e.lead} particles={false}>
        <form
          id="busca-catalogo"
          role="search"
          onSubmit={(ev) => {
            ev.preventDefault();
            update({ q: text });
          }}
          className="max-w-2xl"
        >
          <label htmlFor="catalog-search" className="sr-only">
            {e.searchLabel}
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-surface/80 px-4 shadow-2 backdrop-blur focus-within:border-accent/70 focus-within:shadow-[var(--glow-accent)]">
            <Search aria-hidden className="size-5 text-fg-subtle" />
            <input
              id="catalog-search"
              type="search"
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              placeholder={e.searchPlaceholder}
              maxLength={120}
              autoComplete="off"
              className="h-14 min-w-0 flex-1 bg-transparent text-base focus:outline-none"
            />
            {text && (
              <button type="button" onClick={() => setText('')} className="text-fg-subtle hover:text-fg" aria-label={m.common.clear}>
                <X className="size-4" />
              </button>
            )}
          </div>
        </form>
      </PageHero>

      <div className="container-page grid grid-cols-1 gap-10 py-10 lg:grid-cols-[17.5rem_1fr]">
        <aside aria-label={e.filters} className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100dvh-var(--header-h)-3rem)] overflow-y-auto pb-6 pr-2">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold">{e.filters}</h2>
              {active > 0 && (
                <button type="button" onClick={clearAll} className="text-sm text-accent-text hover:underline">
                  {e.clearAll}
                </button>
              )}
            </div>
            {facets.isLoadingVisible ? <Skeleton className="h-96" /> : filterPanel}
          </div>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
            <h2 id="results-heading" className="mr-auto text-sm text-fg-muted" aria-live="polite">
              <span className="font-semibold text-fg">{data ? e.results(data.total) : '…'}</span> {query.q ? e.resultsFor(query.q) : ''}
            </h2>
            <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)} iconLeft={<SlidersHorizontal className="size-4" />}>
              {e.showFilters} {active > 0 && e.filterCount(active)}
            </Button>
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <span>{e.sort}</span>
              <select
                value={query.sort ?? 'relevance'}
                onChange={(ev) => update({ sort: ev.target.value as SortOption })}
                className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-fg"
              >
                {(Object.keys(e.sortOptions) as SortOption[]).map((k) => (
                  <option key={k} value={k}>
                    {e.sortOptions[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label={e.activeFilters(chips.length)}>
              {chips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={chip.remove}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 text-xs text-fg transition-colors hover:border-accent"
                  >
                    {chip.label}
                    <X aria-hidden className="size-3" />
                    <span className="sr-only">({m.common.clear})</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={clearAll} className="text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline">
                  {e.clearAll}
                </button>
              </li>
            </ul>
          )}

          {query.includeDemo && (
            <p className="hatch-demo mt-4 rounded-lg border border-demo/30 px-4 py-3 text-sm text-fg-muted">
              <Badge tone="demo" className="mr-2">
                {m.common.demo}
              </Badge>
              {e.demoIncluded}
            </p>
          )}

          {result.status === 'error' && <StateView state="error" onRetry={result.retry} className="mt-8">{e.errorBody}</StateView>}

          {result.isLoadingVisible && !data && (
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          )}

          {data && data.total === 0 && (
            <StateView
              state="empty"
              title={e.noResultsTitle}
              className="mt-8"
              action={
                <Button variant="secondary" size="sm" onClick={clearAll}>
                  {e.noResultsClear}
                </Button>
              }
            >
              {e.noResultsBody}
            </StateView>
          )}

          {data && data.total > 0 && (
            <>
              <ul className={`mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3 ${result.status === 'loading' ? 'opacity-60' : ''}`}>
                {data.hits.map((hit, i) => (
                  <li key={hit.course.id} className="page-enter" style={{ animationDelay: `${Math.min(i % 12, 8) * 40}ms` }}>
                    <CourseCard course={hit.course} onQuickView={setQuick} />
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-col items-center gap-3">
                <p className="font-mono text-xs text-fg-subtle">{e.showing(data.hits.length, data.total)}</p>
                {data.hasMore && (
                  <Button variant="secondary" onClick={() => setPage((p) => p + 1)} iconRight={<ArrowDown className="size-4" />}>
                    {e.loadMore}
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Pico-final: o fim da lista aponta um próximo passo (com o tema, se um só estiver filtrado). */}
      {data && !data.hasMore && (
        <NextStep kind="explore" primaryTo={trailLink} secondaryTo="/assistant" className="pt-0" />
      )}

      {/* Celular: filtros e busca ao alcance do polegar depois que a busca sai da tela. */}
      <ThumbBar watchId="busca-catalogo" label={e.actions}>
        <button type="button" onClick={() => setFiltersOpen(true)} className={thumbPrimary}>
          <SlidersHorizontal aria-hidden className="size-4" />
          {e.showFilters} {active > 0 && e.filterCount(active)}
        </button>
        <button
          type="button"
          aria-label={e.backToSearch}
          onClick={() => {
            window.scrollTo({ top: 0 });
            document.getElementById('catalog-search')?.focus({ preventScroll: true });
          }}
          className={thumbSecondary}
        >
          <ArrowUp aria-hidden className="size-4 text-accent-text" />
        </button>
      </ThumbBar>

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        variant="drawer"
        title={e.filters}
        description={active > 0 ? e.activeFilters(active) : undefined}
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={clearAll}>
              {e.clearAll}
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              {e.applyFilters} {data ? `(${data.total})` : ''}
            </Button>
          </div>
        }
      >
        {filterPanel}
      </Dialog>

      <CourseQuickView course={quick} onClose={() => setQuick(null)} />
    </>
  );
}
