// Onde está o custo do quadro no Bezalel Universe: mede a cena inteira e depois sem cada parte
// (grupos com nome), sem sombras e sem o brilho, na placa de vídeo real.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/profile-universe.mjs [qualidade] [largura×altura] [grupos,separados,por,vírgula]
//
// Mesmo protocolo do bench-universe.mjs (governador desligado, resolução travada). A diferença de
// cada linha para a primeira é o custo daquela parte. Também lista materiais em conflito de shader.
import { chromium } from '@playwright/test';

const quality = process.argv[2] ?? 'high';
const [width, height] = (process.argv[3] ?? '1920x1080').split('x').map(Number);
const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
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

const sample = async () => {
  await page.waitForTimeout(3000);
  return page.evaluate(() => ({ ...window.__bzUniverseGl.frames(), ...window.__bzUniverseGl.info() }));
};
const line = (label, r) =>
  console.log(`${label.padEnd(22)} ${r.fps.toFixed(1).padStart(5)} fps | ${r.avg.toFixed(1)} ms | cpu ${r.cpu.toFixed(1)} | gpu ${r.gpu === null ? '—' : r.gpu.toFixed(1)} | ${r.calls} chamadas | ${(r.triangles / 1000).toFixed(0)} mil tri`);

console.log(`[${quality}] ${width}×${height}`);
line('cena inteira', await sample());
const groups = process.argv[4]?.split(',') ?? ['city', 'towers', 'billboards', 'landmarks', 'traffic', 'air', 'player'];
for (const g of groups) {
  await page.evaluate((n) => window.__bzUniverseGl.setVisible(n, false), g);
  line(`sem ${g}`, await sample());
  await page.evaluate((n) => window.__bzUniverseGl.setVisible(n, true), g);
}
await page.evaluate(() => window.__bzUniverseGl.setShadows(false));
line('sem sombras', await sample());
await page.evaluate(() => window.__bzUniverseGl.setShadows(true));
console.log('conflitos de material:', await page.evaluate(() => window.__bzUniverseGl.materialConflicts()));
await browser.close();
