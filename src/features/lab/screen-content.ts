import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import type { OpsMetrics } from '@/domain/operations';
import type { FreshnessReport } from '@/domain/pipeline/freshness';
import type { Messages } from '@/i18n';
import type { AgentEvent, AgentId, AgentStatus, Locale } from '@/types/domain';
import { describeEvent } from '../agents/describe-event';
import { STATION_ORDER } from './layout';
import type { HubContent, LogContent, MetricContent, ScreenContent } from './scene/textures';
import { formatTime } from '@/lib/format';

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
  /** Prazos de reconferência do catálogo verificado (tela do Vigia). */
  freshness: FreshnessReport;
  m: Messages;
}

/** Conteúdo das telas das estações 3D, derivado da trilha de eventos e do catálogo. */
export function buildScreens({ events, metrics, statuses, topSkills, names, freshness, m }: ScreenInput): Record<AgentId, ScreenContent> {
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
    vigia: {
      ...base('vigia'),
      lines: [
        { label: sc.overdue, value: String(freshness.overdue.length) },
        { label: sc.dueSoon, value: String(freshness.dueSoon.length) },
        { label: m.lab.stations.vigia.oldest, value: m.lab.stations.vigia.days(freshness.oldestAge) },
        { label: sc.returned, value: String(events.filter((e) => e.agentId === 'vigia' && e.type === 'record.outdated').length) },
        ...last('vigia', 'record.outdated', 1).map((e) => ({ label: `› ${e.entityLabel ?? ''}` })),
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

const TONE: Record<AgentEvent['result'], LogContent['lines'][number]['tone']> = { success: 'ok', warning: 'warn', failure: 'danger', info: 'info' };

/**
 * Monitores laterais de cada setor: à esquerda, os últimos eventos do agente
 * (como um terminal); à direita, o indicador principal dele.
 */
export function buildSideScreens({
  events,
  metrics,
  topSkills,
  freshness,
  m,
  locale,
}: Omit<ScreenInput, 'statuses' | 'names'> & { locale: Locale }): Record<AgentId, { log: LogContent; metric: MetricContent }> {
  const sc = m.lab.screen;
  const mt = sc.metric;
  // Formatador reaproveitado: toLocaleTimeString com opções cria um Intl novo a
  // cada chamada — com centenas de eventos, era a maior parte da carga do /lab.
  const time = (iso: string) => formatTime(iso, locale);
  const graph = [...events].reverse().find((e) => e.type === 'graph.linked' && e.entityLabel === 'skill-graph');
  const metric: Record<AgentId, Omit<MetricContent, 'color' | 'footer'>> = {
    scout: { label: mt.scout.label, value: String(metrics.discovered), detail: mt.scout.detail(metrics.sourcesChecked) },
    verifier: { label: mt.verifier.label, value: String(metrics.published), detail: mt.verifier.detail(metrics.approved, metrics.rejected) },
    vigia: { label: mt.vigia.label, value: String(freshness.dueSoon.length), detail: mt.vigia.detail(freshness.overdue.length, freshness.oldestAge) },
    atlas: { label: mt.atlas.label, value: graph ? String(graph.meta?.count ?? '—') : '—', detail: mt.atlas.detail },
    trend: { label: mt.trend.label, value: String(topSkills[0]?.count ?? '—'), detail: mt.trend.detail(topSkills[0]?.label ?? '—') },
    sol: { label: mt.sol.label, value: String(events.filter((e) => e.type === 'assistant.query').length), detail: mt.sol.detail },
  };
  return Object.fromEntries(
    STATION_ORDER.map((id) => {
      const mine = events.filter((e) => e.agentId === id).slice(-5).reverse();
      return [
        id,
        {
          log: {
            title: sc.log,
            color: AGENT_HEX[id],
            empty: sc.logEmpty,
            footer: m.lab.simulationBadge,
            lines: mine.map((e) => ({ time: time(e.timestamp), text: describeEvent(e, m, locale), tone: TONE[e.result] })),
          },
          metric: { ...metric[id], color: AGENT_HEX[id], footer: m.lab.simulationBadge },
        },
      ];
    }),
  ) as Record<AgentId, { log: LogContent; metric: MetricContent }>;
}
