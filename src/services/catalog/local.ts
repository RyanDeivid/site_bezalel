import { computeFacets, relatedCourses, searchCatalog } from '@/domain/catalog/search';
import type { Course } from '@/types/domain';
import type { CatalogService } from '../types';
import { searchVocabulary } from './vocabulary';

/**
 * Catálogo local: registros curados (reais) + registros de demonstração.
 * Funciona sem rede e sem credenciais.
 */
export function createLocalCatalogService(curated: Course[], demo: Course[]): CatalogService {
  const all = [...curated, ...demo];
  const bySlug = new Map(all.map((c) => [c.slug, c]));

  return {
    async search(query) {
      return searchCatalog(all, query, searchVocabulary);
    },
    async getBySlug(slug) {
      return bySlug.get(slug) ?? null;
    },
    async getRelated(course, limit = 3) {
      return relatedCourses(course, all, limit);
    },
    async getFacets(options) {
      return computeFacets(all, options?.includeDemo ?? false);
    },
    async listRegistry() {
      return all;
    },
  };
}
