// Vazamento de memória do Bezalel Universe: entra no 3D e volta ao mapa 2D cinco vezes, registrando
// geometrias, texturas e programas vivos no 3D e o heap de JavaScript depois de sair (com coleta forçada).
// Contagens iguais a cada ciclo = a cena libera o que cria; heap subindo sem parar = retenção.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/leak-universe.mjs
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => { localStorage.setItem('bz-universe-help-v2', 'seen'); localStorage.setItem('bz-universe-debug', '1'); sessionStorage.setItem('bz-universe-quality', 'medium'); });
await page.goto('http://localhost:4173/site_bezalel/universe/', { waitUntil: 'networkidle' });
for (let i = 1; i <= 5; i++) {
  await page.getByRole('button', { name: 'Explorar em 3D' }).click();
  await page.waitForFunction(() => !!window.__bzUniverseGl, null, { timeout: 120000 });
  await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 120000 });
  await page.waitForTimeout(1500);
  const inside = await page.evaluate(() => { const i = window.__bzUniverseGl.info(); return { geo: i.geometries, tex: i.textures, prog: i.programs }; });
  await page.getByRole('button', { name: 'Ver o mapa (2D)' }).first().click();
  await page.getByRole('button', { name: 'Explorar em 3D' }).waitFor();
  await page.waitForTimeout(1500);
  const heap = await page.evaluate(() => { window.gc?.(); return Math.round(performance.memory.usedJSHeapSize / 2 ** 20); });
  console.log(`ciclo ${i}: no 3D ${inside.geo} geometrias · ${inside.tex} texturas · ${inside.prog} programas · heap depois de sair ${heap} MB`);
}
await browser.close();
