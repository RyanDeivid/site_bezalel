// Percurso da Torre Bezalel com capturas (para revisar a arte e comparar antes e depois): a entrada, a
// recepção, o elevador, a viagem, a presidência (vista e telas) e a Engenharia. Usa o gancho de inspeção
// (`bz-universe-debug`) para posicionar o visitante e escolher os andares.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/shots-tower.mjs <pasta> [qualidade]
import { chromium } from '@playwright/test';
const out = process.argv[2];
const q = process.argv[3] ?? 'medium';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('erro:', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text().slice(0, 200)));
await p.addInitScript((q) => {
  localStorage.setItem('bz-universe-help-v2', 'seen');
  localStorage.setItem('bz-universe-debug', '1');
  localStorage.setItem('bz-universe-governor', 'off');
  localStorage.setItem('bz-demo-banner-v1', 'dismissed');
  sessionStorage.setItem('bz-universe-quality', q);
}, q);
await p.goto('http://localhost:4173/site_bezalel/universe/', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: 'Explorar em 3D' }).click();
await p.waitForFunction(() => !!window.__bzUniverse, null, { timeout: 120000 });
await p.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 120000 });
const U = (f, ...a) => p.evaluate(([f, a]) => window.__bzUniverse[f](...a), [f, a]);
const st = () => p.evaluate(() => window.__bzUniverse.state());
const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${name}.png` }); console.log(name, JSON.stringify((await st()).tower), JSON.stringify((await st()).walker)); };
// Fachada de perto e a entrada.
await U('placeWalker', 0, -58, Math.PI);
await shot('1-entrada');
await p.keyboard.down('w'); await p.waitForTimeout(3600); await p.keyboard.up('w');
await shot('2-recepcao');
await U('placeWalker', 0, -79.6, Math.PI);
await p.waitForTimeout(500);
await shot('3-porta-elevador');
await p.keyboard.press('e');
await p.waitForTimeout(1800);
await p.keyboard.down('w'); await p.waitForTimeout(1500); await p.keyboard.up('w');
await shot('4-na-cabina');
console.log('escolha', await U('towerChoose', 12));
await p.waitForTimeout(5000);
await shot('5-viajando');
await p.waitForFunction(() => window.__bzUniverse.state().tower.floor === 12 && window.__bzUniverse.state().tower.door > 0.9, null, { timeout: 30000 });
await p.keyboard.down('s'); await p.waitForTimeout(1800); await p.keyboard.up('s');
await shot('6-presidencia-saida');
await U('placeWalker', 0, -77.2, 0);
await shot('7-presidencia-vista');
await U('placeWalker', -6, -84.8, Math.PI / 2);
await shot('8-presidencia-telas-oeste');
await U('placeWalker', 6, -84.8, -Math.PI / 2);
await shot('9-presidencia-telas-leste');
await U('placeWalker', 0, -80.4, Math.PI);
await p.waitForTimeout(400);
console.log('chamar', await U('towerCall'));
await p.waitForTimeout(1600);
await p.keyboard.down('w'); await p.waitForTimeout(1500); await p.keyboard.up('w');
console.log('escolha 3', await U('towerChoose', 3));
await p.waitForFunction(() => window.__bzUniverse.state().tower.floor === 3 && window.__bzUniverse.state().tower.door > 0.9, null, { timeout: 30000 });
await p.keyboard.down('s'); await p.waitForTimeout(1800); await p.keyboard.up('s');
await U('placeWalker', 0, -78.6, 0.5);
await shot('10-engenharia');
await U('placeWalker', -2, -77, -2.4);
await shot('11-engenharia-bancadas');
await b.close();
