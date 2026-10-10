import { usePreferences } from '@/app/preferences-context';
import { CountUp } from '@/components/visual/CountUp';
import { Reveal } from '@/components/visual/Reveal';
import { useAsync } from '@/hooks/useAsync';
import { formatDate } from '@/lib/format';
import { useServices } from '@/services/context';

export function IndicatorsSection() {
  const { m, locale } = usePreferences();
  const services = useServices();
  const data = useAsync(async () => {
    const [facets, insights, sources, agents] = await Promise.all([
      services.catalog.getFacets(),
      services.skills.getInsights({}),
      services.sources.list(),
      services.agents.list(),
    ]);
    return {
      verified: facets.total,
      providers: facets.providers,
      skills: insights.skills.length,
      sources: sources.filter((s) => s.origin === 'curated').length,
      agents: agents.length,
      lastChecked: facets.lastCheckedAt,
    };
  }, []);
  const i = m.home.indicators;
  const items = data.data
    ? ([
        ['verified', data.data.verified],
        ['providers', data.data.providers],
        ['skills', data.data.skills],
        ['sources', data.data.sources],
        ['agents', data.data.agents],
      ] as const)
    : [];

  return (
    <section className="container-page py-20 md:py-28">
      <Reveal>
        <p className="eyebrow">{i.eyebrow}</p>
        <h2 className="text-title mt-4">{i.title}</h2>
      </Reveal>
      <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-5">
        {items.map(([key, value], idx) => (
          <Reveal key={key} delay={idx * 80} className="bg-bg p-6 md:p-8">
            <dt className="sr-only">{i.items[key]}</dt>
            <dd>
              <CountUp value={value} className="block font-mono text-4xl font-medium tracking-tight text-fg md:text-5xl" />
              <span className="mt-3 block text-sm leading-snug text-fg-muted">{i.items[key]}</span>
            </dd>
          </Reveal>
        ))}
      </dl>
      {data.data?.lastChecked && <p className="mt-4 font-mono text-xs text-fg-subtle">{i.note(formatDate(data.data.lastChecked, locale) ?? '')}</p>}
    </section>
  );
}
