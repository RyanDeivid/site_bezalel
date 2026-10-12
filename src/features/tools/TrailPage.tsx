import { ArrowLeft, ArrowRight, Award, BookmarkPlus, Building, Clock, Link2, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { PageHero } from '@/components/layout/PageHero';
import { SaveButton } from '@/components/tools/SaveButton';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/toast-context';
import { categoryGroups } from '@/data/catalog/taxonomy';
import { progressSummary, saveAll } from '@/domain/tools/shelf';
import { buildTrail, summarize, TRAIL_GOALS, TRAIL_PACES, TRAIL_SIZE, trailFromParams, trailQuery, type TrailAnswers, type TrailGoal, type TrailPace } from '@/domain/tools/trail';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useShelf } from '@/hooks/useShelf';
import { cn } from '@/lib/cn';
import { readStorage } from '@/lib/storage';
import type { CategoryGroupId } from '@/types/domain';
import { coursePath, priceLabel } from '../catalog/present';
import { toolsContent } from './content';
import { groupOf, publishedCourses } from './catalog';
import { Planner, ProgressControl } from './parts';

const QUESTIONS = 4;

function OptionButton({ selected, onClick, title, hint }: { selected: boolean; onClick: () => void; title: string; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'card-interactive flex h-full w-full flex-col items-start rounded-2xl border p-4 text-left',
        selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/50',
      )}
    >
      <span className="font-medium">{title}</span>
      {hint && <span className="mt-1 text-sm text-fg-muted">{hint}</span>}
    </button>
  );
}

/** Uma pergunta por tela, avanço automático ao escolher (menos decisões de cada vez). */
function TrailQuiz({ onDone, notice }: { onDone: (answers: TrailAnswers) => void; notice?: string }) {
  const { locale } = usePreferences();
  const t = toolsContent[locale].trail;
  const [step, setStep] = useState(0);
  const [group, setGroup] = useState<CategoryGroupId | 'any' | null>(null);
  const [goal, setGoal] = useState<TrailGoal | null>(null);
  const [pace, setPace] = useState<TrailPace | null>(null);
  const [flags, setFlags] = useState({ freeOnly: false, certificate: false, portugueseOnly: false });
  const [forja, setForja] = useState<CategoryGroupId[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  // Interesses marcados na abertura da home (a Forja), se houver.
  useEffect(() => {
    const saved = (readStorage('bz-interest-groups') ?? '').split(',').filter((id): id is CategoryGroupId => categoryGroups.some((g) => g.id === id));
    if (!saved.length) return;
    const id = requestAnimationFrame(() => setForja(saved));
    return () => cancelAnimationFrame(id);
  }, []);

  // Leitores de tela e teclado: cada nova pergunta recebe o foco.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const next = () => setStep((s) => Math.min(QUESTIONS - 1, s + 1));
  const titles = [t.q1, t.q2, t.q3, t.q4];

  return (
    <section aria-labelledby="trail-question" className="container-page max-w-4xl py-12">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{t.question(step + 1, QUESTIONS)}</p>
        {step > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)} iconLeft={<ArrowLeft className="size-4" />}>
            {t.back}
          </Button>
        )}
      </div>
      <ol aria-hidden className="mt-3 flex gap-1.5">
        {Array.from({ length: QUESTIONS }, (_, i) => (
          <li key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line-strong')} />
        ))}
      </ol>
      <h2 id="trail-question" ref={heading} tabIndex={-1} className="text-title mt-8 outline-none">
        {titles[step]}
      </h2>

      {step === 0 && (
        <>
          {forja.length > 0 && <p className="mt-3 text-sm text-accent-text">{t.fromForja(forja.map((id) => categoryGroups.find((g) => g.id === id)!.name[locale]).join(', '))}</p>}
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {categoryGroups.map((g) => (
              <li key={g.id}>
                <OptionButton
                  selected={group === g.id || (group === null && forja[0] === g.id)}
                  onClick={() => {
                    setGroup(g.id);
                    next();
                  }}
                  title={g.name[locale]}
                  hint={g.tagline[locale]}
                />
              </li>
            ))}
            <li className="sm:col-span-2">
              <OptionButton
                selected={group === 'any'}
                onClick={() => {
                  setGroup('any');
                  next();
                }}
                title={t.any}
                hint={t.anyHint}
              />
            </li>
          </ul>
        </>
      )}

      {step === 1 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {TRAIL_GOALS.map((g) => (
            <li key={g}>
              <OptionButton
                selected={goal === g}
                onClick={() => {
                  setGoal(g);
                  next();
                }}
                title={t.goals[g].label}
                hint={t.goals[g].hint}
              />
            </li>
          ))}
        </ul>
      )}

      {step === 2 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {TRAIL_PACES.map((h) => (
            <li key={h}>
              <OptionButton
                selected={pace === h}
                onClick={() => {
                  setPace(h);
                  next();
                }}
                title={t.pace(h)}
                hint={t.paceHint[h]}
              />
            </li>
          ))}
        </ul>
      )}

      {step === 3 && (
        <div className="mt-6">
          <p className="text-sm text-fg-muted">{t.q4Hint}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {(['freeOnly', 'certificate', 'portugueseOnly'] as const).map((k) => (
              <label
                key={k}
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]',
                  flags[k] ? 'border-accent bg-accent-soft' : 'border-line-strong',
                )}
              >
                <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))} className="accent-[var(--accent)]" />
                {t[k]}
              </label>
            ))}
          </div>
          {notice && (
            <p role="alert" className="mt-6 text-sm text-warn">
              {notice}
            </p>
          )}
          <Button
            size="lg"
            className="mt-8"
            iconRight={<ArrowRight className="size-4" />}
            onClick={() => onDone({ group: group ?? forja[0] ?? 'any', goal: goal ?? 'start', pace: pace ?? 5, ...flags })}
          >
            {t.build}
          </Button>
        </div>
      )}
    </section>
  );
}

/** A trilha pronta (também aberta por um link compartilhado). */
function TrailResult({ answers, slugs, onRedo }: { answers: TrailAnswers; slugs: string[]; onRedo: () => void }) {
  const { m, locale } = usePreferences();
  const t = toolsContent[locale].result;
  const { notify } = useToast();
  const [shelf, update] = useShelf();
  const courses = useMemo(() => {
    const bySlug = new Map(publishedCourses().map((c) => [c.slug, c]));
    return slugs.flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!] : []));
  }, [slugs]);
  const trail = useMemo(() => summarize(courses, answers), [courses, answers]);
  const missing = slugs.length - courses.length;
  const ids = courses.map((c) => c.id);
  const progress = progressSummary(shelf, ids);
  const allSaved = ids.length > 0 && ids.every((id) => shelf.saved.includes(id));
  const theme = answers.group === 'any' ? t.anyTheme : (categoryGroups.find((g) => g.id === answers.group)?.name[locale] ?? t.anyTheme);
  // A trilha aparece abaixo da abertura: o foco (e a rolagem) vão para ela.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [slugs]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify({ message: t.shared, tone: 'success' });
    } catch {
      notify({ message: t.shareFailed, tone: 'error' });
    }
  };

  return (
    <div className="container-page max-w-5xl py-12">
      <p className="eyebrow">{t.eyebrow}</p>
      <h2 ref={heading} tabIndex={-1} className="text-title mt-4 scroll-mt-28 outline-none">
        {t.title(courses.length, theme)} <span className="font-serif-accent text-accent-text">{t.goal[answers.goal]}</span>
      </h2>
      <ul className="mt-5 flex flex-wrap gap-2 text-sm">
        {trail.knownHours > 0 && (
          <li className="rounded-full border border-line-strong px-3 py-1">
            {t.hours(trail.knownHours)}
            {trail.weeks !== null && <span className="text-fg-muted"> · {t.weeks(trail.weeks, answers.pace)}</span>}
          </li>
        )}
        {trail.unknownHours > 0 && <li className="rounded-full border border-line px-3 py-1 text-fg-muted">{t.unknown(trail.unknownHours)}</li>}
        {ids.length > 0 && <li className="rounded-full border border-ok/40 bg-ok-soft px-3 py-1 text-ok">{t.progress(progress.done, progress.total)}</li>}
      </ul>
      {missing > 0 && <p className="mt-4 text-sm text-warn">{t.notFound}</p>}
      {missing === 0 && courses.length < TRAIL_SIZE && <p className="mt-4 text-sm text-warn">{t.few(courses.length)}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => update((s) => saveAll(s, ids))} disabled={allSaved || !ids.length} iconLeft={<BookmarkPlus className="size-4" />}>
          {allSaved ? t.savedAll : t.saveAll}
        </Button>
        <Button variant="secondary" onClick={share} iconLeft={<Link2 className="size-4" />}>
          {t.share}
        </Button>
        <Button variant="ghost" onClick={onRedo} iconLeft={<RotateCcw className="size-4" />}>
          {t.redo}
        </Button>
      </div>

      <ol className="mt-10 space-y-4">
        {trail.steps.map((step, i) => (
          <li key={step.course.id} className="relative rounded-2xl border border-line bg-surface p-5 md:pl-20">
            <span aria-hidden className="mb-3 grid size-10 place-items-center rounded-full border border-accent/50 font-mono text-sm text-accent-text md:absolute md:left-5 md:top-5 md:mb-0">
              {i + 1}
            </span>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle">
                  <span className="sr-only">{t.step(i + 1)} · </span>
                  {m.enums.category[step.course.category]}
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  <Link to={coursePath(step.course)} className="hover:text-accent-text">
                    {step.course.title}
                  </Link>
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
                  <Building aria-hidden className="size-3.5" /> {step.course.provider.name}
                </p>
              </div>
              <SaveButton course={step.course} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden className="size-3.5" /> {step.hours !== null ? `${step.hours} h` : t.noHours}
              </span>
              <span>{priceLabel(step.course, m, locale)}</span>
              {step.course.certificateType && step.course.certificateType !== 'none-stated' && (
                <span className="inline-flex items-center gap-1.5">
                  <Award aria-hidden className="size-3.5" /> {m.enums.certificateType[step.course.certificateType]}
                </span>
              )}
            </div>
            {step.reasons.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 text-fg-subtle">
                  <Sparkles aria-hidden className="size-3.5" /> {t.why}:
                </span>
                {step.reasons.map((r) => (
                  <span key={r} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-fg-muted">
                    {t.reasons[r]}
                  </span>
                ))}
              </p>
            )}
            <div className="mt-4">
              <ProgressControl course={step.course} />
            </div>
          </li>
        ))}
      </ol>

      {courses.length > 0 && (
        <section aria-labelledby="trail-plan" className="panel mt-10 p-6">
          <h2 id="trail-plan" className="text-xl font-semibold">
            {t.planTitle}
          </h2>
          <div className="mt-3">
            <Planner courses={courses} hoursPerWeek={answers.pace} />
          </div>
        </section>
      )}
      <p className="mt-8 text-xs text-fg-subtle">{t.honesty}</p>
    </div>
  );
}

/**
 * "Descubra sua trilha". Sem parâmetros: o questionário. Com `?c=...`: a trilha
 * (resultado ou link compartilhado). O endereço é a fonte da verdade — copiar
 * o link basta para compartilhar.
 */
export default function TrailPage() {
  const { m, locale } = usePreferences();
  const t = toolsContent[locale].trail;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const shared = useMemo(() => trailFromParams(params), [params]);
  const [empty, setEmpty] = useState(false);
  useDocumentMeta({ title: m.meta.trail.title, description: m.meta.trail.description, path: '/trail' });

  const build = (answers: TrailAnswers) => {
    const trail = buildTrail(answers, publishedCourses(), groupOf);
    if (!trail.steps.length) {
      setEmpty(true);
      return;
    }
    setEmpty(false);
    navigate({ search: `?${trailQuery(answers, trail.steps.map((s) => s.course.slug))}` });
  };

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} particles={false} />
      {shared ? (
        <TrailResult answers={shared.answers} slugs={shared.slugs} onRedo={() => setParams({})} />
      ) : (
        <TrailQuiz onDone={build} notice={empty ? toolsContent[locale].result.few(0) : undefined} />
      )}
    </>
  );
}
