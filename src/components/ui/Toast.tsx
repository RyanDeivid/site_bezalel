import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT } from '@/app/preferences-context';
import { cn } from '@/lib/cn';
import { ToastContext, type ToastInput, type ToastTone } from './toast-context';

interface ToastItem extends ToastInput {
  id: number;
}

const ICONS: Record<ToastTone, ReactNode> = {
  info: <Info className="size-4 text-info" />,
  success: <CircleCheck className="size-4 text-ok" />,
  error: <CircleAlert className="size-4 text-danger" />,
  demo: <Info className="size-4 text-demo" />,
};

/** Notificações discretas, anunciadas por leitores de tela via região aria-live. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const m = useT();

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (input: ToastInput) => {
      seq.current += 1;
      const id = seq.current;
      setItems((list) => [...list.slice(-2), { ...input, id }]);
      setTimeout(() => dismiss(id), input.durationMs ?? 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-5 md:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'page-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line-strong bg-surface/95 px-4 py-3 text-sm shadow-3 backdrop-blur',
              t.tone === 'demo' && 'border-demo/40',
            )}
          >
            <span className="mt-0.5">{ICONS[t.tone ?? 'info']}</span>
            <div className="min-w-0 flex-1">
              {t.title && <p className="font-medium text-fg">{t.title}</p>}
              <p className="text-fg-muted">{t.message}</p>
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-fg-subtle hover:text-fg" aria-label={m.common.close}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
