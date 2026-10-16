import type { CategoryGroupId, CategoryId } from '@/types/domain';
import type { Shelf } from './shelf';

/**
 * Constelação de competências (v2 · Fase 4): cada estrela é uma competência do
 * catálogo; duas estrelas se ligam quando aparecem no mesmo curso. As estrelas
 * de um tema formam uma constelação. Tudo é derivado dos registros reais — e a
 * parte pessoal ("o que eu já tenho") vem só da estante deste navegador.
 *
 * Layout determinístico (mesma entrada → mesmas posições), para o HTML
 * pré-renderizado e o navegador desenharem o mesmo céu.
 */

export interface StarInput {
  id: string;
  category: CategoryId;
}

export interface CourseInput {
  id: string;
  skills: string[];
}

export interface Star {
  id: string;
  category: CategoryId;
  group: CategoryGroupId;
  /** Cursos que ensinam a competência. */
  courseIds: string[];
  x: number;
  y: number;
  r: number;
}

export interface StarLink {
  a: string;
  b: string;
  /** Quantos cursos ensinam as duas juntas. */
  courses: number;
}

export interface GroupLabel {
  id: CategoryGroupId;
  x: number;
  y: number;
  count: number;
}

export interface Constellation {
  stars: Star[];
  links: StarLink[];
  groups: GroupLabel[];
  width: number;
  height: number;
}

export const SKY_WIDTH = 1000;
export const SKY_HEIGHT = 760;

/**
 * Onde fica cada constelação. Tecnologia (o maior tema) no centro; os outros
 * numa elipse ao redor, com os menores em cima e embaixo, onde há menos espaço.
 */
const CENTER_Y = 385;

const GROUP_SLOTS: Record<CategoryGroupId, { x: number; y: number }> = (() => {
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: Math.round(SKY_WIDTH / 2 + 370 * Math.cos(a)), y: Math.round(CENTER_Y + 272 * Math.sin(a)) };
  };
  return {
    tech: { x: SKY_WIDTH / 2, y: CENTER_Y },
    learning: at(-90),
    health: at(-30),
    business: at(30),
    public: at(90),
    creative: at(150),
    production: at(210),
  };
})();

/** Ângulo de ouro: espalha as estrelas de uma constelação sem sobreposição. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SPACING = 23;

/** Raio da estrela pelo número de cursos (área ~ cursos, com piso visível). */
export const starRadius = (courses: number) => Math.round((3 + 1.6 * Math.sqrt(Math.max(1, courses))) * 10) / 10;

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function buildConstellation(skills: StarInput[], courses: CourseInput[], groupOf: (c: CategoryId) => CategoryGroupId): Constellation {
  const known = new Set(skills.map((s) => s.id));
  const teaching = new Map<string, string[]>();
  const pairs = new Map<string, number>();
  for (const c of courses) {
    const ids = [...new Set(c.skills)].filter((id) => known.has(id)).sort();
    for (const id of ids) teaching.set(id, [...(teaching.get(id) ?? []), c.id]);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.set(pairKey(ids[i]!, ids[j]!), (pairs.get(pairKey(ids[i]!, ids[j]!)) ?? 0) + 1);
  }

  const byGroup = new Map<CategoryGroupId, StarInput[]>();
  for (const s of skills) {
    const g = groupOf(s.category);
    byGroup.set(g, [...(byGroup.get(g) ?? []), s]);
  }

  const stars: Star[] = [];
  const groups: GroupLabel[] = [];
  for (const [group, members] of byGroup) {
    const slot = GROUP_SLOTS[group];
    // As mais ensinadas no centro da constelação (as estrelas mais brilhantes).
    const ordered = [...members].sort((a, b) => (teaching.get(b.id)?.length ?? 0) - (teaching.get(a.id)?.length ?? 0) || a.id.localeCompare(b.id));
    let top = slot.y;
    ordered.forEach((s, i) => {
      const dist = SPACING * Math.sqrt(i + 0.5);
      const angle = i * GOLDEN;
      const courseIds = teaching.get(s.id) ?? [];
      const star: Star = {
        id: s.id,
        category: s.category,
        group,
        courseIds,
        x: Math.round((slot.x + dist * Math.cos(angle)) * 10) / 10,
        y: Math.round((slot.y + dist * Math.sin(angle)) * 10) / 10,
        r: starRadius(courseIds.length),
      };
      top = Math.min(top, star.y - star.r);
      stars.push(star);
    });
    groups.push({ id: group, x: slot.x, y: Math.round(top - 12), count: members.length });
  }

  const links = [...pairs.entries()]
    .map(([k, n]) => {
      const [a = '', b = ''] = k.split('|');
      return { a, b, courses: n };
    })
    .sort((x, y) => y.courses - x.courses || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));

  return { stars, links, groups, width: SKY_WIDTH, height: SKY_HEIGHT };
}

export type StarState = 'have' | 'learning' | 'next';

export interface PersonalSky {
  state: Map<string, StarState>;
  /** Próximas competências sugeridas (vizinhas das suas), da mais ligada para a menos. */
  next: string[];
  have: number;
  learning: number;
}

/** Quantas sugestões de "próximos passos" a constelação acende. */
export const MAX_NEXT = 6;

/**
 * O céu pessoal: concluídos acendem "já tenho"; salvos ou em andamento,
 * "aprendendo"; e as vizinhas mais ligadas a essas viram "próximos passos".
 * Sem estante, nada acende — não inventamos progresso.
 */
/** Retângulo (x, y, largura, altura) que enquadra uma constelação, com folga para o nome e as dicas. */
export function groupBounds(sky: Constellation, group: CategoryGroupId, pad = 34): [number, number, number, number] {
  const stars = sky.stars.filter((s) => s.group === group);
  const label = sky.groups.find((g) => g.id === group);
  const x0 = Math.min(...stars.map((s) => s.x - s.r)) - pad;
  const x1 = Math.max(...stars.map((s) => s.x + s.r)) + pad;
  const y0 = Math.min(label ? label.y - 14 : Infinity, ...stars.map((s) => s.y - s.r)) - pad / 2;
  const y1 = Math.max(...stars.map((s) => s.y + s.r)) + pad;
  // Mantém a proporção do céu, para o quadro não mudar de altura ao filtrar.
  const ratio = sky.width / sky.height;
  let w = x1 - x0;
  let h = y1 - y0;
  if (w / h > ratio) h = w / ratio;
  else w = h * ratio;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return [Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h)];
}

export function personalSky(shelf: Shelf, courses: CourseInput[], links: StarLink[], max = MAX_NEXT): PersonalSky {
  const state = new Map<string, StarState>();
  const done = new Set(Object.entries(shelf.progress).flatMap(([id, p]) => (p === 'done' ? [id] : [])));
  const active = new Set([...shelf.saved, ...Object.entries(shelf.progress).flatMap(([id, p]) => (p === 'doing' ? [id] : []))]);
  for (const c of courses) if (done.has(c.id)) for (const s of c.skills) state.set(s, 'have');
  for (const c of courses) if (active.has(c.id) && !done.has(c.id)) for (const s of c.skills) if (!state.has(s)) state.set(s, 'learning');

  const score = new Map<string, number>();
  for (const l of links) {
    const inA = state.has(l.a);
    const inB = state.has(l.b);
    if (inA === inB) continue;
    const other = inA ? l.b : l.a;
    score.set(other, (score.get(other) ?? 0) + l.courses);
  }
  const next = [...score.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, max)
    .map(([id]) => id);
  const counts = { have: 0, learning: 0 };
  for (const s of state.values()) counts[s as 'have' | 'learning']++;
  for (const id of next) state.set(id, 'next');
  return { state, next, ...counts };
}

/** Vizinhas de uma competência, da ligação mais forte para a mais fraca. */
export function neighborsOf(id: string, links: StarLink[]): Array<{ id: string; courses: number }> {
  return links.flatMap((l) => (l.a === id ? [{ id: l.b, courses: l.courses }] : l.b === id ? [{ id: l.a, courses: l.courses }] : []));
}
