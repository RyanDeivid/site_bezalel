import { ArrowRight, Box } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { useT } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { ButtonLink } from '@/components/ui/Button';
import { BrandIntro } from '@/components/visual/BrandIntro';
import { DataStreams } from '@/components/visual/DataStreams';
import { Reveal } from '@/components/visual/Reveal';
import { useAnimationGate } from '@/hooks/useAnimationGate';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { cn } from '@/lib/cn';
import { AgentsPreviewSection } from './AgentsPreviewSection';
import { CategoriesSection } from './CategoriesSection';
import { ContinueGate } from './ContinueGate';
import { FeaturedSection } from './FeaturedSection';
import { ForjaSection } from './forja/ForjaSection';
import { IndicatorsSection } from './IndicatorsSection';
import { LabPreviewSection } from './LabPreviewSection';
import { MobileActionBar } from './MobileActionBar';
import { PillarsSection } from './PillarsSection';
import { SkillsSection } from './SkillsSection';
import { ValidationSection } from './ValidationSection';

/**
 * Bloco abaixo da primeira dobra: renderização adiada pelo navegador
 * (content-visibility) e animações decorativas só enquanto está na tela.
 */
function Deferred({ as: Tag = 'div', className, children }: { as?: 'div' | 'section'; className?: string; children: ReactNode }) {
  const ref = useAnimationGate<HTMLDivElement>();
  return (
    <Tag ref={ref} className={cn('bz-defer', className)}>
      {children}
    </Tag>
  );
}

export function HomePage() {
  const m = useT();
  useDocumentMeta({
    title: m.meta.home.title,
    description: m.meta.home.description,
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Bezalel',
      slogan: 'Discover. Learn. Build.',
      description: m.meta.home.description,
      inLanguage: 'pt-BR',
    },
  });

  return (
    <>
      <BrandIntro />
      <ForjaSection />
      {/* Só para quem volta (estante/trilha neste navegador); entra depois da hidratação, abaixo da dobra. */}
      <ContinueGate />
      {/* Abaixo da primeira dobra: o navegador adia estilo/layout/pintura
          (content-visibility) e cada <Suspense> vira uma etapa separada da
          hidratação — o topo fica interativo antes e sem tarefas longas. */}
      {[PillarsSection, FeaturedSection, CategoriesSection, SkillsSection, AgentsPreviewSection, LabPreviewSection, IndicatorsSection, ValidationSection].map((Section, i) => (
        <Suspense key={i} fallback={null}>
          <Deferred>
            <Section />
          </Deferred>
        </Suspense>
      ))}

      <Deferred as="section" className="relative overflow-hidden">
        <DataStreams className="opacity-70" />
        <div className="container-page relative py-28 text-center md:py-36">
          <Reveal className="mx-auto flex max-w-3xl flex-col items-center">
            <BezalelMark className="size-14 text-fg" />
            <h2 className="text-display mt-8">{m.home.final.title}</h2>
            <p className="mt-5 text-lg text-fg-muted">{m.home.final.lead}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <ButtonLink to="/explore" size="lg" iconRight={<ArrowRight className="size-4" />}>
                {m.home.hero.ctaPrimary}
              </ButtonLink>
              <ButtonLink to="/lab" size="lg" variant="secondary" iconLeft={<Box className="size-4" />}>
                {m.home.hero.ctaSecondary}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </Deferred>
      <MobileActionBar watchId="forja" />
    </>
  );
}
