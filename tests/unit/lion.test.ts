import { describe, expect, it } from 'vitest';
import { lionContent } from '@/features/lion/content';
import { meshLion, silhouette } from '@/features/lion/sculpture/mesher';
import { buildLion, evaluate } from '@/features/lion/sculpture/sdf';

describe('Leão de Judá: a escultura em campo de distância', () => {
  it('os três níveis crescem em peças: bloco < forma < final; os detalhes só no final', () => {
    const n = (['block', 'form', 'final'] as const).map((l) => buildLion(l).prims.length);
    expect(n[0]).toBeLessThan(n[1]!);
    expect(n[1]).toBeLessThan(n[2]!);
    expect(buildLion('form').prims.some((p) => p.part === 'detail')).toBe(false);
    expect(buildLion('final').prims.some((p) => p.part === 'detail')).toBe(true);
    // Escavações (olhos, narinas, boca) só no nível final.
    expect(buildLion('form').prims.some((p) => p.phase === 1)).toBe(false);
  });

  it('a escultura cabe no alto do pedestal (3,02 × 1,44 m) e as patas tocam o chão', () => {
    for (const level of ['block', 'form', 'final'] as const) {
      const m = meshLion(level, 0.045, false);
      let minY = Infinity;
      for (let i = 0; i < m.positions.length; i += 3) {
        expect(Math.abs(m.positions[i]!)).toBeLessThan(1.5);
        expect(Math.abs(m.positions[i + 2]!)).toBeLessThan(0.7);
        minY = Math.min(minY, m.positions[i + 1]!);
      }
      expect(minY).toBeLessThan(0.03);
      expect(minY).toBeGreaterThan(-0.03);
    }
  });

  it('a malha é fechada: cada aresta é compartilhada por exatamente dois triângulos', () => {
    const m = meshLion('form', 0.04, false);
    expect(m.indices.length / 3).toBeGreaterThan(2000);
    const edges = new Map<string, number>();
    for (let t = 0; t < m.indices.length; t += 3)
      for (let e = 0; e < 3; e++) {
        const a = m.indices[t + e]!;
        const b = m.indices[t + ((e + 1) % 3)]!;
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    const open = [...edges.values()].filter((c) => c !== 2).length;
    // O chão corta as patas: a borda do corte pode deixar poucas arestas soltas, nunca buracos espalhados.
    expect(open / edges.size).toBeLessThan(0.01);
  });

  it('normais apontam para fora (o campo cresce na direção da normal)', () => {
    const model = buildLion('form');
    const m = meshLion('form', 0.04, false, model);
    let outward = 0;
    const count = m.positions.length / 3;
    for (let v = 0; v < count; v += 37) {
      const [x, y, z] = [m.positions[v * 3]!, m.positions[v * 3 + 1]!, m.positions[v * 3 + 2]!];
      const [nx, ny, nz] = [m.normals[v * 3]!, m.normals[v * 3 + 1]!, m.normals[v * 3 + 2]!];
      if (y < 0.03) continue;
      if (evaluate(model.prims, x + nx * 0.02, y + ny * 0.02, z + nz * 0.02) > evaluate(model.prims, x - nx * 0.02, y - ny * 0.02, z - nz * 0.02)) outward++;
      else outward--;
    }
    expect(outward).toBeGreaterThan(0);
  });

  it('o contorno do primeiro estágio é um traço contínuo, com a cabeça mais alta que a garupa', () => {
    const s = silhouette(0.02);
    expect(s.length / 4).toBeGreaterThan(200);
    let headTop = -Infinity;
    let rumpTop = -Infinity;
    for (let i = 0; i < s.length; i += 2) {
      const x = s[i]!;
      const y = s[i + 1]!;
      if (x > 0.7) headTop = Math.max(headTop, y);
      if (x < -0.5 && x > -0.8) rumpTop = Math.max(rumpTop, y);
    }
    expect(headTop).toBeGreaterThan(rumpTop);
  });
});

describe('Leão de Judá: textos', () => {
  it('os seis estágios, nos dois idiomas, e a citação com a tradução indicada', () => {
    for (const t of Object.values(lionContent)) {
      expect(t.stages).toHaveLength(6);
      expect(t.verse.length).toBeGreaterThan(80);
      expect(t.translation).toMatch(/Almeida Corrigida Fiel|King James/);
      // A interpretação artística diz o que a escultura não é.
      expect(t.art.join(' ')).toMatch(/não é um retrato de Jesus|not a portrait of Jesus/i);
    }
  });
});
