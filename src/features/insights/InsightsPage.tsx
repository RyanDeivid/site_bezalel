import { ArrowRight, CircleOff, FlaskConical, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { PageHero, SectionHeader } from '@/components/layout/PageHero';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton, StateView } from '@/components/ui/StateView';
import { Reveal } from '@/components/visual/Reveal';
import { categories, skillDefinitions } from '@/data/catalog/taxonomy';
import { DEMO_MENTION_PERIODS } from '@/data/demo/mentions';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatDate } from '@/lib/format';
import { useServices } from '@/services/context';
import type { CategoryId } from '@/types/domain';
import { HorizontalBars, TrendLines } from './charts';
import { SkillCourseGraph } from './SkillCourseGraph';

/** Cor fixa por competência na série temporal: a cor segue a entidade, nunca a posição. */
const SERIES_COLOR: Record<string, string> = {
  'ai-agents': 'var(--series-1)',
  llm: 'var(--series-2)',
  python: 'var(--series-3)',
  'data-analysis': 'var(--series-4)',
  'information-security': 'var(--series-5)',
  'privacy-lgpd': 'var(--series-6)',
};

export default function InsightsPage() {
  const { m, locale } = usePreferences();
  const t = m.insights;
  const services = useServices();
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [range, setRange] = useState<[number, number]>([0, DEMO_MENTION_PERIODS.length - 1]);
  useDocumentMeta({ title: m.meta.insights.title, description: m.meta.insights.description, path: '/insights' });

  const insights = useAsync(() => services.skills.getInsights({ category, periodRange: range }), [category, range]);
  const registry = useAsync(() => services.catalog.listRegistry(), []);
  const facets = useAsync(() => services.catalog.getFacets(), []);
  const curated = useMemo(() => (registry.data ?? []).filter((c) => c.origin !== 'demo' && c.publicationStatus === 'published'), [registry.data]);
  const skillName = (id: string) => skillDefinitions.find((s) => s.id === id)?.name[locale] ?? id;
  const data = insights.data;

  const skillBars = (data?.skills ?? []).slice(0, 12).map((s) => ({
    label: skillName(s.skillId),
    value: s.courseCount,
    extra: { label: t.skillsChart.free, value: s.freeCourseCount },
  }));
  const categoryBars = (data?.categories ?? []).map((c) => ({ label: m.enums.category[c.category], value: c.courseCount }));
  const series = (data?.mentions.skills ?? []).map((id) => ({ key: id, label: skillName(id), color: SERIES_COLOR[id] ?? 'var(--series-1)' }));

  const periodFrom = data?.periodChecked.from ? formatDate(data.periodChecked.from, locale) : null;
  const periodTo = data?.periodChecked.to ? formatDate(data.periodChecked.to, locale) : null;

  return (
    <>
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        lead={t.lead}
        aside={
          <dl className="glass space-y-4 rounded-2xl p-6 text-sm">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{t.scopeTitle}</p>
            <div>
              <dt className="text-fg-subtle">{t.scopePeriod}</dt>
              <dd className="mt-1 font-medium">{periodFrom && periodTo ? (periodFrom === periodTo ? periodFrom : `${periodFrom} – ${periodTo}`) : '—'}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">{t.scopeSource}</dt>
              <dd className="mt-1 font-medium">{facets.data ? t.scopeSourceValue(facets.data.total, facets.data.providers) : '—'}</dd>
            </div>
          </dl>
        }
      />

      <div className="sticky top-[var(--header-h)] z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="container-page flex flex-wrap items-end gap-4 py-3">
          <label className="text-xs text-fg-muted">
            {t.filters.category}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryId | 'all')}
              className="mt-1 block h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-fg"
            >
              <option value="all">{t.filters.allCategories}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name[locale]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex items-end gap-2 text-xs text-fg-muted">
            <legend className="mb-1">{t.filters.period}</legend>
            <label>
              <span className="sr-only">{t.filters.from}</span>
              <select
                value={range[0]}
                onChange={(e) => setRange(([, to]) => [Math.min(Number(e.target.value), to), to])}
                className="block h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-fg"
                aria-label={t.filters.from}
              >
                {DEMO_MENTION_PERIODS.map((p, i) => (
                  <option key={p} value={i}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <span className="pb-2">→</span>
            <label>
              <span className="sr-only">{t.filters.to}</span>
              <select
                value={range[1]}
                onChange={(e) => setRange(([from]) => [from, Math.max(Number(e.target.value), from)])}
                className="block h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-fg"
                aria-label={t.filters.to}
              >
                {DEMO_MENTION_PERIODS.map((p, i) => (
                  <option key={p} value={i}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        </div>
      </div>

      <div className="container-page space-y-16 py-12">
        <section aria-labelledby="indicators-heading">
          <h2 id="indicators-heading" className="text-xl font-semibold">
            {t.indicatorsTitle}
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <li className="rounded-xl border border-ok/30 bg-ok-soft p-5">
              <Badge tone="ok" icon={<ShieldCheck />}>
                {t.indicators.courses.tag}
              </Badge>
              <p className="mt-3 font-semibold">{t.indicators.courses.name}</p>
              <p className="mt-1 text-sm text-fg-muted">{t.indicators.courses.help}</p>
            </li>
            <li className="hatch-demo rounded-xl border border-demo/35 p-5">
              <Badge tone="demo" icon={<FlaskConical />}>
                {t.indicators.mentions.tag}
              </Badge>
              <p className="mt-3 font-semibold">{t.indicators.mentions.name}</p>
              <p className="mt-1 text-sm text-fg-muted">{t.indicators.mentions.help}</p>
            </li>
            <li className="rounded-xl border border-dashed border-line-strong p-5">
              <Badge tone="warn" icon={<CircleOff />}>
                {t.indicators.jobs.tag}
              </Badge>
              <p className="mt-3 font-semibold">{t.indicators.jobs.name}</p>
              <p className="mt-1 text-sm text-fg-muted">{t.indicators.jobs.help}</p>
            </li>
          </ul>
        </section>

        {insights.status === 'error' && <StateView state="error" onRetry={insights.retry} />}
        {insights.isLoadingVisible && !data && <Skeleton className="h-96" />}

        {data && (
          <div className={`grid gap-6 lg:grid-cols-12 ${insights.status === 'loading' ? 'opacity-60' : ''}`}>
            <ChartFrame
              className="lg:col-span-7"
              title={t.skillsChart.title}
              lead={t.skillsChart.lead}
              badge={<Badge tone="ok">{t.indicators.courses.tag}</Badge>}
              footer={t.skillsChart.source}
              table={{
                label: t.skillsChart.table,
                head: [t.skillsChart.skill, t.skillsChart.courses, t.skillsChart.free],
                rows: data.skills.map((s) => [skillName(s.skillId), s.courseCount, s.freeCourseCount]),
              }}
            >
              {skillBars.length ? <HorizontalBars data={skillBars} valueLabel={t.skillsChart.courses} /> : <StateView state="empty" compact>{t.skillsChart.empty}</StateView>}
            </ChartFrame>

            <div className="space-y-6 lg:col-span-5">
              <ChartFrame
                title={t.categoriesChart.title}
                lead={t.categoriesChart.lead}
                table={{
                  label: t.skillsChart.table,
                  head: [t.skillsChart.category, t.skillsChart.courses, t.skillsChart.skill],
                  rows: data.categories.map((c) => [m.enums.category[c.category], c.courseCount, t.categoriesChart.skills(c.skillCount)]),
                }}
              >
                <HorizontalBars data={categoryBars} valueLabel={t.skillsChart.courses} />
              </ChartFrame>

              <div className="panel p-5">
                <h3 className="font-semibold">{t.composition.title}</h3>
                {(
                  [
                    [t.composition.price, data.price.map((p) => ({ label: m.enums.priceType[p.value], count: p.count }))],
                    [t.composition.level, data.levels.map((l) => ({ label: m.enums.level[l.value], count: l.count }))],
                  ] as const
                ).map(([title, rows]) => (
                  <div key={title} className="mt-5">
                    <p className="font-mono text-[0.7rem] uppercase tracking-wider text-fg-subtle">{title}</p>
                    <ul className="mt-3 space-y-2">
                      {rows.map((row) => (
                        <li key={row.label} className="grid grid-cols-[9.5rem_1fr_2rem] items-center gap-3 text-sm">
                          <span className="truncate text-fg-muted">{row.label}</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                            <span className="block h-full rounded-full bg-[var(--chart-bar)]" style={{ width: `${(row.count / Math.max(1, data.totalCourses)) * 100}%` }} />
                          </span>
                          <span className="text-right font-mono text-xs">{row.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {data && (
          <Reveal as="section" aria-labelledby="relations-heading">
            <SectionHeader title={<span id="relations-heading">{t.relations.title}</span>} lead={t.relations.lead} />
            <div className="panel mt-6 p-5 md:p-6">
              <SkillCourseGraph skills={data.skills} courses={curated} pairs={data.pairs} skillName={skillName} />
            </div>
          </Reveal>
        )}

        {data && (
          <Reveal as="section">
            <ChartFrame
              demo
              title={t.timeline.title}
              lead={t.timeline.lead}
              badge={
                <Badge tone="demo" icon={<FlaskConical />}>
                  {t.timeline.badge}
                </Badge>
              }
              footer={t.timeline.disclaimer}
              table={{
                label: t.skillsChart.table,
                head: [t.skillsChart.period, ...series.map((s) => s.label)],
                rows: data.mentions.points.map((p) => [String(p.period), ...series.map((s) => Number(p[s.key] ?? 0))]),
              }}
            >
              <TrendLines data={data.mentions.points} series={series} />
            </ChartFrame>
          </Reveal>
        )}

        <Reveal as="section">
          <StateView state="unavailable" title={t.jobs.title}>
            {t.jobs.body}
          </StateView>
        </Reveal>

        <Reveal as="section" className="panel p-6 md:p-8">
          <h2 className="text-xl font-semibold">{t.methodology.title}</h2>
          <ul className="mt-5 space-y-3">
            {t.methodology.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-fg-muted">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rotate-45 bg-accent" />
                {item}
              </li>
            ))}
          </ul>
          <ButtonLink to="/methodology" variant="secondary" className="mt-6" iconRight={<ArrowRight className="size-4" />}>
            {t.methodology.link}
          </ButtonLink>
        </Reveal>
      </div>
    </>
  );
}
