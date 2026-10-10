import { FlaskConical } from 'lucide-react';
import { useT } from '@/app/preferences-context';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import type { AgentStatus, EnvironmentMode } from '@/types/domain';

const TONE: Record<AgentStatus, BadgeTone> = {
  active: 'ok',
  idle: 'neutral',
  failed: 'danger',
  offline: 'neutral',
};

/** Estado operacional + modo do ambiente: nunca mostra um agente simulado como produção. */
export function AgentStatusBadges({ status, mode }: { status: AgentStatus; mode: EnvironmentMode }) {
  const m = useT();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Tooltip content={m.agentsPage.legend[status === 'offline' ? 'idle' : status]}>
        <Badge tone={TONE[status]} pulse={status === 'active'}>
          {m.enums.agentStatus[status]}
        </Badge>
      </Tooltip>
      {mode === 'demo' && (
        <Tooltip content={m.agentsPage.legend.demo}>
          <Badge tone="demo" icon={<FlaskConical />}>
            {m.common.demo}
          </Badge>
        </Tooltip>
      )}
    </span>
  );
}
