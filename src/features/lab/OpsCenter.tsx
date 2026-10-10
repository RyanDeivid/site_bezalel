import { Pause, Play } from 'lucide-react';
import { usePreferences } from '@/app/preferences-context';
import { AGENT_COLOR, AgentGlyph } from '@/components/agents/AgentGlyph';
import { EventFeed } from '@/components/agents/EventFeed';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { OpsMetrics } from '@/domain/operations';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { FeedConnection } from '@/services/types';
import type { Agent, AgentEvent, AgentId, AgentStatus } from '@/types/domain';

interface OpsCenterProps {
  metrics: OpsMetrics;
  events: AgentEvent[];
  agents: Agent[];
  statuses: Record<AgentId, { status: AgentStatus }>;
  connection: FeedConnection;
  runIndex: number;
  environmentMode: 'demo' | 'production';
  onPause: () => void;
  onResume: () => void;
  onSelectAgent: (id: AgentId) => void;
  className?: string;
}

/** Central de Operações: métricas, estado dos agentes e feed de eventos ao vivo. */
export function OpsCenter({ metrics, events, agents, statuses, connection, runIndex, environmentMode, onPause, onResume, onSelectAgent, className }: OpsCenterProps) {
  const { m, locale } = usePreferences();
  const o = m.lab.ops;
  const tiles: Array<[string, number, string?]> = [
    [o.metrics.activeAgents, metrics.activeAgents, 'text-ok'],
    [o.metrics.sourcesChecked, metrics.sourcesChecked],
    [o.metrics.discovered, metrics.discovered],
    [o.metrics.validating, metrics.validating, 'text-warn'],
    [o.metrics.approved, metrics.approved, 'text-accent-text'],
    [o.metrics.rejected, metrics.rejected, 'text-danger'],
    [o.metrics.completed, metrics.completedUpdates],
  ];
  const paused = connection === 'paused';

  return (
    <section aria-label={o.title} className={cn('flex flex-col gap-4 text-sm', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{o.title}</h2>
        <div className="flex items-center gap-2">
          {environmentMode === 'demo' && <Badge tone="demo">{m.lab.simulationBadge}</Badge>}
          <Badge tone={paused ? 'warn' : 'ok'} pulse={!paused}>
            {paused ? o.paused : o.live}
          </Badge>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-2">
        {tiles.map(([label, value, tone], i) => (
          <div key={label} className={cn('rounded-lg border border-line bg-bg/40 px-3 py-2.5', i === tiles.length - 1 && 'col-span-2 sm:col-span-4 lg:col-span-2')}>
            <dt className="text-[0.72rem] leading-tight text-fg-subtle">{label}</dt>
            <dd className={cn('mt-1 font-mono text-xl', tone)}>{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-fg-subtle">{o.agentsState}</h3>
        <ul className="mt-2 grid grid-cols-1 gap-1">
          {agents.map((a) => {
            const st = statuses[a.id].status;
            return (
              <li key={a.id}>
                <button type="button" onClick={() => onSelectAgent(a.id)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2">
                  <span style={{ color: AGENT_COLOR[a.id] }}>
                    <AgentGlyph agent={a.id} className="size-4" />
                  </span>
                  <span className="flex-1">{a.name}</span>
                  <span className={cn('inline-flex items-center gap-1.5 text-xs', st === 'active' ? 'text-ok' : st === 'failed' ? 'text-danger' : 'text-fg-subtle')}>
                    <span aria-hidden className={cn('size-1.5 rounded-full bg-current', st === 'active' && 'status-pulse')} />
                    {m.enums.agentStatus[st]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="min-h-0 flex-1">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-fg-subtle">{o.feed}</h3>
        <div aria-live="polite" aria-relevant="additions" className="mt-2">
          <EventFeed events={events} limit={7} compact />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-fg-subtle">
        <span className="font-mono">
          {o.lastUpdate}: {metrics.lastEventAt ? formatTime(metrics.lastEventAt, locale) : '—'}
          {runIndex > 0 && ` · ${o.run} #${runIndex}`}
        </span>
        <Button variant="secondary" size="sm" onClick={paused ? onResume : onPause} iconLeft={paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}>
          {paused ? o.resumeSim : o.pauseSim}
        </Button>
        <p className="w-full">{o.sessionNote}</p>
      </footer>
    </section>
  );
}
