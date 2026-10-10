import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useT } from '@/app/preferences-context';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** `modal` centralizado, `drawer` painel lateral (embaixo no mobile). */
  variant?: 'modal' | 'drawer';
  footer?: ReactNode;
  className?: string;
  /** Cor de destaque (ex.: cor do agente) aplicada à borda superior. */
  accent?: string;
}

/**
 * Diálogo acessível baseado no elemento nativo <dialog>: foco preso, Esc
 * fecha, fundo inerte e retorno do foco ao elemento que abriu — tudo pelo
 * navegador, sem bibliotecas.
 */
export function Dialog({ open, onClose, title, description, children, variant = 'modal', footer, className, accent }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const m = useT();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clique no backdrop (fora da caixa) fecha.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'm-0 max-h-none max-w-none overflow-visible bg-transparent p-0 backdrop:bg-[rgb(4_8_14/0.62)] backdrop:backdrop-blur-sm',
        variant === 'modal' && 'fixed inset-0 m-auto h-fit w-[min(680px,calc(100vw-2rem))]',
        variant === 'drawer' &&
          'fixed inset-x-0 bottom-0 top-auto h-[min(86dvh,760px)] w-full md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:w-[min(480px,100vw)]',
      )}
    >
      {open && (
        <div
          className={cn(
            'page-enter relative flex max-h-full flex-col overflow-hidden border border-line-strong bg-surface text-fg shadow-3',
            variant === 'modal' ? 'max-h-[calc(100dvh-2rem)] rounded-xl' : 'h-full rounded-t-xl md:rounded-none md:rounded-l-xl',
            className,
          )}
          style={accent ? { boxShadow: `inset 0 2px 0 ${accent}, var(--shadow-3)` } : undefined}
        >
          <header className="flex items-start gap-4 border-b border-line px-5 py-4 md:px-6">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-fg-muted">
                  {description}
                </p>
              )}
            </div>
            <IconButton label={m.common.close} onClick={onClose} size="sm">
              <X className="size-4" />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
          {footer && <footer className="border-t border-line px-5 py-4 md:px-6">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
