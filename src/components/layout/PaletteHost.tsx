import { lazy, Suspense, useEffect, useState } from 'react';
import { PALETTE_EVENT } from './palette-events';

// A paleta (busca de cursos, páginas e ações) só é baixada na primeira vez que é aberta.
const CommandPalette = lazy(() => import('@/features/palette/CommandPalette'));

/** Atalho global Ctrl+K / ⌘K. */
export function PaletteHost() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setLoaded(true);
        setOpen((v) => !v);
      }
    };
    const onOpen = () => {
      setLoaded(true);
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(PALETTE_EVENT, onOpen);
    };
  }, []);
  if (!loaded) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </Suspense>
  );
}
