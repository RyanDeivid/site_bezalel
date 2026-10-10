import { useRouteError } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';

/**
 * Fronteira de erro das rotas. Fica fora do layout para funcionar mesmo se
 * o próprio layout falhar; usa links simples (recarregam a página).
 */
export function RouteError() {
  const error = useRouteError();
  const { m } = usePreferences();
  if (import.meta.env.DEV) console.error(error);
  const base = import.meta.env.BASE_URL;
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-fg">
      <div className="max-w-md">
        <BezalelMark className="mx-auto size-14" />
        <h1 className="mt-8 text-2xl font-semibold">{m.routeError.title}</h1>
        <p className="mt-3 text-fg-muted">{m.routeError.body}</p>
        <div className="mt-8 flex justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="h-10 rounded-lg bg-accent px-4 font-medium text-accent-fg">
            {m.routeError.reload}
          </button>
          <a href={base} className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4">
            {m.routeError.home}
          </a>
        </div>
      </div>
    </main>
  );
}
