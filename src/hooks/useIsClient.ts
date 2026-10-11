import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * `false` na pré-renderização e durante a hidratação; `true` logo depois.
 * Para trechos que dependem do aparelho (WebGL, memória, sessão): o primeiro
 * render bate com o HTML pré-gerado e o React ajusta em seguida.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
