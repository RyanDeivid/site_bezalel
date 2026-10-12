import { Award, Building, Clock, Eye } from 'lucide-react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { OriginBadge, VerificationBadge } from '@/components/data/DataBadges';
import { SaveButton } from '@/components/tools/SaveButton';
import { IconButton } from '@/components/ui/Button';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Course } from '@/types/domain';
import { coursePath, durationLabel, priceLabel } from './present';

interface CourseCardProps {
  course: Course;
  onQuickView?: (course: Course) => void;
  className?: string;
}

/** Cartão do catálogo: título, instituição, categoria, nível, preço e verificação. */
export function CourseCard({ course, onQuickView, className }: CourseCardProps) {
  const { m, locale } = usePreferences();
  const free = course.priceType === 'free' || course.priceType === 'free-with-paid-certificate';
  const duration = durationLabel(course, m);

  return (
    <article
      className={cn(
        'card-interactive group relative flex h-full flex-col rounded-2xl border border-line bg-surface p-5',
        course.origin === 'demo' && 'border-demo/30',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle">{m.enums.category[course.category]}</span>
        <OriginBadge origin={course.origin} />
      </div>

      <h3 className="mt-4 text-lg font-semibold leading-snug">
        <Link to={coursePath(course)} viewTransition className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none group-focus-within:text-accent-text">
          {course.title}
        </Link>
      </h3>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-muted">
        <Building aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{course.provider.name}</span>
      </p>

      <ul className="mt-4 flex flex-wrap gap-1.5 text-xs">
        <li className={cn('rounded-md border px-2 py-1', free ? 'border-ok/30 bg-ok-soft text-ok' : 'border-line bg-surface-2 text-fg-muted')}>
          {priceLabel(course, m, locale)}
        </li>
        <li className="rounded-md border border-line bg-surface-2 px-2 py-1 text-fg-muted">
          {m.enums.level[course.level]}
          {course.levelSource === 'inferred' && <span className="text-warn"> *</span>}
        </li>
        <li className="rounded-md border border-line bg-surface-2 px-2 py-1 text-fg-muted">{m.enums.opportunityType[course.type]}</li>
      </ul>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        {duration && (
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-3.5" /> {duration}
          </span>
        )}
        {course.certificateType && course.certificateType !== 'none-stated' && (
          <span className="inline-flex items-center gap-1.5">
            <Award aria-hidden className="size-3.5" /> {m.enums.certificateType[course.certificateType]}
          </span>
        )}
      </div>

      <div aria-hidden className="min-h-5 flex-1" />
      <div className="relative z-10 flex items-center justify-between gap-2 border-t border-line pt-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <VerificationBadge status={course.verificationStatus} />
          <span className="font-mono text-[0.7rem] text-fg-subtle">{m.explore.verifiedOn(formatDate(course.lastCheckedAt, locale) ?? '—')}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <SaveButton course={course} />
          {onQuickView && (
            <IconButton label={`${m.explore.quickView}: ${course.title}`} size="sm" onClick={() => onQuickView(course)}>
              <Eye className="size-4" />
            </IconButton>
          )}
        </div>
      </div>
    </article>
  );
}
