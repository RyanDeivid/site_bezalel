// Banco de prova do Bezalel Universe num aparelho modesto emulado: a tela de um Redmi Note 9S
// (2400 × 1080 a 2,75×, deitado, toque) e o processador 4× mais lento (CDP). A placa de vídeo não se
// emula: o tempo de GPU medido aqui (Iris Xe) é convertido para a Adreno 618 pela razão de vazão
// (~3,5×) — uma estimativa, não uma medição no aparelho.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/bench-device.mjs [qualidades,separadas] [redmi|desktop] [partes]
//
// Com a resolução adaptativa DESLIGADA (resolução fixa no início do nível), para comparar níveis.
// `partes`: mede também o custo de cada grupo da cena (escondendo um por vez).
import { chromium } from '@playwright/test';

const qualities = (process.argv[2] ?? 'low,medium,high,ultra').split(',');
const device = process.argv[3] ?? 'redmi';
const parts = process.argv[4] === 'partes';
const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';
const GPU_RATIO = 3.5;
const CPU_RATE = 4;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--ignore-gpu-blocklist'] });
const rows = [];
for (const q of qualities) {
  const ctx = await browser.newContext(
    device === 'redmi' ? { viewport: { width: 873, height: 393 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true } : { viewport: { width: 1600, height: 900 } },
  );
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
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Explorar em 3D' }).click();
  await page.waitForFunction(() => !!window.__bzUniverse && !!window.__bzUniverseGl, null, { timeout: 180_000 });
  await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 180_000 });
  if (device === 'redmi' && !process.env.NO_THROTTLE) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
  const measure = async (label) => {
    await page.waitForTimeout(3500);
    const r = await page.evaluate(() => ({ f: window.__bzUniverseGl.frames(), i: window.__bzUniverseGl.info() }));
    rows.push({ q, label, ...r });
    const gpu = r.f.gpu === null ? '—' : `${r.f.gpu.toFixed(1)} ms (≈ ${(r.f.gpu * GPU_RATIO).toFixed(0)} ms na Adreno 618)`;
    console.log(`${q.padEnd(6)} ${label.padEnd(10)} cpu ${r.f.cpu.toFixed(1)} · desenho ${r.f.render.toFixed(1)} · gpu ${gpu} · ${r.i.calls} chamadas · ${(r.i.triangles / 1e3).toFixed(0)} mil triângulos · ${r.i.width}×${r.i.height}`);
    return r;
  };
  await measure('chegada');
  await page.evaluate(() => window.__bzUniverse.placeWalker(0, 30, Math.PI));
  await measure('praça');
  await page.evaluate(() => window.__bzUniverse.placeWalker(-8.6, 86, -Math.PI / 2));
  await page.waitForTimeout(800);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__bzUniverse.state().mode === 'driving', null, { timeout: 30_000 }).catch(() => {});
  await page.keyboard.down('w');
  await measure('dirigindo');
  if (parts) {
    // Câmera parada (a pé, na chegada, de frente para a cidade): o custo de cada grupo é a diferença
    // entre a cena inteira e a cena sem ele, medidas em seguida, com o mesmo enquadramento.
    await page.keyboard.up('w');
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__bzUniverse.state().mode === 'foot', null, { timeout: 30_000 }).catch(() => {});
    await page.evaluate(() => window.__bzUniverse.placeWalker(0, 88, Math.PI));
    const names = await page.evaluate(() => window.__bzUniverseGl.scene().children.flatMap((c) => (c.name ? [c.name] : c.children.filter((g) => g.name).map((g) => g.name))));
    const toggles = [...names.map((n) => ({ n, off: (n) => window.__bzUniverseGl.setVisible(n, false), on: (n) => window.__bzUniverseGl.setVisible(n, true) })), { n: 'sombras', off: () => window.__bzUniverseGl.setShadows(false), on: () => window.__bzUniverseGl.setShadows(true) }];
    for (const { n, off, on } of toggles) {
      await page.waitForTimeout(2600);
      const a = await page.evaluate(() => ({ f: window.__bzUniverseGl.frames(), i: window.__bzUniverseGl.info() }));
      await page.evaluate(`(${off.toString()})(${JSON.stringify(n)})`);
      await page.waitForTimeout(2600);
      const b = await page.evaluate(() => ({ f: window.__bzUniverseGl.frames(), i: window.__bzUniverseGl.info() }));
      await page.evaluate(`(${on.toString()})(${JSON.stringify(n)})`);
      console.log(`   ${n.padEnd(22)} desenho ${(a.f.render - b.f.render).toFixed(1)} ms · gpu ${((a.f.gpu ?? 0) - (b.f.gpu ?? 0)).toFixed(1)} ms · ${a.i.calls - b.i.calls} chamadas · ${((a.i.triangles - b.i.triangles) / 1e3).toFixed(0)} mil tri`);
    }
  }
  await ctx.close();
}
await browser.close();
