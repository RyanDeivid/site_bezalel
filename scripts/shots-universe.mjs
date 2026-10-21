// Capturas do Bezalel Universe sempre dos mesmos ângulos (para comparar antes e depois).
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/shots-universe.mjs <pasta> [qualidade] [vistas,separadas,por,vírgula]
//
// Usa a câmera fixa do gancho de testes (`__bzUniverse.shot`) e a resolução travada.
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? '.';
const quality = process.argv[3] ?? 'high';
const only = process.argv[4]?.split(',');
const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';

/** Vistas: câmera (x, y, z) olhando para (tx, ty, tz); `setup` posiciona carros e o jogador antes. */
const VIEWS = {
  overview: { cam: [95, 95, 175], at: [0, 12, -30], fov: 50 },
  avenue: { cam: [3, 1.7, 64], at: [0, 9, -60], fov: 55, walker: [3, 62] },
  plaza: { cam: [-22, 6, 30], at: [0, 6, -10], fov: 55 },
  hq: { cam: [14, 3, -42], at: [0, 22, -78], fov: 60 },
  lab: { cam: [46, 4, 16], at: [80, 10, 0], fov: 55 },
  products: { cam: [-44, 4, -16], at: [-80, 12, 0], fov: 55 },
  'car-side': { cam: [-5.2, 1.3, 86], at: [-11, 0.9, 86], fov: 45, cars: [['aurora', -11, 86, Math.PI]] },
  'car-front': { cam: [-14.5, 1.5, 79.5], at: [-11, 0.8, 86], fov: 45, cars: [['aurora', -11, 86, Math.PI]] },
  'car-rear': { cam: [-7, 1.5, 92.5], at: [-11, 0.8, 86], fov: 45, cars: [['aurora', -11, 86, Math.PI]] },
  'car-top': { cam: [-9, 9.5, 89], at: [-11, 0.5, 86], fov: 45, cars: [['aurora', -11, 86, Math.PI]] },
  'sport-side': { cam: [16.8, 1.2, 86], at: [11, 0.7, 86], fov: 45, cars: [['vento', 11, 86, Math.PI]] },
  'sport-front': { cam: [7.5, 1.4, 79.5], at: [11, 0.7, 86], fov: 45, cars: [['vento', 11, 86, Math.PI]] },
  'taxi-side': { cam: [-15.2, 1.4, 86], at: [-21, 1, 86], fov: 45, cars: [['taxi-1', -21, 86, Math.PI]] },
  'taxi-front': { cam: [-24.5, 1.6, 79.5], at: [-21, 1, 86], fov: 45, cars: [['taxi-1', -21, 86, Math.PI]] },
  air: { cam: [6, 22, 52], at: [0, 40, -40], fov: 55 },
  'air-close': { cam: [-46, 31, 40], at: [-40, 30, 20], fov: 50 },
  traffic: { cam: [44, 2.2, 52], at: [37, 1, 20], fov: 50 },
  sidewalk: { cam: [-28, 2.2, 52], at: [-10, 1.2, 40], fov: 55 },
  'plaza-people': { cam: [24, 2.4, 18], at: [0, 2, 0], fov: 55 },
  'night-drive': { cam: [37, 3, 60], at: [37, 0.5, 30], fov: 55 },
  searchlights: { cam: [30, 8, 40], at: [0, 90, -82], fov: 60 },
  arrival: { cam: [-30, 4.5, 96], at: [-14, 0.8, 85], fov: 55 },
  crosswalk: { cam: [40, 9, 52], at: [40, 0, 40], fov: 60 },
  midtown: { cam: [-42, 16, 42], at: [-75, 18, 75], fov: 55 },
  'midtown-street': { cam: [-46, 1.8, 50], at: [-75, 10, 60], fov: 60 },
  skyline: { cam: [10, 34, 70], at: [-140, 40, -110], fov: 55 },
  'towers-close': { cam: [-108, 34, -104], at: [-145, 45, -145], fov: 55 },
};

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('erro na página:', e.message));
await page.addInitScript((q) => {
  localStorage.setItem('bz-universe-help-v2', 'seen');
  localStorage.setItem('bz-universe-debug', '1');
  localStorage.setItem('bz-universe-governor', 'off');
  localStorage.setItem('bz-demo-banner-v1', 'dismissed');
  sessionStorage.setItem('bz-universe-quality', q);
}, quality);
await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Explorar em 3D' }).click();
await page.waitForFunction(() => !!window.__bzUniverse, null, { timeout: 120_000 });
await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 120_000 });
await page.waitForTimeout(2000);
// Voadores de perto: congela o trânsito aéreo e enquadra o primeiro de cada classe (de lado e um pouco à frente).
for (const cls of ['taxi', 'private', 'cargo', 'drone']) {
  const name = `fly-${cls}`;
  if (!only?.includes(name)) continue;
  await page.evaluate((c) => {
    const u = window.__bzUniverse;
    u.freezeAir(true);
    const v = u.air().find((a) => a.cls === c);
    const d = c === 'drone' ? 3 : 8;
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    u.shot({ x: v.x + fz * d + fx * d * 0.6, y: v.y + d * 0.25, z: v.z - fx * d + fz * d * 0.6, tx: v.x, ty: v.y, tz: v.z, fov: 45 });
  }, cls);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${quality}-${name}.png` });
}
await page.evaluate(() => window.__bzUniverse.freezeAir(false));
// Tomadas do modo apresentação, paradas no meio de cada uma (tempo em segundos).
for (const [name, t] of Object.entries({ 'cine-avenue': 6, 'cine-plaza': 17.5, 'cine-hq': 28, 'cine-lab': 38.5, 'cine-products': 47.5, 'cine-aerial': 58 })) {
  if (!only?.includes(name)) continue;
  await page.evaluate((s) => window.__bzUniverse.cinemaAt(s), t);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${quality}-${name}.png` });
}
await page.evaluate(() => window.__bzUniverse.cinemaAt(null));
for (const [name, v] of Object.entries(VIEWS)) {
  if (only && !only.includes(name)) continue;
  await page.evaluate((view) => {
    const u = window.__bzUniverse;
    for (const c of view.cars ?? []) u.placeVehicle(c[0], c[1], c[2], c[3]);
    u.placeWalker(...(view.walker ?? [0, 100]));
    u.shot({ x: view.cam[0], y: view.cam[1], z: view.cam[2], tx: view.at[0], ty: view.at[1], tz: view.at[2], fov: view.fov });
  }, v);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${quality}-${name}.png` });
}
await browser.close();
console.log('capturas em', out);
