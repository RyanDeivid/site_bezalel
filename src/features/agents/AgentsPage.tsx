import { ArrowRight, Database } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { AgentPanel } from '@/components/agents/AgentPanel';
import { AGENT_COLOR, AgentGlyph } from '@/components/agents/AgentGlyph';
import { AgentStatusBadges } from '@/components/agents/AgentStatus';
import { EventFeed } from '@/components/agents/EventFeed';
import { NextStep } from '@/components/layout/NextStep';
import { PageHero, SectionHeader } from '@/components/layout/PageHero';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton, StateView } from '@/components/ui/StateView';
import { Reveal } from '@/components/visual/Reveal';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useEventFeed } from '@/hooks/useEventFeed';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useServices } from '@/services/context';
import type { AgentId } from '@/types/domain';
import { useAnimationGate } from '@/hooks/useAnimationGate';

/** Diagrama do fluxo entre agentes com conexões animadas. */
function AgentFlow() {
  const { m } = usePreferences();
  const gate = useAnimationGate<HTMLDivElement>();
  const nodes: Array<{ id: AgentId | 'catalog'; x: number; y: number }> = [
    { id: 'scout', x: 90, y: 160 },
    { id: 'verifier', x: 300, y: 160 },
    { id: 'catalog', x: 510, y: 160 },
    { id: 'vigia', x: 405, y: 52 },
    { id: 'atlas', x: 300, y: 300 },
    { id: 'trend', x: 510, y: 300 },
    { id: 'sol', x: 720, y: 230 },
  ];
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<string, { x: number; y: number }>;
  const edges: Array<[string, string]> = [
    ['scout', 'verifier'],
    ['verifier', 'catalog'],
    ['verifier', 'atlas'],
    ['atlas', 'catalog'],
    ['catalog', 'trend'],
    ['catalog', 'sol'],
    ['trend', 'sol'],
    // Reconferência: o Vigia acompanha o catálogo e devolve vencidos ao Verifier.
    ['catalog', 'vigia'],
    ['vigia', 'verifier'],
  ];
  return (
    <div ref={gate} className="overflow-x-auto rounded-2xl border border-line bg-bg-deep p-4">
      <svg viewBox="0 0 810 390" className="min-w-[640px]" role="img" aria-label={m.agentsPage.flowLead}>
        {edges.map(([a, b], i) => {
          const p = pos[a]!;
          const q = pos[b]!;
          return (
            <g key={`${a}-${b}`}>
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--line-strong)" strokeWidth="1.2" />
              <line
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="8 232"
                style={{ animation: `bz-flow ${3 + (i % 3)}s linear infinite`, animationDelay: `${-i * 0.6}s` }}
              />
            </g>
          );
        })}
        {nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
            <circle r="34" fill="var(--surface)" stroke={n.id === 'catalog' ? 'var(--accent)' : AGENT_COLOR[n.id as AgentId]} strokeWidth="1.6" />
            <g style={{ color: n.id === 'catalog' ? 'var(--accent)' : AGENT_COLOR[n.id as AgentId] }}>
              {n.id === 'catalog' ? <Database x={-13} y={-13} width={26} height={26} /> : <AgentGlyph agent={n.id as AgentId} x={-15} y={-15} width={30} height={30} />}
            </g>
            <text y="54" textAnchor="middle" fontSize="13" fill="var(--fg)" fontFamily="var(--font-sans)">
              {n.id === 'catalog' ? m.agentsPage.flowCatalog : n.id[0]!.toUpperCase() + n.id.slice(1)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AgentsPage() {
  const { m, locale } = usePreferences();
  const a = m.agentsPage;
  const services = useServices();
  const agents = useAsync(() => services.agents.list(), []);
  const feed = useEventFeed();
  const [open, setOpen] = useState<AgentId | null>(null);
  const [filter, setFilter] = useState<AgentId | 'all'>('all');
  useDocumentMeta({ title: m.meta.agents.title, description: m.meta.agents.description, path: '/agents' });

  const counts = Object.values(feed.agents).reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const selected = agents.data?.find((x) => x.id === open) ?? null;
  const filteredEvents = filter === 'all' ? feed.events : feed.events.filter((e) => e.agentId === filter);

  return (
    <>
      <PageHero
        eyebrow={a.eyebrow}
        title={a.title}
        lead={a.lead}
        aside={
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{a.statusTitle}</p>
              <Badge tone="demo">{m.common.simulation}</Badge>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
              {(['active', 'idle', 'failed'] as const).map((s) => (
                <div key={s} className="rounded-xl border border-line bg-bg/40 p-3">
                  <dd className={cn('font-mono text-3xl', s === 'active' && 'text-ok', s === 'failed' && 'text-danger')}>{counts[s] ?? 0}</dd>
                  <dt className="mt-1 text-xs text-fg-muted">{m.enums.agentStatus[s]}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-fg-subtle">{a.statusDemoNote}</p>
          </div>
        }
      />

      <div className="container-page space-y-20 py-14">
        <section>
          <h2 className="text-xl font-semibold">{a.legendTitle}</h2>
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['active', 'idle', 'failed', 'demo'] as const).map((k) => (
              <div key={k} className="rounded-xl border border-line p-4">
                <dt>
                  <Badge tone={k === 'active' ? 'ok' : k === 'failed' ? 'danger' : k === 'demo' ? 'demo' : 'neutral'} pulse={k === 'active'}>
                    {k === 'demo' ? m.common.demo : m.enums.agentStatus[k]}
                  </Badge>
                </dt>
                <dd className="mt-2 text-sm text-fg-muted">{a.legend[k]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Reveal as="section">
          <SectionHeader title={a.flowTitle} lead={a.flowLead} />
          <div className="mt-6">
            <AgentFlow />
          </div>
        </Reveal>

        <section>
          {agents.status === 'error' && <StateView state="error" onRetry={agents.retry} />}
          {agents.isLoadingVisible && <Skeleton className="h-80" />}
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {agents.data?.map((agent, i) => {
              const live = feed.agents[agent.id];
              return (
                <Reveal as="li" key={agent.id} delay={i * 70}>
                  <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 transition-[border-color] duration-300 hover:border-[color:var(--c)]" style={{ '--c': AGENT_COLOR[agent.id] } as CSSProperties}>
                    <span aria-hidden className="absolute -right-12 -top-12 size-40 rounded-full opacity-10 blur-2xl transition-opacity duration-500 group-hover:opacity-25" style={{ background: AGENT_COLOR[agent.id] }} />
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-12 place-items-center rounded-xl border" style={{ color: AGENT_COLOR[agent.id], borderColor: AGENT_COLOR[agent.id] }}>
                        <AgentGlyph agent={agent.id} className="size-6" />
                      </span>
                      <AgentStatusBadges status={live.status} mode={agent.mode} />
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold">{agent.name}</h3>
                    <p className="text-sm" style={{ color: AGENT_COLOR[agent.id] }}>
                      {agent.role[locale]}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-fg-muted">{agent.description[locale]}</p>
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {agent.taskTypes.map((tt) => (
                        <li key={tt[locale]} className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-fg-muted">
                          {tt[locale]}
                        </li>
                      ))}
                    </ul>
                    <div aria-hidden className="min-h-5 flex-1" />
                    <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                      <div>
                        <dt className="text-fg-subtle">{a.lastActivity}</dt>
                        <dd className="mt-0.5 text-fg">{live.lastEvent ? formatRelative(live.lastEvent.timestamp, locale, feed.now) : a.noActivity}</dd>
                      </div>
                      <div>
                        <dt className="text-fg-subtle">{a.taskCount}</dt>
                        <dd className="mt-0.5 font-mono text-fg">{live.taskCount}</dd>
                      </div>
                    </dl>
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => setOpen(agent.id)} iconRight={<ArrowRight className="size-4" />}>
                      {a.profile}
                    </Button>
                  </article>
                </Reveal>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="feed-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader title={<span id="feed-heading">{a.feedTitle}</span>} lead={a.feedLead} />
            <label className="text-sm text-fg-muted">
              {a.filterLabel}
              <select value={filter} onChange={(e) => setFilter(e.target.value as AgentId | 'all')} className="mt-1 block h-9 rounded-lg border border-line-strong bg-surface px-2 text-fg">
                <option value="all">{a.filterAll}</option>
                {agents.data?.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="panel mt-6 p-3">
            <div className="flex items-center gap-2 border-b border-line px-2 pb-3 text-xs text-fg-subtle">
              <Badge tone="demo">{m.common.simulation}</Badge>
              {feed.runIndex > 0 && <span className="font-mono">{a.run(feed.runIndex)}</span>}
            </div>
            <div aria-live="polite" aria-relevant="additions">
              <EventFeed events={filteredEvents} limit={15} className="mt-2" />
            </div>
          </div>
        </section>
      </div>
      <NextStep kind="agents" primaryTo={'/lab'} secondaryTo={'/methodology'} className="pt-0" />

      <Dialog open={!!selected} onClose={() => setOpen(null)} variant="drawer" title={selected?.name ?? ''} accent={selected ? AGENT_COLOR[selected.id] : undefined}>
        {selected && (
          <AgentPanel
            agent={selected}
            status={feed.agents[selected.id].status}
            lastEvent={feed.agents[selected.id].lastEvent}
            taskCount={feed.agents[selected.id].taskCount}
            events={feed.events}
            now={feed.now}
            showLabLink
          />
        )}
      </Dialog>
    </>
  );
}
