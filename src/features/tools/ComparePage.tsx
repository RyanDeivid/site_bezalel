import { Plus, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { FieldValue, VerificationBadge } from '@/components/data/DataBadges';
import { PageHero } from '@/components/layout/PageHero';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { IconButton } from '@/components/ui/Button';
import { skillName } from '@/data/catalog/store';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useShelf } from '@/hooks/useShelf';
import { formatDate } from '@/lib/format';
import type { Course } from '@/types/domain';
import { coursePath, durationLabel, languagesLabel, priceLabel } from '../catalog/present';
import { toolsContent } from './content';
import { publishedCourses } from './catalog';

const MAX = 3;
type RowKey = keyof (typeof toolsContent)['pt-BR']['compare']['rows'];

/**
 * Comparador: até três cursos lado a lado, só com o que a fonte declara
 * ("Não informado" para o resto). Os cursos ficam no endereço (`?c=a,b,c`),
 * então a comparação também pode ser compartilhada.
 */
export default function ComparePage() {
  const { m, locale } = usePreferences();
  const t = toolsContent[locale].compare;
  useDocumentMeta({ title: m.meta.compare.title, description: m.meta.compare.description, path: '/compare', noindex: true });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [shelf] = useShelf();
  const [onlyDiff, setOnlyDiff] = useState(false);
  const all = useMemo(() => publishedCourses(), []);
  const bySlug = useMemo(() => new Map(all.map((c) => [c.slug, c])), [all]);
  const courses = useMemo(
    () =>
      [...new Set((params.get('c') ?? '').split(','))]
        .flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!] : []))
        .slice(0, MAX),
    [params, bySlug],
  );
  // Vírgulas literais no endereço (slugs são [a-z0-9-]), para o link ficar legível.
  const setCourses = (list: Course[]) => navigate({ search: list.length ? `?c=${list.map((c) => c.slug).join(',')}` : '' }, { replace: true });
  const fromShelf = shelf.saved.flatMap((id) => {
    const c = all.find((x) => x.id === id);
    return c && !courses.includes(c) ? [c] : [];
  });

  const rows: Array<{ key: RowKey; value: (c: Course) => ReactNode | null; text: (c: Course) => string }> = [
    { key: 'provider', value: (c) => c.provider.name, text: (c) => c.provider.name },
    { key: 'area', value: (c) => m.enums.category[c.category], text: (c) => c.category },
    { key: 'type', value: (c) => m.enums.opportunityType[c.type], text: (c) => c.type },
    {
      key: 'level',
      value: (c) => (c.level === 'unknown' ? null : `${m.enums.level[c.level]}${c.levelSource === 'inferred' ? ` (${t.inferred})` : ''}`),
      text: (c) => `${c.level}${c.levelSource ?? ''}`,
    },
    { key: 'price', value: (c) => (c.priceType === 'unknown' ? null : priceLabel(c, m, locale)), text: (c) => priceLabel(c, m, locale) },
    { key: 'certificate', value: (c) => (c.certificateType ? m.enums.certificateType[c.certificateType] : null), text: (c) => c.certificateType ?? '' },
    { key: 'duration', value: (c) => durationLabel(c, m), text: (c) => durationLabel(c, m) ?? '' },
    { key: 'modality', value: (c) => (c.modality === 'unknown' ? null : m.enums.modality[c.modality]), text: (c) => c.modality },
    { key: 'languages', value: (c) => languagesLabel(c, m), text: (c) => c.languages.join() },
    {
      key: 'prerequisites',
      value: (c) => (c.prerequisites === undefined ? null : c.prerequisites.length ? c.prerequisites.join('; ') : t.noneRequired),
      text: (c) => (c.prerequisites ?? ['?']).join(),
    },
    {
      key: 'skills',
      value: (c) => (c.skills.length ? c.skills.map((s) => skillName(s, locale)).join(', ') : null),
      text: (c) => [...c.skills].sort().join(),
    },
    { key: 'checked', value: (c) => formatDate(c.lastCheckedAt, locale), text: (c) => c.lastCheckedAt },
    { key: 'verification', value: (c) => <VerificationBadge status={c.verificationStatus} withHelp={false} />, text: (c) => c.verificationStatus },
    {
      key: 'source',
      value: (c) => (
        <ExternalLink href={c.sourceUrl} className="text-accent-text hover:underline">
          {c.sourceName}
        </ExternalLink>
      ),
      text: (c) => c.sourceUrl,
    },
  ];
  const visible = onlyDiff && courses.length > 1 ? rows.filter((r) => new Set(courses.map(r.text)).size > 1) : rows;

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} particles={false} />
      <div className="container-page py-12">
        {courses.length < 2 && <p className="mb-6 text-fg-muted">{t.need}</p>}

        {courses.length > 0 && (
          <>
            {courses.length > 1 && (
              <label className="mb-4 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="accent-[var(--accent)]" />
                {t.onlyDiff}
              </label>
            )}
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <caption className="sr-only">{m.meta.compare.title}</caption>
                <thead>
                  <tr className="bg-surface-2">
                    <th scope="col" className="sticky left-0 w-40 bg-surface-2 p-3 text-left font-mono text-[0.7rem] uppercase tracking-wider text-fg-subtle">
                      {t.course}
                    </th>
                    {courses.map((c) => (
                      <th key={c.id} scope="col" className="p-3 text-left align-top">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={coursePath(c)} className="font-semibold leading-snug hover:text-accent-text">
                            {c.title}
                          </Link>
                          <IconButton label={t.remove(c.title)} size="sm" onClick={() => setCourses(courses.filter((x) => x !== c))}>
                            <X className="size-4" />
                          </IconButton>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.key} className="border-t border-line">
                      <th scope="row" className="sticky left-0 bg-surface p-3 text-left align-top font-medium text-fg-muted">
                        {t.rows[r.key]}
                      </th>
                      {courses.map((c) => (
                        <td key={c.id} className="p-3 align-top">
                          <FieldValue value={r.value(c)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <section aria-labelledby="compare-shelf" className="mt-10">
          <h2 id="compare-shelf" className="text-lg font-semibold">
            {t.fromShelf}
          </h2>
          {fromShelf.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {fromShelf.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={courses.length >= MAX}
                    aria-label={t.add(c.title)}
                    title={courses.length >= MAX ? t.full : undefined}
                    onClick={() => setCourses([...courses, c])}
                    className="inline-flex max-w-xs items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm hover:border-accent/60 disabled:opacity-50"
                  >
                    <Plus aria-hidden className="size-3.5 shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-fg-subtle">{t.emptyShelf}</p>
          )}
        </section>
      </div>
    </>
  );
}
