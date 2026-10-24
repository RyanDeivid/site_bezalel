// Nível e "cor" do som do Bezalel Universe a pé, parado na praça, medidos na saída de áudio de qualquer
// versão (o script escuta o que chega ao destino do contexto de áudio, sem depender de gancho do jogo):
// - RMS médio e a variação dele ao longo de ~20 s (mais alto ou mais baixo, mais parado ou mais vivo);
// - fração da energia acima de 450 Hz, onde mora o chiado de ruído (o acorde da ambientação fica abaixo).
// Não diz se o som é agradável: isso pede escuta.
//
//   npm run build && node scripts/serve-dist.ts      (em outro terminal)
//   node scripts/audio-level-universe.mjs            (BENCH_URL=… para outra versão servida)
import { chromium } from '@playwright/test';

const base = process.env.BENCH_URL ?? 'http://localhost:4173/site_bezalel/';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => {
  localStorage.setItem('bz-universe-help-v2', 'seen');
  localStorage.setItem('bz-universe-debug', '1');
  localStorage.setItem('bz-demo-banner-v1', 'dismissed');
  sessionStorage.setItem('bz-universe-quality', 'low');
  // Sonda: tudo o que for ligado ao destino também vai para um analisador nosso.
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    if (target instanceof AudioDestinationNode) {
      const ctx = target.context;
      if (!ctx.__probe) {
        ctx.__probe = ctx.createAnalyser();
        ctx.__probe.fftSize = 8192;
        window.__audioProbe = ctx.__probe;
      }
      connect.call(this, ctx.__probe);
    }
    return connect.call(this, target, ...rest);
  };
});
await page.goto(`${base}universe/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Explorar em 3D' }).click();
await page.waitForFunction(() => !!window.__bzUniverse && !!window.__audioProbe, null, { timeout: 120_000 });
await page.getByText(/Preparando a cidade/).waitFor({ state: 'hidden', timeout: 120_000 });
await page.mouse.click(640, 400);
await page.evaluate(() => window.__bzUniverse.placeWalker(0, 30, Math.PI));
await page.waitForTimeout(5000);
const samples = await page.evaluate(async () => {
  const a = window.__audioProbe;
  const time = new Float32Array(a.fftSize);
  const freq = new Float32Array(a.frequencyBinCount);
  const hz = a.context.sampleRate / a.fftSize;
  const out = [];
  for (let i = 0; i < 80; i++) {
    a.getFloatTimeDomainData(time);
    let sq = 0;
    for (const v of time) sq += v * v;
    a.getFloatFrequencyData(freq);
    let hi = 0;
    let all = 0;
    for (let k = 1; k < freq.length; k++) {
      const p = Math.pow(10, freq[k] / 10);
      if (!Number.isFinite(p)) continue;
      all += p;
      if (k * hz >= 450) hi += p;
    }
    out.push({ rms: Math.sqrt(sq / time.length), high: all ? hi / all : 0 });
    await new Promise((r) => setTimeout(r, 250));
  }
  return out;
});
const levels = samples.map((s) => s.rms);
const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
const sd = Math.sqrt(levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length);
const high = samples.reduce((a, s) => a + s.high, 0) / samples.length;
const db = (x) => (20 * Math.log10(Math.max(x, 1e-6))).toFixed(1);
console.log(`a pé, parado: RMS médio ${mean.toFixed(4)} (${db(mean)} dBFS) · variação ${((sd / mean) * 100).toFixed(0)}% · mín ${db(Math.min(...levels))} · máx ${db(Math.max(...levels))} dBFS · energia acima de 450 Hz: ${(high * 100).toFixed(1)}%`);
await browser.close();
