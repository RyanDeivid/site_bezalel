/**
 * Pré-renderização (SSG). Compilado à parte com `vite build --ssr` e usado
 * apenas pelo scripts/postbuild.ts: gera o HTML completo de cada rota, que o
 * navegador pinta antes de o JavaScript chegar e o React depois hidrata
 * (main.tsx). Nada daqui vai para o bundle do navegador.
 */
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import { AppProviders } from '@/app/App';
import { routes } from '@/app/router';

const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

/**
 * Renderiza `path` (com a base, ex.: "/site_bezalel/explore/") no idioma e
 * tema padrão. Devolve null quando a rota responde com redirecionamento ou erro.
 */
export async function render(path: string): Promise<string | null> {
  const handler = createStaticHandler(routes, { basename });
  const context = await handler.query(new Request(`http://localhost${path}`));
  if (context instanceof Response || context.errors) return null;
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToString(
    <StrictMode>
      <AppProviders>
        <StaticRouterProvider router={router} context={context} hydrate={false} />
      </AppProviders>
    </StrictMode>,
  );
}
