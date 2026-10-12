import { useEffect, useState, type ReactNode } from 'react';

/**
 * Barra de ações na zona do polegar (celular, abaixo de 768px). Aparece
 * quando o elemento observado — onde as mesmas ações já estão no topo da
 * página — sai da tela por cima, e some ao voltar e ao chegar no rodapé
 * (que tem a própria navegação e não fica coberto). Nunca cobre conteúdo
 * que o visitante ainda não viu: só repete ações que ele acabou de passar.
 */
export function ThumbBar({ watchId, label, children }: { watchId: string; label: string; children: ReactNode }) {
  const [past, setPast] = useState(false);
  const [atFooter, setAtFooter] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watchId);
    const footer = document.querySelector('footer');
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === target) setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        else setAtFooter(entry.isIntersecting);
      }
    });
    io.observe(target);
    if (footer) io.observe(footer);
    return () => io.disconnect();
  }, [watchId]);

  const shown = past && !atFooter;
  return (
    <nav
      aria-label={label}
      inert={!shown}
      data-shown={shown ? '' : undefined}
      className="bz-mobile-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="mx-auto flex max-w-md gap-2">{children}</div>
    </nav>
  );
}
