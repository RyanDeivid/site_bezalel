import { Activity } from 'lucide-react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { AGENT_COLOR, AgentGlyph } from '@/components/agents/AgentGlyph';
import { Badge } from '@/components/ui/Badge';
import { describeEvent } from '@/features/agents/describe-event';
import { useEventFeed } from '@/hooks/useEventFeed';

/**
 * Faixa com o último evento da Central de Operações. Na v1 os eventos vêm
 * da simulação local e a faixa diz isso explicitamente.
 */
export function LabSignal() {
  const { m, locale } = usePreferences();
  const { events, environmentMode } = useEventFeed({ clockMs: 0, startWhenIdle: true });
  const last = events.at(-1);

  return (
    <div className="border-t border-line bg-bg/90">
      <div className="container-page flex h-14 items-center gap-3 text-sm">
        <span className="hidden items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle sm:flex">
          <Activity aria-hidden className="size-3.5 text-accent-text" />
          {m.home.hero.tickerLabel}
        </span>
        {environmentMode === 'demo' && <Badge tone="demo">{m.home.hero.tickerDemo}</Badge>}
        <Link to="/lab" className="group flex min-w-0 flex-1 items-center gap-2" aria-live="off">
          {last ? (
            <span key={last.id} className="page-enter flex min-w-0 items-center gap-2">
              <span className="shrink-0" style={{ color: AGENT_COLOR[last.agentId] }}>
                <AgentGlyph agent={last.agentId} className="size-4" />
              </span>
              <span className="truncate text-fg-muted group-hover:text-fg">{describeEvent(last, m, locale)}</span>
            </span>
          ) : (
            <span className="text-fg-subtle">{m.common.loading}</span>
          )}
        </Link>
      </div>
    </div>
  );
}
