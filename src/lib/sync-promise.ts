/**
 * Promessas "legíveis na hora". Os serviços locais (modo demonstração)
 * calculam tudo em memória; marcando a promessa com o valor já pronto, o
 * `useAsync` consegue renderizar o dado no primeiro quadro — inclusive na
 * pré-renderização (SSG) — sem esqueleto nem troca de conteúdo depois.
 * Para quem só usa `await`/`then`, continua sendo uma Promise comum.
 */
const SYNC = Symbol('bz.sync');

type Marked<T> = Promise<T> & { [SYNC]?: { value: T } };

/** Promise já resolvida cujo valor pode ser lido de forma síncrona com `peek`. */
export function resolved<T>(value: T): Promise<T> {
  const p = Promise.resolve(value) as Marked<T>;
  p[SYNC] = { value };
  return p;
}

/** Valor de uma promessa criada por `resolved`/`combine`; undefined para as demais. */
export function peek<T>(promise: Promise<T>): { value: T } | undefined {
  return (promise as Marked<T>)[SYNC];
}

/**
 * Como `Promise.all(...).then(fn)`, mas preserva a leitura síncrona quando
 * todas as entradas já têm valor.
 */
export function combine<const P extends readonly Promise<unknown>[], R>(
  promises: P,
  fn: (values: { -readonly [K in keyof P]: Awaited<P[K]> }) => R,
): Promise<R> {
  const hits = promises.map((p) => peek(p));
  if (hits.every(Boolean)) return resolved(fn(hits.map((h) => h!.value) as { -readonly [K in keyof P]: Awaited<P[K]> }));
  return Promise.all(promises).then((values) => fn(values as { -readonly [K in keyof P]: Awaited<P[K]> }));
}
