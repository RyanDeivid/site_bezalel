import { appConfig } from '@/lib/env';
import { createHttpServices } from './http';
import { createLocalServices } from './local';
import type { Services } from './types';

/** Escolhe a implementação conforme a configuração pública (VITE_DATA_MODE). */
export function createServices(): Services {
  if (appConfig.dataMode === 'api' && appConfig.apiBaseUrl) return createHttpServices(appConfig.apiBaseUrl);
  return createLocalServices();
}

export type * from './types';
