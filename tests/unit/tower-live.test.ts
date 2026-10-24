import { describe, expect, it } from 'vitest';
import { SECTOR_STATUS } from '@/features/universe/world/tower';
import { fetchTowerLive, isTowerLive, mergeSectorStatus, type TowerLive } from '@/features/universe/world/towerLive';

const live = (over: Partial<TowerLive['sectors'][number]> = {}): TowerLive => ({
  source: 'runtime',
  computed_at: '2026-10-24T03:00:00.000Z',
  sectors: [{ sector: 'engineering', agents: [{ id: 'site-intelligence', name: 'Site Intelligence Agent', version: 2 }], running: 0, queued: 1, last_activity_at: '2026-10-24T02:15:09.313Z', last_result: { state: 'succeeded', finished_at: '2026-10-24T02:15:09.313Z' }, failures_24h: 0, ...over }],
});

describe('Torre: estado dos setores ao vivo (runtime) e demonstração', () => {
  it('sem runtime, o painel é exatamente a demonstração, marcada (nenhuma linha "ao vivo")', () => {
    const rows = mergeSectorStatus(null);
    expect(rows.every((r) => r.source !== 'live')).toBe(true);
    expect(rows.map((r) => r.sector).sort()).toEqual(SECTOR_STATUS.map((s) => s.sector).sort());
    expect(rows.filter((r) => r.source === 'demo').map((r) => r.sector)).toEqual(SECTOR_STATUS.filter((s) => s.availability === 'demo').map((s) => s.sector));
  });

  it('com runtime, o setor com agentes registrados vira "ao vivo" com os números reais, no topo; os demais seguem como eram', () => {
    const rows = mergeSectorStatus(live());
    expect(rows[0]).toMatchObject({ sector: 'engineering', source: 'live', agents: ['Site Intelligence Agent'], queued: 1, lastResult: { state: 'succeeded' } });
    expect(rows.filter((r) => r.source === 'live')).toHaveLength(1);
    expect(rows.find((r) => r.sector === 'intelligence')).toMatchObject({ source: 'demo', agents: ['Scout', 'Verifier', 'Vigia'] });
    expect(rows.find((r) => r.sector === 'legal')?.source).toBe('planned');
  });

  it('setor do runtime sem agentes não vira "ao vivo" (registro vazio não é evidência)', () => {
    const rows = mergeSectorStatus(live({ agents: [] }));
    expect(rows.find((r) => r.sector === 'engineering')?.source).toBe('demo');
  });

  it('a resposta da API é não confiável: formato errado, setor desconhecido ou números absurdos são recusados', () => {
    expect(isTowerLive(live())).toBe(true);
    expect(isTowerLive({ ...live(), source: 'demo' })).toBe(false);
    expect(isTowerLive({ ...live(), sectors: [{ ...live().sectors[0], sector: 'hackers' }] })).toBe(false);
    expect(isTowerLive({ ...live(), sectors: [{ ...live().sectors[0], running: -1 }] })).toBe(false);
    expect(isTowerLive({ ...live(), sectors: [{ ...live().sectors[0], last_result: { state: 'hacked', finished_at: null } }] })).toBe(false);
    expect(isTowerLive({ ...live(), sectors: [{ ...live().sectors[0], agents: [{ id: 'x'.repeat(500), name: 'n', version: 1 }] }] })).toBe(false);
    expect(isTowerLive(null)).toBe(false);
  });

  it('sem URL de API configurada, nem tenta buscar ("off")', async () => {
    expect(await fetchTowerLive()).toEqual({ state: 'off', data: null });
  });
});
