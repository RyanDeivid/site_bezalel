import type { Locale } from '@/types/domain';

// Textos aqui (chunk próprio, só baixado por quem tem estante ou trilha), fora do i18n global.
export const continueText: Record<Locale, { eyebrow: string; doing: string; trail: (done: number, total: number) => string; left: (n: number) => string; trailProgress: string; openTrail: string; openShelf: (n: number) => string; note: string }> = {
  'pt-BR': {
    eyebrow: 'Continue de onde parou',
    doing: 'Em andamento',
    trail: (done, total) => `Sua trilha: ${done} de ${total} concluídos`,
    left: (n) => (n === 1 ? 'falta 1' : `faltam ${n}`),
    trailProgress: 'Progresso da sua trilha',
    openTrail: 'Voltar à trilha',
    openShelf: (n) => (n === 1 ? 'Minha estante (1)' : `Minha estante (${n})`),
    note: 'Guardado só neste navegador, com o que você marcou.',
  },
  en: {
    eyebrow: 'Pick up where you left off',
    doing: 'In progress',
    trail: (done, total) => `Your path: ${done} of ${total} completed`,
    left: (n) => `${n} to go`,
    trailProgress: 'Your path progress',
    openTrail: 'Back to my path',
    openShelf: (n) => `My shelf (${n})`,
    note: 'Kept only in this browser, from what you marked.',
  },
};
