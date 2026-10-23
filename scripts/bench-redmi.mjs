// Banco de prova do Bezalel Universe num aparelho modesto emulado: a tela de um Redmi Note 9S (2400 × 1080
// a 2,75×, deitado, toque), o processador 4× mais lento (CDP) e o quadro sem limite de 60 Hz (sem vsync),
// para medir o custo real e não a espera pela tela. A resolução adaptativa fica desligada (resolução fixa
// do nível). Para cada cena, a MEDIANA de 5 janelas de ~2,5 s — com o processador emulado, uma janela
// sozinha varia ±25%.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/bench-redmi.mjs [qualidades,separadas] [cenas,separadas]
//
// A placa de vídeo não é emulada (a do computador é várias vezes mais forte que a Adreno 618): o número
// aqui é o do processador do celular — o gargalo medido do Universe. Não substitui um teste no aparelho.
import { chromium } from '@playwright/test';

const qualities = (process.argv[2] ?? 'low,medium,ultra').split(',');
const scenes = (process.argv[3] ?? 'chegada,praça,dirigindo').split(',');
const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';
const RATE = Number(process.env.RATE ?? 4);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const q of qualities) {
  const ctx = await browser.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('erro:', e.message));
  await page.addInitScript((q) => {
    localStorage.setItem('bz-universe-help-v2', 'seen');
    localStorage.setItem('bz-universe-debug', '1');
    localStorage.setItem('bz-universe-governor', 'off');
    localStorage.setItem('bz-demo-banner-v1', 'dismissed');
    sessionStorage.setItem('bz-universe-quality', q);
    sessionStorage.setItem('bz-universe-rotate-dismissed', '1');
  }, q);
  await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Explorar em 3D' }).click();
  await page.waitForFunction(() => !!window.__bzUniverse && !!window.__bzUniverseGl, null, { timeout: 180_000 });
  await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 180_000 });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  for (const scene of scenes) {
    if (scene === 'praça') await page.evaluate(() => window.__bzUniverse.placeWalker(0, 30, Math.PI));
    if (scene === 'chegada') await page.evaluate(() => window.__bzUniverse.placeWalker(0, 88, Math.PI));
    if (scene === 'dirigindo') {
      await page.evaluate(() => window.__bzUniverse.placeWalker(-8.6, 86, -Math.PI / 2));
      await page.waitForTimeout(1500);
      await page.keyboard.press('e');
      await page.waitForFunction(() => window.__bzUniverse.state().mode === 'driving', null, { timeout: 60_000 }).catch(() => {});
      await page.keyboard.down('w');
    }
    await page.waitForTimeout(2500);
    const runs = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(2500);
      runs.push(await page.evaluate(() => ({ f: window.__bzUniverseGl.frames(), i: window.__bzUniverseGl.info() })));
    }
    const ms = median(runs.map((r) => r.f.avg));
    const r = runs[2];
    console.log(`${q.padEnd(6)} ${scene.padEnd(10)} ${ms.toFixed(1)} ms/quadro (${(1000 / ms).toFixed(0)} fps) · ${median(runs.map((r) => r.i.calls))} chamadas · ${(median(runs.map((r) => r.i.triangles)) / 1e3).toFixed(0)} mil triângulos · ${r.i.width}×${r.i.height}`);
    if (scene === 'dirigindo') await page.keyboard.up('w');
  }
  await ctx.close();
}
await browser.close();
