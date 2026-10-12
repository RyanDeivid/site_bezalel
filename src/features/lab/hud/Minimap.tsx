import { useEffect, useRef } from 'react';
import { useT } from '@/app/preferences-context';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import { ENTRANCE_ANGLE, LAB_RADIUS, PLAZA_RADIUS, RING_RADIUS, SECTOR_SIZE, STATIONS, type LabRuntime } from '../layout';

const SIZE = 148;

/** Minimapa 2D: lê a posição do visitante direto do runtime a cada quadro. */
export function Minimap({ runtime }: { runtime: LabRuntime }) {
  const m = useT();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = (SIZE / 2 - 8) / LAB_RADIUS;
    const c = SIZE / 2;
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = 'rgba(10,18,32,0.85)';
      ctx.beginPath();
      ctx.arc(c, c, LAB_RADIUS * scale + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(199,168,106,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Anel de circulação, entrada e praça da Central.
      ctx.strokeStyle = 'rgba(242,232,213,0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c, c, RING_RADIUS * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(ENTRANCE_ANGLE) * PLAZA_RADIUS * scale, c + Math.sin(ENTRANCE_ANGLE) * PLAZA_RADIUS * scale);
      ctx.lineTo(c + Math.cos(ENTRANCE_ANGLE) * LAB_RADIUS * scale, c + Math.sin(ENTRANCE_ANGLE) * LAB_RADIUS * scale);
      ctx.stroke();
      ctx.fillStyle = 'rgba(199,168,106,0.35)';
      ctx.beginPath();
      ctx.arc(c, c, PLAZA_RADIUS * scale * 0.6, 0, Math.PI * 2);
      ctx.fill();
      // Setores: hexágonos na cor do agente (cheios quando o visitante está neles).
      for (const s of STATIONS) {
        const on = runtime.near === s.id;
        ctx.strokeStyle = AGENT_HEX[s.id];
        ctx.fillStyle = AGENT_HEX[s.id];
        ctx.globalAlpha = on ? 0.9 : 0.6;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const a = s.angle + Math.PI / 6 + (k / 6) * Math.PI * 2;
          const x = c + s.x * scale + Math.cos(a) * SECTOR_SIZE * scale;
          const y = c + s.z * scale + Math.sin(a) * SECTOR_SIZE * scale;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = on ? 0.45 : 0.16;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const px = c + runtime.player.x * scale;
      const pz = c + runtime.player.z * scale;
      const h = runtime.player.heading;
      ctx.fillStyle = '#f2e8d5';
      ctx.beginPath();
      ctx.moveTo(px + Math.sin(h) * 7, pz + Math.cos(h) * 7);
      ctx.lineTo(px + Math.sin(h + 2.5) * 5, pz + Math.cos(h + 2.5) * 5);
      ctx.lineTo(px + Math.sin(h - 2.5) * 5, pz + Math.cos(h - 2.5) * 5);
      ctx.closePath();
      ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [runtime]);

  return <canvas ref={ref} role="img" aria-label={m.lab.hud.minimap} style={{ width: SIZE, height: SIZE }} className="rounded-full" />;
}
