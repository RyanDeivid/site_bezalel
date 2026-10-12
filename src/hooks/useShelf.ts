import { useCallback, useSyncExternalStore } from 'react';
import { EMPTY_SHELF, parseShelf, serializeShelf, type Shelf } from '@/domain/tools/shelf';
import { readStorage, writeStorage } from '@/lib/storage';

/**
 * Estado da "Minha estante" compartilhado por toda a página e sincronizado
 * entre abas (evento `storage`). Na pré-renderização e na hidratação vale a
 * estante vazia (o HTML é igual para todos); o React ajusta logo depois.
 */
const KEY = 'bz-shelf-v1';

let cache: Shelf | null = null;
const listeners = new Set<() => void>();

function current(): Shelf {
  cache ??= parseShelf(readStorage(KEY));
  return cache;
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = parseShelf(e.newValue);
    emit();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function updateShelf(next: (shelf: Shelf) => Shelf): void {
  const value = next(current());
  if (value === cache) return;
  cache = value;
  writeStorage(KEY, serializeShelf(value));
  emit();
}

/** Para testes: esquece o que foi lido. */
export function resetShelfCache(): void {
  cache = null;
}

export function useShelf(): [Shelf, (next: (shelf: Shelf) => Shelf) => void] {
  const shelf = useSyncExternalStore(subscribe, current, () => EMPTY_SHELF);
  const update = useCallback((next: (shelf: Shelf) => Shelf) => updateShelf(next), []);
  return [shelf, update];
}
