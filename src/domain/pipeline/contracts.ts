import type { AgentEvent, Course, Source } from '@/types/domain';
import type { NormalizedRecord, RawRecord } from './types';

/**
 * Contratos das etapas do pipeline de agentes.
 *
 * O frontend implementa apenas a simulação local (services/events). Agentes
 * reais devem rodar no BACKEND e implementar estas interfaces — o navegador
 * nunca coleta páginas de terceiros. Ver docs/AGENTS.md.
 */

/** 1. Descoberta de fontes: decide QUAIS fontes podem ser consultadas. */
export interface SourceDiscovery {
  /** Retorna apenas fontes com permissão explícita de coleta. */
  discover(): Promise<Source[]>;
}

/** 2. Coleta: obtém registros brutos de UMA fonte autorizada. */
export interface Collector {
  readonly sourceId: string;
  /**
   * Deve respeitar termos de uso, robots.txt, limites de requisição e
   * preferir APIs oficiais. Nunca executa conteúdo vindo da fonte.
   */
  collect(source: Source, options: { signal?: AbortSignal; since?: string }): Promise<RawRecord[]>;
}

/** 7. Publicação: persiste registros aprovados no catálogo. */
export interface Publisher {
  publish(record: NormalizedRecord): Promise<Course>;
  markOutdated(courseId: string, reason: string): Promise<void>;
  remove(courseId: string, reason: string): Promise<void>;
}

/** 8. Registro de eventos: trilha de auditoria de tudo que os agentes fazem. */
export interface EventLog {
  append(event: AgentEvent): Promise<void>;
}

/** 9. Monitoramento de erros. */
export interface ErrorMonitor {
  capture(error: unknown, context: { stage: PipelineStage; sourceId?: string; recordKey?: string }): void;
}

export type PipelineStage =
  | 'discovery'
  | 'collection'
  | 'normalization'
  | 'deduplication'
  | 'validation'
  | 'quality'
  | 'publication'
  | 'event-log'
  | 'monitoring';

/** Ordem canônica das etapas — usada na documentação e na interface. */
export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'discovery',
  'collection',
  'normalization',
  'deduplication',
  'validation',
  'quality',
  'publication',
  'event-log',
  'monitoring',
];
