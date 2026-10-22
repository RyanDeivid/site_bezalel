import * as THREE from 'three';
import { BloomPipeline } from '@/features/universe/scene/bloom';
import { choreography, clamp01 } from '../journey';
import type { SculptMessage } from '../sculpture/worker';

/**
 * Apocalipse 5 em luz, conduzido pela rolagem (three.js puro, como a Forja).
 *
 * - Um livro em rolo, com sete selos de lacre, flutua no escuro dentro de um
 *   redemoinho de poeira de luz. O cursor é uma luz que afasta a poeira.
 * - Com a rolagem, cada partícula sai do redemoinho por um caminho próprio e
 *   pousa num ponto da superfície do leão (amostrada da escultura em campo de
 *   distância, num worker): o leão é feito da mesma poeira, não sobreposto a
 *   ela. A borda do leão (onde a superfície fica de perfil) brilha mais — o
 *   contorno é desenhado pela luz.
 * - Os sete selos quebram um a um, cada um numa explosão de faíscas, e o livro
 *   se desenrola, aceso por dentro.
 * Todo o movimento das partículas é calculado na placa de vídeo (um shader);
 * a CPU só atualiza uniformes. O laço para fora da tela e com a aba oculta.
 */

export type RevelationQuality = 'high' | 'medium' | 'low';

export interface RevelationOptions {
  canvas: HTMLCanvasElement;
  quality: RevelationQuality;
  reducedMotion: boolean;
  allowSoftware?: boolean;
  onReady?: () => void;
  onContextLost?: () => void;
}

export interface RevelationScene {
  /** Fração da rolagem (0..1). A cena persegue o valor com suavidade. */
  setProgress(p: number): void;
  /** Cursor em coordenadas normalizadas (−1..1), ou null quando sai do palco. */
  setPointer(x: number | null, y: number): void;
  setVisible(on: boolean): void;
  resize(): void;
  dispose(): void;
}

export class SoftwareRendererError extends Error {
  constructor(renderer: string) {
    super(`WebGL por software (${renderer}): experiência 3D desativada`);
    this.name = 'SoftwareRendererError';
  }
}

const SETTINGS: Record<RevelationQuality, { count: number; cell: number; dpr: number; bloom: boolean; stars: number; sparks: number }> = {
  high: { count: 140_000, cell: 0.016, dpr: 1.75, bloom: true, stars: 3200, sparks: 220 },
  medium: { count: 70_000, cell: 0.02, dpr: 1.5, bloom: true, stars: 2000, sparks: 140 },
  low: { count: 32_000, cell: 0.026, dpr: 1.25, bloom: false, stars: 1200, sparks: 90 },
};

/** O leão fica centrado na origem (a escultura nasce com as patas em y = 0). */
const LION_OFFSET = new THREE.Vector3(-0.25, -0.95, 0);
const BOOK_START = new THREE.Vector3(0, 0.15, 0);
/** Diante do rosto do leão (o focinho fica perto de x = 1,1). */
const BOOK_END = new THREE.Vector3(2.05, 0.55, 0.35);

const BG = new THREE.Color('#03060d');

/** Câmera ao longo da rolagem: posição e alvo em quadros-chave (interpolados com suavidade). */
const SHOTS: Array<{ p: number; pos: [number, number, number]; look: [number, number, number] }> = [
  { p: 0, pos: [0, 0.25, 6.4], look: [0, 0.15, 0] },
  { p: 0.3, pos: [0.35, 0.3, 3.4], look: [0, 0.15, 0] },
  { p: 0.38, pos: [0.3, 0.3, 3.2], look: [0, 0.12, 0] },
  // Assim que o leão começa a se formar, a câmera recua: o momento tem de ser visto de fora do redemoinho.
  { p: 0.45, pos: [1.8, 0.75, 6.4], look: [0.1, -0.15, 0] },
  { p: 0.62, pos: [3.4, 1.0, 6.3], look: [0.35, -0.2, 0] },
  { p: 0.84, pos: [3.3, 0.8, 4.0], look: [1.35, 0.15, 0.15] },
  { p: 1, pos: [1.4, 0.8, 7.8], look: [0.75, -0.05, 0] },
];

function shotAt(p: number, pos: THREE.Vector3, look: THREE.Vector3) {
  let i = 0;
  while (i < SHOTS.length - 2 && p > SHOTS[i + 1]!.p) i++;
  const a = SHOTS[i]!;
  const b = SHOTS[i + 1]!;
  const t = clamp01((p - a.p) / (b.p - a.p));
  const k = t * t * (3 - 2 * t);
  pos.set(...a.pos).lerp(new THREE.Vector3(...b.pos), k);
  look.set(...a.look).lerp(new THREE.Vector3(...b.look), k);
}

const PARTICLE_VERT = /* glsl */ `
attribute vec3 aTarget;
attribute vec3 aNormal;
attribute vec4 aSeed;
attribute float aShade;
uniform float uTime;
uniform float uForm;
uniform float uStir;
uniform float uRise;
uniform float uSize;
uniform float uPixel;
uniform vec3 uBook;
uniform vec3 uRayO;
uniform vec3 uRayD;
uniform float uMouse;
varying vec3 vColor;

void main() {
  // O redemoinho em volta do livro: discos inclinados, mais rápidos perto do centro.
  float r = 0.75 + aSeed.x * aSeed.x * 4.6;
  float speed = (0.22 + uStir * 0.55) / (0.35 + r * 0.32);
  float th = aSeed.y * 6.28318 + uTime * speed;
  float h = (aSeed.z - 0.5) * (0.18 + r * 0.16) * (1.0 + uStir * 0.6);
  vec3 vortex = uBook + vec3(cos(th) * r, h + sin(th * 2.0 + aSeed.w * 6.0) * 0.06, sin(th) * r * 0.5);

  // Cada partícula parte na sua hora e faz uma curva própria até o seu ponto do leão.
  float k = clamp(uForm * 1.65 - aSeed.w * 0.65, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec3 drift = vec3(sin(aSeed.x * 41.0 + uTime * 0.7), cos(aSeed.y * 33.0 + uTime * 0.55), sin(aSeed.z * 19.0 + uTime * 0.6));
  vec3 pos = mix(vortex, aTarget, k) + drift * sin(k * 3.14159) * (0.6 + aSeed.x * 0.8);

  // Formado, o leão respira; no fim, a luz sobe e se espalha.
  pos += aNormal * sin(uTime * 1.2 + aTarget.x * 3.0 + aTarget.y * 2.0) * 0.012 * k;
  // Uma parte da luz sobe (as partículas mais leves); o leão continua lá, mais tênue.
  pos += (vec3(0.0, 1.0, 0.0) * aSeed.x * 0.9 + drift * 0.18) * uRise * k * step(0.55, aSeed.w) * aSeed.w;

  // O cursor é um redemoinho de luz: em volta do raio que sai dele, a poeira (e o leão) gira e acende,
  // sem abrir um buraco (só um pouco para fora, o bastante para sentir o toque).
  vec3 rel = pos - uRayO;
  vec3 away = rel - uRayD * dot(rel, uRayD);
  float d2 = dot(away, away);
  float f = exp(-d2 / 0.06) * uMouse;
  // Rotação em volta do raio: cada partícula mantém a distância (nada de buraco), só muda de ângulo —
  // mais perto do cursor, gira mais.
  float ang = f * (1.4 + 0.3 * sin(uTime * 2.0 + aSeed.y * 20.0));
  vec3 turned = away * cos(ang) + cross(uRayD, away) * sin(ang);
  pos += turned - away;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // Cor: a poeira entre azul e ouro; o leão em ouro, com a borda (de perfil para a câmera) mais clara.
  vec3 n = normalize(normalMatrix * aNormal);
  float rim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
  vec3 dust = mix(vec3(0.36, 0.52, 1.0), vec3(1.0, 0.76, 0.4), aSeed.z) * (0.24 + uStir * 0.3);
  vec3 body = mix(vec3(0.6, 0.38, 0.15), vec3(1.0, 0.82, 0.52), aShade * aShade);
  vec3 lion = body * (0.32 + 1.1 * pow(rim, 2.2)) + vec3(0.4, 0.6, 1.0) * pow(rim, 5.0) * 0.6;
  vColor = mix(dust, lion, k) * (1.0 + f * 1.6) * (1.0 + uRise * 0.3);
  // Perto da câmera, a partícula não cresce sem limite (viraria um borrão branco com o brilho).
  gl_PointSize = min(uSize * uPixel * (0.55 + aSeed.w * 0.9) / max(0.1, -mv.z) * mix(1.5, 1.0, k), 9.0 * uPixel);
}`;

const POINT_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = exp(-d * 14.0);
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

const STAR_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPixel;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.6 + 0.4 * sin(uTime * (0.6 + aSeed * 2.0) + aSeed * 40.0);
  vColor = mix(vec3(0.6, 0.7, 1.0), vec3(1.0, 0.9, 0.75), fract(aSeed * 7.0)) * tw * (0.25 + aSeed * 0.5);
  gl_PointSize = (1.0 + aSeed * 2.2) * uPixel;
}`;

const SPARK_VERT = /* glsl */ `
attribute vec4 aDir;
attribute float aSeal;
uniform float uBreak[7];
uniform vec3 uSeal[7];
uniform float uPixel;
varying vec3 vColor;
void main() {
  int i = int(aSeal);
  float b = uBreak[i];
  vec3 dir = aDir.xyz;
  float t = clamp(b, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - t, 3.0);
  vec3 pos = uSeal[i] + dir * e * (0.4 + aDir.w * 0.9) + vec3(0.0, -0.35, 0.0) * t * t;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float alive = step(0.001, b) * (1.0 - t);
  vColor = mix(vec3(1.0, 0.45, 0.2), vec3(1.0, 0.85, 0.55), aDir.w) * alive * 2.2;
  gl_PointSize = (6.0 + aDir.w * 10.0) * uPixel / max(0.1, -mv.z) * alive;
}`;

const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform float uTime;
uniform float uGlow;
float hash(vec3 p) { return fract(sin(dot(p, vec3(17.1, 113.3, 41.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main() {
  vec3 d = normalize(vDir);
  float n = 0.0;
  float a = 0.55;
  vec3 q = d * 2.2 + vec3(0.0, 0.0, uTime * 0.01);
  for (int i = 0; i < 4; i++) { n += a * noise(q); q *= 2.1; a *= 0.5; }
  // Nebulosa: azul profundo e violeta, um véu dourado perto do livro (que cresce quando ele se abre).
  vec3 col = vec3(0.012, 0.022, 0.05);
  col += vec3(0.05, 0.07, 0.16) * smoothstep(0.45, 0.95, n) * (0.6 + 0.4 * d.y);
  col += vec3(0.09, 0.04, 0.12) * smoothstep(0.6, 1.0, n) * 0.6;
  col += vec3(0.5, 0.34, 0.14) * uGlow * pow(max(0.0, d.z * 0.5 + d.x * 0.4 + 0.2), 3.0) * 0.08;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Textura da folha do livro: linhas de escrita (abstratas, não um texto) que acendem por dentro. */
function scriptTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  let s = 11;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  ctx.strokeStyle = '#ffd99a';
  ctx.lineCap = 'round';
  for (let col = 0; col < 3; col++)
    for (let y = 46; y < 470; y += 26) {
      let x = 60 + col * 320;
      const end = x + 250 - rand() * 40;
      while (x < end) {
        const w = 6 + rand() * 22;
        ctx.lineWidth = 2 + rand() * 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y + (rand() - 0.5) * 3);
        ctx.quadraticCurveTo(x + w / 2, y - 4 - rand() * 8, x + w, y + (rand() - 0.5) * 4);
        ctx.stroke();
        x += w + 4 + rand() * 6;
      }
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createRevelationScene({ canvas, quality, reducedMotion, allowSoftware = false, onReady, onContextLost }: RevelationOptions): RevelationScene {
  const cfg = SETTINGS[quality];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !cfg.bloom, alpha: false, powerPreference: 'high-performance' });
  const ctx = renderer.getContext();
  const info = ctx.getExtension('WEBGL_debug_renderer_info');
  const rendererName = String(info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
  if (!allowSoftware && /swiftshader|llvmpipe|softpipe|software|basic render driver/i.test(rendererName)) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw new SoftwareRendererError(rendererName);
  }
  const dpr = Math.min(window.devicePixelRatio || 1, cfg.dpr);
  renderer.setPixelRatio(dpr);
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(BG, 1);
  const bloom = cfg.bloom ? new BloomPipeline(renderer, { strength: 0.85, threshold: 0.55, knee: 0.5, levels: quality === 'high' ? 6 : 5, antialias: 'fxaa' }, false) : null;

  const scene = new THREE.Scene();
  scene.background = BG;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 120);
  const time = { value: 0 };
  const pixel = { value: dpr };

  // ---- Céu: nebulosa e estrelas ----
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKY_FRAG,
    uniforms: { uTime: time, uGlow: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), skyMat);
  scene.add(sky);
  const starGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(cfg.stars * 3);
    const seed = new Float32Array(cfg.stars);
    for (let i = 0; i < cfg.stars; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 20;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * s * r, u * r, Math.sin(th) * s * r], i * 3);
      seed[i] = Math.random();
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  }
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: POINT_FRAG, uniforms: { uTime: time, uPixel: pixel }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(stars);

  // ---- O livro: dois rolos, a folha entre eles e os sete selos na emenda ----
  scene.add(new THREE.HemisphereLight('#8aa4d6', '#120c08', 0.5));
  const bookLight = new THREE.PointLight('#ffcf8a', 3, 6, 1.6);
  scene.add(bookLight);
  const key = new THREE.DirectionalLight('#f3e3c4', 1.1);
  key.position.set(2, 3, 4);
  scene.add(key);
  const book = new THREE.Group();
  scene.add(book);
  const H = 1.0;
  const rollMat = new THREE.MeshStandardMaterial({ color: '#d8c39a', roughness: 0.75, emissive: '#3a2810', emissiveIntensity: 0.12 });
  const rodMat = new THREE.MeshStandardMaterial({ color: '#2a1a0e', roughness: 0.5, metalness: 0.2 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#c7a86a', roughness: 0.3, metalness: 1, emissive: '#c7a86a', emissiveIntensity: 0.15 });
  const rolls: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, H, 40), rollMat));
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, H + 0.34, 16), rodMat);
    g.add(rod);
    for (const y of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 12), capMat);
      cap.position.y = y * (H / 2 + 0.17);
      g.add(cap);
    }
    g.userData.side = s;
    rolls.push(g);
    book.add(g);
  }
  const script = scriptTexture();
  const sheetMat = new THREE.MeshStandardMaterial({ color: '#e7d4ab', roughness: 0.85, emissive: '#ffcf8a', emissiveMap: script, emissiveIntensity: 0, side: THREE.DoubleSide });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, H * 0.94), sheetMat);
  sheet.position.z = 0.02;
  book.add(sheet);
  const sealMat = Array.from({ length: 7 }, () => new THREE.MeshStandardMaterial({ color: '#7a1c16', roughness: 0.45, metalness: 0.1, emissive: '#ff4a1c', emissiveIntensity: 0.3 }));
  const sealGeo = new THREE.CylinderGeometry(0.052, 0.058, 0.03, 28).rotateX(Math.PI / 2);
  const seals = sealMat.map((m, i) => {
    const mesh = new THREE.Mesh(sealGeo, m);
    mesh.position.set(0, (3 - i) * 0.13, 0.13);
    book.add(mesh);
    return mesh;
  });
  // Brilho atrás do livro (cresce com os selos quebrados).
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,220,160,1)');
    grad.addColorStop(0.3, 'rgba(255,180,90,0.35)');
    grad.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.25 }));
  halo.scale.setScalar(2.2);
  halo.position.z = -0.2;
  book.add(halo);

  // ---- Faíscas dos selos ----
  const sparkGeo = new THREE.BufferGeometry();
  {
    const n = cfg.sparks * 7;
    const pos = new Float32Array(n * 3);
    const dir = new Float32Array(n * 4);
    const seal = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      dir.set([Math.cos(th) * s, u * 0.8 + 0.2, Math.sin(th) * s * 0.6 + 0.4, Math.random()], i * 4);
      seal[i] = Math.floor(i / cfg.sparks);
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sparkGeo.setAttribute('aDir', new THREE.BufferAttribute(dir, 4));
    sparkGeo.setAttribute('aSeal', new THREE.BufferAttribute(seal, 1));
  }
  const sparkMat = new THREE.ShaderMaterial({
    vertexShader: SPARK_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: { uBreak: { value: new Array(7).fill(0) }, uSeal: { value: Array.from({ length: 7 }, () => new THREE.Vector3()) }, uPixel: pixel },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);

  // ---- A poeira que vira leão (as posições-alvo chegam do worker) ----
  const uniforms = {
    uTime: time,
    uForm: { value: 0 },
    uStir: { value: 0 },
    uRise: { value: 0 },
    uSize: { value: 7.5 * (quality === 'low' ? 1.5 : quality === 'medium' ? 1.2 : 1) },
    uPixel: pixel,
    uBook: { value: BOOK_START.clone() },
    uRayO: { value: new THREE.Vector3() },
    uRayD: { value: new THREE.Vector3(0, 0, -1) },
    uMouse: { value: 0 },
  };
  const dustMat = new THREE.ShaderMaterial({ vertexShader: PARTICLE_VERT, fragmentShader: POINT_FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  let dust: THREE.Points | null = null;
  const worker = new Worker(new URL('../sculpture/worker.ts', import.meta.url), { type: 'module', name: 'bz-lion' });
  worker.onmessage = (e: MessageEvent<SculptMessage>) => {
    if (disposed || e.data.kind !== 'samples') return;
    const { positions, normals, shade } = e.data;
    const n = shade.length;
    for (let i = 0; i < n; i++) {
      positions[i * 3] = positions[i * 3]! + LION_OFFSET.x;
      positions[i * 3 + 1] = positions[i * 3 + 1]! + LION_OFFSET.y;
      positions[i * 3 + 2] = positions[i * 3 + 2]! + LION_OFFSET.z;
    }
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    const g = new THREE.BufferGeometry();
    // A posição "de verdade" sai do shader; o atributo position só dá o tamanho do conjunto.
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aTarget', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
    g.setAttribute('aShade', new THREE.BufferAttribute(shade, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    dust = new THREE.Points(g, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);
    void renderer.compileAsync(scene, camera).catch(() => undefined).then(() => {
      if (disposed) return;
      onReady?.();
      request();
    });
  };
  worker.postMessage({ kind: 'samples', count: cfg.count, cell: cfg.cell, seed: 7 });

  // ---- Estado ----
  let target = reducedMotion ? 1 : 0;
  let progress = target;
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  let pointerOn = false;
  let mouse = 0;
  const raycaster = new THREE.Raycaster();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const bookPos = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function apply(dt: number) {
    progress = reducedMotion ? target : progress + (target - progress) * Math.min(1, dt * 3.5);
    const c = choreography(progress);
    if (!reducedMotion) time.value += dt * (1 - c.still * 0.94);
    uniforms.uForm.value = c.form;
    uniforms.uStir.value = c.stir;
    uniforms.uRise.value = c.rise;
    // Livro: sobe e vai para diante do rosto do leão; vira um pouco para a câmera.
    bookPos.copy(BOOK_START).lerp(BOOK_END, c.bookMove);
    bookPos.y += Math.sin(time.value * 0.8) * 0.03;
    book.position.copy(bookPos);
    book.rotation.y = -0.35 * c.bookMove + Math.sin(time.value * 0.4) * 0.05;
    uniforms.uBook.value.copy(bookPos);
    // Selos: pulsam no "quem é digno?" e quebram um a um.
    seals.forEach((s, i) => {
      const b = clamp01(c.seals - i);
      const breaking = b > 0 && b < 1;
      s.visible = b < 0.25;
      s.scale.setScalar(1 + (breaking ? b * 1.8 : 0));
      sealMat[i]!.emissiveIntensity = 0.3 + c.stir * (0.6 + 0.4 * Math.sin(time.value * 4 + i)) + b * 4;
      sparkMat.uniforms.uBreak!.value[i] = b;
      (sparkMat.uniforms.uSeal!.value as THREE.Vector3[])[i]!.copy(s.getWorldPosition(tmp));
    });
    // O livro se abre: os rolos se afastam e a folha acende.
    const open = c.unroll;
    const w = 0.2 + open * 1.7;
    rolls.forEach((r) => (r.position.x = (r.userData.side as number) * (w / 2)));
    sheet.scale.x = Math.max(0.001, w - 0.18);
    sheet.visible = open > 0.002;
    sheetMat.emissiveIntensity = 0.15 + open * 1.1 + c.rise * 0.5;
    halo.material.opacity = 0.14 + (c.seals / 7) * 0.22 + open * 0.24;
    halo.scale.setScalar(1.8 + open * 2 + c.rise);
    bookLight.position.copy(bookPos).add(tmp.set(0, 0, 0.5));
    bookLight.intensity = 1.5 + c.seals * 0.3 + open * 3;
    skyMat.uniforms.uGlow!.value = open + c.rise;
    // Câmera: o caminho da rolagem, com um leve deslocamento pelo cursor (paralaxe).
    pointerSmooth.lerp(pointerOn ? pointer : pointerSmooth.set(pointerSmooth.x * 0.98, pointerSmooth.y * 0.98), Math.min(1, dt * 3));
    shotAt(progress, camPos, camLook);
    const par = reducedMotion ? 0 : 0.35;
    camera.position.copy(camPos).add(tmp.set(pointerSmooth.x * par, pointerSmooth.y * par * 0.6, 0));
    camera.lookAt(camLook);
    // Cursor: o raio que afasta a poeira.
    mouse += ((pointerOn && !reducedMotion ? 1 : 0) - mouse) * Math.min(1, dt * 4);
    uniforms.uMouse.value = mouse;
    raycaster.setFromCamera(pointer, camera);
    uniforms.uRayO.value.copy(raycaster.ray.origin);
    uniforms.uRayD.value.copy(raycaster.ray.direction);
  }

  // ---- Laço ----
  let raf = 0;
  let last = 0;
  let visible = true;
  let disposed = false;
  function request() {
    if (raf || !visible || disposed) return;
    raf = requestAnimationFrame(frame);
  }
  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    apply(dt);
    if (bloom) bloom.render(scene, camera);
    else renderer.render(scene, camera);
    // Com movimento reduzido, só redesenha quando algo muda (rolagem ou tamanho).
    if (!reducedMotion || Math.abs(target - progress) > 1e-4) request();
    else last = 0;
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Em tela estreita (celular em pé), o campo de visão abre para o leão caber.
    camera.fov = camera.aspect < 1 ? 38 + (1 - camera.aspect) * 34 : 38;
    camera.updateProjectionMatrix();
    request();
  }
  resize();
  const onLost = (e: Event) => {
    e.preventDefault();
    onContextLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  const onVisibility = () => setVisibleInner(!document.hidden && visibleWanted);
  document.addEventListener('visibilitychange', onVisibility);
  let visibleWanted = true;
  function setVisibleInner(on: boolean) {
    visible = on;
    if (on) request();
    else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  }

  return {
    setProgress(p) {
      target = clamp01(p);
      request();
    },
    setPointer(x, y) {
      if (x === null) pointerOn = false;
      else {
        pointer.set(x, y);
        pointerOn = true;
      }
      request();
    },
    setVisible(on) {
      visibleWanted = on;
      setVisibleInner(on && !document.hidden);
    },
    resize,
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      worker.terminate();
      canvas.removeEventListener('webglcontextlost', onLost);
      document.removeEventListener('visibilitychange', onVisibility);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((mat) => mat.dispose());
      });
      [script, glowTex].forEach((t) => t.dispose());
      bloom?.dispose();
      renderer.dispose();
    },
  };
}
