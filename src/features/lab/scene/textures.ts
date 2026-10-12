import * as THREE from 'three';

/**
 * Texturas desenhadas em Canvas 2D — nenhuma imagem externa. Telas e
 * painéis são redesenhados quando os dados mudam (no máximo a cada evento).
 */

const FONT = "'Geist Variable', 'Geist', system-ui, sans-serif";
const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace";

export function makeCanvasTexture(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, texture, ctx: canvas.getContext('2d')! };
}

/** Piso: grade arquitetônica com anéis concêntricos e raios dourados sutis. */
export function drawFloor(ctx: CanvasRenderingContext2D, size: number) {
  const c = size / 2;
  ctx.fillStyle = '#1b2b45';
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(199,168,106,0.16)');
  g.addColorStop(0.35, 'rgba(38,59,84,0.25)');
  g.addColorStop(1, 'rgba(10,18,32,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(242,232,213,0.1)';
  ctx.lineWidth = 1.2;
  const step = size / 32;
  for (let i = 0; i <= 32; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  for (let r = 1; r <= 8; r++) {
    ctx.strokeStyle = r === 3 ? 'rgba(199,168,106,0.32)' : `rgba(199,168,106,${0.05 + (r % 2) * 0.05})`;
    ctx.lineWidth = r === 3 ? 2 : 1.2;
    ctx.beginPath();
    ctx.arc(c, c, (c / 8) * r - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(199,168,106,0.1)';
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * c * 0.2, c + Math.sin(a) * c * 0.2);
    ctx.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c);
    ctx.stroke();
  }
}

export interface ScreenContent {
  title: string;
  subtitle: string;
  status: string;
  statusColor: string;
  color: string;
  lines: Array<{ label: string; value?: string }>;
  footer: string;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Tela de uma estação de agente: cabeçalho, estado, linhas de dados e rodapé "simulação". */
export function drawScreen(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenContent) {
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, 'rgba(10,18,32,0.96)');
  bg.addColorStop(1, 'rgba(16,27,43,0.96)');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 17);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // linhas de varredura discretas
  ctx.fillStyle = 'rgba(242,232,213,0.025)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);

  ctx.fillStyle = s.color;
  ctx.fillRect(28, 30, 6, 46);
  ctx.fillStyle = '#f2e8d5';
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(fitText(ctx, s.title, w - 300), 48, 64);
  ctx.fillStyle = '#a9b1bd';
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText(fitText(ctx, s.subtitle, w - 80), 48, 100);

  // chip de estado
  ctx.font = `500 20px ${MONO}`;
  const chipW = ctx.measureText(s.status.toUpperCase()).width + 44;
  roundRect(ctx, w - chipW - 28, 34, chipW, 36, 18);
  ctx.fillStyle = 'rgba(242,232,213,0.06)';
  ctx.fill();
  ctx.fillStyle = s.statusColor;
  ctx.beginPath();
  ctx.arc(w - chipW - 8, 52, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2e8d5';
  ctx.fillText(s.status.toUpperCase(), w - chipW + 4, 59);

  ctx.strokeStyle = 'rgba(242,232,213,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, 124);
  ctx.lineTo(w - 28, 124);
  ctx.stroke();

  let y = 168;
  for (const line of s.lines.slice(0, 5)) {
    ctx.font = `400 24px ${FONT}`;
    ctx.fillStyle = '#c9ccd2';
    const valueW = line.value ? (ctx.font = `500 26px ${MONO}`, ctx.measureText(line.value).width) : 0;
    ctx.font = `400 24px ${FONT}`;
    ctx.fillText(fitText(ctx, line.label, w - 90 - valueW), 40, y);
    if (line.value) {
      ctx.font = `500 26px ${MONO}`;
      ctx.fillStyle = s.color;
      ctx.fillText(line.value, w - 40 - valueW, y);
    }
    y += 44;
  }

  ctx.font = `500 18px ${MONO}`;
  ctx.fillStyle = '#b49ae8';
  ctx.fillText(s.footer.toUpperCase(), 40, h - 28);
}

export interface HubContent {
  title: string;
  metrics: Array<{ label: string; value: number }>;
  footer: string;
}

/** Painel holográfico da Central de Operações. */
export function drawHubPanel(ctx: CanvasRenderingContext2D, w: number, h: number, c: HubContent) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8,14,24,0.82)';
  roundRect(ctx, 0, 0, w, h, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(199,168,106,0.75)';
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 19);
  ctx.stroke();
  ctx.fillStyle = '#c7a86a';
  ctx.font = `500 22px ${MONO}`;
  ctx.fillText(c.title.toUpperCase(), 32, 52);
  const cols = 3;
  const cellW = (w - 64) / cols;
  c.metrics.slice(0, 6).forEach((mtr, i) => {
    const x = 32 + (i % cols) * cellW;
    const y = 110 + Math.floor(i / cols) * 112;
    ctx.fillStyle = '#f2e8d5';
    ctx.font = `500 54px ${MONO}`;
    ctx.fillText(String(mtr.value), x, y + 22);
    ctx.fillStyle = '#a9b1bd';
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText(fitText(ctx, mtr.label, cellW - 16), x, y + 56);
  });
  ctx.font = `500 16px ${MONO}`;
  ctx.fillStyle = '#b49ae8';
  ctx.fillText(c.footer.toUpperCase(), 32, h - 24);
}

/** Rótulo flutuante (nome do agente). */
export function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, color: string) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8,14,24,0.78)';
  roundRect(ctx, 4, 4, w - 8, h - 8, (h - 8) / 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundRect(ctx, 4, 4, w - 8, h - 8, (h - 8) / 2);
  ctx.stroke();
  ctx.fillStyle = '#f2e8d5';
  ctx.font = `600 ${Math.round(h * 0.42)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/** Textura radial suave para halos (brilho aditivo sem pós-processamento). */
export function makeGlowTexture(color: string) {
  const { ctx, texture } = makeCanvasTexture(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color.replace(/,\s*[\d.]+\)$/, ',0.45)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  texture.needsUpdate = true;
  return texture;
}

export interface LogContent {
  title: string;
  color: string;
  lines: Array<{ time: string; text: string; tone: 'ok' | 'warn' | 'danger' | 'info' }>;
  empty: string;
  footer: string;
}

const TONE: Record<LogContent['lines'][number]['tone'], string> = { ok: '#5cc8a1', warn: '#e3b35a', danger: '#e57465', info: '#a9b1bd' };

/** Monitor lateral: últimos eventos do agente, como um terminal. */
export function drawLog(ctx: CanvasRenderingContext2D, w: number, h: number, c: LogContent) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(6,11,20,0.97)';
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = c.color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 13);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(242,232,213,0.025)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.fillStyle = c.color;
  ctx.font = `500 22px ${MONO}`;
  ctx.fillText(c.title.toUpperCase(), 26, 44);
  if (!c.lines.length) {
    ctx.fillStyle = '#7d8899';
    ctx.font = `400 22px ${FONT}`;
    ctx.fillText(fitText(ctx, c.empty, w - 52), 26, 96);
  }
  let y = 92;
  for (const line of c.lines.slice(0, 5)) {
    ctx.fillStyle = TONE[line.tone];
    ctx.beginPath();
    ctx.arc(32, y - 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `500 18px ${MONO}`;
    ctx.fillStyle = '#7d8899';
    ctx.fillText(line.time, 48, y);
    ctx.font = `400 21px ${FONT}`;
    ctx.fillStyle = '#d3d7dd';
    ctx.fillText(fitText(ctx, line.text, w - 150), 138, y);
    y += 40;
  }
  ctx.font = `500 15px ${MONO}`;
  ctx.fillStyle = '#b49ae8';
  ctx.fillText(c.footer.toUpperCase(), 26, h - 20);
}

export interface MetricContent {
  label: string;
  value: string;
  detail: string;
  color: string;
  footer: string;
}

/** Monitor lateral: um número grande com rótulo (o indicador principal do agente). */
export function drawMetric(ctx: CanvasRenderingContext2D, w: number, h: number, c: MetricContent) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(6,11,20,0.97)';
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = c.color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 13);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#a9b1bd';
  ctx.font = `500 22px ${MONO}`;
  ctx.fillText(fitText(ctx, c.label.toUpperCase(), w - 52), 26, 46);
  ctx.fillStyle = c.color;
  ctx.font = `600 104px ${MONO}`;
  ctx.fillText(fitText(ctx, c.value, w - 52), 24, 170);
  ctx.fillStyle = '#c9ccd2';
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText(fitText(ctx, c.detail, w - 52), 26, 214);
  ctx.font = `500 15px ${MONO}`;
  ctx.fillStyle = '#b49ae8';
  ctx.fillText(c.footer.toUpperCase(), 26, h - 20);
}

/** Piso do campus: praça, anel de circulação, caminhos dos setores e da entrada. */
export function drawCampusFloor(
  ctx: CanvasRenderingContext2D,
  size: number,
  opts: { radius: number; plaza: number; ring: number; sectors: Array<{ angle: number; color: string }>; sectorRadius: number; sectorSize: number; entrance: number },
) {
  const c = size / 2;
  const k = (size / 2) / opts.radius; // px por metro
  ctx.fillStyle = '#16243b';
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(199,168,106,0.14)');
  g.addColorStop(0.4, 'rgba(38,59,84,0.22)');
  g.addColorStop(1, 'rgba(8,14,24,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Grade de 2 m.
  ctx.strokeStyle = 'rgba(242,232,213,0.06)';
  ctx.lineWidth = 1;
  const step = 2 * k;
  for (let x = c % step; x < size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = c % step; y < size; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  const path = (angle: number, from: number, to: number, width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * k;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(angle) * from * k, c + Math.sin(angle) * from * k);
    ctx.lineTo(c + Math.cos(angle) * to * k, c + Math.sin(angle) * to * k);
    ctx.stroke();
  };
  ctx.lineCap = 'butt';
  // Caminhos: entrada e setores (pedra mais clara), com filete na cor do agente.
  path(opts.entrance, opts.plaza, opts.radius, 3.2, 'rgba(242,232,213,0.07)');
  for (const s of opts.sectors) {
    path(s.angle, opts.plaza, opts.sectorRadius - opts.sectorSize * 0.8, 2.4, 'rgba(242,232,213,0.07)');
    path(s.angle, opts.plaza + 0.4, opts.sectorRadius - opts.sectorSize * 0.8, 0.12, s.color);
  }
  // Anel de circulação.
  ctx.strokeStyle = 'rgba(242,232,213,0.08)';
  ctx.lineWidth = 2.4 * k;
  ctx.beginPath();
  ctx.arc(c, c, opts.ring * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(199,168,106,0.35)';
  ctx.lineWidth = 0.08 * k;
  for (const r of [opts.ring - 1.2, opts.ring + 1.2]) {
    ctx.beginPath();
    ctx.arc(c, c, r * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Praça da Central.
  const pg = ctx.createRadialGradient(c, c, 0, c, c, opts.plaza * k);
  pg.addColorStop(0, 'rgba(234,217,178,0.2)');
  pg.addColorStop(1, 'rgba(234,217,178,0.08)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(c, c, opts.plaza * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(199,168,106,0.55)';
  ctx.lineWidth = 0.1 * k;
  ctx.stroke();
  // Raios dourados sutis da praça.
  ctx.strokeStyle = 'rgba(199,168,106,0.12)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 3.6 * k, c + Math.sin(a) * 3.6 * k);
    ctx.lineTo(c + Math.cos(a) * opts.plaza * k, c + Math.sin(a) * opts.plaza * k);
    ctx.stroke();
  }
  // Borda do campus.
  ctx.strokeStyle = 'rgba(199,168,106,0.4)';
  ctx.lineWidth = 0.12 * k;
  ctx.beginPath();
  ctx.arc(c, c, (opts.radius - 0.4) * k, 0, Math.PI * 2);
  ctx.stroke();
}
