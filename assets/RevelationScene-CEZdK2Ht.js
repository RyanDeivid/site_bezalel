import{$t as e,An as t,Ct as n,D as r,Et as i,F as a,L as o,S as s,Tt as c,_ as l,_n as ee,cn as te,d as ne,kn as re,l as u,ln as d,lt as f,mn as ie,mt as p,on as m,r as ae,u as h,vn as oe,wt as se}from"./three.module-ohYwSPJ2.js";import{n as ce,r as g}from"./LionPage-DxglzYdE.js";import{t as le}from"./bloom-BA3JB77R.js";var ue=class extends Error{constructor(e){super(`WebGL por software (${e}): experiência 3D desativada`),this.name=`SoftwareRendererError`}},de={high:{count:14e4,cell:.016,dpr:1.75,bloom:!0,stars:3200,sparks:220},medium:{count:7e4,cell:.02,dpr:1.5,bloom:!0,stars:2e3,sparks:140},low:{count:32e3,cell:.026,dpr:1.25,bloom:!1,stars:1200,sparks:90}},_=new t(-.25,-.95,0),fe=new t(0,.15,0),pe=new t(2.05,.55,.35),me=new l(`#03060d`),v=[{p:0,pos:[0,.25,6.4],look:[0,.15,0]},{p:.3,pos:[.35,.3,3.4],look:[0,.15,0]},{p:.38,pos:[.3,.3,3.2],look:[0,.12,0]},{p:.45,pos:[1.8,.75,6.4],look:[.1,-.15,0]},{p:.62,pos:[3.4,1,6.3],look:[.35,-.2,0]},{p:.84,pos:[3.3,.8,4],look:[1.35,.15,.15]},{p:1,pos:[1.4,.8,7.8],look:[.75,-.05,0]}];function he(e,n,r){let i=0;for(;i<v.length-2&&e>v[i+1].p;)i++;let a=v[i],o=v[i+1],s=g((e-a.p)/(o.p-a.p)),c=s*s*(3-2*s);n.set(...a.pos).lerp(new t(...o.pos),c),r.set(...a.look).lerp(new t(...o.look),c)}var ge=`
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
}`,y=`
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = exp(-d * 14.0);
  gl_FragColor = vec4(vColor * a, 1.0);
}`,_e=`
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
}`,ve=`
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
}`,ye=`
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
}`;function be(){let e=document.createElement(`canvas`);e.width=1024,e.height=512;let t=e.getContext(`2d`);t.fillStyle=`#000`,t.fillRect(0,0,e.width,e.height);let n=11,r=()=>(n=n*1664525+1013904223>>>0)/2**32;t.strokeStyle=`#ffd99a`,t.lineCap=`round`;for(let e=0;e<3;e++)for(let n=46;n<470;n+=26){let i=60+e*320,a=i+250-r()*40;for(;i<a;){let e=6+r()*22;t.lineWidth=2+r()*2.5,t.beginPath(),t.moveTo(i,n+(r()-.5)*3),t.quadraticCurveTo(i+e/2,n-4-r()*8,i+e,n+(r()-.5)*4),t.stroke(),i+=e+4+r()*6}}let i=new ne(e);return i.colorSpace=m,i}function b({canvas:l,quality:m,reducedMotion:v,allowSoftware:b=!1,onReady:xe,onContextLost:Se}){let x=de[m],S=new ae({canvas:l,antialias:!x.bloom,alpha:!1,powerPreference:`high-performance`}),C=S.getContext(),Ce=C.getExtension(`WEBGL_debug_renderer_info`),we=String(Ce?C.getParameter(Ce.UNMASKED_RENDERER_WEBGL):C.getParameter(C.RENDERER));if(!b&&/swiftshader|llvmpipe|softpipe|software|basic render driver/i.test(we))throw S.dispose(),S.forceContextLoss(),new ue(we);let Te=Math.min(window.devicePixelRatio||1,x.dpr);S.setPixelRatio(Te),S.debug.checkShaderErrors=!1,S.toneMapping=4,S.toneMappingExposure=1.05,S.setClearColor(me,1);let w=x.bloom?new le(S,{strength:.85,threshold:.55,knee:.5,levels:m===`high`?6:5,antialias:`fxaa`},!1):null,T=new te;T.background=me;let E=new n(38,1,.05,120),D={value:0},O={value:Te},Ee=new d({vertexShader:`varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:ye,uniforms:{uTime:D,uGlow:{value:0}},side:1,depthWrite:!1}),De=new f(new ie(60,48,24),Ee);T.add(De);let k=new h;{let e=new Float32Array(x.stars*3),t=new Float32Array(x.stars);for(let n=0;n<x.stars;n++){let r=Math.random()*2-1,i=Math.random()*Math.PI*2,a=30+Math.random()*20,o=Math.sqrt(1-r*r);e.set([Math.cos(i)*o*a,r*a,Math.sin(i)*o*a],n*3),t[n]=Math.random()}k.setAttribute(`position`,new u(e,3)),k.setAttribute(`aSeed`,new u(t,1))}let Oe=new i(k,new d({vertexShader:_e,fragmentShader:y,uniforms:{uTime:D,uPixel:O},transparent:!0,depthWrite:!1,blending:2}));T.add(Oe),T.add(new o(`#8aa4d6`,`#120c08`,.5));let A=new c(`#ffcf8a`,3,6,1.6);T.add(A);let ke=new r(`#f3e3c4`,1.1);ke.position.set(2,3,4),T.add(ke);let j=new a;T.add(j);let Ae=new p({color:`#d8c39a`,roughness:.75,emissive:`#3a2810`,emissiveIntensity:.12}),je=new p({color:`#2a1a0e`,roughness:.5,metalness:.2}),Me=new p({color:`#c7a86a`,roughness:.3,metalness:1,emissive:`#c7a86a`,emissiveIntensity:.15}),Ne=[];for(let e of[-1,1]){let t=new a;t.add(new f(new s(.11,.11,1,40),Ae));let n=new f(new s(.035,.035,1.34,16),je);t.add(n);for(let e of[-1,1]){let n=new f(new ie(.055,20,12),Me);n.position.y=e*.67,t.add(n)}t.userData.side=e,Ne.push(t),j.add(t)}let Pe=be(),Fe=new p({color:`#e7d4ab`,roughness:.85,emissive:`#ffcf8a`,emissiveMap:Pe,emissiveIntensity:0,side:2}),M=new f(new se(1,.94),Fe);M.position.z=.02,j.add(M);let N=Array.from({length:7},()=>new p({color:`#7a1c16`,roughness:.45,metalness:.1,emissive:`#ff4a1c`,emissiveIntensity:.3})),Ie=new s(.052,.058,.03,28).rotateX(Math.PI/2),Le=N.map((e,t)=>{let n=new f(Ie,e);return n.position.set(0,(3-t)*.13,.13),j.add(n),n}),Re=(()=>{let e=document.createElement(`canvas`);e.width=e.height=128;let t=e.getContext(`2d`),n=t.createRadialGradient(64,64,0,64,64,64);return n.addColorStop(0,`rgba(255,220,160,1)`),n.addColorStop(.3,`rgba(255,180,90,0.35)`),n.addColorStop(1,`rgba(255,160,60,0)`),t.fillStyle=n,t.fillRect(0,0,128,128),new ne(e)})(),P=new ee(new oe({map:Re,color:`#ffffff`,transparent:!0,depthWrite:!1,blending:2,opacity:.25}));P.scale.setScalar(2.2),P.position.z=-.2,j.add(P);let F=new h;{let e=x.sparks*7,t=new Float32Array(e*3),n=new Float32Array(e*4),r=new Float32Array(e);for(let t=0;t<e;t++){let e=Math.random()*2-1,i=Math.random()*Math.PI*2,a=Math.sqrt(1-e*e);n.set([Math.cos(i)*a,e*.8+.2,Math.sin(i)*a*.6+.4,Math.random()],t*4),r[t]=Math.floor(t/x.sparks)}F.setAttribute(`position`,new u(t,3)),F.setAttribute(`aDir`,new u(n,4)),F.setAttribute(`aSeal`,new u(r,1))}let I=new d({vertexShader:ve,fragmentShader:y,uniforms:{uBreak:{value:Array(7).fill(0)},uSeal:{value:Array.from({length:7},()=>new t)},uPixel:O},transparent:!0,depthWrite:!1,blending:2}),ze=new i(F,I);ze.frustumCulled=!1,T.add(ze);let L={uTime:D,uForm:{value:0},uStir:{value:0},uRise:{value:0},uSize:{value:7.5*(m===`low`?1.5:m===`medium`?1.2:1)},uPixel:O,uBook:{value:fe.clone()},uRayO:{value:new t},uRayD:{value:new t(0,0,-1)},uMouse:{value:0}},Be=new d({vertexShader:ge,fragmentShader:y,uniforms:L,transparent:!0,depthWrite:!1,blending:2}),R=null,z=new Worker(new URL(`/site_bezalel/assets/worker-By5mNWkQ.js`,``+import.meta.url),{type:`module`,name:`bz-lion`});z.onmessage=e=>{if(Q||e.data.kind!==`samples`)return;let{positions:t,normals:n,shade:r}=e.data,a=r.length;for(let e=0;e<a;e++)t[e*3]=t[e*3]+_.x,t[e*3+1]=t[e*3+1]+_.y,t[e*3+2]=t[e*3+2]+_.z;let o=new Float32Array(a*4);for(let e=0;e<o.length;e++)o[e]=Math.random();let s=new h;s.setAttribute(`position`,new u(t,3)),s.setAttribute(`aTarget`,new u(t,3)),s.setAttribute(`aNormal`,new u(n,3)),s.setAttribute(`aShade`,new u(r,1)),s.setAttribute(`aSeed`,new u(o,4)),R=new i(s,Be),R.frustumCulled=!1,T.add(R),S.compileAsync(T,E).catch(()=>void 0).then(()=>{Q||(xe?.(),$())})},z.postMessage({kind:`samples`,count:x.count,cell:x.cell,seed:7});let B=+!!v,V=B,H=new re,U=new re,W=!1,G=0,K=new e,Ve=new t,He=new t,q=new t,J=new t;function Ue(e){V=v?B:V+(B-V)*Math.min(1,e*3.5);let t=ce(V);v||(D.value+=e*(1-t.still*.94)),L.uForm.value=t.form,L.uStir.value=t.stir,L.uRise.value=t.rise,q.copy(fe).lerp(pe,t.bookMove),q.y+=Math.sin(D.value*.8)*.03,j.position.copy(q),j.rotation.y=-.35*t.bookMove+Math.sin(D.value*.4)*.05,L.uBook.value.copy(q),Le.forEach((e,n)=>{let r=g(t.seals-n),i=r>0&&r<1;e.visible=r<.25,e.scale.setScalar(1+(i?r*1.8:0)),N[n].emissiveIntensity=.3+t.stir*(.6+.4*Math.sin(D.value*4+n))+r*4,I.uniforms.uBreak.value[n]=r,I.uniforms.uSeal.value[n].copy(e.getWorldPosition(J))});let n=t.unroll,r=.2+n*1.7;Ne.forEach(e=>e.position.x=e.userData.side*(r/2)),M.scale.x=Math.max(.001,r-.18),M.visible=n>.002,Fe.emissiveIntensity=.15+n*1.1+t.rise*.5,P.material.opacity=.14+t.seals/7*.22+n*.24,P.scale.setScalar(1.8+n*2+t.rise),A.position.copy(q).add(J.set(0,0,.5)),A.intensity=1.5+t.seals*.3+n*3,Ee.uniforms.uGlow.value=n+t.rise,U.lerp(W?H:U.set(U.x*.98,U.y*.98),Math.min(1,e*3)),he(V,Ve,He);let i=v?0:.35;E.position.copy(Ve).add(J.set(U.x*i,U.y*i*.6,0)),E.lookAt(He),G+=((W&&!v?1:0)-G)*Math.min(1,e*4),L.uMouse.value=G,K.setFromCamera(H,E),L.uRayO.value.copy(K.ray.origin),L.uRayD.value.copy(K.ray.direction)}let Y=0,X=0,Z=!0,Q=!1;function $(){Y||!Z||Q||(Y=requestAnimationFrame(We))}function We(e){Y=0;let t=X?Math.min(.05,(e-X)/1e3):1/60;X=e,Ue(t),w?w.render(T,E):S.render(T,E),!v||Math.abs(B-V)>1e-4?$():X=0}function Ge(){let e=l.clientWidth,t=l.clientHeight;e&&t&&(S.setSize(e,t,!1),E.aspect=e/t,E.fov=E.aspect<1?38+(1-E.aspect)*34:38,E.updateProjectionMatrix(),$())}Ge();let Ke=e=>{e.preventDefault(),Se?.()};l.addEventListener(`webglcontextlost`,Ke);let qe=()=>Ye(!document.hidden&&Je);document.addEventListener(`visibilitychange`,qe);let Je=!0;function Ye(e){Z=e,e?$():Y&&(cancelAnimationFrame(Y),Y=0,X=0)}return{setProgress(e){B=g(e),$()},setPointer(e,t){e===null?W=!1:(H.set(e,t),W=!0),$()},setVisible(e){Je=e,Ye(e&&!document.hidden)},resize:Ge,dispose(){Q=!0,Y&&cancelAnimationFrame(Y),z.terminate(),l.removeEventListener(`webglcontextlost`,Ke),document.removeEventListener(`visibilitychange`,qe),T.traverse(e=>{let t=e;t.geometry?.dispose(),(Array.isArray(t.material)?t.material:t.material?[t.material]:[]).forEach(e=>e.dispose())}),[Pe,Re].forEach(e=>e.dispose()),w?.dispose(),S.dispose()}}}export{ue as SoftwareRendererError,b as createRevelationScene};