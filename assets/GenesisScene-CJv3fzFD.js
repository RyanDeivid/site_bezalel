import{An as e,At as t,B as n,Ct as r,E as i,Et as a,F as o,I as s,It as c,Nn as l,R as u,S as d,St as f,T as p,V as m,_ as h,bt as g,cn as _,ct as v,d as y,en as b,et as x,h as S,jn as C,kn as w,l as T,ln as E,lt as D,m as O,mn as k,on as A,pn as j,r as M,s as N,tt as ee,u as P,w as te,wt as ne}from"./three.module-ohYwSPJ2.js";import{t as re}from"./BufferGeometryUtils-fecWr4EI.js";import{INITIAL_WORLD as ie,mixWorld as ae,smooth as oe}from"./world-BKj4quf_.js";import{t as se}from"./quality-oez9ZRLQ.js";var ce=(e,t)=>[e[0]+t[0],e[1]+t[1],e[2]+t[2]],le=(e,t)=>[e[0]-t[0],e[1]-t[1],e[2]-t[2]],ue=(e,t)=>[e[0]*t,e[1]*t,e[2]*t],de=e=>Math.hypot(e[0],e[1],e[2]),fe=e=>ue(e,1/(de(e)||1));function pe(e,t){let n=Math.cos(e),r=Math.sin(e),i=Math.cos(t),a=Math.sin(t),o=[n*i,-n*a,r,a,i,0,-r*i,r*a,n];return{apply:e=>[o[0]*e[0]+o[1]*e[1]+o[2]*e[2],o[3]*e[0]+o[4]*e[1]+o[5]*e[2],o[6]*e[0]+o[7]*e[1]+o[8]*e[2]],inverse:[o[0],o[3],o[6],o[1],o[4],o[7],o[2],o[5],o[8]]}}var me=(e,t,n,r,i=0)=>({t:0,part:e,c:t,r:n,k:r,phase:i,bc:t,br:n}),F=(e,t,n,r,i=null,a=0)=>({t:1,part:e,c:t,r:n,inv:i,k:r,phase:a,bc:t,br:Math.max(...n)}),I=(e,t,n,r,i,a,o=0)=>({t:2,part:e,a:t,b:r,ra:n,rb:i,k:a,phase:o,bc:ue(ce(t,r),.5),br:de(le(r,t))/2+Math.max(n,i)});function he(e){let t=e>>>0;return()=>(t=t*1664525+1013904223>>>0,t/2**32)}function ge(e){let t=[],n=[],r=e===`block`,i=(e,t,r=.016)=>n.push({a:e,b:t,r}),a=[-.68,.98,0],o=[.4,1.12,0];if(t.push(I(`body`,a,.25,o,.3,0)),t.push(F(`body`,[.46,.9,0],[.3,.36,.27],.16)),t.push(F(`body`,[.1,.93,0],[.42,.27,.27],.18)),t.push(F(`body`,[-.3,.92,0],[.36,.19,.21],.2)),t.push(F(`body`,[-.6,.95,0],[.26,.26,.24],.14)),!r)for(let e of[1,-1])t.push(F(`body`,[.34,1,.17*e],[.2,.26,.1],.1));i(a,[-.12,1.04,0]),i([-.12,1.04,0],o);for(let n of[1,-1]){let a=.15*n,o=n===1,s=[.42,.86,a],c=o?[.5,.56,a]:[.37,.52,a],l=o?[.7,.3,a]:[.43,.15,a],u=o?[.78,.26,a]:[.51,.042,a],d=[.11,.055,.085],f=o?pe(0,-.5).inverse:null;r?(t.push(I(`limb`,s,.14,l,.075,.1)),t.push(F(`limb`,u,d,.05,f))):(t.push(I(`limb`,s,.13,c,.095,.08)),t.push(I(`limb`,c,.095,l,.066,.05)),t.push(F(`limb`,u,d,.045,f))),i(s,c),i(c,l),i(l,u);let p=[-.6,.86,a],m=[-.5,.58,a],h=[-.74,.3,a],g=[-.66,.1,a],_=[-.58,.042,a];if(r?(t.push(I(`limb`,p,.2,h,.07,.1)),t.push(I(`limb`,h,.065,g,.058,.04)),t.push(F(`limb`,_,d,.05))):(t.push(F(`limb`,[-.6,.8,a*1.05],[.24,.3,.12],.12)),t.push(I(`limb`,m,.11,h,.06,.06)),t.push(I(`limb`,[-.78,.85,a],.09,h,.05,.07)),t.push(I(`limb`,h,.058,g,.055,.04)),t.push(F(`limb`,_,d,.045))),i(p,m),i(m,h),i(h,g),i(g,_),e===`final`)for(let e of[u,_])for(let n of[-.05,-.017,.017,.05]){let r=e===u&&o?-.03:0;t.push(me(`detail`,[e[0]+.075-Math.abs(n)*.35,e[1]-.008+r,e[2]+n],.028,.016))}}let s=[[-.88,1.04,0],[-1.12,.92,.02],[-1.27,.68,.06],[-1.3,.44,.1],[-1.22,.27,.13]],c=[.062,.054,.046,.041,.038];if(r)t.push(I(`tail`,s[0],.058,s[3],.037,.05));else for(let e=0;e<s.length-1;e++)t.push(I(`tail`,s[e],c[e],s[e+1],c[e+1],.07));r||t.push(F(`tail`,[-1.18,.21,.13],[.065,.1,.065],.03));for(let e=0;e<s.length-1;e++)i(s[e],s[e+1],.012);i(a,s[0],.012);let l=[.45,1.06,0],u=[.9,1.44,.02];t.push(I(`body`,l,.26,[.74,1.34,.01],.2,.1)),i(o,l),i(l,u);let d=pe(-.32,.08),f=1.12,p=e=>ce(u,d.apply(ue(e,f))),m=d.inverse,h=(e,n,r,i,a=0)=>t.push(F(e,p(n),ue(r,f),i*f,m,a)),g=(e,n,r,i,a,o,s=0)=>t.push(I(e,p(n),r*f,p(i),a*f,o*f,s)),_=(e,n,r,i,a=0)=>t.push(me(e,p(n),r*f,i*f,a));if(r)h(`head`,[.02,0,0],[.24,.21,.2],.08),h(`head`,[.22,-.08,0],[.18,.12,.13],.07),h(`mane`,[-.2,-.1,0],[.36,.46,.42],.12),t.push(F(`mane`,[.62,1,0],[.2,.32,.24],.12));else{h(`head`,[0,.02,0],[.21,.19,.18],.08),h(`head`,[.12,.08,0],[.14,.08,.15],.06),h(`head`,[.2,-.07,0],[.16,.1,.12],.06),g(`head`,[.06,.075,0],.08,[.32,0,0],.066,.04);for(let e of[1,-1])h(`head`,[.28,-.1,.055*e],[.095,.072,.07],.03),h(`head`,[.06,-.06,.11*e],[.13,.11,.08],.07),g(`head`,[.23,.085,.03*e],.04,[.16,.1,.13*e],.032,.025),h(`head`,[-.06,.2,.14*e],[.05,.075,.035],.03);if(h(`head`,[.16,-.19,0],[.11,.055,.085],.045),e===`final`){for(let e of[1,-1])_(`detail`,[.19,.035,.085*e],.034,.015,1),_(`detail`,[.372,-.03,.025*e],.014,.006,1),g(`detail`,[.35,-.14,.01*e],.007,[.2,-.135,.095*e],.006,.008,1),_(`detail`,[.172,.034,.08*e],.026,.006,2);h(`detail`,[.375,-.02,0],[.04,.042,.065],.018,2)}let r=[-.2,-.1,0],i=[.36,.44,.42];h(`mane`,r,i,.12),t.push(F(`mane`,[.62,1,0],[.2,.32,.24],.12)),t.push(F(`mane`,[.38,1.13,0],[.26,.2,.26],.14));let a=he(5),o=0,s=(e,t,r,i)=>{let a=ce(e,ue(t,r)),s=ce(a,ue(fe(ce(t,[0,-.6,0])),r*.3));g(`mane`,e,i,a,i*.55,.05),g(`mane`,a,i*.52,s,.018,.03),o++%3==0&&n.push({a:p(e),b:p(a),r:.006})};for(let e=0;e<140;e++){let t=1-2*(e+.5)/140,n=Math.sqrt(1-t*t),o=e*2.39996323,c=[n*Math.cos(o),t,n*Math.sin(o)],l=[r[0]+c[0]*i[0],r[1]+c[1]*i[1],r[2]+c[2]*i[2]];if(l[0]>.06||l[0]<-.5||l[0]>-.05&&Math.hypot(l[1]+.03,l[2])<.2)continue;let u=fe([c[0]/i[0],c[1]/i[1],c[2]/i[2]]),d=[-.8,-.55-(l[1]<-.1?.35:0),0],f=fe(ce(fe(le(d,ue(u,d[0]*u[0]+d[1]*u[1]+d[2]*u[2]))),ue(u,.1+a()*.1)));s(ce(r,[c[0]*i[0]*.93,c[1]*i[1]*.93,c[2]*i[2]*.93]),f,.14+a()*.08+(l[1]<-.1?.07:0),.076-a()*.016)}for(let e=0;e<16;e++){let t=e/16*Math.PI*2+.2;s([-.05,Math.cos(t)*.23-.05,Math.sin(t)*.24],fe([-.85,Math.cos(t)*.45-.2,Math.sin(t)*.45]),.1+a()*.04,.058)}}let v=[1/0,1/0,1/0],y=[-1/0,-1/0,-1/0];for(let e of t)if(e.phase!==1)for(let t=0;t<3;t++)v[t]=Math.min(v[t],e.bc[t]-e.br-e.k),y[t]=Math.max(y[t],e.bc[t]+e.br+e.k);return v[1]=Math.max(v[1],-.02),{prims:t,bones:n,bounds:{min:v,max:y}}}function L(e,t,n){if(n<=0)return Math.min(e,t);let r=Math.max(n-Math.abs(e-t),0)/n;return Math.min(e,t)-r*r*n*.25}function _e(e,t,n,r){if(e.t===0)return Math.hypot(t-e.c[0],n-e.c[1],r-e.c[2])-e.r;if(e.t===1){let i=t-e.c[0],a=n-e.c[1],o=r-e.c[2];if(e.inv){let t=e.inv,n=t[0]*i+t[1]*a+t[2]*o,r=t[3]*i+t[4]*a+t[5]*o,s=t[6]*i+t[7]*a+t[8]*o;i=n,a=r,o=s}let s=Math.hypot(i/e.r[0],a/e.r[1],o/e.r[2]),c=Math.hypot(i/(e.r[0]*e.r[0]),a/(e.r[1]*e.r[1]),o/(e.r[2]*e.r[2]));return c>1e-9?s*(s-1)/c:-Math.min(e.r[0],e.r[1],e.r[2])}let i=e.b[0]-e.a[0],a=e.b[1]-e.a[1],o=e.b[2]-e.a[2],s=i*i+a*a+o*o,c=e.ra-e.rb,l=s-c*c,u=1/s,d=t-e.a[0],f=n-e.a[1],p=r-e.a[2],m=d*i+f*a+p*o,h=m-s,g=d*s-i*m,_=f*s-a*m,v=p*s-o*m,y=g*g+_*_+v*v,b=m*m*s,x=h*h*s,S=Math.sign(c)*c*c*y;return Math.sign(h)*l*x>S?Math.sqrt(y+x)*u-e.rb:Math.sign(m)*l*b<S?Math.sqrt(y+b)*u-e.ra:(Math.sqrt(y*l*u)+m*c)*u-e.ra}function R(e,t,n,r){let i=1e9;for(let a=0;a<e.add.length;a++){let o=e.add[a];i=L(i,_e(o,t,n,r),o.k)}for(let a=0;a<e.carve.length;a++){let o=e.carve[a];i=-L(-i,_e(o,t,n,r),o.k)}for(let a=0;a<e.finish.length;a++){let o=e.finish[a];i=L(i,_e(o,t,n,r),o.k)}return i}function z(e,t,n){let{min:r,max:i}=e.bounds,a=Math.max(1,Math.ceil((i[0]-r[0])/t)),o=Math.max(1,Math.ceil((i[1]-r[1])/t)),s=Math.max(1,Math.ceil((i[2]-r[2])/t)),c=t*Math.sqrt(3)/2,l=Array.from({length:a*o*s},()=>({add:[],carve:[],finish:[],size:0}));for(let i of e.prims){let e=i.br+i.k+n,u=(n,a)=>[Math.max(0,Math.floor((i.bc[n]-e-c-r[n])/t)),Math.min(a-1,Math.floor((i.bc[n]+e+c-r[n])/t))],[d,f]=u(0,a),[p,m]=u(1,o),[h,g]=u(2,s);for(let n=d;n<=f;n++)for(let a=p;a<=m;a++)for(let u=h;u<=g;u++){let d=r[0]+(n+.5)*t,f=r[1]+(a+.5)*t,p=r[2]+(u+.5)*t;if(Math.hypot(d-i.bc[0],f-i.bc[1],p-i.bc[2])-e>=c)continue;let m=l[(n*o+a)*s+u];(i.phase===0?m.add:i.phase===1?m.carve:m.finish).push(i),i.phase===0&&m.size++}}return{at(e,n,i){let c=Math.min(a-1,Math.max(0,Math.floor((e-r[0])/t))),u=Math.min(o-1,Math.max(0,Math.floor((n-r[1])/t))),d=Math.min(s-1,Math.max(0,Math.floor((i-r[2])/t)));return l[(c*o+u)*s+d]},with(e,t,r,i){return e.size?R(e,t,r,i):n*4},distance(e,t,n){return this.with(this.at(e,t,n),e,t,n)}}}var B=4;function ve(e,t,n,r=ge(e)){let{min:i,max:a}=r.bounds,o=t*2,s=i[0]-o,c=-2.5*t,l=i[2]-o,u=Math.ceil((a[0]-i[0]+2*o)/t),d=Math.ceil((a[1]+o)/t)+3,f=Math.ceil((a[2]-i[2]+2*o)/t),p=u+1,m=d+1,h=f+1,g=new Float32Array(p*m*h).fill(1),_=z(r,Math.max(.08,B*t),t*2+B*t*.9),v=Math.ceil(u/B),y=Math.ceil(d/B),b=Math.ceil(f/B),x=new Float32Array((v+1)*(y+1)*(b+1));for(let e=0;e<=v;e++)for(let n=0;n<=y;n++)for(let r=0;r<=b;r++)x[(e*(y+1)+n)*(b+1)+r]=_.distance(s+e*B*t,c+n*B*t,l+r*B*t);let S=B*t*Math.sqrt(3)/2*1.35+t;for(let e=0;e<v;e++)for(let n=0;n<y;n++)for(let r=0;r<b;r++){let i=!1,a=0;for(let t=0;t<8;t++){let o=x[((e+(t&1))*(y+1)+n+(t>>1&1))*(b+1)+r+(t>>2&1)];Math.abs(o)<S&&(i=!0),o<0&&a++}let o=e*B,p=n*B,v=r*B,C=Math.min(o+B,u),w=Math.min(p+B,d),T=Math.min(v+B,f);if(!i){if(a>=4)for(let e=o;e<=C;e++)for(let t=p;t<=w;t++)for(let n=v;n<=T;n++)g[(e*m+t)*h+n]=-1;continue}let E=_.at(s+(o+B/2)*t,c+(p+B/2)*t,l+(v+B/2)*t);for(let e=o;e<=C;e++)for(let n=p;n<=w;n++)for(let r=v;r<=T;r++)g[(e*m+n)*h+r]=_.with(E,s+e*t,c+n*t,l+r*t)}for(let e=0;e<p;e++)for(let n=0;n<m;n++){let r=c+n*t;if(!(r>=0))for(let t=0;t<h;t++){let i=(e*m+n)*h+t;g[i]=Math.max(g[i],-r)}}let C=new Int32Array(u*d*f).fill(-1),w=[],T=new Float32Array(8),E=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];for(let e=0;e<u;e++)for(let n=0;n<d;n++)for(let r=0;r<f;r++){let i=0;for(let t=0;t<8;t++){let a=g[((e+(t&1))*m+(n+(t>>1&1)))*h+(r+(t>>2&1))];T[t]=a,a<0&&i++}if(i===0||i===8)continue;let a=0,o=0,u=0,p=0;for(let[e,t]of E){let n=T[e],r=T[t];if(n<0==r<0)continue;let i=n/(n-r);a+=(e&1)+((t&1)-(e&1))*i,o+=(e>>1&1)+((t>>1&1)-(e>>1&1))*i,u+=(e>>2&1)+((t>>2&1)-(e>>2&1))*i,p++}C[(e*d+n)*f+r]=w.length/3,w.push(s+(e+a/p)*t,c+(n+o/p)*t,l+(r+u/p)*t)}let D=[],O=(e,t,n)=>e<0||t<0||n<0||e>=u||t>=d||n>=f?-1:C[(e*d+t)*f+n],k=(e,t,n,r,i)=>{e<0||t<0||n<0||r<0||(i?D.push(e,n,t,e,r,n):D.push(e,t,n,e,n,r))};for(let e=0;e<p;e++)for(let t=0;t<m;t++)for(let n=0;n<h;n++){let r=g[(e*m+t)*h+n]<0;e+1<p&&r!==g[((e+1)*m+t)*h+n]<0&&k(O(e,t-1,n-1),O(e,t,n-1),O(e,t,n),O(e,t-1,n),!r),t+1<m&&r!==g[(e*m+t+1)*h+n]<0&&k(O(e-1,t,n-1),O(e-1,t,n),O(e,t,n),O(e,t,n-1),!r),n+1<h&&r!==g[(e*m+t)*h+n+1]<0&&k(O(e-1,t-1,n),O(e,t-1,n),O(e,t,n),O(e-1,t,n),!r)}let A=w.length/3,j=new Float32Array(w),M=new Float32Array(A*3),N=new Float32Array(A).fill(1),ee=z(r,.08,n?.08:t*2),P=t*.35;for(let e=0;e<A;e++){let r=j[e*3],i=j[e*3+1],a=j[e*3+2],o=ee.at(r,i,a),s=(e,t,n)=>Math.max(ee.with(o,e,t,n),-t),c=s(r,i,a),l=s(r+P,i,a)-c,u=s(r,i+P,a)-c,d=s(r,i,a+P)-c,f=Math.hypot(l,u,d)||1,p=Math.max(-t*.5,Math.min(t*.5,c));r-=l/f*p,i-=u/f*p,a-=d/f*p,j[e*3]=r,j[e*3+1]=i,j[e*3+2]=a;let m=l/f,h=u/f,g=d/f;if(M[e*3]=m,M[e*3+1]=h,M[e*3+2]=g,n){let t=0,n=1;for(let e=1;e<=4;e++){let o=.02*e;t+=(o-s(r+m*o,i+h*o,a+g*o))*n,n*=.6}N[e]=Math.max(0,Math.min(1,1-t*12))}}let te=new Uint32Array(D);for(let e=0;e<te.length;e+=3){let t=te[e]*3,n=te[e+1]*3,r=te[e+2]*3,i=j[n]-j[t],a=j[n+1]-j[t+1],o=j[n+2]-j[t+2],s=j[r]-j[t],c=j[r+1]-j[t+1],l=j[r+2]-j[t+2],u=a*l-o*c,d=o*s-i*l,f=i*c-a*s,p=M[t]+M[n]+M[r],m=M[t+1]+M[n+1]+M[r+1],h=M[t+2]+M[n+2]+M[r+2];if(u*p+d*m+f*h<0){let t=te[e+1];te[e+1]=te[e+2],te[e+2]=t}}return{positions:j,normals:M,ao:N,indices:te}}var ye=(e,t,n,r=`body`)=>({t:0,part:r,c:e,r:t,k:n,phase:0,bc:e,br:t});function V(e,t,n=0){let r=Math.cos(e),i=Math.sin(e),a=Math.cos(t),o=Math.sin(t),s=Math.cos(n),c=Math.sin(n),l=[a,-o,0,o,a,0,0,0,1],u=[1,0,0,0,s,-c,0,c,s],d=[r,0,i,0,1,0,-i,0,r],f=(e,t)=>{let n=Array(9).fill(0);for(let r=0;r<3;r++)for(let i=0;i<3;i++)for(let a=0;a<3;a++)n[r*3+i]+=e[r*3+a]*t[a*3+i];return n},p=f(f(d,l),u);return[p[0],p[3],p[6],p[1],p[4],p[7],p[2],p[5],p[8]]}var H=(e,t,n,r=null,i=`body`)=>({t:1,part:i,c:e,r:t,inv:r?V(r[0],r[1],r[2]??0):null,k:n,phase:0,bc:e,br:Math.max(...t)}),U=(e,t,n,r,i,a=`limb`)=>({t:2,part:a,a:e,b:n,ra:t,rb:r,k:i,phase:0,bc:[(e[0]+n[0])/2,(e[1]+n[1])/2,(e[2]+n[2])/2],br:Math.hypot(n[0]-e[0],n[1]-e[1],n[2]-e[2])/2+Math.max(t,r)});function W(e,t){let n=[1/0,1/0,1/0],r=[-1/0,-1/0,-1/0];for(let t of e)for(let e=0;e<3;e++)n[e]=Math.min(n[e],t.bc[e]-t.br-t.k),r[e]=Math.max(r[e],t.bc[e]+t.br+t.k);return t&&(n[1]=Math.max(n[1],-.02)),{prims:e,bones:[],bounds:{min:n,max:r}}}function be(e,t,n,r,i,a,o=.06){let s=[];for(let[c,l]of[[e,1],[t,-1]])for(let e of[r,-r]){let t=n*.48,r=c+(l>0?.02:-o);s.push(U([c,n+i*.6,e],i*1.55,[r,t,e],i*.75,i*.9)),s.push(U([r,t,e],i*.72,[c+.01,a*.8,e],i*.5,i*.5)),s.push(H([c+.03,a*.7,e],[a*1.1,a*.8,a*.9],a*.5))}return s}function xe(e){switch(e){case`grazer`:{let e=.78;return{model:W([H([0,1.12,0],[.82,.4,.36],0),ye([.5,1.08,0],.43,.25),ye([-.52,1.12,0],.4,.25),H([.05,.86,0],[.55,.18,.27],.22),H([.62,.86,0],[.16,.22,.14],.15),U([.75,1.22,0],.27,[1.08,1.05,0],.16,.18,`head`),H([1.27,.92,0],[.26,.15,.14],.12,[0,-.9],`head`),H([1.42,.74,0],[.12,.1,.12],.07,null,`head`),H([1.12,1.07,.15],[.09,.035,.05],.03,[.6,.2],`head`),H([1.12,1.07,-.15],[.09,.035,.05],.03,[-.6,.2],`head`),U([-.92,1.3,0],.05,[-1,.72,0],.025,.06,`tail`),H([-1,.66,0],[.04,.09,.04],.03,null,`tail`),...be(.56,-.56,e,.2,.085,.07)],!0),lift:0,cell:.022,hip:e,legX:[.56,-.56]}}case`strider`:return{model:W([H([0,1.3,0],[.6,.27,.23],0),ye([.38,1.3,0],.27,.2),ye([-.38,1.32,0],.26,.2),U([.45,1.42,0],.17,[.78,1.92,0],.08,.14,`head`),H([.9,1.97,0],[.19,.08,.075],.07,[0,-.35],`head`),H([1.05,1.92,0],[.07,.05,.05],.04,null,`head`),H([.8,2.07,.07],[.03,.09,.02],.02,[.3,.3,.4],`head`),H([.8,2.07,-.07],[.03,.09,.02],.02,[-.3,.3,-.4],`head`),U([-.58,1.42,0],.035,[-.68,1.3,0],.02,.05,`tail`),...be(.4,-.42,1,.12,.05,.04,.09)],!0),lift:0,cell:.016,hip:1,legX:[.4,-.42]};case`crawler`:{let e=[H([0,.2,0],[.62,.13,.22],0),H([.42,.2,0],[.24,.11,.17],.12),U([.6,.21,0],.11,[.82,.2,0],.09,.08,`head`),H([.96,.18,0],[.2,.065,.11],.06,null,`head`),U([-.5,.2,0],.15,[-1.15,.12,.08],.07,.12,`tail`),U([-1.15,.12,.08],.07,[-1.75,.06,-.06],.015,.06,`tail`)];for(let[t,n]of[[.4,1],[.4,-1],[-.38,1],[-.38,-1]])e.push(U([t,.18,n*.16],.055,[t+.04,.12,n*.36],.04,.04)),e.push(U([t+.04,.12,n*.36],.04,[t+.08,.025,n*.42],.03,.03)),e.push(H([t+.12,.018,n*.43],[.06,.018,.045],.02));return{model:W(e,!0),lift:0,cell:.012,hip:.2,legX:[.42,-.36]}}case`small`:{let e=.16;return{model:W([H([0,.26,0],[.22,.14,.13],0),ye([-.1,.25,0],.14,.1),H([.22,.36,0],[.1,.08,.075],.06,null,`head`),H([.31,.34,0],[.04,.035,.035],.03,null,`head`),H([.18,.5,.04],[.025,.11,.016],.02,[.1,.25,.15],`head`),H([.18,.5,-.04],[.025,.11,.016],.02,[-.1,.25,-.15],`head`),ye([-.25,.3,0],.045,.03,`tail`),...be(.13,-.12,e,.07,.03,.025,.02)],!0),lift:0,cell:.008,hip:e,legX:[.13,-.12]}}case`fish`:{let e=.3;return{model:W([H([0,e,0],[.4,.13,.07],0),H([.18,.31,0],[.18,.11,.075],.08),U([-.3,e,0],.06,[-.42,e,0],.025,.05),H([-.5,.36,0],[.09,.07,.018],.04,[0,-.6]),H([-.5,.24,0],[.09,.07,.018],.04,[0,.6]),H([0,.44,0],[.13,.05,.018],.04,[0,-.25]),H([.12,.22999999999999998,.06],[.07,.025,.04],.03,[.5,.3]),H([.12,.22999999999999998,-.06],[.07,.025,.04],.03,[-.5,.3])],!1),lift:e,cell:.012,hip:0,legX:[0,0]}}case`bird`:{let e=.3;return{model:W([H([0,e,0],[.16,.06,.06],0),ye([.15,.33999999999999997,0],.045,.04),U([.19,.33999999999999997,0],.016,[.25,.32999999999999996,0],.003,.01),H([-.2,.305,0],[.09,.012,.06],.04),H([0,.32,.2],[.075,.012,.18],.05,[.12,0,0]),H([-.03,.32,.42],[.05,.009,.12],.04,[.3,0,0]),H([0,.32,-.2],[.075,.012,.18],.05,[-.12,0,0]),H([-.03,.32,-.42],[.05,.009,.12],.04,[-.3,0,0])],!1),lift:e,cell:.007,hip:0,legX:[0,0]}}case`great`:{let e=.5;return{model:W([H([0,e,0],[.95,.24,.24],0),H([.55,.52,0],[.42,.22,.22],.2),H([.92,.46,0],[.18,.13,.15],.15),U([-.7,e,0],.17,[-1.35,.52,0],.05,.18),H([-1.45,.52,.18],[.12,.018,.2],.06,[.5,0,0]),H([-1.45,.52,-.18],[.12,.018,.2],.06,[-.5,0,0]),H([.4,.35,.27],[.14,.022,.2],.07,[.7,.2,.4]),H([.4,.35,-.27],[.14,.022,.2],.07,[-.7,.2,-.4]),H([-.55,.7,0],[.12,.05,.02],.06,[0,.4])],!1),lift:e,cell:.014,hip:0,legX:[0,0]}}case`human0`:case`human1`:return Se(e===`human0`?{height:1.8,shoulders:1,hips:.92}:{height:1.68,shoulders:.88,hips:1.02})}}function Se(e){let t=e.height,n=.112*e.shoulders,r=.085*e.hips,i=(e,n,r)=>[e*t,n*t,r*t],a=[H(i(0,.925,.004),[.052*t,.066*t,.06*t],0,null,`head`),H(i(0,.885,.03),[.035*t,.03*t,.03*t],.02*t,null,`head`),U(i(0,.84,-.004),.029*t,i(0,.885,0),.026*t,.02*t,`body`),H(i(0,.79,-.004),[n*.78*t,.034*t,.05*t],.035*t),H(i(0,.715,.008),[n*.88*t,.085*t,.068*t],.04*t),H(i(0,.615,.004),[.085*t*(.92+e.hips*.08),.07*t,.06*t],.05*t),H(i(0,.525,-.004),[r*1.12*t,.06*t,.072*t],.05*t)];for(let e of[1,-1]){let o=e*n;a.push(ye(i(o*.96,.772,0),.031*t,.03*t)),a.push(U(i(o,.78,0),.031*t,i(o+e*.022,.625,-.006),.024*t,.025*t)),a.push(U(i(o+e*.022,.625,-.006),.023*t,i(o+e*.03,.475,.012),.017*t,.012*t)),a.push(H(i(o+e*.032,.43,.014),[.014*t,.04*t,.024*t],.012*t));let s=e*r*.56;a.push(U(i(s,.5,0),.052*t,i(s*.92,.275,.006),.034*t,.03*t)),a.push(U(i(s*.92,.275,.006),.033*t,i(s*.9,.05,-.004),.021*t,.015*t)),a.push(H(i(s*.9,.018,.028),[.024*t,.018*t,.06*t],.015*t))}return{model:W(a,!0),lift:0,cell:.011,hip:0,legX:[0,0]}}function Ce(e,t=1){let n=xe(e),r=ve(`final`,n.cell/t,!0,n.model);if(n.lift)for(let e=1;e<r.positions.length;e+=3)r.positions[e]-=n.lift;return{id:e,...r}}function G(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function K(e){let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=Math.imul(t,16777619);return t>>>0}var q={x:26,z:-6},we=4.5,Te=(()=>{let e=G(2654435769),t=Array.from({length:256},(e,t)=>t);for(let n=255;n>0;n--){let r=Math.floor(e()*(n+1));[t[n],t[r]]=[t[r],t[n]]}return[...t,...t]})(),Ee=(()=>{let e=G(2246822507);return Array.from({length:256},()=>e()*2-1)})();function De(e,t){return Ee[Te[Te[e&255]+t&255]]}function Oe(e,t){let n=Math.floor(e),r=Math.floor(t),i=e-n,a=t-r,o=i*i*(3-2*i),s=a*a*(3-2*a),c=De(n,r),l=De(n+1,r),u=De(n,r+1),d=De(n+1,r+1);return c+(l-c)*o+(u-c)*s+(c-l-u+d)*o*s}function J(e,t,n=4){let r=0,i=.5,a=1;for(let o=0;o<n;o++)r+=i*Oe(e*a,t*a),a*=2.03,i*=.5;return r}function Y(e,t){let n=e-q.x,r=(t-q.z)*1.15,i=Math.sqrt(n*n+r*r),a=(34+J(e*.045,t*.045,3)*14-i)/9;return Math.min(1,Math.max(0,a))}function ke(e,t){let n=Y(e,t),r=1.4+J(e*.06+3.1,t*.06-1.7,5)*3.2+Math.max(0,J(e*.025,t*.025,3))*5,i=-5.7+J(e*.03,t*.03,2)*1.2,a=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},o=.22+J(e*.2,t*.2,2)*.12;return i+(o+Math.max(0,Math.max(.15,r)-o)*a(.18,1,n)**1.4-i)*a(0,.3,n)}function Ae(e,t,n){let r=ke(e,t);return r-(1-n)*(r>0?r+we:we*.4)}function je(e,t,n={}){let r=G(t),i=[],a=n.minInland??.25,o=e*60;for(;i.length<e&&o-->0;){let e,t;if(n.region){let i=r()*Math.PI*2,a=Math.sqrt(r())*n.region.r;e=n.region.x+Math.cos(i)*a,t=n.region.z+Math.sin(i)*a}else e=q.x+(r()*2-1)*48,t=q.z+(r()*2-1)*48;let o=Y(e,t);if(o<a)continue;let s=ke(e,t);s<.2||n.maxHeight!==void 0&&s>n.maxHeight||i.push({x:e,y:s,z:t,inland:o})}return i}function Me(e,t){let n=G(t),r=[],i=e*60;for(;r.length<e&&i-->0;){let e=-70+n()*90,t=-60+n()*80;Y(e,t)>.02||r.push({x:e,z:t})}return r}var X={meadow:{x:18,z:4},grove:{x:32,z:-12},plains:{x:36,z:8},garden:{x:22,z:10},shore:{x:-4,z:3},sea:{x:-24,z:-10}};function Ne(e){return{x:e.x,y:Math.max(.2,ke(e.x,e.z)),z:e.z}}var Pe=Ne(X.garden),Fe=[{x:Pe.x-.55,y:Pe.y,z:Pe.z,yaw:-.25,height:1.8,shoulders:1,hips:.92},{x:Pe.x+.55,y:Pe.y,z:Pe.z+.15,yaw:-.25,height:1.68,shoulders:.88,hips:1.02}];function Ie(e){let t=e.shoulders*.115,n=e.hips*.085;return[[0,.905,0,.905,.062],[0,.82,0,.84,.03],[0,.56,0,.78,t*.85],[0,.5,0,.56,n*1.05],[-t,.78,-t-.02,.49,.026],[t,.78,t+.02,.49,.026],[-n*.55,.5,-n*.6,.03,.036],[n*.55,.5,n*.6,.03,.036]]}function Le(e,t){let n=Ie(e),r=n.map(([e,t,n,r,i])=>i*i*(Math.hypot(n-e,r-t)+i*1.3)),i=r.reduce((e,t)=>e+t,0),a=t()*i,o=0;for(;a>r[o]&&o<n.length-1;)a-=r[o++];let[s,c,l,u,d]=n[o],f=t(),p=t()*Math.PI*2,m=Math.sqrt(t())*d,h=s+(l-s)*f+Math.cos(p)*m,g=c+(u-c)*f+Math.sin(p)*m*.6,_=Math.sin(p)*m,v=Math.cos(e.yaw),y=Math.sin(e.yaw),b=h*e.height,x=_*e.height;return[e.x+b*v-x*y,e.y+g*e.height,e.z+b*y+x*v]}var Re=[`broadleaf`,`conifer`,`slender`,`umbrella`,`fruit`,`palm`],Z=(e,t)=>[e[0]+t[0],e[1]+t[1],e[2]+t[2]],Q=(e,t)=>[e[0]*t,e[1]*t,e[2]*t],ze=e=>{let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]};function Be(e,t,n){let r=ze(e),i=Math.abs(r[1])<.95?[0,1,0]:[1,0,0],a=ze([r[1]*i[2]-r[2]*i[1],r[2]*i[0]-r[0]*i[2],r[0]*i[1]-r[1]*i[0]]),o=ze([r[1]*a[2]-r[2]*a[1],r[2]*a[0]-r[0]*a[2],r[0]*a[1]-r[1]*a[0]]);return a=Z(Q(a,Math.cos(n)),Q(o,Math.sin(n))),ze(Z(Q(r,Math.cos(t)),Q(a,Math.sin(t))))}var Ve={broadleaf:{trunk:2.6,trunkRadius:.17,depth:4,children:[3,4],tilt:[.45,.9],shrink:.74,gravity:.08,leafSize:.7,leafFrame:0,leavesPerTip:12},slender:{trunk:3.8,trunkRadius:.09,depth:4,children:[2,3],tilt:[.3,.6],shrink:.7,gravity:.18,leafSize:.42,leafFrame:2,leavesPerTip:8},umbrella:{trunk:2.8,trunkRadius:.14,depth:4,children:[3,3],tilt:[.85,1.25],shrink:.76,gravity:-.05,leafSize:.5,leafFrame:2,leavesPerTip:11},fruit:{trunk:1.6,trunkRadius:.12,depth:4,children:[3,4],tilt:[.6,1],shrink:.7,gravity:.12,leafSize:.6,leafFrame:0,leavesPerTip:12}};function He(e,t){let n=G(K(`tree.${e}.${t}`)),r=[],i=[],a=[];if(e===`conifer`)return Ue(n);if(e===`palm`)return We(n);let o=Ve[e],s=(t,c,l,u,d)=>{let f=t,p=c;for(let e=0;e<2;e++){p=ze(Z(p,[(n()-.5)*.25,-o.gravity*(d/o.depth),(n()-.5)*.25]));let t=Z(f,Q(p,l/2)),i=u*(1-e/2*.35),a=u*(1-(e+1)/2*.35);r.push({a:f,b:t,ra:i,rb:a,level:(o.depth-d+e/2)/o.depth}),f=t}if(d<=1){for(let e=0;e<o.leavesPerTip;e++){let e=Be(p,.4+n()*1.2,n()*Math.PI*2);i.push({p:Z(f,Q(e,n()*l*.6)),dir:e,size:o.leafSize*(.7+n()*.6),frame:o.leafFrame})}e===`fruit`&&n()<.55&&a.push(Z(f,[(n()-.5)*.3,-.15,(n()-.5)*.3]));return}let m=o.children[0]+Math.floor(n()*(o.children[1]-o.children[0]+1)),h=n()*Math.PI*2;for(let e=0;e<m;e++){let t=h+e/m*Math.PI*2+(n()-.5)*.6,r=Be(p,o.tilt[0]+n()*(o.tilt[1]-o.tilt[0]),t);s(f,r,l*o.shrink*(.85+n()*.3),u*.56,d-1)}},c=ze([(n()-.5)*.15,1,(n()-.5)*.15]);return r.push({a:[0,-.2,0],b:Q(c,o.trunk*.5),ra:o.trunkRadius*1.45,rb:o.trunkRadius*1.05,level:0}),s(Q(c,o.trunk*.5),c,o.trunk*.62,o.trunkRadius,o.depth),{tubes:r,leaves:i,fruits:a,height:Math.max(...r.map(e=>e.b[1]),...i.map(e=>e.p[1])),crown:Math.max(...i.map(e=>Math.hypot(e.p[0],e.p[2])),1)}}function Ue(e){let t=[],n=[],r=5.5+e()*2;t.push({a:[0,-.2,0],b:[0,r,0],ra:.2,rb:.03,level:0});for(let i=0;i<9;i++){let a=i/9,o=r*(.18+a*.78),s=(1-a)*2.2+.35,c=6+Math.floor(e()*3);for(let r=0;r<c;r++){let l=r/c*Math.PI*2+i*.7+e()*.3,u=ze([Math.cos(l),-.28-e()*.12,Math.sin(l)]),d=Z([0,o,0],Q(u,s));t.push({a:[0,o,0],b:d,ra:.045*(1-a*.6),rb:.012,level:.4+a*.6});for(let e=1;e<=3;e++){let t=Z([0,o,0],Q(u,s*e/3.2));n.push({p:t,dir:ze(Z(u,[0,.35,0])),size:.65*(1-a*.5),frame:1})}}}return n.push({p:[0,r,0],dir:[0,1,0],size:.5,frame:1}),{tubes:t,leaves:n,fruits:[],height:r,crown:2.4}}function We(e){let t=[],n=[],r=5+e()*2.5,i=.8+e()*.8,a=e()*Math.PI*2,o=[0,-.2,0];for(let e=1;e<=7;e++){let n=e/7,s=[Math.cos(a)*i*n*n,r*n,Math.sin(a)*i*n*n];t.push({a:o,b:s,ra:.2-n*.06,rb:.2-(n+1/7)*.06,level:n*.6}),o=s}for(let t=0;t<10;t++){let r=t/10*Math.PI*2+e()*.2,i=ze([Math.cos(r),.25-e()*.6,Math.sin(r)]);n.push({p:Z(o,Q(i,1.1)),dir:i,size:2.4+e()*.6,frame:3})}return{tubes:t,leaves:n,fruits:[],height:r,crown:3}}var Ge=`
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm3(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.02 + 17.1; a *= 0.5; }
  return s;
}
float fbm5(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}`,Ke=`
vec4 permute4(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute4(permute4(permute4(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt4(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
vec3 curl(vec3 p) {
  const float e = 0.12;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  float n1 = snoise(p + dy + vec3(31.4, 0.0, 0.0)) - snoise(p - dy + vec3(31.4, 0.0, 0.0));
  float n2 = snoise(p + dz + vec3(0.0, 17.7, 0.0)) - snoise(p - dz + vec3(0.0, 17.7, 0.0));
  float n3 = snoise(p + dz) - snoise(p - dz);
  float n4 = snoise(p + dx + vec3(0.0, 17.7, 0.0)) - snoise(p - dx + vec3(0.0, 17.7, 0.0));
  float n5 = snoise(p + dx + vec3(31.4, 0.0, 0.0)) - snoise(p - dx + vec3(31.4, 0.0, 0.0));
  float n6 = snoise(p + dy) - snoise(p - dy);
  return vec3(n1 - n2, n3 - n4, n5 - n6) / (2.0 * e);
}`,qe=`
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform float uDark;
uniform float uLightAmt;
uniform float uSunAmt;
uniform float uNight;
uniform float uEvening;
uniform float uWarm;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uExposure;`,Je=`
vec3 skyColor(vec3 dir) {
  vec3 d = normalize(dir);
  vec3 s = normalize(uLightDir);
  float mu = dot(d, s);
  float y = d.y;
  float hz = pow(1.0 - clamp(y, 0.0, 1.0), 4.5);
  vec3 col = mix(uSkyZenith, uSkyHorizon, hz);
  float low = 1.0 - smoothstep(-0.05, 0.4, s.y);
  vec3 sunset = vec3(1.0, 0.46, 0.22);
  float dusk = clamp(low * uSunAmt + uEvening, 0.0, 1.0);
  col = mix(col, col * 0.5 + sunset * (0.35 + 0.65 * hz) * (0.35 + 0.65 * max(mu * 0.5 + 0.5, 0.0)), dusk * hz);
  float m = max(mu, 0.0);
  float mie = pow(m, 5.0) * 0.28 + pow(m, 40.0) * 0.55 + pow(m, 600.0) * 3.0 * uSunAmt;
  vec3 tint = mix(vec3(1.0, 0.94, 0.84), sunset, dusk * 0.75);
  col = col * (0.18 + 0.82 * uLightAmt) + tint * mie * uLightAmt;
  col = mix(col, uSkyHorizon * 0.3, smoothstep(0.0, -0.3, y));
  col *= 1.0 - uNight * 0.9;
  col = mix(col, vec3(0.0015, 0.002, 0.004), uDark * (1.0 - pow(m, 3.0) * uLightAmt * 0.75));
  return col;
}`,Ye=`
vec3 applyFog(vec3 col, vec3 worldPos) {
  vec3 v = worldPos - cameraPosition;
  float dist = length(v);
  vec3 dir = v / max(dist, 1e-4);
  float hAvg = max(0.0, (cameraPosition.y + worldPos.y) * 0.5);
  float amt = 1.0 - exp(-uFogDensity * dist * exp(-uFogFalloff * hAvg));
  vec3 fc = skyColor(vec3(dir.x, max(dir.y, 0.02), dir.z));
  fc += uLightColor * pow(max(dot(dir, normalize(uLightDir)), 0.0), 10.0) * 0.18;
  return mix(col, fc, clamp(amt, 0.0, 1.0));
}`,Xe=`
vec3 shadeLit(vec3 albedo, vec3 n, vec3 worldPos, float ao, float translucency) {
  vec3 N = normalize(n);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(cameraPosition - worldPos);
  float ndl = max(dot(N, L), 0.0);
  float up = N.y * 0.5 + 0.5;
  // O céu ilumina muito mais do que a cor do zênite sugere: o fator leva o ambiente a ~1/4 da luz direta.
  vec3 skyAmb = (mix(uSkyHorizon, uSkyZenith, up) * 2.4 + vec3(0.02, 0.025, 0.035)) * (0.25 + 0.75 * uLightAmt);
  vec3 groundAmb = vec3(0.12, 0.1, 0.07) * uLightAmt;
  vec3 amb = mix(groundAmb, skyAmb, up) * (1.0 - uNight * 0.75) + vec3(0.012, 0.016, 0.03) * uNight;
  float back = pow(max(dot(-V, L), 0.0), 3.0) * translucency;
  vec3 c = albedo * (amb * ao * 0.9 + uLightColor * (ndl + back * 0.8));
  return c * uExposure;
}`,Ze=`
${Xe}
vec3 shadeSurface(vec3 albedo, vec3 n, vec3 worldPos, float ao, float translucency) {
  return applyFog(shadeLit(albedo, n, worldPos, ao, translucency), worldPos);
}`,Qe=`
float growth(float level, float delay) {
  return smoothstep(delay, delay + 0.3, level * 1.3);
}`,$e=`${qe}\n${Je}\n${Ye}\n${Ze}`,et=`
${qe}
${Je}
varying vec4 vFog;
void fogVertex(vec3 worldPos) {
  vec3 v = worldPos - cameraPosition;
  float dist = length(v);
  vec3 dir = v / max(dist, 1e-4);
  float hAvg = max(0.0, (cameraPosition.y + worldPos.y) * 0.5);
  float amt = 1.0 - exp(-uFogDensity * dist * exp(-uFogFalloff * hAvg));
  vec3 fc = skyColor(vec3(dir.x, max(dir.y, 0.02), dir.z));
  fc += uLightColor * pow(max(dot(dir, normalize(uLightDir)), 0.0), 10.0) * 0.18;
  vFog = vec4(fc, clamp(amt, 0.0, 1.0));
}`,tt=`${qe}
varying vec4 vFog;
${Xe}
vec3 withFog(vec3 c) { return mix(c, vFog.rgb, vFog.a); }`,nt={x:q.x-75,z:q.z-75},rt=`
uniform sampler2D tHeight;
uniform sampler2D tCanopy;
uniform vec4 uTerrainRect; // x0, z0, 1/largura, 1/profundidade
vec2 terrainUv(vec2 xz) { return (xz - uTerrainRect.xy) * uTerrainRect.zw; }
float fullHeight(vec2 xz) {
  vec2 uv = terrainUv(xz);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -8.0;
  return texture2D(tHeight, uv).r;
}`;function it(e,t){let n=new Uint16Array(e*e);for(let r=0;r<e;r++)for(let i=0;i<e;i++){let a=nt.x+(i+.5)/e*150,o=nt.z+(r+.5)/e*150;n[r*e+i]=p.toHalfFloat(t(a,o))}let r=new te(n,e,e,b,s);return r.magFilter=x,r.minFilter=x,r.wrapS=r.wrapT=S,r.needsUpdate=!0,r}function at(e){return it(e,ke)}function ot(e,t){let n=new Float32Array(e*e),r=150/e;for(let i of t){let t=i.x+.6,a=i.z+.4,o=i.r*1.15,s=Math.max(0,Math.floor((t-o-nt.x)/r)),c=Math.min(e-1,Math.ceil((t+o-nt.x)/r)),l=Math.max(0,Math.floor((a-o-nt.z)/r)),u=Math.min(e-1,Math.ceil((a+o-nt.z)/r));for(let i=l;i<=u;i++)for(let l=s;l<=c;l++){let s=nt.x+(l+.5)*r,c=nt.z+(i+.5)*r,u=Math.hypot(s-t,c-a)/o;u<1&&(n[i*e+l]=Math.min(1,n[i*e+l]+(1-u*u)*.6))}}return it(e,(t,i)=>{let a=Math.min(e-1,Math.max(0,Math.floor((t-nt.x)/r))),o=Math.min(e-1,Math.max(0,Math.floor((i-nt.z)/r)));return n[o*e+a]})}function st(e,t){return{tHeight:{value:e},tCanopy:{value:t},uTerrainRect:{value:new C(nt.x,nt.z,1/150,1/150)}}}var ct=Ne(X.garden),lt=Fe[0],ut={void:{pos:[0,9,70],target:[0,9,0],fov:48},deep:{pos:[-10,3,36],target:[-10,-1,0],fov:46},surface:{pos:[-16,2.4,28],target:[-6,.6,-12],fov:46},lightBirth:{pos:[-8,4,36],target:[0,14,-30],fov:50},lightWide:{pos:[-26,9,52],target:[0,8,-26],fov:56},horizonDawn:{pos:[-30,3,42],target:[10,4,-40],fov:52},firmament:{pos:[-20,4,46],target:[0,18,-30],fov:58},skyHigh:{pos:[-30,12,58],target:[0,22,-40],fov:60},landRise:{pos:[-24,6,40],target:[14,1,-2],fov:50},coast:{pos:[-18,3.4,24],target:[2,1,-2],fov:48},meadow:{pos:[8,4.8,24],target:[18,2.4,4],fov:46,dof:.35},grove:{pos:[18,4.2,6],target:[32,3,-12],fov:52},valley:{pos:[-6,10,42],target:[22,2,0],fov:52},skyward:{pos:[14,3.8,20],target:[20,30,-40],fov:60},luminaries:{pos:[-10,6,54],target:[0,30,-60],fov:62},nightSky:{pos:[10,3.8,26],target:[20,18,-40],fov:64,night:1},celestialWide:{pos:[-40,14,72],target:[10,18,-40],fov:62,night:.35},seaSurface:{pos:[-32,1.8,14],target:[-30,.4,-20],fov:50},underwater:{pos:[-36,-1.9,6],target:[-28,-2.6,-24],fov:56},flight:{pos:[-12,14,38],target:[0,12,-10],fov:56},shore:{pos:[-15,2.1,17],target:[-3,.7,6.5],fov:44,perch:1,dof:.3},plains:{pos:[24,5.4,28],target:[36,2,8],fov:48},herds:{pos:[20,7.5,34],target:[36,2,6],fov:54},humanityWide:{pos:[6,6.5,34],target:[22,2.2,10],fov:52},humanity:{pos:[lt.x+.4,ct.y+1.45,lt.z+6.2],target:[lt.x+.5,ct.y+1.05,lt.z],fov:40,dof:1.1},garden:{pos:[16,ct.y+2.6,19],target:[23,ct.y+.8,9],fov:48,dof:.5},panorama:{pos:[-26,13,46],target:[18,2,-2],fov:54}};function dt(e){let t=new P;for(let[n,r]of Object.entries(e.attributes))t.setAttribute(n,r);return e.index&&t.setIndex(e.index),t}function ft(r,i,a,o,s){let c=new Map;for(let e of o){let t=`${Math.floor(e.x/s.tile)},${Math.floor(e.z/s.tile)}`,n=c.get(t);n?n.push(e):c.set(t,[e])}let l=[],u=new v,d=new t,f=new e(0,1,0),p=new e,h=new e,g=(e,t,r)=>{let i=dt(e),o=new Float32Array(t.length),s=new Float32Array(t.length*3),c=new m(i,a,t.length);return t.forEach((e,t)=>{d.setFromAxisAngle(f,e.rot),u.compose(p.set(e.x,e.y,e.z),d,h.set(e.s,e.s,e.s)),c.setMatrixAt(t,u),o[t]=e.delay,s.set(e.tint,t*3)}),i.setAttribute(`aDelay`,new n(o,1)),i.setAttribute(`aTint`,new n(s,3)),c.boundingSphere=r.clone(),c.frustumCulled=!0,c};for(let e of c.values()){let t=new N;for(let n of e)t.expandByPoint(p.set(n.x,n.y,n.z));t.max.y+=s.height,t.expandByScalar(s.height*.4);let n=t.getBoundingSphere(new j);l.push({center:n.center.clone(),near:g(r,e,n),far:i?g(i,e,n):null,n:e.length})}let _=1;return{meshes:l.flatMap(e=>e.far?[e.near,e.far]:[e.near]),update(e){for(let t of l){let n=t.center.distanceTo(e)-(t.near.boundingSphere?.radius??0)*.5,r=n<s.lodDistance||!t.far;t.near.visible=r&&n<s.maxDistance,t.far&&(t.far.visible=!r&&n<s.maxDistance)}},setDensity(e){_=Math.min(1,e);for(let e of l){let t=Math.floor(e.n*_);e.near.count=t,e.far&&(e.far.count=t)}}}}var pt=Object.values(ut).map(e=>({x:e.pos[0],z:e.pos[2],tx:e.target[0],tz:e.target[2]}));function mt(e,t,n){return pt.every(r=>{if(Math.hypot(e-r.x,t-r.z)<n)return!1;let i=r.tx-r.x,a=r.tz-r.z,o=Math.hypot(i,a)||1,s=((e-r.x)*i+(t-r.z)*a)/o;return s<0||s>22||Math.hypot(e-(r.x+i/o*s),t-(r.z+a/o*s))>n*.8})}function ht(){let e=document.createElement(`canvas`);e.width=e.height=512;let t=e.getContext(`2d`),n=G(K(`leaf.atlas`)),r=(e,n,r,i,a,o)=>{t.save(),t.translate(e,n),t.rotate(a);let s=t.createLinearGradient(0,0,r,0);s.addColorStop(0,`rgb(${34+o*26}, ${58+o*34}, ${24+o*12})`),s.addColorStop(1,`rgb(${66+o*34}, ${92+o*40}, ${38+o*16})`),t.fillStyle=s,t.beginPath(),t.moveTo(0,0),t.quadraticCurveTo(r*.45,-i,r,0),t.quadraticCurveTo(r*.45,i,0,0),t.fill(),t.strokeStyle=`rgba(200,230,160,0.35)`,t.lineWidth=1.2,t.beginPath(),t.moveTo(0,0),t.lineTo(r*.95,0),t.stroke(),t.restore()},i=(e,t,n)=>n(e*256,t*256);i(0,0,(e,t)=>{for(let i=0;i<26;i++)r(e+128+(n()-.5)*70,t+128+(n()-.5)*70,50+n()*40,16+n()*10,n()*Math.PI*2,n())}),i(1,0,(e,r)=>{t.strokeStyle=`#2d4a2a`;for(let i=0;i<140;i++){let i=n()*Math.PI*2,a=30+n()*80;t.strokeStyle=`rgb(${30+n()*20}, ${60+n()*30}, ${35+n()*15})`,t.lineWidth=2,t.beginPath(),t.moveTo(e+128,r+128),t.lineTo(e+128+Math.cos(i)*a,r+128+Math.sin(i)*a),t.stroke()}}),i(0,1,(e,t)=>{for(let i=0;i<40;i++)r(e+128+(n()-.5)*120,t+128+(n()-.5)*120,22+n()*18,8+n()*5,n()*Math.PI*2,n()*1.2)}),i(1,1,(e,n)=>{t.strokeStyle=`#4a6a2a`,t.lineWidth=3,t.beginPath(),t.moveTo(e+12,n+128),t.quadraticCurveTo(e+128,n+100,e+244,n+150),t.stroke();for(let t=0;t<30;t++){let i=t/30,a=e+12+i*232,o=n+128-Math.sin(i*Math.PI)*26+i*20;r(a,o,48*(1-i*.6),6,-1.1-i*.3,.6),r(a,o,48*(1-i*.6),6,1.1+i*.3,.5)}});let a=new y(e);return a.colorSpace=A,a.generateMipmaps=!0,a.minFilter=ee,a.anisotropy=4,a}function gt(e){return{...e,tubes:e.tubes.filter(e=>e.level<.55),leaves:e.leaves.filter((e,t)=>t%3==0).map(e=>({...e,size:e.size*1.6}))}}function _t(n,r,i){let a=[],o=new e(0,1,0);for(let s of n.tubes){let n=new e(...s.a),c=new e(...s.b),l=n.distanceTo(c);if(l<.001)continue;let u=new d(s.rb,s.ra,l,s.level<.2?7:s.level<.6?5:3,1,!0);u.translate(0,l/2,0),u.applyQuaternion(new t().setFromUnitVectors(o,c.clone().sub(n).normalize())),u.translate(n.x,n.y,n.z);let f=u.attributes.position.count,p=new Float32Array(f*3),m=new Float32Array(f).fill(s.level),h=i?1.15:1;for(let e=0;e<f;e++)p.set([r.r*h*(.85+s.level*.3),r.g*h*(.85+s.level*.3),r.b*h],e*3);u.setAttribute(`aColor`,new T(p,3)),u.setAttribute(`aLevel`,new T(m,1)),u.deleteAttribute(`uv`),a.push(u.index?u.toNonIndexed():u)}return re(a)}function vt(t){let n=t.leaves.length,r=new Float32Array(n*6*3),i=new Float32Array(n*6*3),a=new Float32Array(n*6*2),o=new Float32Array(n*6*3),s=new Float32Array(n*6),c=new Float32Array(n*6),l=t.leaves.reduce((e,t)=>e+t.p[0],0)/Math.max(1,n),u=t.leaves.reduce((e,t)=>e+t.p[1],0)/Math.max(1,n),d=t.leaves.reduce((e,t)=>e+t.p[2],0)/Math.max(1,n),f=Math.max(.5,...t.leaves.map(e=>Math.hypot(e.p[0]-l,(e.p[1]-u)*.8,e.p[2]-d))),p=new e,m=new e,h=new e;t.leaves.forEach((t,n)=>{h.set(...t.dir).normalize(),m.set(-h.z,0,h.x),m.lengthSq()<1e-4&&m.set(1,0,0),m.normalize();let g=new e().crossVectors(h,m).normalize();g.y<0&&g.negate();let _=t.frame%2*.5,v=Math.floor(t.frame/2)*.5,y=t.size,b=t.frame===3,x=b?[[0,-.3,0,0],[1,-.3,1,0],[1,.3,1,1],[0,.3,0,1]]:[[-.5,-.5,0,0],[.5,-.5,1,0],[.5,.5,1,1],[-.5,.5,0,1]];[0,1,2,0,2,3].forEach((e,S)=>{let[C,w,T,E]=x[e];p.set(...t.p).addScaledVector(h,C*y*1).addScaledVector(m,w*y),b||p.addScaledVector(h,0),b&&(p.y-=C*C*y*.35);let D=n*6+S;r.set([p.x,p.y,p.z],D*3),i.set([g.x,g.y,g.z],D*3),a.set([_+T*.5,v+(1-E)*.5],D*2),o.set(t.p,D*3),s[D]=b?C:.5+Math.abs(w);let O=Math.hypot(t.p[0]-l,(t.p[1]-u)*.8,t.p[2]-d)/f;c[D]=.28+.72*Math.min(1,O*O*1.2+(t.p[1]>u?.15:0))})});let g=new P;return g.setAttribute(`position`,new T(r,3)),g.setAttribute(`normal`,new T(i,3)),g.setAttribute(`uv`,new T(a,2)),g.setAttribute(`aCenter`,new T(o,3)),g.setAttribute(`aSway`,new T(s,1)),g.setAttribute(`aAo`,new T(c,1)),g}function yt(){let e=G(K(`grass.tuft`)),t=[],n=[],r=[];for(let i=0;i<3;i++){let a=i/3*Math.PI*2+e()*1.2,o=Math.cos(a)*.06*e(),s=Math.sin(a)*.06*e(),c=.75+e()*.45,l=.12+e()*.2,u=Math.cos(a+1.3),d=Math.sin(a+1.3),f=(e,t)=>{let n=t*t*l,r=e,i=n;return[o+r*u-i*d,t*c,s+r*d+i*u]};for(let e=0;e<4;e++){let i=e/4,a=(e+1)/4,o=.026*(1-i*.92),s=.026*(1-a*.92),l=[f(-o,i),f(o,i),f(s,a),f(-o,i),f(s,a),f(-s,a)];for(let[e,i,a]of l){t.push(e,i,a);let o=i/c;n.push(.035+o*.12,.07+o*.16,.022+o*.035),r.push(o)}}}let i=new P;return i.setAttribute(`position`,new T(new Float32Array(t),3)),i.setAttribute(`aColor`,new T(new Float32Array(n),3)),i.setAttribute(`aLevel`,new T(new Float32Array(r),1)),i.computeVertexNormals(),i}function bt(){let e=G(K(`herb.form`)),t=[],n=(e,t,n)=>{let r=e.index?e.toNonIndexed():e;r.deleteAttribute(`uv`);let i=r.attributes.position.count;return r.setAttribute(`aColor`,new T(new Float32Array(i*3).map((e,n)=>t[n%3]),3)),r.setAttribute(`aPetal`,new T(new Float32Array(i).fill(n),1)),r.setAttribute(`aLevel`,new T(new Float32Array(i).map((e,t)=>Math.min(1,r.attributes.position.getY(t)/.7)),1)),r};t.push(n(new d(.008,.013,.62,3,1,!0).translate(0,.31,0),[.08,.16,.05],0));for(let r=0;r<4;r++){let i=r/4*Math.PI*2+e();t.push(n(new ne(.035,.2).translate(0,.1,0).rotateZ(.7).rotateY(i).translate(0,.05+r*.07,0),[.06,.14,.04],0))}let r=new O(.075,5).rotateX(-Math.PI/2+.25).translate(0,.64,0);return t.push(n(r,[1,1,1],1)),t.push(n(new O(.025,5).rotateX(-Math.PI/2).translate(0,.646,0),[.6,.45,.12],0)),re(t)}var xt=`
attribute vec3 aColor;
attribute float aLevel;
attribute float aDelay;
attribute vec3 aTint;
uniform float uGrow;
uniform float uTime;
uniform float uWind;
uniform float uFadeFar;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vLevel;
${Qe}
${et}
void main() {
  // Some aos poucos antes do limite de distância do ladrilho (sem "pulo" quando ele deixa de ser desenhado).
  vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float fade = smoothstep(uFadeFar, uFadeFar * 0.72, distance(cameraPosition, root));
  float g = growth(uGrow, aDelay) * fade;
  // O tronco primeiro, os ramos depois (cada parte aparece quando o crescimento passa do seu nível).
  float part = smoothstep(aLevel * 0.55, aLevel * 0.55 + 0.45, g);
  vec3 p = position * g * mix(0.0, 1.0, part);
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  float gust = sin(uTime * 1.1 + w.x * 0.11 + w.z * 0.07) * 0.6 + sin(uTime * 2.3 + w.x * 0.37) * 0.4;
  float bend = p.y * p.y * uWind * (0.6 + 0.4 * gust);
  w.x += bend;
  w.z += bend * 0.4;
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vColor = aColor * aTint;
  vLevel = aLevel;
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,St=`
${Ge}
${tt}
${rt}
uniform float uTrees;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vLevel;
void main() {
  float canopy = texture2D(tCanopy, terrainUv(vWorld.xz)).r * uTrees;
  float ao = (0.55 + 0.45 * vLevel) * (1.0 - canopy * 0.55);
  vec3 col = withFog(shadeLit(vColor, gl_FrontFacing ? vNormal : -vNormal, vWorld, ao, 0.35));
  col = mix(col, vec3(0.0015), uDark * 0.9);
  gl_FragColor = vec4(col, 1.0);
}`,Ct=xt.replace(`attribute float aLevel;`,`attribute float aLevel;
attribute float aPetal;`).replace(`vColor = aColor * aTint;`,`vColor = mix(aColor, aTint, aPetal);`),wt=`
attribute vec3 aCenter;
attribute float aSway;
attribute float aAo;
varying float vAo;
attribute float aDelay;
attribute vec3 aTint;
uniform float uGrow;
uniform float uTime;
uniform float uWind;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTint;
${Qe}
${et}
void main() {
  float g = growth(uGrow, aDelay);
  // A copa se enche depois do tronco: cada cartão cresce em volta do próprio centro.
  float fill = smoothstep(0.45, 1.0, g);
  vec3 p = (aCenter + (position - aCenter) * fill) * g;
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  float flutter = sin(uTime * 3.1 + aCenter.x * 7.0 + aCenter.z * 5.0) * 0.06 * aSway;
  float gust = sin(uTime * 1.1 + w.x * 0.11 + w.z * 0.07);
  w.x += (p.y * 0.012 * uWind * 40.0) * (0.6 + 0.4 * gust) + flutter;
  w.y += flutter * 0.5;
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vUv = uv;
  vTint = aTint;
  vAo = aAo;
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,Tt=`
${tt}
uniform sampler2D tLeaves;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTint;
varying float vAo;
void main() {
  vec4 t = texture2D(tLeaves, vUv);
  if (t.a < 0.45) discard;
  vec3 albedo = t.rgb * t.rgb * vTint;
  albedo = mix(vec3(dot(albedo, vec3(0.3, 0.55, 0.15))), albedo, 0.78);
  // Folha: luz que atravessa contra o sol (translucidez), e oclusão maior no miolo da copa.
  vec3 col = withFog(shadeLit(albedo, gl_FrontFacing ? vNormal : -vNormal, vWorld, vAo, 0.9 * vAo));
  col = mix(col, vec3(0.0015), uDark * 0.9);
  gl_FragColor = vec4(col, 1.0);
}`,Et=`
${Ge}
${$e}
uniform float uGlow;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
void main() {
  vec3 N = normalize(vNormal);
  vec3 col = shadeSurface(vColor, N, vWorld, 0.8, 0.2);
  // Brilho suave no fim do dia sexto (escolha artística da bênção); a casca tem um reflexo.
  vec3 V = normalize(cameraPosition - vWorld);
  col += uLightColor * pow(max(dot(reflect(-normalize(uLightDir), N), V), 0.0), 24.0) * 0.25;
  col += vColor * uGlow * 0.6;
  col = mix(col, vec3(0.0015), uDark * 0.9);
  gl_FragColor = vec4(col, 1.0);
}`;function Dt(e,t){return Math.hypot(e-X.meadow.x,t-X.meadow.z)>9&&Math.hypot(e-X.garden.x,t-X.garden.z)>7&&Math.hypot(e-X.plains.x,t-X.plains.z)>8}function Ot(e,t,n,r){let i=Y(t,n);switch(e){case`palm`:return i>.12&&i<.5&&r<1.6;case`conifer`:return r>2.6;case`umbrella`:return Math.hypot(t-X.plains.x,n-X.plains.z)<24&&r<3;case`fruit`:return Math.hypot(t-X.garden.x,n-X.garden.z)<20||Math.hypot(t-X.meadow.x,n-X.meadow.z)<16;case`slender`:return i>.4;default:return i>.45&&r<4.5}}function kt(e,t,n,r){let i=new o,a=(e,i,a,o={},s={})=>new E({vertexShader:e,fragmentShader:i,side:2,uniforms:{...t,...n,uGrow:{value:0},uTime:r,uWind:{value:a},uTrees:{value:0},uFadeFar:{value:1e6},...o},...s}),s=a(xt,St,.09,{uFadeFar:{value:45}}),c=a(Ct,St,.06,{uFadeFar:{value:51}}),l=a(xt,St,.002),d=a(wt,Tt,.004,{tLeaves:{value:ht()}}),f=a(xt,Et,.002,{uGlow:{value:0},uFadeFar:{value:59}}),p=G(K(`flora.place`)),m=(e,t)=>Math.min(.6,Math.hypot(e-X.meadow.x,t-X.meadow.z)/75)+p()*.1,g=[X.meadow,X.garden,X.plains,X.grove,{x:X.shore.x+8,z:X.shore.z}],_=[...je(Math.floor(e.grass*.45),K(`flora.grass`),{minInland:.2}),...g.flatMap((t,n)=>je(Math.floor(e.grass*.55/g.length),K(`flora.grass.${n}`),{minInland:.2,region:{x:t.x,z:t.z,r:13}}))],v=(e,t)=>Math.min(...Fe.map(n=>Math.hypot(e-n.x,t-n.z))),y=_.filter(e=>v(e.x,e.z)>.9).map(e=>{let t=.35+.65*Math.min(1,Math.max(0,(v(e.x,e.z)-1.5)/7));return{x:e.x,y:e.y-.03,z:e.z,s:(.32+p()*.5)*t,rot:p()*Math.PI*2,delay:m(e.x,e.z),tint:[.8+p()*.4,.85+p()*.3,.7+p()*.35]}}),b=[[1,.98,.92],[1,.82,.25],[.62,.5,.95],[1,.55,.45],[.95,.75,.9]],x=je(e.herbs,K(`flora.herbs`),{minInland:.3}).filter(e=>mt(e.x,e.z,1.6)).map(e=>({x:e.x,y:e.y-.02,z:e.z,s:.35+p()*.4,rot:p()*Math.PI*2,delay:m(e.x,e.z)+.08,tint:b[Math.floor(p()*b.length)]})),S=[ft(yt(),null,s,y,{tile:16,lodDistance:1e9,maxDistance:46,height:1}),ft(bt(),null,c,x,{tile:20,lodDistance:1e9,maxDistance:52,height:1.2})],C=[],w=[],D={broadleaf:`#3e2e22`,conifer:`#33261d`,slender:`#6e6456`,umbrella:`#4a3626`,fruit:`#4a3526`,palm:`#6a5640`},O={broadleaf:[1,1,.9],conifer:[.7,.85,.75],slender:[1.15,1.15,.85],umbrella:[1.05,1,.75],fruit:[1.05,1.1,.9],palm:[1.1,1.1,.8]};for(let t of Re)for(let n=0;n<2;n++){let r=He(t,n),i=je(e.trees*6,K(`flora.trees.${t}.${n}`),{minInland:.1,maxHeight:6}).filter(e=>Ot(t,e.x,e.z,e.y)&&mt(e.x,e.z,7)&&Dt(e.x,e.z)).slice(0,e.trees).map(e=>{let n=.8+p()*.55,i=m(e.x,e.z)+.12;C.push({x:e.x,z:e.z,r:r.crown*n});for(let t of r.fruits){let r=Math.cos(0);w.push({x:e.x+t[0]*n*r,y:e.y+t[1]*n,z:e.z+t[2]*n,s:.9+p()*.3,rot:0,delay:i+.2,tint:[.62+p()*.2,.18+p()*.22,.06]})}let a=O[t];return{x:e.x,y:Math.min(e.y,ke(e.x,e.z))-.05,z:e.z,s:n,rot:p()*Math.PI*2,delay:i,tint:[a[0]*(.85+p()*.3),a[1]*(.85+p()*.3),a[2]*(.85+p()*.3)]}});if(!i.length)continue;t===`fruit`&&i.forEach(e=>e.rot=0);let a=gt(r),o=new h(D[t]),s={tile:30,lodDistance:55,maxDistance:1e9,height:r.height*1.4};S.push(ft(_t(r,o,t===`slender`),_t(a,o,t===`slender`),l,i,s)),S.push(ft(vt(r),vt(a),d,i,s))}let k=new u(.075,2).toNonIndexed();k.setAttribute(`aColor`,new T(new Float32Array(k.attributes.position.count*3).fill(1),3)),k.setAttribute(`aLevel`,new T(new Float32Array(k.attributes.position.count).fill(1),1)),S.push(ft(k,null,f,w,{tile:30,lodDistance:1e9,maxDistance:60,height:4}));let A={grass:new o,herbs:new o,bark:new o,leaves:new o,fruit:new o},j=new Map([[s,A.grass],[c,A.herbs],[l,A.bark],[d,A.leaves],[f,A.fruit]]);return S.forEach(e=>e.meshes.forEach(e=>j.get(e.material).add(e))),i.add(...Object.values(A)),{group:i,layers:A,grass:s,herbs:c,bark:l,leaves:d,fruit:f,canopy:C,update(e){S.forEach(t=>t.update(e))},setDensity(e){S.forEach(t=>t.setDensity(e))}}}var At=`
mat3 heading(vec3 fwd) {
  vec3 f = normalize(fwd);
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)) + vec3(0.0, 0.0, 1e-4));
  vec3 u = cross(r, f);
  return mat3(f, u, r);
}`,jt=`
${Ge}
${$e}
uniform float uEmerge;
uniform vec2 uBelly; // altura local do ventre e do dorso (contra-sombreamento)
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vLocal;
varying float vG;
varying float vAo;
void main() {
  // Formação a partir do pó: o corpo se completa por um limiar de ruído.
  float n = vnoise(vLocal.xy * 14.0 + vLocal.z * 9.0) * 0.6 + vnoise(vLocal.zy * 31.0) * 0.4;
  float cut = vG * 1.12 - 0.06;
  if (n > cut) discard;
  float edge = smoothstep(0.07, 0.0, cut - n) * step(vG, 0.999);
  // Contra-sombreamento: dorso mais escuro, ventre mais claro; pelagem/escamas em variação fina.
  float belly = smoothstep(uBelly.y, uBelly.x, vLocal.y);
  vec3 albedo = vColor * mix(0.78, 1.25, belly) * (0.9 + 0.2 * vnoise(vLocal.xz * 22.0 + vLocal.y * 5.0));
  vec3 col = shadeSurface(albedo, gl_FrontFacing ? vNormal : -vNormal, vWorld, vAo, 0.12);
  col += vec3(1.0, 0.74, 0.38) * edge * 3.0 * uEmerge;
  col = mix(col, vec3(0.0015), uDark * 0.9);
  gl_FragColor = vec4(col, 1.0);
}`,Mt=`
attribute float aAo;
attribute float aDelay;
attribute vec3 aTint;
uniform float uGrow;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vLocal;
varying float vG;
varying float vAo;
${Qe}
${At}`,Nt=`
${Mt}
attribute vec4 aSchool; // centro x, centro z, raio, profundidade
attribute vec4 aMotion; // velocidade, fase, ângulo do lugar no cardume, distância no cardume
attribute float aSize;
void main() {
  float g = growth(uGrow, aDelay);
  vG = g;
  float a = uTime * aMotion.x + aMotion.y;
  vec3 c = vec3(aSchool.x + cos(a) * aSchool.z, aSchool.w + sin(a * 2.0) * 0.35, aSchool.y + sin(a) * aSchool.z * 0.6);
  vec3 vel = vec3(-sin(a) * aSchool.z, cos(a * 2.0) * 0.7, cos(a) * aSchool.z * 0.6);
  float oa = aMotion.z + sin(uTime * 0.4 + aMotion.y) * 0.3;
  vec3 off = vec3(cos(oa) * aMotion.w, sin(oa * 1.7) * aMotion.w * 0.35, sin(oa) * aMotion.w);
  vec3 p = position;
  // O nado: a onda corre da cabeça para a cauda, mais ampla atrás.
  float body = smoothstep(0.25, -0.55, p.x);
  p.z += sin(uTime * 8.0 + aMotion.y * 10.0 + p.x * 7.0) * 0.07 * body;
  vLocal = position;
  mat3 R = heading(vel);
  vec3 w = c + off + R * (p * aSize);
  vWorld = w;
  vNormal = R * normal;
  vColor = aTint * aTint; // as cores são escritas como sRGB; o sombreamento é linear
  vAo = aAo;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,Pt=`
${Mt}
attribute vec4 aFlock; // centro x, centro z, raio, altura
attribute vec4 aMotion; // velocidade, fase, ângulo no bando, distância no bando
attribute vec4 aPerch; // onde pousa (v. 22–23) e o tamanho
uniform float uPerch;
void main() {
  float g = growth(uGrow, aDelay);
  vG = g;
  float a = uTime * aMotion.x + aMotion.y;
  vec3 c = vec3(aFlock.x + cos(a) * aFlock.z, aFlock.w + sin(a * 1.3 + aMotion.y) * 2.0, aFlock.y + sin(a) * aFlock.z * 0.7);
  vec3 vel = vec3(-sin(a) * aFlock.z, cos(a * 1.3) * 2.6, cos(a) * aFlock.z * 0.7);
  vec3 off = vec3(cos(aMotion.z), sin(aMotion.z * 2.3) * 0.4, sin(aMotion.z)) * aMotion.w;
  float perch = smoothstep(0.0, 1.0, clamp(uPerch * 1.4 - aMotion.y * 0.05, 0.0, 1.0));
  vec3 p = position;
  float span = max(abs(p.z) - 0.06, 0.0);
  // Batida com planeio: às vezes as asas param abertas.
  float beat = sin(uTime * (6.0 + aMotion.x * 40.0) + aMotion.y * 6.0);
  float glide = smoothstep(0.2, 0.6, sin(uTime * 0.35 + aMotion.y * 3.0));
  float flap = beat * mix(1.0, 0.12, glide) * (1.0 - perch);
  p.y += flap * span * 0.9 + span * span * 0.4 * (1.0 - perch);
  // Asas recolhidas no pouso.
  p.z = sign(p.z) * (min(abs(p.z), 0.06) + span * mix(1.0, 0.18, perch));
  p.y -= span * perch * 0.15;
  vLocal = position;
  mat3 R = heading(mix(vel, vec3(1.0, 0.0, 0.3), perch));
  vec3 w = mix(c + off, aPerch.xyz, perch) + R * (p * aPerch.w);
  vWorld = w;
  vNormal = R * normal;
  vColor = aTint * aTint; // as cores são escritas como sRGB; o sombreamento é linear
  vAo = aAo;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,Ft=`
${Mt}
${rt}
attribute vec4 aHome; // x, z, raio do passeio, sentido
attribute vec4 aMotion; // velocidade, fase, passo (0 pastando – 1 andando), escala
uniform float uHip;
uniform vec2 uLegX;
void main() {
  float g = growth(uGrow, aDelay);
  vG = g;
  float walk = aMotion.z;
  float a = (uTime * aMotion.x * walk + aMotion.y) * aHome.w;
  vec2 xz = aHome.xy + vec2(cos(a), sin(a)) * aHome.z;
  vec3 c = vec3(xz.x, fullHeight(xz) - 0.03, xz.y);
  vec3 vel = vec3(-sin(a), 0.0, cos(a)) * aHome.w + vec3(1e-4, 0.0, 0.0);
  vec3 p = position;
  // Passo diagonal: cada pata balança em volta do quadril (o deslocamento é zero na junção com o corpo).
  float gait = uTime * 5.0 * (0.35 + walk) + aMotion.y * 5.0;
  if (p.y < uHip && uHip > 0.0) {
    float front = step((uLegX.x + uLegX.y) * 0.5, p.x);
    float left = step(0.0, p.z);
    float ph = abs(front - left) * 3.14159;
    float sw = sin(gait + ph) * 0.42 * walk;
    float dy = uHip - p.y;
    p.x += sin(sw) * dy;
    p.y += max(0.0, cos(gait + ph)) * 0.05 * walk * (dy / uHip);
  }
  // Cabeça: pasta (desce e sobe) quando parado; acompanha o passo quando anda.
  float head = smoothstep(uLegX.x, uLegX.x + 0.5, p.x);
  p.y += head * ((sin(uTime * 0.7 + aMotion.y * 3.0) * 0.5 - 0.35) * 0.16 * (1.0 - walk) + sin(gait * 2.0) * 0.015 * walk);
  p.y += abs(sin(gait)) * 0.02 * walk;
  vLocal = position;
  mat3 R = heading(vel);
  vec3 w = c + R * (p * aMotion.w);
  vWorld = w;
  vNormal = R * normal;
  vColor = aTint * aTint; // as cores são escritas como sRGB; o sombreamento é linear
  vAo = aAo;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,It=`
${rt}
${Qe}
${At}
attribute vec4 aHome;
attribute vec4 aMotion;
attribute float aDelay;
uniform float uGrow;
uniform float uTime;
uniform vec2 uSize;
varying vec2 vQ;
varying float vG;
void main() {
  vG = growth(uGrow, aDelay);
  float walk = aMotion.z;
  float a = (uTime * aMotion.x * walk + aMotion.y) * aHome.w;
  vec2 xz = aHome.xy + vec2(cos(a), sin(a)) * aHome.z;
  vec3 vel = vec3(-sin(a), 0.0, cos(a)) * aHome.w + vec3(1e-4, 0.0, 0.0);
  mat3 R = heading(vel);
  vec3 local = vec3(position.x * uSize.x, 0.0, position.y * uSize.y) * aMotion.w;
  vec3 w = vec3(xz.x, 0.0, xz.y) + R * local;
  w.y = fullHeight(w.xz) + 0.04;
  vQ = position.xy * 2.0;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,Lt=`
uniform float uDark;
uniform float uLightAmt;
varying vec2 vQ;
varying float vG;
void main() {
  float r = dot(vQ, vQ);
  float a = (1.0 - smoothstep(0.15, 1.0, r)) * 0.5 * vG * uLightAmt * (1.0 - uDark);
  if (a < 0.003) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`,Rt=`
${Mt}
void main() {
  vG = growth(uGrow, 0.0);
  vec3 p = position;
  // O impulso da cauda: uma onda vertical lenta, mais ampla atrás.
  p.y += sin(uTime * 0.55 - p.x * 1.4) * 0.05 * smoothstep(0.2, -1.5, p.x);
  vLocal = position;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vColor = aTint * aTint; // as cores são escritas como sRGB; o sombreamento é linear
  vAo = aAo;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,zt=[`grazer`,`strider`,`crawler`,`small`];function $(e,t,r,i){e.setAttribute(t,new n(new Float32Array(r),i))}function Bt(t,n,r,i,a){let s=new o,c=G(K(`fauna`)),l=(e,t,a={})=>new E({vertexShader:e,fragmentShader:jt,uniforms:{...n,...r,uGrow:{value:0},uTime:i,uEmerge:{value:0},uBelly:{value:new w(...t)},...a}}),u=[],d=1,f=(e,t,n,r,i)=>a.get(e).then(a=>{if(!n)return;i(a);let o=new m(a,t,n);o.boundingSphere=r,o.frustumCulled=!0,o.name=e,s.add(o),u.push({mesh:o,full:n}),o.count=Math.floor(n*d)}),p=l(Nt,[-.12,.12]),h=[{x:-31,z:-6},{x:-26,z:-12},{x:-34,z:-16},{x:-29,z:-2},...Me(Math.max(6,Math.round(t.fish/40)),K(`fauna.schools`))],g=[[.55,.68,.74],[.72,.64,.46],[.42,.52,.66],[.78,.78,.8],[.62,.5,.4],[.5,.62,.5]],_=new j().setFromPoints(h.map(t=>new e(t.x,-2,t.z)));_.radius+=16;let v=f(`fish`,p,t.fish,_,e=>{let n=[],r=[],i=[],a=[],o=[];for(let e=0;e<t.fish;e++){let t=e%h.length,s=h[t];n.push(s.x,s.z,t<4?2.5+t:4+t%5*2,t<4?-1.6-t*.5:-.6-t%4*.9),r.push(.06+t%3*.03,t*1.7,c()*Math.PI*2,.4+c()*2.2),i.push(t/h.length*.5+c()*.2);let l=g[t%g.length];a.push(l[0],l[1],l[2]),o.push((.45+t%4*.3)*(.9+c()*.2))}$(e,`aSchool`,n,4),$(e,`aMotion`,r,4),$(e,`aDelay`,i,1),$(e,`aTint`,a,3),$(e,`aSize`,o,1)}),y=l(Rt,[-.2,.15]),b=new D(new P,y);b.scale.setScalar(8),b.frustumCulled=!1,s.add(b);let x=a.get(`great`).then(e=>{let t=e.attributes.position.count;e.setAttribute(`aTint`,new T(new Float32Array(t*3).map((e,t)=>[.3,.34,.38][t%3]),3)),e.setAttribute(`aDelay`,new T(new Float32Array(t),1)),b.geometry=e}),S=l(Pt,[-.05,.05],{uPerch:{value:0}}),C=je(t.birds,K(`fauna.perch`),{region:{x:X.shore.x+3,z:X.shore.z,r:12},minInland:.02,maxHeight:.9}),O=new j(new e(12,16,-4),52),k=f(`bird`,S,t.birds,O,e=>{let n=[],r=[],i=[],a=[],o=[];for(let e=0;e<t.birds;e++){let t=e%8;n.push(-10+t*6,-14+t%3*10,18+t*3,9+t*1.6),r.push(.035+t%4*.01,t*.9+c()*.4,c()*Math.PI*2,.5+c()*3.5);let s=(.8+t%3*.4)*(.9+c()*.2),l=C[e%Math.max(1,C.length)]??{x:X.shore.x,y:1,z:X.shore.z};i.push(l.x,l.y+.07*s,l.z,s),a.push(t/8*.5+c()*.15);let u=[[.85,.84,.8],[.35,.33,.32],[.6,.5,.4],[.7,.72,.76]][t%4],d=.85+c()*.3;o.push(u[0]*d,u[1]*d,u[2]*d)}$(e,`aFlock`,n,4),$(e,`aMotion`,r,4),$(e,`aPerch`,i,4),$(e,`aDelay`,a,1),$(e,`aTint`,o,3)}),A={grazer:{region:{x:X.plains.x,z:X.plains.z,r:15},walk:.35,count:t.animals,colors:[[.42,.3,.2],[.62,.5,.36],[.22,.18,.15],[.7,.66,.58]],scale:[.85,1.15]},strider:{region:{x:q.x+6,z:q.z-8,r:24},walk:.7,count:t.animals,colors:[[.62,.45,.26],[.55,.42,.3],[.7,.56,.38]],scale:[.85,1.1]},crawler:{region:{x:X.meadow.x,z:X.meadow.z,r:14},walk:.85,count:t.animals,colors:[[.3,.34,.2],[.4,.36,.24],[.26,.28,.22]],scale:[.6,1.1]},small:{region:{x:X.meadow.x+4,z:X.meadow.z-6,r:18},walk:.6,count:Math.round(t.animals*1.5),colors:[[.55,.45,.35],[.45,.38,.32],[.62,.58,.5]],scale:[.8,1.2]}},M=[],N=zt.map(t=>{let a=A[t],o=xe(t),p=o.model.bounds.max[1],h=l(Ft,[p*.35,p*.85],{uHip:{value:o.hip},uLegX:{value:new w(...o.legX)}});h.uniforms.uEmerge.value=1,M.push(h);let g=je(a.count*3,K(`fauna.beasts.${t}`),{region:a.region,minInland:.4,maxHeight:4.5}).filter(e=>Math.hypot(e.x-X.garden.x,e.z-X.garden.z)>7&&mt(e.x,e.z,4)).slice(0,a.count),_=new j(new e(a.region.x,2,a.region.z),a.region.r+6);return f(t,h,g.length,_,e=>{let t=[],l=[],f=[],p=[];g.forEach(e=>{let n=c()<a.walk;t.push(e.x,e.z,n?1.2+c()*2.2:.01,c()<.5?1:-1),l.push(.12+c()*.1,c()*Math.PI*2,n?.6+c()*.4:0,a.scale[0]+c()*(a.scale[1]-a.scale[0])),f.push(c()*.55);let r=a.colors[Math.floor(c()*a.colors.length)],i=.85+c()*.3;p.push(r[0]*i,r[1]*i,r[2]*i)}),$(e,`aHome`,t,4),$(e,`aMotion`,l,4),$(e,`aDelay`,f,1),$(e,`aTint`,p,3);let v=o.model.bounds,y=new ne(1,1);for(let t of[`aHome`,`aMotion`,`aDelay`])y.setAttribute(t,e.getAttribute(t));let b=new E({vertexShader:It,fragmentShader:Lt,transparent:!0,depthWrite:!1,uniforms:{...r,uGrow:h.uniforms.uGrow,uTime:i,uDark:n.uDark,uLightAmt:n.uLightAmt,uSize:{value:new w((v.max[0]-v.min[0])*1.1,(v.max[2]-v.min[2])*1.4)}}}),x=new m(y,b,g.length);x.boundingSphere=_,x.renderOrder=2,s.add(x),u.push({mesh:x,full:g.length}),x.count=Math.floor(g.length*d)})}),ee=Promise.all([v,x,k,...N]).then(()=>void 0);return{group:s,fish:p,birds:S,beasts:M,great:{mesh:b,mat:y},ready:ee,update(e){let t=e*.02;b.position.set(-30+Math.cos(t)*9,-4.6+Math.sin(t*2)*.5,-17+Math.sin(t)*5),b.rotation.y=-t-Math.PI/2,b.rotation.z=Math.sin(t*3)*.04},setDensity(e){d=Math.min(1,e),u.forEach(({mesh:e,full:t})=>e.count=Math.max(0,Math.floor(t*d)))}}}var Vt=`
attribute float aH;
attribute float aPatch;
uniform float uLand;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vH;
varying float vPatch;
void main() {
  float h = aH - (1.0 - uLand) * (aH > 0.0 ? aH + ${we.toFixed(2)} : ${(we*.4).toFixed(2)});
  vec4 w = modelMatrix * vec4(position.x, h, position.z, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vH = aH;
  vPatch = aPatch;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,Ht=`
${Ge}
${$e}
${rt}
uniform float uGrass;
uniform float uTrees;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vH;
varying float vPatch;
void main() {
  // Normal de detalhe (pequenas ondulações e pedras).
  vec2 q = vWorld.xz;
  float e = 0.15;
  float n0 = fbm3(q * 0.9);
  vec3 bump = vec3(fbm3((q + vec2(e, 0.0)) * 0.9) - n0, 0.0, fbm3((q + vec2(0.0, e)) * 0.9) - n0) * 1.4;
  // O detalhe só inclina a normal nas superfícies mais deitadas (nas encostas, viraria listras).
  vec3 N = normalize(vNormal - bump * clamp(vNormal.y, 0.0, 1.0));
  float slope = 1.0 - clamp(vNormal.y, 0.0, 1.0);
  float y = vWorld.y;
  vec3 wetSand = vec3(0.07, 0.06, 0.045);
  vec3 sand = vec3(0.3, 0.25, 0.17);
  vec3 soil = vec3(0.09, 0.065, 0.042);
  vec3 rock = vec3(0.14, 0.135, 0.13) * (0.8 + 0.4 * vnoise(q * 0.35));
  vec3 c = mix(soil, rock, smoothstep(0.32, 0.62, slope + (vnoise(q * 0.2) - 0.5) * 0.2));
  float sandBand = 1.0 - smoothstep(0.25, 1.1 + vnoise(q * 0.3) * 0.6, y);
  c = mix(c, sand, sandBand * 0.85);
  c = mix(c, wetSand, (1.0 - smoothstep(-0.05, 0.28, y)) * 0.9);
  // A relva cobre a terra em manchas (pela ordem de aPatch), menos as encostas íngremes e a praia.
  vec3 green = mix(vec3(0.03, 0.06, 0.018), vec3(0.085, 0.12, 0.035), vPatch) * (0.7 + 0.6 * vnoise(q * 0.5));
  float cover = smoothstep(vPatch * 0.7, vPatch * 0.7 + 0.3, uGrass * 1.25) * (1.0 - sandBand * 0.9) * (1.0 - smoothstep(0.42, 0.7, slope));
  c = mix(c, green, cover);
  // Sombra das copas, conforme as árvores crescem.
  float canopy = texture2D(tCanopy, terrainUv(q)).r * uTrees;
  float ao = 1.0 - canopy * 0.65;
  vec3 col = shadeSurface(c, N, vWorld, ao, 0.0);
  col = mix(col, vec3(0.0015, 0.002, 0.004), uDark * 0.9);
  gl_FragColor = vec4(col, 1.0);
}`;function Ut(e,t,n){let r=new ne(150,150,e,e);r.rotateX(-Math.PI/2),r.translate(q.x,0,q.z);let i=r.attributes.position,a=new Float32Array(i.count),o=new Float32Array(i.count);for(let e=0;e<i.count;e++){let t=i.getX(e),n=i.getZ(e);a[e]=ke(t,n),o[e]=Math.min(1,Math.max(0,.5+J(t*.09+7,n*.09-3,3))),i.setY(e,a[e])}r.computeVertexNormals(),r.setAttribute(`aH`,new T(a,1)),r.setAttribute(`aPatch`,new T(o,1));let s=new E({vertexShader:Vt,fragmentShader:Ht,uniforms:{...t,...n,uLand:{value:0},uGrass:{value:0},uTrees:{value:0}}});return{mesh:new D(r,s),mat:s}}var Wt=`
attribute float aAo;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying float vAo;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vLocal = position;
  vAo = aAo;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,Gt=`
${Ge}
${$e}
uniform float uShow;
uniform float uInner;
uniform float uHeight;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying float vAo;
void main() {
  // De baixo para cima, com o ruído do pó.
  float h = vLocal.y / uHeight;
  float n = vnoise(vLocal.xy * 40.0 + vLocal.z * 23.0) * 0.5 + vnoise(vLocal.zy * 90.0) * 0.5;
  float front = uShow * 1.35 - 0.1;
  float v = h * 0.8 + n * 0.3;
  if (v > front) discard;
  float edge = smoothstep(0.06, 0.0, front - v) * step(uShow, 0.999);
  vec3 N = normalize(gl_FrontFacing ? vNormal : -vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float facing = max(dot(N, V), 0.0);
  float rim = pow(1.0 - facing, 2.2);
  // Figura de luz: um volume translúcido, quente por dentro, mais luminoso no contorno, que recebe a
  // luz do mundo sem ganhar cor de pele, de pedra ou de roupa.
  vec3 L = normalize(uLightDir);
  float ndl = max(dot(N, L), 0.0);
  vec3 warmCol = mix(vec3(1.0, 0.93, 0.82), vec3(1.0, 0.82, 0.56), uInner);
  float ao = vAo * vAo;
  vec3 col = warmCol * (0.32 + 0.3 * ndl) * (0.5 + 0.5 * ao) + warmCol * rim * 1.8;
  col += vec3(1.0, 0.76, 0.42) * edge * 4.0;
  col *= 1.0 - uDark;
  float alpha = clamp(0.8 + rim * 0.2 + edge, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;function Kt(e,t){let n=new o,r={value:0},i={value:0},a=new E({vertexShader:`varying vec2 vQ; void main() { vQ = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`uniform float uShow; uniform float uLightAmt; varying vec2 vQ; void main() { float a = (1.0 - smoothstep(0.1, 1.0, dot(vQ, vQ))) * 0.45 * uShow * uLightAmt; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`,transparent:!0,depthWrite:!1,uniforms:{uShow:r,uLightAmt:e.uLightAmt}});return{group:n,show:r,warm:i,ready:Promise.all(Fe.map((o,s)=>{let c=new E({vertexShader:Wt,fragmentShader:Gt,transparent:!0,depthWrite:!0,uniforms:{...e,uShow:r,uInner:i,uHeight:{value:o.height}}});return t.get(s===0?`human0`:`human1`).then(e=>{let t=new D(e,c);t.position.set(o.x,o.y-.02,o.z),t.rotation.y=o.yaw,n.add(t);let r=new D(new ne(.9,.9).rotateX(-Math.PI/2),a);r.position.set(o.x,o.y+.03,o.z+.05),r.renderOrder=2,n.add(r)})})).then(()=>void 0)}}var qt={dust:{color:[.6,.66,.82],size:2,brightness:.32,drift:.05,swirl:.3},hover:{color:[.75,.82,.95],size:2.2,brightness:.55,drift:.25,swirl:.9},lightCore:{color:[1,.93,.8],size:2.2,brightness:.55,drift:.1,swirl:.6},lightSpread:{color:[1,.95,.85],size:2.2,brightness:.75,drift:.12,swirl:.4},dayNight:{color:[.95,.9,.8],size:2,brightness:.55,drift:.1,swirl:.3},firmament:{color:[.82,.9,1],size:2,brightness:.45,drift:.15,swirl:.4},gathering:{color:[.8,.9,1],size:1.5,brightness:.18,drift:.2,swirl:.5},seeds:{color:[.95,.85,.55],size:1.8,brightness:.35,drift:.35,swirl:.2},pollen:{color:[.95,.9,.6],size:1.3,brightness:.2,drift:.2,swirl:.6},orbits:{color:[.95,.85,.6],size:1.8,brightness:.55,drift:0,swirl:.15},starfield:{color:[.85,.88,1],size:1.5,brightness:.5,drift:0,swirl:.05},currents:{color:[.6,.85,.95],size:1.8,brightness:.4,drift:.4,swirl:.8},flight:{color:[.95,.92,.85],size:1.6,brightness:.35,drift:.5,swirl:.5},meadowDust:{color:[.95,.82,.55],size:1.3,brightness:.2,drift:.2,swirl:.5},humanForms:{color:[1,.93,.82],size:.9,brightness:.22,drift:.01,swirl:.04},blessing:{color:[1,.85,.6],size:2,brightness:.6,drift:.6,swirl:.3},rest:{color:[.95,.9,.82],size:1.5,brightness:.25,drift:.08,swirl:.2}};function Jt(e,t){let n=e()*2-1,r=e()*Math.PI*2,i=Math.sqrt(1-n*n);return[Math.cos(r)*i*t,n*t,Math.sin(r)*i*t]}var Yt={dust:e=>{let[t,n,r]=Jt(e,30+e()*90);return[t,n*.6+8,r]},hover:e=>{let t=e()*Math.PI*2,n=Math.sqrt(e())*55;return[Math.cos(t)*n-8,.4+e()*e()*2.2,Math.sin(t)*n-6]},lightCore:e=>{let[t,n,r]=Jt(e,e()<.25?2+e()**1.2*6:6+e()**.7*26);return[t,n+16,r-30]},lightSpread:e=>{let t=e()*Math.PI*2,n=e()**.55*75;return[Math.cos(t)*n,10+(e()-.5)*8+Math.sin(t*3)*2,Math.sin(t)*n-25]},dayNight:(e,t)=>{let n=t%3!=0,r=(n?-.5:.5)*Math.PI+(e()-.5)*Math.PI*.95,i=20+e()*60;return[Math.cos(r)*i,(n?14:4)+(e()-.5)*10,Math.sin(r)*i-25]},firmament:(e,t)=>{let n=t%2==0,r=(e()*2-1)*90,i=-100+e()*120;return[r,n?34+e()*6+Math.sin(r*.05)*2:.3+e()*1.2,i]},gathering:e=>{for(let t=0;t<40;t++){let t=-40+e()*100,n=-60+e()*90,r=Y(t,n);if(r>.02&&r<.6)return[t,.3+e()*1.5,n]}return[e()*-40,.5,e()*-40]},seeds:e=>{let t=q.x+(e()*2-1)*36,n=q.z+(e()*2-1)*36;return[t,Math.max(0,Ae(t,n,1))+.5+e()**1.5*14,n]},pollen:e=>{let t=q.x+(e()*2-1)*32,n=q.z+(e()*2-1)*32;return[t,Math.max(0,ke(t,n))+.5+e()*6,n]},orbits:(e,t)=>{let n=t%5,r=e()*Math.PI*2,i=60+n*16,a=.32+n*.06,o=Math.cos(r)*i,s=Math.sin(r)*i;return[o,18+s*Math.sin(a)+(e()-.5)*.8,-40+s*Math.cos(a)*.35]},starfield:e=>{let[t,n,r]=Jt(e,160+e()*30);return[t,Math.abs(n)*.9+8,r]},currents:(e,t)=>{let n=t%7,r=e(),i=-75+r*80,a=-55+n*9+Math.sin(r*9+n)*4;return[i,-3.5+e()*3.6,a]},flight:(e,t)=>{let n=t%6,r=e()*Math.PI*2;return[Math.cos(r)*(40+n*7)+5,12+n*2.5+Math.sin(r*2+n)*2,Math.sin(r)*(30+n*5)-15]},meadowDust:e=>{let t=e()*Math.PI*2,n=Math.sqrt(e())*22,r=X.plains.x+Math.cos(t)*n,i=X.plains.z+Math.sin(t)*n;return[r,Math.max(.2,ke(r,i))+.2+e()*2.5,i]},humanForms:(e,t)=>{let n=Fe[t%2];if(e()<.06){let[t,r,i]=Jt(e,.5+e()*1.6);return[n.x+t,n.y+1+Math.abs(r),n.z+i]}return Le(n,e)},blessing:e=>{let t=-60+e()*110,n=-60+e()*90;return[t,Math.max(0,Ae(t,n,1))+.6+e()*4,n]},rest:e=>{let[t,n,r]=Jt(e,40+e()*80);return[t,Math.abs(n)*.5+6,r-20]}};function Xt(e,t,n=new Float32Array(t*3)){let r=G(K(`formation.${e}`)),i=Yt[e];for(let e=0;e<t;e++){let[a,o,s]=i(r,e,t);n[e*3]=a,n[e*3+1]=o,n[e*3+2]=s}return n}Object.keys(Yt);var Zt=`
${Ke}
uniform vec4 uAttractor;
attribute vec3 aFrom;
attribute vec3 aTo;
attribute vec4 aRand;
uniform float uMix;
uniform float uTime;
uniform float uPixel;
uniform float uSizeA;
uniform float uSizeB;
uniform float uSwirl;
uniform float uDrift;
uniform float uScale;
varying float vT;
varying float vTw;
void main() {
  float t = clamp((uMix - aRand.z * 0.35) / 0.65, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vT = t;
  vec3 p = mix(aFrom, aTo, t);
  float s = aRand.x * 6.2831;
  // No meio da viagem a matéria se solta mais (arco), e assenta ao chegar.
  float arc = sin(t * 3.14159) * (1.5 + aRand.w * 3.0);
  p.y += arc * 0.6;
  vec3 flowP = p * 0.045 + vec3(0.0, uTime * 0.018, aRand.x * 0.6);
  vec3 flow = curl(flowP);
  p += flow * 0.5 * uSwirl * (0.5 + aRand.w) * (1.0 + sin(t * 3.14159) * 2.5);
  p.y += sin(uTime * 0.11 + s) * uDrift;
  if (uAttractor.w != 0.0) {
    vec3 toA = uAttractor.xyz - p;
    float d = length(toA);
    p += toA / max(d, 1e-3) * uAttractor.w * exp(-d * 0.035) * (0.4 + aRand.w * 0.6) * min(d, 30.0) * 0.03;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vTw = 0.75 + 0.25 * sin(uTime * (0.8 + aRand.y) + s * 5.0);
  float size = mix(uSizeA, uSizeB, t) * (0.55 + aRand.y * 0.9) * uPixel * uScale;
  gl_PointSize = clamp(size * 60.0 / max(-mv.z, 1.0), 0.0, 14.0 * uPixel);
  // Perto da lente, a partícula some (sem "bolhas" desfocadas na frente da cena).
  vTw *= smoothstep(2.5, 9.0, -mv.z);
}`,Qt=`
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uBrightA;
uniform float uBrightB;
uniform float uFade;
varying float vT;
varying float vTw;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  float b = mix(uBrightA, uBrightB, vT) * vTw * uFade;
  if (a * b < 0.004) discard;
  gl_FragColor = vec4(mix(uColorA, uColorB, vT) * a * b, a * b);
}`;function $t(t,n,r){let i=new P,o=Xt(`dust`,t),s=o.slice(),c=new Float32Array(t*4),l=G(K(`particles.rand`));for(let e=0;e<t*4;e++)c[e]=l();i.setAttribute(`position`,new T(s,3)),i.setAttribute(`aFrom`,new T(o,3)),i.setAttribute(`aTo`,new T(s,3)),i.setAttribute(`aRand`,new T(c,4));let u=qt.dust,d=new E({vertexShader:Zt,fragmentShader:Qt,transparent:!0,depthWrite:!1,blending:2,uniforms:{uMix:{value:1},uTime:r,uPixel:n,uSizeA:{value:u.size},uSizeB:{value:u.size},uColorA:{value:new e(...u.color)},uColorB:{value:new e(...u.color)},uBrightA:{value:u.brightness},uBrightB:{value:u.brightness},uSwirl:{value:u.swirl},uDrift:{value:u.drift},uFade:{value:1},uScale:{value:1},uAttractor:{value:new C(0,0,0,0)}}}),f=new a(i,d);f.frustumCulled=!1;let p=`dust`,m=u,h=new Float32Array(t*3);return{points:f,mat:d,current:()=>p,setMix(e){d.uniforms.uMix.value=Math.min(1,Math.max(0,e))},goTo(e,n=!1){if(e===p&&!n)return;let r=d.uniforms,a=r.uMix.value;for(let e=0;e<t;e++){let t=Math.min(1,Math.max(0,(a-c[e*4+2]*.35)/.65));t=t*t*(3-2*t);for(let n=0;n<3;n++)o[e*3+n]=o[e*3+n]+(s[e*3+n]-o[e*3+n])*t}Xt(e,t,h),s.set(h),i.attributes.aFrom.needsUpdate=!0,i.attributes.aTo.needsUpdate=!0;let l=qt[e],u=n?l:m;r.uSizeA.value=u.size,r.uSizeB.value=l.size,r.uColorA.value.set(...u.color),r.uColorB.value.set(...l.color),r.uBrightA.value=u.brightness,r.uBrightB.value=l.brightness,r.uSwirl.value=l.swirl,r.uDrift.value=l.drift,r.uMix.value=+!!n,n&&o.set(h),p=e,m=l},setCount(e){i.setDrawRange(0,Math.min(e,t))}}}var en=`
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`,tn=`
uniform sampler2D tColor;
uniform sampler2D tDepth;
varying vec2 vUv;
void main() {
  float depth = texture2D(tDepth, vUv).x;
  vec3 c = texture2D(tColor, vUv).rgb;
  float sky = step(0.99999, depth);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(c * smoothstep(0.35, 1.6, lum) * sky, 1.0);
}`,nn=`
uniform sampler2D tMask;
uniform vec2 uLight;
uniform float uDecay;
uniform float uDensity;
uniform int uSamples;
varying vec2 vUv;
void main() {
  vec2 delta = (vUv - uLight) * uDensity / float(uSamples);
  vec2 uv = vUv;
  vec3 acc = vec3(0.0);
  float w = 1.0;
  for (int i = 0; i < 96; i++) {
    if (i >= uSamples) break;
    uv -= delta;
    acc += texture2D(tMask, clamp(uv, 0.0, 1.0)).rgb * w;
    w *= uDecay;
  }
  gl_FragColor = vec4(acc / float(uSamples), 1.0);
}`,rn=`
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
uniform bool uPrefilter;
varying vec2 vUv;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0)), l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uPrefilter) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    col *= max(soft, br - uThreshold) / max(br, 1e-4);
  }
  gl_FragColor = vec4(col, 1.0);
}`,an=`
uniform sampler2D tSrc;
uniform sampler2D tPrev;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb
    + texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb
    + 2.0 * (texture2D(tSrc, vUv + vec2(0.0, -1.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(0.0, 1.0) * uTexel).rgb
    + texture2D(tSrc, vUv + vec2(-1.0, 0.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1.0, 0.0) * uTexel).rgb)
    + 4.0 * texture2D(tSrc, vUv).rgb;
  gl_FragColor = vec4(s / 16.0 + texture2D(tPrev, vUv).rgb, 1.0);
}`,on=`
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform sampler2D tRays;
uniform float uBloom;
uniform float uRays;
uniform vec3 uRayColor;
uniform float uExposure;
uniform vec3 uShadows;
uniform vec3 uHighlights;
uniform float uSaturation;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform vec2 uTexel;
uniform bool uFxaa;
uniform sampler2D tDepth;
uniform float uDof;
uniform int uDofTaps;
uniform float uFocus;
uniform vec2 uClip; // perto, longe
varying vec2 vUv;
float viewDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return 2.0 * uClip.x * uClip.y / (uClip.y + uClip.x - z * (uClip.y - uClip.x));
}
/** Profundidade de campo (planos próximos): disco de 16 amostras com raio pelo círculo de confusão. */
vec3 dof(vec2 uv, vec3 sharp) {
  float d = viewDepth(uv);
  float coc = clamp(abs(d - uFocus) / max(d, 1e-3) * uDof, 0.0, 1.0);
  if (coc < 0.04) return sharp;
  vec2 r = uTexel * coc * 12.0;
  vec3 acc = sharp;
  float wsum = 1.0;
  // Rotação aleatória por pixel: sem o padrão de pontos de um disco fixo (o grão do filme disfarça o ruído).
  float rot = fract(sin(dot(uv * 913.7, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
  float taps = float(uDofTaps);
  for (int i = 0; i < 16; i++) {
    if (i >= uDofTaps) break;
    float a = float(i) * 2.39996 + rot;
    float rr = sqrt((float(i) + 0.5) / taps);
    vec2 o = vec2(cos(a), sin(a)) * rr * r;
    float dd = viewDepth(uv + o);
    // Amostras à frente do foco borram por cima; atrás, só se também estiverem fora de foco.
    float w = clamp(abs(dd - uFocus) / max(dd, 1e-3) * uDof * 1.5, 0.0, 1.0);
    acc += texture2D(tColor, uv + o).rgb * w;
    wsum += w;
  }
  return mix(sharp, acc / wsum, smoothstep(0.04, 0.3, coc));
}
vec3 aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 sampleScene(vec2 uv) { return texture2D(tColor, uv).rgb; }
vec3 fxaa(vec2 uv) {
  vec3 m = sampleScene(uv);
  vec3 n = sampleScene(uv + vec2(0.0, uTexel.y));
  vec3 s = sampleScene(uv - vec2(0.0, uTexel.y));
  vec3 e = sampleScene(uv + vec2(uTexel.x, 0.0));
  vec3 w = sampleScene(uv - vec2(uTexel.x, 0.0));
  float lm = luma(m), ln = luma(n), ls = luma(s), le = luma(e), lw = luma(w);
  float range = max(max(max(ln, ls), max(le, lw)), lm) - min(min(min(ln, ls), min(le, lw)), lm);
  if (range < max(0.04, lm * 0.12)) return m;
  vec2 dir = vec2(-((ln + ls) - (le + lw)), (ln + le) - (ls + lw));
  dir = normalize(dir + 1e-5) * uTexel * 1.5;
  return (sampleScene(uv + dir * 0.5) + sampleScene(uv - dir * 0.5) + m * 2.0) * 0.25;
}
void main() {
  vec3 c = uFxaa ? fxaa(vUv) : sampleScene(vUv);
  if (uDof > 0.001 && uDofTaps > 0) c = dof(vUv, c);
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c += texture2D(tRays, vUv).rgb * uRays * uRayColor;
  c = aces(c * uExposure);
  // Gradação: sombras para o azul-marinho, altas luzes para o branco quente (por movimento).
  float l = luma(c);
  c = mix(c * uShadows, c * uHighlights, smoothstep(0.05, 0.85, l));
  c = mix(vec3(luma(c)), c, uSaturation);
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  vec3 srgb = toSrgb(clamp(c, 0.0, 1.0));
  float n = fract(sin(dot(vUv * 1000.0 + uTime * 61.7, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  gl_FragColor = vec4(srgb + n * uGrain, 1.0);
}`,sn=class{grade={exposure:1,bloom:.6,rays:0,rayColor:new h(1,.94,.82),shadows:new h(.92,.96,1.08),highlights:new h(1.06,1,.92),saturation:1,vignette:.35,grain:.018,dof:0,focus:10};light={uv:new w(.5,.7),visible:!1};gl;scene;maskRT;raysRT;downs=[];ups=[];quad;ortho=new f(-1,1,1,-1,0,1);mask;rays;down;up;composite;size=new w;time=0;constructor(e,t){this.gl=e;let n={type:s,format:c,depthBuffer:!1};this.scene=new l(4,4,{type:s,samples:t.msaa,depthTexture:new i(4,4)}),this.maskRT=new l(4,4,n),this.raysRT=new l(4,4,n);for(let e=0;e<t.bloomLevels;e++)this.downs.push(new l(4,4,n)),this.ups.push(new l(4,4,n));let r=(e,t)=>new E({vertexShader:en,fragmentShader:e,uniforms:t,depthTest:!1,depthWrite:!1});this.mask=r(tn,{tColor:{value:null},tDepth:{value:null}}),this.rays=r(nn,{tMask:{value:null},uLight:{value:this.light.uv},uDecay:{value:.965},uDensity:{value:.9},uSamples:{value:t.raySamples}}),this.down=r(rn,{tSrc:{value:null},uTexel:{value:new w},uThreshold:{value:.85},uKnee:{value:.5},uPrefilter:{value:!1}}),this.up=r(an,{tSrc:{value:null},tPrev:{value:null},uTexel:{value:new w}}),this.composite=r(on,{tColor:{value:null},tBloom:{value:null},tRays:{value:null},uBloom:{value:.6},uRays:{value:0},uRayColor:{value:this.grade.rayColor},uExposure:{value:1},uShadows:{value:this.grade.shadows},uHighlights:{value:this.grade.highlights},uSaturation:{value:1},uVignette:{value:.35},uGrain:{value:.018},uTime:{value:0},uTexel:{value:new w},uFxaa:{value:t.fxaa},tDepth:{value:null},uDof:{value:0},uDofTaps:{value:t.dofTaps},uFocus:{value:10},uClip:{value:new w(.1,500)}});let a=new P;a.setAttribute(`position`,new T(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3)),this.quad=new D(a,this.mask),this.quad.frustumCulled=!1}resize(){this.gl.getDrawingBufferSize(this.size);let e=Math.max(4,this.size.x),t=Math.max(4,this.size.y);if(this.scene.width===e&&this.scene.height===t)return;this.scene.setSize(e,t),this.scene.depthTexture.image.width=e,this.scene.depthTexture.image.height=t,this.maskRT.setSize(Math.ceil(e/2),Math.ceil(t/2)),this.raysRT.setSize(Math.ceil(e/2),Math.ceil(t/2));let n=e,r=t;for(let e=0;e<this.downs.length;e++)n=Math.max(2,Math.ceil(n/2)),r=Math.max(2,Math.ceil(r/2)),this.downs[e].setSize(n,r),this.ups[e].setSize(n,r);this.composite.uniforms.uTexel.value.set(1/e,1/t)}pass(e,t){this.quad.material=e,this.gl.setRenderTarget(t),this.gl.render(this.quad,this.ortho)}render(e,t,n){this.resize(),this.time+=n;let r=this.gl;r.setRenderTarget(this.scene),r.render(e,t);let i=this.scene.texture,a=this.grade.rays>.002&&this.light.visible&&this.rays.uniforms.uSamples.value>0;a&&(this.mask.uniforms.tColor.value=i,this.mask.uniforms.tDepth.value=this.scene.depthTexture,this.pass(this.mask,this.maskRT),this.rays.uniforms.tMask.value=this.maskRT.texture,this.pass(this.rays,this.raysRT));let o=i;for(let e=0;e<this.downs.length;e++){let t=this.downs[e];this.down.uniforms.tSrc.value=o,this.down.uniforms.uTexel.value.set(1/(e===0?this.scene.width:this.downs[e-1].width),1/(e===0?this.scene.height:this.downs[e-1].height)),this.down.uniforms.uPrefilter.value=e===0,this.pass(this.down,t),o=t.texture}let s=this.downs[this.downs.length-1].texture;for(let e=this.downs.length-2;e>=0;e--)this.up.uniforms.tSrc.value=s,this.up.uniforms.tPrev.value=this.downs[e].texture,this.up.uniforms.uTexel.value.set(1/this.downs[e+1].width,1/this.downs[e+1].height),this.pass(this.up,this.ups[e]),s=this.ups[e].texture;let c=this.composite.uniforms;c.tColor.value=i,c.tBloom.value=s,c.tRays.value=this.raysRT.texture,c.uBloom.value=this.grade.bloom,c.uRays.value=a?this.grade.rays:0,c.uExposure.value=this.grade.exposure,c.uSaturation.value=this.grade.saturation,c.uVignette.value=this.grade.vignette,c.uGrain.value=this.grade.grain,c.uTime.value=this.time,c.tDepth.value=this.scene.depthTexture,c.uDof.value=this.grade.dof,c.uFocus.value=this.grade.focus;let l=t;l.isPerspectiveCamera&&c.uClip.value.set(l.near,l.far),this.pass(this.composite,null)}setMsaa(e){this.scene.samples!==e&&(this.scene.samples=e,this.scene.dispose(),this.composite.uniforms.uFxaa.value=e===0)}setDofTaps(e){this.composite.uniforms.uDofTaps.value=e}setRaySamples(e){this.rays.uniforms.uSamples.value=e}dispose(){[this.scene,this.maskRT,this.raysRT,...this.downs,...this.ups].forEach(e=>e.dispose()),this.scene.depthTexture?.dispose(),[this.mask,this.rays,this.down,this.up,this.composite].forEach(e=>e.dispose()),this.quad.geometry.dispose()}},cn={human0:1,human1:1,great:.75,grazer:.55,strider:.55,crawler:.5,small:.6,fish:.32,bird:.34};function ln(e){let t=new P;return t.setAttribute(`position`,new T(e.positions,3)),t.setAttribute(`normal`,new T(e.normals,3)),t.setAttribute(`aAo`,new T(e.ao,1)),t.setIndex(new T(e.indices,1)),t.computeBoundingSphere(),t}function un(e,t){let n=new Map,r=new Map,i=!1,a=e=>{if(i)return;let t=ln(e);r.set(e.id,t),n.get(e.id)?.forEach(e=>e(t)),n.delete(e.id)},o=async e=>{for(let n of e){if(i)return;await new Promise(e=>setTimeout(e,0)),a(Ce(n,cn[n]*t))}},s=[],c=[e.filter((e,t)=>t%2==0),e.filter((e,t)=>t%2==1)];try{for(let e of c){if(!e.length)continue;let n=new Worker(new URL(`/site_bezalel/assets/sculpt.worker-BXL1OT7Z.js`,``+import.meta.url),{type:`module`,name:`bz-origin-sculpt`});n.onmessage=e=>{e.data.kind===`mesh`?a(e.data.mesh):console.warn(`[origem] escultura:`,e.data.message)},n.onerror=()=>{n.terminate(),o(e.filter(e=>!r.has(e)))};for(let r of e)n.postMessage({ids:[r],detail:cn[r]*t});s.push(n)}}catch{s.forEach(e=>e.terminate()),o(e)}return{get(e){let t=r.get(e);return t?Promise.resolve(t):new Promise(t=>n.set(e,[...n.get(e)??[],t]))},dispose(){i=!0,s.forEach(e=>e.terminate()),r.forEach(e=>e.dispose())}}}var dn=`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w;
}`,fn=`
${Ge}
${qe}
${Je}
uniform float uFirm;
uniform float uTime;
uniform float uMilky;
uniform int uCloudLayers;
varying vec3 vDir;
float cloudDensity(vec2 p, float cover) {
  float n = fbm5(p);
  return smoothstep(1.0 - cover, 1.0 - cover + 0.32, n);
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyColor(d);
  vec3 L = normalize(uLightDir);
  // A Via Láctea: uma faixa inclinada, com poeira escura no meio.
  if (uMilky > 0.002) {
    vec3 axis = normalize(vec3(0.35, 0.62, -0.7));
    float band = exp(-pow(dot(d, axis), 2.0) * 18.0);
    vec2 bp = vec2(atan(d.z, d.x) * 3.0, d.y * 6.0);
    float stars = fbm5(bp * 2.5) * band;
    float dust = smoothstep(0.45, 0.8, fbm5(bp * 1.4 + 9.0)) * band;
    col += (vec3(0.32, 0.36, 0.52) * stars * 1.6 - vec3(0.05, 0.05, 0.07) * dust) * uMilky * max(d.y + 0.15, 0.0);
  }
  // As águas de cima: três camadas com paralaxe, iluminadas pela direção da luz.
  if (uFirm > 0.002 && d.y > -0.02) {
    float cover = 0.3 + 0.07 * uFirm;
    vec3 acc = vec3(0.0);
    float trans = 1.0;
    for (int i = 0; i < 3; i++) {
      if (i >= uCloudLayers) break;
      if (trans < 0.03) break;
      float h = 1.0 + float(i) * 0.22;
      vec2 p = d.xz / max(d.y + 0.08, 0.06) * (0.55 / h) + vec2(uTime * 0.006 * h, uTime * 0.002);
      float dens = cloudDensity(p, cover) * smoothstep(-0.02, 0.18, d.y) * uFirm;
      // Sombra própria da nuvem: a densidade um pouco na direção da luz, com menos oitavas (só a forma
      // grande importa para o claro-escuro).
      float toward = smoothstep(1.0 - cover, 1.0 - cover + 0.32, fbm3(p + L.xz * 0.06));
      float lit = clamp(1.0 - (toward - dens) * 1.6, 0.25, 1.15);
      float silver = pow(max(dot(d, L), 0.0), 10.0) * (1.0 - dens) * 2.4;
      vec3 cc = mix(uSkyHorizon * 0.65, vec3(1.0, 0.96, 0.9), 0.55) * (0.22 + 0.9 * lit * uLightAmt) + uLightColor * silver * 0.25;
      cc = mix(cc, cc * vec3(1.05, 0.72, 0.52), clamp(uEvening + uWarm * 0.4, 0.0, 1.0) * 0.7);
      acc += cc * dens * trans * 0.7;
      trans *= 1.0 - dens * 0.7;
    }
    col = col * trans + acc * (1.0 - uNight * 0.85) * (1.0 - uDark * 0.95);
  }
  gl_FragColor = vec4(col, 1.0);
}`,pn=`
attribute vec2 aStar; // brilho, fase
uniform float uTime;
uniform float uPixel;
uniform float uShow;
varying float vA;
varying float vHue;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.9999;
  float tw = 0.7 + 0.3 * sin(uTime * (0.6 + aStar.y * 1.4) + aStar.y * 40.0);
  vA = aStar.x * tw * uShow;
  vHue = aStar.y;
  gl_PointSize = (1.0 + aStar.x * 2.6) * uPixel;
}`,mn=`
varying float vA;
varying float vHue;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c)) * vA;
  if (a < 0.01) discard;
  vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), step(0.82, vHue));
  gl_FragColor = vec4(tint * a * 1.6, a);
}`,hn=`
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy;
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99995;
}`,gn=`
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float disc = smoothstep(0.2, 0.185, r);
  float limb = disc * (0.62 + 0.38 * sqrt(max(0.0, 1.0 - pow(r / 0.2, 2.0))));
  float corona = pow(max(1.0 - r, 0.0), 6.0) * 0.6 + pow(max(1.0 - r, 0.0), 2.0) * 0.08;
  vec3 c = uColor * (limb * 14.0 + corona * 2.0) * uIntensity;
  gl_FragColor = vec4(c, (disc + corona) * uIntensity);
}`,_n=`
varying vec3 vN;
varying vec3 vLocal;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99994;
}`,vn=`
${Ge}
uniform vec3 uSunDir;
uniform float uIntensity;
varying vec3 vN;
varying vec3 vLocal;
void main() {
  vec3 p = normalize(vLocal);
  float maria = smoothstep(0.45, 0.7, fbm5(p.xy * 2.2 + p.z));
  float craters = smoothstep(0.62, 0.8, vnoise(p.xy * 9.0 + p.z * 4.0)) * 0.3;
  vec3 albedo = vec3(0.78, 0.8, 0.84) * (1.0 - maria * 0.35 - craters);
  float lit = smoothstep(-0.05, 0.25, dot(normalize(vN), normalize(uSunDir)));
  vec3 earthshine = vec3(0.03, 0.04, 0.06);
  gl_FragColor = vec4((albedo * lit * 2.4 + earthshine) * uIntensity, uIntensity);
}`;function yn(e,t,n,r,i,s){let c=new o,l=new E({vertexShader:dn,fragmentShader:fn,side:1,depthWrite:!1,uniforms:{...r,uFirm:{value:0},uTime:s,uMilky:{value:0},uCloudLayers:{value:n}}}),u=new D(new k(e,64,32),l);u.renderOrder=-10,u.frustumCulled=!1,c.add(u);let d=G(K(`sky.stars`)),f=new Float32Array(t*3),p=new Float32Array(t*2);for(let n=0;n<t;n++){let t=d()*1.9-.9,r=d()*Math.PI*2,i=Math.sqrt(1-t*t),a=e*.94;f.set([Math.cos(r)*i*a,Math.abs(t)*a*.95+a*.02,Math.sin(r)*i*a],n*3),p.set([d()**2.6,d()],n*2)}let m=new P;m.setAttribute(`position`,new T(f,3)),m.setAttribute(`aStar`,new T(p,2));let g=new E({vertexShader:pn,fragmentShader:mn,transparent:!0,depthWrite:!1,blending:2,uniforms:{uTime:s,uPixel:i,uShow:{value:0}}}),_=new a(m,g);_.frustumCulled=!1,_.renderOrder=-9,c.add(_);let v=new E({vertexShader:hn,fragmentShader:gn,transparent:!0,depthWrite:!1,blending:2,uniforms:{uColor:{value:new h(1,.93,.82)},uIntensity:{value:0}}}),y=new D(new ne(e*.2,e*.2),v);y.frustumCulled=!1,y.renderOrder=-8;let b=new E({vertexShader:_n,fragmentShader:vn,transparent:!0,depthWrite:!1,uniforms:{uSunDir:r.uLightDir,uIntensity:{value:0}}}),x=new D(new k(e*.022,48,32),b);return x.frustumCulled=!1,x.renderOrder=-8,c.add(y,x),{group:c,dome:l,stars:g,sun:y,moon:x,sunMat:v,moonMat:b,setStarCount(e){m.setDrawRange(0,Math.min(e,t))}}}var bn=`
uniform float uTime;
uniform float uCalm;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
vec3 gerstner(vec2 dir, float steep, float wl, float speed, vec3 p, inout vec3 tangent, inout vec3 binormal) {
  float k = 6.28318 / wl;
  float c = sqrt(9.8 / k) * speed;
  vec2 d = normalize(dir);
  float f = k * (dot(d, p.xz) - c * uTime);
  float a = steep / k;
  tangent += vec3(-d.x * d.x * steep * sin(f), d.x * steep * cos(f), -d.x * d.y * steep * sin(f));
  binormal += vec3(-d.x * d.y * steep * sin(f), d.y * steep * cos(f), -d.y * d.y * steep * sin(f));
  return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
}
void main() {
  vec3 w = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 grid = w;
  vec3 t = vec3(1.0, 0.0, 0.0);
  vec3 b = vec3(0.0, 0.0, 1.0);
  float amp = 1.0 - uCalm;
  vec3 off = vec3(0.0);
  off += gerstner(vec2(1.0, 0.25), 0.16 * amp, 34.0, 0.55, grid, t, b);
  off += gerstner(vec2(0.6, 0.8), 0.13 * amp, 21.0, 0.6, grid, t, b);
  off += gerstner(vec2(-0.3, 1.0), 0.1 * amp, 12.0, 0.7, grid, t, b);
  off += gerstner(vec2(0.9, -0.5), 0.08 * amp, 7.0, 0.8, grid, t, b);
  w += off;
  vCrest = off.y;
  vNormal = normalize(cross(b, t));
  vWorld = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,xn=`
${Ge}
${$e}
${rt}
uniform float uVisible;
uniform float uLife;
uniform float uLand;
uniform float uTime;
uniform float uFront;
uniform vec3 uFrontOrigin;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
float landNow(vec2 xz) {
  float h = fullHeight(xz);
  return h - (1.0 - uLand) * (h > 0.0 ? h + 4.5 : 1.8);
}
void main() {
  // Duas camadas de detalhe que andam em direções diferentes.
  vec2 uv1 = vWorld.xz * 0.35 + vec2(uTime * 0.05, uTime * 0.03);
  vec2 uv2 = vWorld.xz * 0.9 - vec2(uTime * 0.07, -uTime * 0.04);
  vec3 dn = vec3(vnoise(uv1) - vnoise(uv1 + 0.37), 0.0, vnoise(uv1 + 1.7) - vnoise(uv1 + 2.07)) * 0.5
          + vec3(vnoise(uv2) - vnoise(uv2 + 0.29), 0.0, vnoise(uv2 + 3.1) - vnoise(uv2 + 3.39)) * 0.35;
  vec3 n = normalize(vNormal + dn);
  vec3 V = normalize(cameraPosition - vWorld);
  bool below = cameraPosition.y < 0.0;
  if (below) {
    float caust = pow(vnoise(vWorld.xz * 0.6 + uTime * 0.25) * vnoise(vWorld.xz * 0.9 - uTime * 0.2), 0.8);
    vec3 roof = vec3(0.05, 0.2, 0.25) * (0.5 + 1.6 * caust) * (0.3 + 0.7 * uLightAmt) * (1.0 - uDark);
    gl_FragColor = vec4(roof + uLightColor * caust * 0.25 * (1.0 - uDark), 1.0);
    return;
  }
  float depth = max(0.0, -landNow(vWorld.xz));
  vec3 deep = vec3(0.004, 0.025, 0.05);
  vec3 shallow = vec3(0.02, 0.2, 0.22);
  vec3 body = mix(shallow, deep, smoothstep(0.0, 6.0, depth));
  body *= 0.35 + 0.65 * uLightAmt;
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 R = reflect(-V, n);
  vec3 refl = skyColor(vec3(R.x, abs(R.y), R.z));
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(n, H), 0.0), 520.0) * 4.0 + pow(max(dot(n, H), 0.0), 60.0) * 0.05;
  vec3 col = mix(body, refl * 0.8, fres * 0.8) + uLightColor * spec * (1.0 - uDark) * (1.0 - uNight * 0.6);
  // Espuma onde a água encontra a terra (e nas cristas mais altas).
  float shore = smoothstep(0.6, 0.0, depth) * step(0.001, uLand);
  float foamNoise = vnoise(vWorld.xz * 2.2 + uTime * 0.4);
  float foam = clamp(shore * smoothstep(0.35, 0.75, foamNoise + shore * 0.5) + smoothstep(0.12, 0.24, vCrest) * 0.25, 0.0, 1.0);
  col = mix(col, vec3(0.6, 0.65, 0.66) * (0.2 + 0.8 * uLightAmt), foam * 0.5);
  // Vida perto da superfície (cardumes): um cintilar sutil.
  col += vec3(0.25, 0.55, 0.6) * uLife * 0.04 * smoothstep(0.6, 0.92, vnoise(vWorld.xz * 0.12 + uTime * 0.04));
  // A frente de luz do v. 3.
  float ring = length(vWorld.xz - uFrontOrigin.xz);
  col += vec3(1.0, 0.92, 0.78) * smoothstep(8.0, 0.0, abs(ring - uFront)) * step(0.001, uFront) * 0.6 * (0.4 + spec);
  col = mix(col, vec3(0.0015, 0.002, 0.004), uDark * 0.9);
  col = applyFog(col * uExposure, vWorld);
  // Perto da praia, um pouco de transparência deixa ver a areia por baixo.
  float alpha = uVisible * mix(1.0, 0.85, smoothstep(0.8, 0.0, depth) * step(0.001, uLand));
  gl_FragColor = vec4(col, alpha);
}`;function Sn(e,t){let n=new ne(2,2,t,t),r=n.attributes.position;for(let t=0;t<r.count;t++){let n=r.getX(t),i=r.getY(t);r.setXY(t,Math.sign(n)*Math.abs(n)**2.2*(e/2),Math.sign(i)*Math.abs(i)**2.2*(e/2))}return n.rotateX(-Math.PI/2),n.computeBoundingSphere(),n}function Cn(t,n,r,i,a){let o=Sn(t,n),s=new E({vertexShader:bn,fragmentShader:xn,transparent:!0,side:2,uniforms:{...r,...i,uTime:a,uCalm:{value:.6},uVisible:{value:0},uLife:{value:0},uLand:{value:0},uFront:{value:0},uFrontOrigin:{value:new e(0,0,-30)}}}),c=new D(o,s);return c.position.set(-10,0,-20),c.renderOrder=1,{mesh:c,mat:s}}function wn(e){let t=e?.getExtension(`EXT_disjoint_timer_query_webgl2`),n=[],r=[],i=()=>{if(e&&t)for(;n.length;){let i=n[0];if(!e.getQueryParameter(i,e.QUERY_RESULT_AVAILABLE))break;n.shift(),e.getParameter(t.GPU_DISJOINT_EXT)||(r.push(Number(e.getQueryParameter(i,e.QUERY_RESULT))/1e6),r.length>60&&r.shift()),e.deleteQuery(i)}};return{begin(){if(!e||!t||n.length>8)return null;let r=e.createQuery();return r?(e.beginQuery(t.TIME_ELAPSED_EXT,r),r):null},end(r){e&&t&&(r&&(e.endQuery(t.TIME_ELAPSED_EXT),n.push(r)),i())},average(){return r.length?r.reduce((e,t)=>e+t,0)/r.length:null}}}var Tn=class extends Error{constructor(e){super(`WebGL por software (${e}): cena 3D desativada`),this.name=`SoftwareRendererError`}},En=new e(0,.47,-.88).normalize(),Dn=new e(0,16,-30),On=new h(.01,.07,.09),kn=new h(.02,.12,.13),An=[`low`,`medium`,`high`],jn=[`fish`,`great`,`bird`,`grazer`,`strider`,`crawler`,`small`,`human0`,`human1`];function Mn({canvas:t,quality:n,reducedMotion:i,allowSoftware:a=!1,debug:o=!1,adaptive:s=!1,onQualityChange:c,onReady:l,onContextLost:u}){let d=se[n],f=new M({canvas:t,antialias:!1,alpha:!1,powerPreference:`high-performance`,stencil:!1}),p=f.getContext(),m=p.getExtension(`WEBGL_debug_renderer_info`),v=String(m?p.getParameter(m.UNMASKED_RENDERER_WEBGL):p.getParameter(p.RENDERER));if(!a&&/swiftshader|llvmpipe|softpipe|software|basic render driver/i.test(v))throw f.dispose(),f.forceContextLoss(),new Tn(v);let y=n,b={value:Math.min(window.devicePixelRatio||1,d.dpr)};f.setPixelRatio(b.value),f.debug.checkShaderErrors=o,f.info.autoReset=!1,f.setClearColor(`#000000`,1);let x=new sn(f,{bloomLevels:d.bloomLevels,raySamples:d.raySamples,msaa:d.msaa,fxaa:d.msaa===0,dofTaps:d.dofTaps}),S=new _,C=new r(48,1,.1,d.far),w={value:0},T={uLightDir:{value:En.clone()},uLightColor:{value:new h(0,0,0)},uSkyZenith:{value:new h(`#060b18`)},uSkyHorizon:{value:new h(`#02040a`)},uDark:{value:1},uLightAmt:{value:0},uSunAmt:{value:0},uNight:{value:0},uEvening:{value:0},uWarm:{value:0},uFogDensity:{value:.012},uFogFalloff:{value:.06},uExposure:{value:1}},E=st(at(256),ot(8,[])),D=un(jn,d.sculpt),O=yn(d.far*.85,d.stars,d.cloudLayers,T,b,w),k=Cn(d.far*1.2,d.waterSegments,T,E,w),A=Ut(d.terrainSegments,T,E),j=kt({grass:d.grass,herbs:d.herbs,trees:d.trees},T,E,w);E.tCanopy.value.dispose(),E.tCanopy.value=ot(256,j.canopy);let N=Bt({fish:d.fish,birds:d.birds,animals:d.animals},T,E,w,D),ee=Kt(T,D),P=$t(d.particles,b,w);P.points.renderOrder=5;let te={ready:!1};Promise.all([N.ready,ee.ready]).then(()=>{te.ready=!0,Z()}),S.add(O.group,k.mesh,A.mesh,j.group,N.group,ee.group,P.points);let ne={sky:O.group,water:k.mesh,ground:A.mesh,flora:j.group,fauna:N.group,humanity:ee.group,particles:P.points,...j.layers},re=new Set,ce={...ie},le={...ie},ue={...ie},de=1,fe=1,pe=new h(`#060b18`),me=new h(`#02040a`),F=pe.clone(),I=me.clone(),he=pe.clone(),ge=me.clone(),L=0,_e=-1,R={pos:new e(...ut.void.pos),target:new e(...ut.void.target),fov:ut.void.fov},z={pos:R.pos.clone(),target:R.target.clone(),fov:R.fov},B={pos:R.pos.clone(),target:R.target.clone(),fov:R.fov},ve=ut.void,ye=0,V=0,H=0,U=0,W=1,be=1,xe={yaw:0,pitch:0},Se={yaw:0,pitch:0},Ce=1,G=1,K=0,q=0,we=0,Te=null;function Ee(e,t=!1){let n=t?1e-4:Math.max(.3,e.seconds);le={...ce},ue={...e.world},de=+!!t,fe=n,t&&(ce={...ue}),F.copy(pe),I.copy(me),he.set(e.palette.sky[0]),ge.set(e.palette.sky[1]),t&&(pe.copy(he),me.copy(ge)),R.pos.copy(B.pos),R.target.copy(B.target),R.fov=B.fov,ve=ut[e.shot],z.pos.set(...ve.pos),z.target.set(...ve.target),z.fov=ve.fov,ye=V,U=H,K=q,we=0,W=+!!t,be=i?Math.min(n,2.5):Math.max(n*1.15,3),t&&(B.pos.copy(z.pos),B.target.copy(z.target),B.fov=z.fov,V=ve.night??0,H=ve.perch??0),Se={yaw:0,pitch:0},P.goTo(e.formation,t),Ce=+!!t,G=Math.max(n*1.3,1.5),e.evening&&!t&&!i&&(_e=0),Z()}let De=new e,Oe=new e,J=new e,Y=new e,ke=new e,Ae=new e;function je(e){if(Te===null&&(w.value+=e*(i?.2:1)),de<1){de=Math.min(1,de+e/fe),ae(le,ue,oe(de),ce);let t=oe(de);pe.copy(F).lerp(he,t),me.copy(I).lerp(ge,t)}W<1&&(W=Math.min(1,W+e/be));let t=oe(W);B.pos.lerpVectors(R.pos,z.pos,t),B.target.lerpVectors(R.target,z.target,t),B.fov=R.fov+(z.fov-R.fov)*t;let n=R.pos.distanceTo(z.pos);B.pos.y+=Math.sin(t*Math.PI)*Math.min(12,n*.12),V=ye+((ve.night??0)-ye)*t,q=K+((ve.dof??0)-K)*t,W>=1&&!i&&Te===null&&(we+=e),H=U+((ve.perch??0)-U)*t,Ce<1&&(Ce=Math.min(1,Ce+e/G),P.setMix(Ce)),_e>=0&&(_e+=e/9,L=Math.sin(Math.min(1,_e)*Math.PI),_e>=1&&(_e=-1,L=0)),xe.yaw+=(Se.yaw-xe.yaw)*Math.min(1,e*3),xe.pitch+=(Se.pitch-xe.pitch)*Math.min(1,e*3),J.subVectors(B.pos,B.target),J.applyAxisAngle(g.DEFAULT_UP,xe.yaw);let r=i?0:Math.sin(w.value*.05)*.012;J.applyAxisAngle(g.DEFAULT_UP,r);let a=J.length()*(1-.06*(1-Math.exp(-we/25)));J.y+=xe.pitch*a*.6,J.setLength(a),C.position.copy(B.target).add(J),C.position.y>-2.4&&C.position.y<.25&&B.pos.y>.25&&(C.position.y=.25),C.lookAt(B.target),Math.abs(C.fov-B.fov)>.01&&(C.fov=B.fov,C.updateProjectionMatrix());let o=ce,s=.55+Math.sin(w.value*.01)*.25*o.seasons;De.set(Math.cos(s)*.5,Math.sin(s)*.75+.12,-.75).normalize(),Oe.copy(En).lerp(De,o.sun).normalize(),T.uLightDir.value.copy(Oe);let c=o.light*(1-o.darkness*.85)*(1-V*.85)*(1-L*.45);T.uLightColor.value.setRGB(1,.93+o.blessing*.02-L*.12,.82-o.blessing*.08-L*.25).multiplyScalar(.06+c*2.6+V*.12*o.moon);let l=C.position.y<0;l?(T.uSkyZenith.value.copy(On),T.uSkyHorizon.value.copy(kn)):(T.uSkyZenith.value.copy(pe),T.uSkyHorizon.value.copy(me)),T.uDark.value=o.darkness,T.uLightAmt.value=o.light,T.uSunAmt.value=o.sun*(1-V),T.uNight.value=V,T.uEvening.value=L,T.uWarm.value=o.blessing*.5+o.completion*.3,T.uFogDensity.value=l?.028:.0015+o.darkness*.01+o.hovering*.004*(1-o.light),T.uFogFalloff.value=l?0:.07;let u=O.dome.uniforms;u.uFirm.value=o.firmament,u.uMilky.value=o.stars*V,O.group.position.copy(C.position),O.stars.uniforms.uShow.value=o.stars*(.25+V*.75+L*.4),O.sun.position.copy(De).multiplyScalar(d.far*.75),O.sunMat.uniforms.uIntensity.value=o.sun*(1-V)*(1-L*.35),O.moon.position.set(-De.x,Math.max(.25,De.y*.8),-.9).normalize().multiplyScalar(d.far*.75),O.moonMat.uniforms.uIntensity.value=o.moon*(.35+V*.65);let f=k.mat.uniforms;f.uVisible.value=Math.min(1,o.waters*1.4),f.uLife.value=o.seaLife,f.uLand.value=o.land,f.uCalm.value=.75-o.firmament*.25-o.seaLife*.15,f.uFront.value=o.light>.002&&o.light<.995?o.light*150:0,k.mesh.visible=o.waters>.001,A.mat.uniforms.uLand.value=o.land,A.mat.uniforms.uGrass.value=o.grass,A.mat.uniforms.uTrees.value=o.trees,A.mesh.visible=o.land>.001,j.grass.uniforms.uGrow.value=o.grass,j.herbs.uniforms.uGrow.value=o.herbs,j.bark.uniforms.uGrow.value=o.trees,j.leaves.uniforms.uGrow.value=o.trees,j.fruit.uniforms.uGrow.value=o.fruit*o.trees,j.fruit.uniforms.uGlow.value=o.blessing*.6+(o.fruit>.95?.3:0),j.grass.uniforms.uTrees.value=o.trees,j.herbs.uniforms.uTrees.value=o.trees,j.group.visible=o.grass+o.herbs+o.trees>.001,j.group.visible&&j.update(C.position),N.fish.uniforms.uGrow.value=o.seaLife,N.great.mat.uniforms.uGrow.value=o.greatSeaCreatures,N.great.mesh.visible=o.greatSeaCreatures>.001,N.birds.uniforms.uGrow.value=o.birds,N.birds.uniforms.uPerch.value=H;let[p,m,h,_]=N.beasts;p.uniforms.uGrow.value=o.livestock,m.uniforms.uGrow.value=o.wildAnimals,h.uniforms.uGrow.value=o.creeping,_.uniforms.uGrow.value=o.wildAnimals,N.group.visible=o.seaLife+o.birds+o.livestock+o.wildAnimals+o.creeping+o.greatSeaCreatures>.001,N.group.visible&&N.update(w.value),ee.show.value=o.humanity,ee.warm.value=o.blessing,ee.group.visible=o.humanity>.001,P.mat.uniforms.uAttractor.value.set(Dn.x,Dn.y,Dn.z,.9*o.light*(1-o.firmament)*(1-o.land));let v=x.grade;o.sun>.5?Y.copy(C.position).addScaledVector(De,d.far*.7):Y.copy(Dn),C.getWorldDirection(ke),Ae.subVectors(Y,C.position).normalize(),Y.project(C),x.light.uv.set(Y.x*.5+.5,Y.y*.5+.5),x.light.visible=ke.dot(Ae)>.2&&Math.abs(Y.x)<1.6&&Math.abs(Y.y)<1.6;let y=o.light*(1-o.sun)*(1-o.firmament*.55)*(1-o.land*.6);v.rays=l?0:y*1.25+o.sun*.55*(1-V)*(1-L*.5)+o.blessing*.25,v.rayColor.setRGB(1,.93-L*.15,.8-L*.3),v.bloom=.45+o.darkness*.15+o.blessing*.2+V*.15,v.exposure=1+o.darkness*.35+V*.4,v.saturation=.82+o.light*.12+o.grass*.06-V*.2,v.vignette=.28+o.darkness*.25,v.dof=l?0:q,v.focus=C.position.distanceTo(B.target),v.shadows.setRGB(.9-o.blessing*.03,.95,1.08+V*.06),v.highlights.setRGB(1.05+o.blessing*.04,1,.92-o.blessing*.04)}let Me=0,X=0,Ne=!0,Pe=!0,Fe=!1,Ie=!1,Le=[],Re=wn(o?f.getContext():null);function Z(){Me||!Ne||Fe||(Me=requestAnimationFrame(Q))}function Q(e){Me=0;let t=X?Math.min(.1,(e-X)/1e3):1/60;X=e;let n=performance.now();je(t);for(let e of re){let t=ne[e];t&&(t.visible=!1)}f.info.reset();let r=Re.begin();re.has(`post`)?f.render(S,C):x.render(S,C,Te===null?t:0),Re.end(r),Le.push(performance.now()-n,t),Ue(t),Le.length>240&&Le.splice(0,2),Ie||(Ie=!0,l?.()),i&&de>=1&&W>=1&&Ce>=1&&_e<0&&Math.abs(xe.yaw-Se.yaw)<1e-4&&Math.abs(xe.pitch-Se.pitch)<1e-4?X=0:Z()}function ze(e){let t=An.indexOf(e)>An.indexOf(n)?n:e;y=t;let r=se[t];P.setCount(r.particles),O.setStarCount(r.stars),j.setDensity(r.grass/d.grass),N.setDensity(r.fish/d.fish),b.value=Math.min(window.devicePixelRatio||1,r.dpr),f.setPixelRatio(b.value),x.setRaySamples(Math.min(r.raySamples,d.raySamples)),x.setMsaa(Math.min(r.msaa,d.msaa)),x.setDofTaps(Math.min(r.dofTaps,d.dofTaps)),We()}let Be=0,Ve=0,He=0;function Ue(e){if(!s||re.size||Te!==null||(He+=e,He<4)||(Be+=e,Ve++,Be<3))return;let t=Ve/Be;Be=0,Ve=0;let n=An.indexOf(y);t<45&&n>0&&(ze(An[n-1]),c?.(y,t),He=0)}function We(){let e=t.clientWidth,n=t.clientHeight;e&&n&&(f.setSize(e,n,!1),C.aspect=e/n,C.updateProjectionMatrix(),Z())}function Ge(e){Ne=e,e?Z():Me&&(cancelAnimationFrame(Me),Me=0,X=0)}let Ke=e=>{e.preventDefault(),u?.()};t.addEventListener(`webglcontextlost`,Ke);let qe=()=>Ge(!document.hidden&&Pe);return document.addEventListener(`visibilitychange`,qe),We(),je(0),{show:Ee,look(e,t){Se={yaw:Math.max(-.5,Math.min(.5,Se.yaw-e*1.2)),pitch:Math.max(-.25,Math.min(.3,Se.pitch+t*.8))},Z()},resetLook(){Se={yaw:0,pitch:0},Z()},setVisible(e){Pe=e,Ge(e&&!document.hidden)},setQuality:ze,resize:We,stats(){let e=0,t=0;for(let n=0;n<Le.length;n+=2)e+=Le[n],t+=Le[n+1];let n=Le.length/2||1;return{fps:t>0?n/t:0,frameMs:e/n,particles:Math.min(se[y].particles,d.particles),quality:y,triangles:f.info.render.triangles,calls:f.info.render.calls,sculpted:te.ready,renderer:v,gpuMs:Re.average(),size:[f.domElement.width,f.domElement.height]}},hide(e){re.forEach(e=>ne[e]&&(ne[e].visible=!0)),re.clear(),e.forEach(e=>re.add(e)),Z()},freeze(e){Te=e,e!==null&&(w.value=e),Z()},dispose(){Fe=!0,Me&&cancelAnimationFrame(Me),t.removeEventListener(`webglcontextlost`,Ke),document.removeEventListener(`visibilitychange`,qe),S.traverse(e=>{let t=e;t.geometry?.dispose(),(Array.isArray(t.material)?t.material:t.material?[t.material]:[]).forEach(e=>e.dispose())}),x.dispose(),D.dispose(),E.tHeight.value.dispose(),E.tCanopy.value.dispose(),f.dispose()}}}export{Tn as SoftwareRendererError,Mn as createGenesisScene};