import { ArrowRight, Check, FlaskConical, ShieldCheck } from 'lucide-react';
import { useT } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { PageHero } from '@/components/layout/PageHero';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/visual/Reveal';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { OrigemSection } from '../about/origem/OrigemSection';

export default function AboutPage() {
  const m = useT();
  const a = m.about;
  useDocumentMeta({ title: m.meta.about.title, description: m.meta.about.description, path: '/about' });

  return (
    <>
      <PageHero
        eyebrow={a.eyebrow}
        title={a.title}
        lead={a.lead}
        aside={
          <div className="relative mx-auto grid aspect-square w-full max-w-sm place-items-center">
            <div aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(199_168_106/0.18),transparent_65%)]" />
            <BezalelMark animated className="relative size-48 text-fg" />
          </div>
        }
      />

      {/* A origem do nome, construída pelo visitante com a manivela. */}
      <OrigemSection />

      <div className="container-page grid grid-cols-1 gap-16 py-20 lg:grid-cols-12">
        <div className="space-y-16 lg:col-span-7">
          <Reveal as="section">
            <h2 className="eyebrow">{a.missionTitle}</h2>
            <p className="mt-5 font-serif-accent text-3xl leading-snug text-fg md:text-4xl">{a.mission}</p>
          </Reveal>
          <Reveal as="section">
            <h2 className="text-title">{a.reliabilityTitle}</h2>
            {a.reliability.map((p) => (
              <p key={p} className="mt-4 leading-relaxed text-fg-muted">
                {p}
              </p>
            ))}
          </Reveal>
          <Reveal as="section">
            <h2 className="text-title">{a.agentsTitle}</h2>
            <p className="mt-4 leading-relaxed text-fg-muted">{a.agents}</p>
          </Reveal>
          <Reveal as="section">
            <h2 className="text-title">{a.labTitle}</h2>
            <p className="mt-4 leading-relaxed text-fg-muted">{a.lab}</p>
          </Reveal>
        </div>

        <aside className="space-y-6 lg:col-span-5">
          <Reveal className="panel p-6">
            <h2 className="font-semibold">{a.commitmentsTitle}</h2>
            <ul className="mt-4 space-y-3">
              {a.commitments.map((c) => (
                <li key={c} className="flex items-start gap-3 text-sm text-fg-muted">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
                  {c}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="panel overflow-hidden" delay={100}>
            <h2 className="border-b border-line px-6 py-4 font-semibold">{a.statusTitle}</h2>
            <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-1">
              <div className="bg-surface p-6">
                <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-ok">
                  <ShieldCheck aria-hidden className="size-4" /> {a.statusReal}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-fg-muted">
                  {a.statusRealItems.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
              <div className="hatch-demo bg-surface p-6">
                <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-demo">
                  <FlaskConical aria-hidden className="size-4" /> {a.statusDemoTitle}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-fg-muted">
                  {a.statusDemoItems.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
          <ButtonLink to="/methodology" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
            {a.cta}
          </ButtonLink>
        </aside>
      </div>
    </>
  );
}
