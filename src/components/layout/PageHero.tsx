import type { ReactNode } from 'react';
import { ParticleField } from '@/components/visual/ParticleField';
import { cn } from '@/lib/cn';

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  /** Mostra a rede de partículas ao fundo. */
  particles?: boolean;
  className?: string;
}

/** Cabeçalho das páginas internas: rótulo técnico, título expressivo e texto de apoio. */
export function PageHero({ eyebrow, title, lead, children, aside, particles = true, className }: PageHeroProps) {
  return (
    <section className={cn('relative overflow-hidden border-b border-line', className)}>
      <div aria-hidden className="bg-blueprint absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
      {particles && <ParticleField density={0.55} className="opacity-70" seed={21} />}
      <div className="container-page relative grid grid-cols-1 gap-10 py-14 md:py-20 lg:grid-cols-12 lg:items-end">
        <div className={cn('page-enter', aside ? 'lg:col-span-7' : 'lg:col-span-9')}>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-display mt-5">{title}</h1>
          {lead && <div className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted">{lead}</div>}
          {children && <div className="mt-8">{children}</div>}
        </div>
        {aside && <div className="page-enter lg:col-span-5 [animation-delay:120ms]">{aside}</div>}
      </div>
    </section>
  );
}

export function SectionHeader({ eyebrow, title, lead, action, className }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="text-title mt-4">{title}</h2>
        {lead && <p className="mt-3 text-fg-muted">{lead}</p>}
      </div>
      {action}
    </div>
  );
}
