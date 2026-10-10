import { Box, Check } from 'lucide-react';
import { useT } from '@/app/preferences-context';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/visual/Reveal';
import type { AgentId } from '@/types/domain';

/** Projeção isométrica simples: (x, y) do plano → tela. */
const iso = (x: number, y: number, z = 0) => ({ x: 300 + (x - y) * 0.866 * 26, y: 210 + (x + y) * 0.5 * 26 - z * 26 });

const STATIONS: Array<{ id: AgentId; x: number; y: number }> = [
  { id: 'scout', x: 0, y: -6 },
  { id: 'verifier', x: 5.7, y: -1.9 },
  { id: 'atlas', x: 3.5, y: 4.9 },
  { id: 'trend', x: -3.5, y: 4.9 },
  { id: 'sol', x: -5.7, y: -1.9 },
];

function Prism({ x, y, w, d, h, top, side, front }: { x: number; y: number; w: number; d: number; h: number; top: string; side: string; front: string }) {
  const p = (dx: number, dy: number, dz: number) => iso(x + dx, y + dy, dz);
  const pts = (arr: Array<{ x: number; y: number }>) => arr.map((q) => `${q.x},${q.y}`).join(' ');
  return (
    <g>
      <polygon points={pts([p(w, 0, 0), p(w, d, 0), p(w, d, h), p(w, 0, h)])} fill={side} />
      <polygon points={pts([p(0, d, 0), p(w, d, 0), p(w, d, h), p(0, d, h)])} fill={front} />
      <polygon points={pts([p(0, 0, h), p(w, 0, h), p(w, d, h), p(0, d, h)])} fill={top} />
    </g>
  );
}

/** Prévia ilustrada (SVG isométrico) do laboratório — leve, sem WebGL na home. */
export function LabPreviewSection() {
  const m = useT();
  const l = m.home.lab;
  const floor = [iso(-8, -8), iso(8, -8), iso(8, 8), iso(-8, 8)].map((q) => `${q.x},${q.y}`).join(' ');
  const center = iso(0, 0);

  return (
    <section className="container-page grid grid-cols-1 items-center gap-14 py-20 md:py-28 lg:grid-cols-12">
      <Reveal className="lg:col-span-5">
        <p className="eyebrow">{l.eyebrow}</p>
        <h2 className="text-title mt-4">{l.title}</h2>
        <p className="mt-4 text-fg-muted">{l.lead}</p>
        <ul className="mt-6 space-y-2.5">
          {l.features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-fg-muted">
              <Check aria-hidden className="mt-1 size-4 shrink-0 text-accent-text" />
              {f}
            </li>
          ))}
        </ul>
        <ButtonLink to="/lab" size="lg" className="mt-8" iconLeft={<Box className="size-4" />}>
          {l.cta}
        </ButtonLink>
      </Reveal>
      <Reveal delay={120} className="relative lg:col-span-7">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-bg-abyss to-bg-deep">
          <svg viewBox="0 0 600 440" className="w-full" aria-hidden>
            <polygon points={floor} fill="var(--surface)" stroke="var(--line-strong)" />
            {Array.from({ length: 15 }, (_, i) => i - 7).map((k) => {
              const a = iso(k, -8);
              const b = iso(k, 8);
              const c = iso(-8, k);
              const d = iso(8, k);
              return (
                <g key={k} stroke="var(--fg)" strokeOpacity="0.05">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
                </g>
              );
            })}
            {STATIONS.map((s) => {
              const p = iso(s.x + 0.6, s.y + 0.6, 0.9);
              return (
                <path
                  key={`f-${s.id}`}
                  d={`M${center.x},${center.y - 30} Q ${(center.x + p.x) / 2},${Math.min(center.y, p.y) - 60} ${p.x},${p.y}`}
                  fill="none"
                  stroke={AGENT_HEX[s.id]}
                  strokeWidth="1.5"
                  strokeOpacity="0.7"
                  strokeDasharray="5 9"
                  style={{ animation: 'bz-flow 5s linear infinite reverse' }}
                />
              );
            })}
            <ellipse cx={center.x} cy={center.y} rx="70" ry="40" fill="none" stroke="var(--accent)" strokeOpacity="0.5" />
            <Prism x={-1} y={-1} w={2} d={2} h={0.8} top="var(--surface-3)" side="#1a2a44" front="#14223a" />
            <ellipse cx={center.x} cy={center.y - 52} rx="34" ry="12" fill="none" stroke="var(--accent)" strokeWidth="1.5">
              <animate attributeName="ry" values="12;15;12" dur="4s" repeatCount="indefinite" />
            </ellipse>
            <circle cx={center.x} cy={center.y - 52} r="5" fill="var(--accent)">
              <animate attributeName="r" values="4;6;4" dur="2.4s" repeatCount="indefinite" />
            </circle>
            {STATIONS.map((s, i) => {
              const top = iso(s.x + 0.6, s.y + 0.6, 1.6);
              return (
                <g key={s.id}>
                  <Prism x={s.x} y={s.y} w={1.2} d={1.2} h={0.9} top="var(--surface-3)" side="#1e3149" front="#172840" />
                  <rect x={top.x - 16} y={top.y - 14} width="32" height="20" rx="2" fill="#0a1220" stroke={AGENT_HEX[s.id]} strokeWidth="1.2" />
                  <rect x={top.x - 11} y={top.y - 9} width="22" height="2.5" fill={AGENT_HEX[s.id]} opacity="0.8">
                    <animate attributeName="width" values="8;22;14;22" dur={`${3 + i * 0.4}s`} repeatCount="indefinite" />
                  </rect>
                  <rect x={top.x - 11} y={top.y - 4} width="16" height="2" fill={AGENT_HEX[s.id]} opacity="0.4" />
                  <circle cx={top.x + 22} cy={top.y + 8} r="5" fill={AGENT_HEX[s.id]}>
                    <animate attributeName="cy" values={`${top.y + 8};${top.y + 4};${top.y + 8}`} dur="2.6s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-deep to-transparent" />
        </div>
      </Reveal>
    </section>
  );
}
