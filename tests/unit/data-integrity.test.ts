import { describe, expect, it } from 'vitest';
import { curatedCourses } from '@/data/catalog/courses';
import { curatedSources } from '@/data/catalog/sources';
import { categoryIds, skillDefinitions } from '@/data/catalog/taxonomy';
import { demoAgents } from '@/data/demo/agents';
import { demoSources } from '@/data/demo/pipeline-fixtures';
import { buildCourseJsonLd } from '@/features/catalog/json-ld';
import { messages } from '@/i18n';
import { buildDemoRegistry } from '@/services/catalog/demo-registry';

describe('catálogo curado (registros reais)', () => {
  it('ids e slugs são únicos', () => {
    expect(new Set(curatedCourses.map((c) => c.id)).size).toBe(curatedCourses.length);
    expect(new Set(curatedCourses.map((c) => c.slug)).size).toBe(curatedCourses.length);
  });

  it.each(curatedCourses.map((c) => [c.slug, c] as const))('%s tem fonte HTTPS, data válida e origem real', (_slug, c) => {
    expect(c.sourceUrl).toMatch(/^https:\/\//);
    expect(Number.isNaN(Date.parse(c.lastCheckedAt))).toBe(false);
    expect(c.origin).toBe('curated');
    expect(c.publicationStatus).toBe('published');
    expect(['verified', 'partially-verified']).toContain(c.verificationStatus);
    expect(c.verificationNote.length).toBeGreaterThan(20);
    expect(categoryIds).toContain(c.category);
    for (const s of c.skills) expect(skillDefinitions.map((d) => d.id)).toContain(s);
    // Nível inferido precisa ser sinalizado; nível desconhecido não tem fonte.
    if (c.level === 'unknown') expect(c.levelSource).toBeUndefined();
    else expect(c.levelSource).toBeDefined();
    // Valor só existe junto com moeda.
    if (c.priceAmount !== undefined) expect(c.currency).toBeTruthy();
  });

  it('nenhum registro real usa domínios de exemplo', () => {
    expect(curatedCourses.every((c) => !c.sourceUrl.includes('example.org'))).toBe(true);
  });

  it('fontes curadas são confiáveis e de curadoria manual', () => {
    expect(curatedSources.every((s) => s.trustStatus === 'trusted' && s.collectionPolicy === 'manual-curation')).toBe(true);
  });
});

describe('dados de demonstração', () => {
  it('são sempre marcados como demo e usam domínios reservados', () => {
    expect(demoSources.every((s) => s.origin === 'demo' && s.url.includes('example.org'))).toBe(true);
    const registry = buildDemoRegistry(new Date('2026-10-10T12:00:00Z')).courses;
    expect(registry.every((c) => c.origin === 'demo' && c.verificationStatus !== 'verified')).toBe(true);
  });

  it('todos os agentes estão em modo demonstração', () => {
    expect(demoAgents).toHaveLength(5);
    expect(demoAgents.every((a) => a.mode === 'demo')).toBe(true);
    expect(demoAgents.every((a) => a.limitations.length > 0)).toBe(true);
  });

  it('dados estruturados só existem para registros reais', () => {
    const registry = buildDemoRegistry(new Date('2026-10-10T12:00:00Z')).courses;
    expect(registry.every((c) => buildCourseJsonLd(c) === null)).toBe(true);
    const real = buildCourseJsonLd(curatedCourses[0]!);
    expect(real?.['@type']).toBe('Course');
  });
});

describe('internacionalização', () => {
  type Shape = Record<string, unknown>;
  const shape = (v: unknown): unknown => {
    if (typeof v === 'function') return 'fn';
    if (Array.isArray(v)) return v.length ? ['array'] : [];
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as Shape).sort().map((k) => [k, shape((v as Shape)[k])]));
    return typeof v;
  };

  it('inglês tem exatamente as mesmas chaves do português', () => {
    expect(shape(messages.en)).toEqual(shape(messages['pt-BR']));
  });

  it('listas institucionais têm o mesmo tamanho nos dois idiomas', () => {
    expect(messages.en.privacy.sections.length).toBe(messages['pt-BR'].privacy.sections.length);
    expect(messages.en.terms.sections.length).toBe(messages['pt-BR'].terms.sections.length);
  });
});
