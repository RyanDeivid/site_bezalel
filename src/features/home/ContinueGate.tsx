import { lazy, Suspense, useSyncExternalStore } from 'react';
import { LAST_TRAIL_KEY } from '@/domain/tools/trail';
import { readStorage } from '@/lib/storage';

// A seção (e seus textos) só é baixada por quem tem estante ou trilha guardada.
const ContinueSection = lazy(() => import('./ContinueSection'));

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

/** Há algo do visitante guardado neste navegador? (falso na pré-renderização e na hidratação) */
const hasSaved = () => Boolean(readStorage('bz-shelf-v1') || readStorage(LAST_TRAIL_KEY));

export function ContinueGate() {
  const show = useSyncExternalStore(subscribe, hasSaved, () => false);
  if (!show) return null;
  return (
    <Suspense fallback={null}>
      <ContinueSection />
    </Suspense>
  );
}
