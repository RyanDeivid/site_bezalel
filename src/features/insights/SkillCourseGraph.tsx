import { useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import type { SkillInsight, SkillPair } from '@/domain/insights';
import { cn } from '@/lib/cn';
import type { Course } from '@/types/domain';

interface Props {
  skills: SkillInsight[];
  courses: Course[];
  pairs: SkillPair[];
  skillName: (id: string) => string;
}

const ROW = 30;

/**
 * Grafo bipartido competência → curso (visão do agente Atlas). Em telas
 * pequenas o grafo é substituído por listas, que carregam a mesma informação.
 */
export function SkillCourseGraph({ skills, courses, pairs, skillName }: Props) {
  const { m } = usePreferences();
  const r = m.insights.relations;
  const top = skills.slice(0, 10);
  const [selected, setSelected] = useState<string | null>(top[0]?.skillId ?? null);
  const current = top.find((s) => s.skillId === selected) ?? top[0];

  const linkedIds = new Set(top.flatMap((s) => s.courseIds));
  const linkedCourses = courses.filter((c) => linkedIds.has(c.id));

  const rows = Math.max(top.length, linkedCourses.length);
  const height = rows * ROW + 20;
  const skillY = (i: number) => 20 + i * ((height - 40) / Math.max(1, top.length - 1 || 1));
  const courseY = (i: number) => 10 + i * ROW + ROW / 2;
  const highlighted = new Set(current?.courseIds ?? []);
  const relatedPairs = pairs.filter((p) => current && (p.a === current.skillId || p.b === current.skillId));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="hidden md:block">
        <svg viewBox={`0 0 820 ${height}`} className="w-full" role="group" aria-label={r.title}>
          {top.map((s, i) =>
            s.courseIds.map((cid) => {
              const ci = linkedCourses.findIndex((c) => c.id === cid);
              if (ci < 0) return null;
              const active = s.skillId === current?.skillId;
              const y1 = skillY(i);
              const y2 = courseY(ci);
              return (
                <path
                  key={`${s.skillId}-${cid}`}
                  d={`M 230 ${y1} C 380 ${y1}, 420 ${y2}, 560 ${y2}`}
                  fill="none"
                  stroke={active ? 'var(--accent)' : 'var(--fg)'}
                  strokeOpacity={active ? 0.85 : 0.08}
                  strokeWidth={active ? 1.8 : 1}
                  style={{ transition: 'stroke-opacity 300ms, stroke 300ms' }}
                />
              );
            }),
          )}
          {top.map((s, i) => {
            const active = s.skillId === current?.skillId;
            return (
              <g
                key={s.skillId}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                aria-label={r.coursesFor(skillName(s.skillId), s.courseCount)}
                onMouseEnter={() => setSelected(s.skillId)}
                onFocus={() => setSelected(s.skillId)}
                onClick={() => setSelected(s.skillId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(s.skillId);
                  }
                }}
                className="cursor-pointer outline-none [&:focus-visible_rect]:stroke-[var(--focus)]"
              >
                <rect x="0" y={skillY(i) - 13} width="226" height="26" rx="13" fill={active ? 'var(--accent-soft)' : 'transparent'} stroke={active ? 'var(--accent)' : 'var(--line-strong)'} />
                <text x="14" y={skillY(i) + 4.5} fontSize="13" fill="var(--fg)" fontFamily="var(--font-sans)">
                  {skillName(s.skillId)}
                </text>
                <text x="212" y={skillY(i) + 4.5} fontSize="11" textAnchor="end" fill="var(--fg-subtle)" fontFamily="var(--font-mono)">
                  {s.courseCount}
                </text>
                <circle cx="230" cy={skillY(i)} r="3.5" fill={active ? 'var(--accent)' : 'var(--fg-subtle)'} />
              </g>
            );
          })}
          {linkedCourses.map((c, i) => (
            <g key={c.id} opacity={highlighted.has(c.id) ? 1 : 0.4} style={{ transition: 'opacity 300ms' }}>
              <circle cx="560" cy={courseY(i)} r="3.5" fill={highlighted.has(c.id) ? 'var(--accent)' : 'var(--fg-subtle)'} />
              <text x="572" y={courseY(i) + 4.5} fontSize="12" fill="var(--fg)" fontFamily="var(--font-sans)">
                {c.title.length > 34 ? `${c.title.slice(0, 33)}…` : c.title}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="space-y-6">
        <div className="md:hidden">
          <label className="text-sm text-fg-muted">
            {r.select}
            <select
              value={current?.skillId ?? ''}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-fg"
            >
              {top.map((s) => (
                <option key={s.skillId} value={s.skillId}>
                  {skillName(s.skillId)} ({s.courseCount})
                </option>
              ))}
            </select>
          </label>
        </div>
        {current ? (
          <div aria-live="polite">
            <p className="font-medium">{r.coursesFor(skillName(current.skillId), current.courseCount)}</p>
            <ul className="mt-3 space-y-2">
              {courses
                .filter((c) => current.courseIds.includes(c.id))
                .map((c) => (
                  <li key={c.id}>
                    <Link to={`/course/${c.slug}`} className="text-sm text-fg-muted hover:text-accent-text">
                      {c.title} <span className="text-fg-subtle">· {c.provider.name}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <p className="text-fg-muted">{r.hint}</p>
        )}
        {relatedPairs.length > 0 && (
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-fg-subtle">{r.pairs}</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {relatedPairs.map((p) => {
                const other = p.a === current?.skillId ? p.b : p.a;
                return (
                  <li key={`${p.a}-${p.b}`} className={cn('flex justify-between gap-3 text-fg-muted')}>
                    <span>{skillName(other)}</span>
                    <span className="font-mono text-xs text-fg-subtle">{r.pairCourses(p.courses)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
