import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Dica contextual acessível: aparece no hover E no foco do teclado, e é
 * ligada ao gatilho por aria-describedby (leitores de tela a anunciam).
 */
export function Tooltip({ content, children, side = 'top', className }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom'; className?: string }) {
  const id = useId();
  return (
    <span className={cn('group/tt relative inline-flex', className)} aria-describedby={id}>
      {children}
      <span
        role="tooltip"
        id={id}
        className={cn(
          // display:none fora do hover/foco: invisível não basta, pois ainda gera rolagem horizontal perto da borda.
          'page-enter pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-line-strong bg-bg-abyss px-2.5 py-1.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-fg shadow-2 group-focus-within/tt:block group-hover/tt:block',
          side === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
        )}
      >
        {content}
      </span>
    </span>
  );
}
