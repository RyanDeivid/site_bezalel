/** Evento que abre a paleta de comandos (Ctrl+K) a partir de qualquer lugar. */
export const PALETTE_EVENT = 'bz:palette';

/** Abre a paleta (ex.: botão de busca do cabeçalho). */
export const openPalette = () => window.dispatchEvent(new Event(PALETTE_EVENT));
