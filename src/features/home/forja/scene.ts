import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createArmKit, RobotArm } from './robot-arm';
import { areaColor, clamp01, LOCK_AT, phasesAt, smooth, type Phases } from './timeline';

/**
 * A Forja — cena 3D da home (three.js puro, sem React).
 *
 * A rolagem dirige uma construção em atos: uma faísca; partículas coloridas
 * por área do conhecimento chegando das bordas; braços robóticos fazendo a
 * triagem (aprovadas viram estrutura, reprovadas caem); arestas e conexões
 * curso↔competência se desenhando; placas metálicas encaixando a partir do
 * núcleo até formar o bloco da marca; e a câmera mergulhando no núcleo.
 *
 * Desempenho: partículas movidas inteiramente na GPU (shader); só uniforms
 * mudam por quadro. Renderiza apenas com a seção visível, 30 fps em celular,
 * resolução limitada e bloom só em aparelho forte (meia resolução).
 */

export type ForjaQuality = 'high' | 'medium' | 'mobile';

export interface ForjaData {
  /** Peso (nº de cursos) de cada área, na ordem da taxonomia. */
  areaWeights: number[];
  /** Grafo real: área de cada curso e ligações curso → competência. */
  courseAreas: number[];
  skillCount: number;
  links: Array<[course: number, skill: number]>;
}

export interface ForjaOptions {
  canvas: HTMLCanvasElement;
  quality: ForjaQuality;
  data: ForjaData;
  onLock?: () => void;
  onContextLost?: () => void;
}

export interface ForjaScene {
  setProgress(p: number): void;
  setInterests(areas: number[]): void;
  setActive(active: boolean): void;
  resize(width: number, height: number): void;
  /** Desloca o bloco na tela (fração da largura/altura): texto de um lado, estrutura do outro. */
  setFraming(x: number, y: number): void;
  dispose(): void;
}

const CUBE = 2.6;
const HALF = CUBE / 2;
const FLOOR_Y = -2.75;
const GOLD = new THREE.Color('#c7a86a');
const MAX_AREAS = 32;

const SETTINGS: Record<ForjaQuality, { particles: number; dpr: number; fps: number; bloom: boolean; env: boolean; sparks: number }> = {
  high: { particles: 14000, dpr: 1.75, fps: 60, bloom: true, env: true, sparks: 220 },
  medium: { particles: 7000, dpr: 1.5, fps: 60, bloom: false, env: true, sparks: 140 },
  mobile: { particles: 4200, dpr: 1.5, fps: 30, bloom: false, env: true, sparks: 90 },
};

/** Gerador com semente: a composição é a mesma em toda visita. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Faces visíveis do bloco (no referencial do bloco): topo dourado
   (Descobrir), direita em aço (Construir), esquerda translúcida em camadas
   (Aprender) — a mesma leitura do símbolo da marca. */
const FACES = [
  { key: 'top', n: new THREE.Vector3(0, 1, 0), t1: new THREE.Vector3(1, 0, 0), t2: new THREE.Vector3(0, 0, 1) },
  { key: 'right', n: new THREE.Vector3(0, 0, 1), t1: new THREE.Vector3(1, 0, 0), t2: new THREE.Vector3(0, 1, 0) },
  { key: 'left', n: new THREE.Vector3(-1, 0, 0), t1: new THREE.Vector3(0, 0, 1), t2: new THREE.Vector3(0, 1, 0) },
] as const;
/** Vértice frontal, onde as três faces se encontram: o "nó" da marca. */
const NODE_LOCAL = new THREE.Vector3(-HALF, HALF, HALF);

const PARTICLE_VERT = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aCloud;
  attribute vec3 aTarget;
  attribute vec3 aColor;
  attribute vec4 aRand;
  attribute float aArea;
  uniform float uTime;
  uniform float uGather;
  uniform float uSort;
  uniform float uBuild;
  uniform float uEnter;
  uniform float uSize;
  uniform float uHi[${MAX_AREAS}];
  uniform float uAnyHi;
  varying vec3 vColor;
  varying float vAlpha;

  float easeInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }

  void main() {
    float g = easeInOut(clamp((uGather - aRand.x * 0.45) / 0.55, 0.0, 1.0));
    float s = easeInOut(clamp((uSort - aRand.x * 0.35) / 0.65, 0.0, 1.0));
    float reject = aRand.w;
    vec3 drift = vec3(
      sin(uTime * (0.35 + aRand.y * 0.4) + aRand.z * 6.2831),
      cos(uTime * (0.3 + aRand.x * 0.35) + aRand.y * 6.2831) * 0.6,
      sin(uTime * 0.27 + aRand.x * 6.2831)
    ) * (0.22 * (1.0 - s * (1.0 - reject)));
    vec3 swirl = aCloud + drift;
    vec3 pos = mix(aStart, swirl, g);
    vec3 fall = aCloud + vec3(aRand.y - 0.5, -6.5 - aRand.z * 2.0, aRand.x - 0.5);
    vec3 dest = mix(aTarget, fall, reject);
    pos = mix(pos, dest, s);

    float hi = mix(1.0, uHi[int(aArea)], uAnyHi);
    vColor = mix(aColor, vec3(1.0, 0.36, 0.3), reject * smoothstep(0.0, 0.25, s));
    float appear = smoothstep(0.0, 0.12, uGather - aRand.x * 0.45);
    float fade = 1.0 - reject * smoothstep(0.35, 0.95, s);
    float absorbed = 1.0 - 0.85 * uBuild * (1.0 - reject);
    vAlpha = appear * fade * absorbed * mix(0.22, 1.0, hi) * (1.0 - uEnter);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float size = uSize * (0.55 + aRand.z * 0.9) * mix(0.75, 1.35, hi) * (1.0 - 0.55 * uBuild);
    gl_PointSize = size / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float a = core * core * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.6 + core), a);
  }
`;

/* Linhas que "crescem": cada segmento tem uma ordem (aOrder) e cada vértice
   sabe se é início (0) ou fim (1) — o fragmento além do crescimento é descartado. */
const LINE_VERT = /* glsl */ `
  attribute float aEnd;
  attribute float aOrder;
  attribute vec3 aColor;
  uniform float uGrow;
  varying float vEnd;
  varying float vGrow;
  varying vec3 vColor;
  void main() {
    vEnd = aEnd;
    vGrow = clamp((uGrow - aOrder * 0.6) / 0.4, 0.0, 1.0);
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINE_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vEnd;
  varying float vGrow;
  varying vec3 vColor;
  void main() {
    if (vEnd > vGrow) discard;
    float head = smoothstep(vGrow - 0.18, vGrow, vEnd) * step(vGrow, 0.999);
    gl_FragColor = vec4(vColor + head * 0.8, uOpacity * (0.55 + head));
  }
`;

const FLOOR_VERT = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vXZ = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uGlow;
  uniform float uReveal;
  varying vec2 vXZ;
  void main() {
    vec2 grid = abs(fract(vXZ / 1.3 - 0.5) - 0.5) / fwidth(vXZ / 1.3);
    float line = 1.0 - min(min(grid.x, grid.y), 1.0);
    float r = length(vXZ);
    float fade = smoothstep(17.0, 2.0, r) * uReveal;
    float ring = smoothstep(0.09, 0.0, abs(r - 4.6)) * 0.6;
    float pool = smoothstep(4.2, 0.0, r) * uGlow;
    float a = (line * 0.16 + ring * 0.5) * fade + pool * 0.28;
    gl_FragColor = vec4(uColor * (0.7 + pool), a);
  }
`;

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,210,1)');
    grad.addColorStop(0.25, 'rgba(234,207,150,0.55)');
    grad.addColorStop(1, 'rgba(199,168,106,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createForjaScene({ canvas, quality, data, onLock, onContextLost }: ForjaOptions): ForjaScene {
  const cfg = SETTINGS[quality];
  const rand = rng(20261011);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'mobile', alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.dpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor('#070d17', 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070d17');
  scene.fog = new THREE.FogExp2('#070d17', 0.035);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
  const camHome = new THREE.Vector3(0, 1.6, 13.5);
  camera.position.copy(camHome);

  let envMap: THREE.Texture | null = null;
  let pmrem: THREE.PMREMGenerator | null = null;
  if (cfg.env) {
    pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
  }

  // ---- Luz ---------------------------------------------------------------
  scene.add(new THREE.HemisphereLight('#9fb8e0', '#0a1220', 0.55));
  const key = new THREE.DirectionalLight('#f2e8d5', 1.6);
  key.position.set(5, 9, 7);
  const rim = new THREE.DirectionalLight('#6f9be8', 1.1);
  rim.position.set(-7, 4, -6);
  const coreLight = new THREE.PointLight('#e8c98a', 0, 12, 1.6);
  scene.add(key, rim, coreLight);

  // Tudo que gira com a rolagem fica em `world`.
  const world = new THREE.Group();
  scene.add(world);
  const block = new THREE.Group();
  block.rotation.set(Math.atan(1 / Math.SQRT2), Math.PI / 4, 0);
  world.add(block);
  block.updateMatrix();
  const nodeWorld = NODE_LOCAL.clone().applyMatrix4(block.matrix);

  // ---- Piso --------------------------------------------------------------
  const floorMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    uniforms: { uColor: { value: GOLD.clone() }, uGlow: { value: 0 }, uReveal: { value: 0 } },
    transparent: true,
    depthWrite: false,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), floorMat);
  floor.position.y = FLOOR_Y;
  world.add(floor);

  // ---- Faísca / núcleo -----------------------------------------------------
  const glowTex = glowTexture();
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  spark.position.copy(nodeWorld);
  world.add(spark);
  const nodeCore = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff3d6', toneMapped: false }));
  nodeCore.position.copy(NODE_LOCAL);
  block.add(nodeCore);
  coreLight.position.copy(nodeWorld);

  // ---- Arestas (crescem a partir do nó) ----------------------------------------
  const corners = [-HALF, HALF];
  const edgeList: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (const x of corners) for (const y of corners) for (const z of corners) {
    const a = new THREE.Vector3(x, y, z);
    if (x < 0) edgeList.push([a, new THREE.Vector3(HALF, y, z)]);
    if (y < 0) edgeList.push([a, new THREE.Vector3(x, HALF, z)]);
    if (z < 0) edgeList.push([a, new THREE.Vector3(x, y, HALF)]);
  }
  // Camadas da face esquerda (como no símbolo).
  edgeList.push([new THREE.Vector3(-HALF, HALF / 3, -HALF), new THREE.Vector3(-HALF, HALF / 3, HALF)]);
  edgeList.push([new THREE.Vector3(-HALF, -HALF / 3, -HALF), new THREE.Vector3(-HALF, -HALF / 3, HALF)]);
  // Ordem: do nó para fora (menor distância média primeiro), orientadas a partir do nó.
  const edges = edgeList
    .map(([a, b]) => (a.distanceTo(NODE_LOCAL) <= b.distanceTo(NODE_LOCAL) ? [a, b] : [b, a]) as [THREE.Vector3, THREE.Vector3])
    .sort((p, q) => p[0].distanceTo(NODE_LOCAL) + p[1].distanceTo(NODE_LOCAL) - (q[0].distanceTo(NODE_LOCAL) + q[1].distanceTo(NODE_LOCAL)));
  const edgeGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 8, 1, true).translate(0, 0.5, 0);
  const edgeMat = new THREE.MeshBasicMaterial({ color: '#e7cf98', toneMapped: false, transparent: true });
  const edgeMeshes = edges.map(([a, b], i) => {
    const mesh = new THREE.Mesh(edgeGeo, edgeMat);
    mesh.position.copy(a);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    mesh.userData = { length: a.distanceTo(b), order: i / edges.length };
    mesh.scale.set(1, 0.0001, 1);
    block.add(mesh);
    return mesh;
  });

  // ---- Placas (encaixam do nó para fora) -------------------------------------
  const TILES = 4;
  const tileSize = (CUBE / TILES) * 0.93;
  const tileGeo = new THREE.BoxGeometry(tileSize, tileSize, 0.07);
  const faceMats = [
    new THREE.MeshPhysicalMaterial({ color: '#c9a464', metalness: 1, roughness: 0.26, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.15 }),
    new THREE.MeshPhysicalMaterial({ color: '#2f4a6d', metalness: 0.9, roughness: 0.3, clearcoat: 0.3, envMapIntensity: 1 }),
    new THREE.MeshPhysicalMaterial({ color: '#16243a', metalness: 0.35, roughness: 0.12, transparent: true, opacity: 0.6, emissive: '#c7a86a', emissiveIntensity: 0.04, envMapIntensity: 1.2 }),
  ];
  interface Tile {
    face: number;
    index: number;
    final: THREE.Matrix4;
    from: THREE.Vector3;
    to: THREE.Vector3;
    q: THREE.Quaternion;
    spin: THREE.Quaternion;
    delay: number;
  }
  const tiles: Tile[] = [];
  const tileMeshes = FACES.map((f, fi) => {
    const mesh = new THREE.InstancedMesh(tileGeo, faceMats[fi]!, TILES * TILES);
    mesh.frustumCulled = false;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.n);
    let k = 0;
    for (let i = 0; i < TILES; i++) {
      for (let j = 0; j < TILES; j++) {
        const u = -HALF + (i + 0.5) * (CUBE / TILES);
        const v = -HALF + (j + 0.5) * (CUBE / TILES);
        const to = f.n.clone().multiplyScalar(HALF - 0.035).addScaledVector(f.t1, u).addScaledVector(f.t2, v);
        const from = to.clone().addScaledVector(f.n, 2.4 + rand() * 2.2).add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.6));
        const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 2.4, (rand() - 0.5) * 2.4, (rand() - 0.5) * 2.4));
        const delay = (to.distanceTo(NODE_LOCAL) / (CUBE * 1.75)) * 0.62 + rand() * 0.05;
        tiles.push({ face: fi, index: k, final: new THREE.Matrix4().compose(to, q, new THREE.Vector3(1, 1, 1)), from, to, q, spin, delay });
        k++;
      }
    }
    block.add(mesh);
    return mesh;
  });

  // ---- Partículas -----------------------------------------------------------
  const count = cfg.particles;
  const areaTotal = data.areaWeights.length || 1;
  const weightSum = data.areaWeights.reduce((s, w) => s + Math.max(1, w), 0) || 1;
  const areaOf = (r: number) => {
    let acc = 0;
    for (let i = 0; i < data.areaWeights.length; i++) {
      acc += Math.max(1, data.areaWeights[i]!) / weightSum;
      if (r <= acc) return i;
    }
    return areaTotal - 1;
  };
  const aStart = new Float32Array(count * 3);
  const aCloud = new Float32Array(count * 3);
  const aTarget = new Float32Array(count * 3);
  const aColor = new Float32Array(count * 3);
  const aRand = new Float32Array(count * 4);
  const aArea = new Float32Array(count);
  const tmp = new THREE.Vector3();
  const palette = Array.from({ length: areaTotal }, (_, i) => areaColor(i, areaTotal));
  for (let i = 0; i < count; i++) {
    // Origem: casca distante, nunca atrás da câmera.
    tmp.set(rand() * 2 - 1, (rand() * 2 - 1) * 0.7, rand() * 2 - 1).normalize().multiplyScalar(9 + rand() * 7);
    if (tmp.z > 4) tmp.z = -tmp.z;
    aStart.set([tmp.x, tmp.y, tmp.z], i * 3);
    // Nuvem: anel achatado em volta do centro.
    const ang = rand() * Math.PI * 2;
    const rad = 2.4 + rand() * 2.4;
    aCloud.set([Math.cos(ang) * rad, (rand() - 0.5) * 2.6, Math.sin(ang) * rad], i * 3);
    // Alvo: ponto numa das três faces visíveis (no referencial do mundo).
    const f = FACES[Math.floor(rand() * 3)]!;
    tmp.copy(f.n).multiplyScalar(HALF + 0.02).addScaledVector(f.t1, (rand() * 2 - 1) * HALF).addScaledVector(f.t2, (rand() * 2 - 1) * HALF).applyMatrix4(block.matrix);
    aTarget.set([tmp.x, tmp.y, tmp.z], i * 3);
    const area = areaOf(rand());
    aArea[i] = Math.min(area, MAX_AREAS - 1);
    aColor.set(palette[area]!, i * 3);
    aRand.set([rand(), rand(), rand(), rand() < 0.22 ? 1 : 0], i * 4);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(aStart, 3));
  pGeo.setAttribute('aStart', new THREE.BufferAttribute(aStart, 3));
  pGeo.setAttribute('aCloud', new THREE.BufferAttribute(aCloud, 3));
  pGeo.setAttribute('aTarget', new THREE.BufferAttribute(aTarget, 3));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
  pGeo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 4));
  pGeo.setAttribute('aArea', new THREE.BufferAttribute(aArea, 1));
  pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
  const pUniforms = {
    uTime: { value: 0 },
    uGather: { value: 0 },
    uSort: { value: 0 },
    uBuild: { value: 0 },
    uEnter: { value: 0 },
    uSize: { value: 0 },
    uHi: { value: new Array<number>(MAX_AREAS).fill(1) },
    uAnyHi: { value: 0 },
  };
  const pMat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    uniforms: pUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);
  world.add(points);

  // ---- Grafo curso ↔ competência (dados reais) --------------------------------
  const courseCount = Math.max(1, data.courseAreas.length);
  const coursePos = data.courseAreas.map((_, i) => {
    const a = (i / courseCount) * Math.PI * 2 + 0.4;
    return new THREE.Vector3(Math.cos(a) * 4.3, -0.9 + ((i * 7) % 11) / 4.5, Math.sin(a) * 4.3);
  });
  const skillPos = Array.from({ length: Math.max(1, data.skillCount) }, (_, i) => {
    const f = FACES[i % 3]!;
    const u = (((i * 0.618) % 1) * 2 - 1) * HALF * 0.85;
    const v = (((i * 0.382 + 0.17) % 1) * 2 - 1) * HALF * 0.85;
    return f.n.clone().multiplyScalar(HALF + 0.03).addScaledVector(f.t1, u).addScaledVector(f.t2, v).applyMatrix4(block.matrix);
  });
  const linkCount = data.links.length;
  const lPos = new Float32Array(linkCount * 6);
  const lEnd = new Float32Array(linkCount * 2);
  const lOrder = new Float32Array(linkCount * 2);
  const lColor = new Float32Array(linkCount * 6);
  data.links.forEach(([c, s], i) => {
    const a = coursePos[c] ?? coursePos[0]!;
    const b = skillPos[s] ?? skillPos[0]!;
    lPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    lEnd.set([0, 1], i * 2);
    lOrder.set([c / courseCount, c / courseCount], i * 2);
    const col = palette[data.courseAreas[c] ?? 0] ?? [1, 1, 1];
    lColor.set([...col, ...col], i * 6);
  });
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  lGeo.setAttribute('aEnd', new THREE.BufferAttribute(lEnd, 1));
  lGeo.setAttribute('aOrder', new THREE.BufferAttribute(lOrder, 1));
  lGeo.setAttribute('aColor', new THREE.BufferAttribute(lColor, 3));
  const lUniforms = { uGrow: { value: 0 }, uOpacity: { value: 0 } };
  const lMat = new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms: lUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const graph = new THREE.LineSegments(lGeo, lMat);
  world.add(graph);
  const nodesGeo = new THREE.BufferGeometry().setFromPoints(coursePos);
  const nodesMat = new THREE.PointsMaterial({ map: glowTex, size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
  const courseNodes = new THREE.Points(nodesGeo, nodesMat);
  world.add(courseNodes);

  // ---- Braços robóticos -----------------------------------------------------------
  const kit = createArmKit(envMap);
  const ARM_SPOTS: Array<[number, number, string]> = [
    [-4.1, 1.5, '#5cc8a1'],
    [4.0, 1.2, '#73a7e0'],
    [-3.0, -3.2, '#b49ae8'],
    [3.2, -3.0, '#e3b35a'],
  ];
  const arms = ARM_SPOTS.map(([x, z, color]) => {
    const arm = new RobotArm(kit, color);
    arm.root.position.set(x, FLOOR_Y, z);
    arm.root.scale.setScalar(0.0001);
    world.add(arm.root);
    return arm;
  });
  const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beams = ARM_SPOTS.map(([, , color]) => {
    const line = new THREE.Line(beamGeo.clone(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    line.frustumCulled = false;
    world.add(line);
    return line;
  });

  // ---- Faíscas de solda ---------------------------------------------------------------
  const sparkCount = cfg.sparks;
  const sPos = new Float32Array(sparkCount * 3);
  const sVel = new Float32Array(sparkCount * 3);
  const sLife = new Float32Array(sparkCount);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sMat = new THREE.PointsMaterial({ color: '#ffcf7a', size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const sparks = new THREE.Points(sGeo, sMat);
  sparks.frustumCulled = false;
  world.add(sparks);
  let sparkCursor = 0;
  const emit = (at: THREE.Vector3, n: number) => {
    for (let k = 0; k < n; k++) {
      const i = sparkCursor++ % sparkCount;
      sPos.set([at.x, at.y, at.z], i * 3);
      sVel.set([(Math.random() - 0.5) * 3, Math.random() * 2.4, (Math.random() - 0.5) * 3], i * 3);
      sLife[i] = 0.5 + Math.random() * 0.5;
    }
  };

  // ---- Pós-processamento (só aparelho forte) ------------------------------------------
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  if (cfg.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ---- Estado e laço --------------------------------------------------------------------
  let target = 0;
  let progress = 0;
  let time = 0;
  let active = false;
  let raf = 0;
  let last = 0;
  let width = 1;
  let height = 1;
  let frameX = 0;
  let frameY = 0;
  let locked = false;
  let flash = 0;
  const tmpQ = new THREE.Quaternion();
  const tmpM = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const nodeNow = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const tiny = new THREE.Vector3(0.0001, 0.0001, 0.0001);
  const identity = new THREE.Quaternion();
  const diveOffset = new THREE.Vector3(0, 0.05, 0.9);
  const lookAt = new THREE.Vector3();

  function applyFraming(enter: number) {
    // Desloca o "centro" da projeção: o bloco fica ao lado do texto; no
    // mergulho final volta ao centro.
    // x > 0 empurra o bloco para a direita; y > 0, para cima.
    const k = 1 - enter;
    camera.setViewOffset(width, height, -frameX * width * k, frameY * height * k, width, height);
  }

  function update(dt: number) {
    progress += (target - progress) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - progress) < 1e-4) progress = target;
    time += dt;
    const ph: Phases = phasesAt(progress);

    // Encaixe final: clarão e aviso para a interface (vibração).
    if (!locked && progress >= LOCK_AT) {
      locked = true;
      flash = 1;
      onLock?.();
    } else if (locked && progress < LOCK_AT - 0.03) {
      locked = false;
    }
    flash = Math.max(0, flash - dt * 1.6);

    // Câmera: aproxima ao longo da história e mergulha no nó no fim.
    world.rotation.y = -0.55 + progress * 0.95 + Math.sin(time * 0.15) * 0.04;
    world.updateMatrixWorld();
    inv.copy(world.matrixWorld).invert();
    nodeNow.copy(nodeWorld).applyMatrix4(world.matrixWorld);
    const dist = 13.5 - smooth(0.06, 0.88, progress) * 3.4;
    camera.position.set(0, 1.6 - progress * 0.6, dist);
    lookAt.set(0, 0.1, 0);
    if (ph.enter > 0) {
      const e = ph.enter * ph.enter;
      camera.position.lerp(tmpV2.copy(nodeNow).add(diveOffset), e);
      lookAt.lerp(nodeNow, e);
      camera.fov = 34 + e * 24;
    } else {
      camera.fov = 34;
    }
    camera.lookAt(lookAt);
    applyFraming(ph.enter);
    camera.updateProjectionMatrix();

    // Faísca → núcleo.
    const pulse = 0.5 + Math.sin(time * 2.4) * 0.5;
    const sparkScale = 0.9 + pulse * 0.35 + ph.gather * 0.6 + ph.build * 1.6 + flash * 3.5 + ph.enter * 6;
    spark.scale.setScalar(sparkScale);
    spark.material.opacity = 0.65 + pulse * 0.25;
    coreLight.intensity = 3 + ph.build * 18 + flash * 40;
    nodeCore.scale.setScalar(0.6 + pulse * 0.25 + ph.build * 0.8);

    floorMat.uniforms.uReveal!.value = smooth(0.1, 0.4, progress);
    floorMat.uniforms.uGlow!.value = ph.build * 0.8 + flash;

    // Partículas.
    pUniforms.uTime.value = time;
    pUniforms.uGather.value = ph.gather;
    pUniforms.uSort.value = ph.sort;
    pUniforms.uBuild.value = ph.build;
    pUniforms.uEnter.value = ph.enter;

    // Arestas e grafo.
    edgeMeshes.forEach((mesh) => {
      const { length, order } = mesh.userData as { length: number; order: number };
      const g = clamp01((ph.connect - order * 0.55) / 0.45);
      mesh.scale.set(1, Math.max(0.0001, g * length), 1);
    });
    edgeMat.opacity = 0.35 + ph.build * 0.65;
    lUniforms.uGrow.value = ph.connect;
    lUniforms.uOpacity.value = 0.55 * (1 - ph.build * 0.75) * (1 - ph.enter);
    nodesMat.opacity = smooth(0.5, 0.62, progress) * (1 - ph.build * 0.6) * (1 - ph.enter);

    // Placas.
    for (const t of tiles) {
      const tp = clamp01((ph.build - t.delay) / 0.3);
      const e = 1 - Math.pow(1 - tp, 3);
      if (tp <= 0) {
        tmpM.compose(t.from, t.q, tiny);
      } else {
        tmpV2.lerpVectors(t.from, t.to, e);
        tmpQ.copy(t.spin).slerp(identity, e).premultiply(t.q);
        tmpM.compose(tmpV2, tmpQ, one);
      }
      tileMeshes[t.face]!.setMatrixAt(t.index, tmpM);
    }
    tileMeshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));

    // Braços: emergem na triagem, varrem a nuvem, soldam as placas, recolhem.
    arms.forEach((arm, i) => {
      arm.root.scale.setScalar(Math.max(0.0001, ph.arms));
      const beam = beams[i]!;
      const beamMat = beam.material as THREE.LineBasicMaterial;
      if (ph.arms < 0.02) {
        arm.rest(1);
        beamMat.opacity = 0;
        return;
      }
      if (ph.build > 0.01 && ph.build < 0.99) {
        // Solda: segue a placa mais recente deste braço.
        let best: Tile | null = null;
        for (const t of tiles) {
          if (t.index % 4 !== i) continue;
          const tp = (ph.build - t.delay) / 0.3;
          if (tp > 0 && tp < 1.15 && (!best || t.delay > best.delay)) best = t;
        }
        if (best) tmpV2.copy(best.to);
        else tmpV2.copy(FACES[i % 3]!.n).multiplyScalar(HALF);
        tmpV2.applyMatrix4(block.matrix).applyMatrix4(world.matrixWorld);
        arm.reach(tmpV2, Math.min(1, dt * 6), 0.9);
        if (best && Math.random() < dt * 30) emit(arm.tipWorld(tmpV).applyMatrix4(inv), 3);
        beamMat.opacity = 0;
      } else if (ph.sort > 0.01 && ph.connect < 0.5) {
        // Varredura: o feixe percorre a nuvem de partículas.
        tmpV2.set(Math.sin(time * 0.8 + i * 1.7) * 3.2, Math.cos(time * 0.6 + i) * 1.1, Math.cos(time * 0.5 + i * 2.1) * 3.2).applyMatrix4(world.matrixWorld);
        arm.reach(tmpV2, Math.min(1, dt * 3), 0.2);
        const pos = beam.geometry.getAttribute('position') as THREE.BufferAttribute;
        const a = arm.tipWorld(tmpV).applyMatrix4(inv);
        pos.setXYZ(0, a.x, a.y, a.z);
        const b = tmpV2.applyMatrix4(inv);
        pos.setXYZ(1, b.x, b.y, b.z);
        pos.needsUpdate = true;
        beamMat.opacity = 0.75 * ph.arms * (1 - ph.connect * 2);
      } else {
        // Conexão: apontam para o nó, em guarda.
        arm.reach(nodeNow, Math.min(1, dt * 2.5), 0.3);
        beamMat.opacity = 0;
      }
    });

    // Faíscas: física simples (gravidade).
    for (let i = 0; i < sparkCount; i++) {
      if (sLife[i]! <= 0) {
        sPos[i * 3 + 1] = -100;
        continue;
      }
      sLife[i]! -= dt;
      sVel[i * 3 + 1]! -= 9.8 * dt;
      sPos[i * 3]! += sVel[i * 3]! * dt;
      sPos[i * 3 + 1]! += sVel[i * 3 + 1]! * dt;
      sPos[i * 3 + 2]! += sVel[i * 3 + 2]! * dt;
    }
    (sGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    if (bloom) bloom.strength = 0.55 + ph.build * 0.35 + flash * 0.9;
  }

  function frame(now: number) {
    if (!active) return;
    raf = requestAnimationFrame(frame);
    const interval = 1000 / cfg.fps;
    if (last && now - last < interval - 2) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / cfg.fps;
    last = now;
    update(dt);
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  const lost = (e: Event) => {
    e.preventDefault();
    active = false;
    cancelAnimationFrame(raf);
    onContextLost?.();
  };
  canvas.addEventListener('webglcontextlost', lost);

  return {
    setProgress(p) {
      target = clamp01(p);
    },
    setInterests(areas) {
      const hi = pUniforms.uHi.value;
      hi.fill(0);
      areas.forEach((a) => {
        if (a >= 0 && a < MAX_AREAS) hi[a] = 1;
      });
      pUniforms.uAnyHi.value = areas.length ? 1 : 0;
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      cancelAnimationFrame(raf);
      last = 0;
      if (active) raf = requestAnimationFrame(frame);
    },
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      renderer.setSize(width, height, false);
      composer?.setSize(width, height);
      bloom?.resolution.set(width / 2, height / 2);
      camera.aspect = width / height;
      pUniforms.uSize.value = 52 * renderer.getPixelRatio() * (height / 900);
      applyFraming(0);
      camera.updateProjectionMatrix();
      if (!active) {
        update(0);
        if (composer) composer.render();
        else renderer.render(scene, camera);
      }
    },
    setFraming(x, y) {
      frameX = x;
      frameY = y;
    },
    dispose() {
      active = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', lost);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      kit.dispose();
      glowTex.dispose();
      envMap?.dispose();
      pmrem?.dispose();
      composer?.dispose();
      renderer.dispose();
    },
  };
}
