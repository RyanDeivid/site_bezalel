import { skillDefinitions } from '../../data/catalog/taxonomy.ts';
import type { Course } from '../../types/domain.ts';

/**
 * Dados estruturados schema.org/Course — gerados SOMENTE para registros
 * reais verificados e publicados, e apenas com campos confirmados na fonte.
 * Registros de demonstração nunca recebem JSON-LD.
 *
 * Só importa módulos sem dependências de runtime: também é usado pelo script de build.
 */
export function buildCourseJsonLd(course: Course): Record<string, unknown> | null {
  if (course.origin !== 'curated' || course.publicationStatus !== 'published') return null;
  if (course.verificationStatus !== 'verified' && course.verificationStatus !== 'partially-verified') return null;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description,
    url: course.sourceUrl,
    provider: {
      '@type': 'Organization',
      name: course.provider.name,
      ...(course.provider.url ? { sameAs: course.provider.url } : {}),
    },
  };
  if (course.languages.length) data.inLanguage = course.languages;
  if (course.priceType === 'free') data.isAccessibleForFree = true;
  if (course.priceType === 'paid' && course.priceAmount !== undefined && course.currency) {
    data.offers = { '@type': 'Offer', price: course.priceAmount, priceCurrency: course.currency, category: 'Paid' };
  }
  if (course.skills.length) data.teaches = course.skills.map((id) => skillDefinitions.find((d) => d.id === id)?.name['pt-BR'] ?? id);
  if (course.prerequisites?.length) data.coursePrerequisites = course.prerequisites;
  return data;
}
