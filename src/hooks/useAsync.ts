import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type AsyncResult<T> =
  | { status: 'loading'; data?: T; error?: undefined; isLoadingVisible: boolean; retry: () => void }
  | { status: 'success'; data: T; error?: undefined; isLoadingVisible: false; retry: () => void }
  | { status: 'error'; data?: T; error: Error; isLoadingVisible: false; retry: () => void };

interface Settled<T> {
  key: string;
  ok: boolean;
  data?: T;
  error?: Error;
}

/**
 * Executa uma função assíncrona e expõe loading/sucesso/erro.
 *
 * - `deps` devem ser serializáveis (primitivos ou objetos simples): viram a
 *   chave da requisição. Uma resposta antiga nunca sobrescreve uma nova.
 * - `showLoadingAfterMs` evita "piscar" esqueleto quando a resposta é
 *   imediata (modo demo): só então `isLoadingVisible` fica verdadeiro.
 * - Durante um recarregamento, `data` mantém o último valor bem-sucedido
 *   (sem salto de layout).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[], showLoadingAfterMs = 160): AsyncResult<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [lastData, setLastData] = useState<T | undefined>(undefined);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const fnRef = useRef(fn);
  const key = `${JSON.stringify(deps)}#${attempt}`;

  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setSlowKey(key);
    }, showLoadingAfterMs);
    fnRef.current().then(
      (data) => {
        if (cancelled) return;
        setSettled({ key, ok: true, data });
        setLastData(data);
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ key, ok: false, error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, showLoadingAfterMs]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (settled?.key === key) {
    if (settled.ok) return { status: 'success', data: settled.data as T, isLoadingVisible: false, retry };
    return { status: 'error', data: lastData, error: settled.error ?? new Error('Erro desconhecido'), isLoadingVisible: false, retry };
  }
  return { status: 'loading', data: lastData, isLoadingVisible: slowKey === key, retry };
}
