import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { useT } from '@/app/preferences-context';
import { DemoBanner } from './DemoBanner';
import { Footer } from './Footer';
import { Header } from './Header';
import { RouteFallback } from './RouteFallback';

/**
 * Estrutura comum a todas as páginas. Após cada navegação, o título da nova
 * página é anunciado numa região aria-live e o foco vai para o <main>, para
 * que leitores de tela percebam a troca de rota em uma SPA.
 */
export function RootLayout() {
  const m = useT();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      setAnnouncement(document.title);
      mainRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only z-[70] rounded-md bg-accent px-4 py-2 font-medium text-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {m.nav.skipToContent}
      </a>
      <DemoBanner />
      <Header />
      <main id="conteudo" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {/* Entradas carregadas direto (F5/link externo) recebem a chave "default";
          usar o caminho nesses casos evita herdar a rolagem de outra página. */}
      <ScrollRestoration getKey={(loc) => (loc.key === 'default' ? loc.pathname : loc.key)} />
    </div>
  );
}
