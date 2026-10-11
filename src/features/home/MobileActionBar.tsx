import { Box, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useT } from '@/app/preferences-context';

/**
 * Barra de ações no celular: aparece quando o elemento observado (na home,
 * a Forja inteira — cada ato já tem as próprias chamadas) sai da tela por
 * cima, e deixa "Buscar" e "Laboratório" ao alcance do polegar. Some ao
 * voltar e ao chegar no rodapé (que tem a própria navegação e não fica
 * coberto). Só existe abaixo de 768px.
 */
export function MobileActionBar({ watchId }: { watchId: string }) {
  const m = useT();
  const h = m.home.hero;
  const [pastHero, setPastHero] = useState(false);
  const [atFooter, setAtFooter] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(watchId);
    const footer = document.querySelector('footer');
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) setPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        else setAtFooter(entry.isIntersecting);
      }
    });
    io.observe(hero);
    if (footer) io.observe(footer);
    return () => io.disconnect();
  }, [watchId]);

  const shown = pastHero && !atFooter;

  return (
    <nav
      aria-label={h.mobileBarLabel}
      inert={!shown}
      data-shown={shown ? '' : undefined}
      className="bz-mobile-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="mx-auto flex max-w-md gap-2">
        <Link to="/explore" viewTransition className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent font-medium text-accent-fg active:scale-[0.98]">
          <Search aria-hidden className="size-4" />
          {h.mobileBarSearch}
        </Link>
        <Link to="/lab" viewTransition className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-4 font-medium text-fg active:scale-[0.98]">
          <Box aria-hidden className="size-4 text-accent-text" />
          {h.mobileBarLab}
        </Link>
      </div>
    </nav>
  );
}
