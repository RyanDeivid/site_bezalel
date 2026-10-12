import { useState, type ReactNode } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { Chip } from '@/components/ui/Chip';
import { categoryGroupOf, categoryGroups } from '@/data/catalog/taxonomy';
import type { CatalogFacets, CatalogQuery } from '@/domain/catalog/search';
import { cn } from '@/lib/cn';

interface FilterPanelProps {
  query: CatalogQuery;
  facets: CatalogFacets | undefined;
  onChange: (patch: Partial<CatalogQuery>) => void;
  className?: string;
}

function toggle<T>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-fg-subtle">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/**
 * Filtros do catálogo. Só aparecem valores com registros ("quando houver
 * dados"); as contagens vêm das facetas do conjunto publicado.
 *
 * Poucas escolhas por vez (v2 · Fase 5): primeiro os 7 temas, cada um abre as
 * próprias áreas; depois os filtros que mais decidem (preço e certificado); o
 * resto fica em "Mais filtros". Abertos de início só os que já têm algo
 * marcado — e depois o visitante abre e fecha à vontade (<details> nativo).
 */
export function FilterPanel({ query, facets, onChange, className }: FilterPanelProps) {
  const { m, locale } = usePreferences();
  const e = m.explore;
  const moreCount = (query.levels?.length ?? 0) + (query.modalities?.length ?? 0) + (query.types?.length ?? 0) + (query.includeDemo ? 1 : 0);
  // Estado inicial, fixado na montagem: abrir/fechar depois é com o visitante.
  const [initiallyOpen] = useState(() => ({
    themes: new Set(categoryGroups.filter((g) => query.categories?.some((c) => categoryGroupOf[c] === g.id)).map((g) => g.id)),
    more: moreCount > 0,
  }));
  if (!facets) return null;

  return (
    <div className={cn('space-y-5', className)}>
      <Group title={e.category}>
        <div className="w-full space-y-2">
          {categoryGroups.map((group) => {
            const items = facets.categories.filter((f) => categoryGroupOf[f.value] === group.id);
            if (!items.length) return null;
            const marked = items.filter((i) => query.categories?.includes(i.value)).length;
            const total = items.reduce((n, i) => n + i.count, 0);
            return (
              <details key={group.id} open={initiallyOpen.themes.has(group.id) || undefined} className="rounded-lg border border-line">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className={cn(marked > 0 && 'font-medium text-accent-text')}>
                    {group.name[locale]}
                    {marked > 0 && ` ${e.filterCount(marked)}`}
                  </span>
                  <span className="font-mono text-xs text-fg-subtle">{total}</span>
                </summary>
                <div role="group" aria-label={group.name[locale]} className="flex flex-wrap gap-2 px-3 pb-3">
                  {items.map(({ value, count }) => (
                    <Chip key={value} selected={!!query.categories?.includes(value)} count={count} onClick={() => onChange({ categories: toggle(query.categories, value) })}>
                      {m.enums.category[value]}
                    </Chip>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </Group>
      <Group title={e.price}>
        {facets.priceTypes.map(({ value, count }) => (
          <Chip key={value} selected={!!query.priceTypes?.includes(value)} count={count} onClick={() => onChange({ priceTypes: toggle(query.priceTypes, value) })}>
            {m.enums.priceType[value]}
          </Chip>
        ))}
      </Group>
      <Group title={e.certificate}>
        <Chip selected={!!query.withCertificate} count={facets.withCertificate} onClick={() => onChange({ withCertificate: !query.withCertificate })}>
          {e.withCertificate}
        </Chip>
      </Group>
      <details open={initiallyOpen.more || undefined} className="border-t border-line pt-5">
        <summary className="cursor-pointer text-sm font-medium">
          {e.moreFilters}
          {moreCount > 0 && ` ${e.filterCount(moreCount)}`}
        </summary>
        <div className="mt-5 space-y-5">
          <Group title={e.level}>
            {facets.levels.map(({ value, count }) => (
              <Chip key={value} selected={!!query.levels?.includes(value)} count={count} onClick={() => onChange({ levels: toggle(query.levels, value) })}>
                {m.enums.level[value]}
              </Chip>
            ))}
          </Group>
          <Group title={e.modality}>
            {facets.modalities.map(({ value, count }) => (
              <Chip key={value} selected={!!query.modalities?.includes(value)} count={count} onClick={() => onChange({ modalities: toggle(query.modalities, value) })}>
                {m.enums.modality[value]}
              </Chip>
            ))}
          </Group>
          <Group title={e.type}>
            {facets.types.map(({ value, count }) => (
              <Chip key={value} selected={!!query.types?.includes(value)} count={count} onClick={() => onChange({ types: toggle(query.types, value) })}>
                {m.enums.opportunityType[value]}
              </Chip>
            ))}
          </Group>
          <Group title={e.dataScope}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm transition-colors hover:border-demo/40">
              <input
                type="checkbox"
                checked={!!query.includeDemo}
                onChange={(ev) => onChange({ includeDemo: ev.target.checked })}
                className="mt-0.5 size-4 accent-[var(--demo)]"
              />
              <span>
                <span className="block font-medium">{e.includeDemo}</span>
                <span className="mt-0.5 block text-xs text-fg-muted">{e.includeDemoHelp}</span>
              </span>
            </label>
          </Group>
        </div>
      </details>
    </div>
  );
}
