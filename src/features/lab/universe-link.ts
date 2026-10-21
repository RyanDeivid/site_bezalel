import type { Locale } from '@/types/domain';

/** Textos do atalho do laboratório para o Bezalel Universe (no chunk do laboratório). */
export const universeLink: Record<Locale, { label: string; short: string; lead: string; exit: string; door: string }> = {
  'pt-BR': {
    label: 'Explorar o Bezalel Universe',
    short: 'Universe',
    lead: 'A cidade 3D da Bezalel: caminhe, dirija carros futuristas e visite a sede, este laboratório e o centro de produtos.',
    exit: 'Sair para o Bezalel Universe',
    door: 'Bezalel Universe',
  },
  en: {
    label: 'Explore the Bezalel Universe',
    short: 'Universe',
    lead: "Bezalel's 3D city: walk, drive futuristic cars and visit the headquarters, this lab and the products center.",
    exit: 'Step out into the Bezalel Universe',
    door: 'Bezalel Universe',
  },
};
