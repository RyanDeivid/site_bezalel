import { DEMO_MENTION_PERIODS, demoMentionSeries } from '@/data/demo/mentions';
import type { CategoryId, Course, Level, PriceType } from '@/types/domain';

/**
 * Insights derivados do catálogo. Três indicadores, NUNCA misturados:
 *  - courseCount: número de cursos no catálogo verificado (dado real).
 *  - mentions: menções em fontes monitoradas (SÉRIE DEMONSTRATIVA).
 *  - jobs: vagas — sem fonte conectada nesta versão (indisponível).
 */

export interface SkillInsight {
  skillId: string;
  category: CategoryId;
  courseCount: number;
  freeCourseCount: number;
  courseIds: string[];
  providers: string[];
}

export interface CategoryInsight {
  category: CategoryId;
  courseCount: number;
  skillCount: number;
}

export interface SkillPair {
  a: string;
  b: string;
  courses: number;
}

export interface MentionPoint {
  period: string;
  [skillId: string]: number | string;
}

export interface InsightsData {
  skills: SkillInsight[];
  categories: CategoryInsight[];
  pairs: SkillPair[];
  price: Array<{ value: PriceType; count: number }>;
  levels: Array<{ value: Level; count: number }>;
  mentions: { periods: string[]; skills: string[]; points: MentionPoint[]; origin: 'demo' };
  jobs: { available: false };
  totalCourses: number;
  periodChecked: { from: string | null; to: string | null };
}

export interface InsightsFilter {
  category?: CategoryId | 'all';
  /** Índice inicial e final (inclusive) em DEMO_MENTION_PERIODS. */
  periodRange?: [number, number];
}

export function computeInsights(
  courses: Course[],
  skillCategory: Record<string, CategoryId>,
  filter: InsightsFilter = {},
): InsightsData {
  const pool = courses.filter(
    (c) => c.origin !== 'demo' && c.publicationStatus === 'published' && (!filter.category || filter.category === 'all' || c.category === filter.category),
  );

  const skillMap = new Map<string, SkillInsight>();
  for (const c of pool) {
    for (const skillId of c.skills) {
      const entry =
        skillMap.get(skillId) ??
        ({ skillId, category: skillCategory[skillId] ?? c.category, courseCount: 0, freeCourseCount: 0, courseIds: [], providers: [] } satisfies SkillInsight);
      entry.courseCount += 1;
      if (c.priceType === 'free') entry.freeCourseCount += 1;
      entry.courseIds.push(c.id);
      if (!entry.providers.includes(c.provider.name)) entry.providers.push(c.provider.name);
      skillMap.set(skillId, entry);
    }
  }
  const skills = [...skillMap.values()].sort((a, b) => b.courseCount - a.courseCount || a.skillId.localeCompare(b.skillId));

  const catMap = new Map<CategoryId, { courses: number; skills: Set<string> }>();
  for (const c of pool) {
    const e = catMap.get(c.category) ?? { courses: 0, skills: new Set<string>() };
    e.courses += 1;
    c.skills.forEach((s) => e.skills.add(s));
    catMap.set(c.category, e);
  }
  const categories = [...catMap.entries()]
    .map(([category, e]) => ({ category, courseCount: e.courses, skillCount: e.skills.size }))
    .sort((a, b) => b.courseCount - a.courseCount);

  const pairMap = new Map<string, number>();
  for (const c of pool) {
    const ids = [...new Set(c.skills)].sort();
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        pairMap.set(key, (pairMap.get(key) ?? 0) + 1);
      }
  }
  const pairs = [...pairMap.entries()]
    .map(([k, courses]) => {
      const [a = '', b = ''] = k.split('|');
      return { a, b, courses };
    })
    .filter((p) => p.courses > 1)
    .sort((x, y) => y.courses - x.courses || x.a.localeCompare(y.a))
    .slice(0, 8);

  const tally = <T extends string>(pick: (c: Course) => T) => {
    const m = new Map<T, number>();
    pool.forEach((c) => m.set(pick(c), (m.get(pick(c)) ?? 0) + 1));
    return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  };

  const [from, to] = filter.periodRange ?? [0, DEMO_MENTION_PERIODS.length - 1];
  const periods = DEMO_MENTION_PERIODS.slice(from, to + 1) as string[];
  const mentionSkills = Object.keys(demoMentionSeries[0]?.values ?? {}).filter(
    (id) => !filter.category || filter.category === 'all' || skillCategory[id] === filter.category,
  );
  const points: MentionPoint[] = demoMentionSeries
    .filter((p) => periods.includes(p.period))
    .map((p) => {
      const point: MentionPoint = { period: p.period };
      for (const id of mentionSkills) point[id] = p.values[id] ?? 0;
      return point;
    });

  const dates = pool.map((c) => c.lastCheckedAt).sort();

  return {
    skills,
    categories,
    pairs,
    price: tally((c) => c.priceType),
    levels: tally((c) => c.level),
    mentions: { periods, skills: mentionSkills, points, origin: 'demo' },
    jobs: { available: false },
    totalCourses: pool.length,
    periodChecked: { from: dates[0] ?? null, to: dates.at(-1) ?? null },
  };
}
