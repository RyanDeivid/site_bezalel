import {
  Apple,
  ArrowRight,
  ArrowUpRight,
  Brain,
  Briefcase,
  Cloud,
  Code2,
  Cpu,
  Database,
  Dumbbell,
  Factory,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Landmark,
  Languages,
  Leaf,
  Lock,
  Megaphone,
  Monitor,
  Palette,
  PenTool,
  PiggyBank,
  Scale,
  TrendingUp,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { SectionHeader } from '@/components/layout/PageHero';
import { Reveal } from '@/components/visual/Reveal';
import { categories, categoryGroups } from '@/data/catalog/taxonomy';
import { explorePath } from '@/domain/catalog/query-params';
import { useAsync } from '@/hooks/useAsync';
import { cn } from '@/lib/cn';
import { useServices } from '@/services/context';
import type { CategoryGroupId, CategoryId } from '@/types/domain';

type Icon = ComponentType<{ className?: string }>;

const CATEGORY_ICON: Record<CategoryId, Icon> = {
  'ai-ml': Brain,
  'computer-science': Code2,
  'web-development': Monitor,
  data: Database,
  'cloud-infra': Cloud,
  'security-privacy': Lock,
  health: HeartPulse,
  'physical-education': Dumbbell,
  nutrition: Apple,
  'mental-health': HeartHandshake,
  education: GraduationCap,
  languages: Languages,
  business: Briefcase,
  finance: PiggyBank,
  career: TrendingUp,
  design: PenTool,
  marketing: Megaphone,
  industry: Factory,
  'agro-environment': Leaf,
  'digital-government': Landmark,
  'public-admin-law': Scale,
};

const GROUP_ICON: Record<CategoryGroupId, Icon> = {
  tech: Cpu,
  health: HeartPulse,
  learning: GraduationCap,
  business: Briefcase,
  creative: Palette,
  production: Factory,
  public: Landmark,
};

/**
 * Áreas agrupadas: 7 grupos em vez de 21 cartões soltos. O visitante escolhe
 * primeiro o grande tema e só depois a área — menos esforço de leitura.
 */
export function CategoriesSection() {
  const { m, locale } = usePreferences();
  const services = useServices();
  const facets = useAsync(() => services.catalog.getFacets(), []);
  const count = (id: CategoryId) => facets.data?.categories.find((c) => c.value === id)?.count ?? 0;
  const c = m.home.categories;

  return (
    <section className="relative border-y border-line bg-bg-deep py-14 md:py-28">
      <div aria-hidden className="bg-blueprint absolute inset-0 opacity-50" />
      <div className="container-page relative">
        <Reveal>
          <SectionHeader eyebrow={c.eyebrow} title={c.title} lead={c.lead(categories.length, categoryGroups.length)} />
        </Reveal>
        <ul className="bz-rail bz-rail-bleed mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-12 lg:grid-cols-4">
          {categoryGroups.map((group, i) => {
            const GroupIcon = GROUP_ICON[group.id];
            const areas = categories.filter((cat) => cat.group === group.id);
            const total = areas.reduce((sum, cat) => sum + count(cat.id), 0);
            const wide = areas.length > 4;
            return (
              <Reveal as="li" key={group.id} delay={(i % 4) * 80} className={cn(wide && 'sm:col-span-2')}>
                <div className="group/card relative flex h-full flex-col rounded-2xl border border-line bg-surface/70 p-5 backdrop-blur transition-[border-color,background-color] duration-500 hover:border-accent/40 hover:bg-surface sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-bg text-accent-text">
                      <GroupIcon className="size-5" />
                    </span>
                    <p className="font-mono text-xs uppercase tracking-wider text-accent-text">{total > 0 ? c.courses(total) : c.empty}</p>
                  </div>
                  <h3 className={cn('mt-5 font-semibold', wide ? 'text-2xl' : 'text-lg')}>{group.name[locale]}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{group.tagline[locale]}</p>
                  <ul className={cn('mt-4 grid gap-1', wide && 'sm:grid-cols-2 sm:gap-x-4')}>
                    {areas.map((cat) => {
                      const AreaIcon = CATEGORY_ICON[cat.id];
                      const n = count(cat.id);
                      return (
                        <li key={cat.id}>
                          <Link
                            to={explorePath({ categories: [cat.id] })}
                            viewTransition
                            title={cat.description[locale]}
                            className="group/area -mx-2 flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-bg/70"
                          >
                            <AreaIcon aria-hidden className="size-4 shrink-0 text-fg-subtle transition-colors group-hover/area:text-accent-text" />
                            <span className="min-w-0 flex-1 truncate">{cat.name[locale]}</span>
                            <span className="font-mono text-xs tabular-nums text-fg-subtle">{n}</span>
                            <ArrowUpRight
                              aria-hidden
                              className="size-3.5 shrink-0 text-fg-subtle opacity-0 transition-[opacity,transform] duration-300 group-hover/area:-translate-y-0.5 group-hover/area:translate-x-0.5 group-hover/area:opacity-100"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    to={explorePath({ categories: areas.map((a) => a.id) })}
                    viewTransition
                    className="mt-auto inline-flex min-h-11 items-center gap-1.5 self-start pt-4 text-sm font-medium text-accent-text hover:underline"
                  >
                    {c.seeGroup}
                    <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/card:translate-x-0.5" />
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
