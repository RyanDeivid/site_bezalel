import type { CategoryGroupId, CategoryId, Course, Level } from '@/types/domain';

/**
 * "Descubra sua trilha": a partir de poucas respostas, monta uma sequência
 * curta de cursos REAIS do catálogo verificado. Determinístico (as mesmas
 * respostas dão a mesma trilha) e explicável: cada passo diz por que entrou.
 * Nada é inventado — carga horária que a fonte não informa fica de fora das
 * contas e é dita como tal.
 */

export type TrailGoal = 'start' | 'deepen' | 'certify' | 'explore';
export const TRAIL_GOALS: TrailGoal[] = ['start', 'deepen', 'certify', 'explore'];
export const TRAIL_PACES = [2, 5, 10] as const;
export type TrailPace = (typeof TRAIL_PACES)[number];

export interface TrailAnswers {
  group: CategoryGroupId | 'any';
  goal: TrailGoal;
  /** Horas por semana disponíveis. */
  pace: TrailPace;
  freeOnly: boolean;
  certificate: boolean;
  portugueseOnly: boolean;
}

export type TrailReason = 'beginner' | 'advanced' | 'theme' | 'certificate' | 'free' | 'portuguese' | 'new-skills' | 'short' | 'new-area';

export interface TrailStep {
  course: Course;
  reasons: TrailReason[];
  /** Carga horária declarada pela fonte (em horas), ou null. */
  hours: number | null;
}

export interface Trail {
  steps: TrailStep[];
  /** Soma das cargas horárias declaradas em horas. */
  knownHours: number;
  /** Passos cuja carga horária a fonte não dá em horas. */
  unknownHours: number;
  /** Semanas para cumprir as horas declaradas no ritmo escolhido (null sem horas). */
  weeks: number | null;
  /** Competências cobertas pela trilha. */
  skills: string[];
  /** Quantos cursos atendiam a todas as restrições (se < tamanho pedido, a trilha sai mais curta). */
  candidates: number;
}

export const TRAIL_SIZE = 4;

/** Carga horária total em horas, só quando a fonte a declara assim. */
export function statedHours(course: Course): number | null {
  return course.duration?.unit === 'hours' && course.duration.value > 0 ? course.duration.value : null;
}

const hasCertificate = (c: Course) => c.certificateType !== undefined && c.certificateType !== 'none-stated';
const isFree = (c: Course) => c.priceType === 'free' || c.priceType === 'free-with-paid-certificate';
const inPortuguese = (c: Course) => c.languages.some((l) => l.startsWith('pt'));

const LEVEL_ORDER: Record<Level, number> = { beginner: 0, 'all-levels': 1, unknown: 1, intermediate: 2, advanced: 3 };

/** Cursos que atendem às restrições (tema e preferências marcadas), fora os de `exclude` (ids). */
export function trailCandidates(answers: TrailAnswers, catalog: readonly Course[], groupOf: (c: CategoryId) => CategoryGroupId, exclude?: ReadonlySet<string>): Course[] {
  return catalog.filter(
    (c) =>
      !exclude?.has(c.id) &&
      c.origin === 'curated' &&
      c.publicationStatus === 'published' &&
      (answers.group === 'any' || groupOf(c.category) === answers.group) &&
      (!answers.freeOnly || isFree(c)) &&
      (!answers.certificate || hasCertificate(c)) &&
      (!answers.portugueseOnly || inPortuguese(c)),
  );
}

/** Pontuação de um curso para o objetivo, sem considerar o resto da trilha. */
function baseScore(c: Course, goal: TrailGoal): number {
  let s = 0;
  const hours = statedHours(c);
  if (goal === 'start') s += { beginner: 3, 'all-levels': 2, unknown: 0.5, intermediate: -2, advanced: -3 }[c.level];
  if (goal === 'deepen') s += { beginner: -1, 'all-levels': 0.5, unknown: 0.5, intermediate: 3, advanced: 3 }[c.level];
  if (goal === 'certify') {
    if (c.certificateType === 'free-certificate' || c.certificateType === 'professional-certification') s += 3;
    else if (hasCertificate(c)) s += 2;
    if (hours) s += 1;
  }
  if (goal === 'explore' && hours !== null && hours <= 20) s += 1.5;
  if (hours !== null) s += 0.5; // dá para planejar
  if (c.verificationStatus === 'verified') s += 0.5;
  return s;
}

/**
 * Escolha gulosa: a cada passo, o curso de maior pontuação somando a novidade
 * que ele traz (competências ainda não cobertas; área nova, se o objetivo é
 * explorar) e uma leve penalidade por repetir a instituição.
 */
export function buildTrail(
  answers: TrailAnswers,
  catalog: readonly Course[],
  groupOf: (c: CategoryId) => CategoryGroupId,
  size = TRAIL_SIZE,
  exclude?: ReadonlySet<string>,
): Trail {
  const candidates = trailCandidates(answers, catalog, groupOf, exclude);
  const pool = [...candidates].sort((a, b) => a.title.localeCompare(b.title));
  const picked: Course[] = [];
  const skills = new Set<string>();
  const areas = new Set<CategoryId>();
  const providers = new Map<string, number>();

  while (picked.length < size && pool.length) {
    let best = -1;
    let bestScore = -Infinity;
    pool.forEach((c, i) => {
      const fresh = c.skills.filter((s) => !skills.has(s)).length;
      let score = baseScore(c, answers.goal) + Math.min(3, fresh) * 0.8;
      if (answers.goal === 'explore' && areas.has(c.category)) score -= 1.5;
      score -= (providers.get(c.provider.name) ?? 0) * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    const [course] = pool.splice(best, 1);
    picked.push(course!);
    course!.skills.forEach((s) => skills.add(s));
    areas.add(course!.category);
    providers.set(course!.provider.name, (providers.get(course!.provider.name) ?? 0) + 1);
  }

  // Ordem de estudo: do mais introdutório ao mais avançado (estável na ordem de escolha).
  const ordered = picked.map((c, i) => ({ c, i })).sort((a, b) => LEVEL_ORDER[a.c.level] - LEVEL_ORDER[b.c.level] || a.i - b.i).map(({ c }) => c);
  return summarize(ordered, answers, candidates.length);
}

/** Monta os passos (motivos e horas) e o resumo de uma lista de cursos já escolhida — usado também por trilhas compartilhadas. */
export function summarize(courses: Course[], answers: Pick<TrailAnswers, 'group' | 'goal' | 'pace' | 'freeOnly' | 'certificate' | 'portugueseOnly'>, candidates = courses.length): Trail {
  const seenSkills = new Set<string>();
  const seenAreas = new Set<CategoryId>();
  const steps: TrailStep[] = courses.map((course) => {
    const reasons: TrailReason[] = [];
    if (answers.goal === 'start' && (course.level === 'beginner' || course.level === 'all-levels')) reasons.push('beginner');
    if (answers.goal === 'deepen' && (course.level === 'intermediate' || course.level === 'advanced')) reasons.push('advanced');
    if (answers.group !== 'any') reasons.push('theme');
    if (hasCertificate(course) && (answers.certificate || answers.goal === 'certify')) reasons.push('certificate');
    if (isFree(course) && answers.freeOnly) reasons.push('free');
    if (inPortuguese(course) && answers.portugueseOnly) reasons.push('portuguese');
    const fresh = course.skills.filter((s) => !seenSkills.has(s));
    if (fresh.length >= 2) reasons.push('new-skills');
    if (answers.goal === 'explore' && !seenAreas.has(course.category) && seenAreas.size > 0) reasons.push('new-area');
    const hours = statedHours(course);
    if (hours !== null && hours <= 20) reasons.push('short');
    course.skills.forEach((s) => seenSkills.add(s));
    seenAreas.add(course.category);
    return { course, reasons, hours };
  });
  const knownHours = steps.reduce((n, s) => n + (s.hours ?? 0), 0);
  return {
    steps,
    knownHours,
    unknownHours: steps.filter((s) => s.hours === null).length,
    weeks: knownHours > 0 ? Math.ceil(knownHours / answers.pace) : null,
    skills: [...seenSkills],
    candidates,
  };
}

// ---- Trilha no endereço (compartilhável) ---------------------------------------------

/** Chave da última trilha vista (só no navegador): a home oferece "continue de onde parou". */
export const LAST_TRAIL_KEY = 'bz-last-trail';

const GROUPS: Array<CategoryGroupId | 'any'> = ['any', 'tech', 'health', 'learning', 'business', 'creative', 'production', 'public'];

/**
 * Respostas + cursos → busca da URL (`t=tech&g=start&h=5&o=c&c=a,b,c`). Montada
 * à mão para as vírgulas ficarem legíveis no link compartilhado (URLSearchParams
 * as codificaria como %2C); todos os valores são de vocabulário fechado ou slugs.
 */
export function trailQuery(answers: TrailAnswers, slugs: string[]): string {
  const flags = `${answers.freeOnly ? 'f' : ''}${answers.certificate ? 'c' : ''}${answers.portugueseOnly ? 'p' : ''}`;
  const parts = [`t=${answers.group}`, `g=${answers.goal}`, `h=${answers.pace}`, ...(flags ? [`o=${flags}`] : []), `c=${slugs.filter((s) => /^[a-z0-9-]+$/.test(s)).join(',')}`];
  return parts.join('&');
}

/** Lê uma trilha compartilhada; parâmetros desconhecidos ou inválidos viram o padrão. */
export function trailFromParams(params: URLSearchParams): { answers: TrailAnswers; slugs: string[] } | null {
  const slugs = (params.get('c') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,120}$/.test(s))
    .slice(0, 8);
  if (!slugs.length) return null;
  const group = GROUPS.find((g) => g === params.get('t')) ?? 'any';
  const goal = TRAIL_GOALS.find((g) => g === params.get('g')) ?? 'start';
  const pace = TRAIL_PACES.find((h) => String(h) === params.get('h')) ?? 5;
  const o = params.get('o') ?? '';
  return { answers: { group, goal, pace, freeOnly: o.includes('f'), certificate: o.includes('c'), portugueseOnly: o.includes('p') }, slugs };
}
