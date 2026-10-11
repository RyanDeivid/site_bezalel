import { buildGeometry, Ink, PALETTE, rng, type Geometry, type Label, type Point, type Segment, type SheetLabels } from './formations';

/**
 * Renderizador da planta (canvas 2D, carregado sob demanda). Desenha a
 * posição da manivela `p` (0 → 7): entre as folhas k e k+1 as partículas
 * voam na ordem do desenho, os traços da folha nova são riscados aos poucos
 * e os da anterior se apagam. Só desenha quando algo muda; parado, um leve
 * tremeluzir (só em aparelhos fortes, só com a seção na tela).
 */

export interface BlueprintLayout {
  /** Centro do mundo, em px CSS relativos ao canvas. */
  x: number;
  y: number;
  /** px CSS por unidade do mundo. */
  scale: number;
  /** Altura do cubo-símbolo em unidades do mundo. */
  markHeight: number;
}

export interface BlueprintOptions {
  quality: 'full' | 'lite';
  /** Tela de toque: menos partículas e nada de tremeluzir em repouso (bateria). */
  touch: boolean;
  labels: SheetLabels;
  /** Fonte dos rótulos (a mono do site). */
  font: string;
  onLayout?(layout: BlueprintLayout): void;
}

export interface Blueprint {
  /** Nova posição da manivela (0–7). */
  setProgress(p: number): void;
  /** Seção visível? (pausa o tremeluzir fora da tela). */
  setActive(on: boolean): void;
  /** Movimento reduzido: sem tremeluzir. */
  setCalm(calm: boolean): void;
  resize(): void;
  destroy(): void;
}

const HEBREW_FONTS = "'Segoe UI', 'Noto Sans Hebrew', 'Arial Hebrew', 'David', Arial, sans-serif";
const NAME = 'בצלאל';
const FLIGHT = 0.45; // fração da volta usada para escalonar a partida das partículas

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Pontos do nome em hebraico (normalizados: largura 1, centrados), amostrados de um canvas. */
function sampleName(): Float32Array {
  const W = 640;
  const H = 220;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Float32Array();
  ctx.font = `700 150px ${HEBREW_FONTS}`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(NAME, W / 2, H / 2);
  const width = Math.max(1, ctx.measureText(NAME).width);
  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: number[] = [];
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3]! > 140) pts.push((x - W / 2) / width, (y - H / 2) / width);
    }
  }
  return new Float32Array(pts);
}

export function createBlueprint(canvas: HTMLCanvasElement, opts: BlueprintOptions): Blueprint {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');
  const n = opts.quality === 'lite' ? 820 : opts.touch ? 1100 : 1700;
  // Tremeluzir em repouso só no desktop forte: no celular a planta congela parada.
  const ambient = opts.quality === 'full' && !opts.touch;
  const geo: Geometry = buildGeometry(n, sampleName(), opts.labels);
  const { sheets } = geo;

  // Por partícula: curvatura do voo e fase do tremeluzir (determinísticas).
  const r = rng(97);
  const arc = new Float32Array(n);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    arc[i] = (r() - 0.5) * 0.5;
    phase[i] = r() * Math.PI * 2;
  }
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  const ps = new Float32Array(n);
  const pc = new Uint8Array(n);

  let w = 0;
  let h = 0;
  let dpr = 1;
  let S = 1;
  let cx = 0;
  let cy = 0;
  let progress = 0;
  let active = false;
  let calm = false;
  let raf = 0;
  let ambientTimer = 0;
  let lastInput = 0;

  const toX = (x: number) => cx + x * S;
  const toY = (y: number) => cy + y * S;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, opts.quality === 'full' ? 2 : 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // Faixa reservada no topo (a legenda do capítulo, no celular), via CSS.
    const top = parseFloat(getComputedStyle(canvas).getPropertyValue('--bp-top')) || 0;
    S = Math.min(w / 2.6, (h - top) / 1.95);
    cx = w / 2;
    cy = top + (h - top) / 2;
    opts.onLayout?.({ x: cx, y: cy, scale: S, markHeight: geo.markHeight });
    draw(performance.now());
  }

  function strokeSegments(segs: Segment[], amount: number, alpha: number, override?: (s: Segment, k: number) => Segment) {
    if (amount <= 0 || alpha <= 0.01) return;
    const lengths = segs.map((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
    const total = lengths.reduce((a, b) => a + b, 0);
    let budget = total * amount;
    const base = Math.max(1, S / 160);
    for (let k = 0; k < segs.length && budget > 0; k++) {
      const s = override ? override(segs[k]!, k) : segs[k]!;
      const l = lengths[k]!;
      const f = Math.min(1, budget / (l || 1));
      budget -= l;
      const bx = s.a[0] + (s.b[0] - s.a[0]) * f;
      const by = s.a[1] + (s.b[1] - s.a[1]) * f;
      ctx!.globalAlpha = alpha * (s.faint ? 0.28 : s.strong ? 0.95 : 0.55);
      ctx!.strokeStyle = PALETTE[s.ink]!;
      ctx!.lineWidth = (s.strong ? 1.7 : 1) * base;
      ctx!.beginPath();
      ctx!.moveTo(toX(s.a[0]), toY(s.a[1]));
      ctx!.lineTo(toX(bx), toY(by));
      ctx!.stroke();
      // Ponta do lápis: um brilho onde o traço está sendo riscado.
      if (f < 1 && amount < 1) {
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = '#fff6df';
        ctx!.beginPath();
        ctx!.arc(toX(bx), toY(by), 2.6 * base, 0, Math.PI * 2);
        ctx!.fill();
      }
    }
  }

  function drawLabels(labels: Label[], amount: number, alpha: number) {
    if (alpha <= 0.01) return;
    const basePx = Math.max(10.5, Math.min(15, S * 0.068));
    ctx!.textBaseline = 'middle';
    for (const l of labels) {
      const a = alpha * smooth(l.at, l.at + 0.12, amount);
      if (a <= 0.01) continue;
      ctx!.globalAlpha = a;
      ctx!.fillStyle = PALETTE[l.ink]!;
      ctx!.textAlign = l.align ?? 'center';
      ctx!.direction = l.hebrew ? 'rtl' : 'ltr';
      ctx!.font = l.hebrew ? `600 ${basePx * (l.size ?? 1) * 1.15}px ${HEBREW_FONTS}` : `500 ${basePx * (l.size ?? 1)}px ${opts.font}`;
      ctx!.fillText(l.text, toX(l.x), toY(l.y));
    }
    ctx!.direction = 'ltr';
  }

  function draw(now: number) {
    raf = 0;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, w, h);
    const k = Math.min(sheets.length - 1, Math.floor(progress + 1e-6));
    const t = k >= sheets.length - 1 ? 0 : progress - k;
    const from = sheets[k]!;
    const to = sheets[Math.min(sheets.length - 1, k + 1)]!;
    const drawn = clamp01((t - 0.08) / 0.84);

    ctx!.globalCompositeOperation = 'lighter';
    // Folha atual se apagando (ou inteira, se parada nela).
    const fade = 1 - smooth(0, 0.42, t);
    if (k === sheets.length - 1) strokeSegments(from.segments, 1, 1);
    else strokeSegments(from.segments, 1, fade);
    if (t > 0) {
      if (k + 1 === sheets.length - 1) {
        // Último capítulo: o cubo do Santo dos Santos voa até o centro e cresce até virar o símbolo.
        const e = easeInOut(clamp01(t / 0.85));
        strokeSegments(to.segments, 1, smooth(0, 0.15, t), (s, idx) => {
          const [ha, hb] = geo.holyEdges[idx]!;
          const lerp = (p: Point, q: Point): Point => [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e];
          return { ...s, a: lerp(ha, s.a), b: lerp(hb, s.b) };
        });
      } else strokeSegments(to.segments, drawn, 1);
    }

    // Partículas: posição, tamanho e cor de cada uma.
    const base = Math.max(1.1, Math.min(2.1, S / 120));
    const shimmer = !calm && ambient ? 0.0032 : 0;
    const time = now * 0.001;
    for (let i = 0; i < n; i++) {
      let x: number;
      let y: number;
      let e = 0;
      if (t > 0) {
        const d = (i / n) * FLIGHT;
        e = easeInOut(clamp01((t - d) / (1 - FLIGHT)));
        const ax = from.points[i * 2]!;
        const ay = from.points[i * 2 + 1]!;
        const bx = to.points[i * 2]!;
        const by = to.points[i * 2 + 1]!;
        const dx = bx - ax;
        const dy = by - ay;
        const bend = Math.sin(Math.PI * e) * arc[i]!;
        x = ax + dx * e - dy * bend;
        y = ay + dy * e + dx * bend;
        pc[i] = e < 0.5 ? from.colors[i]! : to.colors[i]!;
      } else {
        x = from.points[i * 2]!;
        y = from.points[i * 2 + 1]!;
        pc[i] = from.colors[i]!;
      }
      if (shimmer) {
        x += Math.sin(time * 1.7 + phase[i]!) * shimmer;
        y += Math.cos(time * 1.3 + phase[i]! * 1.3) * shimmer;
      }
      px[i] = toX(x);
      py[i] = toY(y);
      ps[i] = base * (1 + 1.1 * Math.sin(Math.PI * e));
    }
    // Um preenchimento por cor (11), em vez de trocar o estilo a cada partícula.
    for (let c = 0; c < PALETTE.length; c++) {
      ctx!.globalAlpha = c === Ink.Dust ? 0.5 : 0.85;
      ctx!.fillStyle = PALETTE[c]!;
      ctx!.beginPath();
      let any = false;
      for (let i = 0; i < n; i++) {
        if (pc[i] !== c) continue;
        const s = ps[i]!;
        ctx!.rect(px[i]! - s / 2, py[i]! - s / 2, s, s);
        any = true;
      }
      if (any) ctx!.fill();
    }

    ctx!.globalCompositeOperation = 'source-over';
    drawLabels(from.labels, 1, k === sheets.length - 1 ? 1 : fade);
    if (t > 0) drawLabels(to.labels, drawn, 1);
    ctx!.globalAlpha = 1;
    scheduleAmbient();
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  // Tremeluzir em repouso: ~24 quadros/s, só com a seção na tela.
  function scheduleAmbient() {
    clearTimeout(ambientTimer);
    if (calm || !active || !ambient) return;
    ambientTimer = window.setTimeout(() => {
      if (performance.now() - lastInput > 30) schedule();
    }, 42);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  return {
    setProgress(p) {
      progress = Math.max(0, Math.min(sheets.length - 1, p));
      lastInput = performance.now();
      schedule();
    },
    setActive(on) {
      active = on;
      if (on) schedule();
      else clearTimeout(ambientTimer);
    },
    setCalm(v) {
      calm = v;
      schedule();
    },
    resize,
    destroy() {
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(ambientTimer);
    },
  };
}
