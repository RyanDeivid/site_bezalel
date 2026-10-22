/**
 * A linha do tempo da experiência, em fração da rolagem (0 = topo do trilho,
 * 1 = fim). Compartilhada pela cena (o que acontece) e pela página (que texto
 * aparece), sem three.js. Funções puras e testadas.
 */
export interface Act {
  from: number;
  to: number;
}

export const ACTS = {
  /** O livro selado, na escuridão, envolto em poeira de luz. */
  book: { from: 0, to: 0.14 },
  /** "Quem é digno de abrir o livro?" — os selos pulsam, a poeira gira. */
  worthy: { from: 0.14, to: 0.3 },
  /** "Não chores" — o tempo para. */
  weep: { from: 0.3, to: 0.38 },
  /** "Eis aqui o Leão da tribo de Judá" — a poeira se torna o leão. */
  lion: { from: 0.38, to: 0.62 },
  /** "Que venceu para abrir o livro e desatar os seus sete selos." */
  seals: { from: 0.62, to: 0.84 },
  /** "Um Cordeiro, como havendo sido morto" — o livro aberto, a luz. */
  lamb: { from: 0.84, to: 1 },
} satisfies Record<string, Act>;

export type ActId = keyof typeof ACTS;
export const ACT_ORDER = Object.keys(ACTS) as ActId[];

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

/** Quanto do intervalo [a, b] já passou (0..1, suavizado). */
export const span = (p: number, a: number, b: number) => smooth((p - a) / (b - a));

/** O ato em que a rolagem está. */
export function actAt(p: number): ActId {
  for (const id of ACT_ORDER) if (p < ACTS[id].to) return id;
  return 'lamb';
}

/** Meia largura da troca de citações (em fração da rolagem): uma sai enquanto a outra entra. */
const CROSS = 0.012;

/** Visibilidade do texto de um ato: entra e sai cruzando com o vizinho (o primeiro já está; o último fica). */
export function textOpacity(id: ActId, p: number) {
  const { from, to } = ACTS[id];
  const inn = from === 0 ? 1 : span(p, from - CROSS, from + CROSS);
  const out = id === 'lamb' ? 1 : 1 - span(p, to - CROSS, to + CROSS);
  return Math.min(inn, out);
}

/** Estado da cena numa fração da rolagem: o que cada parte da coreografia deve mostrar. */
export function choreography(p: number) {
  return {
    /** Agitação da poeira (os selos "chamam"). */
    stir: span(p, ACTS.worthy.from, ACTS.worthy.to) * (1 - span(p, ACTS.weep.from, ACTS.weep.from + 0.02)),
    /** O tempo para em "não chores" e volta devagar com o leão. */
    still: span(p, ACTS.weep.from, ACTS.weep.from + 0.03) * (1 - span(p, ACTS.lion.from, ACTS.lion.from + 0.08)),
    /** A poeira vira leão. */
    form: span(p, ACTS.lion.from, ACTS.lion.to - 0.02),
    /** O livro vai para diante do rosto do leão. */
    bookMove: span(p, ACTS.lion.from + 0.04, ACTS.lion.to),
    /** Selos quebrados (0..7, contínuo: a parte fracionária é o selo que está quebrando). */
    seals: clamp01((p - ACTS.seals.from) / (ACTS.seals.to - 0.05 - ACTS.seals.from)) * 7,
    /** O livro se abre. */
    unroll: span(p, ACTS.seals.to - 0.05, ACTS.lamb.from + 0.06),
    /** A luz do fim: o leão se recolhe em luz, o livro brilha. */
    rise: span(p, ACTS.lamb.from + 0.02, 1),
  };
}
