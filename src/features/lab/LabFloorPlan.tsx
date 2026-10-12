import { usePreferences } from '@/app/preferences-context';
import { AGENT_COLOR, AGENT_HEX, AgentGlyph } from '@/components/agents/AgentGlyph';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { cn } from '@/lib/cn';
import type { Agent, AgentId, AgentStatus } from '@/types/domain';
import { HUB_RADIUS, STATION_LINKS, STATIONS, stationById } from './layout';
import { useAnimationGate } from '@/hooks/useAnimationGate';

interface Props {
  agents: Agent[];
  statuses: Record<AgentId, { status: AgentStatus }>;
  pulseAgent: AgentId | null;
  onSelect: (id: AgentId) => void;
}

/** Planta esquemática (não em escala): unidades do viewBox, com o campus de raio ~19. */
const VIEW = 40;
/** Raio (fração da largura) em que os cartões das estações ficam: espaçado o bastante para não se sobreporem no celular. */
const CARD_RADIUS = 0.36;
const planPos = (angle: number) => ({ x: Math.cos(angle) * CARD_RADIUS * VIEW, z: Math.sin(angle) * CARD_RADIUS * VIEW });
const toPct = (v: number) => ((v + VIEW / 2) / VIEW) * 100;

/**
 * Versão 2D do laboratório: mesma planta, mesmas estações e mesmos dados,
 * sem WebGL. Estações são botões HTML de verdade (teclado e leitores de tela).
 */
export function LabFloorPlan({ agents, statuses, pulseAgent, onSelect }: Props) {
  const { m, locale } = usePreferences();
  const byId = new Map(agents.map((a) => [a.id, a]));
  const gate = useAnimationGate<HTMLDivElement>();
  return (
    <div ref={gate} className="relative mx-auto aspect-square w-full max-w-[620px]">
      <svg viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`} className="absolute inset-0 size-full" aria-hidden>
        <circle r={VIEW / 2 - 0.8} fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="0.12" />
        {[4, 8, 12].map((r) => (
          <circle key={r} r={r} fill="none" stroke="var(--fg)" strokeOpacity="0.06" strokeWidth="0.08" />
        ))}
        {STATIONS.map((s) => (
          <line
            key={`h-${s.id}`}
            x1={planPos(s.angle).x * 0.8}
            y1={planPos(s.angle).z * 0.8}
            x2="0"
            y2="0"
            stroke={AGENT_HEX[s.id]}
            strokeOpacity={pulseAgent === s.id ? 0.9 : 0.35}
            strokeWidth={pulseAgent === s.id ? 0.22 : 0.1}
            strokeDasharray="0.6 0.8"
            style={{ animation: 'bz-flow 9s linear infinite reverse', transition: 'stroke-opacity 400ms' }}
          />
        ))}
        {STATION_LINKS.map(([a, b]) => {
          const pa = planPos(stationById(a).angle);
          const pb = planPos(stationById(b).angle);
          return <line key={`${a}-${b}`} x1={pa.x} y1={pa.z} x2={pb.x} y2={pb.z} stroke="var(--fg)" strokeOpacity="0.12" strokeWidth="0.08" />;
        })}
        <circle r={HUB_RADIUS} fill="var(--bg-deep)" stroke="var(--accent)" strokeWidth="0.15" />
      </svg>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <BezalelMark className="size-9 text-fg" />
        <span className="mt-1 max-w-24 text-[0.65rem] font-medium uppercase leading-tight tracking-wider text-accent-text">{m.lab.hud.center}</span>
      </div>
      {STATIONS.map((s) => {
        const agent = byId.get(s.id);
        const status = statuses[s.id].status;
        const pos = planPos(s.angle);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-label={`${m.lab.hud.openStation(agent?.name ?? s.id)} — ${m.enums.agentStatus[status]}`}
            className={cn(
              'group absolute flex w-[27%] max-w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border bg-bg/90 px-1.5 py-2 text-center shadow-2 backdrop-blur transition-transform duration-300 hover:scale-105 focus-visible:scale-105 sm:gap-1.5 sm:px-3 sm:py-3',
              pulseAgent === s.id && 'scale-105',
            )}
            style={{ left: `${toPct(pos.x)}%`, top: `${toPct(pos.z)}%`, borderColor: AGENT_COLOR[s.id] }}
          >
            <span style={{ color: AGENT_COLOR[s.id] }}>
              <AgentGlyph agent={s.id} className="size-6" />
            </span>
            <span className="text-xs font-semibold sm:text-sm">{agent?.name}</span>
            <span className="hidden w-full truncate text-[0.68rem] text-fg-muted sm:block">{agent?.role[locale]}</span>
            <span className={cn('inline-flex items-center gap-1 text-[0.68rem]', status === 'active' ? 'text-ok' : status === 'failed' ? 'text-danger' : 'text-fg-subtle')}>
              <span aria-hidden className={cn('size-1.5 rounded-full bg-current', status === 'active' && 'status-pulse')} />
              {m.enums.agentStatus[status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
