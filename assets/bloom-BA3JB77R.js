import{I as e,It as t,Nn as n,St as r,cn as i,et as a,kn as o,l as s,ln as c,lt as l,rt as u,u as d}from"./three.module-ohYwSPJ2.js";var f=`
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`,p=`
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
}`,m=`
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
}`,h=`
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
}`,g=`
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
}`,_=(r,i,o=0,s=!1)=>new n(Math.max(1,r),Math.max(1,i),{type:e,format:t,colorSpace:u,depthBuffer:s,samples:o,minFilter:a,magFilter:a,generateMipmaps:!1}),v=class{target;levels=[];ups=[];quad;quadScene=new i;quadCam=new r(-1,1,1,-1,0,1);bright;down;up;composite;size=new o;gl;settings;scale=1;constructor(e,t,n){this.gl=e,this.settings=t;let r=t.antialias===`fxaa`||!n;this.target=_(1,1,r?0:4,!0);let i=new d;i.setAttribute(`position`,new s(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));let a=(e,t,n=!1)=>new c({vertexShader:f,fragmentShader:e,uniforms:t,depthTest:!1,depthWrite:!1,toneMapped:n});this.bright=a(p,{tColor:{value:null},uvScale:{value:new o(1,1)},threshold:{value:t.threshold},knee:{value:t.knee}}),this.down=a(m,{tSrc:{value:null},texel:{value:new o}}),this.up=a(h,{tSrc:{value:null},tBase:{value:null},texel:{value:new o}}),this.composite=a(g,{tColor:{value:null},tBloom:{value:null},strength:{value:t.strength},texel:{value:new o},uvScale:{value:new o(1,1)},uvMax:{value:new o(1,1)},sharpen:{value:t.sharpen??0}},!0),r&&(this.composite.defines={FXAA:``}),this.quad=new l(i,this.bright),this.quad.frustumCulled=!1,this.quadScene.add(this.quad)}resize(){let e=this.gl.getDrawingBufferSize(new o);if(e.equals(this.size))return;this.size.copy(e),this.target.setSize(e.x,e.y),this.composite.uniforms.texel.value.set(1/e.x,1/e.y),[...this.levels,...this.ups].forEach(e=>e.dispose()),this.levels=[],this.ups=[];let t=Math.floor(e.x/2),n=Math.floor(e.y/2);for(let e=0;e<this.settings.levels;e++)this.levels.push(_(t,n)),e<this.settings.levels-1&&this.ups.push(_(t,n)),t=Math.max(1,Math.floor(t/2)),n=Math.max(1,Math.floor(n/2))}pass(e,t){this.quad.material=e,this.gl.setRenderTarget(t),this.gl.render(this.quadScene,this.quadCam)}render(e,t){this.resize();let n=this.gl,r=Math.min(1,Math.max(.5,this.scale)),i=Math.max(1,Math.round(this.size.x*r)),a=Math.max(1,Math.round(this.size.y*r));this.target.viewport.set(0,0,i,a),this.target.scissor.set(0,0,i,a),this.target.scissorTest=i<this.size.x||a<this.size.y;let o=i/this.size.x,s=a/this.size.y;this.bright.uniforms.uvScale.value.set(o,s),this.composite.uniforms.uvScale.value.set(o,s),this.composite.uniforms.uvMax.value.set((i-.5)/this.size.x,(a-.5)/this.size.y),n.setRenderTarget(this.target),n.render(e,t),this.bright.uniforms.tColor.value=this.target.texture,this.pass(this.bright,this.levels[0]);for(let e=1;e<this.levels.length;e++){let t=this.levels[e-1];this.down.uniforms.tSrc.value=t.texture,this.down.uniforms.texel.value.set(1/t.width,1/t.height),this.pass(this.down,this.levels[e])}let c=this.levels[this.levels.length-1];for(let e=this.levels.length-2;e>=0;e--)this.up.uniforms.tSrc.value=c.texture,this.up.uniforms.tBase.value=this.levels[e].texture,this.up.uniforms.texel.value.set(1/c.width,1/c.height),this.pass(this.up,this.ups[e]),c=this.ups[e];this.composite.uniforms.tColor.value=this.target.texture,this.composite.uniforms.tBloom.value=c.texture,this.pass(this.composite,null)}materials(){return[this.bright,this.down,this.up,this.composite]}dispose(){[this.target,...this.levels,...this.ups].forEach(e=>e.dispose()),[this.bright,this.down,this.up,this.composite].forEach(e=>e.dispose()),this.quad.geometry.dispose()}},y=new WeakMap,b=e=>y.get(e)??null,x=(e,t)=>t?y.set(e,t):y.delete(e);export{b as n,x as r,v as t};