import { buildDemoRawRecords, demoSources } from '@/data/demo/pipeline-fixtures';
import { runPipeline, type PipelineRun, type RecordOutcome } from '@/domain/pipeline';
import type { Course, VerificationStatus } from '@/types/domain';

/**
 * Registro de demonstração: é a SAÍDA do pipeline real (normalização,
 * deduplicação, validação e qualidade) aplicado às fixtures fictícias.
 * Nada aqui é escrito à mão como "aprovado" — os estados decorrem das regras.
 */

export function runDemoPipeline(now: Date, runId = 'demo-run-0', failedSources?: Set<string>): PipelineRun {
  return runPipeline({
    runId,
    environmentMode: 'demo',
    now,
    sources: demoSources,
    collected: buildDemoRawRecords(now),
    failedSources,
  });
}

const VERIFICATION_BY_STATUS: Record<RecordOutcome['status'], VerificationStatus> = {
  found: 'unverified',
  validating: 'unverified',
  approved: 'unverified',
  published: 'unverified',
  rejected: 'failed',
  outdated: 'outdated',
  removed: 'unverified',
};

export function outcomeToCourse(outcome: RecordOutcome, now: Date): Course {
  const r = outcome.record;
  const iso = now.toISOString().slice(0, 10);
  return {
    id: `demo-${r.slug}`,
    slug: `demo-${r.slug}`,
    title: r.title,
    description: r.description || 'Registro fictício de demonstração.',
    provider: { name: r.provider },
    category: r.category ?? 'computer-science',
    skills: r.skills,
    type: 'course',
    level: r.level,
    levelSource: r.level === 'unknown' ? undefined : 'stated',
    priceType: r.priceType,
    priceAmount: r.priceAmount,
    currency: r.currency,
    duration: r.duration,
    certificateType: r.certificateType,
    topics: [],
    languages: r.languages,
    modality: 'online',
    sourceUrl: r.url,
    sourceName: `${r.provider} — fonte fictícia`,
    lastCheckedAt: (r.updatedAtSource ?? r.collectedAt).slice(0, 10),
    verificationStatus: VERIFICATION_BY_STATUS[outcome.status],
    verificationNote:
      'Registro FICTÍCIO gerado pela simulação do pipeline. Não corresponde a um curso real e não foi conferido em nenhuma fonte.',
    publicationStatus: outcome.status,
    origin: 'demo',
    createdAt: iso,
    updatedAt: iso,
  };
}

/** Todos os registros de demonstração, em qualquer estado (para metodologia e laboratório). */
export function buildDemoRegistry(now: Date): { run: PipelineRun; courses: Course[] } {
  const run = runDemoPipeline(now);
  return { run, courses: run.outcomes.map((o) => outcomeToCourse(o, now)) };
}
