import { demoAssistantQueries } from '@/data/demo/mentions';
import { isFresh, MAX_RECORD_AGE_DAYS, type FreshnessReport, type PlannedEvent } from '@/domain/pipeline';
import { runDemoPipeline } from '../catalog/demo-registry';

/**
 * Roteiro de uma execução demonstrativa. Combina:
 *  - os eventos do pipeline real aplicado às fixtures fictícias;
 *  - consultas de exemplo do Sol, com contagem calculada pela busca real
 *    sobre o catálogo verificado;
 *  - análises do Trend e do Atlas calculadas sobre o catálogo verificado;
 *  - a ronda do Vigia: prazos de reconferência calculados com as datas reais
 *    do catálogo verificado e um registro fictício antigo marcado como
 *    desatualizado (e devolvido ao Verifier).
 *
 * Determinístico: a execução N sempre produz os mesmos eventos. A única
 * variação entre execuções é programada (falha simulada da fonte Meridiano
 * nas execuções ímpares), para que a interface mostre o estado "com falha".
 */

export interface ScenarioDeps {
  /** Quantidade de resultados do catálogo verificado para uma consulta. */
  countResults: (query: string) => number;
  /** Competências mais frequentes no catálogo verificado. */
  topSkills: Array<{ skillId: string; label: string; count: number }>;
  /** Total de relações competência→curso no catálogo verificado. */
  skillLinks: number;
  /** Prazos de reconferência do catálogo verificado (datas reais). */
  freshness: FreshnessReport;
}

export function buildDemoScenario(runIndex: number, now: Date, deps: ScenarioDeps): { runId: string; events: PlannedEvent[] } {
  const runId = `demo-run-${runIndex}`;
  const failed = runIndex % 2 === 1 ? new Set(['demo-src-meridiano']) : undefined;
  const run = runDemoPipeline(now, runId, failed);
  const events: PlannedEvent[] = [];

  run.events.forEach((event, i) => {
    events.push(event);
    if (i > 0 && i % 7 === 0) {
      const q = demoAssistantQueries[(runIndex + i / 7) % demoAssistantQueries.length] ?? demoAssistantQueries[0] ?? '';
      const count = deps.countResults(q);
      events.push({
        agentId: 'sol',
        type: 'assistant.query',
        summary: `Consulta demonstrativa “${q}”: ${count} resultado(s) no catálogo verificado.`,
        entityType: 'query',
        entityId: `q-${runIndex}-${i}`,
        entityLabel: q,
        result: count > 0 ? 'success' : 'info',
        meta: { query: q, count },
      });
    }
  });

  // Ronda do Vigia sobre o catálogo verificado (idade real de cada conferência).
  const f = deps.freshness;
  events.push({
    agentId: 'vigia',
    type: 'freshness.checked',
    summary: `Ronda de reconferência: ${f.total} registro(s) do catálogo verificado; ${f.overdue.length} vencido(s) e ${f.dueSoon.length} chegando a ${f.maxAgeDays} dias nos próximos ${f.windowDays}.`,
    entityType: 'course',
    entityId: 'catalog-freshness',
    entityLabel: 'catalog',
    result: f.overdue.length ? 'warning' : 'success',
    meta: { count: f.total, overdue: f.overdue.length, due: f.dueSoon.length, days: f.maxAgeDays, window: f.windowDays, oldest: f.oldestAge },
  });

  // Reconferência de um registro fictício antigo (regra de atualidade real).
  const staleCheckedAt = new Date(now.getTime() - (MAX_RECORD_AGE_DAYS + 25) * 86_400_000).toISOString();
  if (!isFresh(staleCheckedAt, now)) {
    events.push({
      agentId: 'vigia',
      type: 'record.outdated',
      summary: `Reconferência: “Introdução à Computação em Nuvem (fictício)” sem confirmação há mais de ${MAX_RECORD_AGE_DAYS} dias — marcado como desatualizado e devolvido ao Verifier.`,
      entityType: 'course',
      entityId: 'demo-cloud-intro',
      entityLabel: 'Introdução à Computação em Nuvem (fictício)',
      result: 'warning',
      recordStatus: 'outdated',
      meta: { days: MAX_RECORD_AGE_DAYS },
    });
  }

  events.push({
    agentId: 'atlas',
    type: 'graph.linked',
    summary: `Mapa de competências recalculado: ${deps.skillLinks} relações competência→curso no catálogo verificado.`,
    entityType: 'skill',
    entityId: 'skill-graph',
    entityLabel: 'skill-graph',
    result: 'success',
    meta: { count: deps.skillLinks },
  });

  const top = deps.topSkills[runIndex % Math.max(1, deps.topSkills.length)];
  if (top) {
    events.push({
      agentId: 'trend',
      type: 'trend.analyzed',
      summary: `Análise do catálogo verificado: “${top.label}” aparece em ${top.count} curso(s). Contagem de cursos — não indica demanda de mercado.`,
      entityType: 'skill',
      entityId: top.skillId,
      entityLabel: top.label,
      result: 'info',
      meta: { count: top.count },
    });
  }

  return { runId, events };
}
