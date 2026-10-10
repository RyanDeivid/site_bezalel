import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { OriginBadge } from '@/components/data/DataBadges';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/visual/Reveal';
import { skillDefinitions } from '@/data/catalog/taxonomy';
import { explorePath } from '@/domain/catalog/query-params';
import { useAsync } from '@/hooks/useAsync';
import { useInView } from '@/hooks/useInView';
import { useServices } from '@/services/context';

export function SkillsSection() {
  const { m, locale } = usePreferences();
  const services = useServices();
  const insights = useAsync(() => services.skills.getInsights({}), []);
  const { ref, inView } = useInView<HTMLUListElement>();
  const s = m.home.skills;
  const top = insights.data?.skills.slice(0, 8) ?? [];
  const max = top[0]?.courseCount ?? 1;
  const name = (id: string) => skillDefinitions.find((d) => d.id === id)?.name[locale] ?? id;

  return (
    <section className="container-page grid grid-cols-1 gap-12 py-20 md:py-28 lg:grid-cols-12">
      <Reveal className="lg:col-span-5">
        <p className="eyebrow">{s.eyebrow}</p>
        <h2 className="text-title mt-4">{s.title}</h2>
        <p className="mt-4 text-fg-muted">{s.lead}</p>
        <div className="mt-6 flex items-center gap-3">
          <OriginBadge origin="curated" />
        </div>
        <ButtonLink to="/insights" variant="secondary" className="mt-8" iconRight={<ArrowRight className="size-4" />}>
          {s.cta}
        </ButtonLink>
      </Reveal>
      <ul ref={ref} className="space-y-3 lg:col-span-7">
        {top.map((skill, i) => (
          <li key={skill.skillId}>
            <Link
              to={explorePath({ q: name(skill.skillId) })}
              viewTransition
              className="group grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface sm:grid-cols-[12rem_1fr_auto]"
            >
              <span className="truncate text-sm font-medium group-hover:text-accent-text">{name(skill.skillId)}</span>
              <span className="relative h-2.5 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent/60 to-accent transition-[width] duration-[1.2s] ease-[var(--ease-out)]"
                  style={{ width: inView ? `${(skill.courseCount / max) * 100}%` : '0%', transitionDelay: `${i * 80}ms` }}
                />
              </span>
              <span className="w-20 text-right font-mono text-xs text-fg-muted">{s.courses(skill.courseCount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
