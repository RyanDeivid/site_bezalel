import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'info' | 'demo';

const tones: Record<BadgeTone, string> = {
  neutral: 'border-line-strong bg-surface-2 text-fg-muted',
  accent: 'border-accent/35 bg-accent-soft text-accent-text',
  ok: 'border-ok/35 bg-ok-soft text-ok',
  warn: 'border-warn/35 bg-warn-soft text-warn',
  danger: 'border-danger/35 bg-danger-soft text-danger',
  info: 'border-info/35 bg-info-soft text-info',
  demo: 'hatch-demo border-demo/45 text-demo',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: ReactNode;
  /** Ponto pulsante para estados ao vivo. */
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({ tone = 'neutral', icon, pulse, size = 'sm', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border font-mono font-medium uppercase tracking-[0.08em]',
        size === 'sm' ? 'h-6 px-2.5 text-[0.66rem]' : 'h-7 px-3 text-[0.72rem]',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {pulse && <span aria-hidden className="status-pulse size-1.5 shrink-0 rounded-full bg-current" />}
      {icon && <span aria-hidden className="shrink-0 [&>svg]:size-3.5">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}
