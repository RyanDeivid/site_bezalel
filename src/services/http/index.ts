import { paramsFromQuery } from '@/domain/catalog/query-params';
import type { CatalogFacets, CatalogResult } from '@/domain/catalog/search';
import type { InsightsData } from '@/domain/insights';
import type { AgentEvent } from '@/types/domain';
import type { AssistantReply, EventService, FeedState, Services } from '../types';
import { ApiError, createHttpClient } from './client';
import { isAgent, isAgentEvent, isAgentEventList, isAgentList, isCourse, isCourseList, isCourseOrNull, isObject, isSkillList, isSourceList } from './guards';

/**
 * Serviços do MODO API — consomem o backend descrito em docs/ARCHITECTURE.md
 * (implementação de referência em server/). Ativado com VITE_DATA_MODE=api e
 * VITE_API_BASE_URL. Não há segredos no cliente: a API é pública e somente
 * leitura; o assistente com LLM roda inteiramente no servidor.
 */

const isCatalogResult = (v: unknown): v is CatalogResult =>
  isObject(v) && Array.isArray(v.hits) && typeof v.total === 'number' && v.hits.every((h) => isObject(h) && isCourse(h.course));
const isFacets = (v: unknown): v is CatalogFacets => isObject(v) && typeof v.total === 'number' && Array.isArray(v.categories);
const isInsights = (v: unknown): v is InsightsData => isObject(v) && Array.isArray(v.skills) && Array.isArray(v.categories);
const isReply = (v: unknown): v is AssistantReply => isObject(v) && Array.isArray(v.paragraphs) && typeof v.rule === 'string';

/** Canal de eventos em tempo real via Server-Sent Events (reconexão nativa do EventSource). */
class SseEventService implements EventService {
  private state: FeedState = { events: [], connection: 'connecting', environmentMode: 'production', runId: null, runIndex: 0 };
  private listeners = new Set<() => void>();
  private source: EventSource | null = null;
  private readonly url: string;
  private readonly loadRecent: () => Promise<AgentEvent[]>;

  constructor(url: string, loadRecent: () => Promise<AgentEvent[]>) {
    this.url = url;
    this.loadRecent = loadRecent;
  }

  getState = (): FeedState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  start(): void {
    if (this.source) return;
    void this.loadRecent()
      .then((events) => this.set({ events }))
      .catch(() => this.set({ connection: 'error' }));
    this.connect();
  }

  pause(): void {
    this.source?.close();
    this.source = null;
    this.set({ connection: 'paused' });
  }

  resume(): void {
    this.connect();
  }

  private connect(): void {
    if (typeof EventSource === 'undefined') {
      this.set({ connection: 'error' });
      return;
    }
    this.source = new EventSource(this.url);
    this.source.onopen = () => this.set({ connection: 'live' });
    this.source.onerror = () => this.set({ connection: 'error' });
    this.source.onmessage = (msg: MessageEvent) => {
      try {
        const data: unknown = JSON.parse(String(msg.data));
        if (isAgentEvent(data)) this.set({ events: [...this.state.events, data].slice(-240) });
      } catch {
        /* mensagem malformada é descartada */
      }
    };
  }

  private set(patch: Partial<FeedState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
}

export function createHttpServices(baseUrl: string): Services {
  const http = createHttpClient(baseUrl);
  return {
    mode: 'api',
    catalog: {
      search: (query) => http.get('/v1/courses', isCatalogResult, { params: paramsFromQuery(query) }),
      getBySlug: async (slug) => {
        try {
          return await http.get(`/v1/courses/${encodeURIComponent(slug)}`, isCourseOrNull);
        } catch (err) {
          // 404 é resposta válida: a oportunidade não existe.
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }
      },
      getRelated: (course, limit = 3) =>
        http.get(`/v1/courses/${encodeURIComponent(course.slug)}/related`, isCourseList, {
          params: new URLSearchParams({ limit: String(limit) }),
        }),
      getFacets: (options) =>
        http.get('/v1/catalog/facets', isFacets, { params: new URLSearchParams(options?.includeDemo ? { demo: '1' } : {}) }),
      listRegistry: () => http.get('/v1/registry', isCourseList),
    },
    agents: {
      list: () => http.get('/v1/agents', isAgentList),
      get: async (id) => {
        try {
          return await http.get(`/v1/agents/${id}`, isAgent);
        } catch {
          return null;
        }
      },
    },
    events: new SseEventService(http.url('/v1/events/stream'), () =>
      http.get('/v1/events', isAgentEventList, { params: new URLSearchParams({ limit: '120' }) }),
    ),
    skills: {
      list: () => http.get('/v1/skills', isSkillList),
      getInsights: (filter) => {
        const params = new URLSearchParams();
        if (filter.category && filter.category !== 'all') params.set('category', filter.category);
        if (filter.periodRange) params.set('period', filter.periodRange.join('-'));
        return http.get('/v1/insights', isInsights, { params });
      },
    },
    sources: { list: () => http.get('/v1/sources', isSourceList) },
    assistant: {
      engine: 'llm-backend',
      ask: (question, locale) => http.post('/v1/assistant', { question, locale }, isReply),
    },
  };
}
