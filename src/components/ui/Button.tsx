import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[var(--ease-out)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_10px_30px_-12px_var(--accent)] hover:bg-accent-strong hover:shadow-[0_1px_0_rgb(255_255_255/0.3)_inset,0_14px_36px_-12px_var(--accent)]',
  secondary: 'border border-line-strong bg-surface/60 text-fg backdrop-blur hover:border-accent/60 hover:bg-surface-2',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  subtle: 'bg-surface-2 text-fg hover:bg-surface-3',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-md px-3 text-sm',
  md: 'h-10 rounded-[10px] px-4 text-[0.95rem]',
  lg: 'h-12 rounded-xl px-6 text-base',
};

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, CommonProps & ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { variant, size, iconLeft, iconRight, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...rest}>
      {iconLeft}
      {children}
      {iconRight && <span className="transition-transform duration-200 group-hover:translate-x-0.5">{iconRight}</span>}
    </button>
  );
});

/** Link interno com aparência de botão (usa transições de rota quando suportadas). */
export function ButtonLink({ variant, size, iconLeft, iconRight, className, children, ...rest }: CommonProps & LinkProps) {
  return (
    <Link viewTransition className={buttonClasses(variant, size, className)} {...rest}>
      {iconLeft}
      {children}
      {iconRight && <span className="transition-transform duration-200 group-hover:translate-x-0.5">{iconRight}</span>}
    </Link>
  );
}

/** Botão de ícone com rótulo acessível obrigatório. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  { label: string; size?: 'sm' | 'md'; active?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>
>(function IconButton({ label, size = 'md', active, className, children, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[10px] border border-transparent text-fg-muted transition-colors duration-200 hover:border-line hover:bg-surface-2 hover:text-fg',
        size === 'sm' ? 'size-8' : 'size-10',
        active && 'border-accent/50 bg-accent-soft text-accent-text',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export type AnchorButtonProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>;
