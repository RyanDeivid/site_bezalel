import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Símbolo Bezalel — um bloco construtivo isométrico de três faces:
 *   face superior (dourada)  → Discover: a luz que revela;
 *   face esquerda (traço)     → Learn: camadas de conhecimento;
 *   face direita (aço)        → Build: a matéria que ganha forma.
 * O nó central une as três faces — o ponto onde informação vira criação.
 * A referência a Bezalel, artesão-construtor, fica na própria geometria.
 */
export function BezalelMark({ className, animated = false, title }: { className?: string; animated?: boolean; title?: string }) {
  const id = useId().replace(/:/g, '');
  const steel = `bz-steel-${id}`;
  const gold = `bz-gold-${id}`;
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('shrink-0', animated && 'bz-mark-animated', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={steel} x1="24" y1="14" x2="41" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4d6a8c" />
          <stop offset="1" stopColor="#1e3149" />
        </linearGradient>
        <linearGradient id={gold} x1="6" y1="4" x2="41" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ead9b2" />
          <stop offset="0.55" stopColor="#c7a86a" />
          <stop offset="1" stopColor="#a88a4e" />
        </linearGradient>
      </defs>
      {/* Build — face direita */}
      <path className="bz-face bz-face-3" d="M24 24 L41.32 14 L41.32 34 L24 44 Z" fill={`url(#${steel})`} stroke="#c7a86a" strokeOpacity="0.55" strokeWidth="0.9" strokeLinejoin="round" />
      {/* Learn — face esquerda */}
      <path className="bz-face bz-face-2" d="M6.68 14 L24 24 L24 44 L6.68 34 Z" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.3" strokeLinejoin="round" />
      <path className="bz-face bz-face-2" d="M6.68 21 L24 31" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
      <path className="bz-face bz-face-2" d="M6.68 27.5 L24 37.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      {/* Discover — face superior */}
      <path className="bz-face bz-face-1" d="M24 4 L41.32 14 L24 24 L6.68 14 Z" fill={`url(#${gold})`} stroke="#ead9b2" strokeOpacity="0.6" strokeWidth="0.8" strokeLinejoin="round" />
      {/* Nó central */}
      <circle className="bz-node" cx="24" cy="24" r="3.1" fill="#101b2b" stroke="#f2e8d5" strokeWidth="1.3" />
      <circle className="bz-node" cx="24" cy="24" r="1.2" fill="#f2e8d5" />
    </svg>
  );
}
