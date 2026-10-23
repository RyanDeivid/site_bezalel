// Conta o trabalho que cada quadro do Bezalel Universe pede ao WebGL: chamadas por tipo (desenhos, trocas
// de programa, envios de buffer, uniforms…). Diferente do tempo, que varia ±25% de uma rodada para outra
// conforme o que mais disputa o computador, a contagem é a mesma toda vez: mede o efeito de uma otimização
// do processador sem ruído. Cada chamada é custo de CPU no celular (o navegador a serializa para o
// processo da GPU), então menos chamadas é menos tempo por quadro, no mesmo cenário.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/gl-counts-universe.mjs [qualidade] [cena: chegada|praça]
//
// Usa a tela do Redmi Note 9S deitado (873 × 393 a 2,75×, toque), como o bench-redmi.mjs.
import { chromium } from '@playwright/test';

const quality = process.argv[2] ?? 'medium';
const scene = process.argv[3] ?? 'chegada';
const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('erro na página:', e.message));
await page.addInitScript((q) => {
  localStorage.setItem('bz-universe-help-v2', 'seen');
  localStorage.setItem('bz-universe-debug', '1');
  localStorage.setItem('bz-universe-governor', 'off');
  localStorage.setItem('bz-demo-banner-v1', 'dismissed');
  sessionStorage.setItem('bz-universe-quality', q);
  sessionStorage.setItem('bz-universe-rotate-dismissed', '1');
  // Conta as chamadas do contexto WebGL 2 do jogo.
  const counts = {};
  window.__glCounts = counts;
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const gl = orig.call(this, type, attrs);
    if (type !== 'webgl2' || !gl || gl.__counted) return gl;
    gl.__counted = true;
    const proto = Object.getPrototypeOf(gl);
    for (const k of Object.getOwnPropertyNames(proto)) {
      const d = Object.getOwnPropertyDescriptor(proto, k);
      if (!d || typeof d.value !== 'function') continue;
      const f = d.value;
      gl[k] = function (...a) {
        counts[k] = (counts[k] ?? 0) + 1;
        return f.apply(gl, a);
      };
    }
    return gl;
  };
}, quality);
await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Explorar em 3D' }).click();
await page.waitForFunction(() => !!window.__bzUniverse && !!window.__bzUniverseGl, null, { timeout: 180_000 });
await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 180_000 });
if (scene === 'chegada') await page.evaluate(() => window.__bzUniverse.placeWalker(0, 88, Math.PI));
if (scene === 'praça') await page.evaluate(() => window.__bzUniverse.placeWalker(0, 30, Math.PI));
await page.waitForTimeout(3000);
await page.evaluate(() => {
  window.__raf = 0;
  const tick = () => {
    window.__raf++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const snap = () => page.evaluate(() => ({ counts: { ...window.__glCounts }, frames: window.__raf }));
const a = await snap();
await page.waitForTimeout(4000);
const b = await snap();
const n = b.frames - a.frames;
const per = Object.entries(b.counts)
  .map(([k, v]) => [k, (v - (a.counts[k] ?? 0)) / n])
  .filter(([, v]) => v >= 0.5)
  .sort((x, y) => y[1] - x[1]);
const total = per.reduce((s, [, v]) => s + v, 0);
const draws = per.filter(([k]) => k.startsWith('draw')).reduce((s, [, v]) => s + v, 0);
console.log(`${quality} · ${scene} · ${n} quadros medidos`);
console.log(`chamadas WebGL por quadro: ${total.toFixed(0)} · desenhos: ${draws.toFixed(0)}`);
for (const [k, v] of per.slice(0, 16)) console.log(`  ${k.padEnd(26)} ${v.toFixed(1)}`);
await browser.close();
