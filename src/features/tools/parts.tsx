import { CalendarArrowDown, CircleCheck, CircleDashed, CircleDot } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { Button } from '@/components/ui/Button';
import { complementaryHours } from '@/domain/tools/hours';
import { MAX_SESSIONS, planSessions, toICS } from '@/domain/tools/ics';
import { progressOf, setProgress, type Progress } from '@/domain/tools/shelf';
import { statedHours } from '@/domain/tools/trail';
import { useShelf } from '@/hooks/useShelf';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { Course } from '@/types/domain';
import { coursePath } from '../catalog/present';
import { toolsContent } from './content';

const ICONS: Record<Progress, typeof CircleDot> = { todo: CircleDashed, doing: CircleDot, done: CircleCheck };

/** Não iniciado / em andamento / concluído — grupo de opções nativo (teclado e leitores de tela). */
export function ProgressControl({ course }: { course: Course }) {
  const { locale } = usePreferences();
  const t = toolsContent[locale].progress;
  const [shelf, update] = useShelf();
  const name = useId();
  const value = progressOf(shelf, course.id);
  // Pico-final no nível do curso: concluir merece um reconhecimento (só quando
  // o visitante acabou de marcar, não ao abrir a página).
  const [justDone, setJustDone] = useState(false);
  return (
    <fieldset className="flex flex-wrap items-center gap-1">
      <legend className="sr-only">
        {t.label}: {course.title}
      </legend>
      {(['todo', 'doing', 'done'] as const).map((p) => {
        const Icon = ICONS[p];
        return (
          <label
            key={p}
            className={cn(
              'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]',
              value === p
                ? p === 'done'
                  ? 'border-ok/50 bg-ok-soft text-ok'
                  : p === 'doing'
                    ? 'border-accent/50 bg-accent-soft text-accent-text'
                    : 'border-line-strong bg-surface-2 text-fg'
                : 'border-line text-fg-muted hover:text-fg',
            )}
          >
            <input
              type="radio"
              name={name}
              value={p}
              checked={value === p}
              onChange={() => {
                setJustDone(p === 'done' && value !== 'done');
                update((s) => setProgress(s, course.id, p));
              }}
              className="sr-only"
            />
            <Icon aria-hidden className="size-3.5" />
            {t[p]}
          </label>
        );
      })}
      <span role="status" className="page-enter ml-1 text-xs text-ok">
        {justDone && value === 'done' ? t.celebrate : ''}
      </span>
    </fieldset>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const toInputDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromInputDate = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
};

/** Planejador de estudos: dias, duração e horário → sessões → arquivo .ics. */
/** Dias e duração de sessão que somam o ritmo pedido (h/semana). */
function presetFor(hoursPerWeek: number): { days: number[]; minutes: number } {
  if (hoursPerWeek >= 10) return { days: [1, 2, 3, 4, 5], minutes: 120 };
  if (hoursPerWeek >= 5) return { days: [1, 2, 3, 4, 5], minutes: 60 };
  return { days: [1, 3], minutes: 60 };
}

export function Planner({ courses, hoursPerWeek = 2 }: { courses: Course[]; hoursPerWeek?: number }) {
  const { locale } = usePreferences();
  const t = toolsContent[locale].planner;
  const [days, setDays] = useState<number[]>(() => presetFor(hoursPerWeek).days);
  const [minutes, setMinutes] = useState(() => presetFor(hoursPerWeek).minutes);
  const [time, setTime] = useState('19:00');
  const [start, setStart] = useState(() => toInputDate(new Date()));
  const items = useMemo(
    () => courses.flatMap((c) => (statedHours(c) === null ? [] : [{ id: c.slug, title: c.title, hours: statedHours(c)!, url: c.sourceUrl }])),
    [courses],
  );
  const skipped = courses.length - items.length;
  const sessions = useMemo(() => planSessions(items, { start: fromInputDate(start), weekdays: days, sessionMinutes: minutes, time }), [items, start, days, minutes, time]);
  const last = sessions.at(-1);
  const perWeek = ((days.length * minutes) / 60).toLocaleString(locale, { maximumFractionDigits: 1 });

  const download = () => {
    const ics = toICS(sessions, {
      calendarName: t.calendar,
      summary: (s) => t.eventTitle(s.title, s.index, s.total),
      description: (s) => t.eventDescription(s.url),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = t.file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!items.length) {
    return <p className="text-sm text-fg-muted">{t.none}</p>;
  }
  return (
    <div>
      <p className="text-sm text-fg-muted">{t.lead}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">{t.days}</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.weekdays.map((d, i) => {
              const on = days.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={t.weekdaysLong[i]}
                  onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== i) : [...cur, i].sort()))}
                  className={cn('h-9 min-w-12 rounded-lg border px-2 text-sm', on ? 'border-accent bg-accent-soft text-fg' : 'border-line-strong text-fg-muted hover:text-fg')}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="text-sm font-medium">
          {t.session}
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-1 block h-10 w-full rounded-lg border border-line-strong bg-surface px-2 font-normal">
            {[30, 45, 60, 90, 120].map((n) => (
              <option key={n} value={n}>
                {t.minutes(n)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t.time}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-line-strong bg-surface px-2 font-normal" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          {t.start}
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-line-strong bg-surface px-2 font-normal sm:w-60" />
        </label>
      </div>
      <p aria-live="polite" className="mt-4 text-sm">
        {days.length ? t.summary(sessions.length, perWeek, formatDate(last ? toInputDate(last.start) : start, locale) ?? '—') : t.pickDay}
      </p>
      {sessions.length >= MAX_SESSIONS && <p className="mt-1 text-xs text-warn">{t.capped(MAX_SESSIONS)}</p>}
      {skipped > 0 && <p className="mt-1 text-xs text-fg-subtle">{t.skipped(skipped)}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={download} disabled={!sessions.length} iconLeft={<CalendarArrowDown className="size-4" />}>
          {t.download}
        </Button>
        <span className="text-xs text-fg-subtle">{t.privacy}</span>
      </div>
    </div>
  );
}

/** Calculadora de horas complementares sobre uma lista de cursos. */
export function HoursCalculator({ courses, doneIds }: { courses: Course[]; doneIds: Set<string> }) {
  const { locale } = usePreferences();
  const t = toolsContent[locale].hours;
  const [required, setRequired] = useState(120);
  const [onlyDone, setOnlyDone] = useState(false);
  const scope = onlyDone ? courses.filter((c) => doneIds.has(c.id)) : courses;
  const r = complementaryHours(scope, required);
  return (
    <div>
      <p className="text-sm text-fg-muted">{t.lead}</p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="text-sm font-medium">
          {t.required}
          <input
            type="number"
            min={1}
            max={2000}
            inputMode="numeric"
            value={required}
            onChange={(e) => setRequired(Number(e.target.value))}
            className="mt-1 block h-10 w-36 rounded-lg border border-line-strong bg-surface px-2 font-normal"
          />
        </label>
        <fieldset className="text-sm">
          <legend className="font-medium">{t.scope}</legend>
          <div className="mt-1 flex gap-3">
            {([false, true] as const).map((v) => (
              <label key={String(v)} className="inline-flex items-center gap-1.5">
                <input type="radio" name="hours-scope" checked={onlyDone === v} onChange={() => setOnlyDone(v)} />
                {v ? t.scopeDone : t.scopeAll}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div aria-live="polite" className="mt-5">
        <p className="font-mono text-2xl">{t.total(r.total)}</p>
        <p className="text-sm text-fg-muted">{t.remaining(r.remaining)}</p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={r.required}
          aria-valuenow={Math.min(r.total, r.required)}
          aria-label={t.progress}
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${r.covered * 100}%` }} />
        </div>
      </div>
      {r.lines.length ? (
        <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
          {r.lines.map((l) => (
            <li key={l.course.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <Link to={coursePath(l.course)} className="min-w-0 truncate hover:text-accent-text">
                {l.course.title}
              </Link>
              <span className={cn('shrink-0 font-mono text-xs', l.status === 'counted' ? 'text-ok' : 'text-fg-subtle')}>
                {l.status === 'counted' ? `${l.hours} h` : t.status[l.status]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-fg-subtle">{t.empty}</p>
      )}
      <p className="mt-3 text-xs text-fg-subtle">{t.disclaimer}</p>
    </div>
  );
}
