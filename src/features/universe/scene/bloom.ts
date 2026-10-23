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
  /**
   * Antisserrilhado: `msaa` (4 amostras na textura HDR — o melhor, mas em meia precisão custa
   * ~2–3 ms num gráfico integrado) ou `fxaa` (filtro de bordas na própria passada final, quase de graça).
   */
  antialias: 'msaa' | 'fxaa';
  /** Nitidez adaptativa na passada final (0 = nenhuma, 1 = máxima), com o antisserrilhado FXAA. */
  sharpen?: number;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRIGHT = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uvScale;
uniform float threshold;
uniform float knee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv * uvScale).rgb;
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

// Composição: imagem (com FXAA, se o nível pedir) + brilho; tons (ACES) e sRGB no fim.
// FXAA de Timothy Lottes (versão compacta): acha a direção da borda pelo gradiente de luminância
// dos quatro vizinhos diagonais e mistura ao longo dela; o brilho já vem suave e não passa pelo filtro.
const COMPOSITE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float strength;
uniform vec2 texel;
uniform vec2 uvScale;
uniform vec2 uvMax;
varying vec2 vUv;
#ifdef FXAA
float lumaOf(vec3 c) { c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(vec2 uv) {
  vec3 m = texture2D(tColor, uv).rgb;
  float lNW = lumaOf(texture2D(tColor, uv + vec2(-1.0, -1.0) * texel).rgb);
  float lNE = lumaOf(texture2D(tColor, uv + vec2(1.0, -1.0) * texel).rgb);
  float lSW = lumaOf(texture2D(tColor, uv + vec2(-1.0, 1.0) * texel).rgb);
  float lSE = lumaOf(texture2D(tColor, uv + vec2(1.0, 1.0) * texel).rgb);
  float lM = lumaOf(m);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.0312, lMax * 0.125)) return m;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8.0, 8.0) * texel;
  vec3 a = 0.5 * (texture2D(tColor, uv - dir * 0.1667).rgb + texture2D(tColor, uv + dir * 0.1667).rgb);
  vec3 b = 0.5 * a + 0.25 * (texture2D(tColor, uv - dir * 0.5).rgb + texture2D(tColor, uv + dir * 0.5).rgb);
  float lB = lumaOf(b);
  return (lB < lMin || lB > lMax) ? a : b;
}
// Nitidez adaptativa ao contraste (a ideia do CAS da AMD): realça a borda pela vizinhança em cruz, com peso
// que diminui onde o contraste já é alto (sem halos nem serrilhado de volta). Recupera o detalhe que o
// antisserrilhado e a resolução abaixo da tela tiram — o que pesa num celular, que desenha a ~40% da tela.
// Em espaço comprimido (Reinhard), para as luzes HDR não estourarem o realce.
vec3 squash(vec3 c) { return c / (1.0 + c); }
vec3 unsquash(vec3 t) { return t / max(vec3(1e-4), 1.0 - t); }
uniform float sharpen;
vec3 cas(vec3 c, vec2 uv) {
  vec3 t = squash(c);
  vec3 n = squash(texture2D(tColor, uv + vec2(0.0, -texel.y)).rgb);
  vec3 s = squash(texture2D(tColor, uv + vec2(0.0, texel.y)).rgb);
  vec3 e = squash(texture2D(tColor, uv + vec2(texel.x, 0.0)).rgb);
  vec3 w = squash(texture2D(tColor, uv + vec2(-texel.x, 0.0)).rgb);
  vec3 mn = min(t, min(min(n, s), min(e, w)));
  vec3 mx = max(t, max(max(n, s), max(e, w)));
  vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
  vec3 wgt = amp * (-1.0 / mix(8.0, 5.0, sharpen));
  vec3 r = (t + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt);
  return unsquash(clamp(r, 0.0, 0.999));
}
#endif
void main() {
  // A cena pode ocupar só um canto da textura (resolução dinâmica): amplia para a tela inteira.
  vec2 suv = min(vUv * uvScale, uvMax);
  #ifdef FXAA
  vec3 c = fxaa(suv);
  if (sharpen > 0.0) c = cas(c, suv);
  #else
  vec3 c = texture2D(tColor, suv).rgb;
  #endif
  c += texture2D(tBloom, vUv).rgb * strength;
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
  /**
   * Resolução dinâmica (0,5–1): fração da tela em que a cena é desenhada, dentro da mesma textura, e
   * ampliada na passada final. Mudar a escala não realoca nada — trocar a resolução do canvas realoca o
   * canvas e todas as texturas, uma travada de ~50–75 ms (medido) a cada degrau da resolução adaptativa.
   */
  scale = 1;

  constructor(gl: THREE.WebGLRenderer, settings: BloomSettings, multisample: boolean) {
    this.gl = gl;
    this.settings = settings;
    const fxaa = settings.antialias === 'fxaa' || !multisample;
    this.target = rt(1, 1, fxaa ? 0 : 4, true);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, toneMapped = false) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped });
    this.bright = mat(BRIGHT, { tColor: { value: null }, uvScale: { value: new THREE.Vector2(1, 1) }, threshold: { value: settings.threshold }, knee: { value: settings.knee } });
    this.down = mat(DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    this.up = mat(UP, { tSrc: { value: null }, tBase: { value: null }, texel: { value: new THREE.Vector2() } });
    this.composite = mat(
      COMPOSITE,
      { tColor: { value: null }, tBloom: { value: null }, strength: { value: settings.strength }, texel: { value: new THREE.Vector2() }, uvScale: { value: new THREE.Vector2(1, 1) }, uvMax: { value: new THREE.Vector2(1, 1) }, sharpen: { value: settings.sharpen ?? 0 } },
      true,
    );
    if (fxaa) this.composite.defines = { FXAA: '' };
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
    (this.composite.uniforms.texel!.value as THREE.Vector2).set(1 / s.x, 1 / s.y);
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
    const k = Math.min(1, Math.max(0.5, this.scale));
    const vw = Math.max(1, Math.round(this.size.x * k));
    const vh = Math.max(1, Math.round(this.size.y * k));
    this.target.viewport.set(0, 0, vw, vh);
    this.target.scissor.set(0, 0, vw, vh);
    this.target.scissorTest = vw < this.size.x || vh < this.size.y;
    const sx = vw / this.size.x;
    const sy = vh / this.size.y;
    (this.bright.uniforms.uvScale!.value as THREE.Vector2).set(sx, sy);
    (this.composite.uniforms.uvScale!.value as THREE.Vector2).set(sx, sy);
    (this.composite.uniforms.uvMax!.value as THREE.Vector2).set((vw - 0.5) / this.size.x, (vh - 0.5) / this.size.y);
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
