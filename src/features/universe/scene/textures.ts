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
  asphalt: '#0d141f',
  sidewalk: '#1f2c42',
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
  const { ctx, texture } = makeCanvasTexture(size, size);
  ctx.fillStyle = PALETTE.asphalt;
  ctx.fillRect(0, 0, size, size);
  const rand = rng(3);
  for (let i = 0; i < size * 6; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.035})`;
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }
  const px = size / 12;
  ctx.fillStyle = 'rgba(242,232,213,0.55)';
  ctx.fillRect(0, px * 0.45, size, px * 0.14);
  ctx.fillRect(0, size - px * 0.59, size, px * 0.14);
  ctx.fillStyle = 'rgba(199,168,106,0.8)';
  for (let x = 0; x < size; x += px * 6) ctx.fillRect(x, size / 2 - px * 0.08, px * 3, px * 0.16);
  texture.needsUpdate = true;
  return repeat(texture);
}

/** Cruzamento (12 m × 12 m): faixas de pedestre nos quatro lados e um losango dourado discreto. */
export function intersectionTexture(size: number) {
  const { ctx, texture } = makeCanvasTexture(size, size);
  ctx.fillStyle = PALETTE.asphalt;
  ctx.fillRect(0, 0, size, size);
  const px = size / 12;
  ctx.fillStyle = 'rgba(242,232,213,0.5)';
  for (let k = 0; k < 6; k++) {
    const p = px * (1.4 + k * 1.6);
    const w = px * 0.8;
    ctx.fillRect(p, px * 0.3, w, px * 1.6);
    ctx.fillRect(p, size - px * 1.9, w, px * 1.6);
    ctx.fillRect(px * 0.3, p, px * 1.6, w);
    ctx.fillRect(size - px * 1.9, p, px * 1.6, w);
  }
  ctx.strokeStyle = 'rgba(199,168,106,0.45)';
  ctx.lineWidth = px * 0.12;
  ctx.beginPath();
  ctx.moveTo(size / 2, size / 2 - px * 2);
  ctx.lineTo(size / 2 + px * 2, size / 2);
  ctx.lineTo(size / 2, size / 2 + px * 2);
  ctx.lineTo(size / 2 - px * 2, size / 2);
  ctx.closePath();
  ctx.stroke();
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
    ctx.fillStyle = i % 2 ? '#2a3650' : '#26314a';
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
  const color = makeCanvasTexture(size, size / 2);
  const glow = makeCanvasTexture(size, size / 2);
  const w = size;
  const h = size / 2;
  const c = color.ctx;
  const g = glow.ctx;
  const inside = g.createLinearGradient(0, h, 0, 0);
  inside.addColorStop(0, 'rgba(242,220,176,0.95)');
  inside.addColorStop(0.75, 'rgba(242,220,176,0.35)');
  inside.addColorStop(1, 'rgba(242,220,176,0.12)');
  g.fillStyle = inside;
  g.fillRect(0, h * 0.18, w, h * 0.82);
  c.fillStyle = '#1b2638';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#6e5a35';
  g.fillStyle = '#000';
  const step = w / 8;
  for (let i = 0; i <= 8; i++) {
    c.fillRect(i * step - 3, 0, 6, h);
    g.fillRect(i * step - 3, 0, 6, h);
  }
  c.fillRect(0, h * 0.18 - 4, w, 8);
  g.fillRect(0, h * 0.18 - 4, w, 8);
  g.fillRect(0, 0, w, h * 0.18 - 4);
  color.texture.needsUpdate = true;
  glow.texture.needsUpdate = true;
  return { map: repeat(color.texture), emissive: repeat(glow.texture) };
}

/** Painéis de pedra com juntas (a imagem cobre 6 m × 3 m): fachadas opacas com escala. */
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
