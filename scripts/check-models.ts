/**
 * Confere os modelos de artistas do Universe (public/models/*.glb) contra o
 * registro (src/features/universe/assets/manifest.ts), sem dependências: lê o
 * GLB direto (cabeçalho e bloco JSON).
 *
 *   node scripts/check-models.ts
 *
 * Falha se: o registro tem problema (licença, orçamento, LODs — `validateManifest`);
 * um arquivo registrado não existe; os triângulos ou o tamanho reais passam do
 * declarado (mais de 5%) ou do orçamento; há .glb na pasta sem registro; ou o
 * arquivo não usa compressão de geometria (meshopt/Draco) ou tem textura que
 * não é KTX2 (aviso, não falha, para modelos muito pequenos).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_BUDGET, MODELS, PLACEMENTS, slotKind, validateManifest } from '../src/features/universe/assets/manifest.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'models');

interface GlbInfo {
  triangles: number;
  bytes: number;
  images: number;
  ktx2: boolean;
  compressed: boolean;
  extensions: string[];
}

export function readGlb(file: string): GlbInfo {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('não é um GLB (assinatura glTF ausente)');
  if (buf.readUInt32LE(4) !== 2) throw new Error('GLB com versão diferente de 2');
  const jsonLength = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('primeiro bloco não é JSON');
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')) as {
    meshes?: Array<{ primitives: Array<{ indices?: number; attributes: Record<string, number>; mode?: number }> }>;
    accessors?: Array<{ count: number }>;
    images?: Array<{ mimeType?: string; uri?: string }>;
    extensionsUsed?: string[];
  };
  let triangles = 0;
  for (const mesh of gltf.meshes ?? [])
    for (const p of mesh.primitives) {
      if ((p.mode ?? 4) !== 4) continue;
      const acc = p.indices !== undefined ? gltf.accessors?.[p.indices] : gltf.accessors?.[p.attributes.POSITION!];
      triangles += Math.floor((acc?.count ?? 0) / 3);
    }
  const ext = gltf.extensionsUsed ?? [];
  return {
    triangles,
    bytes: statSync(file).size,
    images: gltf.images?.length ?? 0,
    ktx2: ext.includes('KHR_texture_basisu'),
    compressed: ext.includes('EXT_meshopt_compression') || ext.includes('KHR_draco_mesh_compression'),
    extensions: ext,
  };
}

const problems = validateManifest();
const warnings: string[] = [];
const registered = new Set<string>();
for (const m of MODELS)
  m.lods.forEach((lod, i) => {
    registered.add(lod.url);
    const file = join(root, 'public', lod.url);
    if (!existsSync(file)) {
      problems.push(`${m.id}: LOD${i} não existe (${lod.url})`);
      return;
    }
    const g = readGlb(file);
    if (g.triangles > lod.triangles * 1.05) problems.push(`${m.id}: LOD${i} tem ${g.triangles} triângulos (declarado ${lod.triangles})`);
    if (g.bytes > lod.bytes * 1.05) problems.push(`${m.id}: LOD${i} tem ${(g.bytes / 1024).toFixed(0)} kB (declarado ${(lod.bytes / 1024).toFixed(0)} kB)`);
    const b = MODEL_BUDGET[slotKind(m.slot)];
    if (i === 0 && (g.triangles > b.triangles || g.bytes > b.bytes)) problems.push(`${m.id}: LOD0 acima do orçamento de ${slotKind(m.slot)}`);
    if (!g.compressed && g.bytes > 64 * 1024) warnings.push(`${m.id}: LOD${i} sem compressão de geometria (meshopt)`);
    if (g.images && !g.ktx2) warnings.push(`${m.id}: LOD${i} com texturas que não são KTX2`);
  });
if (existsSync(dir))
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb')))
    if (!registered.has(`models/${f}`)) problems.push(`public/models/${f} sem registro no manifest (licença desconhecida)`);

console.log(`modelos: ${MODELS.length} · posições: ${PLACEMENTS.length}`);
for (const w of warnings) console.log(`aviso: ${w}`);
for (const p of problems) console.log(`✗ ${p}`);
if (problems.length) process.exit(1);
console.log('✓ modelos de artistas em ordem');
