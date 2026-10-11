import type { Course } from '../../types/domain.ts';

/**
 * Catálogo curado carregado sob demanda: os registros ficam num chunk próprio
 * (fora do JS inicial), baixado em paralelo com o bundle principal — o
 * pós-build põe um <link rel="modulepreload"> para ele em toda página — e
 * aguardado antes do primeiro render (main.tsx) e da pré-renderização
 * (entry-server.tsx). O HTML já traz o conteúdo pré-renderizado; isto só
 * garante que o React tenha os mesmos dados ao hidratar.
 */
let loaded: Course[] | null = null;
let pending: Promise<Course[]> | null = null;

export function loadCatalog(): Promise<Course[]> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= import('./courses.ts').then((mod) => {
    loaded = mod.curatedCourses;
    return loaded;
  });
  return pending;
}

/** Registros curados já carregados (chame `loadCatalog()` antes). */
export function curated(): Course[] {
  if (!loaded) throw new Error('Catálogo ainda não carregado: aguarde loadCatalog() antes de criar os serviços locais.');
  return loaded;
}
