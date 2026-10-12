import { ArrowRight } from 'lucide-react';
import { useId } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { nextStepContent } from './next-step-content';

type Kind = 'explore' | 'course' | 'insights' | 'agents' | 'methodology' | 'about';

/**
 * Fechamento das páginas internas (pico-final, v2 · Fase 5): a página termina
 * num próximo passo claro — no máximo dois, para não virar outro cardápio —
 * em vez de um beco sem saída.
 */
export function NextStep({ kind, theme = '', primaryTo, secondaryTo, className }: { kind: Kind; theme?: string; primaryTo: string; secondaryTo?: string; className?: string }) {
  const { locale } = usePreferences();
  const t = nextStepContent[locale];
  const c = t[kind];
  const text = (v: string | ((theme: string) => string)) => (typeof v === 'function' ? v(theme) : v);
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('container-page py-16', className)}>
      <div className="panel flex flex-col items-start gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-2xl">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id={id} className="text-title mt-3">
            {text(c.title)}
          </h2>
          <p className="mt-3 text-fg-muted">{c.lead}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={primaryTo} iconRight={<ArrowRight className="size-4" />}>
            {text(c.primary)}
          </ButtonLink>
          {secondaryTo && (
            <ButtonLink to={secondaryTo} variant="secondary">
              {c.secondary}
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}
