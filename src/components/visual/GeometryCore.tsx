import { useEffect, useRef } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { useDeviceProfile } from '@/hooks/useDeviceProfile';
import { cn } from '@/lib/cn';

type Vec3 = [number, number, number];

const PHI = (1 + Math.sqrt(5)) / 2;

/** Icosaedro unitário: 12 vértices, 30 arestas. */
function icosahedron(): { v: Vec3[]; e: Array<[number, number]> } {
  const raw: Vec3[] = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  const len = Math.hypot(1, PHI);
  const v = raw.map(([x, y, z]) => [x / len, y / len, z / len] as Vec3);
  const e: Array<[number, number]> = [];
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) {
      const a = v[i]!;
      const b = v[j]!;
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1.1) e.push([i, j]);
    }
  return { v, e };
}

function rotate([x, y, z]: Vec3, ax: number, ay: number): Vec3 {
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
}

/**
 * Núcleo geométrico: icosaedro em wireframe com um icosaedro interno em
 * contra-rotação, anéis orbitais e pulsos de luz percorrendo as arestas.
 * Projeção perspectiva feita à mão em Canvas 2D — sem three.js na home.
 */
export function GeometryCore({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { reducedMotion, theme } = usePreferences();
  const { tier, coarse } = useDeviceProfile();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { v, e } = icosahedron();
    const dpr = Math.min(window.devicePixelRatio || 1, tier === 'high' ? 2 : 1.5);
    const ink = theme === 'dark' ? '242,232,213' : '16,27,43';
    const gold = '199,168,106';
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let visible = true;
    let t = 0;
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    const pulses = e.map((_, i) => ({ edge: i, t: (i * 0.137) % 1, active: i % 5 === 0 }));

    function resize() {
      const r = canvas!.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(p: Vec3, scale: number): [number, number, number] {
      const depth = 3.2;
      const f = depth / (depth - p[2]);
      return [w / 2 + p[0] * scale * f, h / 2 + p[1] * scale * f, p[2]];
    }

    function frame(dt: number) {
      t += dt;
      tilt.x += (tilt.tx - tilt.x) * 0.04;
      tilt.y += (tilt.ty - tilt.y) * 0.04;
      ctx!.clearRect(0, 0, w, h);
      const size = Math.min(w, h);
      const R = size * 0.3;

      // Halo
      const halo = ctx!.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, size * 0.48);
      halo.addColorStop(0, `rgba(${gold},0.16)`);
      halo.addColorStop(0.5, `rgba(${gold},0.04)`);
      halo.addColorStop(1, 'transparent');
      ctx!.fillStyle = halo;
      ctx!.fillRect(0, 0, w, h);

      // Anéis orbitais
      for (let k = 0; k < 3; k++) {
        ctx!.save();
        ctx!.translate(w / 2, h / 2);
        ctx!.rotate(t * (0.05 + k * 0.03) * (k % 2 ? -1 : 1) + k);
        ctx!.strokeStyle = `rgba(${ink},${0.07 + k * 0.02})`;
        ctx!.lineWidth = 1;
        ctx!.setLineDash(k === 1 ? [2, 7] : []);
        ctx!.beginPath();
        ctx!.ellipse(0, 0, R * (1.45 + k * 0.22), R * (0.42 + k * 0.1), 0, 0, Math.PI * 2);
        ctx!.stroke();
        // satélite
        const a = t * (0.6 - k * 0.15) + k * 2;
        ctx!.fillStyle = `rgba(${gold},0.9)`;
        ctx!.beginPath();
        ctx!.arc(Math.cos(a) * R * (1.45 + k * 0.22), Math.sin(a) * R * (0.42 + k * 0.1), 2.2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }
      ctx!.setLineDash([]);

      const ax = 0.42 + tilt.y * 0.3 + Math.sin(t * 0.2) * 0.08;
      const ay = t * 0.18 + tilt.x * 0.4;

      const drawSolid = (scale: number, rx: number, ry: number, alpha: number, withPulses: boolean) => {
        const pts = v.map((p) => project(rotate(p, rx, ry), scale));
        for (let i = 0; i < e.length; i++) {
          const [a, b] = e[i]!;
          const pa = pts[a]!;
          const pb = pts[b]!;
          const depth = (pa[2] + pb[2]) / 2;
          const al = alpha * (0.35 + (depth + 1) * 0.42);
          ctx!.strokeStyle = `rgba(${ink},${al.toFixed(3)})`;
          ctx!.lineWidth = depth > 0 ? 1.2 : 0.7;
          ctx!.beginPath();
          ctx!.moveTo(pa[0], pa[1]);
          ctx!.lineTo(pb[0], pb[1]);
          ctx!.stroke();
        }
        if (withPulses) {
          for (const p of pulses) {
            if (!p.active) continue;
            p.t = (p.t + dt * 0.35) % 1;
            const [a, b] = e[p.edge]!;
            const pa = pts[a]!;
            const pb = pts[b]!;
            const x = pa[0] + (pb[0] - pa[0]) * p.t;
            const y = pa[1] + (pb[1] - pa[1]) * p.t;
            const g = ctx!.createRadialGradient(x, y, 0, x, y, 7);
            g.addColorStop(0, `rgba(${gold},0.95)`);
            g.addColorStop(1, 'transparent');
            ctx!.fillStyle = g;
            ctx!.beginPath();
            ctx!.arc(x, y, 7, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
        for (const p of pts) {
          const al = 0.35 + (p[2] + 1) * 0.3;
          ctx!.fillStyle = p[2] > 0.2 ? `rgba(${gold},${al.toFixed(3)})` : `rgba(${ink},${(al * 0.6).toFixed(3)})`;
          ctx!.beginPath();
          ctx!.arc(p[0], p[1], p[2] > 0 ? 2.4 : 1.4, 0, Math.PI * 2);
          ctx!.fill();
        }
      };

      drawSolid(R * 0.48, -ax * 1.3, -ay * 1.6, 0.4, false);
      drawSolid(R, ax, ay, 0.85, true);

      // núcleo
      const core = ctx!.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R * 0.22);
      core.addColorStop(0, `rgba(${gold},0.9)`);
      core.addColorStop(0.35, `rgba(${gold},0.25)`);
      core.addColorStop(1, 'transparent');
      ctx!.fillStyle = core;
      ctx!.beginPath();
      ctx!.arc(w / 2, h / 2, R * 0.22 * (1 + Math.sin(t * 2) * 0.06), 0, Math.PI * 2);
      ctx!.fill();
    }

    let last = performance.now();
    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame(dt);
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (running || reducedMotion || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    frame(0);
    start();
    const ro = new ResizeObserver(() => {
      resize();
      frame(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([en]) => {
      visible = !!en?.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    const onPointer = (ev: PointerEvent) => {
      if (coarse) return;
      tilt.tx = (ev.clientX / window.innerWidth - 0.5) * 2;
      tilt.ty = (ev.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [reducedMotion, theme, tier, coarse]);

  return <canvas ref={ref} aria-hidden className={cn('pointer-events-none size-full', className)} />;
}
