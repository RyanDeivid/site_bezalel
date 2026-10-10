import type { Messages } from '@/i18n';

type NavKey = keyof Messages['nav'];

export interface NavItem {
  to: string;
  key: Extract<NavKey, 'explore' | 'insights' | 'agents' | 'lab' | 'assistant' | 'about' | 'methodology' | 'privacy' | 'terms' | 'home'>;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/explore', key: 'explore' },
  { to: '/insights', key: 'insights' },
  { to: '/agents', key: 'agents' },
  { to: '/lab', key: 'lab' },
  { to: '/assistant', key: 'assistant' },
];

export const INSTITUTIONAL_NAV: NavItem[] = [
  { to: '/about', key: 'about' },
  { to: '/methodology', key: 'methodology' },
  { to: '/privacy', key: 'privacy' },
  { to: '/terms', key: 'terms' },
];
