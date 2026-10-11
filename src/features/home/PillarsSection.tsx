import { Compass, Hammer, Layers, ShieldCheck } from 'lucide-react';
import { useT } from '@/app/preferences-context';
import { Reveal } from '@/components/visual/Reveal';

const ICONS = [Compass, Layers, Hammer];

export function PillarsSection() {
  const m = useT();
  const p = m.home.pillars;
  return (
    <section className="container-page py-16 md:py-32">
      <Reveal>
        <p className="eyebrow">{p.eyebrow}</p>
        <h2 className="text-display mt-5 max-w-4xl">{p.title}</h2>
      </Reveal>
      <div className="bz-rail relative mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line md:mt-16 md:grid-cols-3">
        {p.items.map((item, i) => {
          const Icon = ICONS[i] ?? Compass;
          return (
            <Reveal key={item.title} delay={i * 120} className="group relative bg-bg p-8 transition-colors duration-500 hover:bg-surface md:p-10">
              <div className="flex items-start justify-between">
                <span className="font-serif-accent text-5xl leading-none text-accent-text/80 md:text-6xl">0{i + 1}</span>
                <span className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2 text-accent-text transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-6">
                  <Icon className="size-5" />
                </span>
              </div>
              <p className="mt-6 font-mono text-xs uppercase md:mt-10 tracking-[0.24em] text-fg-subtle">{item.verb}</p>
              <h3 className="mt-2 text-2xl font-semibold">{item.title}</h3>
              <p className="mt-4 leading-relaxed text-fg-muted">{item.text}</p>
              <span aria-hidden className="absolute inset-x-8 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-accent to-transparent transition-transform duration-700 group-hover:scale-x-100 md:inset-x-10" />
            </Reveal>
          );
        })}
      </div>
      <Reveal delay={200} className="mt-6 flex flex-col gap-4 rounded-2xl border border-ok/25 bg-ok-soft p-6 md:flex-row md:items-center md:gap-6">
        <ShieldCheck aria-hidden className="size-8 shrink-0 text-ok" />
        <div>
          <h3 className="font-semibold">{p.trustTitle}</h3>
          <p className="mt-1 text-fg-muted">{p.trustText}</p>
        </div>
      </Reveal>
    </section>
  );
}
