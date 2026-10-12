/**
 * "Minha estante": cursos salvos e o progresso que o visitante marca. Fica só
 * no navegador dele (localStorage) — não há conta nem servidor. Funções puras;
 * a persistência e a assinatura entre abas ficam em `hooks/useShelf`.
 */

export type Progress = 'todo' | 'doing' | 'done';

export interface Shelf {
  /** Ids dos cursos salvos, do mais recente para o mais antigo. */
  saved: string[];
  /** Progresso marcado (ausente = não iniciado). Vale também para cursos de uma trilha não salvos. */
  progress: Record<string, Exclude<Progress, 'todo'>>;
}

export const EMPTY_SHELF: Shelf = Object.freeze({ saved: [], progress: {} }) as Shelf;

/** Limite defensivo: a estante cabe folgada no localStorage. */
export const MAX_SAVED = 200;

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 120;

/** Lê o que estiver gravado, tolerando versões antigas, lixo e campos a mais. */
export function parseShelf(raw: string | null): Shelf {
  if (!raw) return EMPTY_SHELF;
  try {
    const data = JSON.parse(raw) as { saved?: unknown; progress?: unknown };
    const saved = Array.isArray(data.saved) ? [...new Set(data.saved.filter(isId))].slice(0, MAX_SAVED) : [];
    const progress: Shelf['progress'] = {};
    if (data.progress && typeof data.progress === 'object') {
      for (const [id, p] of Object.entries(data.progress as Record<string, unknown>)) if (isId(id) && (p === 'doing' || p === 'done')) progress[id] = p;
    }
    return { saved, progress };
  } catch {
    return EMPTY_SHELF;
  }
}

export const serializeShelf = (shelf: Shelf) => JSON.stringify({ v: 1, saved: shelf.saved, progress: shelf.progress });

export const isSaved = (shelf: Shelf, id: string) => shelf.saved.includes(id);

export function toggleSaved(shelf: Shelf, id: string): Shelf {
  return isSaved(shelf, id) ? { ...shelf, saved: shelf.saved.filter((x) => x !== id) } : { ...shelf, saved: [id, ...shelf.saved].slice(0, MAX_SAVED) };
}

export function saveAll(shelf: Shelf, ids: string[]): Shelf {
  const fresh = ids.filter((id) => !shelf.saved.includes(id));
  return fresh.length ? { ...shelf, saved: [...fresh, ...shelf.saved].slice(0, MAX_SAVED) } : shelf;
}

export function progressOf(shelf: Shelf, id: string): Progress {
  return shelf.progress[id] ?? 'todo';
}

export function setProgress(shelf: Shelf, id: string, value: Progress): Shelf {
  const progress = { ...shelf.progress };
  if (value === 'todo') delete progress[id];
  else progress[id] = value;
  return { ...shelf, progress };
}

/** Quantos de `ids` estão concluídos / em andamento. */
export function progressSummary(shelf: Shelf, ids: string[]): { done: number; doing: number; total: number } {
  let done = 0;
  let doing = 0;
  for (const id of ids) {
    const p = progressOf(shelf, id);
    if (p === 'done') done += 1;
    else if (p === 'doing') doing += 1;
  }
  return { done, doing, total: ids.length };
}
