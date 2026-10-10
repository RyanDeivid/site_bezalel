import { Box } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { ButtonLink } from '@/components/ui/Button';
import { formatRelative } from '@/lib/format';
import type { Agent, AgentEvent, AgentStatus } from '@/types/domain';
import { AGENT_COLOR, AgentGlyph } from './AgentGlyph';
import { AgentStatusBadges } from './AgentStatus';
import { EventFeed } from './EventFeed';

interface AgentPanelProps {
  agent: Agent;
  status: AgentStatus;
  lastEvent?: AgentEvent;
  taskCount: number;
  events: AgentEvent[];
  now: Date;
  /** Conteúdo específico da estação (laboratório). */
  station?: ReactNode;
  showLabLink?: boolean;
}

/** Perfil completo de um agente — usado no painel lateral de /agents e no laboratório. */
export function AgentPanel({ agent, status, lastEvent, taskCount, events, now, station, showLabLink }: AgentPanelProps) {
  const { m, locale } = usePreferences();
  const a = m.agentsPage;
  const own = events.filter((e) => e.agentId === agent.id);
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl border" style={{ color: AGENT_COLOR[agent.id], borderColor: AGENT_COLOR[agent.id] }}>
          <AgentGlyph agent={agent.id} className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-fg-muted">{agent.role[locale]}</p>
          <div className="mt-2">
            <AgentStatusBadges status={status} mode={agent.mode} />
          </div>
        </div>
      </div>
      <p className="leading-relaxed text-fg-muted">{agent.description[locale]}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-line p-3">
          <dt className="text-xs text-fg-subtle">{a.lastActivity}</dt>
          <dd className="mt-1 font-medium">{lastEvent ? formatRelative(lastEvent.timestamp, locale, now) : a.noActivity}</dd>
        </div>
        <div className="rounded-lg border border-line p-3">
          <dt className="text-xs text-fg-subtle">{a.taskCount}</dt>
          <dd className="mt-1 font-mono font-medium">{taskCount}</dd>
        </div>
      </dl>
      {station}
      {(
        [
          [a.tasks, agent.taskTypes],
          [a.sources, agent.dataSources],
          [a.limitations, agent.limitations],
        ] as const
      ).map(([title, items]) => (
        <section key={title}>
          <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-fg-subtle">{title}</h3>
          <ul className="mt-2.5 space-y-1.5">
            {items.map((it) => (
              <li key={it[locale]} className="flex items-start gap-2.5 text-sm text-fg-muted">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full" style={{ background: AGENT_COLOR[agent.id] }} />
                {it[locale]}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section>
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-fg-subtle">{a.recentEvents}</h3>
        <EventFeed events={own} limit={6} compact className="mt-2" emptyText={a.noEvents} />
      </section>
      {showLabLink && (
        <ButtonLink to="/lab" variant="secondary" iconLeft={<Box className="size-4" />}>
          {a.openInLab}
        </ButtonLink>
      )}
    </div>
  );
}
