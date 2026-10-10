import { ArrowUpRight, Brain, Cloud, Code2, Database, Landmark, Lock, Monitor } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { SectionHeader } from '@/components/layout/PageHero';
import { Reveal } from '@/components/visual/Reveal';
import { categories } from '@/data/catalog/taxonomy';
import { explorePath } from '@/domain/catalog/query-params';
import { useAsync } from '@/hooks/useAsync';
import { cn } from '@/lib/cn';
import { useServices } from '@/services/context';
import type { CategoryId } from '@/types/domain';

export const CATEGORY_ICON: Record<CategoryId, ComponentType<{ className?: string }>> = {
  'ai-ml': Brain,
  'computer-science': Code2,
  'web-development': Monitor,
  data: Database,
  'cloud-infra': Cloud,
  'security-privacy': Lock,
  'digital-government': Landmark,
};

export function CategoriesSection() {
  const { m, locale } = usePreferences();
  const services = useServices();
  const facets = useAsync(() => services.catalog.getFacets(), []);
  const count = (id: CategoryId) => facets.data?.categories.find((c) => c.value === id)?.count ?? 0;
  const c = m.home.categories;

  return (
    <section className="relative border-y border-line bg-bg-deep py-20 md:py-28">
      <div aria-hidden className="bg-blueprint absolute inset-0 opacity-50" />
      <div className="container-page relative">
        <Reveal>
          <SectionHeader eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
        </Reveal>
        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat, i) => {
            const Icon = CATEGORY_ICON[cat.id];
            const n = count(cat.id);
            return (
              <Reveal as="li" key={cat.id} delay={(i % 4) * 80} className={cn(i === 0 && 'sm:col-span-2')}>
                <Link
                  to={explorePath({ categories: [cat.id] })}
                  viewTransition
                  className={cn(
                    'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface/70 p-6 backdrop-blur transition-[border-color,transform,background-color] duration-500 hover:-translate-y-1 hover:border-accent/50 hover:bg-surface',
                    i === 0 ? 'min-h-48 lg:p-8' : 'min-h-48',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-xl border border-line bg-bg text-accent-text">
                      <Icon className="size-5" />
                    </span>
                    <ArrowUpRight aria-hidden className="size-5 text-fg-subtle transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-text" />
                  </div>
                  <h3 className={cn('mt-auto pt-8 font-semibold', i === 0 ? 'text-3xl' : 'text-lg')}>{cat.name[locale]}</h3>
                  <p className={cn('mt-2 text-sm text-fg-muted', i === 0 ? 'max-w-sm' : 'line-clamp-2')}>{cat.description[locale]}</p>
                  <p className="mt-4 font-mono text-xs uppercase tracking-wider text-accent-text">{n > 0 ? c.courses(n) : c.empty}</p>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
