import { ArrowLeft, ArrowUpRight, Award, Building, Clock, Copy, FlaskConical, MessageCircle, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { FieldValue, OriginBadge, PublicationBadge, VerificationBadge } from '@/components/data/DataBadges';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ExternalLink, isSafeExternalUrl } from '@/components/ui/ExternalLink';
import { Skeleton, StateView } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/toast-context';
import { skillName as skillLabel } from '@/data/catalog/store';
import { explorePath } from '@/domain/catalog/query-params';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatDate } from '@/lib/format';
import { useServices } from '@/services/context';
import type { Course } from '@/types/domain';
import { CourseCard } from './CourseCard';
import { buildCourseJsonLd } from './json-ld';
import { durationLabel, languagesLabel, priceLabel } from './present';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-line py-3.5 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-fg-subtle">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default function CourseDetailPage() {
  const { slug = '' } = useParams();
  const { m, locale } = usePreferences();
  const services = useServices();
  const { notify } = useToast();
  const result = useAsync(() => services.catalog.getBySlug(slug), [slug]);
  const course = result.data ?? null;
  const related = useAsync(() => (course ? services.catalog.getRelated(course, 3) : Promise.resolve([] as Course[])), [course?.id ?? null]);
  const c = m.course;

  useDocumentMeta({
    title: course ? course.title : result.status === 'loading' ? m.common.loading : c.notFoundTitle,
    description: course ? m.meta.courseDescription(course.title, course.provider.name) : undefined,
    path: `/course/${slug}`,
    jsonLd: course ? buildCourseJsonLd(course) : null,
    noindex: !course || course.origin === 'demo',
  });

  if (result.status === 'error') {
    return (
      <div className="container-page py-20">
        <StateView state="error" onRetry={result.retry} />
      </div>
    );
  }

  if (result.status === 'loading') {
    return (
      <div className="container-page space-y-6 py-16" aria-busy="true">
        {result.isLoadingVisible && (
          <>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-14 w-3/4" />
            <Skeleton className="h-64" />
          </>
        )}
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container-page py-20">
        <StateView
          state="empty"
          title={c.notFoundTitle}
          action={
            <ButtonLink to="/explore" variant="secondary" size="sm" iconLeft={<ArrowLeft className="size-4" />}>
              {c.backToCatalog}
            </ButtonLink>
          }
        >
          {c.notFoundBody}
        </StateView>
      </div>
    );
  }

  const skillName = (id: string) => skillLabel(id, locale);
  const isDemo = course.origin === 'demo';
  const outdated = course.verificationStatus === 'outdated' || course.publicationStatus === 'outdated';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify({ message: m.common.linkCopied, tone: 'success' });
    } catch {
      notify({ message: m.common.copyFailed, tone: 'error' });
    }
  }

  return (
    <article>
      <header className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="bg-blueprint absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="container-page page-enter relative py-12 md:py-16">
          <nav aria-label="breadcrumb" className="text-sm text-fg-muted">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link to="/explore" className="hover:text-fg">
                  {c.breadcrumb}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link to={explorePath({ categories: [course.category] })} className="hover:text-fg">
                  {m.enums.category[course.category]}
                </Link>
              </li>
            </ol>
          </nav>
          <div className="mt-6 flex flex-wrap gap-2">
            <OriginBadge origin={course.origin} />
            <VerificationBadge status={course.verificationStatus} />
            <Badge tone="neutral">{m.enums.opportunityType[course.type]}</Badge>
          </div>
          <h1 className="text-display mt-5 max-w-4xl">{course.title}</h1>
          <p className="mt-4 flex items-center gap-2 text-lg text-fg-muted">
            <Building aria-hidden className="size-5" />
            {course.provider.name}
            {course.contentAuthor && <span className="text-fg-subtle">· {course.contentAuthor}</span>}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {isSafeExternalUrl(course.sourceUrl) && !isDemo && (
              <a href={course.sourceUrl} target="_blank" rel="noopener noreferrer" className="group inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 font-medium text-accent-fg shadow-[0_10px_30px_-12px_var(--accent)] transition-colors hover:bg-accent-strong">
                {c.goToSource}
                <ArrowUpRight aria-hidden className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                <span className="sr-only"> {m.common.opensInNewTab}</span>
              </a>
            )}
            <Button variant="secondary" size="lg" onClick={copyLink} iconLeft={<Copy className="size-4" />}>
              {c.share}
            </Button>
            <ButtonLink to={`/assistant?q=${encodeURIComponent(course.title)}`} variant="ghost" size="lg" iconLeft={<MessageCircle className="size-4" />}>
              {c.askSol}
            </ButtonLink>
          </div>
        </div>
      </header>

      <div className="container-page grid grid-cols-1 gap-10 py-12 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-7">
          {isDemo && (
            <p role="note" className="hatch-demo flex items-start gap-3 rounded-xl border border-demo/40 p-4 text-sm">
              <FlaskConical aria-hidden className="mt-0.5 size-5 shrink-0 text-demo" />
              {c.demoWarning}
            </p>
          )}
          {outdated && (
            <p role="note" className="flex items-start gap-3 rounded-xl border border-warn/40 bg-warn-soft p-4 text-sm">
              <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warn" />
              {c.outdatedWarning}
            </p>
          )}

          <section>
            <h2 className="text-xl font-semibold">{c.about}</h2>
            <p className="mt-4 text-lg leading-relaxed text-fg-muted">{course.description}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">{c.skills}</h2>
            <p className="mt-1 text-sm text-fg-subtle">{c.skillsNote}</p>
            {course.skills.length ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {course.skills.map((s) => (
                  <li key={s}>
                    <Link to={explorePath({ q: skillName(s) })} className="inline-flex h-8 items-center rounded-full border border-accent/30 bg-accent-soft px-3 text-sm text-fg transition-colors hover:border-accent">
                      {skillName(s)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3">
                <FieldValue value={null} />
              </p>
            )}
          </section>

          {course.topics.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold">{c.topics}</h2>
              <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {course.topics.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-fg-muted">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rotate-45 bg-accent" />
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold">{c.details}</h2>
            <dl className="panel mt-4 px-5">
              <Row label={c.provider}>{course.provider.name}</Row>
              {course.contentAuthor && <Row label={c.contentAuthor}>{course.contentAuthor}</Row>}
              <Row label={c.level}>
                <FieldValue value={course.level === 'unknown' ? null : m.enums.level[course.level]} inferred={course.levelSource === 'inferred'} />
              </Row>
              <Row label={c.duration}>
                <FieldValue value={course.duration ? (course.duration.note ? `${durationLabel(course, m)} — ${course.duration.note}` : durationLabel(course, m)) : null} />
              </Row>
              <Row label={c.price}>
                <FieldValue value={course.priceType === 'unknown' ? null : priceLabel(course, m, locale)} />
                {course.priceNote && <p className="mt-1 text-xs text-fg-muted">{course.priceNote}</p>}
              </Row>
              <Row label={c.certificate}>
                <FieldValue value={course.certificateType ? m.enums.certificateType[course.certificateType] : null} />
                {course.certificateNote && <p className="mt-1 text-xs text-fg-muted">{course.certificateNote}</p>}
              </Row>
              <Row label={c.modality}>
                <FieldValue value={course.modality === 'unknown' ? null : m.enums.modality[course.modality]} />
              </Row>
              <Row label={c.languages}>
                <FieldValue value={languagesLabel(course, m)} />
              </Row>
              <Row label={c.prerequisites}>
                {course.prerequisites?.length ? (
                  <ul className="space-y-1">
                    {course.prerequisites.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <FieldValue value={null} />
                )}
              </Row>
              {course.license && <Row label={c.license}>{course.license}</Row>}
            </dl>
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="sticky top-[calc(var(--header-h)+1.5rem)] space-y-6">
            <section className="panel overflow-hidden">
              <h2 className="border-b border-line px-5 py-4 font-semibold">{c.verification}</h2>
              <dl className="px-5">
                <Row label={c.verificationStatus}>
                  <VerificationBadge status={course.verificationStatus} />
                </Row>
                <Row label={c.publicationStatus}>
                  <PublicationBadge status={course.publicationStatus} />
                </Row>
                <Row label={c.lastChecked}>
                  <FieldValue value={formatDate(course.lastCheckedAt, locale)} />
                </Row>
                <Row label={c.verifiedAt}>
                  <FieldValue value={formatDate(course.sourceVerifiedAt, locale)} />
                </Row>
                <Row label={c.source}>
                  <ExternalLink href={course.sourceUrl} className="break-all text-accent-text hover:underline">
                    {course.sourceName}
                  </ExternalLink>
                </Row>
              </dl>
              <div className="border-t border-line bg-surface-2/50 px-5 py-4">
                <p className="font-mono text-[0.7rem] uppercase tracking-wider text-fg-subtle">{c.reason}</p>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{course.verificationNote}</p>
              </div>
            </section>
            <p className="flex items-start gap-2.5 text-xs leading-relaxed text-fg-subtle">
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {c.disclaimer}
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-fg-muted">
              {course.duration && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden className="size-4" /> {durationLabel(course, m)}
                </span>
              )}
              {course.certificateType && (
                <span className="inline-flex items-center gap-1.5">
                  <Award aria-hidden className="size-4" /> {m.enums.certificateType[course.certificateType]}
                </span>
              )}
            </div>
          </div>
        </aside>
      </div>

      <section className="container-page border-t border-line py-14" aria-labelledby="related-heading">
        <h2 id="related-heading" className="text-title">
          {c.related}
        </h2>
        {related.data && related.data.length > 0 ? (
          <ul className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {related.data.map((r) => (
              <li key={r.id}>
                <CourseCard course={r} />
              </li>
            ))}
          </ul>
        ) : (
          related.status === 'success' && <p className="mt-6 text-fg-muted">{c.noRelated}</p>
        )}
      </section>
    </article>
  );
}
