import { FlaskConical, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useT } from '@/app/preferences-context';
import { writeStorage } from '@/lib/storage';

const KEY = 'bz-demo-banner-v1';

/**
 * Aviso permanente (dispensável) de que agentes e eventos são simulados nesta
 * versão. A marcação é sempre a mesma (o HTML pré-gerado não conhece o
 * visitante); quem já dispensou recebe `data-banner="off"` no <html> pelo
 * script do index.html, e o CSS esconde o aviso antes da primeira pintura.
 */
export function DemoBanner() {
  const m = useT();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="bz-demo-banner hatch-demo relative border-b border-demo/25 text-[0.8rem] text-fg-muted">
      <div className="container-page flex min-h-9 items-center gap-3 py-1.5 pr-10">
        <FlaskConical aria-hidden className="size-3.5 shrink-0 text-demo" />
        <p className="leading-snug">
          {m.banner.text}{' '}
          <Link to="/methodology" className="whitespace-nowrap font-medium text-fg underline decoration-demo/60 underline-offset-2 hover:decoration-demo">
            {m.banner.link}
          </Link>
        </p>
        <button
          type="button"
          onClick={() => {
            writeStorage(KEY, 'dismissed');
            document.documentElement.dataset.banner = 'off';
            setHidden(true);
          }}
          className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
          aria-label={m.banner.dismiss}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
