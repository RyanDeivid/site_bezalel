import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { SculptMessage } from '../sculpture/worker';

/**
 * A cena do Leão de Judá (three.js puro, como a Forja: o laço de quadros é
 * nosso e só roda quando há o que mudar).
 *
 * Seis estágios, cada um uma geometria de verdade — não partículas sobre um
 * modelo pronto:
 *  0. o contorno, traçado como numa prancheta;
 *  1. a armação de hastes douradas (o esqueleto que o escultor monta);
 *  2. o bloco de estudo em gesso, facetado: só as massas;
 *  3. a forma em argila: cabeça, juba em mechas, músculos;
 *  4. a fundição em bronze, com pátina nas reentrâncias (oclusão por vértice);
 *  5. a obra acabada: luz de museu, inscrição no pedestal.
 * Entre um estágio e outro, a peça nova sobe de baixo para cima, com uma borda
 * incandescente, enquanto a anterior se desfaz na mesma linha.
 */

export type LionQuality = 'high' | 'medium' | 'low';
export type LionView = 'full' | 'head' | 'mane' | 'paws' | 'tail';
export const STAGE_COUNT = 6;

export interface LionSceneOptions {
  canvas: HTMLCanvasElement;
  quality: LionQuality;
  reducedMotion: boolean;
  /** Duas linhas da inscrição do pedestal. */
  plaque: [string, string];
  /** Um estágio ficou pronto para ser mostrado (as malhas chegam do worker aos poucos). */
  onReady?: (stage: number) => void;
  onContextLost?: () => void;
  /** Aceita WebGL por software (só para testes). */
  allowSoftware?: boolean;
}

/** Sem aceleração de vídeo a cena roda na CPU e trava a página: melhor o desenho estático. */
export class SoftwareRendererError extends Error {
  constructor(renderer: string) {
    super(`WebGL por software (${renderer}): escultura 3D desativada`);
    this.name = 'SoftwareRendererError';
  }
}

export interface LionScene {
  /** Mostra o estágio (com a transição, ou num corte seco). */
  setStage(stage: number, animate: boolean): void;
  isReady(stage: number): boolean;
  setView(view: LionView): void;
  /** Gira (rad) e aproxima (fator) pela tecla. */
  nudge(azimuth: number, polar: number, zoom: number): void;
  /** Liga ou desliga o arrastar/pinçar (no toque, só depois de o visitante pedir). */
  setInteractive(on: boolean): void;
  /** A cena está na tela? Fora dela, nada é desenhado. */
  setVisible(on: boolean): void;
  resize(): void;
  dispose(): void;
}

const BG = '#070d17';
const GOLD = new THREE.Color('#c7a86a');
const EDGE = new THREE.Color('#ffb466').multiplyScalar(2.4);
/** Altura do pedestal: a escultura fica em cima dele. */
const BASE_Y = 0.62;
const CUT_FROM = BASE_Y - 0.05;
const CUT_TO = BASE_Y + 2.0;

const VIEWS: Record<LionView, { target: [number, number, number]; position: [number, number, number] }> = {
  full: { target: [0.1, 1.42, 0], position: [3.2, 2.3, 5.1] },
  head: { target: [0.98, 2.02, 0.06], position: [2.3, 2.22, 1.75] },
  mane: { target: [0.66, 1.95, 0.02], position: [0.3, 2.5, 2.05] },
  paws: { target: [0.42, 0.86, 0.1], position: [2.5, 1.38, 2.35] },
  tail: { target: [-0.95, 1.05, 0.05], position: [-3.1, 1.7, 2.9] },
};

const SETTINGS: Record<LionQuality, { dpr: number; shadow: number; antialias: boolean; finalCell: number; formCell: number }> = {
  high: { dpr: 2, shadow: 2048, antialias: true, finalCell: 0.014, formCell: 0.022 },
  medium: { dpr: 1.5, shadow: 1024, antialias: true, finalCell: 0.017, formCell: 0.024 },
  low: { dpr: 1.25, shadow: 0, antialias: false, finalCell: 0.021, formCell: 0.028 },
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Corte que revela (mostra o que está abaixo da linha) ou desfaz (mostra o que está acima), com borda acesa. */
interface Cut {
  uCut: { value: number };
  uDir: { value: number };
  uEdge: { value: number };
}

function newCut(): Cut {
  return { uCut: { value: CUT_TO + 1 }, uDir: { value: 1 }, uEdge: { value: 0 } };
}

/** Aplica o corte a um material padrão (e a quem desenha a sombra dele). */
function withCut<T extends THREE.Material>(material: T, cut: Cut, edge: boolean): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCut = cut.uCut;
    shader.uniforms.uDir = cut.uDir;
    shader.uniforms.uEdge = cut.uEdge;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutPos;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 cutWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cutWorld = instanceMatrix * cutWorld;
        #endif
        vCutPos = (modelMatrix * cutWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCutPos;
        uniform float uCut;
        uniform float uDir;
        uniform float uEdge;
        float cutNoise(vec3 p) { return fract(sin(dot(floor(p * 38.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float cutLine = uCut + (cutNoise(vCutPos) - 0.5) * 0.05 + sin(vCutPos.x * 9.0 + vCutPos.z * 7.0) * 0.015;
        if (uDir * (vCutPos.y - cutLine) > 0.0) discard;`,
      );
    if (edge)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(${EDGE.r.toFixed(3)}, ${EDGE.g.toFixed(3)}, ${EDGE.b.toFixed(3)}) * uEdge * (1.0 - smoothstep(0.0, 0.045, abs(vCutPos.y - cutLine)));`,
      );
  };
  material.customProgramCacheKey = () => `lion-cut-${edge ? 1 : 0}`;
  return material;
}

/** Cores por vértice a partir da oclusão: pátina escura nas reentrâncias, bronze polido no que é exposto e de cima. */
function bronzeColors(normals: Float32Array, ao: Float32Array) {
  const out = new Float32Array(ao.length * 3);
  const patina = new THREE.Color('#1c160e');
  const verdigris = new THREE.Color('#2b3a30');
  const bronze = new THREE.Color('#6a4d2e');
  const polish = new THREE.Color('#c29a5c');
  const c = new THREE.Color();
  for (let i = 0; i < ao.length; i++) {
    const a = ao[i]!;
    const up = Math.max(0, normals[i * 3 + 1]!);
    const deep = THREE.MathUtils.smoothstep(a, 0.35, 0.95);
    c.copy(patina).lerp(verdigris, (1 - deep) * 0.35);
    c.lerp(bronze, deep);
    // O que a mão alcança e a luz de cima pega fica mais polido.
    c.lerp(polish, deep * deep * up * 0.55);
    out.set([c.r, c.g, c.b], i * 3);
  }
  return out;
}

function clayColors(ao: Float32Array) {
  const out = new Float32Array(ao.length * 3);
  const base = new THREE.Color('#ad6f4f');
  const dark = new THREE.Color('#3d2219');
  const c = new THREE.Color();
  for (let i = 0; i < ao.length; i++) {
    c.copy(dark).lerp(base, THREE.MathUtils.smoothstep(ao[i]!, 0.2, 0.85));
    out.set([c.r, c.g, c.b], i * 3);
  }
  return out;
}

/** Inscrição do pedestal (letras douradas gravadas na pedra). */
function plaqueTexture([line1, line2]: [string, string]) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#12151b';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d9bd84';
  ctx.font = "400 54px 'Instrument Serif', Georgia, serif";
  ctx.fillText(line1, c.width / 2, 62);
  ctx.font = "500 26px 'Geist Mono Variable', ui-monospace, monospace";
  ctx.fillStyle = 'rgba(217,189,132,0.75)';
  ctx.fillText(line2, c.width / 2, 120);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Brilho que se esvai do centro para a borda (o chão some no escuro). */
function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#9a9a9a');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createLionScene({ canvas, quality, reducedMotion, plaque, onReady, onContextLost, allowSoftware = false }: LionSceneOptions): LionScene {
  const cfg = SETTINGS[quality];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: cfg.antialias, alpha: false, powerPreference: 'high-performance' });
  const ctx = renderer.getContext();
  const info = ctx.getExtension('WEBGL_debug_renderer_info');
  const rendererName = String(info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
  if (!allowSoftware && /swiftshader|llvmpipe|softpipe|software|basic render driver/i.test(rendererName)) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw new SoftwareRendererError(rendererName);
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.dpr));
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(BG, 1);
  if (cfg.shadow) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.055);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.4;

  // ---- Luz de museu: um foco quente de cima e da frente, contraluz fria, preenchimento baixo ----
  scene.add(new THREE.HemisphereLight('#8aa4d6', '#0b0f18', 0.22));
  const key = new THREE.SpotLight('#f3e3c4', 0, 14, 0.48, 0.65, 1.2);
  key.position.set(2.8, 6.2, 3.6);
  key.target.position.set(0.1, 1.2, 0);
  if (cfg.shadow) {
    key.castShadow = true;
    key.shadow.mapSize.set(cfg.shadow, cfg.shadow);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 12;
  }
  const rim = new THREE.DirectionalLight('#6f9be8', 0);
  rim.position.set(-4.5, 3.2, -3.5);
  const fill = new THREE.DirectionalLight('#c7a86a', 0.18);
  fill.position.set(-2, 1.2, 4);
  scene.add(key, key.target, rim, fill);
  const KEY_ON = 150;
  const RIM_ON = 2.6;

  // ---- Chão, anel e pedestal ----
  const radial = radialTexture();
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#0d1420', roughness: 0.62, metalness: 0.35, alphaMap: radial, transparent: true, depthWrite: false }),
  );
  floor.receiveShadow = !!cfg.shadow;
  floor.renderOrder = -1;
  scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.27, 128).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.5, toneMapped: false }));
  ring.position.y = 0.004;
  scene.add(ring);
  const stone = new THREE.MeshStandardMaterial({ color: '#13161d', roughness: 0.6, metalness: 0.08 });
  const stoneTop = new THREE.MeshStandardMaterial({ color: '#1a1e26', roughness: 0.42, metalness: 0.1 });
  const inlay = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 1, emissive: GOLD, emissiveIntensity: 0.08 });
  const pedestal = new THREE.Group();
  const parts: Array<[THREE.BufferGeometry, THREE.Material, number]> = [
    [new RoundedBoxGeometry(3.2, 0.16, 1.62, 2, 0.03), stone, 0.08],
    [new RoundedBoxGeometry(2.9, 0.38, 1.32, 2, 0.02), stone, 0.35],
    [new RoundedBoxGeometry(3.02, 0.08, 1.44, 2, 0.02), stoneTop, 0.58],
    [new THREE.BoxGeometry(2.92, 0.012, 1.34), inlay, 0.535],
  ];
  for (const [g, m, y] of parts) {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.y = y;
    mesh.castShadow = !!cfg.shadow;
    mesh.receiveShadow = !!cfg.shadow;
    pedestal.add(mesh);
  }
  const plaqueMap = plaqueTexture(plaque);
  const plaqueMat = new THREE.MeshStandardMaterial({ map: plaqueMap, roughness: 0.5, metalness: 0.2, emissive: '#d9bd84', emissiveMap: plaqueMap, emissiveIntensity: 0 });
  const plaqueMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.27), plaqueMat);
  plaqueMesh.position.set(0, 0.35, 0.663);
  pedestal.add(plaqueMesh);
  scene.add(pedestal);
  // A escultura fica num grupo apoiado no alto do pedestal.
  const sculpture = new THREE.Group();
  sculpture.position.y = BASE_Y;
  scene.add(sculpture);

  // ---- Camadas (uma por estágio) ----
  const cuts = { armature: newCut(), block: newCut(), form: newCut(), final: newCut() };
  const lineMat = new THREE.LineBasicMaterial({ color: GOLD.clone().multiplyScalar(1.6), transparent: true, opacity: 1, toneMapped: false });
  const gridMat = new THREE.LineBasicMaterial({ color: '#7fa6f5', transparent: true, opacity: 0.12, toneMapped: false });
  let lines: THREE.LineSegments | null = null;
  let grid: THREE.LineSegments | null = null;
  let lineCount = 0;
  const armMat = withCut(new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 1, emissive: GOLD, emissiveIntensity: 0.06 }), cuts.armature, true);
  let armature: THREE.InstancedMesh | null = null;
  const plaster = withCut(new THREE.MeshStandardMaterial({ color: '#d8d0c2', roughness: 0.92, metalness: 0, flatShading: true }), cuts.block, true);
  const clay = withCut(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0 }), cuts.form, true);
  const bronze = withCut(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.44, metalness: 0.88, envMapIntensity: 0.75 }), cuts.final, true);
  const depthFor = (cut: Cut) => withCut(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), cut, false);
  const meshes: Partial<Record<'block' | 'form' | 'final', THREE.Mesh>> = {};
  const ready = new Set<number>();

  function addMesh(level: 'block' | 'form' | 'final', data: Extract<SculptMessage, { kind: 'mesh' }>) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    if (level === 'form') g.setAttribute('color', new THREE.BufferAttribute(clayColors(data.ao), 3));
    if (level === 'final') g.setAttribute('color', new THREE.BufferAttribute(bronzeColors(data.normals, data.ao), 3));
    g.setIndex(new THREE.BufferAttribute(data.indices, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, level === 'block' ? plaster : level === 'form' ? clay : bronze);
    mesh.castShadow = !!cfg.shadow;
    mesh.receiveShadow = !!cfg.shadow;
    mesh.customDepthMaterial = depthFor(cuts[level]);
    mesh.visible = false;
    sculpture.add(mesh);
    meshes[level] = mesh;
    const stage = level === 'block' ? 2 : level === 'form' ? 3 : 4;
    ready.add(stage);
    if (level === 'final') ready.add(5);
    // Compila já (sem travar o primeiro quadro em que a peça aparece).
    void renderer.compileAsync(mesh, camera, scene).catch(() => undefined);
    onReady?.(stage);
    if (level === 'final') onReady?.(5);
    pending();
  }

  function addLines(data: Extract<SculptMessage, { kind: 'lines' }>) {
    // Contorno, num plano vertical no meio da escultura.
    const n = data.silhouette.length / 4;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) pos.set([data.silhouette[i * 4]!, data.silhouette[i * 4 + 1]!, 0, data.silhouette[i * 4 + 2]!, data.silhouette[i * 4 + 3]!, 0], i * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lines = new THREE.LineSegments(g, lineMat);
    lineCount = n * 2;
    lines.visible = false;
    sculpture.add(lines);
    // Quadriculado da prancheta, atrás do traço.
    const gp: number[] = [];
    for (let x = -1.6; x <= 1.61; x += 0.2) gp.push(x, 0, -0.01, x, 1.9, -0.01);
    for (let y = 0; y <= 1.91; y += 0.2) gp.push(-1.6, y, -0.01, 1.6, y, -0.01);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    grid = new THREE.LineSegments(gg, gridMat);
    grid.visible = false;
    sculpture.add(grid);
    // Armação: hastes (cilindros instanciados) de ponta a ponta de cada osso.
    const count = data.bones.length / 7;
    armature = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1), armMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const dir = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const o = i * 7;
      a.set(data.bones[o]!, data.bones[o + 1]!, data.bones[o + 2]!);
      b.set(data.bones[o + 3]!, data.bones[o + 4]!, data.bones[o + 5]!);
      const r = data.bones[o + 6]!;
      dir.subVectors(b, a);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r));
      armature.setMatrixAt(i, m);
    }
    armature.castShadow = !!cfg.shadow;
    armature.customDepthMaterial = depthFor(cuts.armature);
    armature.visible = false;
    sculpture.add(armature);
    ready.add(0);
    ready.add(1);
    onReady?.(0);
    onReady?.(1);
    pending();
  }

  // ---- O worker esculpe; as camadas entram conforme chegam ----
  const worker = new Worker(new URL('../sculpture/worker.ts', import.meta.url), { type: 'module', name: 'bz-lion' });
  worker.onmessage = (e: MessageEvent<SculptMessage>) => {
    const msg = e.data;
    if (disposed) return;
    if (msg.kind === 'lines') addLines(msg);
    else if (msg.kind === 'mesh') addMesh(msg.level, msg);
    request();
  };
  worker.postMessage({ finalCell: cfg.finalCell, formCell: cfg.formCell });

  // ---- Câmera e controles ----
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 1.2;
  controls.maxDistance = 9;
  controls.minPolarAngle = 0.12 * Math.PI;
  controls.maxPolarAngle = 0.52 * Math.PI;
  controls.autoRotateSpeed = 0.35;
  // Em tela estreita (celular em pé), a câmera recua para a escultura inteira caber na largura.
  let current: LionView = 'full';
  let touched = false;
  const fit = () => (camera.aspect < 1 ? THREE.MathUtils.clamp(0.8 / camera.aspect, 1, 1.9) : 1);
  const placeOf = (view: LionView): [THREE.Vector3, THREE.Vector3] => {
    const v = VIEWS[view];
    const target = new THREE.Vector3(...v.target);
    return [new THREE.Vector3(...v.position).sub(target).multiplyScalar(fit()).add(target), target];
  };
  camera.position.set(...VIEWS.full.position);
  controls.target.set(...VIEWS.full.target);
  controls.update();
  controls.addEventListener('change', () => request());
  controls.addEventListener('start', () => {
    touched = true;
    tween = null;
    controls.autoRotate = false;
  });

  let tween: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t: number } | null = null;

  // ---- Estado da sequência ----
  let stage = -1;
  let wanted = -1;
  let wantedAnimate = false;
  let transition: { from: number; to: number; t: number; duration: number } | null = null;
  /** 0..1: luz de museu acesa (estágio final). */
  let finish = 0;

  function layerOf(s: number): 'lines' | 'armature' | 'block' | 'form' | 'final' {
    return (['lines', 'armature', 'block', 'form', 'final', 'final'] as const)[s]!;
  }

  function show(layer: ReturnType<typeof layerOf>, on: boolean) {
    if (layer === 'lines') {
      if (lines) lines.visible = on;
      if (grid) grid.visible = on;
    } else if (layer === 'armature') {
      if (armature) armature.visible = on;
    } else {
      const m = meshes[layer];
      if (m) m.visible = on;
    }
  }

  function setCut(layer: ReturnType<typeof layerOf>, value: number, dir: number, edge: number) {
    if (layer === 'lines') return;
    const c = cuts[layer];
    c.uCut.value = value;
    c.uDir.value = dir;
    c.uEdge.value = edge;
  }

  /** Coloca a cena no estado final de um estágio (sem transição). */
  function settle(s: number) {
    for (const l of ['lines', 'armature', 'block', 'form', 'final'] as const) show(l, false);
    const layer = layerOf(s);
    show(layer, true);
    setCut(layer, CUT_TO + 1, 1, 0);
    if (lines) lines.geometry.setDrawRange(0, lineCount);
    lineMat.opacity = 1;
    gridMat.opacity = 0.12;
    finish = s === 5 ? 1 : 0;
    applyFinish();
  }

  function applyFinish() {
    // A luz sobe ao longo da sequência: prancheta e armação na penumbra, a obra no foco.
    const base = stage <= 1 ? 0.45 : 0.75;
    key.intensity = KEY_ON * (base + (1 - base) * finish);
    rim.intensity = RIM_ON * (0.5 + 0.5 * finish);
    plaqueMat.emissiveIntensity = 0.35 * finish;
    controls.autoRotate = finish > 0.99 && !reducedMotion && !tween;
  }

  function begin(s: number, animate: boolean) {
    const prev = stage;
    stage = s;
    if (!animate || reducedMotion || prev < 0) {
      transition = null;
      settle(s);
      request();
      return;
    }
    transition = { from: prev, to: s, t: 0, duration: s === 0 ? 2.6 : s === 5 ? 1.6 : 2.3 };
    // Do estágio 4 ao 5 a malha é a mesma: só a luz muda.
    for (const l of ['lines', 'armature', 'block', 'form', 'final'] as const) show(l, l === layerOf(prev) || l === layerOf(s));
    if (s === 0 && lines) lines.geometry.setDrawRange(0, 0);
    request();
  }

  function stepTransition(dt: number) {
    if (!transition) return;
    transition.t = Math.min(1, transition.t + dt / transition.duration);
    const k = ease(transition.t);
    const to = layerOf(transition.to);
    const from = layerOf(transition.from);
    const y = CUT_FROM + (CUT_TO - CUT_FROM) * k;
    const glow = Math.sin(Math.PI * Math.min(1, transition.t * 1.15));
    if (to === from) {
      // 4 → 5 (ou 5 → 4): só a luz.
      finish = transition.to === 5 ? k : 1 - k;
    } else {
      if (to === 'lines') {
        if (lines) lines.geometry.setDrawRange(0, Math.floor(lineCount * k) & ~1);
        lineMat.opacity = 1;
        gridMat.opacity = 0.12 * k;
      } else setCut(to, y, 1, glow);
      if (from === 'lines') {
        lineMat.opacity = 1 - k;
        gridMat.opacity = 0.12 * (1 - k);
      } else if (from !== 'final' || to !== 'final') setCut(from, y, -1, 0);
      finish = transition.to === 5 ? k : transition.from === 5 ? 1 - k : 0;
    }
    applyFinish();
    if (transition.t >= 1) {
      const end = transition.to;
      transition = null;
      settle(end);
    }
  }

  // ---- Laço sob demanda ----
  let raf = 0;
  let last = 0;
  let visible = true;
  let disposed = false;
  function request() {
    if (raf || !visible || disposed) return;
    raf = requestAnimationFrame(frame);
  }
  function pending() {
    if (wanted >= 0 && ready.has(wanted) && stage !== wanted) begin(wanted, wantedAnimate);
  }
  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    stepTransition(dt);
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 1.3);
      const k = ease(tween.t);
      camera.position.lerpVectors(tween.from[0], tween.to[0], k);
      controls.target.lerpVectors(tween.from[1], tween.to[1], k);
      if (tween.t >= 1) {
        tween = null;
        applyFinish();
      }
    }
    const moving = controls.update(dt);
    renderer.render(scene, camera);
    if (transition || tween || moving || controls.autoRotate) request();
    else last = 0;
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Em tela estreita (celular em pé) a escultura inteira precisa caber: o campo de visão abre.
    camera.fov = camera.aspect < 1 ? 40 : 32;
    camera.updateProjectionMatrix();
    // Enquanto o visitante não mexeu na câmera, ela acompanha o formato da tela.
    if (!touched && !tween) {
      const [pos, target] = placeOf(current);
      camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
    }
    request();
  }
  resize();

  const onLost = (e: Event) => {
    e.preventDefault();
    onContextLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    setStage(s, animate) {
      wanted = s;
      wantedAnimate = animate;
      if (ready.has(s)) begin(s, animate);
    },
    isReady: (s) => ready.has(s),
    setView(view) {
      current = view;
      touched = false;
      const to = placeOf(view);
      controls.autoRotate = false;
      if (reducedMotion) {
        camera.position.copy(to[0]);
        controls.target.copy(to[1]);
        tween = null;
      } else tween = { from: [camera.position.clone(), controls.target.clone()], to, t: 0 };
      request();
    },
    nudge(azimuth, polar, zoom) {
      touched = true;
      tween = null;
      controls.autoRotate = false;
      const offset = camera.position.clone().sub(controls.target);
      const sph = new THREE.Spherical().setFromVector3(offset);
      sph.theta += azimuth;
      sph.phi = THREE.MathUtils.clamp(sph.phi + polar, controls.minPolarAngle, controls.maxPolarAngle);
      sph.radius = THREE.MathUtils.clamp(sph.radius * zoom, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset.setFromSpherical(sph));
      request();
    },
    setInteractive(on) {
      controls.enabled = on;
    },
    setVisible(on) {
      visible = on;
      if (on) request();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    },
    resize,
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      worker.terminate();
      canvas.removeEventListener('webglcontextlost', onLost);
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        mats.forEach((m) => m.dispose());
        mesh.customDepthMaterial?.dispose();
      });
      [plaqueMap, radial, env].forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
}
