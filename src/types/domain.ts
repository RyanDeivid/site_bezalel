/**
 * Bezalel — modelo de domínio.
 *
 * Este arquivo contém apenas tipos (sem código executável) para poder ser
 * importado tanto pela aplicação quanto pelos scripts de build em Node.
 * Documentação das entidades e relacionamentos: docs/DATA_MODEL.md.
 */

/** Data/hora em ISO 8601 (ex.: "2026-10-10T14:00:00.000Z" ou "2026-10-10"). */
export type ISODateString = string;

export type Locale = 'pt-BR' | 'en';

/** Texto disponível nos idiomas suportados pela interface. */
export type LocalizedText = Record<Locale, string>;

// ---------------------------------------------------------------------------
// Origem e confiabilidade dos dados
// ---------------------------------------------------------------------------

/**
 * De onde veio um registro. A interface sempre exibe essa origem.
 * - `curated`: registro real, conferido manualmente na fonte oficial.
 * - `demo`: registro fictício de demonstração (nunca apresentado como real).
 * - `production`: registro vindo do backend com agentes reais (futuro).
 */
export type DataOrigin = 'curated' | 'demo' | 'production';

/** Modo do ambiente que produziu um agente ou evento. */
export type EnvironmentMode = 'demo' | 'production';

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export type CategoryId =
  | 'computer-science'
  | 'ai-ml'
  | 'web-development'
  | 'data'
  | 'cloud-infra'
  | 'security-privacy'
  | 'digital-government';

export type OpportunityType = 'course' | 'certification' | 'learning-path';

export type Level = 'beginner' | 'intermediate' | 'advanced' | 'all-levels' | 'unknown';

/**
 * Condição de preço, sempre conforme a fonte.
 * - `free-with-paid-certificate`: conteúdo gratuito, certificado opcional pago.
 * - `varies`: preço depende de país/região (ex.: exames de certificação).
 */
export type PriceType = 'free' | 'free-with-paid-certificate' | 'paid' | 'varies' | 'unknown';

/** `online`: online, mas o ritmo (autoinstrucional ou com turmas) não foi declarado. */
export type Modality = 'online' | 'online-self-paced' | 'online-scheduled' | 'in-person' | 'hybrid' | 'unknown';

/** Se o nível foi declarado pela fonte ou inferido pela curadoria (ex.: pelos pré-requisitos). */
export type FieldSource = 'stated' | 'inferred';

/** Tipo de certificado — preenchido somente quando confirmado na fonte. */
export type CertificateType =
  | 'free-certificate'
  | 'paid-certificate'
  | 'free-and-paid-options'
  | 'digital-badge'
  | 'professional-certification'
  | 'none-stated';

/** Estado da verificação das informações de um registro. */
export type VerificationStatus = 'verified' | 'partially-verified' | 'unverified' | 'outdated' | 'failed';

/** Ciclo de vida de um registro no pipeline de publicação. */
export type PublicationStatus =
  | 'found'
  | 'validating'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'outdated'
  | 'removed';

export type DurationUnit = 'hours' | 'weeks' | 'lessons' | 'modules' | 'hours-per-week';

export interface Duration {
  value: number;
  unit: DurationUnit;
  /** Observação literal da fonte (ex.: "9 aulas de ~90 min"). */
  note?: string;
}

export interface Provider {
  name: string;
  url?: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  provider: Provider;
  /** Instituição autora do conteúdo, quando diferente da certificadora. */
  contentAuthor?: string;
  category: CategoryId;
  skills: string[];
  type: OpportunityType;
  level: Level;
  /** Ausente quando `level` é `unknown`. */
  levelSource?: FieldSource;
  priceType: PriceType;
  /** Valor numérico, somente quando conhecido e fixo. */
  priceAmount?: number;
  /** Código ISO 4217, somente quando conhecido. */
  currency?: string;
  /** Observação de preço conforme a fonte (ex.: "varia por país"). */
  priceNote?: string;
  duration?: Duration;
  /** Ausente = não confirmado na fonte → a interface mostra "Não informado". */
  certificateType?: CertificateType;
  certificateNote?: string;
  prerequisites?: string[];
  /** Licença do material, quando declarada (ex.: CC BY-NC-SA 4.0). */
  license?: string;
  topics: string[];
  languages: string[];
  modality: Modality;
  sourceUrl: string;
  sourceName: string;
  sourceVerifiedAt?: ISODateString;
  lastCheckedAt: ISODateString;
  verificationStatus: VerificationStatus;
  /** Por que o registro está no estado de verificação atual. */
  verificationNote: string;
  publicationStatus: PublicationStatus;
  origin: DataOrigin;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Agentes e eventos
// ---------------------------------------------------------------------------

export type AgentId = 'scout' | 'trend' | 'atlas' | 'sol' | 'verifier';

/** Estado operacional de um agente. */
export type AgentStatus = 'active' | 'idle' | 'failed' | 'offline';

export interface Agent {
  id: AgentId;
  name: string;
  role: LocalizedText;
  description: LocalizedText;
  status: AgentStatus;
  mode: EnvironmentMode;
  lastActivityAt?: ISODateString;
  taskTypes: LocalizedText[];
  dataSources: LocalizedText[];
  limitations: LocalizedText[];
  /** Quantidade de tarefas registradas — ausente quando não há dados. */
  taskCount?: number;
}

export type AgentEventType =
  | 'source.checked'
  | 'opportunity.discovered'
  | 'record.normalized'
  | 'record.duplicate'
  | 'validation.started'
  | 'validation.passed'
  | 'validation.failed'
  | 'quality.scored'
  | 'record.published'
  | 'record.rejected'
  | 'record.outdated'
  | 'trend.analyzed'
  | 'graph.linked'
  | 'assistant.query'
  | 'agent.error';

export type EventResult = 'success' | 'failure' | 'warning' | 'info';

export type EntityType = 'course' | 'source' | 'skill' | 'query' | 'agent';

export interface AgentEvent {
  id: string;
  agentId: AgentId;
  type: AgentEventType;
  timestamp: ISODateString;
  summary: string;
  entityType: EntityType;
  entityId: string;
  /** Nome legível do objeto relacionado (ex.: título do curso). */
  entityLabel?: string;
  sourceUrl?: string;
  result: EventResult;
  /** Dados estruturados para a interface montar o texto em qualquer idioma. */
  meta?: Record<string, string | number>;
  environmentMode: EnvironmentMode;
  /** Agrupa eventos de uma mesma execução do pipeline. */
  runId?: string;
  /** Estado de publicação do registro após este evento, quando aplicável. */
  recordStatus?: PublicationStatus;
}

// ---------------------------------------------------------------------------
// Competências e fontes
// ---------------------------------------------------------------------------

export interface EvidenceSource {
  kind: 'catalog' | 'job-postings' | 'mentions';
  label: string;
  /** Origem desta evidência — `demo` nunca é apresentado como dado real. */
  origin: DataOrigin;
}

export interface Skill {
  id: string;
  name: LocalizedText;
  category: CategoryId;
  description: LocalizedText;
  relatedCourseIds: string[];
  evidenceSources: EvidenceSource[];
}

export type SourceType = 'official-site' | 'public-api' | 'institutional-page' | 'open-courseware' | 'demo-fixture';

export type TrustStatus = 'trusted' | 'under-review' | 'blocked' | 'demo';

export interface Source {
  id: string;
  name: string;
  url: string;
  sourceType: SourceType;
  trustStatus: TrustStatus;
  lastCheckedAt?: ISODateString;
  /** Política de coleta: só fontes com permissão explícita são consultadas. */
  collectionPolicy: 'manual-curation' | 'official-api' | 'not-collected' | 'demo';
  origin: DataOrigin;
}

export interface Category {
  id: CategoryId;
  name: LocalizedText;
  description: LocalizedText;
}
