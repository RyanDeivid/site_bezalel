import { FlaskConical, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useT } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { Wordmark } from '@/components/brand/Logo';
import { appConfig } from '@/lib/env';
import { INSTITUTIONAL_NAV, PRIMARY_NAV } from './nav-items';

export function Footer() {
  const m = useT();
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-16 overflow-hidden md:mt-24 border-t border-line bg-bg-deep">
      <div aria-hidden className="bg-blueprint absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="container-page relative grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-12 md:gap-12 md:py-16">
        <div className="col-span-2 md:col-span-4">
          <div className="flex items-center gap-3">
            <BezalelMark className="size-10" />
            <Wordmark className="text-lg" />
          </div>
          <p className="mt-3 font-serif-accent text-2xl text-accent-text">{m.common.slogan}</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg-muted">{m.footer.about}</p>
        </div>

        <nav aria-label={m.footer.product} className="md:col-span-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">{m.footer.product}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {PRIMARY_NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-fg-muted transition-colors hover:text-fg">
                  {item.key === 'assistant' ? m.nav.assistantLong : m.nav[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={m.footer.experiences} className="md:col-span-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">{m.footer.experiences}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {(
              [
                ['/', 'forja'],
                ['/about#origem', 'origem'],
                ['/lion', 'lion'],
              ] as const
            ).map(([to, key]) => (
              <li key={key}>
                <Link to={to} className="text-fg-muted transition-colors hover:text-fg">
                  {m.footer.experienceLinks[key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={m.footer.institutional} className="md:col-span-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">{m.footer.institutional}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {INSTITUTIONAL_NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-fg-muted transition-colors hover:text-fg">
                  {m.nav[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="col-span-2 md:col-span-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-fg-subtle">{m.footer.transparency}</h2>
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">{m.footer.transparencyText}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok-soft px-2.5 py-1 text-ok">
              <ShieldCheck aria-hidden className="size-3.5" /> {m.common.curated}
            </span>
            <span className="hatch-demo inline-flex items-center gap-1.5 rounded-full border border-demo/40 px-2.5 py-1 text-demo">
              <FlaskConical aria-hidden className="size-3.5" /> {m.common.demo}
            </span>
          </div>
        </div>
      </div>
      <div className="container-page relative flex flex-col gap-2 border-t border-line py-6 text-xs text-fg-subtle md:flex-row md:items-center md:justify-between">
        <p>
          © {year} {m.footer.rights}
        </p>
        <p className="font-mono">
          {m.footer.version} · {appConfig.dataMode === 'api' ? 'API' : 'demo'} · {m.footer.builtWith}
        </p>
      </div>
    </footer>
  );
}
