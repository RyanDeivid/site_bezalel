import { Link } from 'react-router';
import { useT } from '@/app/preferences-context';
import { cn } from '@/lib/cn';
import { BezalelMark } from './BezalelMark';

/** Logotipo tipográfico: caixa alta, espaçamento amplo, peso médio. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-sans text-[0.98rem] font-semibold uppercase leading-none tracking-[0.32em]', className)}>
      Bezalel
    </span>
  );
}

export function Logo({ className, to = '/' }: { className?: string; to?: string }) {
  const m = useT();
  return (
    <Link
      to={to}
      viewTransition
      className={cn('group inline-flex items-center gap-3 rounded-md text-fg', className)}
      aria-label={`${m.common.appName} — ${m.nav.home}`}
    >
      <BezalelMark className="size-8 transition-transform duration-500 ease-[var(--ease-out)] group-hover:rotate-[60deg]" />
      <Wordmark className="mr-[-0.32em]" />
    </Link>
  );
}
