import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { peek } from '@/lib/sync-promise';
import { ServicesContext } from '@/services/context';

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

/** useLayoutEffect no navegador; no servidor (pré-renderização) não há layout. */
const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect;

/**
 * Executa uma função assíncrona e expõe loading/sucesso/erro.
 *
 * - `deps` devem ser serializáveis (primitivos ou objetos simples): viram a
 *   chave da requisição. Uma resposta antiga nunca sobrescreve uma nova.
 * - `showLoadingAfterMs` evita "piscar" esqueleto quando a resposta é
 *   imediata: só então `isLoadingVisible` fica verdadeiro.
 * - Durante um recarregamento, `data` mantém o último valor bem-sucedido
 *   (sem salto de layout).
 * - No modo demonstração os serviços respondem com promessas legíveis na hora
 *   (lib/sync-promise.ts): o dado já sai no primeiro render — e no HTML
 *   pré-gerado —, sem estado de carregamento. No modo API nada é chamado
 *   durante o render; a requisição continua começando no efeito.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[], showLoadingAfterMs = 160): AsyncResult<T> {
  const services = useContext(ServicesContext);
  const [attempt, setAttempt] = useState(0);
  const key = `${JSON.stringify(deps)}#${attempt}`;
  const canPeek = services?.mode === 'demo';
  // Última chave já "espiada" e o valor síncrono obtido (se houve).
  const [sync, setSync] = useState<{ key: string; hit?: { value: T } } | null>(() => (canPeek ? { key, hit: peek(fn()) } : null));
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [lastData, setLastData] = useState<T | undefined>(() => sync?.hit?.value);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const fnRef = useRef(fn);

  useIsoLayoutEffect(() => {
    fnRef.current = fn;
  });

  // Chave nova: se a resposta é síncrona, usa já, sem passar por "loading".
  if (canPeek && sync?.key !== key) {
    const hit = peek(fn());
    setSync({ key, hit });
    if (hit) setLastData(hit.value);
  }

  const syncHit = sync?.key === key ? sync.hit : undefined;

  useEffect(() => {
    if (syncHit) return;
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
  }, [key, showLoadingAfterMs, syncHit]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const done: Settled<T> | null = syncHit ? { key, ok: true, data: syncHit.value } : settled?.key === key ? settled : null;
  if (done) {
    if (done.ok) return { status: 'success', data: done.data as T, isLoadingVisible: false, retry };
    return { status: 'error', data: lastData, error: done.error ?? new Error('Erro desconhecido'), isLoadingVisible: false, retry };
  }
  return { status: 'loading', data: lastData, isLoadingVisible: slowKey === key, retry };
}
