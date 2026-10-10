import type { AgentEvent, AgentId, AgentStatus, PublicationStatus } from '@/types/domain';

/**
 * Métricas da Central de Operações e estado dos agentes, derivados
 * exclusivamente da trilha de eventos. A mesma função serve para eventos
 * simulados (demo) ou reais (produção).
 */

export interface OpsMetrics {
  activeAgents: number;
  sourcesChecked: number;
  sourcesFailed: number;
  discovered: number;
  validating: number;
  approved: number;
  published: number;
  rejected: number;
  duplicates: number;
  completedUpdates: number;
  lastEventAt: string | null;
  recordStatuses: Record<string, PublicationStatus>;
}

/** Janela em que um agente com evento recente é considerado ativo. */
export const ACTIVE_WINDOW_MS = 9_000;
/** Por quanto tempo uma falha mantém o agente no estado "com falha". */
export const FAILURE_WINDOW_MS = 25_000;

export const AGENT_IDS: AgentId[] = ['scout', 'verifier', 'atlas', 'trend', 'sol'];

export function deriveAgentStatuses(events: AgentEvent[], now: Date): Record<AgentId, { status: AgentStatus; lastEvent?: AgentEvent; taskCount: number }> {
  const result = Object.fromEntries(AGENT_IDS.map((id) => [id, { status: 'idle' as AgentStatus, taskCount: 0 }])) as Record<
    AgentId,
    { status: AgentStatus; lastEvent?: AgentEvent; taskCount: number }
  >;
  for (const e of events) {
    const entry = result[e.agentId];
    entry.taskCount += 1;
    if (!entry.lastEvent || e.timestamp > entry.lastEvent.timestamp) entry.lastEvent = e;
  }
  for (const id of AGENT_IDS) {
    const entry = result[id];
    const last = entry.lastEvent;
    if (!last) continue;
    const age = now.getTime() - Date.parse(last.timestamp);
    const lastFailure = [...events].reverse().find((e) => e.agentId === id && e.type === 'agent.error');
    const failureAge = lastFailure ? now.getTime() - Date.parse(lastFailure.timestamp) : Number.POSITIVE_INFINITY;
    // Uma falha recente prevalece até que o agente conclua uma tarefa com sucesso depois dela.
    const recoveredAfterFailure = lastFailure ? last.timestamp > lastFailure.timestamp && last.result === 'success' : true;
    if (failureAge <= FAILURE_WINDOW_MS && !recoveredAfterFailure) entry.status = 'failed';
    else if (age <= ACTIVE_WINDOW_MS) entry.status = 'active';
    else entry.status = 'idle';
  }
  return result;
}

export function deriveOpsMetrics(events: AgentEvent[], now: Date): OpsMetrics {
  const statuses: Record<string, PublicationStatus> = {};
  const sourcesOk = new Set<string>();
  const sourcesFailed = new Set<string>();
  let discovered = 0;
  let approved = 0;
  let published = 0;
  let rejected = 0;
  let duplicates = 0;
  let lastEventAt: string | null = null;

  for (const e of events) {
    if (!lastEventAt || e.timestamp > lastEventAt) lastEventAt = e.timestamp;
    if (e.recordStatus && e.entityType === 'course') statuses[e.entityId] = e.recordStatus;
    switch (e.type) {
      case 'source.checked':
        sourcesOk.add(e.entityId);
        sourcesFailed.delete(e.entityId);
        break;
      case 'agent.error':
        if (e.entityType === 'source') sourcesFailed.add(e.entityId);
        break;
      case 'opportunity.discovered':
        discovered += 1;
        break;
      case 'validation.passed':
        approved += 1;
        break;
      case 'record.published':
        published += 1;
        break;
      case 'validation.failed':
        rejected += 1;
        break;
      case 'record.duplicate':
        duplicates += 1;
        break;
      default:
        break;
    }
  }

  const agentStatuses = deriveAgentStatuses(events, now);
  return {
    activeAgents: AGENT_IDS.filter((id) => agentStatuses[id].status === 'active').length,
    sourcesChecked: sourcesOk.size,
    sourcesFailed: sourcesFailed.size,
    discovered,
    validating: Object.values(statuses).filter((s) => s === 'validating').length,
    approved,
    published,
    rejected,
    duplicates,
    completedUpdates: published + rejected + duplicates,
    lastEventAt,
    recordStatuses: statuses,
  };
}
