import { normalizeText } from '@/lib/text';
import type { DuplicateReason, NormalizedRecord } from './types';

/**
 * Etapa 4 — Deduplicação.
 *
 * Ordem de precedência: identificador externo estável → URL normalizada →
 * impressão digital (provedor + título normalizados).
 */

const TRACKING_PARAMS = /^(utm_[a-z]+|gclid|fbclid|msclkid|mc_cid|mc_eid|ref|ref_src|referrer|source|campaign|_hsenc|_hsmi|igshid)$/i;

/** Normaliza uma URL para comparação. URLs inválidas voltam apenas aparadas e em minúsculas. */
export function normalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return input.trim().toLowerCase();
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const port = url.port && !['80', '443'].includes(url.port) ? `:${url.port}` : '';
  let path = url.pathname.replace(/\/{2,}/g, '/').replace(/\/index\.(html?|php)$/i, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  const params = [...url.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  // Protocolo é ignorado de propósito: http e https apontam para o mesmo recurso.
  return `${host}${port}${path === '/' ? '' : path}${query}`;
}

export function recordFingerprint(provider: string, title: string): string {
  return `${normalizeText(provider)}|${normalizeText(title)}`;
}

export interface DedupeIndex {
  keys: Map<string, string>;
  externalIds: Map<string, string>;
  fingerprints: Map<string, string>;
}

export function createDedupeIndex(existingKeys: Iterable<string> = [], existingFingerprints: Iterable<string> = []): DedupeIndex {
  const index: DedupeIndex = { keys: new Map(), externalIds: new Map(), fingerprints: new Map() };
  for (const k of existingKeys) index.keys.set(k, k);
  for (const f of existingFingerprints) index.fingerprints.set(f, f);
  return index;
}

/** Retorna o motivo e a chave do registro original se `record` for duplicado. */
export function findDuplicate(
  record: NormalizedRecord,
  index: DedupeIndex,
): { key: string; reason: DuplicateReason } | null {
  if (record.externalId) {
    const hit = index.externalIds.get(`${record.sourceId}:${record.externalId}`);
    if (hit) return { key: hit, reason: 'external-id' };
  }
  const byKey = index.keys.get(record.key);
  if (byKey) return { key: byKey, reason: 'url' };
  const byFingerprint = index.fingerprints.get(record.fingerprint);
  if (byFingerprint) return { key: byFingerprint, reason: 'fingerprint' };
  return null;
}

export function registerInIndex(record: NormalizedRecord, index: DedupeIndex): void {
  index.keys.set(record.key, record.key);
  index.fingerprints.set(record.fingerprint, record.key);
  if (record.externalId) index.externalIds.set(`${record.sourceId}:${record.externalId}`, record.key);
}
