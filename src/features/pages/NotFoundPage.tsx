import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { useT } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { PRIMARY_NAV } from '@/components/layout/nav-items';
import { ButtonLink } from '@/components/ui/Button';
import { ParticleField } from '@/components/visual/ParticleField';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export default function NotFoundPage() {
  const m = useT();
  useDocumentMeta({ title: m.meta.notFound.title, description: m.meta.notFound.description, noindex: true });
  return (
    <section className="relative overflow-hidden">
      <ParticleField density={0.6} className="opacity-60" />
      <div className="container-page page-enter relative grid min-h-[70vh] place-items-center py-20 text-center">
        <div className="max-w-xl">
          <div className="relative mx-auto w-fit">
            <span className="font-mono text-[7rem] font-medium leading-none tracking-tighter text-fg/10 md:text-[10rem]">{m.notFound.code}</span>
            <BezalelMark className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rotate-12 text-fg" />
          </div>
          <h1 className="text-title mt-6">{m.notFound.title}</h1>
          <p className="mt-4 text-fg-muted">{m.notFound.body}</p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {PRIMARY_NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm text-fg-muted hover:border-accent/50 hover:text-fg">
                  {m.nav[item.key]} <ArrowUpRight aria-hidden className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
          <ButtonLink to="/" className="mt-10" iconLeft={<ArrowLeft className="size-4" />}>
            {m.notFound.home}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
