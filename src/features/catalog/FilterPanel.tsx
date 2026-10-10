import type { ReactNode } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { Chip } from '@/components/ui/Chip';
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
 */
export function FilterPanel({ query, facets, onChange, className }: FilterPanelProps) {
  const { m } = usePreferences();
  const e = m.explore;
  if (!facets) return null;

  return (
    <div className={cn('space-y-5', className)}>
      <Group title={e.category}>
        {facets.categories.map(({ value, count }) => (
          <Chip key={value} selected={!!query.categories?.includes(value)} count={count} onClick={() => onChange({ categories: toggle(query.categories, value) })}>
            {m.enums.category[value]}
          </Chip>
        ))}
      </Group>
      <Group title={e.price}>
        {facets.priceTypes.map(({ value, count }) => (
          <Chip key={value} selected={!!query.priceTypes?.includes(value)} count={count} onClick={() => onChange({ priceTypes: toggle(query.priceTypes, value) })}>
            {m.enums.priceType[value]}
          </Chip>
        ))}
      </Group>
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
      <Group title={e.certificate}>
        <Chip selected={!!query.withCertificate} count={facets.withCertificate} onClick={() => onChange({ withCertificate: !query.withCertificate })}>
          {e.withCertificate}
        </Chip>
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
  );
}
