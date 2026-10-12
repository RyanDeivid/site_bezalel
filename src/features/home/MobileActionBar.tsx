import { Box, Search } from 'lucide-react';
import { Link } from 'react-router';
import { useT } from '@/app/preferences-context';
import { thumbPrimary, thumbSecondary } from '@/components/layout/thumb';
import { ThumbBar } from '@/components/layout/ThumbBar';

/**
 * Barra de ações da home no celular: aparece quando a Forja inteira (cada ato
 * já tem as próprias chamadas) sai da tela, com "Buscar" e "Laboratório" ao
 * alcance do polegar.
 */
export function MobileActionBar({ watchId }: { watchId: string }) {
  const h = useT().home.hero;
  return (
    <ThumbBar watchId={watchId} label={h.mobileBarLabel}>
      <Link to="/explore" viewTransition className={thumbPrimary}>
        <Search aria-hidden className="size-4" />
        {h.mobileBarSearch}
      </Link>
      <Link to="/lab" viewTransition className={thumbSecondary}>
        <Box aria-hidden className="size-4 text-accent-text" />
        {h.mobileBarLab}
      </Link>
    </ThumbBar>
  );
}
