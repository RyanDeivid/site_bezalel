import { categoryIds } from '@/data/catalog/taxonomy';
import type { CategoryId, Level, Modality, OpportunityType, PriceType } from '@/types/domain';
import type { CatalogQuery, SortOption } from './search';

/**
 * Serialização dos filtros do catálogo na URL (?q=&cat=&price=…), para que
 * qualquer busca possa ser compartilhada por link. Valores desconhecidos
 * vindos da URL são descartados (entrada não confiável).
 */

const PRICE: PriceType[] = ['free', 'free-with-paid-certificate', 'paid', 'varies', 'unknown'];
const LEVEL: Level[] = ['beginner', 'intermediate', 'advanced', 'all-levels', 'unknown'];
const MODALITY: Modality[] = ['online', 'online-self-paced', 'online-scheduled', 'in-person', 'hybrid', 'unknown'];
const TYPE: OpportunityType[] = ['course', 'certification', 'learning-path'];
const SORT: SortOption[] = ['relevance', 'updated', 'title'];

function pickList<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] {
  const values = params.getAll(key).flatMap((v) => v.split(','));
  return [...new Set(values.filter((v): v is T => (allowed as readonly string[]).includes(v)))];
}

export function queryFromParams(params: URLSearchParams): CatalogQuery {
  const q = (params.get('q') ?? '').slice(0, 120);
  const sort = params.get('sort');
  return {
    q,
    categories: pickList<CategoryId>(params, 'cat', categoryIds),
    priceTypes: pickList(params, 'price', PRICE),
    levels: pickList(params, 'level', LEVEL),
    modalities: pickList(params, 'mode', MODALITY),
    types: pickList(params, 'type', TYPE),
    withCertificate: params.get('cert') === '1',
    includeDemo: params.get('demo') === '1',
    sort: SORT.includes(sort as SortOption) ? (sort as SortOption) : 'relevance',
  };
}

export function paramsFromQuery(query: CatalogQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.q?.trim()) p.set('q', query.q.trim());
  if (query.categories?.length) p.set('cat', query.categories.join(','));
  if (query.priceTypes?.length) p.set('price', query.priceTypes.join(','));
  if (query.levels?.length) p.set('level', query.levels.join(','));
  if (query.modalities?.length) p.set('mode', query.modalities.join(','));
  if (query.types?.length) p.set('type', query.types.join(','));
  if (query.withCertificate) p.set('cert', '1');
  if (query.includeDemo) p.set('demo', '1');
  if (query.sort && query.sort !== 'relevance') p.set('sort', query.sort);
  return p;
}

export function explorePath(query: CatalogQuery): string {
  const qs = paramsFromQuery(query).toString();
  return qs ? `/explore?${qs}` : '/explore';
}

export function countActiveFilters(query: CatalogQuery): number {
  return (
    (query.categories?.length ?? 0) +
    (query.priceTypes?.length ?? 0) +
    (query.levels?.length ?? 0) +
    (query.modalities?.length ?? 0) +
    (query.types?.length ?? 0) +
    (query.withCertificate ? 1 : 0)
  );
}
