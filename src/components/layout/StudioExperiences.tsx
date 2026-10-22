import { FlaskConical, Hammer, Landmark, Orbit, ScrollText, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { cn } from '@/lib/cn';
import { studioContent } from './studio-content';

type Key = 'forja' | 'origem' | 'lion' | 'lab' | 'universe';

const ITEMS: Array<{ key: Key; to: string; icon: LucideIcon }> = [
  { key: 'forja', to: '/', icon: Hammer },
  { key: 'origem', to: '/about#origem', icon: ScrollText },
  { key: 'lion', to: '/lion', icon: Landmark },
  { key: 'lab', to: '/lab', icon: FlaskConical },
  { key: 'universe', to: '/universe', icon: Orbit },
];

/**
 * Mapa das experiências da Bezalel: deixa claro que são obras de um mesmo
 * estúdio (e que o produto educacional é o centro delas), cada uma com a sua
 * personalidade — construção, história, luz, processos, exploração.
 */
export function StudioExperiences({ current, className }: { current?: Key; className?: string }) {
  const { locale } = usePreferences();
  const t = studioContent[locale];
  return (
    <section aria-labelledby="studio-title" className={cn('container-page py-16 md:py-20', className)}>
      <p className="eyebrow">{t.eyebrow}</p>
      <h2 id="studio-title" className="text-title mt-4 max-w-3xl">
        {t.title}
      </h2>
      <p className="mt-3 max-w-2xl text-fg-muted">{t.lead}</p>
      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ITEMS.map(({ key, to, icon: Icon }) => {
          const item = t.items[key];
          const here = key === current;
          return (
            <li key={key}>
              <Link
                to={to}
                aria-current={here ? 'page' : undefined}
                className={cn('panel group flex h-full flex-col gap-3 p-5 transition-colors hover:border-line-strong', here && 'border-accent/60 bg-accent-soft')}
              >
                <span className="flex items-center justify-between gap-2">
                  <Icon aria-hidden className="size-5 text-accent-text" />
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{here ? t.current : item.kind}</span>
                </span>
                <span className="font-semibold text-fg group-hover:text-accent-text">{item.name}</span>
                <span className="text-sm leading-relaxed text-fg-muted">{item.text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Ponte da origem (página Sobre) para o Leão de Judá: Bezalel era da tribo de Judá. */
export function LionBridge() {
  const { locale } = usePreferences();
  const b = studioContent[locale].bridge;
  return (
    <section aria-labelledby="lion-bridge" className="container-page pt-16 md:pt-20">
      <div className="panel relative overflow-hidden p-6 md:flex md:items-end md:justify-between md:gap-10 md:p-10">
        <div aria-hidden className="bg-blueprint absolute inset-0 opacity-50 [mask-image:linear-gradient(to_right,black,transparent)]" />
        <div className="relative max-w-2xl">
          <p className="eyebrow">{b.eyebrow}</p>
          <h2 id="lion-bridge" className="mt-4 font-serif-accent text-3xl leading-snug md:text-4xl">
            {b.title}
          </h2>
          <p className="mt-4 leading-relaxed text-fg-muted">{b.text}</p>
        </div>
        <Link to="/lion" className="relative mt-6 inline-flex shrink-0 items-center gap-2 rounded-xl border border-accent/60 px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-accent-soft md:mt-0">
          <Landmark aria-hidden className="size-4 text-accent-text" />
          {b.cta}
        </Link>
      </div>
    </section>
  );
}
