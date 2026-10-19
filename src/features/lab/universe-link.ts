import type { Locale } from '@/types/domain';

/** Textos do atalho do laboratório para o Bezalel Universe (no chunk do laboratório). */
export const universeLink: Record<Locale, { label: string; short: string; lead: string }> = {
  'pt-BR': {
    label: 'Explorar o Bezalel Universe',
    short: 'Universe',
    lead: 'A cidade 3D da Bezalel: caminhe, dirija carros futuristas e visite a sede, este laboratório e o centro de produtos.',
  },
  en: {
    label: 'Explore the Bezalel Universe',
    short: 'Universe',
    lead: "Bezalel's 3D city: walk, drive futuristic cars and visit the headquarters, this lab and the products center.",
  },
};
