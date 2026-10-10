/**
 * Configuração pública da aplicação, lida de variáveis VITE_*.
 *
 * Tudo aqui vai para o JavaScript do navegador: NUNCA leia segredos neste
 * arquivo. Chaves de IA, service_role do Supabase e afins pertencem ao
 * backend (docs/SECURITY.md).
 */
export type DataMode = 'demo' | 'api';

/** Aceita apenas HTTPS (ou http://localhost em desenvolvimento). */
export function sanitizeApiUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

const requestedMode: DataMode = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'demo';
const apiBaseUrl = sanitizeApiUrl(import.meta.env.VITE_API_BASE_URL);

export const appConfig = {
  /** Sem URL de API válida, o modo API é recusado e a demo é usada. */
  dataMode: (requestedMode === 'api' && apiBaseUrl ? 'api' : 'demo') as DataMode,
  apiBaseUrl,
  siteOrigin: (import.meta.env.VITE_SITE_ORIGIN ?? '').replace(/\/+$/, ''),
  basePath: import.meta.env.BASE_URL,
  version: '1.0.0',
} as const;

/** Monta um caminho para arquivos de /public respeitando a base do GitHub Pages. */
export function assetUrl(path: string): string {
  return `${appConfig.basePath}${path.replace(/^\/+/, '')}`;
}

/** URL absoluta e canônica de uma rota (para metadados e compartilhamento). */
export function absoluteUrl(path: string): string {
  const base = appConfig.basePath.replace(/\/+$/, '');
  const clean = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}/`;
  const origin = appConfig.siteOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}${base}${clean}`;
}

/** URL absoluta de um arquivo de /public (ex.: imagem de compartilhamento). */
export function absoluteAssetUrl(path: string): string {
  const origin = appConfig.siteOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}${assetUrl(path)}`;
}
