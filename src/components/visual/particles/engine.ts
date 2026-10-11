/**
 * Motor da rede de partículas do hero. Não depende de DOM nem de React: roda
 * igual num Web Worker (OffscreenCanvas, fora da thread principal) ou, sem
 * suporte, na própria página.
 *
 * Custo por quadro mantido baixo de propósito:
 * - linhas agrupadas por faixa de opacidade → ~8 `stroke()` por quadro em vez
 *   de um por conexão;
 * - pontos agrupados por profundidade → 4 `fill()`;
 * - brilho dos pulsos é um sprite pré-desenhado (sem gradiente por quadro);
 * - quadros limitados (30 fps em celular) e pausa total fora da tela.
 */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Surface = HTMLCanvasElement | OffscreenCanvas;

export interface ParticleOptions {
  density: number;
  seed: number;
  /** 0,45 (fraco) · 0,7 (médio) · 1 (forte): multiplica a quantidade de nós. */
  tierFactor: number;
  maxPulses: number;
  fps: number;
  lineRgb: string;
  accent: string;
}

export type ParticleMessage =
  | { type: 'init'; canvas?: OffscreenCanvas; options: ParticleOptions }
  | { type: 'resize'; width: number; height: number; dpr: number }
  | { type: 'pointer'; x: number; y: number }
  | { type: 'running'; value: boolean }
  | { type: 'colors'; lineRgb: string; accent: string }
  | { type: 'destroy' };

interface Node {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
}

interface Pulse {
  a: number;
  b: number;
  t: number;
  speed: number;
}

/** Gerador pseudoaleatório com semente: a composição é estável entre visitas. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHA_BUCKETS = 8;
const DEPTH_BUCKETS = 4;
const raf: (cb: (t: number) => void) => number =
  typeof requestAnimationFrame === 'function' ? (cb) => requestAnimationFrame(cb) : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const caf: (id: number) => void = typeof cancelAnimationFrame === 'function' ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

export class ParticleEngine {
  private readonly ctx: Ctx;
  private readonly surface: Surface;
  private opts: ParticleOptions;
  private rand: () => number;
  private width = 0;
  private height = 0;
  private nodes: Node[] = [];
  private pulses: Pulse[] = [];
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private frame = 0;
  private running = false;
  private last = 0;
  private glow: Surface | null = null;
  // Buffers reaproveitados entre quadros (sem alocação por quadro).
  private px = new Float32Array(0);
  private py = new Float32Array(0);
  private edgesA: number[] = [];
  private edgesB: number[] = [];

  constructor(surface: Surface, ctx: Ctx, opts: ParticleOptions) {
    this.surface = surface;
    this.ctx = ctx;
    this.opts = opts;
    this.rand = mulberry32(opts.seed);
  }

  handle(msg: ParticleMessage) {
    switch (msg.type) {
      case 'resize':
        this.resize(msg.width, msg.height, msg.dpr);
        break;
      case 'pointer':
        this.pointer.tx = msg.x;
        this.pointer.ty = msg.y;
        break;
      case 'running':
        if (msg.value) this.start();
        else this.stop();
        break;
      case 'colors':
        this.opts = { ...this.opts, lineRgb: msg.lineRgb, accent: msg.accent };
        this.glow = null;
        if (!this.running) this.draw(false);
        break;
      case 'destroy':
        this.stop();
        break;
      default:
        break;
    }
  }

  private resize(width: number, height: number, dpr: number) {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.surface.width = Math.round(width * dpr);
    this.surface.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.rand = mulberry32(this.opts.seed);
    const count = Math.round(Math.min(130, ((width * height) / 11000) * this.opts.density * this.opts.tierFactor));
    this.nodes = Array.from({ length: count }, () => ({
      x: this.rand() * width,
      y: this.rand() * height,
      z: 0.35 + this.rand() * 0.65,
      vx: (this.rand() - 0.5) * 0.18,
      vy: (this.rand() - 0.5) * 0.18,
    }));
    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.pulses = [];
    this.draw(false);
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    const loop = (now: number) => {
      if (!this.running) return;
      this.frame = raf(loop);
      // Limite de quadros: em 30 fps o motor desenha um quadro sim, outro não.
      const interval = 1000 / this.opts.fps;
      if (this.last && now - this.last < interval - 2) return;
      const steps = this.last ? Math.min(3, Math.max(1, Math.round((now - this.last) / (1000 / 60)))) : 1;
      this.last = now;
      this.draw(true, steps);
    };
    this.frame = raf(loop);
  }

  private stop() {
    this.running = false;
    caf(this.frame);
  }

  private glowSprite(): Surface {
    if (this.glow) return this.glow;
    const size = 24;
    const c: Surface = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
    const g = c.getContext('2d') as Ctx | null;
    if (g) {
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, this.opts.accent);
      grad.addColorStop(1, 'transparent');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
    }
    this.glow = c;
    return c;
  }

  private draw(step: boolean, steps = 1) {
    const { ctx, width, height, nodes, pointer } = this;
    if (!width || !height) return;
    const { lineRgb, maxPulses } = this.opts;
    ctx.clearRect(0, 0, width, height);
    pointer.x += (pointer.tx - pointer.x) * 0.05 * steps;
    pointer.y += (pointer.ty - pointer.y) * 0.05 * steps;
    const md = Math.min(150, Math.max(90, width / 9));
    const md2 = md * md;
    const { px, py } = this;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      if (step) {
        n.x += n.vx * n.z * steps;
        n.y += n.vy * n.z * steps;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }
      px[i] = n.x + pointer.x * 18 * n.z;
      py[i] = n.y + pointer.y * 18 * n.z;
    }

    // Conexões agrupadas por opacidade: um path e um stroke por faixa.
    const buckets: Array<Array<number>> = Array.from({ length: ALPHA_BUCKETS }, () => []);
    this.edgesA.length = 0;
    this.edgesB.length = 0;
    for (let i = 0; i < nodes.length; i++) {
      const xi = px[i]!;
      const yi = py[i]!;
      const zi = nodes[i]!.z;
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = xi - px[j]!;
        if (dx > md || dx < -md) continue;
        const dy = yi - py[j]!;
        const d2 = dx * dx + dy * dy;
        if (d2 >= md2) continue;
        const alpha = (1 - Math.sqrt(d2) / md) * 0.22 * Math.min(zi, nodes[j]!.z);
        const b = Math.min(ALPHA_BUCKETS - 1, Math.floor((alpha / 0.22) * ALPHA_BUCKETS));
        buckets[b]!.push(i, j);
        this.edgesA.push(i);
        this.edgesB.push(j);
      }
    }
    ctx.lineWidth = 0.8;
    for (let b = 0; b < ALPHA_BUCKETS; b++) {
      const list = buckets[b]!;
      if (!list.length) continue;
      ctx.strokeStyle = `rgba(${lineRgb},${(((b + 0.5) / ALPHA_BUCKETS) * 0.22).toFixed(3)})`;
      ctx.beginPath();
      for (let k = 0; k < list.length; k += 2) {
        ctx.moveTo(px[list[k]!]!, py[list[k]!]!);
        ctx.lineTo(px[list[k + 1]!]!, py[list[k + 1]!]!);
      }
      ctx.stroke();
    }

    // Pontos agrupados por profundidade.
    for (let b = 0; b < DEPTH_BUCKETS; b++) {
      const zMid = 0.35 + ((b + 0.5) / DEPTH_BUCKETS) * 0.65;
      ctx.fillStyle = `rgba(${lineRgb},${(0.25 + zMid * 0.45).toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i < nodes.length; i++) {
        const z = nodes[i]!.z;
        if (Math.min(DEPTH_BUCKETS - 1, Math.floor(((z - 0.35) / 0.65) * DEPTH_BUCKETS)) !== b) continue;
        const r = 0.6 + z * 1.3;
        ctx.moveTo(px[i]! + r, py[i]!);
        ctx.arc(px[i]!, py[i]!, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Pulsos de informação percorrendo as conexões.
    if (step) {
      const edges = this.edgesA.length;
      if (this.pulses.length < maxPulses && edges && this.rand() < 0.06 * steps) {
        const e = Math.floor(this.rand() * edges);
        this.pulses.push({ a: this.edgesA[e]!, b: this.edgesB[e]!, t: 0, speed: 0.008 + this.rand() * 0.012 });
      }
      this.pulses = this.pulses.filter((pl) => (pl.t += pl.speed * steps) < 1);
    }
    if (this.pulses.length) {
      const glow = this.glowSprite();
      for (const pl of this.pulses) {
        const x = px[pl.a]! + (px[pl.b]! - px[pl.a]!) * pl.t;
        const y = py[pl.a]! + (py[pl.b]! - py[pl.a]!) * pl.t;
        ctx.globalAlpha = Math.sin(pl.t * Math.PI);
        ctx.drawImage(glow as CanvasImageSource, x - 12, y - 12);
      }
      ctx.globalAlpha = 1;
    }
  }
}
