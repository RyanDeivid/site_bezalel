import { normalizeText, tokenize } from '@/lib/text';
import type { CategoryId, Course, Level, Modality, OpportunityType, PriceType } from '@/types/domain';

/**
 * Busca e filtragem do catálogo — funções puras, usadas tanto pelo serviço
 * local (modo demo) quanto pelos testes. O backend futuro deve reproduzir a
 * mesma semântica (docs/ARCHITECTURE.md › Contratos de API).
 */

export type SortOption = 'relevance' | 'updated' | 'title';

export interface CatalogQuery {
  q?: string;
  categories?: CategoryId[];
  priceTypes?: PriceType[];
  levels?: Level[];
  modalities?: Modality[];
  types?: OpportunityType[];
  /** Apenas registros com certificado confirmado na fonte. */
  withCertificate?: boolean;
  /** Inclui registros fictícios de demonstração (sempre rotulados). */
  includeDemo?: boolean;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface CourseHit {
  course: Course;
  score: number;
  matchedFields: Array<'title' | 'skills' | 'provider' | 'topics' | 'category' | 'description'>;
}

export interface CatalogResult {
  hits: CourseHit[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Nomes legíveis usados para indexar competências e categorias (todos os idiomas). */
export interface SearchVocabulary {
  skillNames: Record<string, string[]>;
  categoryNames: Record<CategoryId, string[]>;
}

/** Sinônimos bidirecionais pt/en para termos frequentes. */
const SYNONYMS: Record<string, string[]> = {
  ia: ['ai', 'inteligencia', 'artificial'],
  ai: ['ia', 'inteligencia', 'artificial'],
  ml: ['machine', 'learning', 'aprendizado'],
  dados: ['data'],
  data: ['dados'],
  seguranca: ['security', 'ciberseguranca'],
  security: ['seguranca'],
  privacidade: ['privacy', 'lgpd'],
  privacy: ['privacidade', 'lgpd'],
  programacao: ['programming', 'python', 'programar'],
  programming: ['programacao'],
  nuvem: ['cloud'],
  cloud: ['nuvem'],
  web: ['html', 'css', 'javascript', 'front'],
  redes: ['networking', 'neural'],
  planilhas: ['spreadsheets', 'excel'],
  excel: ['planilhas', 'spreadsheets'],
  governo: ['government', 'publico'],
  agentes: ['agents'],
  agents: ['agentes'],
};

export const DEFAULT_PAGE_SIZE = 12;

const FIELD_WEIGHTS = {
  title: 6,
  skills: 4,
  provider: 3,
  topics: 2,
  category: 2,
  description: 1,
} as const;

type Field = keyof typeof FIELD_WEIGHTS;

/**
 * Tokens de cada campo, calculados uma vez por curso (e vocabulário) e
 * reaproveitados em todas as buscas: tokenizar a descrição inteira a cada
 * consulta era o maior custo da busca. Registros são imutáveis; um objeto
 * novo gera tokens novos.
 */
const tokenCache = new WeakMap<SearchVocabulary, WeakMap<Course, Record<Field, string[]>>>();

function fieldTokens(course: Course, vocab: SearchVocabulary): Record<Field, string[]> {
  let byCourse = tokenCache.get(vocab);
  if (!byCourse) {
    byCourse = new WeakMap();
    tokenCache.set(vocab, byCourse);
  }
  const cached = byCourse.get(course);
  if (cached) return cached;
  const tokens: Record<Field, string[]> = {
    title: tokenize(course.title),
    skills: course.skills.flatMap((id) => [id, ...(vocab.skillNames[id] ?? [])]).flatMap((s) => tokenize(s.replace(/-/g, ' '))),
    provider: tokenize(`${course.provider.name} ${course.contentAuthor ?? ''}`),
    topics: course.topics.flatMap((t) => tokenize(t)),
    category: (vocab.categoryNames[course.category] ?? []).flatMap((c) => tokenize(c)),
    description: tokenize(course.description),
  };
  byCourse.set(course, tokens);
  return tokens;
}

function termMatches(term: string, tokens: string[]): boolean {
  if (term.length >= 3) return tokens.some((t) => t.startsWith(term) || (t.length >= 4 && term.startsWith(t)));
  return tokens.includes(term);
}

/**
 * Pontua um curso para a consulta. Semântica E: todos os termos (ou um de
 * seus sinônimos) precisam aparecer em algum campo. Retorna null se não casar.
 */
export function scoreCourse(course: Course, terms: string[], vocab: SearchVocabulary): CourseHit | null {
  if (terms.length === 0) return { course, score: 0, matchedFields: [] };
  const tokens = fieldTokens(course, vocab);
  const matched = new Set<Field>();
  let score = 0;

  for (const term of terms) {
    const variants = [term, ...(SYNONYMS[term] ?? [])];
    let termScore = 0;
    for (const field of Object.keys(FIELD_WEIGHTS) as Field[]) {
      if (variants.some((v) => termMatches(v, tokens[field]))) {
        termScore = Math.max(termScore, FIELD_WEIGHTS[field]);
        matched.add(field);
      }
    }
    if (termScore === 0) return null;
    score += termScore;
  }

  // Frase completa no título vale um bônus.
  const phrase = terms.join(' ');
  if (phrase.length > 3 && normalizeText(course.title).includes(phrase)) score += 4;
  return { course, score, matchedFields: [...matched] };
}

function passesFilters(course: Course, query: CatalogQuery): boolean {
  if (!query.includeDemo && course.origin === 'demo') return false;
  if (query.categories?.length && !query.categories.includes(course.category)) return false;
  if (query.priceTypes?.length && !query.priceTypes.includes(course.priceType)) return false;
  if (query.levels?.length && !query.levels.includes(course.level)) return false;
  if (query.modalities?.length && !query.modalities.includes(course.modality)) return false;
  if (query.types?.length && !query.types.includes(course.type)) return false;
  if (query.withCertificate && (!course.certificateType || course.certificateType === 'none-stated')) return false;
  return true;
}

const ORIGIN_RANK: Record<Course['origin'], number> = { production: 0, curated: 0, demo: 1 };

export function sortHits(hits: CourseHit[], sort: SortOption): CourseHit[] {
  const byTitle = (a: CourseHit, b: CourseHit) => a.course.title.localeCompare(b.course.title, 'pt-BR');
  const copy = [...hits];
  switch (sort) {
    case 'title':
      return copy.sort(byTitle);
    case 'updated':
      return copy.sort(
        (a, b) => b.course.lastCheckedAt.localeCompare(a.course.lastCheckedAt) || ORIGIN_RANK[a.course.origin] - ORIGIN_RANK[b.course.origin] || byTitle(a, b),
      );
    case 'relevance':
    default:
      return copy.sort(
        (a, b) =>
          b.score - a.score ||
          ORIGIN_RANK[a.course.origin] - ORIGIN_RANK[b.course.origin] ||
          Number(b.course.verificationStatus === 'verified') - Number(a.course.verificationStatus === 'verified') ||
          byTitle(a, b),
      );
  }
}

export function searchCatalog(courses: Course[], query: CatalogQuery, vocab: SearchVocabulary): CatalogResult {
  const terms = tokenize(query.q ?? '');
  const hits: CourseHit[] = [];
  for (const course of courses) {
    if (course.publicationStatus !== 'published' && course.publicationStatus !== 'outdated') continue;
    if (!passesFilters(course, query)) continue;
    const hit = scoreCourse(course, terms, vocab);
    if (hit) hits.push(hit);
  }
  const sorted = sortHits(hits, query.sort ?? 'relevance');
  const pageSize = Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE);
  const page = Math.max(1, query.page ?? 1);
  // "Carregar mais": a página N devolve os N primeiros blocos acumulados.
  const slice = sorted.slice(0, page * pageSize);
  return { hits: slice, total: sorted.length, page, pageSize, hasMore: slice.length < sorted.length };
}

export interface FacetCount<T extends string> {
  value: T;
  count: number;
}

export interface CatalogFacets {
  categories: FacetCount<CategoryId>[];
  priceTypes: FacetCount<PriceType>[];
  levels: FacetCount<Level>[];
  modalities: FacetCount<Modality>[];
  types: FacetCount<OpportunityType>[];
  providers: number;
  total: number;
  withCertificate: number;
  lastCheckedAt: string | null;
}

function countBy<T extends string>(courses: Course[], pick: (c: Course) => T): FacetCount<T>[] {
  const map = new Map<T, number>();
  for (const c of courses) map.set(pick(c), (map.get(pick(c)) ?? 0) + 1);
  return [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

/** Facetas calculadas sobre os registros publicados (apenas valores com dados). */
export function computeFacets(courses: Course[], includeDemo = false): CatalogFacets {
  const visible = courses.filter(
    (c) => (c.publicationStatus === 'published' || c.publicationStatus === 'outdated') && (includeDemo || c.origin !== 'demo'),
  );
  const lastCheckedAt = visible.reduce<string | null>((max, c) => (!max || c.lastCheckedAt > max ? c.lastCheckedAt : max), null);
  return {
    categories: countBy(visible, (c) => c.category),
    priceTypes: countBy(visible, (c) => c.priceType),
    levels: countBy(visible, (c) => c.level),
    modalities: countBy(visible, (c) => c.modality),
    types: countBy(visible, (c) => c.type),
    providers: new Set(visible.map((c) => c.provider.name)).size,
    total: visible.length,
    withCertificate: visible.filter((c) => c.certificateType && c.certificateType !== 'none-stated').length,
    lastCheckedAt,
  };
}

/** Cursos relacionados: mesma categoria e competências em comum, sem o próprio curso. */
export function relatedCourses(course: Course, courses: Course[], limit = 3): Course[] {
  return courses
    .filter((c) => c.id !== course.id && c.origin === course.origin && c.publicationStatus === 'published')
    .map((c) => {
      const shared = c.skills.filter((s) => course.skills.includes(s)).length;
      return { c, score: shared * 2 + (c.category === course.category ? 3 : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.title.localeCompare(b.c.title))
    .slice(0, limit)
    .map((x) => x.c);
}
