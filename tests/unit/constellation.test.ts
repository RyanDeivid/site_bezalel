import { describe, expect, it } from 'vitest';
import { curatedCourses, skillDefinitions } from '@/data/catalog/courses';
import { categoryGroupOf } from '@/data/catalog/taxonomy';
import { buildConstellation, MAX_NEXT, neighborsOf, personalSky, SKY_HEIGHT, SKY_WIDTH } from '@/domain/tools/constellation';
import { EMPTY_SHELF, setProgress, toggleSaved } from '@/domain/tools/shelf';

const published = curatedCourses.filter((c) => c.origin === 'curated' && c.publicationStatus === 'published');
const groupOf = (id: keyof typeof categoryGroupOf) => categoryGroupOf[id];
const sky = buildConstellation(skillDefinitions, published, groupOf);

describe('constelação de competências', () => {
  it('tem uma estrela por competência, todas dentro do céu', () => {
    expect(sky.stars).toHaveLength(skillDefinitions.length);
    for (const s of sky.stars) {
      expect(s.x - s.r).toBeGreaterThanOrEqual(0);
      expect(s.x + s.r).toBeLessThanOrEqual(SKY_WIDTH);
      expect(s.y - s.r).toBeGreaterThanOrEqual(0);
      expect(s.y + s.r + 16).toBeLessThanOrEqual(SKY_HEIGHT);
    }
    for (const g of sky.groups) expect(g.y).toBeGreaterThan(10);
  });

  it('não sobrepõe estrelas (nem entre constelações)', () => {
    for (let i = 0; i < sky.stars.length; i++)
      for (let j = i + 1; j < sky.stars.length; j++) {
        const a = sky.stars[i]!;
        const b = sky.stars[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} × ${b.id}`).toBeGreaterThan(a.r + b.r + 3);
      }
  });

  it('liga duas competências só quando um curso real ensina as duas', () => {
    for (const l of sky.links) {
      const together = published.filter((c) => c.skills.includes(l.a) && c.skills.includes(l.b)).length;
      expect(together).toBe(l.courses);
      expect(l.a < l.b).toBe(true);
    }
    const star = sky.stars.find((s) => s.id === 'python')!;
    expect(star.courseIds).toEqual(published.filter((c) => c.skills.includes('python')).map((c) => c.id));
  });

  it('é determinística', () => {
    expect(buildConstellation(skillDefinitions, published, groupOf)).toEqual(sky);
  });

  it('sem estante, nada acende — nem sugestões', () => {
    const mine = personalSky(EMPTY_SHELF, published, sky.links);
    expect(mine.state.size).toBe(0);
    expect(mine.next).toEqual([]);
  });

  it('concluídos acendem "já tenho", salvos "aprendendo", vizinhas viram próximos passos', () => {
    const [a, b] = published.filter((c) => c.skills.length > 1);
    let shelf = toggleSaved(EMPTY_SHELF, b!.id);
    shelf = setProgress(shelf, a!.id, 'done');
    const mine = personalSky(shelf, published, sky.links);
    for (const s of a!.skills) expect(mine.state.get(s)).toBe('have');
    for (const s of b!.skills) if (!a!.skills.includes(s)) expect(mine.state.get(s)).toBe('learning');
    expect(mine.next.length).toBeLessThanOrEqual(MAX_NEXT);
    const mineIds = new Set([...a!.skills, ...b!.skills]);
    for (const id of mine.next) {
      expect(mineIds.has(id)).toBe(false);
      expect(neighborsOf(id, sky.links).some((n) => mineIds.has(n.id))).toBe(true);
      expect(mine.state.get(id)).toBe('next');
    }
    expect(mine.have).toBe(new Set(a!.skills).size);
  });
});
