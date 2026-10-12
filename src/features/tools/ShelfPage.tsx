import { ArrowRight, Building, Clock, Compass, GitCompareArrows, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { PageHero } from '@/components/layout/PageHero';
import { ButtonLink, IconButton } from '@/components/ui/Button';
import { progressOf, progressSummary, toggleSaved } from '@/domain/tools/shelf';
import { statedHours } from '@/domain/tools/trail';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useShelf } from '@/hooks/useShelf';
import { cn } from '@/lib/cn';
import { coursePath } from '../catalog/present';
import { toolsContent } from './content';
import { publishedCourses } from './catalog';
import { HoursCalculator, Planner, ProgressControl } from './parts';

const MAX_COMPARE = 3;

/**
 * Minha estante: cursos salvos + progresso (só no navegador), com seleção para
 * comparar, plano de estudos (.ics) e calculadora de horas complementares.
 */
export default function ShelfPage() {
  const { m, locale } = usePreferences();
  const t = toolsContent[locale];
  const s = t.shelf;
  useDocumentMeta({ title: m.meta.saved.title, description: m.meta.saved.description, path: '/saved', noindex: true });
  const [shelf, update] = useShelf();
  const byId = useMemo(() => new Map(publishedCourses().map((c) => [c.id, c])), []);
  const courses = shelf.saved.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const missing = shelf.saved.filter((id) => !byId.has(id));
  const [selected, setSelected] = useState<string[]>([]);
  const [hideDone, setHideDone] = useState(true);
  const chosen = selected.filter((id) => shelf.saved.includes(id));
  const doneIds = useMemo(() => new Set(Object.entries(shelf.progress).flatMap(([id, p]) => (p === 'done' ? [id] : []))), [shelf.progress]);
  const summary = progressSummary(shelf, courses.map((c) => c.id));
  const toPlan = hideDone ? courses.filter((c) => progressOf(shelf, c.id) !== 'done') : courses;
  const compareHref = `/compare?c=${chosen.map((id) => byId.get(id)!.slug).join(',')}`;

  return (
    <>
      <PageHero eyebrow={s.eyebrow} title={s.title} lead={s.lead} particles={false} />
      <div className="container-page grid grid-cols-1 gap-10 py-12 lg:grid-cols-12">
        <section aria-labelledby="shelf-list" className="lg:col-span-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="shelf-list" className="text-xl font-semibold">
                {s.count(courses.length)}
              </h2>
              {courses.length > 0 && <p className="text-sm text-fg-muted">{toolsContent[locale].result.progress(summary.done, summary.total)}</p>}
            </div>
            {courses.length > 1 && (
              <ButtonLink
                to={compareHref}
                variant="secondary"
                size="sm"
                aria-disabled={chosen.length < 2}
                className={cn(chosen.length < 2 && 'pointer-events-none opacity-50')}
                tabIndex={chosen.length < 2 ? -1 : undefined}
                iconLeft={<GitCompareArrows className="size-4" />}
              >
                {s.compare(chosen.length)}
              </ButtonLink>
            )}
          </div>
          {courses.length > 1 && <p className="mt-2 text-xs text-fg-subtle">{s.compareHint}</p>}

          {missing.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-warn">
              {s.missing(missing.length)}
              <button type="button" className="underline" onClick={() => update((sh) => missing.reduce((acc, id) => toggleSaved(acc, id), sh))}>
                {s.clean}
              </button>
            </p>
          )}

          {courses.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-line-strong p-8 text-center">
              <p className="text-fg-muted">{s.empty}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <ButtonLink to="/trail" iconLeft={<Compass className="size-4" />}>
                  {s.emptyTrail}
                </ButtonLink>
                <ButtonLink to="/explore" variant="secondary" iconLeft={<Search className="size-4" />}>
                  {s.emptyExplore}
                </ButtonLink>
              </div>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {courses.map((c) => {
                const on = chosen.includes(c.id);
                const hours = statedHours(c);
                return (
                  <li key={c.id} className={cn('rounded-2xl border bg-surface p-4', on ? 'border-accent/60' : 'border-line')}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={s.select(c.title)}
                        checked={on}
                        disabled={!on && chosen.length >= MAX_COMPARE}
                        onChange={() => setSelected((cur) => (on ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
                        className="mt-1.5 size-4 accent-[var(--accent)]"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold leading-snug">
                          <Link to={coursePath(c)} className="hover:text-accent-text">
                            {c.title}
                          </Link>
                        </h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                          <span className="inline-flex items-center gap-1">
                            <Building aria-hidden className="size-3.5" /> {c.provider.name}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock aria-hidden className="size-3.5" /> {hours !== null ? `${hours} h` : t.result.noHours}
                          </span>
                        </p>
                        <div className="mt-3">
                          <ProgressControl course={c} />
                        </div>
                      </div>
                      <IconButton label={s.remove(c.title)} size="sm" onClick={() => update((sh) => toggleSaved(sh, c.id))}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {courses.length > 0 && (
            <ButtonLink to="/trail" variant="ghost" className="mt-4" iconRight={<ArrowRight className="size-4" />}>
              {s.emptyTrail}
            </ButtonLink>
          )}
        </section>

        {courses.length > 0 && (
          <aside aria-label={s.tools} className="space-y-6 lg:col-span-5">
            <section aria-labelledby="shelf-plan" className="panel p-6">
              <h2 id="shelf-plan" className="text-lg font-semibold">
                {s.plannerTitle}
              </h2>
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-fg-muted">
                <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="accent-[var(--accent)]" />
                {s.hideDone}
              </label>
              <div className="mt-3">
                <Planner courses={toPlan} />
              </div>
            </section>
            <section aria-labelledby="shelf-hours" className="panel p-6">
              <h2 id="shelf-hours" className="text-lg font-semibold">
                {s.hoursTitle}
              </h2>
              <div className="mt-3">
                <HoursCalculator courses={courses} doneIds={doneIds} />
              </div>
            </section>
          </aside>
        )}
      </div>
    </>
  );
}
