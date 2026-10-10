import { ArrowRight, Box } from 'lucide-react';
import { useT } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { ButtonLink } from '@/components/ui/Button';
import { BrandIntro } from '@/components/visual/BrandIntro';
import { DataStreams } from '@/components/visual/DataStreams';
import { Reveal } from '@/components/visual/Reveal';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { AgentsPreviewSection } from './AgentsPreviewSection';
import { CategoriesSection } from './CategoriesSection';
import { FeaturedSection } from './FeaturedSection';
import { HeroSection } from './HeroSection';
import { IndicatorsSection } from './IndicatorsSection';
import { LabPreviewSection } from './LabPreviewSection';
import { PillarsSection } from './PillarsSection';
import { SkillsSection } from './SkillsSection';
import { ValidationSection } from './ValidationSection';

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
      <HeroSection />
      <PillarsSection />
      <FeaturedSection />
      <CategoriesSection />
      <SkillsSection />
      <AgentsPreviewSection />
      <LabPreviewSection />
      <IndicatorsSection />
      <ValidationSection />

      <section className="relative overflow-hidden">
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
      </section>
    </>
  );
}
