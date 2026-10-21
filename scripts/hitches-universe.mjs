// Engasgos do Bezalel Universe: o tempo de cada quadro (não a média) em cenas que o visitante vive —
// a apresentação (a câmera passa pela cidade inteira), andar, dirigir e voar —, com o Auto e a resolução
// adaptativa LIGADOS, como no site. Para cada cena: quadros > 25/50/100 ms, p99, o pior, tarefas longas
// do processador (> 50 ms) e as trocas de resolução, com o instante dos piores quadros.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/hitches-universe.mjs [qualidade|auto] [cenas,separadas,por,vírgula] [largura×altura]
//
// Sem `--disable-frame-rate-limit`: o navegador segue a taxa da tela, como para o visitante.
import { chromium } from '@playwright/test';

const quality = process.argv[2] ?? 'auto';
const scenes = (process.argv[3] ?? 'idle,cinema,walk,drive,fly').split(',');
const [width, height] = (process.argv[4] ?? '1600x900').split('x').map(Number);
const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
page.on('pageerror', (e) => console.log('erro na página:', e.message));
await page.addInitScript((q) => {
  localStorage.setItem('bz-universe-help-v2', 'seen');
  localStorage.setItem('bz-universe-debug', '1');
  localStorage.setItem('bz-demo-banner-v1', 'dismissed');
  if (q !== 'auto') sessionStorage.setItem('bz-universe-quality', q);
  // Registro de quadros e tarefas longas, desde o início.
  const w = window;
  w.__hit = { frames: [], long: [], dpr: [], mark: 0 };
  let last = 0;
  const tick = (t) => {
    if (last) w.__hit.frames.push([t, t - last]);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__hit.long.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
  } catch {
    /* sem suporte */
  }
  setInterval(() => {
    const gl = w.__bzUniverseGl;
    if (gl) {
      const i = gl.info();
      const d = w.__hit.dpr;
      const v = `${i.dpr.toFixed(2)}×${(i.scale ?? 1).toFixed(2)} ${i.width}×${i.height} p${i.programs} t${i.textures} g${i.geometries}`;
      if (d[d.length - 1]?.[1] !== v) d.push([performance.now(), v]);
    }
  }, 100);
}, quality);
await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Explorar em 3D' }).click();
await page.waitForFunction(() => !!window.__bzUniverse && !!window.__bzUniverseGl, null, { timeout: 120_000 });
await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 120_000 });
await page.waitForTimeout(1500);
console.log('nível:', await page.evaluate(() => sessionStorage.getItem('bz-universe-auto-level') ?? sessionStorage.getItem('bz-universe-quality')));

const begin = () => page.evaluate(() => (window.__hit.mark = performance.now()));
async function report(name) {
  const r = await page.evaluate(() => {
    const h = window.__hit;
    const f = h.frames.filter(([t]) => t >= h.mark).map(([t, d]) => [t - h.mark, d]);
    const ds = f.map(([, d]) => d).sort((a, b) => a - b);
    const q = (p) => ds[Math.min(ds.length - 1, Math.floor(ds.length * p))] ?? 0;
    const worst = [...f].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, d]) => `${(t / 1000).toFixed(1)}s:${d.toFixed(0)}`);
    const long = h.long.filter(([t]) => t >= h.mark).map(([t, d]) => `${((t - h.mark) / 1000).toFixed(1)}s:${d.toFixed(0)}`);
    const dpr = h.dpr.filter(([t]) => t >= h.mark).map(([t, v]) => `${((t - h.mark) / 1000).toFixed(1)}s→${v}`);
    const fr = window.__bzUniverseGl.frames();
    return { cost: `cpu ${fr.cpu.toFixed(1)} ms · desenho ${fr.render.toFixed(1)} ms · gpu ${fr.gpu === null ? '—' : fr.gpu.toFixed(1)} ms · ${window.__bzUniverseGl.info().calls} chamadas`, n: ds.length, med: q(0.5), p99: q(0.99), max: ds[ds.length - 1] ?? 0, over25: ds.filter((d) => d > 25).length, over50: ds.filter((d) => d > 50).length, over100: ds.filter((d) => d > 100).length, worst, long, dpr };
  });
  console.log(`\n[${name}] ${r.n} quadros | mediana ${r.med.toFixed(1)} ms | p99 ${r.p99.toFixed(1)} | pior ${r.max.toFixed(0)} | >25 ms: ${r.over25} | >50: ${r.over50} | >100: ${r.over100}`);
  console.log(`  custo (últimos ~2 s): ${r.cost}`);
  console.log(`  piores: ${r.worst.join('  ')}`);
  console.log(`  tarefas longas: ${r.long.length ? r.long.join('  ') : 'nenhuma'}`);
  console.log(`  resolução/programas/texturas/geometrias: ${r.dpr.length ? r.dpr.join('  ') : 'sem troca'}`);
}

const u = (fn, arg) => page.evaluate(fn, arg);
await page.mouse.move(width / 2, height / 2);
if (process.env.SHADOWS) await page.evaluate(() => (window.__shadowSeen = window.__bzUniverseGl.watchShadowVariants()));
for (const scene of scenes) {
  if (scene === 'idle') {
    await begin();
    await page.waitForTimeout(10_000);
    await report('parado no início');
  } else if (scene === 'cinema') {
    await begin();
    await page.keyboard.press('c');
    await page.waitForTimeout(68_000);
    await page.keyboard.press('Escape');
    await report('apresentação (volta completa)');
  } else if (scene === 'walk') {
    await u(() => window.__bzUniverse.placeWalker(0, 88, Math.PI));
    await begin();
    await page.keyboard.down('Shift');
    await page.keyboard.down('w');
    // Gira a câmera arrastando, enquanto corre pela avenida.
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.down();
      await page.mouse.move(width / 2 + (i % 2 ? -260 : 260), height / 2, { steps: 30 });
      await page.mouse.up();
      await page.waitForTimeout(900);
    }
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');
    await report('a pé (correndo e girando a câmera)');
  } else if (scene === 'run') {
    await u(() => window.__bzUniverse.placeWalker(0, 88, Math.PI));
    await begin();
    await page.keyboard.down('Shift');
    await page.keyboard.down('w');
    await page.waitForTimeout(12_000);
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');
    await report('a pé (correndo, sem girar a câmera)');
  } else if (scene === 'look') {
    await begin();
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.down();
      await page.mouse.move(width / 2 + (i % 2 ? -260 : 260), height / 2, { steps: 30 });
      await page.mouse.up();
      await page.waitForTimeout(900);
    }
    await report('parado, girando a câmera');
  } else if (scene === 'drive') {
    await u(() => window.__bzUniverse.placeWalker(-8.6, 86, -Math.PI / 2));
    await page.waitForTimeout(600);
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__bzUniverse.state().mode === 'driving', null, { timeout: 15_000 });
    await begin();
    await page.keyboard.down('w');
    await page.waitForTimeout(6000);
    await page.keyboard.down('d');
    await page.waitForTimeout(1200);
    await page.keyboard.up('d');
    await page.waitForTimeout(5000);
    await page.keyboard.down('a');
    await page.waitForTimeout(1200);
    await page.keyboard.up('a');
    await page.waitForTimeout(4000);
    await page.keyboard.up('w');
    await report('dirigindo o sedã');
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__bzUniverse.state().mode === 'foot', null, { timeout: 30_000 });
  } else if (scene === 'fly') {
    await u(() => window.__bzUniverse.placeWalker(-2.5, 78, Math.PI / 2));
    await page.waitForTimeout(600);
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__bzUniverse.state().mode === 'driving', null, { timeout: 15_000 });
    await begin();
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(3500);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.down('w');
    await page.keyboard.down('Shift');
    await page.waitForTimeout(9000);
    await page.keyboard.down('a');
    await page.waitForTimeout(2500);
    await page.keyboard.up('a');
    await page.waitForTimeout(5000);
    await page.keyboard.up('Shift');
    await page.keyboard.up('w');
    await report('voando no carro voador (turbo, sobre a cidade)');
  }
}
if (process.env.SHADOWS) console.log('sombras com textura:', await page.evaluate(() => window.__shadowSeen));
const progs = await page.evaluate(() => window.__bzUniverseGl.programs());
if (process.env.PROGRAMS) for (const p of progs.slice(-Number(process.env.PROGRAMS))) console.log(p);
const final = await page.evaluate(() => window.__bzUniverseGl.info());
console.log(`\nfim: ${final.programs} programas, ${final.textures} texturas, ${final.geometries} geometrias`);
await browser.close();
