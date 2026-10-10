import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { PublicationBadge } from '@/components/data/DataBadges';
import { skillDefinitions } from '@/data/catalog/taxonomy';
import { Badge } from '@/components/ui/Badge';
import type { OpsMetrics } from '@/domain/operations';
import { cn } from '@/lib/cn';
import type { AgentEvent, AgentId, Source } from '@/types/domain';

interface Props {
  agent: AgentId;
  events: AgentEvent[];
  metrics: OpsMetrics;
  sources: Source[];
  topSkills: Array<{ label: string; count: number }>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="hatch-demo rounded-xl border border-demo/30 p-4">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-fg-subtle">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Dados ao vivo da estação de cada agente (simulação), exibidos no painel lateral. */
export function StationDetails({ agent, events, metrics, sources, topSkills }: Props) {
  const { m, locale } = usePreferences();
  const st = m.lab.stations;
  const sc = m.lab.screen;
  const rev = [...events].reverse();

  if (agent === 'scout') {
    const demoSources = sources.filter((s) => s.origin === 'demo');
    const statusOf = (s: Source) => {
      if (s.trustStatus === 'blocked') return 'blocked' as const;
      const ev = rev.find((e) => e.entityId === s.id && (e.type === 'source.checked' || e.type === 'agent.error'));
      if (!ev) return 'pending' as const;
      return ev.type === 'agent.error' ? ('failed' as const) : ('checked' as const);
    };
    const discovered = rev.filter((e) => e.type === 'opportunity.discovered').slice(0, 5);
    return (
      <div className="space-y-4">
        <Block title={st.scout.sources}>
          <ul className="space-y-2">
            {demoSources.map((s) => {
              const status = statusOf(s);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{s.name}</span>
                  <Badge tone={status === 'checked' ? 'ok' : status === 'failed' ? 'danger' : status === 'blocked' ? 'warn' : 'neutral'}>{sc.sourceStatus[status]}</Badge>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-fg-subtle">{st.scout.blocked}</p>
        </Block>
        <Block title={st.scout.discovered}>
          {discovered.length ? (
            <ul className="space-y-1.5 text-sm text-fg-muted">
              {discovered.map((e) => (
                <li key={e.id}>› {e.entityLabel}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-subtle">{sc.noData}</p>
          )}
        </Block>
      </div>
    );
  }

  if (agent === 'verifier') {
    const latest = new Map<string, AgentEvent>();
    for (const e of rev) if (e.entityType === 'course' && e.recordStatus && !latest.has(e.entityId)) latest.set(e.entityId, e);
    const rows = [...latest.values()].slice(0, 8);
    return (
      <Block title={st.verifier.queue}>
        <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
          {(
            [
              [m.lab.ops.metrics.validating, metrics.validating],
              [m.lab.ops.metrics.approved, metrics.approved],
              [m.lab.ops.metrics.rejected, metrics.rejected],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="rounded-lg border border-line bg-bg/50 p-2">
              <dd className="font-mono text-lg">{v}</dd>
              <dt className="text-[0.7rem] text-fg-subtle">{l}</dt>
            </div>
          ))}
        </dl>
        {rows.length ? (
          <ul className="space-y-2">
            {rows.map((e) => (
              <li key={e.entityId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-fg-muted">{e.entityLabel}</span>
                {e.recordStatus && <PublicationBadge status={e.recordStatus} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-subtle">{st.verifier.none}</p>
        )}
      </Block>
    );
  }

  if (agent === 'atlas') {
    const graph = rev.find((e) => e.type === 'graph.linked' && e.entityLabel === 'skill-graph');
    const links = rev.filter((e) => e.type === 'graph.linked' && e.entityLabel !== 'skill-graph').slice(0, 5);
    return (
      <Block title={st.atlas.links}>
        <p className="font-mono text-3xl">{graph?.meta?.count ?? '—'}</p>
        <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-fg-subtle">{st.atlas.latest}</p>
        <ul className="mt-2 space-y-1.5 text-sm text-fg-muted">
          {links.length ? (
            links.map((e) => (
              <li key={e.id}>
                › {e.entityLabel} ·{' '}
                {String(e.meta?.skills ?? '')
                  .split(',')
                  .filter(Boolean)
                  .map((id) => skillDefinitions.find((d) => d.id === id)?.name[locale] ?? id)
                  .join(', ')}
              </li>
            ))
          ) : (
            <li>{sc.noData}</li>
          )}
        </ul>
      </Block>
    );
  }

  if (agent === 'trend') {
    const max = topSkills[0]?.count ?? 1;
    return (
      <section className="rounded-xl border border-ok/30 bg-ok-soft p-4">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-fg-subtle">{st.trend.top}</h3>
        <ul className="mt-3 space-y-2">
          {topSkills.slice(0, 6).map((s) => (
            <li key={s.label} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2 text-sm">
              <span className="truncate">{s.label}</span>
              <span className="h-1.5 rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-[var(--chart-bar)]" style={{ width: `${(s.count / max) * 100}%` }} />
              </span>
              <span className="text-right font-mono text-xs">{s.count}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg-muted">{st.trend.note}</p>
      </section>
    );
  }

  const queries = rev.filter((e) => e.type === 'assistant.query').slice(0, 5);
  return (
    <Block title={st.sol.queries}>
      <ul className="space-y-2">
        {queries.length ? (
          queries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
              <Link to={`/assistant?q=${encodeURIComponent(e.entityLabel ?? '')}`} className={cn('truncate text-fg-muted hover:text-accent-text')}>
                “{e.entityLabel}”
              </Link>
              <span className="shrink-0 font-mono text-xs text-fg-subtle">{sc.results(Number(e.meta?.count ?? 0))}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-fg-subtle">{sc.noData}</li>
        )}
      </ul>
      <Link to="/assistant" className="mt-4 inline-flex items-center gap-1 text-sm text-accent-text hover:underline">
        {st.sol.open} <ArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    </Block>
  );
}
