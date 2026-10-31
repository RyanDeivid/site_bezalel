import{c as e,l as t,o as n,s as r,u as i}from"./index-D6h_Aru0.js";import{$ as a,An as o,At as s,Ct as c,D as l,Dt as u,Et as d,F as ee,L as te,P as ne,S as re,Tt as ie,V as ae,X as oe,Z as se,_ as ce,_n as le,c as ue,cn as de,ct as fe,d as f,k as pe,kn as me,l as p,ln as he,lt as ge,mn as _e,on as ve,pn as ye,pt as be,r as xe,t as Se,u as m,ut as Ce,vn as we,wt as Te}from"./three.module-ohYwSPJ2.js";import{i as Ee,n as De,r as Oe,t as ke}from"./UnrealBloomPass-SIKbHGiV.js";import{t as Ae}from"./RoomEnvironment-DsGuFHSs.js";import{n as je,t as Me}from"./robot-arm-SFhYAzZV.js";var h=2.6,g=h/2,Ne=-2.75,Pe=new ce(`#c7a86a`),Fe=32,Ie={high:{particles:14e3,dpr:1.75,fps:60,idleFps:24,bloom:!0,env:!0,sparks:220},medium:{particles:7e3,dpr:1.5,fps:60,idleFps:20,bloom:!1,env:!0,sparks:140},mobile:{particles:4200,dpr:1.5,fps:30,idleFps:0,bloom:!1,env:!0,sparks:90}};function Le(e){let t=e;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var Re=[{key:`top`,n:new o(0,1,0),t1:new o(1,0,0),t2:new o(0,0,1)},{key:`right`,n:new o(0,0,1),t1:new o(1,0,0),t2:new o(0,1,0)},{key:`left`,n:new o(-1,0,0),t1:new o(0,0,1),t2:new o(0,1,0)}],_=new o(-1.3,g,g),ze=`
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
  uniform float uHi[${Fe}];
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
    vColor = mix(aColor, vec3(1.0, 0.28, 0.22) * 1.4, reject * smoothstep(0.0, 0.2, s));
    float appear = smoothstep(0.0, 0.12, uGather - aRand.x * 0.45);
    float fade = 1.0 - reject * smoothstep(0.35, 0.95, s);
    float absorbed = 1.0 - 0.85 * uBuild * (1.0 - reject);
    vAlpha = appear * fade * absorbed * mix(0.22, 1.0, hi) * (1.0 - uEnter);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float size = uSize * (0.55 + aRand.z * 0.9) * mix(0.75, 1.35, hi) * (1.0 - 0.55 * uBuild) * (1.0 + reject * s * (1.0 - s) * 2.4);
    gl_PointSize = size / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`,Be=`
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
`,Ve=`
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
`,He=`
  uniform float uOpacity;
  varying float vEnd;
  varying float vGrow;
  varying vec3 vColor;
  void main() {
    if (vEnd > vGrow) discard;
    float head = smoothstep(vGrow - 0.18, vGrow, vEnd) * step(vGrow, 0.999);
    gl_FragColor = vec4(vColor + head * 0.8, uOpacity * (0.55 + head));
  }
`,Ue=`
  varying vec2 vXZ;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vXZ = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`,We=`
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
`;function Ge(){let e=document.createElement(`canvas`);e.width=e.height=128;let t=e.getContext(`2d`);if(t){let e=t.createRadialGradient(64,64,0,64,64,64);e.addColorStop(0,`rgba(255,240,210,1)`),e.addColorStop(.25,`rgba(234,207,150,0.55)`),e.addColorStop(1,`rgba(199,168,106,0)`),t.fillStyle=e,t.fillRect(0,0,128,128)}let n=new f(e);return n.colorSpace=ve,n}var Ke=class extends Error{constructor(e){super(`WebGL por software (${e}): cena 3D desativada`),this.name=`SoftwareRendererError`}};function qe(e){let t=e.getExtension(`WEBGL_debug_renderer_info`),n=String(t?e.getParameter(t.UNMASKED_RENDERER_WEBGL):e.getParameter(e.RENDERER));return/swiftshader|llvmpipe|softpipe|software|basic render driver/i.test(n)?n:null}function v({canvas:f,quality:ve,data:v,onLock:Je,onContextLost:Ye,allowSoftware:Xe=!1}){let y=Ie[ve],b=Le(20261011),x=new xe({canvas:f,antialias:ve!==`mobile`,alpha:!1,powerPreference:`high-performance`}),Ze=qe(x.getContext());if(Ze&&!Xe)throw x.dispose(),x.forceContextLoss(),new Ke(Ze);x.setPixelRatio(Math.min(window.devicePixelRatio||1,y.dpr)),x.debug.checkShaderErrors=!1,x.toneMapping=4,x.toneMappingExposure=.95,x.setClearColor(`#070d17`,1);let S=new de;S.background=new ce(`#070d17`),S.fog=new ne(`#070d17`,.035);let C=new c(34,1,.1,120),Qe=new o(0,1.6,13.5);C.position.copy(Qe);let $e=null,et=null;y.env&&(et=new Se(x),$e=et.fromScene(new Ae,.04).texture,S.environment=$e),S.add(new te(`#9fb8e0`,`#0a1220`,.55));let tt=new l(`#f2e8d5`,1.25);tt.position.set(5,9,7);let nt=new l(`#6f9be8`,1.1);nt.position.set(-7,4,-6);let rt=new ie(`#e8c98a`,0,12,1.6);S.add(tt,nt,rt);let w=new ee;S.add(w);let T=new ee;T.rotation.set(Math.atan(1/Math.SQRT2),Math.PI/4,0),w.add(T),T.updateMatrix();let it=_.clone().applyMatrix4(T.matrix),at=new he({vertexShader:Ue,fragmentShader:We,uniforms:{uColor:{value:Pe.clone()},uGlow:{value:0},uReveal:{value:0}},transparent:!0,depthWrite:!1}),ot=new ge(new Te(40,40).rotateX(-Math.PI/2),at);ot.position.y=Ne,w.add(ot);let st=Ge(),ct=new le(new we({map:st,transparent:!0,depthWrite:!1,blending:2,toneMapped:!1}));ct.position.copy(it),w.add(ct);let lt=new ge(new _e(.11,24,16),new Ce({color:`#fff3d6`,toneMapped:!1}));lt.position.copy(_),T.add(lt),rt.position.copy(it);let ut=[-1.3,g],E=[];for(let e of ut)for(let t of ut)for(let n of ut){let r=new o(e,t,n);e<0&&E.push([r,new o(g,t,n)]),t<0&&E.push([r,new o(e,g,n)]),n<0&&E.push([r,new o(e,t,g)])}E.push([new o(-1.3,g/3,-1.3),new o(-1.3,g/3,g)]),E.push([new o(-1.3,-1.3/3,-1.3),new o(-1.3,-1.3/3,g)]);let dt=E.map(([e,t])=>e.distanceTo(_)<=t.distanceTo(_)?[e,t]:[t,e]).sort((e,t)=>e[0].distanceTo(_)+e[1].distanceTo(_)-(t[0].distanceTo(_)+t[1].distanceTo(_))),ft=new re(.022,.022,1,8,1,!0).translate(0,.5,0),pt=new Ce({color:`#e7cf98`,toneMapped:!1,transparent:!0}),mt=dt.map(([e,t],n)=>{let r=new ge(ft,pt);return r.position.copy(e),r.quaternion.setFromUnitVectors(new o(0,1,0),t.clone().sub(e).normalize()),r.userData={length:e.distanceTo(t),order:n/dt.length},r.scale.set(1,1e-4,1),T.add(r),r}),ht=h/4*.93,gt=new ue(ht,ht,.07),_t=[new be({color:`#c9a464`,metalness:1,roughness:.26,clearcoat:.5,clearcoatRoughness:.2,envMapIntensity:1.15}),new be({color:`#2f4a6d`,metalness:.9,roughness:.3,clearcoat:.3,envMapIntensity:1}),new be({color:`#16243a`,metalness:.35,roughness:.12,transparent:!0,opacity:.6,emissive:`#c7a86a`,emissiveIntensity:.04,envMapIntensity:1.2})],vt=[],yt=Re.map((e,t)=>{let n=new ae(gt,_t[t],16);n.frustumCulled=!1;let r=new s().setFromUnitVectors(new o(0,0,1),e.n),i=0;for(let n=0;n<4;n++)for(let a=0;a<4;a++){let c=-1.3+(n+.5)*(h/4),l=-1.3+(a+.5)*(h/4),u=e.n.clone().multiplyScalar(1.2650000000000001).addScaledVector(e.t1,c).addScaledVector(e.t2,l),d=u.clone().addScaledVector(e.n,2.4+b()*2.2).add(new o(b()-.5,b()-.5,b()-.5).multiplyScalar(1.6)),ee=new s().setFromEuler(new pe((b()-.5)*2.4,(b()-.5)*2.4,(b()-.5)*2.4)),te=u.distanceTo(_)/(h*1.75)*.62+b()*.05;vt.push({face:t,index:i,final:new fe().compose(u,r,new o(1,1,1)),from:d,to:u,q:r,spin:ee,delay:te}),i++}return T.add(n),n}),D=y.particles,bt=v.areaWeights.length||1,xt=v.areaWeights.reduce((e,t)=>e+Math.max(1,t),0)||1,St=e=>{let t=0;for(let n=0;n<v.areaWeights.length;n++)if(t+=Math.max(1,v.areaWeights[n])/xt,e<=t)return n;return bt-1},Ct=new Float32Array(D*3),wt=new Float32Array(D*3),Tt=new Float32Array(D*3),Et=new Float32Array(D*3),Dt=new Float32Array(D*4),Ot=new Float32Array(D),O=new o,kt=Array.from({length:bt},(e,t)=>r(t,bt));for(let e=0;e<D;e++){O.set(b()*2-1,(b()*2-1)*.7,b()*2-1).normalize().multiplyScalar(9+b()*7),O.z>4&&(O.z=-O.z),Ct.set([O.x,O.y,O.z],e*3);let t=b()*Math.PI*2,n=2.4+b()*2.4;wt.set([Math.cos(t)*n,(b()-.5)*2.6,Math.sin(t)*n],e*3);let r=Re[Math.floor(b()*3)];O.copy(r.n).multiplyScalar(1.32).addScaledVector(r.t1,(b()*2-1)*g).addScaledVector(r.t2,(b()*2-1)*g).applyMatrix4(T.matrix),Tt.set([O.x,O.y,O.z],e*3);let i=St(b());Ot[e]=Math.min(i,31),Et.set(kt[i],e*3),Dt.set([b(),b(),b(),+(b()<.22)],e*4)}let k=new m;k.setAttribute(`position`,new p(Ct,3)),k.setAttribute(`aStart`,new p(Ct,3)),k.setAttribute(`aCloud`,new p(wt,3)),k.setAttribute(`aTarget`,new p(Tt,3)),k.setAttribute(`aColor`,new p(Et,3)),k.setAttribute(`aRand`,new p(Dt,4)),k.setAttribute(`aArea`,new p(Ot,1)),k.boundingSphere=new ye(new o,30);let A={uTime:{value:0},uGather:{value:0},uSort:{value:0},uBuild:{value:0},uEnter:{value:0},uSize:{value:0},uHi:{value:Array(Fe).fill(1)},uAnyHi:{value:0}},At=new he({vertexShader:ze,fragmentShader:Be,uniforms:A,transparent:!0,depthWrite:!1,blending:2}),jt=new d(k,At);w.add(jt);let Mt=Math.max(1,v.courseAreas.length),Nt=v.courseAreas.map((e,t)=>{let n=t/Mt*Math.PI*2+.4;return new o(Math.cos(n)*4.3,-.9+t*7%11/4.5,Math.sin(n)*4.3)}),Pt=Array.from({length:Math.max(1,v.skillCount)},(e,t)=>{let n=Re[t%3],r=(t*.618%1*2-1)*g*.85,i=((t*.382+.17)%1*2-1)*g*.85;return n.n.clone().multiplyScalar(1.33).addScaledVector(n.t1,r).addScaledVector(n.t2,i).applyMatrix4(T.matrix)}),j=v.links.length,Ft=new Float32Array(j*6),It=new Float32Array(j*2),Lt=new Float32Array(j*2),Rt=new Float32Array(j*6);v.links.forEach(([e,t],n)=>{let r=Nt[e]??Nt[0],i=Pt[t]??Pt[0];Ft.set([r.x,r.y,r.z,i.x,i.y,i.z],n*6),It.set([0,1],n*2),Lt.set([e/Mt,e/Mt],n*2);let a=kt[v.courseAreas[e]??0]??[1,1,1];Rt.set([...a,...a],n*6)});let M=new m;M.setAttribute(`position`,new p(Ft,3)),M.setAttribute(`aEnd`,new p(It,1)),M.setAttribute(`aOrder`,new p(Lt,1)),M.setAttribute(`aColor`,new p(Rt,3));let zt={uGrow:{value:0},uOpacity:{value:0}},Bt=new he({vertexShader:Ve,fragmentShader:He,uniforms:zt,transparent:!0,depthWrite:!1,blending:2}),Vt=new a(M,Bt);w.add(Vt);let Ht=new m().setFromPoints(Nt),Ut=new u({map:st,size:.55,transparent:!0,depthWrite:!1,blending:2,opacity:0,toneMapped:!1}),Wt=new d(Ht,Ut);w.add(Wt);let Gt=[[-4.5,.4,`#5cc8a1`],[4.4,.2,`#73a7e0`],[-3,-3.2,`#b49ae8`],[3.2,-3,`#e3b35a`]],Kt=Gt.map(([e,t,n])=>{let r=new je(n);return r.root.position.set(e,Ne,t),r.root.scale.setScalar(1e-4),w.add(r.root),r}),N=new Me(Kt,$e);S.add(N.group);let qt=new m().setFromPoints([new o,new o]),Jt=Gt.map(([,,e])=>{let t=new oe(qt.clone(),new se({color:e,transparent:!0,opacity:0,blending:2,depthWrite:!1,toneMapped:!1}));return t.frustumCulled=!1,w.add(t),t}),P=y.sparks,F=new Float32Array(P*3),I=new Float32Array(P*3),Yt=new Float32Array(P),Xt=new m;Xt.setAttribute(`position`,new p(F,3));let Zt=new u({color:`#ffcf7a`,size:.07,transparent:!0,depthWrite:!1,blending:2,toneMapped:!1}),Qt=new d(Xt,Zt);Qt.frustumCulled=!1,w.add(Qt);let $t=0,L=0,en=(e,t)=>{for(let n=0;n<t;n++){let t=$t++%P;F.set([e.x,e.y,e.z],t*3),I.set([(Math.random()-.5)*3,Math.random()*2.4,(Math.random()-.5)*3],t*3),Yt[t]=.5+Math.random()*.5,L=P}},R=null,z=null;y.bloom&&(R=new Ee(x),R.addPass(new De(S,C)),z=new ke(new me(256,256),.45,.5,.92),R.addPass(z),R.addPass(new Oe));let B=0,V=0,H=0,U=!1,W=0,G=0,K=1,q=1,tn=0,nn=0,J=null,rn=1,an=!1,Y=0,on=-1,sn=!0,cn=0,ln=new s,un=new fe,X=new fe,dn=new o,Z=new o,Q=new o,fn=new o(1,1,1),pn=new o(1e-4,1e-4,1e-4),mn=new s,hn=new o(0,.05,.9),gn=new o;function _n(e,t,n){let r=-tn*K,a=nn*q,o=J?1-i(.03,.3,e):0;if(J&&o>0){C.clearViewOffset(),C.updateProjectionMatrix(),C.updateMatrixWorld();let e=Z.copy(n).project(C),t=(e.x+1)/2*K-J.x*K,i=(1-e.y)/2*q-J.y*q;r+=(t-r)*o,a+=(i-a)*o}let s=1-t;C.setViewOffset(K,q,r*s,a*s,K,q)}function vn(r){let a=Math.abs(B-V)>2e-4;V+=(B-V)*(1-Math.exp(-r*7)),Math.abs(B-V)<1e-4&&(V=B),H+=r;let o=t(V);!an&&V>=.875?(an=!0,Y=1,Je?.()):an&&V<.845&&(an=!1),Y=Math.max(0,Y-r*1.6);let s=i(0,n,V);w.rotation.y=-.75*(1-s)+Math.sin(H*.15)*.04*(1-s),w.updateMatrixWorld(),X.copy(w.matrixWorld).invert(),Q.copy(it).applyMatrix4(w.matrixWorld);let c=(13.5-i(.06,.88,V)*3.4)*rn;if(C.position.set(0,1.6*(1-i(.5,n,V)),c),gn.set(0,0,0),o.enter>0){let e=o.enter*o.enter;C.position.lerp(Z.copy(Q).add(hn),e),gn.lerp(Q,e),C.fov=34+e*24}else C.fov=34;C.lookAt(gn),C.updateProjectionMatrix(),_n(V,o.enter,Q),C.updateProjectionMatrix();let l=.5+Math.sin(H*2.4)*.5,u=.55+l*.2+o.gather*.95+o.build*1.6+Y*3.5+o.enter*6;if(ct.scale.setScalar(u),ct.material.opacity=.65+l*.25,rt.intensity=1.5+o.build*6+Y*14,lt.scale.setScalar(.6+l*.25+o.build*.8),at.uniforms.uReveal.value=i(.1,.4,V),at.uniforms.uGlow.value=o.build*.8+Y,A.uTime.value=H,A.uGather.value=o.gather,A.uSort.value=o.sort,A.uBuild.value=o.build,A.uEnter.value=o.enter,mt.forEach(t=>{let{length:n,order:r}=t.userData,i=e((o.connect-r*.55)/.45);t.visible=i>.001,t.scale.set(1,Math.max(1e-4,i*n),1)}),jt.visible=o.gather>0&&o.enter<1,ot.visible=V>.08,yt.forEach(e=>e.visible=o.build>0),N.group.visible=o.arms>.001,pt.opacity=.35+o.build*.65,zt.uGrow.value=o.connect,zt.uOpacity.value=.55*(1-o.build*.75)*(1-o.enter),Ut.opacity=i(.5,.62,V)*(1-o.build*.6)*(1-o.enter),Vt.visible=o.connect>0&&zt.uOpacity.value>.001,Wt.visible=Ut.opacity>.005,o.build!==on){on=o.build;for(let t of vt){let n=e((o.build-t.delay)/.3),r=1-(1-n)**3;n<=0?un.compose(t.from,t.q,pn):(Z.lerpVectors(t.from,t.to,r),ln.copy(t.spin).slerp(mn,r).premultiply(t.q),un.compose(Z,ln,fn)),yt[t.face].setMatrixAt(t.index,un)}yt.forEach(e=>e.instanceMatrix.needsUpdate=!0)}if((o.arms>0||sn)&&Kt.forEach((e,t)=>{e.root.scale.setScalar(Math.max(1e-4,o.arms));let n=Jt[t],i=n.material;if(o.arms<.02)e.rest(1),i.opacity=0;else if(o.build>.01&&o.build<.99){let n=null;for(let e of vt){if(e.index%4!==t)continue;let r=(o.build-e.delay)/.3;r>0&&r<1.15&&(!n||e.delay>n.delay)&&(n=e)}n?Z.copy(n.to):Z.copy(Re[t%3].n).multiplyScalar(g),Z.applyMatrix4(T.matrix).applyMatrix4(w.matrixWorld),e.reach(Z,Math.min(1,r*6),.9),n&&a&&Math.random()<r*30&&en(e.tipWorld(dn).applyMatrix4(X),3),i.opacity=0}else if(o.sort>.01&&o.connect<.5){Z.set(Math.sin(H*.8+t*1.7)*3.2,Math.cos(H*.6+t)*1.1,Math.cos(H*.5+t*2.1)*3.2).applyMatrix4(w.matrixWorld),e.reach(Z,Math.min(1,r*3),.2);let a=n.geometry.getAttribute(`position`),s=e.tipWorld(dn).applyMatrix4(X);a.setXYZ(0,s.x,s.y,s.z);let c=Z.applyMatrix4(X);a.setXYZ(1,c.x,c.y,c.z),a.needsUpdate=!0,i.opacity=.75*o.arms*(1-o.connect*2)}else e.reach(Q,Math.min(1,r*2.5),.3),i.opacity=0}),sn=o.arms>0,N.group.visible&&N.sync(),Jt.forEach(e=>e.visible=e.material.opacity>.01),L>0&&L--,L>0)for(let e=0;e<P;e++)Yt[e]<=0?F[e*3+1]=-100:(Yt[e]-=r,I[e*3+1]-=9.8*r,F[e*3]+=I[e*3]*r,F[e*3+1]+=I[e*3+1]*r,F[e*3+2]+=I[e*3+2]*r);L>0&&(Xt.getAttribute(`position`).needsUpdate=!0),Qt.visible=L>0,z&&(z.strength=.4+o.build*.2+Y*.6)}let $=!1;function yn(e){if(!U)return;let t=e-cn>1500&&Math.abs(B-V)<.001&&Y<=0&&L===0;if(t&&y.idleFps===0){$=!0,G=0;return}W=requestAnimationFrame(yn);let n=1e3/(t?y.idleFps:y.fps);if(G&&e-G<n-2)return;let r=G?Math.min(.05,(e-G)/1e3):1/y.fps;G=e,vn(r),R?R.render():x.render(S,C),xn.frames++,xn.calls=x.info.render.calls}let bn=[];S.traverse(e=>{e.visible||=(bn.push(e),!0)}),N.group.visible=!0,x.compileAsync(S,C).catch(()=>void 0),bn.forEach(e=>e.visible=!1);let xn={frames:0,calls:0};f.bzStats=xn;let Sn=e=>{e.preventDefault(),U=!1,cancelAnimationFrame(W),Ye?.()};return f.addEventListener(`webglcontextlost`,Sn),{setProgress(t){let n=e(t);n!==B&&(cn=performance.now(),$&&U&&($=!1,W=requestAnimationFrame(yn))),B=n},setInterests(e){let t=A.uHi.value;t.fill(0),e.forEach(e=>{e>=0&&e<Fe&&(t[e]=1)}),A.uAnyHi.value=+!!e.length},setActive(e){e!==U&&(U=e,cancelAnimationFrame(W),G=0,$=!1,U&&(cn=performance.now(),W=requestAnimationFrame(yn)))},resize(e,t){K=Math.max(1,e),q=Math.max(1,t),x.setSize(K,q,!1),R?.setSize(K,q),z?.resolution.set(K/2,q/2),C.aspect=K/q,rn=C.aspect<1?Math.min(1.85,.8/C.aspect):1,w.updateMatrixWorld(),A.uSize.value=52*x.getPixelRatio()*(q/900),U||(vn(0),R?R.render():x.render(S,C))},setFraming(e,t){tn=e,nn=t},setAnchor(e,t){J={x:e,y:t}},dispose(){U=!1,cancelAnimationFrame(W),f.removeEventListener(`webglcontextlost`,Sn),S.traverse(e=>{let t=e;t.geometry?.dispose();let n=t.material;Array.isArray(n)?n.forEach(e=>e.dispose()):n?.dispose()}),N.dispose(),st.dispose(),$e?.dispose(),et?.dispose(),R?.dispose(),x.dispose()}}}export{Ke as SoftwareRendererError,v as createForjaScene};