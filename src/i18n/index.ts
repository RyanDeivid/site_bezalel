import type { Locale } from '@/types/domain';
import { catalog as enCatalog } from './en/catalog';
import { common as enCommon } from './en/common';
import { home as enHome } from './en/home';
import { institutional as enInstitutional } from './en/institutional';
import { intelligence as enIntelligence } from './en/intelligence';
import { lab as enLab } from './en/lab';
import { catalog as ptCatalog } from './pt-BR/catalog';
import { common as ptCommon } from './pt-BR/common';
import { home as ptHome } from './pt-BR/home';
import { institutional as ptInstitutional } from './pt-BR/institutional';
import { intelligence as ptIntelligence } from './pt-BR/intelligence';
import { lab as ptLab } from './pt-BR/lab';
import type { Widen } from './types';

const ptBR = {
  ...ptCommon,
  ...ptHome,
  ...ptCatalog,
  ...ptIntelligence,
  ...ptLab,
  ...ptInstitutional,
};

export type Messages = Widen<typeof ptBR>;

const en: Messages = {
  ...enCommon,
  ...enHome,
  ...enCatalog,
  ...enIntelligence,
  ...enLab,
  ...enInstitutional,
};

export const messages: Record<Locale, Messages> = { 'pt-BR': ptBR, en };

export const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'en'];
export const DEFAULT_LOCALE: Locale = 'pt-BR';

export function isLocale(value: unknown): value is Locale {
  return value === 'pt-BR' || value === 'en';
}
