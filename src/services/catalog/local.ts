import { computeFacets, relatedCourses, searchCatalog } from '@/domain/catalog/search';
import { resolved } from '@/lib/sync-promise';
import type { Course } from '@/types/domain';
import type { CatalogService } from '../types';
import { searchVocabulary } from './vocabulary';

/**
 * Catálogo local: registros curados (reais) + registros de demonstração.
 * Funciona sem rede e sem credenciais. As respostas são `resolved(...)`:
 * legíveis já no primeiro render (ver lib/sync-promise.ts).
 */
export function createLocalCatalogService(curated: Course[], demo: Course[]): CatalogService {
  const all = [...curated, ...demo];
  const bySlug = new Map(all.map((c) => [c.slug, c]));

  return {
    search(query) {
      return resolved(searchCatalog(all, query, searchVocabulary()));
    },
    getBySlug(slug) {
      return resolved(bySlug.get(slug) ?? null);
    },
    getRelated(course, limit = 3) {
      return resolved(relatedCourses(course, all, limit));
    },
    getFacets(options) {
      return resolved(computeFacets(all, options?.includeDemo ?? false));
    },
    listRegistry() {
      return resolved(all);
    },
  };
}
