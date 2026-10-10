/**
 * Exporta o catálogo curado, a taxonomia, as fontes e os perfis de agentes
 * para server/data/catalog.json — a semente do backend de referência.
 *
 *   npm run export:data
 *
 * Registros de demonstração NÃO são exportados: o backend nasce apenas com
 * dados reais verificados (e marca seus agentes conforme o ambiente).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { curatedCourses } from '../src/data/catalog/courses.ts';
import { curatedSources } from '../src/data/catalog/sources.ts';
import { categories, skillDefinitions } from '../src/data/catalog/taxonomy.ts';
import { demoAgents } from '../src/data/demo/agents.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'server', 'data', 'catalog.json');

const payload = {
  generatedAt: new Date().toISOString(),
  note: 'Gerado por scripts/export-data.ts a partir de src/data. Não editar à mão.',
  courses: curatedCourses,
  categories,
  skills: skillDefinitions,
  sources: curatedSources,
  agents: demoAgents,
};

await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`export-data: ${curatedCourses.length} cursos, ${skillDefinitions.length} competências → ${out}`);
