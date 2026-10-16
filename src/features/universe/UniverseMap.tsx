import { usePreferences } from '@/app/preferences-context';
import { universeContent } from './universe-content';
import { blockBounds, BUILDINGS, DISTRICTS, PLACES, PLAZA_RADIUS, ROAD_WIDTH, STREET_LINES, towerSolid, type TowerSpec } from './world/city';

const HALF = 150;
const LAWN = new Set(DISTRICTS.map((d) => d.block.join(',')));

/**
 * Planta da cidade em SVG, gerada dos mesmos dados da cena 3D (ruas, quadras,
 * edifícios, praça e helipontos). Cada local é um link para o cartão dele
 * logo abaixo do mapa.
 */
export function UniverseMap({ towers }: { towers: TowerSpec[] }) {
  const { locale } = usePreferences();
  const t = universeContent[locale];
  return (
    <svg viewBox={`${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`} className="w-full" role="group" aria-label={t.map.label}>
      <rect x={-HALF} y={-HALF} width={HALF * 2} height={HALF * 2} fill="var(--bg-abyss)" />
      {[0, 1, 2].flatMap((bx) =>
        [0, 1, 2].map((bz) => {
          const b = blockBounds(bx, bz);
          return (
            <rect
              key={`${bx},${bz}`}
              x={b.minX}
              y={b.minZ}
              width={b.maxX - b.minX}
              height={b.maxZ - b.minZ}
              rx={2}
              fill={LAWN.has(`${bx},${bz}`) ? 'color-mix(in srgb, var(--ok) 14%, var(--surface))' : 'var(--surface)'}
              stroke="var(--line)"
              strokeWidth={0.6}
            />
          );
        }),
      )}
      <g aria-hidden>
        {STREET_LINES.map((v) => (
          <g key={v}>
            <rect x={STREET_LINES[0] - ROAD_WIDTH / 2} y={v - ROAD_WIDTH / 2} width={STREET_LINES[3] - STREET_LINES[0] + ROAD_WIDTH} height={ROAD_WIDTH} fill="var(--surface-2)" />
            <rect x={v - ROAD_WIDTH / 2} y={STREET_LINES[0] - ROAD_WIDTH / 2} width={ROAD_WIDTH} height={STREET_LINES[3] - STREET_LINES[0] + ROAD_WIDTH} fill="var(--surface-2)" />
          </g>
        ))}
        {STREET_LINES.map((v) => (
          <g key={`l${v}`} stroke="var(--accent)" strokeOpacity={0.5} strokeWidth={0.5} strokeDasharray="3 3">
            <line x1={STREET_LINES[0]} y1={v} x2={STREET_LINES[3]} y2={v} />
            <line x1={v} y1={STREET_LINES[0]} x2={v} y2={STREET_LINES[3]} />
          </g>
        ))}
      </g>
      <circle cx={0} cy={0} r={PLAZA_RADIUS} fill="var(--surface-2)" stroke="var(--accent)" strokeOpacity={0.7} strokeWidth={0.8} />
      <circle cx={0} cy={0} r={11} fill="none" stroke="var(--info, #3987e5)" strokeOpacity={0.5} strokeWidth={3} />
      {towers.map((tw, i) => {
        const s = towerSolid(tw);
        return <rect key={i} x={s.minX} y={s.minZ} width={s.maxX - s.minX} height={s.maxZ - s.minZ} fill="var(--line-strong)" opacity={0.45} />;
      })}
      {BUILDINGS.flatMap((b) =>
        b.solids.map((s, i) => (
          <rect key={`${b.id}${i}`} x={s.minX} y={s.minZ} width={s.maxX - s.minX} height={s.maxZ - s.minZ} rx={1} fill="var(--accent)" fillOpacity={0.12 + i * 0.12} stroke="var(--accent)" strokeWidth={0.6} />
        )),
      )}
      {PLACES.map((p) => (
        <a key={p.id} href={`#universe-${p.id}`} aria-label={t.places[p.id].name}>
          <circle cx={p.pad.x} cy={p.pad.z} r={5} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.2} />
          <path d={`M ${p.pad.x} ${p.pad.z - 2} L ${p.pad.x + 2} ${p.pad.z} L ${p.pad.x} ${p.pad.z + 2} L ${p.pad.x - 2} ${p.pad.z} Z`} fill="var(--accent)" />
          <text x={p.pad.x} y={p.pad.z + 11} textAnchor="middle" fill="var(--fg)" style={{ font: '600 6.5px var(--font-sans)' }} paintOrder="stroke" stroke="var(--bg)" strokeWidth={2}>
            {t.places[p.id].name}
          </text>
        </a>
      ))}
    </svg>
  );
}
