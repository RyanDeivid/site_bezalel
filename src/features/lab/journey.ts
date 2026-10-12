import { ageInDays, MAX_RECORD_AGE_DAYS } from '@/domain/pipeline/validate';
import type { CategoryId, Course, VerificationStatus } from '@/types/domain';
import { counterOf, ENTRANCE_ANGLE, hubPort, stationById, travelPath, type GuideRuntime, type Place, type Point2 } from './layout';

/**
 * Jornadas guiadas pelo campus (v2 · Fase 3):
 *  - tour: a Central e os seis setores, na ordem do pipeline;
 *  - "seguir um curso": um registro real do catálogo passando pelas etapas,
 *    com os dados verdadeiros dele em cada parada.
 * Lógica pura (posições e fatos); a cena move o guia e a página mostra o texto.
 */

export type JourneyKind = 'tour' | 'course';

export const TOUR_STOPS: Place[] = ['hub', 'scout', 'verifier', 'vigia', 'atlas', 'trend', 'sol'];
/** Por onde um registro passa: descoberto → validado → publicado → relacionado → analisado → reconferido → consultado. */
export const COURSE_STOPS: Place[] = ['scout', 'verifier', 'hub', 'atlas', 'trend', 'vigia', 'sol'];

export const journeyStops = (kind: JourneyKind) => (kind === 'tour' ? TOUR_STOPS : COURSE_STOPS);

export interface StopPose extends Point2 {
  /** Para onde o guia fica virado na parada. */
  heading: number;
  /** De onde a câmera olha (yaw): atrás do guia, do lado da Central. */
  viewYaw: number;
}

/** Onde o guia para: no balcão do setor, de frente para ele; na Central, na borda sul da praça. */
export function stopPose(place: Place): StopPose {
  if (place === 'hub') {
    const p = hubPort(ENTRANCE_ANGLE);
    return { ...p, heading: Math.atan2(-p.x, -p.z), viewYaw: Math.atan2(p.x, p.z) };
  }
  const a = stationById(place).angle;
  return { ...counterOf(place), heading: Math.atan2(Math.cos(a), Math.sin(a)), viewYaw: Math.atan2(-Math.cos(a), -Math.sin(a)) };
}

/** Parada que a página pede ao guia; `key` muda a cada passo (mesmo repetindo o lugar). */
export interface GuideTarget {
  key: string;
  place: Place;
  carrying: boolean;
}

/** Guia pronto para andar de `from` até a parada `to`. */
export function guideTo(from: Point2 & { heading?: number }, to: Place, carrying: boolean): GuideRuntime {
  const pose = stopPose(to);
  return {
    path: travelPath(from, pose),
    dist: 0,
    x: from.x,
    z: from.z,
    heading: from.heading ?? pose.heading,
    stopHeading: pose.heading,
    viewYaw: pose.viewYaw,
    carrying,
    arrived: false,
  };
}

// ---- Fatos de um curso real em cada parada ----------------------------------------

export type CourseField = 'price' | 'certificate' | 'duration' | 'level' | 'prerequisites';

export interface CourseFacts {
  source: { provider: string; sourceName: string; host: string | null };
  verify: { status: VerificationStatus; checkedAt: string; stated: CourseField[]; inferred: CourseField[]; missing: CourseField[] };
  publish: { category: CategoryId; published: boolean };
  /** Competências do curso, da mais comum no catálogo para a menos comum. */
  skills: Array<{ id: string; courses: number }>;
  recheck: { checkedAt: string; dueAt: string; daysLeft: number };
  ask: { query: string };
}

const DAY_MS = 86_400_000;

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * O que é verdade sobre um registro em cada etapa, calculado dos campos dele e
 * do catálogo publicado. Nada aqui é simulado: o que a fonte não informa vai
 * para `missing` (a interface mostra "Não informado").
 */
export function courseFacts(course: Course, catalog: readonly Course[], now: Date): CourseFacts {
  const has: Record<CourseField, boolean> = {
    price: course.priceType !== 'unknown',
    certificate: course.certificateType !== undefined,
    duration: course.duration !== undefined,
    level: course.level !== 'unknown',
    prerequisites: course.prerequisites !== undefined,
  };
  const fields = Object.keys(has) as CourseField[];
  const inferred: CourseField[] = has.level && course.levelSource === 'inferred' ? ['level'] : [];
  const published = catalog.filter((c) => c.publicationStatus === 'published');
  const skills = course.skills
    .map((id) => ({ id, courses: published.filter((c) => c.skills.includes(id)).length }))
    .sort((a, b) => b.courses - a.courses || a.id.localeCompare(b.id));
  const checkedAt = course.sourceVerifiedAt ?? course.lastCheckedAt;
  const due = Date.parse(checkedAt) + MAX_RECORD_AGE_DAYS * DAY_MS;
  return {
    source: { provider: course.provider.name, sourceName: course.sourceName, host: hostOf(course.sourceUrl) },
    verify: {
      status: course.verificationStatus,
      checkedAt,
      stated: fields.filter((f) => has[f] && !inferred.includes(f)),
      inferred,
      missing: fields.filter((f) => !has[f]),
    },
    publish: { category: course.category, published: course.publicationStatus === 'published' },
    skills,
    recheck: {
      checkedAt,
      dueAt: Number.isNaN(due) ? checkedAt : new Date(due).toISOString().slice(0, 10),
      daysLeft: MAX_RECORD_AGE_DAYS - ageInDays(checkedAt, now),
    },
    ask: { query: course.title },
  };
}
