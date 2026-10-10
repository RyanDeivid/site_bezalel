import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, isLocale, messages } from '@/i18n';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { readStorage, writeStorage } from '@/lib/storage';
import type { Locale } from '@/types/domain';
import { PreferencesContext, type MotionPreference, type PreferencesValue, type Theme } from './preferences-context';

const THEME_KEY = 'bz-theme';
const LOCALE_KEY = 'bz-locale';
const MOTION_KEY = 'bz-motion';

function initialTheme(): Theme {
  // O script inline do index.html já aplicou o tema antes da pintura.
  const attr = typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined;
  return attr === 'light' ? 'light' : 'dark';
}

function initialLocale(): Locale {
  const stored = readStorage(LOCALE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

function initialMotion(): MotionPreference {
  return readStorage(MOTION_KEY) === 'reduced' ? 'reduced' : 'full';
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [motion, setMotion] = useState<MotionPreference>(initialMotion);
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101b2b' : '#f6f1e7');
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (motion === 'reduced') document.documentElement.dataset.motion = 'reduced';
    else delete document.documentElement.dataset.motion;
  }, [motion]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      writeStorage(THEME_KEY, next);
      return next;
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    writeStorage(LOCALE_KEY, next);
    setLocaleState(next);
  }, []);

  const toggleMotion = useCallback(() => {
    setMotion((v) => {
      const next = v === 'full' ? 'reduced' : 'full';
      writeStorage(MOTION_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({
      theme,
      toggleTheme,
      locale,
      setLocale,
      motion,
      toggleMotion,
      reducedMotion: systemReduced || motion === 'reduced',
      m: messages[locale],
    }),
    [theme, toggleTheme, locale, setLocale, motion, toggleMotion, systemReduced],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
