import { CircleAlert, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { PUBLICATION_TONE } from '@/components/data/DataBadges';
import { NextStep } from '@/components/layout/NextStep';
import { PageHero } from '@/components/layout/PageHero';
import { Badge } from '@/components/ui/Badge';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { PIPELINE_STAGES, PUBLICATION_TRANSITIONS, type ValidationCheckId } from '@/domain/pipeline';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useServices } from '@/services/context';
import { runDemoPipeline } from '@/services/catalog/demo-registry';
import { StateMachineDiagram } from './StateMachineDiagram';

const CHECKS: Array<{ id: ValidationCheckId; blocking: boolean }> = [
  { id: 'has-title', blocking: true },
  { id: 'has-provider', blocking: true },
  { id: 'https-url', blocking: true },
  { id: 'trusted-source', blocking: true },
  { id: 'safe-content', blocking: true },
  { id: 'fresh', blocking: true },
  { id: 'known-category', blocking: false },
  { id: 'price-declared', blocking: false },
  { id: 'description-length', blocking: false },
];

export default function MethodologyPage() {
  const { m } = usePreferences();
  const t = m.methodology;
  const services = useServices();
  const sources = useAsync(() => services.sources.list(), []);
  const run = useMemo(() => runDemoPipeline(new Date()), []);
  useDocumentMeta({ title: m.meta.methodology.title, description: m.meta.methodology.description, path: '/methodology' });

  const sections = [
    ['curation', t.curation.title],
    ['badges', t.badges.title],
    ['rules', t.rules.title],
    ['pipeline', t.pipeline.title],
    ['checks', t.checks.title],
    ['quality', t.quality.title],
    ['states', t.states.title],
    ['dedupe', t.dedupe.title],
    ['freshness', t.freshness.title],
    ['collection', t.collection.title],
    ['example', t.example.title],
    ['limits', t.limits.title],
  ] as const;

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className="container-page grid grid-cols-1 gap-12 py-16 lg:grid-cols-[15rem_1fr]">
        <nav aria-label={t.toc} className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h)+1.5rem)]">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{t.toc}</p>
            <ol className="mt-4 space-y-2 border-l border-line text-sm">
              {sections.map(([id, title], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="-ml-px block border-l border-transparent pl-4 text-fg-muted transition-colors hover:border-accent hover:text-fg">
                    <span className="font-mono text-xs text-fg-subtle">{String(i + 1).padStart(2, '0')}</span> {title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="min-w-0 space-y-16 [&_h2]:scroll-mt-28">
          <section id="curation">
            <h2 className="text-title">{t.curation.title}</h2>
            {t.curation.body.map((p) => (
              <p key={p} className="mt-4 max-w-prose leading-relaxed text-fg-muted">
                {p}
              </p>
            ))}
            <h3 className="mt-8 font-semibold">{t.curation.sourcesTitle}</h3>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sources.data
                ?.filter((s) => s.origin === 'curated')
                .map((s) => (
                  <li key={s.id} className="rounded-lg border border-line px-4 py-3 text-sm">
                    <ExternalLink href={s.url} className="font-medium hover:text-accent-text">
                      {s.name}
                    </ExternalLink>
                  </li>
                ))}
            </ul>
          </section>

          <section id="badges">
            <h2 className="text-title">{t.badges.title}</h2>
            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {t.badges.items.map((b, i) => (
                <div key={b.name} className="panel p-5">
                  <dt>
                    <Badge tone={(['ok', 'info', 'warn', 'demo'] as const)[i] ?? 'neutral'}>{b.name}</Badge>
                  </dt>
                  <dd className="mt-3 text-sm text-fg-muted">{b.text}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="rules">
            <h2 className="text-title">{t.rules.title}</h2>
            <ol className="mt-6 space-y-3">
              {t.rules.items.map((r, i) => (
                <li key={r} className="flex gap-4 text-fg-muted">
                  <span className="font-mono text-sm text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                  {r}
                </li>
              ))}
            </ol>
          </section>

          <section id="pipeline">
            <h2 className="text-title">{t.pipeline.title}</h2>
            <p className="mt-4 max-w-prose text-fg-muted">{t.pipeline.lead}</p>
            <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PIPELINE_STAGES.map((stage, i) => (
                <li key={stage} className="relative rounded-xl border border-line bg-surface p-5">
                  <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-2 font-semibold">{m.pipelineStages[stage].name}</p>
                  <p className="mt-1 text-sm text-fg-muted">{m.pipelineStages[stage].help}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="checks">
            <h2 className="text-title">{t.checks.title}</h2>
            <p className="mt-4 max-w-prose text-fg-muted">{t.checks.lead}</p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-surface-2 text-xs uppercase tracking-wider text-fg-subtle">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">{t.checks.criterion}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t.checks.severity}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t.checks.description}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {CHECKS.map(({ id, blocking }) => (
                    <tr key={id}>
                      <th scope="row" className="px-4 py-3 font-medium">{m.validationChecks[id].name}</th>
                      <td className="px-4 py-3">
                        {blocking ? (
                          <span className="inline-flex items-center gap-1.5 text-danger">
                            <ShieldAlert aria-hidden className="size-4" /> {t.checks.blocking}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-warn">
                            <CircleAlert aria-hidden className="size-4" /> {t.checks.warning}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-fg-muted">{m.validationChecks[id].help}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="quality">
            <h2 className="text-title">{t.quality.title}</h2>
            {t.quality.body.map((p) => (
              <p key={p} className="mt-4 max-w-prose leading-relaxed text-fg-muted">
                {p}
              </p>
            ))}
            <div className="mt-6 flex h-10 max-w-xl overflow-hidden rounded-lg border border-line font-mono text-xs">
              <span className="grid flex-[60] place-items-center bg-accent-soft text-accent-text">60 · validação/validation</span>
              <span className="grid flex-[40] place-items-center bg-info-soft text-info">40 · completude/completeness</span>
            </div>
          </section>

          <section id="states">
            <h2 className="text-title">{t.states.title}</h2>
            <p className="mt-4 text-fg-muted">{t.states.lead}</p>
            <StateMachineDiagram transitions={PUBLICATION_TRANSITIONS} />
            <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(Object.keys(PUBLICATION_TRANSITIONS) as Array<keyof typeof PUBLICATION_TRANSITIONS>).map((s) => (
                <div key={s} className="flex items-start gap-3 rounded-lg border border-line p-4">
                  <dt>
                    <Badge tone={PUBLICATION_TONE[s]}>{m.enums.publicationStatus[s]}</Badge>
                  </dt>
                  <dd className="text-sm text-fg-muted">{m.enums.publicationStatusHelp[s]}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="dedupe">
            <h2 className="text-title">{t.dedupe.title}</h2>
            <ol className="mt-6 space-y-3">
              {t.dedupe.items.map((d, i) => (
                <li key={d} className="flex gap-4 text-fg-muted">
                  <span className="font-mono text-sm text-accent-text">{i + 1}.</span>
                  {d}
                </li>
              ))}
            </ol>
          </section>

          <section id="freshness">
            <h2 className="text-title">{t.freshness.title}</h2>
            <p className="mt-4 max-w-prose text-fg-muted">{t.freshness.body}</p>
          </section>

          <section id="collection">
            <h2 className="text-title">{t.collection.title}</h2>
            <ul className="mt-6 space-y-3">
              {t.collection.items.map((c) => (
                <li key={c} className="flex items-start gap-3 text-fg-muted">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rotate-45 bg-accent" />
                  {c}
                </li>
              ))}
            </ul>
          </section>

          <section id="example">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-title">{t.example.title}</h2>
              <Badge tone="demo">{m.common.demo}</Badge>
            </div>
            <p className="mt-4 max-w-prose text-fg-muted">{t.example.lead}</p>
            <div className="hatch-demo mt-6 overflow-x-auto rounded-xl border border-demo/30">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-surface-2/80 text-xs uppercase tracking-wider text-fg-subtle">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">{t.example.record}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t.example.result}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t.example.reason}</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">{t.example.score}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface/90">
                  {run.outcomes.map((o) => {
                    const reason = o.duplicateOf
                      ? t.example.duplicateOf(t.example.reasons[o.duplicateOf.reason])
                      : o.validation && o.validation.failedBlocking.length
                        ? o.validation.failedBlocking.map((id) => m.validationChecks[id].name).join(', ')
                        : o.status === 'rejected'
                          ? t.example.reasons.belowMin
                          : t.example.reasons.approved;
                    return (
                      <tr key={o.record.key + o.record.url}>
                        <th scope="row" className="px-4 py-3 font-medium">
                          {o.record.title}
                          <span className="block text-xs font-normal text-fg-subtle">{o.record.provider}</span>
                        </th>
                        <td className="px-4 py-3">
                          <Badge tone={PUBLICATION_TONE[o.status]}>{m.enums.publicationStatus[o.status]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-fg-muted">{reason}</td>
                        <td className="px-4 py-3 text-right font-mono">{o.quality ? o.quality.score : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section id="limits">
            <h2 className="text-title">{t.limits.title}</h2>
            <ul className="mt-6 space-y-3">
              {t.limits.items.map((l) => (
                <li key={l} className="flex items-start gap-3 text-fg-muted">
                  <CircleAlert aria-hidden className="mt-1 size-4 shrink-0 text-warn" />
                  {l}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <NextStep kind="methodology" primaryTo={'/explore'} secondaryTo={'/trail'} className="pt-0" />
    </>
  );
}
