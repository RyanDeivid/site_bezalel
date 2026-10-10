import { ArrowRight, ArrowUpRight, Award, Clock } from 'lucide-react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { OriginBadge } from '@/components/data/DataBadges';
import { SectionHeader } from '@/components/layout/PageHero';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton, StateView } from '@/components/ui/StateView';
import { Reveal } from '@/components/visual/Reveal';
import { coursePath, durationLabel, priceLabel } from '@/features/catalog/present';
import { useAsync } from '@/hooks/useAsync';
import { formatDate } from '@/lib/format';
import { useServices } from '@/services/context';

export function FeaturedSection() {
  const { m, locale } = usePreferences();
  const services = useServices();
  const result = useAsync(() => services.catalog.search({ priceTypes: ['free'], withCertificate: true, sort: 'relevance', pageSize: 5 }), []);
  const f = m.home.featured;
  const [spot, ...rest] = result.data?.hits.map((h) => h.course) ?? [];

  return (
    <section className="container-page py-20 md:py-28">
      <Reveal>
        <SectionHeader
          eyebrow={f.eyebrow}
          title={f.title}
          lead={f.lead}
          action={
            <ButtonLink to="/explore" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
              {f.viewAll}
            </ButtonLink>
          }
        />
      </Reveal>

      {result.status === 'error' && <StateView state="error" onRetry={result.retry} className="mt-10" />}
      {result.isLoadingVisible && (
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[4.5rem]" />
            ))}
          </div>
        </div>
      )}

      {spot && (
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal>
            <Link
              to={coursePath(spot)}
              viewTransition
              className="group relative flex h-full min-h-80 flex-col overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface-2 via-surface to-bg p-8 transition-[border-color,box-shadow] duration-500 hover:border-accent/50 hover:shadow-3"
            >
              <BezalelMark className="absolute -right-10 -top-10 size-64 text-fg opacity-[0.07] transition-transform duration-[1.2s] ease-[var(--ease-out)] group-hover:rotate-[30deg] group-hover:scale-110" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{f.spotlight}</Badge>
                <OriginBadge origin={spot.origin} />
              </div>
              <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-fg-subtle">{spot.provider.name}</p>
              <h3 className="mt-3 max-w-md text-3xl font-semibold leading-tight">{spot.title}</h3>
              <p className="mt-4 line-clamp-3 max-w-lg text-fg-muted">{spot.description}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-8 text-sm text-fg-muted">
                <span className="text-ok">{priceLabel(spot, m, locale)}</span>
                {durationLabel(spot, m) && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock aria-hidden className="size-4" /> {durationLabel(spot, m)}
                  </span>
                )}
                {spot.certificateType && (
                  <span className="inline-flex items-center gap-1.5">
                    <Award aria-hidden className="size-4" /> {m.enums.certificateType[spot.certificateType]}
                  </span>
                )}
                <ArrowUpRight aria-hidden className="ml-auto size-6 text-accent-text transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" />
              </div>
            </Link>
          </Reveal>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {rest.map((c, i) => (
              <Reveal as="li" key={c.id} delay={i * 90}>
                <Link to={coursePath(c)} viewTransition className="group flex items-center gap-5 p-5 transition-colors hover:bg-surface md:p-6">
                  <span className="font-mono text-sm text-fg-subtle">0{i + 2}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs uppercase tracking-[0.14em] text-fg-subtle">{c.provider.name}</p>
                    <p className="mt-1 truncate font-medium group-hover:text-accent-text">{c.title}</p>
                    <p className="mt-1 text-xs text-fg-muted">
                      {priceLabel(c, m, locale)} · {m.common.lastChecked} {formatDate(c.lastCheckedAt, locale)}
                    </p>
                  </div>
                  <ArrowRight aria-hidden className="size-5 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-1 group-hover:text-accent-text" />
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
