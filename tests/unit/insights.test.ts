import { describe, expect, it } from 'vitest';
import { curatedCourses } from '@/data/catalog/courses';
import { computeInsights } from '@/domain/insights';
import { buildDemoRegistry } from '@/services/catalog/demo-registry';
import { skillCategoryMap } from '@/services/catalog/vocabulary';

const demo = buildDemoRegistry(new Date('2026-10-10T12:00:00Z')).courses;

describe('insights', () => {
  it('conta cursos apenas do catálogo real (demo nunca entra)', () => {
    const withDemo = computeInsights([...curatedCourses, ...demo], skillCategoryMap);
    const realOnly = computeInsights(curatedCourses, skillCategoryMap);
    expect(withDemo.totalCourses).toBe(realOnly.totalCourses);
    expect(withDemo.skills).toEqual(realOnly.skills);
  });

  it('mantém cursos, menções e vagas como indicadores separados', () => {
    const d = computeInsights(curatedCourses, skillCategoryMap);
    expect(d.mentions.origin).toBe('demo');
    expect(d.jobs.available).toBe(false);
    const python = d.skills.find((s) => s.skillId === 'python');
    expect(python?.courseCount).toBe(curatedCourses.filter((c) => c.skills.includes('python')).length);
  });

  it('filtra por categoria e período', () => {
    const d = computeInsights(curatedCourses, skillCategoryMap, { category: 'security-privacy', periodRange: [2, 4] });
    expect(d.categories.every((c) => c.category === 'security-privacy')).toBe(true);
    expect(d.mentions.periods).toEqual(['2025-T3', '2025-T4', '2026-T1']);
    expect(d.mentions.skills.every((s) => skillCategoryMap[s] === 'security-privacy')).toBe(true);
  });
});
