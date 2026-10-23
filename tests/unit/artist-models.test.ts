import { describe, expect, it } from 'vitest';
import { MODELS, PLACEMENTS, placementSolids, validateManifest, type ModelEntry } from '@/features/universe/assets/manifest';

const ok: ModelEntry = {
  id: 'banco',
  slot: 'prop:banco',
  lods: [
    { url: 'models/banco_lod0.glb', upTo: 25, triangles: 1200, bytes: 40_000 },
    { url: 'models/banco_lod1.glb', upTo: 80, triangles: 300, bytes: 12_000 },
  ],
  license: { license: 'CC0-1.0', author: 'Fulano', source: 'https://polyhaven.com/a/banco', proof: 'https://polyhaven.com/license' },
};

describe('Universe: registro de modelos de artistas', () => {
  it('o registro publicado está em ordem (vazio até o primeiro modelo entrar)', () => {
    expect(validateManifest()).toEqual([]);
    expect(MODELS.length + PLACEMENTS.length).toBeGreaterThanOrEqual(0);
  });

  it('aceita um modelo com licença aberta, LODs em ordem e dentro do orçamento', () => {
    expect(validateManifest([ok], [{ model: 'banco', x: 1, y: 0.3, z: 2, rotationY: 0 }])).toEqual([]);
  });

  it('recusa sem licença completa, licença que exige análise, CC-BY sem crédito', () => {
    expect(validateManifest([{ ...ok, license: { ...ok.license, proof: '' } }], []).join()).toMatch(/licença incompleta/);
    expect(validateManifest([{ ...ok, license: { ...ok.license, license: 'Editorial use only' } }], []).join()).toMatch(/exige análise/);
    expect(validateManifest([{ ...ok, license: { ...ok.license, license: 'CC-BY-4.0' } }], []).join()).toMatch(/crédito/);
  });

  it('recusa acima do orçamento, LODs fora de ordem, arquivo fora de public/models e encaixe repetido', () => {
    expect(validateManifest([{ ...ok, lods: [{ ...ok.lods[0]!, triangles: 90_000 }] }], []).join()).toMatch(/teto 15000/);
    expect(validateManifest([{ ...ok, lods: [ok.lods[1]!, ok.lods[0]!] }], []).join()).toMatch(/mais longe/);
    expect(validateManifest([{ ...ok, lods: [{ ...ok.lods[0]!, url: 'https://x.com/a.glb' }] }], []).join()).toMatch(/fora de public\/models/);
    const hq = { ...ok, slot: 'landmark:bezalel-hq' as const };
    expect(validateManifest([hq, { ...hq, id: 'outra' }], []).join()).toMatch(/já tem um modelo/);
  });

  it('posição com modelo desconhecido é recusada; caixa de colisão vira sólido no chão', () => {
    expect(validateManifest([ok], [{ model: 'nada', x: 0, y: 0, z: 0, rotationY: 0 }]).join()).toMatch(/desconhecido/);
    expect(placementSolids([{ model: 'banco', x: 10, y: 0.36, z: 20, rotationY: 0, solid: { hx: 0.9, hz: 0.3, h: 0.9 } }])).toEqual([{ minX: 9.1, maxX: 10.9, minZ: 19.7, maxZ: 20.3, height: 1.26, base: 0.36 }]);
  });
});
