/**
 * Registro dos modelos feitos por artistas (glTF/GLB) que o Universe usa.
 *
 * O Universe nasce procedural, e continua sendo: cada modelo daqui **substitui
 * uma peça procedural** num encaixe (`slot`) — um marco, um veículo, um
 * personagem — ou **acrescenta** um objeto posicionado no mundo (`PLACEMENTS`).
 * Sem entrada aqui, nada muda: a peça procedural fica. Com entrada, ela fica no
 * lugar até o modelo chegar (e para sempre, se o carregamento falhar): nunca há
 * buraco nem tela de espera.
 *
 * Regras (verificadas por `validateManifest` e por `scripts/check-models.mjs`):
 * - **licença obrigatória**: origem, autor, licença e prova (link ou arquivo).
 *   Só entram CC0, CC-BY (com crédito), modelos próprios ou comerciais com
 *   direito de redistribuição na web;
 * - **orçamento** por tipo de encaixe (download e triângulos do nível 0);
 * - arquivos em `public/models/` (GLB com meshopt e texturas KTX2), escala em
 *   metros, Y para cima, frente em +Z, origem no chão — ver
 *   `docs/BLENDER-PIPELINE.md`.
 */

import modelsJson from './models.json' with { type: 'json' };
import placementsJson from './placements.json' with { type: 'json' };

/** Onde o modelo entra. O prefixo diz o tipo (e o orçamento). */
export type ModelSlot =
  | `landmark:${'bezalel-hq' | 'ai-lab' | 'products-center' | 'monument'}`
  | `vehicle:${'sedan' | 'sport' | 'taxi' | 'hover'}`
  | `character:${string}`
  | `prop:${string}`;

export type SlotKind = 'landmark' | 'vehicle' | 'character' | 'prop';
export const slotKind = (slot: ModelSlot) => slot.split(':')[0] as SlotKind;

export interface ModelLicense {
  /** Ex.: "CC0-1.0", "CC-BY-4.0", "próprio", "comercial (contrato X)". */
  license: string;
  author: string;
  /** Onde foi obtido (página do autor/loja) ou "encomendado". */
  source: string;
  /** Link ou caminho do comprovante (termos, nota fiscal, e-mail do autor). */
  proof: string;
  /** Texto de crédito exigido pela licença (CC-BY). */
  credit?: string;
}

export interface ModelEntry {
  id: string;
  slot: ModelSlot;
  /** Níveis de detalhe, do mais detalhado ao mais leve, cada um até `upTo` metros da câmera. */
  lods: Array<{ url: string; upTo: number; triangles: number; bytes: number }>;
  /** Escala aplicada ao modelo (o padrão é 1: o arquivo já vem em metros). */
  scale?: number;
  /** Deslocamento e giro em relação ao ponto do encaixe (metros, radianos). */
  offset?: [number, number, number];
  rotationY?: number;
  /** Projeta e recebe sombra. */
  shadows?: boolean;
  license: ModelLicense;
}

/** Um objeto acrescentado ao mundo (criado no Blender e exportado por `export_placements.py`). */
export interface Placement {
  model: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale?: number;
  /** Caixa de colisão no chão (opcional): meia largura em x e z e altura. */
  solid?: { hx: number; hz: number; h: number };
}

/** Orçamento por tipo de encaixe (o nível 0, o mais detalhado). */
export const MODEL_BUDGET: Record<SlotKind, { bytes: number; triangles: number }> = {
  landmark: { bytes: 1.5 * 2 ** 20, triangles: 150_000 },
  vehicle: { bytes: 400 * 1024, triangles: 60_000 },
  character: { bytes: 600 * 1024, triangles: 25_000 },
  prop: { bytes: 250 * 1024, triangles: 15_000 },
};

/** Licenças aceitas sem análise caso a caso. */
const OPEN_LICENSES = /^(CC0|CC-BY|próprio|proprio|own|comercial)/i;

/**
 * Modelos registrados (`models.json`) e objetos posicionados (`placements.json`). Em JSON para o Blender
 * escrever direto (`art/blender/export_universe.py`, rodado à mão ou pelo MCP do Blender). Vazios: o
 * Universe é 100% procedural até o primeiro modelo entrar.
 */
export const MODELS = modelsJson as ModelEntry[];
export const PLACEMENTS = placementsJson as Placement[];

/** Problemas de um registro (vazio = ok). Roda nos testes e no `check-models.mjs`. */
export function validateManifest(models: ModelEntry[] = MODELS, placements: Placement[] = PLACEMENTS): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const slots = new Set<string>();
  for (const m of models) {
    if (ids.has(m.id)) out.push(`${m.id}: id repetido`);
    ids.add(m.id);
    if (!m.slot.startsWith('prop:') && slots.has(m.slot)) out.push(`${m.id}: o encaixe ${m.slot} já tem um modelo`);
    slots.add(m.slot);
    const l = m.license;
    if (!l || !l.license || !l.author || !l.source || !l.proof) out.push(`${m.id}: licença incompleta (licença, autor, origem e prova são obrigatórios)`);
    else if (!OPEN_LICENSES.test(l.license)) out.push(`${m.id}: licença "${l.license}" exige análise antes de entrar`);
    if (l?.license && /CC-BY/i.test(l.license) && !l.credit) out.push(`${m.id}: CC-BY exige o texto de crédito`);
    if (!m.lods.length) out.push(`${m.id}: nenhum nível de detalhe`);
    m.lods.forEach((lod, i) => {
      if (!/^models\/[\w./-]+\.glb$/.test(lod.url)) out.push(`${m.id}: LOD${i} fora de public/models/ ou não é .glb (${lod.url})`);
      if (i > 0 && lod.upTo <= m.lods[i - 1]!.upTo) out.push(`${m.id}: LOD${i} precisa valer para mais longe que o LOD${i - 1}`);
    });
    const b = MODEL_BUDGET[slotKind(m.slot)];
    const l0 = m.lods[0];
    if (l0 && l0.bytes > b.bytes) out.push(`${m.id}: LOD0 com ${(l0.bytes / 1024).toFixed(0)} kB (teto ${(b.bytes / 1024).toFixed(0)} kB)`);
    if (l0 && l0.triangles > b.triangles) out.push(`${m.id}: LOD0 com ${l0.triangles} triângulos (teto ${b.triangles})`);
  }
  for (const p of placements) if (!ids.has(p.model)) out.push(`posição com modelo desconhecido: ${p.model}`);
  return out;
}

export const modelForSlot = (slot: ModelSlot, models: ModelEntry[] = MODELS) => models.find((m) => m.slot === slot) ?? null;
export const modelById = (id: string, models: ModelEntry[] = MODELS) => models.find((m) => m.id === id) ?? null;

/** Sólidos de colisão dos objetos posicionados (caixas no chão, alinhadas aos eixos). */
export function placementSolids(placements: Placement[] = PLACEMENTS) {
  return placements.flatMap((p) => (p.solid ? [{ minX: p.x - p.solid.hx, maxX: p.x + p.solid.hx, minZ: p.z - p.solid.hz, maxZ: p.z + p.solid.hz, height: p.y + p.solid.h, base: p.y }] : []));
}
