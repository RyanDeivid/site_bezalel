import { createContext, useContext } from 'react';
import type { Messages } from '@/i18n';
import type { Locale } from '@/types/domain';

export type Theme = 'dark' | 'light';
export type MotionPreference = 'full' | 'reduced';

export interface PreferencesValue {
  theme: Theme;
  toggleTheme: () => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Preferência explícita do usuário no site. */
  motion: MotionPreference;
  toggleMotion: () => void;
  /** Verdadeiro se o sistema OU o usuário pediram menos movimento. */
  reducedMotion: boolean;
  m: Messages;
}

export const PreferencesContext = createContext<PreferencesValue | null>(null);

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences precisa estar dentro de <PreferencesProvider>.');
  return value;
}

/** Atalho para as mensagens do idioma ativo. */
export function useT(): Messages {
  return usePreferences().m;
}
