import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLACES, PLAZA_RADIUS, ROAD_WIDTH, STREET_LINES, WORLD_HALF, type PlaceId } from '../world/city';
import type { CarClass } from '../world/vehicles';
import { cabinOf } from './carDesign';

/**
 * Interior dos veículos do jogador (visto em primeira pessoa), desenhado a
 * partir dos olhos do motorista com as medidas de um carro de verdade:
 * - painel em duas camadas, com friso de bronze, saídas de ar e filete de luz;
 * - quadro de instrumentos digital sobre o painel (embutido sob uma coifa no
 *   esportivo, que é baixo) e tela central virada para o motorista;
 * - volante (que gira com o esterço) num ângulo que deixa o quadro à vista
 *   por cima do aro;
 * - bancos com abas laterais, miolo em outro tom e apoio de cabeça;
 * - console com o seletor; portas com apoio de braço, puxador e luz; retrovisor.
 * Cores no vértice: cada material desenha várias peças numa chamada só. As
 * paredes por dentro são a própria carroceria pelo avesso (o vidro não entra:
 * de dentro, vê-se a cidade).
 */
export interface Interior {
  /** Bancos e apoios (cores no vértice). */
  leather: THREE.BufferGeometry;
  /** Painel, console, portas, assoalho, retrovisor e molduras das telas (cores no vértice). */
  trim: THREE.BufferGeometry;
  /** Frisos, puxadores, saídas de ar e o seletor (bronze escovado). */
  metal: THREE.BufferGeometry;
  /** Luz ambiente (cor no vértice, sem tone mapping). */
  glow: THREE.BufferGeometry;
  /** Volante, desenhado em volta da origem (aro em couro, cubo com o losango da marca), e onde ele fica. */
  wheel: THREE.BufferGeometry;
  wheelAt: { position: [number, number, number]; tilt: number };
  /** Quadro de instrumentos e tela central. */
  cluster: Screen;
  screen: Screen;
  head: [number, number, number];
}

/** Uma tela: posição, inclinação (de frente para os olhos), giro (para o motorista) e tamanho. */
export interface Screen {
  position: [number, number, number];
  tilt: number;
  yaw: number;
  size: [number, number];
}

const rgb = (hex: string) => new THREE.Color(hex);

function paint(g: THREE.BufferGeometry, color: THREE.Color) {
  const flat = g.index ? g.toNonIndexed() : g;
  if (flat !== g) g.dispose();
  flat.deleteAttribute('uv');
  const n = flat.attributes.position!.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
  flat.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return flat;
}

/** Caixa de cantos arredondados (reta, se o raio for 0), pintada, inclinada e posicionada. */
function part(color: THREE.Color, w: number, h: number, d: number, at: [number, number, number], rx = 0, radius = 0) {
  const r = Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const g = r > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(at[0], at[1], at[2]);
  return paint(g, color);
}

function merge(list: THREE.BufferGeometry[]) {
  const out = mergeGeometries(list)!;
  list.forEach((g) => g.dispose());
  return out;
}

/** Volante: aro em couro (mais grosso nas pegadas), três raios, cubo e o losango dourado da marca. */
function steeringWheel(radius: number, rim: THREE.Color, hub: THREE.Color) {
  const parts: THREE.BufferGeometry[] = [paint(new THREE.TorusGeometry(radius, 0.024, 10, 48), rim)];
  // Pegadas nas 9 e 15 horas (o aro engrossa onde as mãos ficam).
  for (const a of [0, Math.PI]) parts.push(paint(new THREE.TorusGeometry(radius, 0.029, 10, 12, 0.9).rotateZ(a - 0.45), rim));
  for (const a of [0, Math.PI, -Math.PI / 2]) parts.push(paint(new RoundedBoxGeometry(radius * 0.82, 0.034, 0.026, 2, 0.01).translate(radius * 0.5, 0, -0.012).rotateZ(a), hub));
  parts.push(paint(new RoundedBoxGeometry(0.13, 0.09, 0.05, 2, 0.02).translate(0, -0.01, -0.02), hub));
  // O losango da marca (um quadrado girado 45°), em dourado.
  parts.push(paint(new THREE.BoxGeometry(0.026, 0.026, 0.008).rotateZ(Math.PI / 4).translate(0, -0.008, -0.048), GOLD));
  return merge(parts);
}

/** Escala do carro voador do jogador (o modelo do táxi aéreo a 0,85: a largura cabe no raio de colisão do voo). */
export const HOVER_SCALE = 0.85;

/** Acabamento de cada carro: couro, miolo dos bancos, painel em dois tons, aro do volante, luz ambiente. */
const PALETTES: Record<CarClass, { seat: string; insert: string; dash: string; lower: string; console: string; floor: string; rim: string; glow: [number, number, number] }> = {
  // Sedã: couro conhaque com miolo chocolate, painel grafite.
  sedan: { seat: '#6a4329', insert: '#3e271a', dash: '#1d1e22', lower: '#2a2b31', console: '#101114', floor: '#141518', rim: '#2b211b', glow: [0.95, 0.68, 0.32] },
  // Esportivo: preto fosco com miolo em camurça cinza-quente; luz dourada.
  sport: { seat: '#1d1d21', insert: '#3b342d', dash: '#131417', lower: '#1d1e23', console: '#0b0b0d', floor: '#101013', rim: '#18181b', glow: [1.0, 0.72, 0.32] },
  // Táxi da frota: tecido cinza-azulado e luz azul.
  taxi: { seat: '#3b414b', insert: '#2b3038', dash: '#22252b', lower: '#353943', console: '#16181c', floor: '#18191d', rim: '#1d1f24', glow: [0.3, 0.55, 1.0] },
};

const GOLD = rgb('#c7a86a');
const SCREEN_BEZEL = rgb('#08090b');

/** Inclinação que deixa um plano em (y, z) de frente para os olhos em (eyeY, eyeZ). */
const facing = (eyeY: number, eyeZ: number, y: number, z: number) => Math.atan2(eyeY - y, z - eyeZ);

/** Moldura de uma tela (logo atrás dela, com a mesma inclinação e giro). */
function bezel(at: Screen) {
  const g = new RoundedBoxGeometry(at.size[0] + 0.024, at.size[1] + 0.024, 0.03, 2, 0.01).translate(0, 0, 0.017);
  g.rotateX(at.tilt).rotateY(at.yaw).translate(...at.position);
  return paint(g, SCREEN_BEZEL);
}

const cache = new Map<string, Interior>();

/** Interior de um carro (montado uma vez por modelo). */
export function carInterior(cls: CarClass): Interior {
  const hit = cache.get(cls);
  if (hit) return hit;
  const P = PALETTES[cls];
  const c = cabinOf(cls);
  const [hx, hy, hz] = c.head;
  const half = c.half;
  const sport = cls === 'sport';
  const taxi = cls === 'taxi';
  const seatY = hy - 0.74;
  const leather: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const glowColor = new THREE.Color(...P.glow);
  const dimGlow = glowColor.clone().multiplyScalar(0.55);

  // ---- Painel: a camada de cima (do para-brisa até ~60 cm dos olhos) e a de baixo (a dos joelhos) ----
  const top = c.dash + 0.02;
  const rear = hz + (sport ? 0.55 : 0.6);
  const width = half * 2 - 0.04;
  const front = c.front + 0.02;
  trim.push(part(rgb(P.dash), width, 0.3, front - rear, [0, top - 0.15, (front + rear) / 2], 0, 0.06));
  trim.push(part(rgb(P.lower), width - 0.04, 0.26, 0.42, [0, top - 0.42, rear + 0.2], -0.25, 0.06));
  // Friso de bronze de ponta a ponta e, logo abaixo, o filete de luz (fino: com o brilho, um filete grosso estoura).
  metal.push(part(GOLD, width - 0.16, 0.018, 0.012, [0, top - 0.11, rear - 0.004]));
  glow.push(part(glowColor, width - 0.2, 0.004, 0.006, [0, top - 0.128, rear - 0.006]));
  // Saídas de ar: nas pontas e no centro (lâminas em bronze sobre fundo escuro).
  for (const x of [hx + 0.34, -hx - 0.34, 0.15, -0.15]) {
    if (Math.abs(x) > half - 0.1) continue;
    trim.push(part(rgb(P.console), 0.15, 0.05, 0.02, [x, top - 0.055, rear - 0.004], 0, 0.008));
    for (const dy of [-0.014, 0, 0.014]) metal.push(part(GOLD, 0.13, 0.004, 0.012, [x, top - 0.055 + dy, rear - 0.012]));
  }
  // Coifa do quadro no esportivo (o quadro fica embutido, sob ela).
  if (sport) trim.push(part(rgb(P.dash), 0.4, 0.045, 0.16, [hx, top + 0.012, rear + 0.04], 0, 0.02));

  // ---- Telas ----
  const clusterY = sport ? top - 0.045 : top + (taxi ? 0.075 : 0.05);
  const clusterZ = sport ? rear - 0.012 : rear + 0.03;
  const cluster: Screen = { position: [hx, clusterY, clusterZ], tilt: facing(hy, hz, clusterY, clusterZ), yaw: 0, size: sport ? [0.28, 0.095] : taxi ? [0.36, 0.13] : [0.34, 0.12] };
  const screenY = top - (sport ? 0.06 : 0.035);
  const screenZ = rear - 0.03;
  const screen: Screen = {
    position: [0, screenY, screenZ],
    tilt: facing(hy, hz, screenY, screenZ) * 0.8,
    // Virada para o motorista (que fica em +x).
    yaw: -Math.atan2(hx, screenZ - hz) * 0.7,
    size: sport ? [0.22, 0.14] : [0.26, 0.165],
  };
  trim.push(bezel(cluster), bezel(screen));

  // ---- Volante e coluna ----
  const wheelTilt = taxi ? 0.6 : 0.42;
  const wheelPos: [number, number, number] = [hx, hy - (sport ? 0.4 : taxi ? 0.5 : 0.45), hz + (sport ? 0.36 : taxi ? 0.42 : 0.4)];
  trim.push(part(rgb(P.console), 0.08, 0.08, 0.34, [wheelPos[0], wheelPos[1] - Math.sin(wheelTilt) * 0.2, wheelPos[2] + Math.cos(wheelTilt) * 0.2], wheelTilt, 0.02));

  // ---- Console central (seletor em bronze, base de carga acesa) e assoalho ----
  const consoleBack = hz - 0.35;
  const consoleFront = rear + 0.25;
  trim.push(part(rgb(P.console), 0.26, 0.22, consoleFront - consoleBack, [0, seatY + 0.04, (consoleFront + consoleBack) / 2], 0, 0.04));
  metal.push(part(GOLD, 0.05, 0.05, 0.07, [0, seatY + 0.18, hz + 0.3], 0, 0.02));
  glow.push(part(dimGlow, 0.11, 0.004, 0.14, [0, seatY + 0.153, hz + 0.08]));
  trim.push(part(rgb(P.floor), half * 2 - 0.1, 0.04, c.front - c.back, [0, Math.max(0.3, seatY - 0.12), (c.front + c.back) / 2]));

  // ---- Portas: painel, apoio de braço, puxador e o filete de luz ----
  const doorBack = hz - 0.55;
  const doorFront = c.front - 0.12;
  for (const s of [1, -1]) {
    const x = s * (half - 0.03);
    trim.push(part(rgb(P.lower), 0.05, 0.42, doorFront - doorBack, [x, c.dash - 0.2, (doorFront + doorBack) / 2], 0, 0.02));
    leather.push(part(rgb(P.seat), 0.09, 0.06, 0.46, [x - s * 0.05, seatY + 0.3, hz + 0.05], 0, 0.025));
    metal.push(part(GOLD, 0.02, 0.022, 0.17, [x - s * 0.04, c.dash - 0.1, hz + 0.3], 0, 0.008));
    glow.push(part(dimGlow, 0.006, 0.004, doorFront - doorBack - 0.2, [x - s * 0.028, c.dash - 0.02, (doorFront + doorBack) / 2]));
  }

  // ---- Bancos da frente: assento e encosto com abas, miolo em outro tom, apoio de cabeça ----
  const seat = rgb(P.seat);
  const insert = rgb(P.insert);
  for (const x of [hx, -hx]) {
    leather.push(part(seat, 0.52, 0.12, 0.52, [x, seatY, hz + 0.08], 0, 0.045));
    leather.push(part(insert, 0.32, 0.02, 0.44, [x, seatY + 0.065, hz + 0.08], 0, 0.008));
    for (const s of [1, -1]) {
      leather.push(part(seat, 0.08, 0.09, 0.48, [x + s * 0.23, seatY + 0.08, hz + 0.08], 0, 0.035));
      leather.push(part(seat, 0.09, 0.6, 0.12, [x + s * 0.22, seatY + 0.38, hz - 0.21], -0.18, 0.04));
    }
    leather.push(part(seat, 0.5, 0.68, 0.11, [x, seatY + 0.37, hz - 0.25], -0.18, 0.045));
    leather.push(part(insert, 0.3, 0.52, 0.02, [x, seatY + 0.36, hz - 0.19], -0.18, 0.008));
    leather.push(part(seat, 0.27, 0.17, 0.1, [x, seatY + 0.83, hz - 0.33], -0.12, 0.045));
  }
  // Banco de trás (sedã e táxi), se couber.
  const rearZ = hz - 1.0;
  if (!sport && rearZ - 0.3 > c.back) {
    leather.push(part(seat, half * 2 - 0.2, 0.14, 0.5, [0, seatY, rearZ], 0, 0.05));
    leather.push(part(seat, half * 2 - 0.2, 0.6, 0.12, [0, seatY + 0.34, rearZ - 0.3], -0.16, 0.05));
    leather.push(part(insert, half * 2 - 0.5, 0.48, 0.02, [0, seatY + 0.34, rearZ - 0.235], -0.16, 0.008));
  }

  // ---- Retrovisor (perto do alto do para-brisa) ----
  const mirrorY = c.roof - 0.09;
  trim.push(part(rgb(P.console), 0.2, 0.055, 0.025, [0, mirrorY, hz + 0.36], 0.2, 0.014));
  trim.push(part(rgb('#3a4250'), 0.185, 0.042, 0.004, [0, mirrorY, hz + 0.346], 0.2));
  trim.push(part(rgb(P.console), 0.018, 0.07, 0.018, [0, mirrorY + 0.05, hz + 0.37]));

  const out: Interior = {
    leather: merge(leather),
    trim: merge(trim),
    metal: merge(metal),
    glow: merge(glow),
    wheel: steeringWheel(sport ? 0.165 : taxi ? 0.19 : 0.185, rgb(P.rim), rgb(P.console)),
    wheelAt: { position: wheelPos, tilt: wheelTilt },
    cluster,
    screen,
    head: c.head,
  };
  cache.set(cls, out);
  return out;
}

/** Cabine do carro voador (no espaço do modelo, antes da escala 0,85): painel largo, manche, poltronas claras. */
export function hoverInterior(): Interior {
  const hit = cache.get('hover');
  if (hit) return hit;
  const head: [number, number, number] = [0, 0.42, 0.05];
  const leather: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const seat = rgb('#d9d2c5');
  const insert = rgb('#8f8270');
  trim.push(part(rgb('#1a1c21'), 1.3, 0.22, 0.5, [0, 0.02, 1.05], 0, 0.08));
  metal.push(part(GOLD, 1.1, 0.014, 0.01, [0, 0.07, 0.795]));
  glow.push(part(new THREE.Color(0.32, 0.6, 1.0), 1.05, 0.004, 0.006, [0, 0.05, 0.793]));
  trim.push(part(rgb('#121317'), 1.5, 0.05, 2.4, [0, -0.34, 0.2]));
  trim.push(part(rgb('#121317'), 0.2, 0.18, 0.7, [0, -0.24, 0.5], 0, 0.04));
  for (const x of [0.32, -0.32]) {
    leather.push(part(seat, 0.46, 0.12, 0.5, [x, -0.28, 0.15], 0, 0.05));
    leather.push(part(insert, 0.28, 0.02, 0.42, [x, -0.215, 0.15], 0, 0.008));
    leather.push(part(seat, 0.46, 0.62, 0.12, [x, 0.06, -0.15], -0.2, 0.05));
    leather.push(part(insert, 0.28, 0.48, 0.02, [x, 0.05, -0.085], -0.2, 0.008));
  }
  const cluster: Screen = { position: [0, 0.17, 0.86], tilt: facing(head[1], head[2], 0.17, 0.86), yaw: 0, size: [0.5, 0.18] };
  const screen: Screen = { position: [0.42, 0.12, 0.88], tilt: facing(head[1], head[2], 0.12, 0.88), yaw: -0.4, size: [0.24, 0.16] };
  trim.push(bezel(cluster), bezel(screen));
  const out: Interior = {
    leather: merge(leather),
    trim: merge(trim),
    metal: merge(metal),
    glow: merge(glow),
    wheel: steeringWheel(0.13, rgb('#1d1f24'), rgb('#101114')),
    wheelAt: { position: [0, 0.0, 0.62], tilt: 0.5 },
    cluster,
    screen,
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
  texture.anisotropy = 4;
  let last = '';
  return {
    texture,
    /** Desenha só se `key` mudou (velocidade arredondada, marcha, posição no mapa…). */
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
const INK = '#f2e8d5';
const MUTED = '#8f9aab';
const FAINT = 'rgba(120,140,170,0.22)';

function background(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#04060c');
  g.addColorStop(1, '#0b1322');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Brilho suave no centro (o vidro da tela) e o fio dourado no alto.
  const glow = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, w * 0.55);
  glow.addColorStop(0, 'rgba(127,166,245,0.10)');
  glow.addColorStop(1, 'rgba(127,166,245,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(199,168,106,0.55)';
  ctx.fillRect(w * 0.3, 0, w * 0.4, Math.max(2, h * 0.008));
}

/**
 * Quadro de instrumentos: velocímetro em arco (com marcas a cada 20 km/h e a
 * máxima do carro), velocidade grande no centro, estrada estilizada abaixo
 * dela, marchas à esquerda (P R N D, ou o número no esportivo) e, à direita,
 * a carga com a autonomia estimada — ou a altitude, no voador.
 */
export function paintCluster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kmh: number,
  max: number,
  gear: string,
  extra: { label: string; value: string; share: number; sub?: string },
  mode: string,
) {
  background(ctx, w, h);
  const cx = w * 0.5;
  // Arco do velocímetro.
  const cy = h * 0.98;
  const r = h * 0.78;
  const a0 = Math.PI * 1.08;
  const a1 = Math.PI * 1.92;
  const k = Math.min(1, kmh / max);
  ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.035;
  ctx.strokeStyle = FAINT;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1);
  ctx.stroke();
  const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  grad.addColorStop(0, '#5f87de');
  grad.addColorStop(0.6, '#a9c1f5');
  grad.addColorStop(1, '#ead9b2');
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * Math.max(0.004, k));
  ctx.stroke();
  // Marcas a cada 20 km/h (as dezenas pares levam o número).
  ctx.font = `500 ${Math.round(h * 0.06)}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= max + 0.1; v += 20) {
    const a = a0 + ((a1 - a0) * v) / max;
    const on = v <= kmh;
    ctx.strokeStyle = on ? 'rgba(234,217,178,0.85)' : 'rgba(143,154,171,0.5)';
    ctx.lineWidth = h * 0.012;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - h * 0.05), cy + Math.sin(a) * (r - h * 0.05));
    ctx.lineTo(cx + Math.cos(a) * (r - h * 0.09), cy + Math.sin(a) * (r - h * 0.09));
    ctx.stroke();
    if (v % 40 === 0) {
      ctx.fillStyle = on ? INK : MUTED;
      ctx.fillText(String(v), cx + Math.cos(a) * (r - h * 0.15), cy + Math.sin(a) * (r - h * 0.15));
    }
  }
  // Velocidade.
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${Math.round(h * 0.34)}px ${FONT}`;
  ctx.fillText(String(Math.round(kmh)), cx, h * 0.62);
  ctx.font = `500 ${Math.round(h * 0.075)}px ${MONO}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('KM/H', cx, h * 0.72);
  // A estrada à frente, estilizada (as faixas descem quando o carro anda).
  ctx.strokeStyle = 'rgba(127,166,245,0.35)';
  ctx.lineWidth = h * 0.01;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * w * 0.03, h * 0.78);
    ctx.lineTo(cx + s * w * 0.09, h * 0.97);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(234,217,178,0.55)';
  const phase = ((kmh * 0.37) % 1) * h * 0.06;
  for (let y = h * 0.78 + phase; y < h * 0.97; y += h * 0.06) ctx.fillRect(cx - w * 0.002, y, w * 0.004, h * 0.025);
  // Marchas (à esquerda): a atual acesa.
  ctx.textAlign = 'left';
  if (/^[PRND]$/.test(gear)) {
    ctx.font = `600 ${Math.round(h * 0.13)}px ${FONT}`;
    'PRND'.split('').forEach((g, i) => {
      ctx.fillStyle = g === gear ? (g === 'R' ? '#e0683a' : '#ead9b2') : 'rgba(143,154,171,0.45)';
      ctx.fillText(g, w * 0.06 + i * w * 0.045, h * 0.5);
    });
  } else {
    ctx.font = `600 ${Math.round(h * 0.26)}px ${FONT}`;
    ctx.fillStyle = '#ead9b2';
    ctx.fillText(gear, w * 0.07, h * 0.56);
  }
  ctx.font = `500 ${Math.round(h * 0.06)}px ${MONO}`;
  ctx.fillStyle = 'rgba(199,168,106,0.8)';
  ctx.fillText(mode, w * 0.06, h * 0.68);
  // Carga ou altitude (à direita), com barra e linha de apoio.
  ctx.textAlign = 'right';
  ctx.font = `500 ${Math.round(h * 0.065)}px ${MONO}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(extra.label, w * 0.94, h * 0.3);
  ctx.font = `600 ${Math.round(h * 0.15)}px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText(extra.value, w * 0.94, h * 0.47);
  const bx = w * 0.73;
  const bw = w * 0.21;
  ctx.fillStyle = FAINT;
  ctx.fillRect(bx, h * 0.53, bw, h * 0.03);
  ctx.fillStyle = '#7fa6f5';
  ctx.fillRect(bx, h * 0.53, bw * Math.max(0, Math.min(1, extra.share)), h * 0.03);
  if (extra.sub) {
    ctx.font = `500 ${Math.round(h * 0.065)}px ${MONO}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(extra.sub, w * 0.94, h * 0.68);
  }
  // Marca, discreta, no alto.
  ctx.textAlign = 'center';
  ctx.font = `500 ${Math.round(h * 0.055)}px ${MONO}`;
  ctx.fillStyle = 'rgba(199,168,106,0.75)';
  ctx.fillText('B E Z A L E L', cx, h * 0.1);
}

/** Cores dos locais no mapa (as mesmas dos marcadores da cidade). */
const PLACE_COLORS: Record<PlaceId, string> = {
  'bezalel-hq': '#e8c77a',
  'ai-lab': '#5fd3ee',
  'products-center': '#d9a36a',
  plaza: '#f2e8d5',
  arrival: '#8fd19e',
};

/**
 * Tela central: navegação da cidade com o carro no meio, a frente sempre para
 * cima — ruas, a praça e os cinco locais nas posições reais —, a hora e o
 * rumo (graus a partir do norte).
 */
export function paintCenter(ctx: CanvasRenderingContext2D, w: number, h: number, time: string, nav: { x: number; z: number; heading: number }) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b111d';
  ctx.fillRect(0, 0, w, h);
  // Mundo → tela: o carro em (cx, cy), a frente para cima, 1 m = s px.
  const s = w / 230;
  const cx = w / 2;
  const cy = h * 0.66;
  const c = Math.cos(nav.heading);
  const n = Math.sin(nav.heading);
  const a = -s * c;
  const b = -s * n;
  const cc = s * n;
  const d = -s * c;
  const at = (x: number, z: number) => [cx + a * (x - nav.x) + cc * (z - nav.z), cy + b * (x - nav.x) + d * (z - nav.z)] as const;
  ctx.setTransform(a, b, cc, d, cx - (a * nav.x + cc * nav.z), cy - (b * nav.x + d * nav.z));
  // Ruas (largura real) e o eixo de cada uma.
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#25324a';
  ctx.lineWidth = ROAD_WIDTH;
  ctx.beginPath();
  for (const l of STREET_LINES) {
    ctx.moveTo(l, -WORLD_HALF);
    ctx.lineTo(l, WORLD_HALF);
    ctx.moveTo(-WORLD_HALF, l);
    ctx.lineTo(WORLD_HALF, l);
  }
  // A avenida que liga a chegada à Sede, passando pela praça.
  ctx.moveTo(0, -110);
  ctx.lineTo(0, 110);
  ctx.moveTo(-110, 0);
  ctx.lineTo(110, 0);
  ctx.stroke();
  ctx.fillStyle = '#1b2538';
  ctx.beginPath();
  ctx.arc(0, 0, PLAZA_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Locais.
  for (const p of PLACES) {
    const [x, y] = at(p.pad.x, p.pad.z);
    if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
    ctx.fillStyle = PLACE_COLORS[p.id];
    ctx.beginPath();
    ctx.arc(x, y, h * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  // O carro: a seta dourada, com o cone de visão.
  const cone = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.4);
  cone.addColorStop(0, 'rgba(234,217,178,0.25)');
  cone.addColorStop(1, 'rgba(234,217,178,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, h * 0.4, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ead9b2';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.06);
  ctx.lineTo(cx + h * 0.04, cy + h * 0.04);
  ctx.lineTo(cx, cy + h * 0.015);
  ctx.lineTo(cx - h * 0.04, cy + h * 0.04);
  ctx.closePath();
  ctx.fill();
  // Barra de cima: hora e rumo.
  ctx.fillStyle = 'rgba(4,6,12,0.75)';
  ctx.fillRect(0, 0, w, h * 0.17);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(h * 0.1)}px ${FONT}`;
  ctx.fillText(time, w * 0.05, h * 0.085);
  // Rumo: 0° = norte (−z); o carro com heading π olha para o norte.
  const bearing = Math.round(((((Math.PI - nav.heading) * 180) / Math.PI) % 360) + 360) % 360;
  ctx.textAlign = 'right';
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${Math.round(h * 0.075)}px ${MONO}`;
  ctx.fillText(`${String(bearing).padStart(3, '0')}°`, w * 0.95, h * 0.085);
}
