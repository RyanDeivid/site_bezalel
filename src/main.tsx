import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { matchRoutes } from 'react-router';
import { App } from '@/app/App';
import { routes } from '@/app/router';
import { loadCatalog } from '@/data/catalog/store';
import { appConfig } from '@/lib/env';
import '@/styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado.');

/**
 * O HTML de cada rota vem pré-renderizado (scripts/postbuild.ts) no idioma e
 * tema padrão. Hidratamos quando a página do visitante é exatamente essa —
 * sem filtros na URL e com as preferências padrão; nos demais casos o React
 * renderiza do zero por cima (o HTML já serviu para a primeira pintura).
 */
function canHydrate(): boolean {
  const d = document.documentElement;
  return container!.dataset.ssr === '1' && location.search === '' && d.lang === 'pt-BR' && d.dataset.motion !== 'reduced';
}

/** No modo demonstração os serviços são locais: o catálogo (chunk próprio) precisa estar pronto. */
const catalogReady = appConfig.dataMode === 'api' ? Promise.resolve() : loadCatalog().then(() => undefined);

async function start() {
  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );
  await catalogReady;
  if (!canHydrate()) {
    createRoot(container!).render(app);
    document.documentElement.dataset.hydrated = 'client';
    return;
  }
  // Rotas preguiçosas da página atual precisam estar carregadas antes da
  // hidratação, senão o primeiro render seria o fallback e não bateria com o HTML.
  const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
  const matches = matchRoutes(routes, window.location, basename) ?? [];
  await Promise.all(
    matches.map(async ({ route }) => {
      if (typeof route.lazy !== 'function') return;
      const resolved = await route.lazy();
      Object.assign(route, resolved, { lazy: undefined });
    }),
  );
  hydrateRoot(container!, app, {
    // Uma divergência entre o HTML e o primeiro render faz o React refazer a
    // página no cliente (sem quebrar nada). Fica registrada para os testes de
    // navegador, que exigem zero divergências.
    onRecoverableError: (error) => {
      const w = window as Window & { __bzRecoverableErrors?: string[] };
      (w.__bzRecoverableErrors ??= []).push(error instanceof Error ? error.message : String(error));
      if (import.meta.env.DEV) console.warn('[hidratação]', error);
    },
  });
  document.documentElement.dataset.hydrated = 'true';
}

start().catch((error: unknown) => {
  // Falha ao preparar a hidratação (ex.: chunk da rota indisponível): renderiza do zero.
  document.documentElement.dataset.hydrated = 'error';
  console.error(error);
  void catalogReady.finally(() =>
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
});

// Service worker (gerado no build): visitas seguintes instantâneas e páginas
// já vistas disponíveis sem rede. Registrado depois do carregamento, sem
// competir com a primeira pintura.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      /* sem service worker o site funciona igual */
    });
  });
}
