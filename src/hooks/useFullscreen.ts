import { useCallback, useSyncExternalStore, type RefObject } from 'react';

/** API de tela cheia com o prefixo `webkit` (Safari do iPad e navegadores antigos). */
interface FsDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}
interface FsElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const doc = () => (typeof document === 'undefined' ? null : (document as FsDocument));

/** O navegador permite pôr um elemento em tela cheia? (O Safari do iPhone não permite.) */
export function fullscreenSupported(): boolean {
  const d = doc();
  return !!d && !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

const currentElement = () => {
  const d = doc();
  return d ? (d.fullscreenElement ?? d.webkitFullscreenElement ?? null) : null;
};

function subscribe(onChange: () => void) {
  const d = doc();
  if (!d) return () => {};
  d.addEventListener('fullscreenchange', onChange);
  d.addEventListener('webkitfullscreenchange', onChange);
  return () => {
    d.removeEventListener('fullscreenchange', onChange);
    d.removeEventListener('webkitfullscreenchange', onChange);
  };
}

/**
 * Tela cheia de um elemento (o palco 3D), com a opção de travar o aparelho na
 * horizontal — o que só funciona em tela cheia e só em alguns navegadores
 * (Chrome do Android); onde não der, a tentativa é ignorada em silêncio.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const active = useSyncExternalStore(
    subscribe,
    () => !!ref.current && currentElement() === ref.current,
    () => false,
  );

  const enter = useCallback(
    async (opts: { landscape?: boolean } = {}) => {
      const el = ref.current as FsElement | null;
      if (!el) return;
      try {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
        else await el.webkitRequestFullscreen?.();
      } catch {
        return;
      }
      if (opts.landscape) {
        try {
          // `lock` não existe em todo navegador (ex.: Safari): a chamada opcional cobre isso.
          await screen.orientation?.lock?.('landscape');
        } catch {
          // Navegador sem trava de orientação: segue em tela cheia mesmo assim.
        }
      }
    },
    [ref],
  );

  const exit = useCallback(async () => {
    const d = doc();
    if (!d || !currentElement()) return;
    try {
      screen.orientation?.unlock?.();
    } catch {
      // ignora
    }
    try {
      if (d.exitFullscreen) await d.exitFullscreen();
      else await d.webkitExitFullscreen?.();
    } catch {
      // já saiu
    }
  }, []);

  return { active, enter, exit };
}
