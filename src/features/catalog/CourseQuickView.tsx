import { ArrowRight } from 'lucide-react';
import { usePreferences } from '@/app/preferences-context';
import { FieldValue, OriginBadge, VerificationBadge } from '@/components/data/DataBadges';
import { ButtonLink } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { formatDate } from '@/lib/format';
import type { Course } from '@/types/domain';
import { coursePath, durationLabel, priceLabel } from './present';

/** Modal de visualização rápida a partir do catálogo. */
export function CourseQuickView({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const { m, locale } = usePreferences();
  const c = m.course;
  return (
    <Dialog
      open={!!course}
      onClose={onClose}
      title={course?.title ?? ''}
      description={course?.provider.name}
      footer={
        course && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ExternalLink href={course.sourceUrl} className="text-sm text-accent-text hover:underline">
              {m.common.viewSource}
            </ExternalLink>
            <ButtonLink to={coursePath(course)} iconRight={<ArrowRight className="size-4" />} onClick={onClose}>
              {m.explore.details}
            </ButtonLink>
          </div>
        )
      }
    >
      {course && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <OriginBadge origin={course.origin} />
            <VerificationBadge status={course.verificationStatus} />
          </div>
          <p className="leading-relaxed text-fg-muted">{course.description}</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            {(
              [
                [c.price, priceLabel(course, m, locale)],
                [c.level, course.level === 'unknown' ? null : m.enums.level[course.level]],
                [c.duration, durationLabel(course, m)],
                [c.certificate, course.certificateType ? m.enums.certificateType[course.certificateType] : null],
                [c.lastChecked, formatDate(course.lastCheckedAt, locale)],
                [c.type, m.enums.opportunityType[course.type]],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[0.7rem] uppercase tracking-wider text-fg-subtle">{label}</dt>
                <dd className="mt-1">
                  <FieldValue value={value} inferred={label === c.level && course.levelSource === 'inferred'} />
                </dd>
              </div>
            ))}
          </dl>
          {course.origin === 'demo' && <p className="hatch-demo rounded-lg border border-demo/30 p-3 text-sm text-fg-muted">{c.demoWarning}</p>}
        </div>
      )}
    </Dialog>
  );
}
