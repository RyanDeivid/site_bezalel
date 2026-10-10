import type { CatalogFacets, CatalogQuery, CatalogResult } from '@/domain/catalog/search';
import type { InsightsData, InsightsFilter } from '@/domain/insights';
import type { Agent, AgentEvent, AgentId, Course, Locale, Skill, Source } from '@/types/domain';

/**
 * Contratos da camada de serviços. Componentes conversam APENAS com estas
 * interfaces (via useServices), nunca com arquivos de dados diretamente.
 * Há duas implementações: `local` (demo, sem credenciais) e `http` (backend).
 */

export interface CatalogService {
  search(query: CatalogQuery): Promise<CatalogResult>;
  getBySlug(slug: string): Promise<Course | null>;
  getRelated(course: Course, limit?: number): Promise<Course[]>;
  getFacets(options?: { includeDemo?: boolean }): Promise<CatalogFacets>;
  /** Todos os registros em qualquer estado de publicação (auditoria/metodologia). */
  listRegistry(): Promise<Course[]>;
}

export interface AgentService {
  list(): Promise<Agent[]>;
  get(id: AgentId): Promise<Agent | null>;
}

export type FeedConnection = 'live' | 'paused' | 'connecting' | 'error';

export interface FeedState {
  events: AgentEvent[];
  connection: FeedConnection;
  environmentMode: 'demo' | 'production';
  /** Identificador da execução atual do pipeline, quando houver. */
  runId: string | null;
  runIndex: number;
}

export interface EventService {
  getState(): FeedState;
  /** Notifica a cada mudança de estado. Retorna a função de cancelamento. */
  subscribe(listener: () => void): () => void;
  /** Inicia/para o consumo (a simulação para de gerar; o canal real desconecta). */
  start(): void;
  pause(): void;
  resume(): void;
}

export interface SkillService {
  list(): Promise<Skill[]>;
  getInsights(filter: InsightsFilter): Promise<InsightsData>;
}

export interface SourceService {
  list(): Promise<Source[]>;
}

export interface AssistantSuggestion {
  label: string;
  to: string;
}

export interface AssistantReply {
  paragraphs: string[];
  courses: Course[];
  suggestions: AssistantSuggestion[];
  sources: Array<{ name: string; url: string }>;
  /** Regra ou mecanismo que produziu a resposta — exibido por transparência. */
  rule: string;
  kind: 'answer' | 'insufficient-data' | 'out-of-scope' | 'greeting' | 'help';
}

export interface AssistantService {
  readonly engine: 'local-rules' | 'llm-backend';
  ask(question: string, locale: Locale): Promise<AssistantReply>;
}

export interface Services {
  mode: 'demo' | 'api';
  catalog: CatalogService;
  agents: AgentService;
  events: EventService;
  skills: SkillService;
  sources: SourceService;
  assistant: AssistantService;
}
