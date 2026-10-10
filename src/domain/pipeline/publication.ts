import type { PublicationStatus } from '@/types/domain';

/**
 * Etapa 7 — Publicação: máquina de estados do ciclo de vida de um registro.
 *
 *   found ──▶ validating ──▶ approved ──▶ published ──▶ outdated
 *     │            │             │            │             │
 *     └──▶ removed └──▶ rejected ◀┘            └──▶ removed  └──▶ validating
 *
 * Qualquer transição fora desta tabela é um erro de programação e é recusada.
 */
export const PUBLICATION_TRANSITIONS: Record<PublicationStatus, readonly PublicationStatus[]> = {
  found: ['validating', 'removed'],
  validating: ['approved', 'rejected'],
  approved: ['published', 'rejected'],
  rejected: ['validating', 'removed'],
  published: ['outdated', 'removed'],
  outdated: ['validating', 'removed'],
  removed: [],
};

export const PUBLICATION_STATUSES = Object.keys(PUBLICATION_TRANSITIONS) as PublicationStatus[];

export function canTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  return PUBLICATION_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  readonly from: PublicationStatus;
  readonly to: PublicationStatus;

  constructor(from: PublicationStatus, to: PublicationStatus) {
    super(`Transição de publicação inválida: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

/** Aplica uma transição, devolvendo o novo histórico. Lança erro se for inválida. */
export function transition(history: PublicationStatus[], to: PublicationStatus): PublicationStatus[] {
  const from = history.at(-1);
  if (from === undefined) {
    if (to !== 'found') throw new InvalidTransitionError('found', to);
    return ['found'];
  }
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
  return [...history, to];
}

/** Estados visíveis no catálogo público. */
export function isPubliclyVisible(status: PublicationStatus): boolean {
  return status === 'published' || status === 'outdated';
}
