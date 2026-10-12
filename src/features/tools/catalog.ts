import { curated } from '@/data/catalog/store';
import { categories } from '@/data/catalog/taxonomy';
import type { CategoryGroupId, CategoryId, Course } from '@/types/domain';

/** Cursos reais publicados (os únicos que as ferramentas usam). */
export const publishedCourses = (): Course[] => curated().filter((c) => c.origin === 'curated' && c.publicationStatus === 'published');

/** Tema (grupo de áreas) de uma área. */
export const groupOf = (id: CategoryId): CategoryGroupId => categories.find((c) => c.id === id)?.group ?? 'tech';
