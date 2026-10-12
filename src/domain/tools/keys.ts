/**
 * Chaves do armazenamento local das ferramentas. Módulo à parte de propósito:
 * a home (JS inicial) só precisa dos nomes; importar de `trail.ts` puxaria o
 * montador de trilhas inteiro para o pacote inicial.
 */

/** "Minha estante": cursos salvos e progresso. */
export const SHELF_KEY = 'bz-shelf-v1';

/** Última trilha vista — a home oferece "continue de onde parou". */
export const LAST_TRAIL_KEY = 'bz-last-trail';
