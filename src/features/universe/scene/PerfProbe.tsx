import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { postFor } from './bloom';

/**
 * Sonda de desempenho para os testes e para medir a cena (só existe com
 * `localStorage['bz-universe-debug'] = '1'`): expõe em `window.__bzUniverseGl`
 * as contagens do renderer (chamadas de desenho, triângulos, texturas,
 * programas), o tempo dos últimos quadros — o total, o de CPU (lógica do jogo
 * + envio dos comandos de desenho) e, onde o navegador expõe o cronômetro da
 * placa de vídeo, o de GPU — e chaves para ligar e desligar partes da cena
 * (grupos com `name`), as sombras e a resolução. Assim cada custo é medido
 * isolado, no aparelho real, e dá para saber quem segura o quadro.
 */
export interface PerfApi {
  info: () => { calls: number; triangles: number; geometries: number; textures: number; programs: number; dpr: number; width: number; height: number; gpuTimer: boolean; /** Escala da resolução dinâmica (1 sem brilho). */ scale: number };
  /** Média, p95 e pior tempo de quadro (ms) dos últimos ~2 s; `cpu`/`render`/`gpu` são médias. */
  frames: () => { avg: number; p95: number; worst: number; fps: number; samples: number; cpu: number; render: number; gpu: number | null };
  setVisible: (name: string, visible: boolean) => boolean;
  setShadows: (on: boolean) => void;
  setDpr: (dpr: number) => void;
  /**
   * Materiais usados em combinações que pedem shaders diferentes (instanciado ou não, com cor por
   * instância ou não, recebe sombra ou não). O three guarda o estado por material: cada alternância
   * no mesmo quadro o faz recalcular o programa — custo de CPU a cada quadro. Deve vir vazio.
   */
  materialConflicts: () => string[];
  /** Programas de shader compilados (nome do material e um trecho da chave) — para achar o que compila em pleno jogo. */
  programs: () => string[];
  /** Passa a anotar quem é desenhado na passada de sombras com um material de profundidade "com textura" (variante própria). */
  watchShadowVariants: () => string[];
  /** A cena (só para depurar nos testes). */
  scene: () => THREE.Scene;
  /** Malhas visíveis (camada 0) dentro de um grupo, agrupadas por tipo — para achar o que ainda custa chamadas. */
  meshesIn: (name: string) => string[];
}

const N = 120;
const push = (a: number[], v: number) => {
  a.push(v);
  if (a.length > N) a.shift();
};
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

export function PerfProbe() {
  const { gl, scene, setDpr } = useThree();
  const samples = useRef({ frame: [] as number[], cpu: [] as number[], render: [] as number[], gpu: [] as number[], start: 0, renderMs: 0, lastEnd: 0, calls: 0, tris: 0, frameCalls: 0, frameTris: 0, tick: null as null | (() => void) });
  // Prioridade negativa: roda antes de todos os useFrame da cena. Fecha o quadro anterior (CPU até o
  // último desenho dele — com brilho há várias passadas por quadro) e marca o início do novo.
  useFrame((_, dt) => {
    const s = samples.current;
    if (s.start && s.lastEnd > s.start) {
      push(s.cpu, s.lastEnd - s.start);
      push(s.render, s.renderMs);
    }
    s.renderMs = 0;
    // Chamadas e triângulos do quadro inteiro (com brilho, a soma de todas as passadas).
    s.frameCalls = s.calls;
    s.frameTris = s.tris;
    s.calls = 0;
    s.tris = 0;
    s.tick?.();
    push(s.frame, dt * 1000);
    s.start = performance.now();
  }, -1000);
  useEffect(() => {
    const s = samples.current;
    const ctx = gl.getContext() as WebGL2RenderingContext;
    const timer = ctx.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
    const pending: WebGLQuery[] = [];
    let open: WebGLQuery | null = null;
    // Uma consulta de tempo da GPU por quadro inteiro (de um início de quadro ao seguinte).
    s.tick = () => {
      if (!timer) return;
      if (open) {
        ctx.endQuery(timer.TIME_ELAPSED_EXT);
        pending.push(open);
        open = null;
      }
      while (pending.length && ctx.getQueryParameter(pending[0]!, ctx.QUERY_RESULT_AVAILABLE)) {
        const done = pending.shift()!;
        if (!ctx.getParameter(timer.GPU_DISJOINT_EXT)) push(s.gpu, ctx.getQueryParameter(done, ctx.QUERY_RESULT) / 1e6);
        ctx.deleteQuery(done);
      }
      if (pending.length < 4) {
        open = ctx.createQuery();
        if (open) ctx.beginQuery(timer.TIME_ELAPSED_EXT, open);
      }
    };
    const original = gl.render.bind(gl);
    gl.render = (sc, cam) => {
      const t0 = performance.now();
      original(sc, cam);
      const t1 = performance.now();
      s.calls += gl.info.render.calls;
      s.tris += gl.info.render.triangles;
      s.renderMs += t1 - t0;
      s.lastEnd = t1;
    };
    const api: PerfApi = {
      info: () => {
        const canvas = gl.domElement;
        return { calls: s.frameCalls, triangles: s.frameTris, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, programs: gl.info.programs?.length ?? 0, dpr: gl.getPixelRatio(), width: canvas.width, height: canvas.height, gpuTimer: !!timer, scale: postFor(gl)?.scale ?? 1 };
      },
      frames: () => {
        const f = [...s.frame].sort((a, b) => a - b);
        const avg = mean(f);
        return { avg, p95: f[Math.floor(f.length * 0.95)] ?? 0, worst: f[f.length - 1] ?? 0, fps: avg > 0 ? 1000 / avg : 0, samples: f.length, cpu: mean(s.cpu), render: mean(s.render), gpu: s.gpu.length ? mean(s.gpu) : null };
      },
      setVisible: (name, visible) => {
        const o = scene.getObjectByName(name);
        if (o) o.visible = visible;
        return !!o;
      },
      setShadows: (on) => {
        gl.shadowMap.enabled = on;
        scene.traverse((o) => {
          const m = (o as { material?: { needsUpdate: boolean } | Array<{ needsUpdate: boolean }> }).material;
          (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => (x.needsUpdate = true));
        });
      },
      setDpr: (dpr) => setDpr(dpr),
      scene: () => scene,
      watchShadowVariants: () => {
        const seen: string[] = [];
        scene.traverse((o) => {
          o.onBeforeShadow = (_r, obj, _c, _sc, _g, depth) => {
            const d = depth as unknown as { map?: unknown; alphaMap?: unknown };
            if (d.map || d.alphaMap) {
              const m = (obj as unknown as { material: { type: string; name: string; alphaTest: number; map: unknown } }).material;
              const k = `${obj.type} "${obj.name}" ${m.type} alphaTest=${m.alphaTest} pai=${obj.parent?.type}/${obj.parent?.name}`;
              if (!seen.includes(k)) seen.push(k);
            }
          };
        });
        return seen;
      },
      programs: () => (gl.info.programs ?? []).map((p) => `${p.name} #${p.id} ${p.cacheKey as string}`),
      meshesIn: (name: string) => {
        const root = scene.getObjectByName(name);
        const out = new Map<string, number>();
        root?.traverse((o) => {
          const m = o as unknown as { isMesh?: boolean; isInstancedMesh?: boolean; visible: boolean; layers: { mask: number }; castShadow: boolean; material: { type: string; transparent: boolean } };
          if (!m.isMesh || !(m.layers.mask & 1)) return;
          let v: { visible: boolean; parent: unknown } | null = m as unknown as { visible: boolean; parent: unknown };
          while (v) {
            if (!v.visible) return;
            v = v.parent as typeof v;
          }
          const k = `${m.isInstancedMesh ? 'inst ' : ''}${m.material.type}${m.material.transparent ? ' transp' : ''}${m.castShadow ? ' sombra' : ''} ${o.name}`;
          out.set(k, (out.get(k) ?? 0) + 1);
        });
        return [...out].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n}× ${k}`);
      },
      materialConflicts: () => {
        const uses = new Map<string, Set<string>>();
        scene.traverse((o) => {
          const mesh = o as unknown as { isMesh?: boolean; isInstancedMesh?: boolean; instanceColor?: unknown; receiveShadow: boolean; material?: { uuid: string; name: string; type: string } | Array<{ uuid: string; name: string; type: string }> };
          if (!mesh.isMesh || !mesh.material) return;
          const sig = `${mesh.isInstancedMesh ? 'inst' : 'mesh'}${mesh.instanceColor ? '+cor' : ''}${mesh.receiveShadow ? '+recebe' : ''}`;
          for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const k = `${m.type} ${m.name || m.uuid.slice(0, 8)}`;
            uses.set(k, (uses.get(k) ?? new Set()).add(sig));
          }
        });
        return [...uses].filter(([, v]) => v.size > 1).map(([k, v]) => `${k}: ${[...v].join(' / ')}`);
      },
    };
    const w = window as unknown as { __bzUniverseGl?: PerfApi };
    w.__bzUniverseGl = api;
    return () => {
      gl.render = original;
      s.tick = null;
      if (open && timer) ctx.endQuery(timer.TIME_ELAPSED_EXT);
      delete w.__bzUniverseGl;
    };
  }, [gl, scene, setDpr]);
  return null;
}
