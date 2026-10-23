// Onde o modo Auto do Bezalel Universe se firma num aparelho modesto emulado: a tela do Redmi Note 9S
// deitado (toque), o processador N× mais lento (CDP, padrão 4×) e o governador de desempenho ligado, como
// na vida real. Imprime, a cada 5 s: o nível ativo, o ritmo (60 ou 30), a resolução e os quadros por
// segundo medidos.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/auto-quality-universe.mjs [segundos=45]
//
// A placa de vídeo não é emulada (a do computador é várias vezes mais forte que a Adreno 618). O resultado
// diz como o governador reage a um processador de celular, não quantos fps o celular real terá.
import { chromium } from '@playwright/test';

const seconds = Number(process.argv[2] ?? 45);
const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';
const RATE = Number(process.env.RATE ?? 4);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('erro na página:', e.message));
await page.addInitScript(() => {
  localStorage.setItem('bz-universe-help-v2', 'seen');
  localStorage.setItem('bz-universe-debug', '1');
  localStorage.setItem('bz-demo-banner-v1', 'dismissed');
  sessionStorage.setItem('bz-universe-rotate-dismissed', '1');
});
await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Explorar em 3D' }).click();
await page.waitForFunction(() => !!window.__bzUniverse && !!window.__bzUniverseGl, null, { timeout: 180_000 });
await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 180_000 });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
await page.evaluate(() => window.__bzUniverse.placeWalker(0, 30, Math.PI));
for (let t = 5; t <= seconds; t += 5) {
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const level = document.querySelector('[data-universe-stage]')?.getAttribute('data-quality') ?? sessionStorage.getItem('bz-universe-auto-level') ?? 'inicial (medium no celular)';
    const perf = window.__bzUniversePerf;
    const gl = window.__bzUniverseGl;
    return { level, target: perf?.target ?? 60, dpr: gl?.info().dpr, scale: gl?.info().scale, fps: gl?.frames().fps, cpu: perf?.cpuMs, frame: perf?.frameMs, late: perf?.lateShare, floor: perf?.atFloor };
  });
  console.log(`${String(t).padStart(3)} s · nível ${r.level} · ritmo ${r.target} · resolução ${(r.dpr * r.scale).toFixed(2)}× · ${r.fps?.toFixed(0)} fps · cpu ${r.cpu?.toFixed(0)} ms · quadro inteiro ${r.frame?.toFixed(0)} ms · atrasados ${((r.late ?? 0) * 100).toFixed(0)}% · piso ${r.floor}`);
}
await browser.close();
