import { useEffect, useRef, useState } from 'react';
import { groupBounds, type Constellation, type Star, type StarState } from '@/domain/tools/constellation';
import type { CategoryGroupId } from '@/types/domain';
import { STATE_COLOR } from './sky-colors';

interface Props {
  sky: Constellation;
  state: Map<string, StarState>;
  selected: string | null;
  group: CategoryGroupId | null;
  label: string;
  nameOf: (id: string) => string;
  groupName: (id: CategoryGroupId) => string;
  coursesLabel: (n: number) => string;
  onSelect: (id: string) => void;
  /** Estrela sob o ponteiro (no mapa ou num botão que aponta para ela). */
  hover: string | null;
  onHover: (id: string | null) => void;
}

/** Marca de uma estrela conforme o estado (formas distintas, não só cor). */
export function StarMark({ state, r, x = 0, y = 0 }: { state: StarState | undefined; r: number; x?: number; y?: number }) {
  if (state === 'have')
    return (
      <>
        <circle cx={x} cy={y} r={r + 4} fill={STATE_COLOR.have} fillOpacity={0.22} />
        <circle cx={x} cy={y} r={r} fill={STATE_COLOR.have} stroke="var(--surface)" strokeWidth={1.5} />
      </>
    );
  if (state === 'learning') return <circle cx={x} cy={y} r={r} fill="var(--surface)" stroke={STATE_COLOR.learning} strokeWidth={2.5} />;
  if (state === 'next') return <circle cx={x} cy={y} r={r} fill="var(--surface)" stroke={STATE_COLOR.next} strokeWidth={2} strokeDasharray="3 2.5" />;
  return <circle cx={x} cy={y} r={r} fill="var(--fg)" fillOpacity={0.55} />;
}

/**
 * O céu em SVG. As estrelas respondem a ponteiro (clique/toque e passar o
 * mouse); quem usa teclado ou leitor de tela escolhe pela lista abaixo do mapa,
 * que carrega a mesma informação — 104 paradas de Tab no mapa seriam um
 * labirinto. Com um tema escolhido, o quadro aproxima aquela constelação
 * (no celular, é o que deixa as estrelas grandes o bastante para o toque).
 */
export function SkyMap({ sky, state, selected, group, label, nameOf, groupName, coursesLabel, onSelect, hover, onHover }: Props) {
  const box = group ? groupBounds(sky, group) : ([0, 0, sky.width, sky.height] as const);
  // Largura real do desenho na tela: o texto é dimensionado para ~12 px de
  // verdade, com ou sem zoom, no celular e no desktop.
  const ref = useRef<SVGSVGElement>(null);
  const [px, setPx] = useState<number>(sky.width);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => entry && setPx(entry.contentRect.width || sky.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sky.width]);
  const k = box[2] / px;
  /** Nomes das constelações: menores que a dica no celular, para não cobrir as estrelas. */
  const kGroup = Math.min(k, (box[2] / sky.width) * 1.6);
  const byId = new Map(sky.stars.map((s) => [s.id, s]));
  const focus = hover ?? selected;
  const dim = (s: Star) => group !== null && s.group !== group;
  const tip = focus ? byId.get(focus) : undefined;

  const linkStyle = (a: string, b: string, courses: number) => {
    const w = 1 + 0.6 * (courses - 1);
    if (focus && (a === focus || b === focus)) return { stroke: 'var(--accent)', strokeOpacity: 0.9, strokeWidth: w + 0.6 };
    const sa = state.get(a);
    const sb = state.get(b);
    if (sa && sb && sa !== 'next' && sb !== 'next') return { stroke: STATE_COLOR[sa === 'have' && sb === 'have' ? 'have' : 'learning'], strokeOpacity: 0.6, strokeWidth: w };
    if ((sa === 'next' && sb && sb !== 'next') || (sb === 'next' && sa && sa !== 'next')) return { stroke: STATE_COLOR.next, strokeOpacity: 0.65, strokeWidth: w, strokeDasharray: '4 3' };
    return { stroke: 'var(--fg)', strokeOpacity: 0.13, strokeWidth: w };
  };

  return (
    <svg
      ref={ref}
      viewBox={box.join(' ')}
      className="w-full select-none"
      style={{ aspectRatio: `${sky.width} / ${sky.height}` }}
      role="img"
      aria-label={label}
      onPointerLeave={() => onHover(null)}
    >
      <g>
        {sky.links.map((l) => {
          const a = byId.get(l.a);
          const b = byId.get(l.b);
          if (!a || !b) return null;
          const faded = group !== null && a.group !== group && b.group !== group;
          return <line key={`${l.a}|${l.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...linkStyle(l.a, l.b, l.courses)} opacity={faded ? 0.25 : 1} style={{ transition: 'stroke-opacity 250ms, opacity 250ms' }} />;
        })}
      </g>
      <g>
        {sky.groups.map((g) => (
          <text
            key={g.id}
            x={g.x}
            y={g.y}
            textAnchor="middle"
            fill="var(--fg-muted)"
            opacity={group !== null && group !== g.id ? 0.35 : 1}
            style={{ font: `600 ${11 * kGroup}px var(--font-mono, monospace)`, letterSpacing: '0.12em', textTransform: 'uppercase' }}
          >
            {groupName(g.id)}
          </text>
        ))}
      </g>
      <g>
        {sky.stars.map((s) => {
          const st = state.get(s.id);
          return (
            <g
              key={s.id}
              data-star={s.id}
              opacity={dim(s) ? 0.2 : 1}
              style={{ cursor: 'pointer', transition: 'opacity 250ms' }}
              onPointerEnter={() => onHover(s.id)}
              onClick={() => onSelect(s.id)}
            >
              <circle cx={s.x} cy={s.y} r={Math.max(s.r + 5, 11)} fill="transparent" />
              {focus === s.id && <circle cx={s.x} cy={s.y} r={s.r + 6} fill="none" stroke="var(--accent)" strokeWidth={2} />}
              <StarMark state={st} r={s.r} x={s.x} y={s.y} />
            </g>
          );
        })}
      </g>
      <g aria-hidden style={{ pointerEvents: 'none' }}>
        {tip && <Tooltip star={tip} title={nameOf(tip.id)} detail={coursesLabel(tip.courseIds.length)} box={box} k={k} />}
      </g>
    </svg>
  );
}

function Tooltip({ star, title, detail, box, k }: { star: Star; title: string; detail: string; box: readonly [number, number, number, number]; k: number }) {
  const w = (Math.max(title.length, detail.length) * 6.8 + 20) * k;
  const h = 40 * k;
  const x = Math.min(Math.max(star.x - w / 2, box[0] + 4 * k), box[0] + box[2] - w - 4 * k);
  const below = star.y - star.r - h - 10 * k < box[1];
  const y = below ? star.y + star.r + 10 * k : star.y - star.r - h - 10 * k;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8 * k} fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth={k} />
      <text x={x + 10 * k} y={y + 17 * k} fill="var(--fg)" style={{ font: `600 ${12 * k}px var(--font-sans, sans-serif)` }}>
        {title}
      </text>
      <text x={x + 10 * k} y={y + 32 * k} fill="var(--fg-muted)" style={{ font: `400 ${11 * k}px var(--font-sans, sans-serif)` }}>
        {detail}
      </text>
    </g>
  );
}
