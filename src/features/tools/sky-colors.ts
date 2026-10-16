import type { StarState } from '@/domain/tools/constellation';

/**
 * Cores dos estados pessoais: séries 4, 1 e 3 da paleta validada (contraste e
 * daltonismo conferidos nos dois temas). Nunca só cor: "já tenho" é estrela
 * cheia com halo, "aprendendo" é anel, "próximo passo" é anel tracejado — e a
 * lista abaixo do mapa diz o estado por escrito.
 */
export const STATE_COLOR: Record<StarState, string> = {
  have: 'var(--series-4)',
  learning: 'var(--series-1)',
  next: 'var(--series-3)',
};
