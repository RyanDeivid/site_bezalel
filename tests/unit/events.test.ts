import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { curatedCourses } from '@/data/catalog/courses';
import { searchCatalog } from '@/domain/catalog/search';
import { ACTIVE_WINDOW_MS, deriveAgentStatuses, deriveOpsMetrics, FAILURE_WINDOW_MS } from '@/domain/operations';
import { searchVocabulary } from '@/services/catalog/vocabulary';
import { DemoEventFeed } from '@/services/events/demo-feed';
import { buildDemoScenario, type ScenarioDeps } from '@/services/events/scenario';
import type { AgentEvent } from '@/types/domain';

const NOW = new Date('2026-10-10T12:00:00Z');
const deps: ScenarioDeps = {
  countResults: (q) => searchCatalog(curatedCourses, { q }, searchVocabulary).total,
  topSkills: [{ skillId: 'python', label: 'Python', count: 8 }],
  skillLinks: 69,
};

const ev = (patch: Partial<AgentEvent>): AgentEvent => ({
  id: Math.random().toString(36),
  agentId: 'scout',
  type: 'source.checked',
  timestamp: NOW.toISOString(),
  summary: '',
  entityType: 'source',
  entityId: 's1',
  result: 'success',
  environmentMode: 'demo',
  ...patch,
});

describe('roteiro de demonstração', () => {
  it('é determinístico e alterna a falha simulada entre execuções', () => {
    const even = buildDemoScenario(2, NOW, deps);
    expect(buildDemoScenario(2, NOW, deps)).toEqual(even);
    expect(even.events.some((e) => e.type === 'agent.error')).toBe(false);
    expect(buildDemoScenario(3, NOW, deps).events.some((e) => e.type === 'agent.error')).toBe(true);
  });

  it('consultas do Sol trazem a contagem real da busca no catálogo', () => {
    const q = buildDemoScenario(0, NOW, deps).events.find((e) => e.type === 'assistant.query');
    expect(q).toBeDefined();
    expect(q?.meta?.count).toBe(deps.countResults(String(q?.meta?.query)));
  });

  it('o Trend nunca apresenta contagem de cursos como demanda', () => {
    const trend = buildDemoScenario(0, NOW, deps).events.find((e) => e.type === 'trend.analyzed');
    expect(trend?.summary).toMatch(/não indica demanda/);
  });
});

describe('feed simulado', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('carimba todos os eventos como demonstração e respeita pausa', () => {
    const feed = new DemoEventFeed({ buildRun: (i, at) => buildDemoScenario(i, at, deps), intervalMs: 100, runGapMs: 200, now: () => new Date() });
    feed.start();
    const seeded = feed.getState().events.length;
    expect(seeded).toBeGreaterThan(0);
    vi.advanceTimersByTime(1000);
    const afterRun = feed.getState().events.length;
    expect(afterRun).toBeGreaterThan(seeded);
    expect(feed.getState().events.every((e) => e.environmentMode === 'demo')).toBe(true);

    feed.pause();
    expect(feed.getState().connection).toBe('paused');
    vi.advanceTimersByTime(1000);
    expect(feed.getState().events.length).toBe(afterRun);
    feed.resume();
    vi.advanceTimersByTime(300);
    expect(feed.getState().events.length).toBeGreaterThan(afterRun);
    feed.dispose();
  });

  it('notifica assinantes', () => {
    const feed = new DemoEventFeed({ buildRun: (i, at) => buildDemoScenario(i, at, deps), intervalMs: 50, seedHistory: false });
    const listener = vi.fn();
    feed.subscribe(listener);
    feed.start();
    vi.advanceTimersByTime(60);
    expect(listener).toHaveBeenCalled();
    feed.dispose();
  });
});

describe('estados dos agentes e métricas', () => {
  it('ativo logo após um evento, ocioso depois da janela', () => {
    const events = [ev({ agentId: 'verifier', type: 'validation.passed', entityType: 'course', recordStatus: 'approved' })];
    expect(deriveAgentStatuses(events, NOW).verifier.status).toBe('active');
    const later = new Date(NOW.getTime() + ACTIVE_WINDOW_MS + 1000);
    expect(deriveAgentStatuses(events, later).verifier.status).toBe('idle');
  });

  it('falha recente prevalece até a recuperação', () => {
    const failure = ev({ type: 'agent.error', result: 'failure', timestamp: NOW.toISOString() });
    expect(deriveAgentStatuses([failure], new Date(NOW.getTime() + 2000)).scout.status).toBe('failed');
    const recovered = ev({ type: 'source.checked', result: 'success', timestamp: new Date(NOW.getTime() + 3000).toISOString() });
    expect(deriveAgentStatuses([failure, recovered], new Date(NOW.getTime() + 4000)).scout.status).toBe('active');
    expect(deriveAgentStatuses([failure], new Date(NOW.getTime() + FAILURE_WINDOW_MS + 1000)).scout.status).toBe('idle');
  });

  it('agentes sem eventos ficam ociosos', () => {
    expect(deriveAgentStatuses([], NOW).sol.status).toBe('idle');
  });

  it('métricas derivam apenas da trilha de eventos', () => {
    const events = [
      ev({ type: 'source.checked', entityId: 'a' }),
      ev({ type: 'source.checked', entityId: 'b' }),
      ev({ type: 'agent.error', entityId: 'c', result: 'failure' }),
      ev({ type: 'opportunity.discovered', entityType: 'course', entityId: 'r1', recordStatus: 'found' }),
      ev({ type: 'validation.started', entityType: 'course', entityId: 'r1', recordStatus: 'validating' }),
      ev({ type: 'opportunity.discovered', entityType: 'course', entityId: 'r2', recordStatus: 'found' }),
      ev({ type: 'validation.passed', entityType: 'course', entityId: 'r2', recordStatus: 'approved' }),
      ev({ type: 'record.published', entityType: 'course', entityId: 'r2', recordStatus: 'published' }),
    ];
    const m = deriveOpsMetrics(events, NOW);
    expect(m).toMatchObject({ sourcesChecked: 2, sourcesFailed: 1, discovered: 2, validating: 1, approved: 1, published: 1, rejected: 0 });
  });
});
