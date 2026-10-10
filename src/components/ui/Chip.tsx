import { Check } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  selected: boolean;
  count?: number;
  icon?: ReactNode;
}

/** Filtro alternável. `aria-pressed` comunica o estado a tecnologias assistivas. */
export function Chip({ selected, count, icon, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-[background-color,border-color,color] duration-200',
        selected
          ? 'border-accent/60 bg-accent-soft text-fg'
          : 'border-line-strong bg-transparent text-fg-muted hover:border-accent/40 hover:text-fg',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-3.5 place-items-center rounded-[4px] border transition-colors',
          selected ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong',
        )}
      >
        {selected && <Check className="size-2.5" strokeWidth={3} />}
      </span>
      {icon}
      <span>{children}</span>
      {count !== undefined && <span className="font-mono text-xs text-fg-subtle">{count}</span>}
    </button>
  );
}
