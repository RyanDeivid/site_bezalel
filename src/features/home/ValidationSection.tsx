import { ArrowRight, Check, CircleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { PUBLICATION_TONE } from '@/components/data/DataBadges';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/visual/Reveal';
import type { ValidationCheckId } from '@/domain/pipeline';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/cn';
import type { PublicationStatus } from '@/types/domain';

const STEPS: PublicationStatus[] = ['found', 'validating', 'approved', 'published'];
const BLOCKING: ValidationCheckId[] = ['has-title', 'has-provider', 'https-url', 'trusted-source', 'safe-content', 'fresh'];
const WARNINGS: ValidationCheckId[] = ['known-category', 'price-declared', 'description-length'];

/** Demonstração animada do ciclo de vida de um registro (exemplo fictício). */
export function ValidationSection() {
  const { m, reducedMotion } = usePreferences();
  const v = m.home.validation;
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0.3 });
  const [step, setStep] = useState(0);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = pinned ?? step;

  useEffect(() => {
    if (!inView || reducedMotion || pinned !== null) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2200);
    return () => clearInterval(t);
  }, [inView, reducedMotion, pinned]);

  const status = STEPS[active] ?? 'found';
  const checksDone = active >= 1 ? (active === 1 ? 3 : BLOCKING.length) : 0;

  return (
    <section className="relative overflow-hidden border-y border-line bg-bg-deep py-14 md:py-28">
      <div aria-hidden className="bg-blueprint absolute inset-0 opacity-40" />
      <div className="container-page relative">
        <Reveal className="max-w-3xl">
          <p className="eyebrow">{v.eyebrow}</p>
          <h2 className="text-title mt-4">{v.title}</h2>
          <p className="mt-4 text-fg-muted">{v.lead}</p>
        </Reveal>

        <div ref={ref} className="mt-10 grid grid-cols-1 gap-8 md:mt-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ol aria-label={v.stepsLabel} className="relative grid grid-cols-4 gap-2">
              <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-5 h-px bg-line-strong" />
              {/* Progresso por scaleX (compositor), não por width (layout a cada quadro). */}
              <span
                aria-hidden
                className="absolute left-[12.5%] top-5 h-px w-3/4 origin-left bg-accent transition-transform duration-700 ease-[var(--ease-out)]"
                style={{ transform: `scaleX(${active / (STEPS.length - 1)})` }}
              />
              {STEPS.map((s, i) => (
                <li key={s} className="relative flex flex-col items-center text-center">
                  <button
                    type="button"
                    onClick={() => setPinned(pinned === i ? null : i)}
                    aria-pressed={pinned === i}
                    aria-current={i === active ? 'step' : undefined}
                    className={cn(
                      'relative z-10 grid size-10 place-items-center rounded-full border-2 font-mono text-sm transition-[transform,background-color,border-color,color] duration-500',
                      i < active && 'border-accent bg-accent text-accent-fg',
                      i === active && 'scale-110 border-accent bg-bg text-accent-text shadow-[var(--glow-accent)]',
                      i > active && 'border-line-strong bg-bg text-fg-subtle',
                    )}
                  >
                    {i < active ? <Check className="size-4" /> : i + 1}
                  </button>
                  <span className={cn('mt-3 text-xs font-medium sm:text-sm', i === active ? 'text-fg' : 'text-fg-muted')}>{m.enums.publicationStatus[s]}</span>
                </li>
              ))}
            </ol>

            <div className="panel mt-10 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <p className="font-mono text-[0.7rem] uppercase tracking-wider text-fg-subtle">{v.example}</p>
                  <p className="truncate font-medium">{v.exampleTitle}</p>
                </div>
                <div className="flex gap-2">
                  <Badge tone="demo">{m.common.demo}</Badge>
                  <Badge key={status} tone={PUBLICATION_TONE[status]} pulse={status === 'validating'} className="page-enter">
                    {m.enums.publicationStatus[status]}
                  </Badge>
                </div>
              </div>
              {/* Só anuncia mudanças pedidas pelo visitante; o ciclo automático não fala sem parar. */}
              <p className="px-5 py-4 text-sm text-fg-muted" aria-live={pinned !== null ? 'polite' : 'off'}>
                {m.enums.publicationStatusHelp[status]}
              </p>
              <div className="h-1 overflow-hidden bg-surface-2">
                <div className="h-full origin-left bg-accent transition-transform duration-700" style={{ transform: `scaleX(${(active + 1) / STEPS.length})` }} />
              </div>
            </div>
          </div>

          <div className="bz-rail bz-rail-bleed grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            <div className="panel p-5">
              <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{v.blocking}</h3>
              <ul className="mt-4 space-y-2.5">
                {BLOCKING.map((id, i) => (
                  <li key={id} className="flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-500',
                        i < checksDone ? 'border-ok bg-ok-soft text-ok' : 'border-line-strong text-fg-subtle',
                      )}
                    >
                      {i < checksDone ? <Check className="size-3" /> : <X className="size-3 opacity-0" />}
                    </span>
                    <span className={i < checksDone ? 'text-fg' : 'text-fg-muted'}>{m.validationChecks[id].name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel p-5">
              <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{v.warnings}</h3>
              <ul className="mt-4 space-y-2.5">
                {WARNINGS.map((id) => (
                  <li key={id} className="flex items-center gap-3 text-sm text-fg-muted">
                    <CircleAlert aria-hidden className="size-4 shrink-0 text-warn" />
                    {m.validationChecks[id].name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <ButtonLink to="/methodology" variant="secondary" className="mt-10" iconRight={<ArrowRight className="size-4" />}>
          {v.cta}
        </ButtonLink>
      </div>
    </section>
  );
}
