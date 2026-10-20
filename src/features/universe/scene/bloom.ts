import * as THREE from 'three';

/**
 * Pós-processamento do Universe: brilho (bloom) "dual filter", leve.
 *
 * A cena é desenhada numa textura HDR (meia precisão, com antisserrilhado
 * MSAA quando o nível pede); o que passa do limiar de brilho (luzes, letreiros,
 * faixas de LED, faróis) é reduzido em 4–6 níveis e reampliado com filtros de
 * poucas amostras, e somado à imagem; o mapeamento de tons (ACES) e a conversão
 * para sRGB acontecem no fim, uma vez. Custa ~10 passadas de tela em
 * resoluções cada vez menores (a maior é metade da tela).
 *
 * Escrito aqui (≈ 150 linhas) em vez do EffectComposer + UnrealBloomPass dos
 * exemplos do three, que trariam vários shaders e passadas a mais para o mesmo
 * resultado.
 */
export interface BloomSettings {
  strength: number;
  threshold: number;
  knee: number;
  levels: number;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRIGHT = /* glsl */ `
uniform sampler2D tColor;
uniform float threshold;
uniform float knee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float soft = clamp(l - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float k = max(soft, l - threshold) / max(l, 1e-4);
  gl_FragColor = vec4(c * k, 1.0);
}`;

// Redução: centro ×4 + 4 diagonais a meio texel (Kawase "dual filter").
const DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec2 h = texel * 0.5;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv - h).rgb;
  s += texture2D(tSrc, vUv + h).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb;
  s += texture2D(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;

// Ampliação: anel de 8 amostras, somado ao nível de cima.
const UP = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tBase;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec2 h = texel * 0.5;
  vec3 s = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + s / 12.0, 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float strength;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb + texture2D(tBloom, vUv).rgb * strength;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const rt = (w: number, h: number, samples = 0, depth = false) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: depth, samples, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });

export class BloomPipeline {
  readonly target: THREE.WebGLRenderTarget;
  private levels: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private bright: THREE.ShaderMaterial;
  private down: THREE.ShaderMaterial;
  private up: THREE.ShaderMaterial;
  private composite: THREE.ShaderMaterial;
  private size = new THREE.Vector2();
  private gl: THREE.WebGLRenderer;
  private settings: BloomSettings;

  constructor(gl: THREE.WebGLRenderer, settings: BloomSettings, samples: number) {
    this.gl = gl;
    this.settings = settings;
    this.target = rt(1, 1, samples, true);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, toneMapped = false) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped });
    this.bright = mat(BRIGHT, { tColor: { value: null }, threshold: { value: settings.threshold }, knee: { value: settings.knee } });
    this.down = mat(DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    this.up = mat(UP, { tSrc: { value: null }, tBase: { value: null }, texel: { value: new THREE.Vector2() } });
    this.composite = mat(COMPOSITE, { tColor: { value: null }, tBloom: { value: null }, strength: { value: settings.strength } }, true);
    this.quad = new THREE.Mesh(tri, this.bright);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** Ajusta os alvos ao tamanho atual da tela (a resolução adaptativa muda o tamanho). */
  private resize() {
    const s = this.gl.getDrawingBufferSize(new THREE.Vector2());
    if (s.equals(this.size)) return;
    this.size.copy(s);
    this.target.setSize(s.x, s.y);
    [...this.levels, ...this.ups].forEach((t) => t.dispose());
    this.levels = [];
    this.ups = [];
    let w = Math.floor(s.x / 2);
    let h = Math.floor(s.y / 2);
    for (let i = 0; i < this.settings.levels; i++) {
      this.levels.push(rt(w, h));
      if (i < this.settings.levels - 1) this.ups.push(rt(w, h));
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
    }
  }

  private pass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  /** Desenha a cena com brilho na tela. */
  render(scene: THREE.Scene, camera: THREE.Camera) {
    this.resize();
    const gl = this.gl;
    gl.setRenderTarget(this.target);
    gl.render(scene, camera);
    this.bright.uniforms.tColor!.value = this.target.texture;
    this.pass(this.bright, this.levels[0]!);
    for (let i = 1; i < this.levels.length; i++) {
      const src = this.levels[i - 1]!;
      this.down.uniforms.tSrc!.value = src.texture;
      (this.down.uniforms.texel!.value as THREE.Vector2).set(1 / src.width, 1 / src.height);
      this.pass(this.down, this.levels[i]!);
    }
    let src = this.levels[this.levels.length - 1]!;
    for (let i = this.levels.length - 2; i >= 0; i--) {
      this.up.uniforms.tSrc!.value = src.texture;
      this.up.uniforms.tBase!.value = this.levels[i]!.texture;
      (this.up.uniforms.texel!.value as THREE.Vector2).set(1 / src.width, 1 / src.height);
      this.pass(this.up, this.ups[i]!);
      src = this.ups[i]!;
    }
    this.composite.uniforms.tColor!.value = this.target.texture;
    this.composite.uniforms.tBloom!.value = src.texture;
    this.pass(this.composite, null);
  }

  /** Compila os shaders das passadas (no preparo, antes do primeiro quadro). */
  materials(): THREE.Material[] {
    return [this.bright, this.down, this.up, this.composite];
  }

  dispose() {
    [this.target, ...this.levels, ...this.ups].forEach((t) => t.dispose());
    [this.bright, this.down, this.up, this.composite].forEach((m) => m.dispose());
    this.quad.geometry.dispose();
  }
}

/** Pipeline ativo de cada renderer (o Warmup prepara a cena para o mesmo destino que o jogo usa). */
const active = new WeakMap<THREE.WebGLRenderer, BloomPipeline>();
export const postFor = (gl: THREE.WebGLRenderer) => active.get(gl) ?? null;
export const registerPost = (gl: THREE.WebGLRenderer, p: BloomPipeline | null) => (p ? active.set(gl, p) : active.delete(gl));
