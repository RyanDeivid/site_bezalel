import { createContext, useContext } from 'react';

export type ToastTone = 'info' | 'success' | 'error' | 'demo';

export interface ToastInput {
  message: string;
  title?: string;
  tone?: ToastTone;
  durationMs?: number;
}

export const ToastContext = createContext<{ notify: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  // Sem provider (ex.: testes isolados), notificações são ignoradas.
  return ctx ?? { notify: () => {} };
}
