import { cn } from '@/lib/cn';

/**
 * Fluxos luminosos em SVG: linhas curvas com segmentos de luz. A "vida" vem
 * da respiração de opacidade do <svg> inteiro, que o compositor anima sem a
 * thread principal (traços com stroke-dashoffset animado eram repintados a
 * cada quadro). Decorativo.
 */
export function DataStreams({ className, variant = 'wide' }: { className?: string; variant?: 'wide' | 'vertical' }) {
  const paths =
    variant === 'wide'
      ? [
          'M-20 120 C 220 40, 420 200, 640 110 S 1040 30, 1260 140',
          'M-20 210 C 260 150, 380 300, 660 220 S 1020 120, 1260 230',
          'M-20 300 C 200 260, 480 360, 700 300 S 1060 220, 1260 320',
        ]
      : ['M60 -20 C 20 160, 120 260, 60 420 S 40 680, 80 820', 'M140 -20 C 180 180, 90 300, 150 460 S 170 700, 120 820'];
  const viewBox = variant === 'wide' ? '0 0 1240 400' : '0 0 200 800';
  return (
    <svg
      aria-hidden
      viewBox={viewBox}
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
      style={{ animation: 'bz-glow-breathe 6s var(--ease-in-out) infinite' }}
    >
      <defs>
        <linearGradient id="bz-stream" x1="0" x2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {paths.map((d) => (
        <g key={d}>
          <path d={d} fill="none" stroke="var(--fg)" strokeOpacity="0.06" strokeWidth="1" />
          <path
            d={d}
            fill="none"
            stroke="url(#bz-stream)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="60 180"
          />
        </g>
      ))}
    </svg>
  );
}
