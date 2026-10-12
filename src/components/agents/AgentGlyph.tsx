import type { AgentId } from '@/types/domain';
import { cn } from '@/lib/cn';

/** Cor de identidade de cada agente (tokens --agent-*). */
export const AGENT_COLOR: Record<AgentId, string> = {
  scout: 'var(--agent-scout)',
  trend: 'var(--agent-trend)',
  atlas: 'var(--agent-atlas)',
  sol: 'var(--agent-sol)',
  verifier: 'var(--agent-verifier)',
  vigia: 'var(--agent-vigia)',
};

/** Valores em hex para contextos sem CSS (canvas/WebGL). */
export const AGENT_HEX: Record<AgentId, string> = {
  scout: '#63b8d6',
  trend: '#d9ae5c',
  atlas: '#7fa6f5',
  sol: '#ee9a73',
  verifier: '#5fc4a0',
  vigia: '#b9d06a',
};

/**
 * Glifos geométricos dos agentes — grade 24×24, traço 1.6, mesma linguagem
 * do símbolo da marca (vértices, nós e arestas).
 */
export function AgentGlyph({
  agent,
  className,
  x,
  y,
  width,
  height,
}: {
  agent: AgentId;
  className?: string;
  /** Posição/tamanho quando usado dentro de outro <svg>. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden x={x} y={y} width={width} height={height} className={cn(width === undefined && 'size-5', className)}>
      {agent === 'scout' && (
        <g {...common}>
          <circle cx="12" cy="12" r="8.5" opacity="0.45" />
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 12 L18.5 6.5" />
          <circle cx="17.2" cy="15.8" r="1.1" fill="currentColor" stroke="none" />
        </g>
      )}
      {agent === 'trend' && (
        <g {...common}>
          <path d="M3.5 18.5 L9 12.5 L13 15.5 L20.5 6.5" />
          <path d="M16 6.5 H20.5 V11" />
          <path d="M3.5 21 H20.5" opacity="0.4" />
        </g>
      )}
      {agent === 'atlas' && (
        <g {...common}>
          <path d="M12 4.5 L19 16.5 L5 16.5 Z" opacity="0.45" />
          <path d="M12 4.5 L12 11.5 M19 16.5 L12 11.5 M5 16.5 L12 11.5" />
          <circle cx="12" cy="4.5" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="19" cy="16.5" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="5" cy="16.5" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="12" cy="11.5" r="2.2" />
        </g>
      )}
      {agent === 'sol' && (
        <g {...common}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.8 V5.2 M12 18.8 V21.2 M2.8 12 H5.2 M18.8 12 H21.2 M5.5 5.5 L7.2 7.2 M16.8 16.8 L18.5 18.5 M5.5 18.5 L7.2 16.8 M16.8 7.2 L18.5 5.5" />
        </g>
      )}
      {agent === 'verifier' && (
        <g {...common}>
          <path d="M12 2.8 L19.8 7.3 V16.7 L12 21.2 L4.2 16.7 V7.3 Z" />
          <path d="M8.3 12.2 L10.9 14.8 L15.9 9.6" />
        </g>
      )}
      {agent === 'vigia' && (
        // Olho de vigia com ponteiros de relógio: atenção ao tempo (o prazo de 180 dias).
        <g {...common}>
          <path d="M2.8 12 C6.2 6.2 17.8 6.2 21.2 12 C17.8 17.8 6.2 17.8 2.8 12 Z" opacity="0.45" />
          <circle cx="12" cy="12" r="4.4" />
          <path d="M12 9.6 V12 L13.8 13.2" />
        </g>
      )}
    </svg>
  );
}
