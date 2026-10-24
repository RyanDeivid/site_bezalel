import { appConfig } from '@/lib/env';
import { SECTOR_STATUS, type SectorId, type SectorStatus } from './tower';

/**
 * Estado real dos setores, vindo do runtime de agentes do backend (`GET /v1/runtime/public/tower`), e a
 * junção com a lista de demonstração da Torre. O painel da presidência mostra, linha a linha, de onde vem
 * cada informação: do runtime (ao vivo), da demonstração ou do planejamento. Sem backend configurado,
 * desligado ou fora do ar, tudo continua como demonstração, marcada. Animação de robô ou tela nunca conta
 * como evidência: só o que o runtime gravou.
 */

const SECTORS: SectorId[] = ['reception', 'engineering', 'marketing', 'content', 'legal', 'intelligence', 'education', 'commercial', 'presidency'];

export interface LiveSector {
  sector: SectorId;
  agents: Array<{ id: string; name: string; version: number }>;
  running: number;
  queued: number;
  last_activity_at: string | null;
  last_result: { state: 'succeeded' | 'failed' | 'cancelled'; finished_at: string | null } | null;
  failures_24h: number;
}

export interface TowerLive {
  source: 'runtime';
  computed_at: string;
  sectors: LiveSector[];
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1e6;
const isDate = (v: unknown): v is string | null => v === null || (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)));
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

/** A resposta da API é não confiável: só passa o formato esperado, com limites. */
export function isTowerLive(v: unknown): v is TowerLive {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.source !== 'runtime' || !isDate(o.computed_at) || o.computed_at === null || !Array.isArray(o.sectors) || o.sectors.length > 20) return false;
  return o.sectors.every((s: unknown) => {
    if (!s || typeof s !== 'object') return false;
    const x = s as Record<string, unknown>;
    const last = x.last_result as Record<string, unknown> | null;
    return (
      SECTORS.includes(x.sector as SectorId) &&
      Array.isArray(x.agents) &&
      x.agents.length <= 50 &&
      x.agents.every((a: unknown) => !!a && typeof a === 'object' && isText((a as Record<string, unknown>).id, 60) && isText((a as Record<string, unknown>).name, 80) && isCount((a as Record<string, unknown>).version)) &&
      isCount(x.running) &&
      isCount(x.queued) &&
      isCount(x.failures_24h) &&
      isDate(x.last_activity_at) &&
      (last === null || (!!last && typeof last === 'object' && ['succeeded', 'failed', 'cancelled'].includes(last.state as string) && isDate(last.finished_at)))
    );
  });
}

/** Uma linha do painel, com a origem do que ela mostra. */
export interface SectorRow {
  sector: SectorId;
  source: 'live' | 'demo' | 'planned';
  /** Agentes ligados: os do runtime (ao vivo) ou os de produto (demonstração). */
  agents: string[];
  running: number;
  queued: number;
  lastActivityAt: string | null;
  lastResult: LiveSector['last_result'];
  failures24h: number;
}

/**
 * Junta a demonstração com o runtime. Um setor com agentes registrados no runtime vira "ao vivo", com os
 * números reais (mesmo zerados: "sem atividade ainda" é um fato). Os demais ficam como estavam.
 */
export function mergeSectorStatus(live: TowerLive | null, demo: SectorStatus[] = SECTOR_STATUS): SectorRow[] {
  const real = new Map((live?.sectors ?? []).filter((s) => s.agents.length > 0).map((s) => [s.sector, s]));
  const rows: SectorRow[] = demo.map((d) => {
    const r = real.get(d.sector);
    if (r) {
      real.delete(d.sector);
      return { sector: d.sector, source: 'live', agents: r.agents.map((a) => a.name), running: r.running, queued: r.queued, lastActivityAt: r.last_activity_at, lastResult: r.last_result, failures24h: r.failures_24h };
    }
    return { sector: d.sector, source: d.availability === 'planned' ? 'planned' : 'demo', agents: d.agents, running: 0, queued: 0, lastActivityAt: null, lastResult: null, failures24h: 0 };
  });
  // Setor que só existe no runtime (ainda sem linha de demonstração): entra no topo.
  for (const r of real.values()) rows.unshift({ sector: r.sector, source: 'live', agents: r.agents.map((a) => a.name), running: r.running, queued: r.queued, lastActivityAt: r.last_activity_at, lastResult: r.last_result, failures24h: r.failures_24h });
  // Ao vivo primeiro, depois demonstração, depois planejado (a ordem da demonstração dentro de cada grupo).
  const order = { live: 0, demo: 1, planned: 2 } as const;
  return rows.map((r, i) => ({ r, i })).sort((a, b) => order[a.r.source] - order[b.r.source] || a.i - b.i).map((x) => x.r);
}

/** Estado da ligação com o runtime, para o cabeçalho do painel. */
export type LiveState = 'off' | 'loading' | 'live' | 'unavailable';

/**
 * Busca a projeção pública. Sem URL de API configurada, nem tenta ('off'). Falha, tempo esgotado ou formato
 * inesperado viram 'unavailable' (o painel segue com a demonstração).
 */
export async function fetchTowerLive(signal?: AbortSignal, timeoutMs = 4000): Promise<{ state: LiveState; data: TowerLive | null }> {
  const base = appConfig.apiBaseUrl;
  if (!base) return { state: 'off', data: null };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  signal?.addEventListener('abort', () => ctl.abort(), { once: true });
  try {
    const res = await fetch(`${base}/v1/runtime/public/tower`, { signal: ctl.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!res.ok) return { state: 'unavailable', data: null };
    const json: unknown = await res.json();
    return isTowerLive(json) ? { state: 'live', data: json } : { state: 'unavailable', data: null };
  } catch {
    return { state: 'unavailable', data: null };
  } finally {
    clearTimeout(timer);
  }
}
