import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import type { OpsMetrics } from '@/domain/operations';
import type { Messages } from '@/i18n';
import type { AgentEvent, AgentId, AgentStatus } from '@/types/domain';
import type { HubContent, ScreenContent } from './scene/textures';

const STATUS_COLOR: Record<AgentStatus, string> = {
  active: '#5cc8a1',
  idle: '#a9b1bd',
  failed: '#e57465',
  offline: '#7d8899',
};

interface ScreenInput {
  events: AgentEvent[];
  metrics: OpsMetrics;
  statuses: Record<AgentId, { status: AgentStatus; lastEvent?: AgentEvent }>;
  topSkills: Array<{ label: string; count: number }>;
  names: Record<AgentId, string>;
  m: Messages;
}

/** Conteúdo das telas das estações 3D, derivado da trilha de eventos e do catálogo. */
export function buildScreens({ events, metrics, statuses, topSkills, names, m }: ScreenInput): Record<AgentId, ScreenContent> {
  const last = (agent: AgentId, type?: AgentEvent['type'], n = 1) =>
    [...events].reverse().filter((e) => e.agentId === agent && (!type || e.type === type)).slice(0, n);
  const o = m.lab.ops.metrics;
  const sc = m.lab.screen;
  const base = (id: AgentId) => ({
    title: names[id],
    subtitle: m.lab.stations[id].subtitle,
    status: m.enums.agentStatus[statuses[id].status],
    statusColor: STATUS_COLOR[statuses[id].status],
    color: AGENT_HEX[id],
    footer: m.lab.simulationBadge,
  });
  const graph = last('atlas', 'graph.linked', 6).find((e) => e.entityLabel === 'skill-graph');

  return {
    scout: {
      ...base('scout'),
      lines: [
        { label: o.sourcesChecked, value: String(metrics.sourcesChecked) },
        { label: o.discovered, value: String(metrics.discovered) },
        { label: sc.failedSources, value: String(metrics.sourcesFailed) },
        ...last('scout', 'opportunity.discovered', 2).map((e) => ({ label: `› ${e.entityLabel ?? ''}` })),
      ],
    },
    verifier: {
      ...base('verifier'),
      lines: [
        { label: o.validating, value: String(metrics.validating) },
        { label: o.approved, value: String(metrics.approved) },
        { label: o.rejected, value: String(metrics.rejected) },
        { label: sc.duplicates, value: String(metrics.duplicates) },
        ...last('verifier', undefined, 1).map((e) => ({ label: `› ${m.events.types[e.type]}: ${e.entityLabel ?? ''}` })),
      ],
    },
    atlas: {
      ...base('atlas'),
      lines: [
        { label: sc.links, value: graph ? String(graph.meta?.count ?? '—') : '—' },
        ...last('atlas', 'graph.linked', 3)
          .filter((e) => e.entityLabel !== 'skill-graph')
          .map((e) => ({ label: `› ${e.entityLabel ?? ''}`, value: String(e.meta?.count ?? '') })),
      ],
    },
    trend: {
      ...base('trend'),
      lines: topSkills.slice(0, 4).map((s) => ({ label: s.label, value: String(s.count) })),
    },
    sol: {
      ...base('sol'),
      lines: last('sol', 'assistant.query', 4).map((e) => ({ label: `“${e.entityLabel ?? ''}”`, value: String(e.meta?.count ?? 0) })),
    },
  };
}

export function buildHub(metrics: OpsMetrics, m: Messages): HubContent {
  const o = m.lab.ops.metrics;
  return {
    title: m.lab.ops.title,
    metrics: [
      { label: o.activeAgents, value: metrics.activeAgents },
      { label: o.sourcesChecked, value: metrics.sourcesChecked },
      { label: o.discovered, value: metrics.discovered },
      { label: o.validating, value: metrics.validating },
      { label: o.approved, value: metrics.approved },
      { label: o.rejected, value: metrics.rejected },
    ],
    footer: m.lab.simulationBadge,
  };
}
