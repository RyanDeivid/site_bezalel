import type {
  AgentEventType,
  AgentId,
  CategoryId,
  CertificateType,
  Duration,
  EntityType,
  EnvironmentMode,
  EventResult,
  ISODateString,
  Level,
  PriceType,
  PublicationStatus,
  Source,
} from '@/types/domain';

/**
 * Registro bruto, como chega da etapa de coleta. Todos os campos textuais
 * são NÃO CONFIÁVEIS até passarem por normalização e validação.
 */
export interface RawRecord {
  /** Identificador estável na fonte, quando a fonte fornece um. */
  externalId?: string;
  sourceId: string;
  url: string;
  title: string;
  provider: string;
  description?: string;
  categoryHint?: string;
  levelText?: string;
  priceText?: string;
  durationText?: string;
  certificateText?: string;
  skills?: string[];
  language?: string;
  collectedAt: ISODateString;
  /** Última atualização declarada pela própria fonte. */
  updatedAtSource?: ISODateString;
}

export interface NormalizedRecord {
  /** URL normalizada — chave primária de deduplicação. */
  key: string;
  /** provedor|título normalizados — chave secundária de deduplicação. */
  fingerprint: string;
  externalId?: string;
  sourceId: string;
  url: string;
  slug: string;
  title: string;
  provider: string;
  description: string;
  category: CategoryId | null;
  level: Level;
  priceType: PriceType;
  priceAmount?: number;
  currency?: string;
  duration?: Duration;
  certificateType?: CertificateType;
  skills: string[];
  languages: string[];
  collectedAt: ISODateString;
  updatedAtSource?: ISODateString;
  /** Avisos produzidos durante a normalização (ex.: preço não reconhecido). */
  notes: string[];
}

export type ValidationCheckId =
  | 'has-title'
  | 'has-provider'
  | 'https-url'
  | 'trusted-source'
  | 'known-category'
  | 'price-declared'
  | 'description-length'
  | 'fresh'
  | 'safe-content';

export interface ValidationCheck {
  id: ValidationCheckId;
  passed: boolean;
  /** `blocking` reprova o registro; `warning` só reduz a nota de qualidade. */
  severity: 'blocking' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  failedBlocking: ValidationCheckId[];
  warnings: ValidationCheckId[];
}

export interface QualityAssessment {
  /** 0–100. */
  score: number;
  /** Critérios de completude atendidos. */
  completeness: Array<'duration' | 'certificate' | 'skills' | 'description' | 'level'>;
  meetsPublicationCriteria: boolean;
}

export type DuplicateReason = 'url' | 'external-id' | 'fingerprint';

/** Evento planejado por uma execução do pipeline, antes de receber id/horário. */
export interface PlannedEvent {
  agentId: AgentId;
  type: AgentEventType;
  summary: string;
  entityType: EntityType;
  entityId: string;
  entityLabel?: string;
  sourceUrl?: string;
  result: EventResult;
  recordStatus?: PublicationStatus;
  meta?: Record<string, string | number>;
}

export interface RecordOutcome {
  record: NormalizedRecord;
  status: PublicationStatus;
  validation?: ValidationResult;
  quality?: QualityAssessment;
  duplicateOf?: { key: string; reason: DuplicateReason };
  /** Histórico de estados percorridos, em ordem. */
  history: PublicationStatus[];
}

export interface PipelineRun {
  runId: string;
  environmentMode: EnvironmentMode;
  events: PlannedEvent[];
  outcomes: RecordOutcome[];
}

export interface PipelineInput {
  runId: string;
  environmentMode: EnvironmentMode;
  now: Date;
  sources: Source[];
  /** Registros coletados, agrupados por fonte. */
  collected: Map<string, RawRecord[]>;
  /** Fontes que falharam na coleta nesta execução (ex.: timeout). */
  failedSources?: Set<string>;
  /** Chaves já conhecidas no catálogo (para deduplicação contra o existente). */
  existingKeys?: Set<string>;
  existingFingerprints?: Set<string>;
}
