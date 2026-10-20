import * as THREE from 'three';
import { makeCanvasTexture } from '@/features/lab/scene/textures';

/**
 * Texturas do Universe desenhadas em Canvas 2D (nenhuma imagem baixada). Cada
 * uma é criada uma vez por nível de qualidade e reaproveitada por todos os
 * objetos que a usam; quem cria descarta (ver `useUniverseAssets`).
 */

const FONT = "'Geist Variable', 'Geist', system-ui, sans-serif";
const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace";

export const PALETTE = {
  night: '#070d17',
  navy: '#101b2b',
  navy2: '#132136',
  surface: '#14223a',
  steel: '#1e3149',
  steelLight: '#4d6a8c',
  gold: '#c7a86a',
  goldLight: '#ead9b2',
  ivory: '#f2e8d5',
  blue: '#3987e5',
  blueSoft: '#7fa6f5',
  asphalt: '#2a2c31',
  sidewalk: '#565961',
  stone: '#273248',
  foliage: '#2f5a52',
  brake: '#d95926',
} as const;

/** Pseudoaleatório determinístico (as janelas acesas são sempre as mesmas). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const repeat = (t: THREE.Texture) => {
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
};

export type FacadeSystem = 'glassBlue' | 'glassBronze' | 'whiteConcrete' | 'charcoal' | 'metalPanel' | 'darkGlass' | 'champagne';

/** A imagem de uma fachada cobre 24 m × 28 m: 16 módulos de 1,5 m × 8 andares de 3,5 m. */
export const FACADE_TILE = { w: 24, h: 28, module: 1.5, floor: 3.5 } as const;

/**
 * Fachada por sistema construtivo (não um grid de quadradinhos acesos): pele de
 * vidro com montantes, faixas de laje e escritórios acesos em grupos; concreto
 * claro com janelas recortadas e moldura funda; pedra grafite com janelas em
 * fenda; painéis metálicos com janelas em fita contínua; vidro escuro quase sem
 * luz. Poucas janelas acesas (15–30%), em grupos — como num prédio de verdade à
 * noite. Duas imagens do mesmo desenho: `map` e `emissive` (só o que está aceso).
 */
export function facadeSystem(kind: FacadeSystem, size: number, seed: number) {
  const color = makeCanvasTexture(size, (size * FACADE_TILE.h) / FACADE_TILE.w);
  const glow = makeCanvasTexture(size, (size * FACADE_TILE.h) / FACADE_TILE.w);
  const W = size;
  const H = (size * FACADE_TILE.h) / FACADE_TILE.w;
  const m = W / FACADE_TILE.w; // pixels por metro
  const c = color.ctx;
  const g = glow.ctx;
  const rand = rng(seed);
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const mod = FACADE_TILE.module * m;
  const fl = FACADE_TILE.floor * m;
  const cols = 16;
  const rows = 8;
  // Escritórios acesos em trechos contínuos de um andar; cada trecho tem a sua luz (quente, neutra ou fria) e intensidade.
  type Lit = { rgb: [number, number, number]; a: number; blinds: boolean } | null;
  // A sede (vidro champanhe) é a mais acesa da cidade, e só com luz quente: lê-se de longe como o marco principal.
  const share = { glassBlue: 0.24, glassBronze: 0.26, whiteConcrete: 0.3, charcoal: 0.2, metalPanel: 0.24, darkGlass: 0.12, champagne: 0.42 }[kind];
  const pick = (): Lit => {
    if (rand() >= share) return null;
    const t = rand();
    const rgb: [number, number, number] = kind === 'champagne' ? (t < 0.6 ? [255, 214, 160] : [250, 236, 212]) : t < 0.55 ? [255, 204, 148] : t < 0.85 ? [246, 232, 210] : [186, 210, 255];
    return { rgb, a: 0.42 + rand() * 0.32, blinds: rand() < 0.3 };
  };
  const lit: Lit[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Lit[] = [];
    let cur = pick();
    for (let k = 0; k < cols; k++) {
      if (rand() < 0.22) cur = pick();
      row.push(cur);
    }
    lit.push(row);
  }
  /** Interior aceso: luz do teto mais forte no alto e caindo para baixo, persianas em alguns, vultos de divisórias. */
  const office = (l: NonNullable<Lit>, x: number, y: number, w: number, h: number) => {
    const [r, gg, b] = l.rgb;
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, `rgba(${r},${gg},${b},${l.a})`);
    grad.addColorStop(0.18, `rgba(${r},${gg},${b},${l.a * 0.8})`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},${l.a * 0.32})`);
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);
    if (l.blinds) {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let yy = y; yy < y + h * 0.55; yy += Math.max(2, 0.14 * m)) g.fillRect(x, yy, w, Math.max(1, 0.05 * m));
    }
    if (rand() < 0.35) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(x + rand() * w * 0.7, y + h * 0.45, w * (0.1 + rand() * 0.15), h * 0.55);
    }
  };
  /** Vidro apagado: cada painel com um reflexo um pouco diferente (não é um preto liso) e, raramente, uma luz fraca lá dentro. */
  const darkPane = (x: number, y: number, w: number, h: number) => {
    c.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + rand() * 0.06})`;
    c.fillRect(x, y, w, h);
    if (rand() < 0.08) {
      g.fillStyle = `rgba(120,150,190,${0.06 + rand() * 0.06})`;
      g.fillRect(x, y, w, h);
    }
  };
  const noise = (alpha: number) => {
    for (let n = 0; n < W * H * 0.02; n++) {
      c.fillStyle = rand() < 0.5 ? `rgba(255,255,255,${alpha * rand()})` : `rgba(0,0,0,${alpha * rand()})`;
      c.fillRect(rand() * W, rand() * H, 1, 1);
    }
  };

  if (kind === 'glassBlue' || kind === 'glassBronze' || kind === 'darkGlass' || kind === 'champagne') {
    const base = { glassBlue: ['#25455a', '#102233'], glassBronze: ['#4d3d2e', '#211a13'], darkGlass: ['#161d28', '#080a0e'], champagne: ['#6b5f4b', '#2c261d'] }[kind];
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, base[0]!);
    grad.addColorStop(1, base[1]!);
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
      const y = r * fl;
      for (let k = 0; k < cols; k++) {
        const l = lit[r]![k];
        if (l) office(l, k * mod, y + 0.2 * m, mod, fl - 1.1 * m);
        else darkPane(k * mod, y, mod, fl - 0.9 * m);
      }
      // Laje opaca (spandrel) de 0,9 m em cada andar: esconde o piso e o forro.
      c.fillStyle = kind === 'glassBronze' || kind === 'champagne' ? 'rgba(28,22,16,0.8)' : 'rgba(5,8,13,0.75)';
      c.fillRect(0, y + fl - 0.9 * m, W, 0.9 * m);
    }
    // Montantes verticais a cada módulo e travessas nas lajes (metal fino, um pouco mais claro que o vidro).
    c.fillStyle = kind === 'champagne' ? 'rgba(220,196,146,0.6)' : kind === 'glassBronze' ? 'rgba(160,130,92,0.5)' : 'rgba(130,148,168,0.4)';
    g.fillStyle = 'rgba(0,0,0,0.9)';
    for (let k = 0; k <= cols; k++) {
      c.fillRect(k * mod - 0.04 * m, 0, 0.08 * m, H);
      g.fillRect(k * mod - 0.04 * m, 0, 0.08 * m, H);
    }
    for (let r = 0; r <= rows; r++) c.fillRect(0, r * fl - 0.05 * m, W, 0.1 * m);
  } else if (kind === 'whiteConcrete') {
    c.fillStyle = '#d2d3d1';
    c.fillRect(0, 0, W, H);
    noise(0.07);
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k += 2) {
        const x = k * mod + 0.35 * m;
        const y = r * fl + 0.6 * m;
        const w = 2 * mod - 0.7 * m;
        const h = 2.2 * m;
        // Moldura funda: sombra em volta do recorte (dá profundidade à janela).
        c.fillStyle = 'rgba(70,70,72,0.5)';
        c.fillRect(x - 0.12 * m, y - 0.12 * m, w + 0.24 * m, h + 0.24 * m);
        c.fillStyle = '#18202a';
        c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(x, y, w, 0.22 * m);
        // Caixilho: uma divisão vertical.
        c.fillStyle = 'rgba(200,200,200,0.5)';
        c.fillRect(x + w * 0.62, y, 0.06 * m, h);
        const l = lit[r]![k] ?? lit[r]![k + 1];
        if (l) {
          office(l, x, y + 0.22 * m, w, h - 0.22 * m);
          g.fillStyle = 'rgba(0,0,0,0.8)';
          g.fillRect(x + w * 0.62, y, 0.06 * m, h);
        } else darkPane(x, y, w, h);
      }
  } else if (kind === 'charcoal') {
    c.fillStyle = '#2d2e32';
    c.fillRect(0, 0, W, H);
    noise(0.07);
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = Math.max(1, 0.04 * m);
    for (let r = 0; r <= rows * 2; r++) {
      c.beginPath();
      c.moveTo(0, (r * fl) / 2);
      c.lineTo(W, (r * fl) / 2);
      c.stroke();
    }
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++) {
        const x = k * mod + mod / 2 - 0.24 * m;
        const y = r * fl + 0.4 * m;
        c.fillStyle = '#0c1016';
        c.fillRect(x, y, 0.48 * m, fl - 0.8 * m);
        const l = lit[r]![k];
        if (l) office(l, x, y, 0.48 * m, fl - 0.8 * m);
      }
  } else {
    // Painéis metálicos com janelas em fita: uma faixa contínua de vidro por andar.
    c.fillStyle = '#868c94';
    c.fillRect(0, 0, W, H);
    noise(0.06);
    c.strokeStyle = 'rgba(40,44,50,0.45)';
    c.lineWidth = Math.max(1, 0.03 * m);
    for (let k = 0; k <= cols; k += 2) {
      c.beginPath();
      c.moveTo(k * mod, 0);
      c.lineTo(k * mod, H);
      c.stroke();
    }
    for (let r = 0; r < rows; r++) {
      const y = r * fl + 1.0 * m;
      c.fillStyle = '#121a24';
      c.fillRect(0, y, W, 1.55 * m);
      for (let k = 0; k < cols; k++) {
        const l = lit[r]![k];
        if (l) office(l, k * mod, y + 0.06 * m, mod, 1.43 * m);
        else darkPane(k * mod, y, mod, 1.55 * m);
      }
      c.fillStyle = 'rgba(190,200,210,0.35)';
      g.fillStyle = 'rgba(0,0,0,0.85)';
      for (let k = 0; k <= cols; k++) {
        c.fillRect(k * mod - 0.03 * m, y, 0.06 * m, 1.55 * m);
        g.fillRect(k * mod - 0.03 * m, y, 0.06 * m, 1.55 * m);
      }
    }
  }
  color.texture.needsUpdate = true;
  glow.texture.needsUpdate = true;
  return { map: repeat(color.texture), emissive: repeat(glow.texture) };
}

/**
 * Fachada de vidro com janelas: a imagem cobre 12 m × 14 m (4 vãos × 4
 * andares). Duas texturas da mesma grade: `map` (caixilhos e vidro) e
 * `emissive` (só as janelas acesas, para brilharem à noite).
 */
export function facadeTextures(size: number, seed: number, warmth = 0.75) {
  const color = makeCanvasTexture(size, size);
  const glow = makeCanvasTexture(size, size);
  const rand = rng(seed);
  const cols = 4;
  const rows = 4;
  const cw = size / cols;
  const rh = size / rows;
  const c = color.ctx;
  const g = glow.ctx;
  c.fillStyle = '#0c1524';
  c.fillRect(0, 0, size, size);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = i * cw + cw * 0.08;
      const y = j * rh + rh * 0.14;
      const w = cw * 0.84;
      const h = rh * 0.7;
      const grad = c.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#22385a');
      grad.addColorStop(1, '#13223a');
      c.fillStyle = grad;
      c.fillRect(x, y, w, h);
      const r = rand();
      if (r < 0.46) {
        g.fillStyle = r < 0.46 * warmth ? `rgba(242,226,190,${0.55 + rand() * 0.4})` : `rgba(140,180,240,${0.45 + rand() * 0.35})`;
        g.fillRect(x, y, w, h);
        // Persianas: algumas janelas acesas só pela metade.
        if (rand() < 0.3) {
          g.fillStyle = '#000';
          g.fillRect(x, y, w, h * (0.3 + rand() * 0.4));
        }
      }
    }
  // Lajes: linha clara entre os andares.
  c.fillStyle = 'rgba(199,168,106,0.28)';
  for (let j = 0; j <= rows; j++) c.fillRect(0, j * rh - 1, size, 2);
  color.texture.needsUpdate = true;
  glow.texture.needsUpdate = true;
  return { map: repeat(color.texture), emissive: repeat(glow.texture) };
}

/** Asfalto de uma rua de 12 m (a imagem cobre 12 m × 12 m): bordas claras e eixo tracejado dourado. */
export function roadTexture(size: number) {
  // Faixa de 12 m (a imagem cobre 12 m × 12 m; repete ao longo da rua). Asfalto de verdade: agregado
  // claro e escuro em grãos, faixas de rodagem mais escuras e lisas no meio de cada pista (onde passam os
  // pneus), remendos discretos e a sinalização nítida (bordas brancas, eixo tracejado dourado).
  const { ctx, texture } = makeCanvasTexture(size, size);
  const rand = rng(3);
  ctx.fillStyle = PALETTE.asphalt;
  ctx.fillRect(0, 0, size, size);
  const m = size / 12; // pixels por metro
  // Variação larga e suave (manchas de tom): quebra a uniformidade sem virar mosaico.
  for (let i = 0; i < 26; i++) {
    const g = ctx.createRadialGradient(rand() * size, rand() * size, 0, rand() * size, rand() * size, (2 + rand() * 4) * m);
    const t = rand() < 0.5 ? '255,255,255' : '0,0,0';
    g.addColorStop(0, `rgba(${t},${0.03 + rand() * 0.04})`);
    g.addColorStop(1, `rgba(${t},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  // Faixas de rodagem: duas por pista, a ±0,8 m do centro da pista (pistas centradas a ±3 m do eixo).
  for (const lane of [3, 9])
    for (const off of [-0.8, 0.8]) {
      const y = (lane + off) * m;
      const g = ctx.createLinearGradient(0, y - 0.45 * m, 0, y + 0.45 * m);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 0.45 * m, size, 0.9 * m);
    }
  // Agregado: grãos claros e escuros.
  for (let i = 0; i < size * size * 0.035; i++) {
    const light = rand() < 0.55;
    ctx.fillStyle = light ? `rgba(220,215,205,${0.05 + rand() * 0.12})` : `rgba(0,0,0,${0.08 + rand() * 0.18})`;
    const d = rand() < 0.15 ? 2 : 1;
    ctx.fillRect(rand() * size, rand() * size, d, d);
  }
  // Remendo retangular, de tom um pouco diferente, com a junta marcada.
  ctx.fillStyle = 'rgba(40,40,44,0.35)';
  ctx.fillRect(2.2 * m, 6.6 * m, 2.6 * m, 1.9 * m);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1, m * 0.04);
  ctx.strokeRect(2.2 * m, 6.6 * m, 2.6 * m, 1.9 * m);
  // Sinalização: bordas brancas contínuas a 0,75 m do meio-fio; eixo tracejado dourado (3 m de traço, 3 m de vão).
  ctx.fillStyle = 'rgba(236,232,222,0.88)';
  ctx.fillRect(0, 0.62 * m, size, 0.13 * m);
  ctx.fillRect(0, size - 0.75 * m, size, 0.13 * m);
  ctx.fillStyle = 'rgba(214,180,108,0.92)';
  for (let x = 0; x < size; x += 6 * m) ctx.fillRect(x + 1.5 * m, size / 2 - 0.07 * m, 3 * m, 0.14 * m);
  texture.needsUpdate = true;
  return repeat(texture);
}

/** Cruzamento (12 m × 12 m): faixas de pedestres de verdade nos quatro lados (barras de 0,5 m) e o asfalto gasto no meio. */
export function intersectionTexture(size: number) {
  const { ctx, texture } = makeCanvasTexture(size, size);
  const rand = rng(17);
  ctx.fillStyle = PALETTE.asphalt;
  ctx.fillRect(0, 0, size, size);
  const m = size / 12;
  // Centro mais gasto (os carros viram ali): um pouco mais escuro e liso.
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, 5 * m);
  g.addColorStop(0, 'rgba(0,0,0,0.2)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.035; i++) {
    ctx.fillStyle = rand() < 0.55 ? `rgba(220,215,205,${0.05 + rand() * 0.12})` : `rgba(0,0,0,${0.08 + rand() * 0.18})`;
    ctx.fillRect(rand() * size, rand() * size, 1, 1);
  }
  // Faixas de pedestres: barras brancas de 0,5 m com 0,5 m de vão, 2,4 m de comprimento, nas quatro bordas.
  // Só no trecho de 2,75 m a 9,25 m de cada borda: nas quinas, as quatro faixas não se sobrepõem.
  ctx.fillStyle = 'rgba(236,232,222,0.85)';
  for (let k = 0; k < 7; k++) {
    const p = (2.75 + k * 1.0) * m;
    const w = 0.5 * m;
    ctx.fillRect(p, 0.2 * m, w, 2.4 * m);
    ctx.fillRect(p, size - 2.6 * m, w, 2.4 * m);
    ctx.fillRect(0.2 * m, p, 2.4 * m, w);
    ctx.fillRect(size - 2.6 * m, p, 2.4 * m, w);
  }
  // Desgaste nas faixas (a tinta some onde os pneus passam).
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(30,32,36,${0.2 + rand() * 0.3})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1);
  }
  texture.needsUpdate = true;
  return texture;
}

/** Piso da praça: anéis de pedra, juntas radiais e dois frisos dourados. */
export function plazaTexture(size: number) {
  const { ctx, texture } = makeCanvasTexture(size, size);
  const c = size / 2;
  ctx.fillStyle = PALETTE.stone;
  ctx.fillRect(0, 0, size, size);
  const rings = 14;
  for (let i = rings; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(c, c, (c * i) / rings, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#3d4659' : '#373f52';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(8,14,24,0.55)';
  ctx.lineWidth = size / 512;
  for (let a = 0; a < 48; a++) {
    const t = (a / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(t) * c * 0.36, c + Math.sin(t) * c * 0.36);
    ctx.lineTo(c + Math.cos(t) * c, c + Math.sin(t) * c);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(199,168,106,0.75)';
  for (const [r, w] of [
    [0.97, 0.008],
    [0.62, 0.006],
  ] as const) {
    ctx.lineWidth = size * w;
    ctx.beginPath();
    ctx.arc(c, c, c * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Quatro eixos dourados apontando para a sede, o laboratório, os produtos e a chegada.
  ctx.lineWidth = size * 0.004;
  for (let k = 0; k < 4; k++) {
    const t = (k * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(t) * c * 0.62, c + Math.sin(t) * c * 0.62);
    ctx.lineTo(c + Math.cos(t) * c * 0.97, c + Math.sin(t) * c * 0.97);
    ctx.stroke();
  }
  texture.needsUpdate = true;
  return texture;
}

/** Pavimento das quadras e calçadas (lajotas). `tiles` lajotas por lado da imagem. */
export function paverTexture(size: number, base: string, joint: string, tiles = 8) {
  const { ctx, texture } = makeCanvasTexture(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = joint;
  ctx.lineWidth = Math.max(1, size / 256);
  const step = size / tiles;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  texture.needsUpdate = true;
  return repeat(texture);
}

/** Heliponto: disco escuro, anel dourado, setas para o centro e o losango da marca. */
export function padTexture(size: number) {
  const { ctx, texture } = makeCanvasTexture(size, size);
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(c, c, c * 0.98, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,18,32,0.92)';
  ctx.fill();
  ctx.lineWidth = size * 0.025;
  ctx.strokeStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.88, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = 'rgba(234,217,178,0.6)';
  ctx.beginPath();
  ctx.arc(c, c, c * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.goldLight;
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((k * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(0, -c * 0.62);
    ctx.lineTo(c * 0.08, -c * 0.5);
    ctx.lineTo(-c * 0.08, -c * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(c, c - c * 0.22);
  ctx.lineTo(c + c * 0.22, c);
  ctx.lineTo(c, c + c * 0.22);
  ctx.lineTo(c - c * 0.22, c);
  ctx.closePath();
  ctx.fillStyle = PALETTE.gold;
  ctx.fill();
  texture.needsUpdate = true;
  return texture;
}

/** Céu noturno: degradê vertical do quase preto ao azul do horizonte, com uma faixa quente bem discreta. */
/** Listras de "camadas" da face Aprender do símbolo. */
export function layersTexture(size: number) {
  const { ctx, texture } = makeCanvasTexture(size, size);
  ctx.fillStyle = '#d9cfba';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(16,27,43,0.35)';
  for (let k = 1; k < 4; k++) ctx.fillRect(0, (size * k) / 4 - size * 0.012, size, size * 0.024);
  ctx.strokeStyle = PALETTE.ivory;
  ctx.lineWidth = size * 0.03;
  ctx.strokeRect(0, 0, size, size);
  texture.needsUpdate = true;
  return texture;
}

/** Letreiro (texto espaçado, dourado sobre transparente). */
export function signTexture(text: string, width = 1024, height = 160, color: string = PALETTE.goldLight) {
  const { ctx, texture } = makeCanvasTexture(width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = `600 ${Math.round(height * 0.56)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${Math.round(height * 0.18)}px`;
  ctx.fillText(text.toUpperCase(), width / 2, height / 2 + 4);
  texture.needsUpdate = true;
  return texture;
}

/** Painel informativo: título, linhas e um rodapé em mono, num fundo de vidro escuro. */
export function panelTexture(title: string, lines: string[], footer: string, accent: string = PALETTE.gold, width = 1024, height = 640) {
  const { ctx, texture } = makeCanvasTexture(width, height);
  ctx.fillStyle = 'rgba(9,16,28,0.94)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 10);
  ctx.fillStyle = PALETTE.ivory;
  ctx.font = `600 64px ${FONT}`;
  ctx.fillText(title, 56, 120);
  ctx.font = `400 40px ${FONT}`;
  ctx.fillStyle = '#c9ccd2';
  lines.slice(0, Math.floor((height - 170) / 58)).forEach((l, i) => {
    ctx.fillStyle = accent;
    ctx.fillRect(56, 186 + i * 58, 14, 14);
    ctx.fillStyle = '#d6d9de';
    ctx.fillText(l, 92, 200 + i * 58);
  });
  ctx.fillStyle = '#8f9aab';
  ctx.font = `500 28px ${MONO}`;
  ctx.fillText(footer.toUpperCase(), 56, height - 44);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Vitrine de saguão (a imagem cobre 12 m × 6 m): vidro com interior aquecido,
 * montantes de bronze a cada 1,5 m e uma bandeira (faixa) superior. `map` e
 * `emissive` da mesma grade.
 */
export function storefrontTextures(size: number) {
  const color = makeCanvasTexture(size, size / 3);
  const glow = makeCanvasTexture(size, size / 3);
  const w = size;
  const h = size / 3;
  const c = color.ctx;
  const g = glow.ctx;
  const rand = rng(77);
  const m = w / 16; // a imagem cobre 16 m de largura; a altura é a do embasamento
  c.fillStyle = '#1a1d22';
  c.fillRect(0, 0, w, h);
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const signTop = 0;
  const signH = h * 0.2;
  const glassTop = signH + h * 0.03;
  const kick = h * 0.06;
  const SIGNS = ['255,226,180', '160,220,255', '255,170,90', '255,140,170', '170,255,210', '240,240,240'];
  for (let shop = 0; shop < 4; shop++) {
    const x0 = shop * 4 * m;
    const open = rand() < 0.78;
    const t = rand();
    const rgb = t < 0.5 ? '255,212,160' : t < 0.8 ? '245,240,228' : '200,220,255';
    // Letreiro: placa escura com as letras acesas numa cor própria da loja.
    c.fillStyle = '#121418';
    c.fillRect(x0 + 0.1 * m, signTop + h * 0.03, 3.8 * m, signH - h * 0.05);
    if (open || rand() < 0.5) {
      const sc = SIGNS[Math.floor(rand() * SIGNS.length)]!;
      const sw = (1.4 + rand() * 1.6) * m;
      const sx = x0 + (4 * m - sw) / 2;
      g.fillStyle = `rgba(${sc},0.95)`;
      for (let k = 0; k < 6 + Math.floor(rand() * 5); k++) {
        const lw = sw / 10;
        g.fillRect(sx + k * lw * 1.2, signTop + signH * 0.35, lw * (0.6 + rand() * 0.5), signH * 0.32);
      }
    }
    // Vitrine: interior aceso (mais forte perto do teto), prateleiras, produtos e a porta.
    if (open) {
      const grad = g.createLinearGradient(0, glassTop, 0, h - kick);
      grad.addColorStop(0, `rgba(${rgb},0.9)`);
      grad.addColorStop(0.3, `rgba(${rgb},0.55)`);
      grad.addColorStop(1, `rgba(${rgb},0.28)`);
      g.fillStyle = grad;
      g.fillRect(x0, glassTop, 4 * m, h - kick - glassTop);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let k = 0; k < 3; k++) g.fillRect(x0 + 0.2 * m, glassTop + (h - kick - glassTop) * (0.3 + k * 0.22), 3.6 * m, Math.max(1, 0.04 * h));
      for (let k = 0; k < 10; k++) {
        const pc = SIGNS[Math.floor(rand() * SIGNS.length)]!;
        g.fillStyle = rand() < 0.8 ? 'rgba(0,0,0,0.45)' : `rgba(${pc},0.5)`;
        g.fillRect(x0 + (0.3 + rand() * 3.3) * m, glassTop + (h - kick - glassTop) * (0.12 + rand() * 0.7), (0.12 + rand() * 0.25) * m, h * (0.03 + rand() * 0.05));
      }
      // Vultos de pessoas lá dentro, contra a luz.
      g.fillStyle = 'rgba(0,0,0,0.45)';
      for (let k = 0; k < Math.floor(rand() * 3); k++) g.fillRect(x0 + (0.5 + rand() * 3) * m, h - kick - h * 0.42, 0.35 * m, h * 0.42);
    } else {
      // Fechada: grade de enrolar e uma luz de segurança fraca.
      c.fillStyle = '#2a2d33';
      c.fillRect(x0, glassTop, 4 * m, h - kick - glassTop);
      c.fillStyle = 'rgba(0,0,0,0.4)';
      for (let y = glassTop; y < h - kick; y += Math.max(2, h * 0.025)) c.fillRect(x0, y, 4 * m, 1);
      g.fillStyle = 'rgba(140,170,210,0.12)';
      g.fillRect(x0, glassTop, 4 * m, (h - kick - glassTop) * 0.3);
    }
    // Porta (vão mais escuro, com puxador) num dos lados da loja.
    const dx = x0 + (rand() < 0.5 ? 0.3 : 2.5) * m;
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(dx, glassTop + h * 0.08, 1.2 * m, h - kick - glassTop - h * 0.08);
  }
  // Caixilhos a cada 2 m, travessa sob o letreiro e rodapé.
  c.fillStyle = '#3a3d44';
  g.fillStyle = '#000';
  for (let i = 0; i <= 8; i++) {
    c.fillRect(i * 2 * m - 0.05 * m, glassTop, 0.1 * m, h);
    g.fillRect(i * 2 * m - 0.05 * m, glassTop, 0.1 * m, h);
  }
  c.fillRect(0, glassTop - h * 0.03, w, h * 0.03);
  g.fillRect(0, glassTop - h * 0.03, w, h * 0.03);
  c.fillStyle = '#24262b';
  c.fillRect(0, h - kick, w, kick);
  g.fillRect(0, h - kick, w, kick);
  color.texture.needsUpdate = true;
  glow.texture.needsUpdate = true;
  return { map: repeat(color.texture), emissive: repeat(glow.texture) };
}

/** Painéis de pedra com juntas (a imagem cobre 6 m × 3 m): fachadas opacas com escala. */
/**
 * Saguão de pé-direito duplo da sede (a imagem cobre 34 m × 7,4 m): luz
 * quente do forro, a parede de fundo com o cubo da marca em dourado, o balcão
 * da recepção, um mezanino e pessoas contra a luz. `map` + `emissive`.
 */
export function lobbyTexture(width: number) {
  const height = Math.round((width * 7.4) / 34);
  const color = makeCanvasTexture(width, height);
  const glow = makeCanvasTexture(width, height);
  const c = color.ctx;
  const g = glow.ctx;
  const m = width / 34;
  const rand = rng(91);
  c.fillStyle = '#20232a';
  c.fillRect(0, 0, width, height);
  // Interior: forro claro no alto, parede de fundo em pedra quente, piso refletindo.
  const back = g.createLinearGradient(0, 0, 0, height);
  back.addColorStop(0, 'rgba(255,226,182,0.95)');
  back.addColorStop(0.12, 'rgba(255,214,160,0.7)');
  back.addColorStop(0.6, 'rgba(232,196,146,0.5)');
  back.addColorStop(1, 'rgba(255,224,180,0.62)');
  g.fillStyle = back;
  g.fillRect(0, 0, width, height);
  // Linhas de luz no forro.
  g.fillStyle = 'rgba(255,244,220,1)';
  for (let x = 1.5 * m; x < width; x += 3 * m) g.fillRect(x, 0.25 * m, 1.6 * m, 0.08 * m);
  // Mezanino a 3,6 m, com guarda-corpo, e as pessoas de cima.
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, height - 3.8 * m, width * 0.42, 0.3 * m);
  g.fillRect(width * 0.58, height - 3.8 * m, width * 0.42, 0.3 * m);
  // Parede da marca no centro: painel escuro com o cubo dourado (três faces) aceso.
  const cx = width / 2;
  const cy = height * 0.42;
  g.fillStyle = 'rgba(0,0,0,0.7)';
  g.fillRect(cx - 4 * m, height * 0.08, 8 * m, height * 0.72);
  const r = 1.5 * m;
  const pts = Array.from({ length: 6 }, (_, i) => [cx + r * Math.sin((i * Math.PI) / 3), cy - r * Math.cos((i * Math.PI) / 3)] as const);
  const face = (a: number, b: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(pts[a]![0], pts[a]![1]);
    g.lineTo(pts[(a + 1) % 6]![0], pts[(a + 1) % 6]![1]);
    g.lineTo(pts[b]![0], pts[b]![1]);
    g.closePath();
    g.fill();
  };
  face(5, 1, 'rgba(234,201,128,1)');
  face(1, 3, 'rgba(176,146,92,1)');
  face(3, 5, 'rgba(120,136,160,1)');
  // Balcão da recepção (contraluz) com o tampo aceso.
  g.fillStyle = 'rgba(0,0,0,0.7)';
  g.fillRect(cx - 6 * m, height - 1.25 * m, 12 * m, 1.05 * m);
  g.fillStyle = 'rgba(255,236,200,0.9)';
  g.fillRect(cx - 6 * m, height - 1.27 * m, 12 * m, 0.06 * m);
  // Pessoas e plantas no saguão.
  for (let k = 0; k < 16; k++) {
    const x = rand() * width;
    if (Math.abs(x - cx) < 6.5 * m) continue;
    const h = (1.55 + rand() * 0.3) * m;
    g.fillStyle = `rgba(0,0,0,${0.45 + rand() * 0.25})`;
    g.fillRect(x, height - 0.2 * m - h, 0.42 * m, h);
    g.beginPath();
    g.arc(x + 0.21 * m, height - 0.2 * m - h - 0.14 * m, 0.14 * m, 0, Math.PI * 2);
    g.fill();
  }
  // Caixilhos de bronze a cada 2,5 m, travessa no mezanino; no `map`, o vidro escuro.
  c.fillStyle = '#8a7350';
  g.fillStyle = '#000';
  for (let x = 0; x <= width; x += 2.5 * m) {
    c.fillRect(x - 0.06 * m, 0, 0.12 * m, height);
    g.fillRect(x - 0.06 * m, 0, 0.12 * m, height);
  }
  c.fillRect(0, height - 3.6 * m, width, 0.1 * m);
  g.fillRect(0, height - 3.6 * m, width, 0.1 * m);
  color.texture.needsUpdate = true;
  glow.texture.needsUpdate = true;
  return { map: color.texture, emissive: glow.texture };
}

/** Lavagem de luz de baixo para cima numa parede (somada à cena): o facho de um refletor no chão. */
export function washTexture(size: number) {
  const { ctx, texture } = makeCanvasTexture(size, size * 2);
  const g = ctx.createRadialGradient(size / 2, size * 2, 0, size / 2, size * 2, size * 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size * 2);
  // Esmaece nas laterais (o facho é estreito).
  const side = ctx.createLinearGradient(0, 0, size, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.3, 'rgba(0,0,0,0)');
  side.addColorStop(0.7, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, size, size * 2);
  ctx.globalCompositeOperation = 'source-over';
  texture.needsUpdate = true;
  return texture;
}

export function stonePanelTexture(size: number, base: string, joint: string) {
  const { ctx, texture } = makeCanvasTexture(size, size / 2);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size / 2);
  const rand = rng(17);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.05})`;
    ctx.fillRect((i % 2) * (size / 2), Math.floor(i / 2) * (size / 4), size / 2, size / 4);
  }
  ctx.strokeStyle = joint;
  ctx.lineWidth = Math.max(2, size / 200);
  ctx.strokeRect(0, 0, size / 2, size / 4);
  ctx.strokeRect(size / 2, 0, size / 2, size / 4);
  ctx.strokeRect(0, size / 4, size / 2, size / 4);
  ctx.strokeRect(size / 2, size / 4, size / 2, size / 4);
  texture.needsUpdate = true;
  return repeat(texture);
}

/** Ajusta as UVs de uma caixa para "metros / tile" em cada face (janelas sem esticar). */
export function boxWithMeterUVs(w: number, h: number, d: number, tileW = 12, tileH = 14) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // Ordem das faces do BoxGeometry: +x, -x, +y, -y, +z, -z (4 vértices cada).
  const dims: Array<[number, number]> = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * (dims[f]![0] / tileW), uv.getY(i) * (dims[f]![1] / tileH));
    }
  uv.needsUpdate = true;
  return geo;
}
