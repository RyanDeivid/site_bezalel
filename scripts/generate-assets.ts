/**
 * Gera os PNGs de /public (ícones e imagem de compartilhamento Open Graph)
 * a partir de HTML/SVG locais, usando o navegador do Playwright.
 *
 *   npm run assets          (usa o Edge instalado: PW_CHANNEL=msedge)
 *   PW_CHANNEL=chromium npm run assets
 *
 * Os arquivos gerados são versionados: o build não depende deste script.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const channel = process.env.PW_CHANNEL ?? 'msedge';

const mark = (await readFile(join(root, 'public/favicon.svg'), 'utf8'))
  .replace(/<rect[^>]*\/>/, '')
  .replace('<svg ', '<svg width="100%" height="100%" ');

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#0a1220;color:#f2e8d5;font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;position:relative}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(242,232,213,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(242,232,213,.05) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse at 70% 40%,#000,transparent 75%)}
  .glow{position:absolute;right:-120px;top:-60px;width:720px;height:720px;border-radius:50%;background:radial-gradient(circle,rgba(199,168,106,.28),transparent 62%)}
  .mark{position:absolute;right:120px;top:135px;width:360px;height:360px}
  .content{position:absolute;left:84px;top:96px;width:640px}
  .eyebrow{font:500 20px ui-monospace,Consolas,monospace;letter-spacing:.24em;color:#dcc594;text-transform:uppercase}
  h1{font-size:84px;letter-spacing:.3em;font-weight:600;margin-top:28px}
  .slogan{font:italic 46px Georgia,serif;color:#dcc594;margin-top:14px}
  p{font-size:28px;line-height:1.4;color:#a9b1bd;margin-top:30px}
  .line{position:absolute;left:84px;bottom:80px;width:520px;height:2px;background:linear-gradient(90deg,#c7a86a,transparent)}
</style></head><body><div class="grid"></div><div class="glow"></div><div class="mark">${mark}</div>
<div class="content"><div class="eyebrow">Inteligência educacional</div><h1>BEZALEL</h1><div class="slogan">Discover. Learn. Build.</div>
<p>Cursos e certificações verificados na fonte, competências e agentes de IA.</p></div><div class="line"></div></body></html>`;

const iconHtml = (size: number, pad: number) =>
  `<!doctype html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px;background:#101b2b;display:grid;place-items:center}div{width:${size - pad * 2}px;height:${size - pad * 2}px}</style></head><body><div>${mark}</div></body></html>`;

const browser = await chromium.launch(channel === 'chromium' ? {} : { channel });
const page = await browser.newPage();

async function shot(html: string, width: number, height: number, out: string) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'load' });
  await writeFile(join(root, out), await page.screenshot({ type: 'png' }));
  console.log(`gerado ${out}`);
}

await shot(ogHtml, 1200, 630, 'public/og-image.png');
await shot(iconHtml(180, 26), 180, 180, 'public/icons/apple-touch-icon.png');
await shot(iconHtml(192, 28), 192, 192, 'public/icons/icon-192.png');
await shot(iconHtml(512, 72), 512, 512, 'public/icons/icon-512.png');
await browser.close();
