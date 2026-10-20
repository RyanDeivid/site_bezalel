// Mede o desempenho do Bezalel Universe por nível de qualidade, na placa de vídeo real.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/bench-universe.mjs [low,medium,high,ultra] [largura×altura]
//
// Protocolo: um navegador só (depois da 1ª entrada o cache de shaders fica quente), sem
// limite de quadros, resolução e nível travados (`bz-universe-governor = off`); para cada
// nível, entra no 3D, espera 4 s e mede 3 janelas de 3 s pela sonda de testes
// (`window.__bzUniverseGl`). Reporta a mediana. Notebooks reduzem a frequência quando
// esquentam: para comparar duas versões, rode as duas em seguida, alternando.
import { chromium } from '@playwright/test';

const qualities = (process.argv[2] ?? 'low,medium,high,ultra').split(',');
const [width, height] = (process.argv[3] ?? '1920x1080').split('x').map(Number);
const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width, height } });
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function measure(quality) {
  const page = await context.newPage();
  await page.addInitScript((q) => {
    localStorage.setItem('bz-universe-help-v2', 'seen');
    localStorage.setItem('bz-universe-debug', '1');
    localStorage.setItem('bz-universe-governor', 'off');
    localStorage.setItem('bz-demo-banner-v1', 'dismissed');
    sessionStorage.setItem('bz-universe-quality', q);
  }, quality);
  await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Explorar em 3D' }).click();
  await page.waitForFunction(() => !!window.__bzUniverseGl, null, { timeout: 120_000 });
  await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 120_000 });
  await page.waitForTimeout(4000);
  const runs = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(3000);
    runs.push(await page.evaluate(() => ({ ...window.__bzUniverseGl.frames(), ...window.__bzUniverseGl.info() })));
  }
  await page.close();
  return runs;
}

await measure('low'); // aquece o cache de shaders
for (const q of qualities) {
  const runs = await measure(q);
  const r = runs.at(-1);
  console.log(
    `[${q}] ${median(runs.map((x) => x.fps)).toFixed(1)} fps | p95 ${median(runs.map((x) => x.p95)).toFixed(1)} ms | cpu ${median(runs.map((x) => x.cpu)).toFixed(1)} ms | ${r.calls} chamadas, ${(r.triangles / 1000).toFixed(0)} mil triângulos | ${r.width}×${r.height}`,
  );
}
await browser.close();
