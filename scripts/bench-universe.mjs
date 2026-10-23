// Banco de prova completo do Bezalel Universe: inicialização, transferência, memória, quadros por cena,
// chamadas de desenho e recuperação de falhas, por nível de qualidade. Grava o resultado em JSON
// (bench-results/, fora do git) para comparar versões.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/bench-universe.mjs [perfil] [qualidades,separadas] [--solto]
//
// Perfis:
//   desktop  janela de 1600 × 900, processador e placa do computador (medição real neste computador)
//   redmi    tela de um Redmi Note 9S (2400 × 1080 a 2,75×, deitado, toque) e processador 4× mais lento
//            (emulação: a placa de vídeo é a do computador — não representa a Adreno 618)
// --solto: quadro sem o limite de 60 Hz (mede o custo; sem ele, mede a experiência real, com vsync).
//
// O relógio de quadros é um requestAnimationFrame próprio (cada intervalo entre quadros). A primeira
// entrada de uma sessão compila os shaders (cache frio); notebooks reduzem a frequência quando esquentam:
// para comparar duas versões, rode as duas em seguida, alternando, e mais de uma vez.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const profile = process.argv[2] ?? 'desktop';
const qualities = (process.argv[3] ?? 'low,medium,high,ultra').split(',');
const uncapped = process.argv.includes('--solto');
const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';
const PROFILES = {
  desktop: { context: { viewport: { width: 1600, height: 900 } }, cpu: 1 },
  redmi: { context: { viewport: { width: 873, height: 393 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true }, cpu: 4 },
};
const P = PROFILES[profile];
if (!P) throw new Error(`perfil desconhecido: ${profile}`);

const args = ['--ignore-gpu-blocklist', '--enable-precise-memory-info', ...(uncapped ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])];
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args });
const stats = (ds) => {
  const s = [...ds].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
  return { frames: s.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), worst: +(s[s.length - 1] ?? 0).toFixed(1), over33: s.filter((d) => d > 33.4).length, over50: s.filter((d) => d > 50).length };
};
const report = { profile, uncapped, date: new Date().toISOString(), userAgent: '', results: [] };

for (const quality of qualities) {
  const ctx = await browser.newContext(P.context);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((q) => {
    localStorage.setItem('bz-universe-help-v2', 'seen');
    localStorage.setItem('bz-universe-debug', '1');
    localStorage.setItem('bz-demo-banner-v1', 'dismissed');
    sessionStorage.setItem('bz-universe-quality', q);
    sessionStorage.setItem('bz-universe-rotate-dismissed', '1');
    const w = window;
    w.__bench = { frames: [], on: false };
    let last = 0;
    const tick = (t) => {
      if (last && w.__bench.on) w.__bench.frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, quality);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  const bytes = { page: 0, scene: 0 };
  let phase = 'page';
  cdp.on('Network.loadingFinished', (e) => (bytes[phase] += e.encodedDataLength));
  // ---- Inicialização ----
  const t0 = Date.now();
  await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
  const pageMs = Date.now() - t0;
  phase = 'scene';
  const t1 = Date.now();
  await page.getByRole('button', { name: 'Explorar em 3D' }).click();
  await page.waitForFunction(() => !!window.__bzUniverse && !!window.__bzUniverseGl, null, { timeout: 180_000 });
  const sceneMountMs = Date.now() - t1;
  await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 180_000 });
  const readyMs = Date.now() - t1;
  if (P.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  report.userAgent ||= await page.evaluate(() => navigator.userAgent);

  const info = () => page.evaluate(() => ({ ...window.__bzUniverseGl.info(), heap: performance.memory?.usedJSHeapSize ?? null }));
  const scene = async (name, run) => {
    await page.evaluate(() => {
      window.__bench.frames = [];
      window.__bench.on = true;
    });
    const before = await info();
    await run();
    const after = await info();
    const frames = await page.evaluate(() => {
      window.__bench.on = false;
      return window.__bench.frames;
    });
    return { scene: name, ...stats(frames), calls: after.calls, triangles: after.triangles, programs: after.programs, textures: after.textures, geometries: after.geometries, resolution: `${after.width}×${after.height}`, heapMB: after.heap ? +(after.heap / 2 ** 20).toFixed(1) : null, heapGrowthMB: after.heap && before.heap ? +((after.heap - before.heap) / 2 ** 20).toFixed(1) : null };
  };
  const enter = async () => {
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__bzUniverse.state().mode === 'driving', null, { timeout: 60_000 }).catch(() => {});
  };
  const leave = async () => {
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__bzUniverse.state().mode === 'foot', null, { timeout: 60_000 }).catch(() => {});
  };
  const scenes = [];
  scenes.push(await scene('parado', () => page.waitForTimeout(6000)));
  scenes.push(
    await scene('a pé (correndo e girando)', async () => {
      await page.evaluate(() => window.__bzUniverse.placeWalker(0, 88, Math.PI));
      await page.mouse.move(700, 300);
      await page.keyboard.down('Shift');
      await page.keyboard.down('w');
      for (let i = 0; i < 4; i++) {
        await page.mouse.down();
        await page.mouse.move(700 + (i % 2 ? -220 : 220), 300, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(1200);
      }
      await page.keyboard.up('w');
      await page.keyboard.up('Shift');
    }),
  );
  scenes.push(
    await scene('dirigindo', async () => {
      await page.evaluate(() => window.__bzUniverse.placeWalker(-8.6, 86, -Math.PI / 2));
      await page.waitForTimeout(800);
      await enter();
      await page.keyboard.down('w');
      await page.waitForTimeout(5000);
      await page.keyboard.down('d');
      await page.waitForTimeout(1200);
      await page.keyboard.up('d');
      await page.waitForTimeout(3000);
      await page.keyboard.up('w');
      await leave();
    }),
  );
  scenes.push(
    await scene('voando (turbo)', async () => {
      await page.evaluate(() => window.__bzUniverse.placeWalker(-2.5, 78, Math.PI / 2));
      await page.waitForTimeout(800);
      await enter();
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(2500);
      await page.keyboard.up('ArrowUp');
      await page.keyboard.down('Shift');
      await page.keyboard.down('w');
      await page.waitForTimeout(7000);
      await page.keyboard.up('w');
      await page.keyboard.up('Shift');
    }),
  );
  scenes.push(
    await scene('apresentação', async () => {
      await page.keyboard.press('c');
      await page.waitForTimeout(10000);
      await page.keyboard.press('Escape');
    }),
  );
  // ---- Recuperação: perda do contexto da placa de vídeo ----
  const recovery = { fallback2d: false, reenterMs: null, statePreserved: null };
  try {
    if (P.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const pos = await page.evaluate(() => window.__bzUniverse.state().walker);
    await page.evaluate(() => {
      const c = document.querySelector('section[data-universe-stage] canvas');
      (c.getContext('webgl2') ?? c.getContext('webgl'))?.getExtension('WEBGL_lose_context')?.loseContext();
    });
    await page.getByRole('button', { name: 'Explorar em 3D' }).waitFor({ timeout: 20_000 });
    recovery.fallback2d = true;
    const t2 = Date.now();
    await page.getByRole('button', { name: 'Explorar em 3D' }).click();
    await page.waitForFunction(() => !!window.__bzUniverseGl, null, { timeout: 180_000 });
    await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 180_000 });
    recovery.reenterMs = Date.now() - t2;
    const after = await page.evaluate(() => window.__bzUniverse.state().walker);
    recovery.statePreserved = Math.hypot(after.x - pos.x, after.z - pos.z) < 0.5;
  } catch (e) {
    recovery.error = String(e).slice(0, 200);
  }
  const r = { quality, startup: { pageMs, sceneMountMs, readyMs }, transferKB: { page: Math.round(bytes.page / 1024), scene: Math.round(bytes.scene / 1024) }, scenes, recovery, errors };
  report.results.push(r);
  console.log(`\n== ${quality} (${profile}${uncapped ? ', solto' : ''})`);
  console.log(`inicialização: página ${pageMs} ms · cena montada ${sceneMountMs} ms · pronta ${readyMs} ms · transferido: página ${r.transferKB.page} kB, 3D ${r.transferKB.scene} kB`);
  for (const s of scenes) console.log(`  ${s.scene.padEnd(26)} mediana ${s.median} ms · p95 ${s.p95} · pior ${s.worst} · >33 ms: ${s.over33}/${s.frames} · ${s.calls} chamadas · ${(s.triangles / 1e3).toFixed(0)} mil tri · ${s.textures} texturas · heap ${s.heapMB} MB (${s.heapGrowthMB >= 0 ? '+' : ''}${s.heapGrowthMB}) · ${s.resolution}`);
  console.log(`  recuperação: cai no 2D ${recovery.fallback2d ? 'sim' : 'não'} · volta ao 3D em ${recovery.reenterMs ?? '—'} ms · posição mantida ${recovery.statePreserved ?? '—'}${recovery.error ? ` · ${recovery.error}` : ''}${errors.length ? ` · erros: ${errors.join(' | ').slice(0, 200)}` : ''}`);
  await ctx.close();
}
await browser.close();
mkdirSync('bench-results', { recursive: true });
const file = `bench-results/${report.date.slice(0, 16).replace(/[:T]/g, '-')}-${profile}${uncapped ? '-solto' : ''}.json`;
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`\nresultado: ${file}`);
