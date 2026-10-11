import { skills } from '@/data/catalog/store';
import { categories } from '@/data/catalog/taxonomy';
import type { SearchVocabulary } from '@/domain/catalog/search';
import type { CategoryId } from '@/types/domain';

// Calculados na primeira chamada: as competências chegam com o chunk do catálogo.
let vocabulary: SearchVocabulary | null = null;
let categoryOfSkill: Record<string, CategoryId> | null = null;

/** Vocabulário bilíngue para indexar competências e categorias na busca. */
export function searchVocabulary(): SearchVocabulary {
  vocabulary ??= {
    skillNames: Object.fromEntries(skills().map((s) => [s.id, [s.name['pt-BR'], s.name.en]])),
    categoryNames: Object.fromEntries(categories.map((c) => [c.id, [c.name['pt-BR'], c.name.en]])) as Record<CategoryId, string[]>,
  };
  return vocabulary;
}

/** Área de cada competência. */
export function skillCategoryMap(): Record<string, CategoryId> {
  categoryOfSkill ??= Object.fromEntries(skills().map((s) => [s.id, s.category]));
  return categoryOfSkill;
}
