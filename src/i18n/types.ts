/**
 * Transforma o objeto de mensagens pt-BR (fonte de verdade) em um tipo
 * estrutural: strings literais viram `string`, funções mantêm a assinatura.
 * Assim, cada arquivo em inglês é obrigado a ter exatamente as mesmas chaves.
 */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? Widen<U>[]
      : T extends object
        ? { [K in keyof T]: Widen<T[K]> }
        : T;
