import { curated, skillName, skills as skillDefinitions } from '@/data/catalog/store';
import { curatedSources } from '@/data/catalog/sources';
import { demoAgents } from '@/data/demo/agents';
import { demoSources } from '@/data/demo/pipeline-fixtures';
import { answerQuestion } from '@/domain/assistant/engine';
import { searchCatalog } from '@/domain/catalog/search';
import { computeInsights } from '@/domain/insights';
import { assessFreshness } from '@/domain/pipeline';
import { messages } from '@/i18n';
import { formatDate } from '@/lib/format';
import { resolved } from '@/lib/sync-promise';
import type { Course, Skill } from '@/types/domain';
import { buildDemoRegistry } from './catalog/demo-registry';
import { createLocalCatalogService } from './catalog/local';
import { searchVocabulary, skillCategoryMap } from './catalog/vocabulary';
import { DemoEventFeed } from './events/demo-feed';
import { buildDemoScenario } from './events/scenario';
import type { AssistantService, Services } from './types';

/**
 * Serviços do MODO DEMONSTRAÇÃO: 100% locais, sem rede e sem credenciais.
 * Catálogo curado (real) + registros e eventos de demonstração (fictícios).
 */
export function createLocalServices(now: Date = new Date(), curatedCourses: Course[] = curated()): Services {
  const { courses: demoCourses } = buildDemoRegistry(now);
  const catalog = createLocalCatalogService(curatedCourses, demoCourses);

  const published = curatedCourses.filter((c) => c.publicationStatus === 'published');

  const skills: Skill[] = skillDefinitions().map((def) => ({
    ...def,
    relatedCourseIds: published.filter((c) => c.skills.includes(def.id)).map((c) => c.id),
    evidenceSources: [{ kind: 'catalog', label: 'Catálogo curado Bezalel', origin: 'curated' }],
  }));

  const baseInsights = computeInsights(curatedCourses, skillCategoryMap());
  const skillLabel = (id: string) => skillName(id, 'pt-BR');

  const events = new DemoEventFeed({
    buildRun: (runIndex, at) =>
      buildDemoScenario(runIndex, at, {
        countResults: (q) => searchCatalog(curatedCourses, { q }, searchVocabulary()).total,
        topSkills: baseInsights.skills.slice(0, 6).map((s) => ({ skillId: s.skillId, label: skillLabel(s.skillId), count: s.courseCount })),
        skillLinks: published.reduce((n, c) => n + c.skills.length, 0),
        freshness: assessFreshness(published, at),
      }),
  });

  const assistant: AssistantService = {
    engine: 'local-rules',
    async ask(question, locale) {
      const m = messages[locale];
      const reply = answerQuestion(question.slice(0, 500), {
        strings: m.assistant.engine,
        courses: published,
        search: (query) => searchCatalog(curatedCourses, query, searchVocabulary()),
        labels: {
          category: m.enums.category,
          level: m.enums.level,
          price: m.enums.priceType,
          certificate: m.enums.certificateType,
          verification: m.enums.verificationStatus,
          duration: m.enums.duration,
          formatDate: (iso) => formatDate(iso, locale) ?? iso,
        },
      });
      return { ...reply, rule: m.assistant.engine.rules[reply.rule] };
    },
  };

  return {
    mode: 'demo',
    catalog,
    agents: {
      list() {
        return resolved(demoAgents);
      },
      get(id) {
        return resolved(demoAgents.find((a) => a.id === id) ?? null);
      },
    },
    events,
    skills: {
      list() {
        return resolved(skills);
      },
      getInsights(filter) {
        return resolved(computeInsights(curatedCourses, skillCategoryMap(), filter));
      },
    },
    sources: {
      list() {
        return resolved([...curatedSources, ...demoSources]);
      },
    },
    assistant,
  };
}
