import type { NormalizedRecord, QualityAssessment, ValidationResult } from './types';

/**
 * Etapa 6 — Avaliação de qualidade.
 *
 * Nota de 0 a 100: 60 pontos vêm das verificações de validação e 40 da
 * completude do registro. Um registro só pode ser publicado se passar em
 * todas as verificações bloqueantes E atingir a nota mínima.
 */
export const MIN_PUBLICATION_SCORE = 70;

const WARNING_WEIGHT = 10; // cada aviso de validação custa 10 pontos
const COMPLETENESS_WEIGHT = 8; // cada critério de completude vale 8 pontos (5 × 8 = 40)

export function assessQuality(record: NormalizedRecord, validation: ValidationResult): QualityAssessment {
  const completeness: QualityAssessment['completeness'] = [];
  if (record.duration) completeness.push('duration');
  if (record.certificateType) completeness.push('certificate');
  if (record.skills.length > 0) completeness.push('skills');
  if (record.description.length >= 120) completeness.push('description');
  if (record.level !== 'unknown') completeness.push('level');

  const validationPoints = validation.valid ? Math.max(0, 60 - validation.warnings.length * WARNING_WEIGHT) : 0;
  const score = Math.min(100, validationPoints + completeness.length * COMPLETENESS_WEIGHT);

  return {
    score,
    completeness,
    meetsPublicationCriteria: validation.valid && score >= MIN_PUBLICATION_SCORE,
  };
}
