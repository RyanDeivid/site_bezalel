import { useT } from '@/app/preferences-context';
import type { PublicationStatus } from '@/types/domain';

/** Posições fixas dos estados no diagrama (viewBox 760×260). */
const POS: Record<PublicationStatus, { x: number; y: number }> = {
  found: { x: 70, y: 70 },
  validating: { x: 240, y: 70 },
  approved: { x: 410, y: 70 },
  published: { x: 580, y: 70 },
  rejected: { x: 325, y: 200 },
  outdated: { x: 690, y: 200 },
  removed: { x: 500, y: 200 },
};

const COLOR: Record<PublicationStatus, string> = {
  found: 'var(--info)',
  validating: 'var(--warn)',
  approved: 'var(--accent)',
  published: 'var(--ok)',
  rejected: 'var(--danger)',
  outdated: 'var(--warn)',
  removed: 'var(--fg-subtle)',
};

/** Diagrama da máquina de estados gerado a partir da tabela de transições real do código. */
export function StateMachineDiagram({ transitions }: { transitions: Record<PublicationStatus, readonly PublicationStatus[]> }) {
  const m = useT();
  const edges = (Object.keys(transitions) as PublicationStatus[]).flatMap((from) => transitions[from].map((to) => [from, to] as const));
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-bg-deep p-4">
      <svg viewBox="0 0 760 260" className="min-w-[640px]" role="img" aria-label={edges.map(([a, b]) => `${m.enums.publicationStatus[a]} → ${m.enums.publicationStatus[b]}`).join('; ')}>
        <defs>
          <marker id="bz-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--fg-subtle)" />
          </marker>
        </defs>
        {edges.map(([from, to]) => {
          const a = POS[from];
          const b = POS[to];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          // Curva leve para separar idas e voltas entre o mesmo par de estados.
          const reverse = transitions[to].includes(from);
          const off = reverse ? 14 : 0;
          const sx = a.x + ux * 46 - uy * off;
          const sy = a.y + uy * 22 + ux * off;
          const ex = b.x - ux * 46 - uy * off;
          const ey = b.y - uy * 22 + ux * off;
          return <line key={`${from}-${to}`} x1={sx} y1={sy} x2={ex} y2={ey} stroke="var(--fg-subtle)" strokeOpacity="0.6" strokeWidth="1.3" markerEnd="url(#bz-arrow)" />;
        })}
        {(Object.keys(POS) as PublicationStatus[]).map((s) => (
          <g key={s}>
            <rect x={POS[s].x - 58} y={POS[s].y - 18} width="116" height="36" rx="18" fill="var(--surface)" stroke={COLOR[s]} strokeWidth="1.5" />
            <text x={POS[s].x} y={POS[s].y + 4.5} textAnchor="middle" fontSize="13" fill="var(--fg)" fontFamily="var(--font-sans)">
              {m.enums.publicationStatus[s]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
