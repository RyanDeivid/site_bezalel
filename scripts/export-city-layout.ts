/**
 * Exporta o desenho real da cidade do Universe para o Blender (e para quem
 * usar o Blender pelo MCP): ruas, quadras, sólidos de cada prédio (torres,
 * marcos, telões, passarelas), locais e as posições já registradas. O script
 * `art/blender/import_city_layout.py` monta isso no Blender como referência —
 * o artista (ou o agente) modela por cima da cidade de verdade, na escala e na
 * posição certas.
 *
 *   node scripts/export-city-layout.ts          → art/city-layout.json
 *
 * Coordenadas do Universe: metros, x para o leste, z para o sul, y para cima
 * (o chão das quadras em y = 0,3). O importador converte para o Blender (Z para cima).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLACEMENTS } from '../src/features/universe/assets/manifest.ts';
import { BILLBOARDS, BLOCKS, blockBounds, BUILDINGS, citySolids, GROUND, MONUMENT, PLACES, PLAZA_RADIUS, ROAD_WIDTH, SIDEWALK, STREET_LINES, WORLD_HALF } from '../src/features/universe/world/city.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const blocks = [];
for (let bx = 0; bx < BLOCKS; bx++) for (let bz = 0; bz < BLOCKS; bz++) blocks.push({ bx, bz, ...blockBounds(bx, bz) });
const layout = {
  version: 1,
  units: 'metros',
  axes: 'universe: x leste, y cima, z sul',
  ground: GROUND,
  worldHalf: WORLD_HALF,
  streets: { lines: STREET_LINES, width: ROAD_WIDTH, sidewalk: SIDEWALK },
  plaza: { x: 0, z: 0, radius: PLAZA_RADIUS },
  monument: MONUMENT,
  blocks,
  buildings: BUILDINGS.map((b) => ({ id: b.id, solids: b.solids })),
  billboards: BILLBOARDS,
  places: PLACES,
  // Todos os volumes de colisão (a cidade "cheia", a mesma das qualidades com conteúdo do Ultra).
  solids: citySolids('ultra'),
  placements: PLACEMENTS,
};
mkdirSync(join(root, 'art'), { recursive: true });
const out = join(root, 'art', 'city-layout.json');
writeFileSync(out, JSON.stringify(layout, null, 1));
console.log(`cidade exportada: ${layout.solids.length} sólidos, ${blocks.length} quadras, ${PLACES.length} locais → ${out}`);
