import type { PublicationStatus, Source } from '@/types/domain';
import { createDedupeIndex, findDuplicate, registerInIndex } from './dedupe';
import { normalizeRecord } from './normalize';
import { transition } from './publication';
import { assessQuality } from './quality';
import type { PipelineInput, PipelineRun, PlannedEvent, RecordOutcome } from './types';
import { isSourceAllowed, validateRecord } from './validate';

/**
 * Orquestrador do pipeline. Função PURA e determinística: dado o mesmo
 * input, produz os mesmos eventos e resultados. Não faz rede nem I/O — a
 * coleta já chega pronta em `input.collected`.
 *
 * Os resultados (aprovado, rejeitado, duplicado) decorrem das regras de
 * validação e qualidade aplicadas aos dados — nunca de sorteio.
 */
export function runPipeline(input: PipelineInput): PipelineRun {
  const { runId, environmentMode: env, now, sources } = input;
  const events: PlannedEvent[] = [];
  const outcomes: RecordOutcome[] = [];
  const index = createDedupeIndex(input.existingKeys, input.existingFingerprints);
  const sourceById = new Map<string, Source>(sources.map((s) => [s.id, s]));

  for (const source of sources) {
    // 1. Descoberta: só fontes permitidas são consultadas.
    if (!isSourceAllowed(source, env)) continue;

    // 2. Coleta
    if (input.failedSources?.has(source.id)) {
      events.push({
        agentId: 'scout',
        type: 'agent.error',
        summary: `Falha ao consultar ${source.name}: tempo de resposta esgotado. A fonte será tentada na próxima execução.`,
        entityType: 'source',
        entityId: source.id,
        entityLabel: source.name,
        sourceUrl: source.url,
        result: 'failure',
        meta: { reason: 'timeout' },
      });
      continue;
    }

    const raws = input.collected.get(source.id) ?? [];
    events.push({
      agentId: 'scout',
      type: 'source.checked',
      summary: `${source.name} consultada: ${raws.length} registro(s) encontrado(s).`,
      entityType: 'source',
      entityId: source.id,
      entityLabel: source.name,
      sourceUrl: source.url,
      result: 'success',
      meta: { count: raws.length },
    });

    for (const raw of raws) {
      let history: PublicationStatus[] = transition([], 'found');
      // 3. Normalização
      const record = normalizeRecord(raw);
      events.push({
        agentId: 'scout',
        type: 'opportunity.discovered',
        summary: `Oportunidade encontrada: ${record.title}.`,
        entityType: 'course',
        entityId: record.key,
        entityLabel: record.title,
        sourceUrl: record.url,
        result: 'info',
        recordStatus: 'found',
      });

      // 4. Deduplicação
      const duplicate = findDuplicate(record, index);
      if (duplicate) {
        history = transition(history, 'removed');
        events.push({
          agentId: 'verifier',
          type: 'record.duplicate',
          summary: `Registro duplicado descartado (${duplicate.reason}): ${record.title}.`,
          entityType: 'course',
          entityId: record.key,
          entityLabel: record.title,
          sourceUrl: record.url,
          result: 'warning',
          recordStatus: 'removed',
          meta: { reason: duplicate.reason },
        });
        outcomes.push({ record, status: 'removed', duplicateOf: duplicate, history });
        continue;
      }
      registerInIndex(record, index);

      events.push({
        agentId: 'scout',
        type: 'record.normalized',
        summary: `Dados normalizados${record.notes.length ? ` com ${record.notes.length} aviso(s)` : ''}: ${record.title}.`,
        entityType: 'course',
        entityId: record.key,
        entityLabel: record.title,
        result: record.notes.length ? 'warning' : 'success',
        recordStatus: 'found',
        meta: { notes: record.notes.length },
      });

      // 5. Validação
      history = transition(history, 'validating');
      events.push({
        agentId: 'verifier',
        type: 'validation.started',
        summary: `Validação iniciada: ${record.title}.`,
        entityType: 'course',
        entityId: record.key,
        entityLabel: record.title,
        result: 'info',
        recordStatus: 'validating',
      });
      const validation = validateRecord(record, { source: sourceById.get(record.sourceId), env, now });

      // 6. Qualidade
      const quality = assessQuality(record, validation);
      events.push({
        agentId: 'verifier',
        type: 'quality.scored',
        summary: `Nota de qualidade ${quality.score}/100: ${record.title}.`,
        entityType: 'course',
        entityId: record.key,
        entityLabel: record.title,
        result: quality.meetsPublicationCriteria ? 'success' : 'warning',
        recordStatus: 'validating',
        meta: { score: quality.score },
      });

      if (!quality.meetsPublicationCriteria) {
        history = transition(history, 'rejected');
        const reasons = validation.failedBlocking.length ? validation.failedBlocking.join(', ') : 'nota abaixo do mínimo';
        events.push({
          agentId: 'verifier',
          type: 'validation.failed',
          summary: `Reprovado na validação (${reasons}): ${record.title}.`,
          entityType: 'course',
          entityId: record.key,
          entityLabel: record.title,
          sourceUrl: record.url,
          result: 'failure',
          recordStatus: 'rejected',
          meta: { checks: validation.failedBlocking.join(','), score: quality.score },
        });
        outcomes.push({ record, status: 'rejected', validation, quality, history });
        continue;
      }

      history = transition(history, 'approved');
      events.push({
        agentId: 'verifier',
        type: 'validation.passed',
        summary: `Aprovado: ${record.title}.`,
        entityType: 'course',
        entityId: record.key,
        entityLabel: record.title,
        result: 'success',
        recordStatus: 'approved',
        meta: { score: quality.score },
      });

      // Atlas relaciona o registro às competências antes da publicação.
      if (record.skills.length > 0) {
        events.push({
          agentId: 'atlas',
          type: 'graph.linked',
          summary: `${record.skills.length} competência(s) relacionada(s) a ${record.title}.`,
          entityType: 'course',
          entityId: record.key,
          entityLabel: record.title,
          result: 'success',
          recordStatus: 'approved',
          meta: { count: record.skills.length, skills: record.skills.join(',') },
        });
      }

      // 7. Publicação
      history = transition(history, 'published');
      events.push({
        agentId: 'verifier',
        type: 'record.published',
        summary: `Publicado no catálogo de demonstração: ${record.title}.`,
        entityType: 'course',
        entityId: record.key,
        entityLabel: record.title,
        sourceUrl: record.url,
        result: 'success',
        recordStatus: 'published',
      });
      outcomes.push({ record, status: 'published', validation, quality, history });
    }
  }

  return { runId, environmentMode: env, events, outcomes };
}
