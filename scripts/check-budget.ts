/**
 * Orçamento de tamanho (gzip) do build — falha o CI se a primeira carga
 * crescer além do combinado. Mede o que a home baixa antes de ficar
 * interativa: HTML, CSS e JS de entrada (script + modulepreload). Os chunks
 * sob demanda têm teto próprio (o laboratório 3D só baixa quando escolhido).
 *
 * Uso: node scripts/check-budget.ts   (depois de `npm run build`)
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const KB = 1024;

/** Tetos em kB comprimidos. Ajuste com justificativa no commit. */
const BUDGET = {
  html: 40, // HTML pré-renderizado da home
  css: 20,
  js: 195, // JS de entrada da home (React, roteador, home, dados do catálogo)
  lazy: { LabScene: 300, InsightsPage: 130 },
};

const gz = async (file: string) => gzipSync(await readFile(file)).length / KB;

async function main() {
  const html = await readFile(join(dist, 'index.html'), 'utf8');
  const refs = (re: RegExp) => [...html.matchAll(re)].map((m) => (m[1] ?? '').replace(/^.*\/assets\//, ''));
  const js = [...new Set([...refs(/<script[^>]+src="([^"]+\.js)"/g), ...refs(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)])];
  const css = refs(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g);

  const results: Array<[string, number, number]> = [
    ['HTML da home', gzipSync(html).length / KB, BUDGET.html],
    ['CSS de entrada', (await Promise.all(css.map((f) => gz(join(dist, 'assets', f))))).reduce((a, b) => a + b, 0), BUDGET.css],
    ['JS de entrada', (await Promise.all(js.map((f) => gz(join(dist, 'assets', f))))).reduce((a, b) => a + b, 0), BUDGET.js],
  ];
  const assets = await readdir(join(dist, 'assets'));
  for (const [name, limit] of Object.entries(BUDGET.lazy)) {
    const file = assets.find((f) => f.startsWith(`${name}-`) && f.endsWith('.js'));
    if (file) results.push([`${name} (sob demanda)`, await gz(join(dist, 'assets', file)), limit]);
  }

  let failed = false;
  for (const [label, size, limit] of results) {
    const ok = size <= limit;
    failed ||= !ok;
    console.log(`${ok ? '✓' : '✗'} ${label.padEnd(26)} ${size.toFixed(1).padStart(7)} kB / ${limit} kB`);
  }
  if (failed) {
    console.error('\nOrçamento de tamanho estourado. Reduza o peso ou ajuste o teto com justificativa.');
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
