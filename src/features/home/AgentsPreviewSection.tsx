import { ArrowRight } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { AGENT_COLOR, AgentGlyph } from '@/components/agents/AgentGlyph';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/visual/Reveal';
import { demoAgents } from '@/data/demo/agents';
import { cn } from '@/lib/cn';
import type { AgentId } from '@/types/domain';

/** Posições da constelação (pentágono ao redor do núcleo), em coordenadas do viewBox 400×400. */
const NODES: Record<AgentId, { x: number; y: number }> = {
  scout: { x: 200, y: 52 },
  verifier: { x: 341, y: 154 },
  atlas: { x: 287, y: 320 },
  trend: { x: 113, y: 320 },
  sol: { x: 59, y: 154 },
};

/** Conexões do fluxo de dados entre agentes. */
const LINKS: Array<[AgentId, AgentId]> = [
  ['scout', 'verifier'],
  ['verifier', 'atlas'],
  ['atlas', 'trend'],
  ['trend', 'sol'],
  ['sol', 'scout'],
];

export function AgentsPreviewSection() {
  const { m, locale } = usePreferences();
  const a = m.home.agents;
  const [hover, setHover] = useState<AgentId | null>(null);

  return (
    <section className="relative overflow-hidden border-y border-line bg-bg-abyss py-14 md:py-28">
      <div className="container-page grid grid-cols-1 items-center gap-10 md:gap-14 lg:grid-cols-2">
        <Reveal className="relative mx-auto aspect-square w-full max-w-[280px] [container-type:inline-size] sm:max-w-[460px]">
          <svg viewBox="0 0 400 400" className="size-full" role="img" aria-label={a.title}>
            <defs>
              <radialGradient id="bz-core-glow">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="200" cy="200" r="150" fill="none" stroke="var(--line-strong)" strokeDasharray="2 8" />
            <circle cx="200" cy="200" r="90" fill="url(#bz-core-glow)" />
            {(Object.keys(NODES) as AgentId[]).map((id) => (
              <line
                key={`c-${id}`}
                x1="200"
                y1="200"
                x2={NODES[id].x}
                y2={NODES[id].y}
                stroke={AGENT_COLOR[id]}
                strokeOpacity={hover === null || hover === id ? 0.5 : 0.12}
                strokeWidth="1.2"
                strokeDasharray="4 6"
                style={{ transition: 'stroke-opacity 300ms' }}
              />
            ))}
            {LINKS.map(([from, to]) => (
              <line
                key={`${from}-${to}`}
                x1={NODES[from].x}
                y1={NODES[from].y}
                x2={NODES[to].x}
                y2={NODES[to].y}
                stroke="var(--fg)"
                strokeOpacity={hover && (hover === from || hover === to) ? 0.45 : 0.12}
                strokeWidth="1"
                style={{ transition: 'stroke-opacity 300ms' }}
              />
            ))}
          </svg>
          {/* Pulsos de dados viajando de cada agente até o núcleo: elementos HTML
              animados só com transform/opacity (compositor). Traços SVG animados
              custavam a thread principal inteira de um celular médio. */}
          {(Object.keys(NODES) as AgentId[]).map((id, i) => (
            <span
              key={`p-${id}`}
              aria-hidden
              className="bz-travel-dot"
              style={
                {
                  left: `${NODES[id].x / 4}%`,
                  top: `${NODES[id].y / 4}%`,
                  color: AGENT_COLOR[id],
                  '--tx': `${(200 - NODES[id].x) / 4}cqw`,
                  '--ty': `${(200 - NODES[id].y) / 4}cqw`,
                  '--delay': `${-i * 0.55}s`,
                } as CSSProperties
              }
            />
          ))}
          <BezalelMark className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 text-fg" />
          {(Object.keys(NODES) as AgentId[]).map((id) => (
            <span
              key={id}
              className={cn(
                'absolute grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border bg-bg shadow-2 transition-transform duration-300',
                hover === id && 'scale-110',
              )}
              style={{ left: `${(NODES[id].x / 400) * 100}%`, top: `${(NODES[id].y / 400) * 100}%`, color: AGENT_COLOR[id], borderColor: AGENT_COLOR[id] }}
            >
              <AgentGlyph agent={id} className="size-6" />
            </span>
          ))}
        </Reveal>

        <div>
          <Reveal>
            <p className="eyebrow">{a.eyebrow}</p>
            <h2 className="text-title mt-4">{a.title}</h2>
            <p className="mt-4 text-fg-muted">{a.lead}</p>
            <Badge tone="demo" className="mt-5">
              {a.demo}
            </Badge>
          </Reveal>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {demoAgents.map((agent, i) => (
              <Reveal
                as="li"
                key={agent.id}
                delay={i * 70}
                className="group flex cursor-default items-center gap-4 py-4"
              >
                <span
                  onMouseEnter={() => setHover(agent.id)}
                  onMouseLeave={() => setHover(null)}
                  className="flex flex-1 items-center gap-4"
                >
                  <span className="grid size-9 place-items-center rounded-lg border border-line" style={{ color: AGENT_COLOR[agent.id] }}>
                    <AgentGlyph agent={agent.id} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{agent.name}</span>
                    <span className="block truncate text-sm text-fg-muted">{agent.role[locale]}</span>
                  </span>
                </span>
              </Reveal>
            ))}
          </ul>
          <ButtonLink to="/agents" className="mt-8" iconRight={<ArrowRight className="size-4" />}>
            {a.cta}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
