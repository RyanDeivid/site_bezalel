// Nível do som do Bezalel Universe a pé, parado na praça: a média (RMS) da saída e a variação dela ao
// longo de ~20 s. Serve para comparar versões (mais alto ou mais baixo, mais parado ou mais vivo) sem
// depender de ouvido. Não diz se o som é agradável: isso pede escuta.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/audio-level-universe.mjs
import { chromium } from '@playwright/test';

const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => {
  localStorage.setItem('bz-universe-help-v2', 'seen');
  localStorage.setItem('bz-universe-debug', '1');
  localStorage.setItem('bz-demo-banner-v1', 'dismissed');
  sessionStorage.setItem('bz-universe-quality', 'low');
});
await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Explorar em 3D' }).click();
await page.waitForFunction(() => !!window.__bzUniverseAudio && !!window.__bzUniverse, null, { timeout: 120_000 });
await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 120_000 });
await page.mouse.click(640, 400);
await page.evaluate(() => window.__bzUniverse.placeWalker(0, 30, Math.PI));
await page.waitForTimeout(4000);
const samples = await page.evaluate(async () => {
  const out = [];
  for (let i = 0; i < 80; i++) {
    out.push(window.__bzUniverseAudio.rms());
    await new Promise((r) => setTimeout(r, 250));
  }
  return out;
});
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
const db = (x) => (20 * Math.log10(Math.max(x, 1e-6))).toFixed(1);
console.log(`a pé, parado: RMS médio ${mean.toFixed(4)} (${db(mean)} dBFS) · variação (desvio/média) ${((sd / mean) * 100).toFixed(0)}% · mín ${db(Math.min(...samples))} · máx ${db(Math.max(...samples))} dBFS`);
await browser.close();
