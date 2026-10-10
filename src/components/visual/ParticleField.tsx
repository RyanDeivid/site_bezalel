import { useEffect, useRef } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { useDeviceProfile } from '@/hooks/useDeviceProfile';
import { cn } from '@/lib/cn';

interface Node {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
}

interface Pulse {
  a: number;
  b: number;
  t: number;
  speed: number;
}

/** Gerador pseudoaleatório com semente: a composição é estável entre visitas. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rede de partículas conectadas por linhas, com pulsos dourados percorrendo
 * as conexões ("informação em circulação") e parallax suave pelo ponteiro.
 *
 * Desempenho: pausa fora da viewport e com a aba oculta; densidade e
 * resolução se ajustam ao dispositivo; com movimento reduzido desenha um
 * único quadro estático.
 */
export function ParticleField({ className, density = 1, seed = 7 }: { className?: string; density?: number; seed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { reducedMotion, theme } = usePreferences();
  const { tier, coarse } = useDeviceProfile();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rand = mulberry32(seed);
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#c7a86a';
    const lineRgb = theme === 'dark' ? '242,232,213' : '16,27,43';
    const dpr = Math.min(window.devicePixelRatio || 1, tier === 'high' ? 2 : 1.5);
    const tierFactor = tier === 'low' ? 0.45 : tier === 'medium' ? 0.7 : 1;

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let raf = 0;
    let running = false;
    let visible = true;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    function build() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(130, ((width * height) / 11000) * density * tierFactor));
      nodes = Array.from({ length: count }, () => ({
        x: rand() * width,
        y: rand() * height,
        z: 0.35 + rand() * 0.65,
        vx: (rand() - 0.5) * 0.18,
        vy: (rand() - 0.5) * 0.18,
      }));
      pulses = [];
    }

    const maxDist = () => Math.min(150, Math.max(90, width / 9));

    function draw(step: boolean) {
      ctx!.clearRect(0, 0, width, height);
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      const md = maxDist();
      const pos = nodes.map((n) => {
        if (step) {
          n.x += n.vx * n.z;
          n.y += n.vy * n.z;
          if (n.x < -20) n.x = width + 20;
          if (n.x > width + 20) n.x = -20;
          if (n.y < -20) n.y = height + 20;
          if (n.y > height + 20) n.y = -20;
        }
        return { x: n.x + pointer.x * 18 * n.z, y: n.y + pointer.y * 18 * n.z, z: n.z };
      });

      const edges: Array<[number, number, number]> = [];
      for (let i = 0; i < pos.length; i++) {
        const p = pos[i]!;
        for (let j = i + 1; j < pos.length; j++) {
          const q = pos[j]!;
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < md * md) {
            const alpha = (1 - Math.sqrt(d2) / md) * 0.22 * Math.min(p.z, q.z);
            ctx!.strokeStyle = `rgba(${lineRgb},${alpha.toFixed(3)})`;
            ctx!.lineWidth = 0.8;
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(q.x, q.y);
            ctx!.stroke();
            edges.push([i, j, alpha]);
          }
        }
      }

      for (const p of pos) {
        ctx!.fillStyle = `rgba(${lineRgb},${(0.25 + p.z * 0.45).toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 0.6 + p.z * 1.3, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (step) {
        if (pulses.length < (tier === 'low' ? 3 : 7) && edges.length && rand() < 0.06) {
          const e = edges[Math.floor(rand() * edges.length)]!;
          pulses.push({ a: e[0], b: e[1], t: 0, speed: 0.008 + rand() * 0.012 });
        }
        pulses = pulses.filter((pl) => (pl.t += pl.speed) < 1);
      }
      for (const pl of pulses) {
        const a = pos[pl.a];
        const b = pos[pl.b];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * pl.t;
        const y = a.y + (b.y - a.y) * pl.t;
        const g = ctx!.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, accent);
        g.addColorStop(1, 'transparent');
        ctx!.fillStyle = g;
        ctx!.globalAlpha = Math.sin(pl.t * Math.PI);
        ctx!.beginPath();
        ctx!.arc(x, y, 9, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }
    }

    function loop() {
      draw(true);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (running || reducedMotion || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    build();
    draw(false);
    start();

    const ro = new ResizeObserver(() => {
      build();
      draw(false);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    const onPointer = (e: PointerEvent) => {
      if (coarse) return;
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [reducedMotion, theme, tier, coarse, density, seed]);

  return <canvas ref={canvasRef} aria-hidden className={cn('pointer-events-none absolute inset-0 size-full', className)} />;
}
