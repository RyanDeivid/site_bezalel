import { ageInDays, MAX_RECORD_AGE_DAYS } from './validate';

/**
 * Reconferência periódica (agente Vigia).
 *
 * Um registro só é considerado atual se a última confirmação na fonte tem no
 * máximo 180 dias (`MAX_RECORD_AGE_DAYS`, a mesma regra da validação). O
 * Vigia não abre a página da fonte: ele calcula, a partir das datas
 * registradas, quem já passou do prazo e quem chega a ele em breve — a fila
 * da próxima reconferência.
 */

/** Antecedência, em dias, com que um registro entra na fila de reconferência. */
export const RECHECK_WINDOW_DAYS = 30;

export interface FreshnessItem {
  id: string;
  title: string;
  /** Data da última confirmação na fonte. */
  checkedAt: string;
  /** Dias desde a última confirmação. */
  age: number;
  /** Dias até completar o prazo (negativo = já passou). */
  daysLeft: number;
}

export interface FreshnessReport {
  total: number;
  /** Já passaram do prazo: devem ser marcados como desatualizados. */
  overdue: FreshnessItem[];
  /** Chegam ao prazo dentro da janela de reconferência. */
  dueSoon: FreshnessItem[];
  /** Dias desde a conferência mais antiga (0 sem registros). */
  oldestAge: number;
  maxAgeDays: number;
  windowDays: number;
}

interface CheckedRecord {
  id: string;
  title: string;
  lastCheckedAt: string;
  sourceVerifiedAt?: string;
}

export function assessFreshness(records: readonly CheckedRecord[], now: Date, maxAgeDays = MAX_RECORD_AGE_DAYS, windowDays = RECHECK_WINDOW_DAYS): FreshnessReport {
  const items: FreshnessItem[] = records.map((r) => {
    // A confirmação na fonte vale mais que a data de revisão interna, quando existe.
    const checkedAt = r.sourceVerifiedAt ?? r.lastCheckedAt;
    const age = ageInDays(checkedAt, now);
    return { id: r.id, title: r.title, checkedAt, age, daysLeft: maxAgeDays - age };
  });
  const byUrgency = (a: FreshnessItem, b: FreshnessItem) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title);
  const finite = items.filter((i) => Number.isFinite(i.age));
  return {
    total: records.length,
    // Data ilegível conta como vencida: sem data, não há como dizer que está atual.
    overdue: items.filter((i) => i.daysLeft < 0).sort(byUrgency),
    dueSoon: items.filter((i) => i.daysLeft >= 0 && i.daysLeft <= windowDays).sort(byUrgency),
    oldestAge: finite.reduce((max, i) => Math.max(max, i.age), 0),
    maxAgeDays,
    windowDays,
  };
}
