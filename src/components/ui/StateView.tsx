import { CircleCheck, CircleDashed, CircleOff, RotateCcw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/app/preferences-context';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export type ViewState = 'empty' | 'error' | 'unavailable' | 'success';

const ICONS: Record<ViewState, ReactNode> = {
  empty: <CircleDashed className="size-6" />,
  error: <TriangleAlert className="size-6" />,
  unavailable: <CircleOff className="size-6" />,
  success: <CircleCheck className="size-6" />,
};

const TONES: Record<ViewState, string> = {
  empty: 'text-fg-subtle',
  error: 'text-danger',
  unavailable: 'text-warn',
  success: 'text-ok',
};

interface StateViewProps {
  state: ViewState;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/** Estado padronizado para vazio, erro, indisponível e sucesso. */
export function StateView({ state, title, children, action, onRetry, className, compact }: StateViewProps) {
  const m = useT();
  const defaultTitle = state === 'error' ? m.common.errorTitle : state === 'unavailable' ? m.common.unavailableTitle : state === 'empty' ? m.common.emptyTitle : undefined;
  return (
    <div
      role={state === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <span className={cn('grid size-12 place-items-center rounded-full border border-line bg-surface-2', TONES[state])}>{ICONS[state]}</span>
      {(title ?? defaultTitle) && <p className="font-medium text-fg">{title ?? defaultTitle}</p>}
      {children && <div className="max-w-md text-sm text-fg-muted">{children}</div>}
      {(action || onRetry) && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry} iconLeft={<RotateCcw className="size-3.5" />}>
              {m.common.retry}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

/** Indicador de processamento com anel animado — usado em validações. */
export function ProcessingIndicator({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-fg-muted', className)} role="status">
      <span aria-hidden className="relative size-4">
        <span className="absolute inset-0 rounded-full border-2 border-line-strong" />
        <span className="absolute inset-0 animate-[bz-spin_0.9s_linear_infinite] rounded-full border-2 border-transparent border-t-accent" />
      </span>
      {label}
    </span>
  );
}
