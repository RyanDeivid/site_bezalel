/**
 * Cliente HTTP mínimo para o backend futuro (docs/ARCHITECTURE.md).
 * - Somente leitura pública; nenhuma credencial é enviada pelo navegador.
 * - Timeout por requisição e cancelamento via AbortSignal.
 * - Toda resposta é tratada como NÃO CONFIÁVEL e validada por guards.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type Guard<T> = (value: unknown) => value is T;

export interface HttpClient {
  get<T>(path: string, guard: Guard<T>, init?: { signal?: AbortSignal; params?: URLSearchParams }): Promise<T>;
  post<T>(path: string, body: unknown, guard: Guard<T>, init?: { signal?: AbortSignal }): Promise<T>;
  url(path: string): string;
}

export function createHttpClient(baseUrl: string, timeoutMs = 10_000): HttpClient {
  const url = (path: string) => `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  async function request<T>(path: string, init: RequestInit, guard: Guard<T>, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
    try {
      const res = await fetch(url(path), {
        ...init,
        signal: controller.signal,
        credentials: 'omit',
        headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      });
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
      const data: unknown = await res.json();
      if (!guard(data)) throw new ApiError('Resposta da API em formato inesperado', 502);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    url,
    get: (path, guard, init) => {
      const qs = init?.params?.toString();
      return request(qs ? `${path}?${qs}` : path, { method: 'GET' }, guard, init?.signal);
    },
    post: (path, body, guard, init) => request(path, { method: 'POST', body: JSON.stringify(body) }, guard, init?.signal),
  };
}
