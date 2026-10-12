import type { Course } from '@/types/domain';
import { statedHours } from './trail';

/**
 * Calculadora de horas complementares (atividades extracurriculares de
 * graduação). Conta só o que dá para comprovar: carga horária declarada pela
 * fonte EM HORAS e certificado confirmado. O resto aparece com o motivo — e a
 * palavra final é sempre da instituição de ensino.
 */

export type HoursStatus = 'counted' | 'no-hours' | 'no-certificate';

export interface HoursLine {
  course: Course;
  hours: number | null;
  status: HoursStatus;
}

export interface HoursResult {
  lines: HoursLine[];
  /** Horas que entram na conta. */
  total: number;
  required: number;
  remaining: number;
  /** 0–1 (limitado a 1). */
  covered: number;
}

export function complementaryHours(courses: readonly Course[], required: number): HoursResult {
  const need = Number.isFinite(required) && required > 0 ? Math.round(required) : 0;
  const lines: HoursLine[] = courses.map((course) => {
    const hours = statedHours(course);
    if (hours === null) return { course, hours, status: 'no-hours' };
    if (course.certificateType === undefined || course.certificateType === 'none-stated') return { course, hours, status: 'no-certificate' };
    return { course, hours, status: 'counted' };
  });
  const total = lines.reduce((n, l) => n + (l.status === 'counted' ? l.hours! : 0), 0);
  return { lines, total, required: need, remaining: Math.max(0, need - total), covered: need ? Math.min(1, total / need) : 0 };
}
