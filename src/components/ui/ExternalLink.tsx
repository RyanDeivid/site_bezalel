import { ArrowUpRight } from 'lucide-react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useT } from '@/app/preferences-context';
import { cn } from '@/lib/cn';

/** Só permite http(s): bloqueia `javascript:`, `data:` e afins vindos de dados externos. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

interface ExternalLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> {
  href: string;
  children: ReactNode;
  showIcon?: boolean;
}

/**
 * Link para fora da plataforma: nova aba com `noopener noreferrer` (sem
 * acesso a window.opener e sem vazar a URL de origem) e aviso para leitores
 * de tela. URLs inseguras são renderizadas como texto simples.
 */
export function ExternalLink({ href, children, showIcon = true, className, ...rest }: ExternalLinkProps) {
  const m = useT();
  if (!isSafeExternalUrl(href)) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn('group/ext inline-flex items-center gap-1', className)} {...rest}>
      {children}
      {showIcon && (
        <ArrowUpRight aria-hidden className="size-3.5 shrink-0 transition-transform duration-200 group-hover/ext:-translate-y-0.5 group-hover/ext:translate-x-0.5" />
      )}
      <span className="sr-only"> {m.common.opensInNewTab}</span>
    </a>
  );
}
