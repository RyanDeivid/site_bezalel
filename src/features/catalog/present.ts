import type { Messages } from '@/i18n';
import { formatMoney } from '@/lib/format';
import type { Course, Locale } from '@/types/domain';

/** Rótulo de preço: valor exato só quando conhecido; senão a condição declarada. */
export function priceLabel(course: Course, m: Messages, locale: Locale): string {
  if (course.priceType === 'paid' && course.priceAmount !== undefined && course.currency) {
    return formatMoney(course.priceAmount, course.currency, locale);
  }
  return m.enums.priceType[course.priceType];
}

export function durationLabel(course: Course, m: Messages): string | null {
  if (!course.duration) return null;
  return m.enums.duration(course.duration.value, course.duration.unit);
}

export function languagesLabel(course: Course, m: Messages): string | null {
  if (!course.languages.length) return null;
  return course.languages.map((l) => m.enums.language[l] ?? l).join(', ');
}

export function coursePath(course: Pick<Course, 'slug'>): string {
  return `/course/${course.slug}`;
}
