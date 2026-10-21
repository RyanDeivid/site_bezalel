import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CarClass } from '../world/vehicles';
import { cabinOf } from './carDesign';

/**
 * Interior dos veículos do jogador (visto em primeira pessoa): painel com o
 * quadro de instrumentos digital, volante (que gira com o esterço), console,
 * bancos com encosto e apoio de cabeça, assoalho e uma faixa de luz ambiente.
 * As paredes por dentro são a própria carroceria desenhada pelo avesso (o
 * vidro não entra: de dentro, vê-se a cidade).
 */
export interface Interior {
  /** Bancos, console e assoalho (couro); painel e coluna (acabamento escuro); luz ambiente (cor no vértice). */
  leather: THREE.BufferGeometry;
  trim: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  /** Volante, desenhado em volta da origem, e onde ele fica (posição e inclinação). */
  wheel: THREE.BufferGeometry;
  wheelAt: { position: [number, number, number]; tilt: number };
  /** Quadro de instrumentos (atrás do volante) e tela central: posição, inclinação e tamanho. */
  cluster: { position: [number, number, number]; tilt: number; size: [number, number] };
  screen: { position: [number, number, number]; tilt: number; size: [number, number] };
  head: [number, number, number];
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.deleteAttribute('uv');
  return g.translate(x, y, z);
};

function merge(list: THREE.BufferGeometry[], color?: THREE.Color) {
  if (color)
    for (const g of list) {
      const n = g.attributes.position!.count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
  const out = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  list.forEach((g) => g.dispose());
  return out;
}

/** Volante: aro, três raios, cubo com o friso dourado da marca. */
function steeringWheel(radius: number) {
  const parts: THREE.BufferGeometry[] = [new THREE.TorusGeometry(radius, 0.022, 8, 36)];
  for (const a of [Math.PI / 2, Math.PI + 0.5, -0.5]) parts.push(new THREE.BoxGeometry(radius, 0.03, 0.02).translate(radius / 2, 0, 0).rotateZ(a));
  parts.push(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 16).rotateX(Math.PI / 2));
  parts.forEach((g) => g.deleteAttribute('uv'));
  return merge(parts);
}

/** Escala do carro voador do jogador (o modelo do táxi aéreo a 0,85: a largura cabe no raio de colisão do voo). */
export const HOVER_SCALE = 0.85;

const cache = new Map<string, Interior>();

/** Interior de um carro (montado uma vez por modelo). */
export function carInterior(cls: CarClass): Interior {
  const hit = cache.get(cls);
  if (hit) return hit;
  const c = cabinOf(cls);
  const [hx, hy, hz] = c.head;
  const half = c.half;
  const seatY = hy - 0.74;
  const leather: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  // Painel: do para-brisa até ~60 cm para dentro, com o alto na altura da cintura.
  trim.push(box(half * 2 - 0.06, 0.3, 0.62, 0, c.dash - 0.14, c.front - 0.28));
  // Moldura do quadro de instrumentos (atrás da tela, que fica de pé sobre a borda do painel) e da tela central.
  trim.push(box(0.43, 0.18, 0.03, hx, c.dash + 0.08, c.front - 0.645, 0.5));
  trim.push(box(0.3, 0.2, 0.03, 0, c.dash - 0.13, c.front - 0.6, 0.22));
  // Coluna de direção (do painel até o volante).
  trim.push(box(0.07, 0.07, 0.42, hx, hy - 0.5, hz + 0.56, -0.45));
  // Console central (do painel até entre os bancos) e assoalho.
  leather.push(box(0.24, 0.2, Math.max(0.6, c.front - 0.3 - (hz - 0.4)), 0, seatY + 0.02, (c.front - 0.3 + hz - 0.4) / 2));
  trim.push(box(half * 2 - 0.1, 0.04, c.front - c.back, 0, Math.max(0.3, seatY - 0.12), (c.front + c.back) / 2));
  // Bancos da frente: assento, encosto (inclinado) e apoio de cabeça.
  for (const x of [hx, -hx]) {
    leather.push(box(0.5, 0.12, 0.52, x, seatY, hz + 0.08));
    leather.push(box(0.5, 0.66, 0.12, x, seatY + 0.36, hz - 0.24, -0.18));
    leather.push(box(0.26, 0.17, 0.1, x, seatY + 0.8, hz - 0.33, -0.18));
  }
  // Banco de trás (sedã e táxi), se couber.
  const rearZ = hz - 1.0;
  if (cls !== 'sport' && rearZ - 0.3 > c.back) {
    leather.push(box(half * 2 - 0.2, 0.14, 0.5, 0, seatY, rearZ));
    leather.push(box(half * 2 - 0.2, 0.6, 0.12, 0, seatY + 0.34, rearZ - 0.3, -0.16));
  }
  // Luz ambiente: um filete ao longo do painel (dourado; azul no táxi, que é da frota).
  const glowColor = cls === 'taxi' ? new THREE.Color(0.3, 0.6, 1.4) : new THREE.Color(1.6, 1.15, 0.55);
  const glow = merge([box(half * 2 - 0.12, 0.012, 0.012, 0, c.dash - 0.03, c.front - 0.6)], glowColor);
  const out: Interior = {
    leather: merge(leather),
    trim: merge(trim),
    glow,
    wheel: steeringWheel(cls === 'sport' ? 0.16 : 0.18),
    // O volante fica à frente do peito; o quadro de instrumentos, atrás dele (visto pelo vão de cima do aro).
    wheelAt: { position: [hx, hy - 0.44, hz + 0.38], tilt: 0.42 },
    // No esportivo (olhos baixos, perto do painel), o quadro é menor e mais embutido.
    cluster: cls === 'sport' ? { position: [hx, c.dash + 0.03, c.front - 0.64], tilt: 0.7, size: [0.3, 0.11] } : { position: [hx, c.dash + 0.08, c.front - 0.665], tilt: 0.5, size: [0.38, 0.14] },
    screen: { position: [0, c.dash - 0.13, c.front - 0.62], tilt: 0.22, size: [0.26, 0.16] },
    head: c.head,
  };
  cache.set(cls, out);
  return out;
}

/** Cabine do carro voador (no espaço do modelo, antes da escala 0,85): painel, manche, poltronas. */
export function hoverInterior(): Interior {
  const hit = cache.get('hover');
  if (hit) return hit;
  const head: [number, number, number] = [0, 0.42, 0.05];
  const leather: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  trim.push(box(1.3, 0.22, 0.5, 0, 0.02, 1.05));
  trim.push(box(1.5, 0.05, 2.4, 0, -0.34, 0.2));
  for (const x of [0.32, -0.32]) {
    leather.push(box(0.46, 0.12, 0.5, x, -0.28, 0.15));
    leather.push(box(0.46, 0.62, 0.12, x, 0.06, -0.15, -0.2));
  }
  const glow = merge([box(1.2, 0.012, 0.012, 0, 0.13, 0.82)], new THREE.Color(0.4, 0.7, 1.6));
  const out: Interior = {
    leather: merge(leather),
    trim: merge(trim),
    glow,
    wheel: steeringWheel(0.13),
    wheelAt: { position: [0, 0.0, 0.62], tilt: 0.5 },
    cluster: { position: [0, 0.16, 0.86], tilt: 0.6, size: [0.5, 0.18] },
    screen: { position: [0.42, 0.12, 0.88], tilt: 0.6, size: [0.24, 0.16] },
    head,
  };
  cache.set('hover', out);
  return out;
}

/**
 * Tela digital (quadro de instrumentos ou tela central), desenhada num canvas
 * comum (`willReadFrequently`: fica na CPU, e mandá-lo para a placa de vídeo
 * não exige lê-lo de volta da GPU — o que travava os telões). Só é redesenhada
 * quando o valor mostrado muda.
 */
export function dashboardScreen(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  let last = '';
  return {
    texture,
    /** Desenha só se `key` mudou (velocidade arredondada, marcha, altitude…). */
    draw(key: string, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
      if (key === last) return;
      last = key;
      paint(ctx, width, height);
      texture.needsUpdate = true;
    },
  };
}

const FONT = "'Geist Variable', system-ui, sans-serif";
const MONO = "'Geist Mono Variable', ui-monospace, monospace";

/** Quadro de instrumentos: velocidade grande no centro, arco da velocidade, marcha e carga (ou altitude, no voador). */
export function paintCluster(ctx: CanvasRenderingContext2D, w: number, h: number, kmh: number, max: number, gear: string, extra: { label: string; value: string; share: number }) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#05080f');
  g.addColorStop(1, '#0c1424');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Arco da velocidade.
  const cx = w * 0.5;
  const cy = h * 1.18;
  const r = h * 1.02;
  const a0 = Math.PI * 1.18;
  const a1 = Math.PI * 1.82;
  ctx.lineWidth = h * 0.06;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(120,140,170,0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1);
  ctx.stroke();
  const k = Math.min(1, kmh / max);
  const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  grad.addColorStop(0, '#7fa6f5');
  grad.addColorStop(1, '#ead9b2');
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * Math.max(0.002, k));
  ctx.stroke();
  // Velocidade.
  ctx.fillStyle = '#f2e8d5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${Math.round(h * 0.46)}px ${FONT}`;
  ctx.fillText(String(Math.round(kmh)), cx, h * 0.72);
  ctx.font = `500 ${Math.round(h * 0.12)}px ${MONO}`;
  ctx.fillStyle = '#8f9aab';
  ctx.fillText('KM/H', cx, h * 0.88);
  // Marcha (à esquerda) e carga ou altitude (à direita, com barra).
  ctx.font = `600 ${Math.round(h * 0.24)}px ${FONT}`;
  ctx.fillStyle = gear === 'R' ? '#d95926' : '#c7a86a';
  ctx.fillText(gear, w * 0.12, h * 0.62);
  ctx.textAlign = 'right';
  ctx.font = `500 ${Math.round(h * 0.11)}px ${MONO}`;
  ctx.fillStyle = '#8f9aab';
  ctx.fillText(extra.label, w * 0.95, h * 0.42);
  ctx.font = `600 ${Math.round(h * 0.17)}px ${FONT}`;
  ctx.fillStyle = '#f2e8d5';
  ctx.fillText(extra.value, w * 0.95, h * 0.62);
  ctx.fillStyle = 'rgba(120,140,170,0.25)';
  ctx.fillRect(w * 0.72, h * 0.72, w * 0.23, h * 0.04);
  ctx.fillStyle = '#7fa6f5';
  ctx.fillRect(w * 0.72, h * 0.72, w * 0.23 * Math.max(0, Math.min(1, extra.share)), h * 0.04);
  // Marca, discreta, no alto.
  ctx.textAlign = 'center';
  ctx.font = `500 ${Math.round(h * 0.09)}px ${MONO}`;
  ctx.fillStyle = 'rgba(199,168,106,0.7)';
  ctx.fillText('BEZALEL', cx, h * 0.16);
}

/** Tela central: hora e uma linha de estado (navegação da cidade). */
export function paintCenter(ctx: CanvasRenderingContext2D, w: number, h: number, time: string, line: string) {
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, w, h);
  // Ruas da cidade em grade, de leve (o "mapa").
  ctx.strokeStyle = 'rgba(127,166,245,0.18)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo((w * i) / 6, 0);
    ctx.lineTo((w * i) / 6, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (h * i) / 6);
    ctx.lineTo(w, (h * i) / 6);
    ctx.stroke();
  }
  ctx.fillStyle = '#c7a86a';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2e8d5';
  ctx.textAlign = 'left';
  ctx.font = `600 ${Math.round(h * 0.2)}px ${FONT}`;
  ctx.fillText(time, w * 0.06, h * 0.26);
  ctx.font = `500 ${Math.round(h * 0.1)}px ${MONO}`;
  ctx.fillStyle = '#8f9aab';
  ctx.fillText(line, w * 0.06, h * 0.9);
}
