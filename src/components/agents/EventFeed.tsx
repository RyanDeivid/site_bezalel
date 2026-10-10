import { CircleAlert, CircleCheck, CircleX, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { describeEvent } from '@/features/agents/describe-event';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AgentEvent, EventResult } from '@/types/domain';
import { AGENT_COLOR, AgentGlyph } from './AgentGlyph';

const RESULT_ICON: Record<EventResult, ReactNode> = {
  success: <CircleCheck className="size-3.5 text-ok" />,
  failure: <CircleX className="size-3.5 text-danger" />,
  warning: <CircleAlert className="size-3.5 text-warn" />,
  info: <Info className="size-3.5 text-info" />,
};

/** Lista de eventos (mais recente primeiro) com agente, tipo, resultado e horário. */
export function EventFeed({ events, limit = 12, compact, className, emptyText }: { events: AgentEvent[]; limit?: number; compact?: boolean; className?: string; emptyText?: string }) {
  const { m, locale } = usePreferences();
  const list = [...events].reverse().slice(0, limit);
  if (!list.length) return <p className={cn('text-sm text-fg-subtle', className)}>{emptyText ?? m.lab.ops.empty}</p>;
  return (
    <ol className={cn('space-y-1', className)}>
      {list.map((e, i) => (
        <li
          key={e.id}
          className={cn('grid grid-cols-[auto_1fr] gap-3 rounded-lg px-2 py-2', i === 0 && 'page-enter bg-surface-2/60')}
        >
          <span className="mt-0.5 grid size-7 place-items-center rounded-lg border border-line bg-bg" style={{ color: AGENT_COLOR[e.agentId] }}>
            <AgentGlyph agent={e.agentId} className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.72rem] text-fg-subtle">
              <span className="font-mono">{formatTime(e.timestamp, locale)}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                {RESULT_ICON[e.result]}
                <span className="sr-only">{m.events.result[e.result]}</span>
                {m.events.types[e.type]}
              </span>
              {e.environmentMode === 'demo' && <span className="font-mono uppercase tracking-wider text-demo">demo</span>}
            </p>
            <p className={cn('mt-0.5 text-sm text-fg-muted', compact && 'line-clamp-2')}>{describeEvent(e, m, locale)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
