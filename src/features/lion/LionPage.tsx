import { ArrowRight, BookOpen, Info, Palette } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePreferences, useT } from '@/app/preferences-context';
import { PageHero } from '@/components/layout/PageHero';
import { StudioExperiences } from '@/components/layout/StudioExperiences';
import { ButtonLink } from '@/components/ui/Button';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { lionContent } from './content';
import { LionStage } from './LionStage';

/** Um bloco de texto com o rótulo de quem fala: o texto bíblico, a explicação ou a interpretação artística. */
function Voice({ badge, icon, title, children }: { badge: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="panel p-6 md:p-8">
      <p className="inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 font-mono text-xs uppercase tracking-[0.14em] text-accent-text">
        {icon}
        {badge}
      </p>
      <h2 className="text-title mt-4">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-fg-muted">{children}</div>
    </section>
  );
}

/**
 * "O Leão da tribo de Judá": a escultura em 3D (sob demanda) e o texto que a
 * inspirou. Tudo o que importa está no HTML — o versículo, o contexto e o que
 * a escultura é —; o 3D é a experiência por cima, nunca a única porta.
 */
export default function LionPage() {
  const m = useT();
  const { locale } = usePreferences();
  const t = lionContent[locale];
  useDocumentMeta({ title: m.meta.lion.title, description: m.meta.lion.description, path: '/lion' });
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} particles={false} />
      <div className="container-page pt-10 md:pt-14">
        <LionStage />
      </div>
      <div className="container-page grid grid-cols-1 gap-6 py-16 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <Voice badge={t.textBadge} icon={<BookOpen aria-hidden className="size-3.5" />} title={t.textTitle}>
            <figure>
              <blockquote className="font-serif-accent text-2xl leading-snug text-fg md:text-3xl" lang={locale}>
                <p>“{t.verse}”</p>
              </blockquote>
              <figcaption className="mt-3 font-mono text-sm text-accent-text">{t.verseRef}</figcaption>
            </figure>
            <figure className="border-t border-line pt-4">
              <blockquote className="text-fg">
                <p>“{t.verseNext}”</p>
              </blockquote>
              <figcaption className="mt-2 font-mono text-sm text-accent-text">{t.verseNextRef}</figcaption>
            </figure>
            <p className="text-sm text-fg-subtle">{t.translation}</p>
          </Voice>
        </div>
        <div className="space-y-6 lg:col-span-5">
          <Voice badge={t.contextBadge} icon={<Info aria-hidden className="size-3.5" />} title={t.contextTitle}>
            {t.context.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="font-mono text-xs text-fg-subtle">{t.contextRefs}</p>
          </Voice>
        </div>
        <div className="lg:col-span-7">
          <Voice badge={t.artBadge} icon={<Palette aria-hidden className="size-3.5" />} title={t.artTitle}>
            {t.art.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </Voice>
        </div>
        <aside className="panel flex flex-col justify-between gap-6 p-6 md:p-8 lg:col-span-5">
          <div>
            <h2 className="font-semibold">{t.whyTitle}</h2>
            <p className="mt-3 leading-relaxed text-fg-muted">{t.why}</p>
          </div>
          <ButtonLink to="/about#origem" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
            {t.whyLink}
          </ButtonLink>
        </aside>
      </div>
      <StudioExperiences current="lion" className="pt-0" />
    </>
  );
}
