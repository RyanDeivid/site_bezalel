import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
  /** Prefixo dos ids dos painéis (aria-controls). */
  panelIdPrefix?: string;
}

/** Abas acessíveis (padrão WAI-ARIA): setas movem o foco, Home/End vão às pontas. */
export function Tabs<T extends string>({ items, value, onChange, label, className, panelIdPrefix }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const uid = useId();
  const prefix = panelIdPrefix ?? uid;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    let next = -1;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next >= 0) {
      e.preventDefault();
      const item = items[next];
      if (item) {
        onChange(item.id);
        refs.current[next]?.focus();
      }
    }
  }

  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface/60 p-1', className)}>
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${prefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${prefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors duration-200',
              selected ? 'bg-surface-3 text-fg shadow-1' : 'text-fg-muted hover:text-fg',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
