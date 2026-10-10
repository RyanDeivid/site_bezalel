import { containsUnsafeMarkup } from '@/lib/text';
import type { EnvironmentMode, Source } from '@/types/domain';
import type { NormalizedRecord, ValidationCheck, ValidationCheckId, ValidationResult } from './types';

/**
 * Etapa 5 — Validação.
 *
 * Critérios explícitos e auditáveis. Cada verificação tem um identificador
 * que a interface traduz e explica (ver i18n `validationChecks`).
 */

/** Idade máxima, em dias, da última confirmação para um registro ser considerado atual. */
export const MAX_RECORD_AGE_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export function ageInDays(iso: string, now: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - t) / DAY_MS);
}

export function isFresh(iso: string | undefined, now: Date, maxAgeDays = MAX_RECORD_AGE_DAYS): boolean {
  if (!iso) return false;
  return ageInDays(iso, now) <= maxAgeDays;
}

export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSourceAllowed(source: Source | undefined, env: EnvironmentMode): boolean {
  if (!source) return false;
  if (source.trustStatus === 'trusted') return true;
  // Fontes fictícias só são aceitas no modo de demonstração.
  return env === 'demo' && source.trustStatus === 'demo';
}

export function validateRecord(
  record: NormalizedRecord,
  context: { source: Source | undefined; env: EnvironmentMode; now: Date },
): ValidationResult {
  const check = (id: ValidationCheckId, passed: boolean, severity: ValidationCheck['severity']): ValidationCheck => ({
    id,
    passed,
    severity,
  });

  const httpsOk = isHttpsUrl(record.url);
  const textFields = [record.title, record.provider, record.description, record.url];

  const checks: ValidationCheck[] = [
    check('has-title', record.title.length >= 5, 'blocking'),
    check('has-provider', record.provider.length >= 2, 'blocking'),
    check('https-url', httpsOk, 'blocking'),
    check('trusted-source', isSourceAllowed(context.source, context.env), 'blocking'),
    check('safe-content', !record.notes.includes('unsafe-markup') && !textFields.some(containsUnsafeMarkup), 'blocking'),
    check('fresh', isFresh(record.updatedAtSource ?? record.collectedAt, context.now), 'blocking'),
    check('known-category', record.category !== null, 'warning'),
    check('price-declared', record.priceType !== 'unknown', 'warning'),
    check('description-length', record.description.length >= 60, 'warning'),
  ];

  const failedBlocking = checks.filter((c) => !c.passed && c.severity === 'blocking').map((c) => c.id);
  const warnings = checks.filter((c) => !c.passed && c.severity === 'warning').map((c) => c.id);
  return { valid: failedBlocking.length === 0, checks, failedBlocking, warnings };
}
