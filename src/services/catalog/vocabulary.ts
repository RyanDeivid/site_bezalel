import { categories, skillDefinitions } from '@/data/catalog/taxonomy';
import type { SearchVocabulary } from '@/domain/catalog/search';
import type { CategoryId } from '@/types/domain';

/** Vocabulário bilíngue para indexar competências e categorias na busca. */
export const searchVocabulary: SearchVocabulary = {
  skillNames: Object.fromEntries(skillDefinitions.map((s) => [s.id, [s.name['pt-BR'], s.name.en]])),
  categoryNames: Object.fromEntries(categories.map((c) => [c.id, [c.name['pt-BR'], c.name.en]])) as Record<CategoryId, string[]>,
};

export const skillCategoryMap: Record<string, CategoryId> = Object.fromEntries(skillDefinitions.map((s) => [s.id, s.category]));
