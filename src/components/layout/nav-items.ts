import type { Messages } from '@/i18n';

type NavKey = keyof Messages['nav'];

export interface NavItem {
  to: string;
  key: Extract<NavKey, 'explore' | 'trail' | 'skills' | 'universe' | 'insights' | 'agents' | 'lab' | 'assistant' | 'about' | 'methodology' | 'privacy' | 'terms' | 'home'>;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/explore', key: 'explore' },
  { to: '/trail', key: 'trail' },
  { to: '/skills', key: 'skills' },
  { to: '/insights', key: 'insights' },
  { to: '/agents', key: 'agents' },
  { to: '/lab', key: 'lab' },
  { to: '/assistant', key: 'assistant' },
];

/** Experiências fora do menu principal (que já tem sete itens): aparecem no rodapé e na busca. */
export const EXTRA_NAV: NavItem[] = [{ to: '/universe', key: 'universe' }];

export const INSTITUTIONAL_NAV: NavItem[] = [
  { to: '/about', key: 'about' },
  { to: '/methodology', key: 'methodology' },
  { to: '/privacy', key: 'privacy' },
  { to: '/terms', key: 'terms' },
];
