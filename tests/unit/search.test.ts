import { describe, expect, it } from 'vitest';
import { curatedCourses } from '@/data/catalog/courses';
import { countActiveFilters, explorePath, paramsFromQuery, queryFromParams } from '@/domain/catalog/query-params';
import { computeFacets, relatedCourses, searchCatalog } from '@/domain/catalog/search';
import { buildDemoRegistry } from '@/services/catalog/demo-registry';
import { searchVocabulary } from '@/services/catalog/vocabulary';

const NOW = new Date('2026-10-10T12:00:00Z');
const demo = buildDemoRegistry(NOW).courses;
const all = [...curatedCourses, ...demo];
const search = (q: Parameters<typeof searchCatalog>[1]) => searchCatalog(all, q, searchVocabulary);

describe('busca textual', () => {
  it('encontra cursos pelo título e prioriza o título', () => {
    const r = search({ q: 'CS50' });
    expect(r.total).toBeGreaterThanOrEqual(3);
    expect(r.hits[0]?.course.title).toMatch(/CS50/);
  });

  it('busca por competência (nome em português ou inglês)', () => {
    const pt = search({ q: 'aprendizado de máquina' });
    const en = search({ q: 'machine learning' });
    expect(pt.total).toBeGreaterThan(0);
    expect(en.total).toBeGreaterThan(0);
    expect(en.hits.every((h) => h.matchedFields.length > 0)).toBe(true);
  });

  it('ignora acentos e caixa', () => {
    expect(search({ q: 'proteção de dados' }).total).toBe(search({ q: 'PROTECAO DE DADOS' }).total);
  });

  it('usa sinônimos pt/en (ia → ai)', () => {
    const r = search({ q: 'ia' });
    expect(r.hits.some((h) => h.course.category === 'ai-ml')).toBe(true);
  });

  it('exige todos os termos (semântica E)', () => {
    expect(search({ q: 'linux xyzinexistente' }).total).toBe(0);
  });

  it('não devolve registros de demonstração por padrão', () => {
    expect(search({}).hits.every((h) => h.course.origin !== 'demo')).toBe(true);
    expect(search({ includeDemo: true, pageSize: 100 }).hits.some((h) => h.course.origin === 'demo')).toBe(true);
  });

  it('nunca devolve registros rejeitados ou removidos', () => {
    const r = search({ includeDemo: true, pageSize: 100 });
    expect(r.hits.every((h) => ['published', 'outdated'].includes(h.course.publicationStatus))).toBe(true);
  });
});

describe('filtros e ordenação', () => {
  it('filtro de preço realmente restringe os resultados', () => {
    const r = search({ priceTypes: ['free'], pageSize: 100 });
    expect(r.total).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.course.priceType === 'free')).toBe(true);
    expect(r.total).toBeLessThan(search({ pageSize: 100 }).total);
  });

  it('combina categoria, nível e certificado', () => {
    const r = search({ categories: ['ai-ml'], levels: ['beginner'], withCertificate: true, pageSize: 100 });
    for (const h of r.hits) {
      expect(h.course.category).toBe('ai-ml');
      expect(h.course.level).toBe('beginner');
      expect(h.course.certificateType).toBeTruthy();
    }
  });

  it('filtra por tipo de oportunidade', () => {
    const r = search({ types: ['certification'], pageSize: 100 });
    expect(r.total).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.course.type === 'certification')).toBe(true);
  });

  it('ordena por título', () => {
    const titles = search({ sort: 'title', pageSize: 100 }).hits.map((h) => h.course.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('pagina acumulando resultados ("carregar mais")', () => {
    const p1 = search({ pageSize: 5, page: 1 });
    const p2 = search({ pageSize: 5, page: 2 });
    expect(p1.hits).toHaveLength(5);
    expect(p2.hits).toHaveLength(10);
    expect(p1.hasMore).toBe(true);
  });
});

describe('facetas e relacionados', () => {
  it('conta somente valores existentes', () => {
    const f = computeFacets(all);
    expect(f.total).toBe(curatedCourses.length);
    expect(f.categories.every((c) => c.count > 0)).toBe(true);
    expect(f.providers).toBeGreaterThan(5);
  });

  it('relacionados compartilham categoria ou competências e excluem o próprio curso', () => {
    const base = curatedCourses.find((c) => c.slug === 'harvard-cs50x')!;
    const rel = relatedCourses(base, all, 3);
    expect(rel.length).toBeGreaterThan(0);
    expect(rel.find((c) => c.id === base.id)).toBeUndefined();
    expect(rel.every((c) => c.origin === base.origin)).toBe(true);
  });
});

describe('filtros na URL', () => {
  it('ida e volta preservam a consulta', () => {
    const q = { q: 'python', categories: ['ai-ml' as const], priceTypes: ['free' as const], withCertificate: true, sort: 'updated' as const };
    const back = queryFromParams(paramsFromQuery(q));
    expect(back).toMatchObject(q);
    expect(countActiveFilters(back)).toBe(3);
    expect(explorePath({})).toBe('/explore');
  });

  it('descarta valores desconhecidos vindos da URL', () => {
    const q = queryFromParams(new URLSearchParams('cat=hacking,ai-ml&price=gratis&sort=zzz'));
    expect(q.categories).toEqual(['ai-ml']);
    expect(q.priceTypes).toEqual([]);
    expect(q.sort).toBe('relevance');
  });
});
