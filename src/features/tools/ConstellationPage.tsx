import { ArrowRight, Bookmark, Compass, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { PageHero } from '@/components/layout/PageHero';
import { SaveButton } from '@/components/tools/SaveButton';
import { ButtonLink, IconButton } from '@/components/ui/Button';
import { skillName, skills } from '@/data/catalog/store';
import { categories, categoryGroups } from '@/data/catalog/taxonomy';
import { explorePath } from '@/domain/catalog/query-params';
import { buildConstellation, neighborsOf, personalSky, type StarState } from '@/domain/tools/constellation';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useShelf } from '@/hooks/useShelf';
import { cn } from '@/lib/cn';
import type { CategoryGroupId } from '@/types/domain';
import { coursePath } from '../catalog/present';
import { groupOf, publishedCourses } from './catalog';
import { constellationContent } from './constellation-content';
import { SkyMap, StarMark } from './SkyMap';

const STATES: StarState[] = ['have', 'learning', 'next'];

/**
 * Constelação de competências (v2 · Fase 4): o catálogo verificado visto como
 * um céu de competências ligadas pelos cursos que as ensinam juntas, com a
 * parte do visitante acesa a partir da estante (só neste navegador).
 * `?skill=<id>` abre uma competência — dá para compartilhar o link.
 */
export default function ConstellationPage() {
  const { m, locale, motion } = usePreferences();
  const t = constellationContent[locale];
  useDocumentMeta({ title: m.meta.skills.title, description: m.meta.skills.description, path: '/skills' });
  const [shelf] = useShelf();
  const [params, setParams] = useSearchParams();
  const [hover, setHover] = useState<string | null>(null);

  const courses = useMemo(() => publishedCourses(), []);
  const byId = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const sky = useMemo(() => buildConstellation(skills(), courses, groupOf), [courses]);
  const mine = useMemo(() => personalSky(shelf, courses, sky.links), [shelf, courses, sky.links]);
  const starById = useMemo(() => new Map(sky.stars.map((s) => [s.id, s])), [sky.stars]);

  const selectedParam = params.get('skill');
  const selected = selectedParam && starById.has(selectedParam) ? selectedParam : null;
  const groupParam = params.get('tema') as CategoryGroupId | null;
  const group = groupParam && categoryGroups.some((g) => g.id === groupParam) ? groupParam : null;

  const setParam = (key: 'skill' | 'tema', value: string | null) =>
    setParams(
      (cur) => {
        const next = new URLSearchParams(cur);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  const nameOf = (id: string) => skillName(id, locale);
  const groupName = (id: CategoryGroupId) => categoryGroups.find((g) => g.id === id)?.name[locale] ?? id;
  const select = (id: string) => setParam('skill', id === selected ? null : id);
  /** Escolha fora do mapa (lista, sugestões): leva o painel da competência à vista. */
  const selectAndShow = (id: string) => {
    if (id !== selected) setParam('skill', id);
    requestAnimationFrame(() => document.getElementById('sky-detail')?.scrollIntoView({ block: 'nearest', behavior: motion === 'reduced' ? 'auto' : 'smooth' }));
  };
  /** Botões que apontam para uma estrela a acendem no mapa enquanto o ponteiro ou o foco estão neles. */
  const peek = (id: string) => ({ onPointerEnter: () => setHover(id), onPointerLeave: () => setHover(null), onFocus: () => setHover(id), onBlur: () => setHover(null) });
  const star = selected ? starById.get(selected) : undefined;
  const lit = mine.have + mine.learning > 0;

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} particles={false}>
        <p className="mt-6 font-mono text-xs tracking-wider text-fg-muted">{t.stats(sky.stars.length, sky.links.length, courses.length)}</p>
      </PageHero>

      <div className="container-page py-10">
        <div role="group" aria-label={t.filter} className="flex flex-wrap gap-2">
          {[null, ...categoryGroups.map((g) => g.id)].map((id) => (
            <button
              key={id ?? 'all'}
              type="button"
              aria-pressed={group === id}
              onClick={() => setParam('tema', id)}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors',
                group === id ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {id ? groupName(id) : t.all}
            </button>
          ))}
        </div>

        {group === null && <p className="mt-3 text-xs text-fg-subtle sm:hidden">{t.zoomHint}</p>}
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <figure className="panel overflow-hidden p-2 sm:p-4 lg:col-span-8">
            <SkyMap
              sky={sky}
              state={mine.state}
              selected={selected}
              group={group}
              label={t.mapLabel(sky.stars.length, sky.links.length)}
              nameOf={nameOf}
              groupName={groupName}
              coursesLabel={t.list.courses}
              onSelect={selectAndShow}
              hover={hover}
              onHover={setHover}
            />
            <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 px-2 pb-1 pt-3 text-xs text-fg-muted">
              <span className="sr-only">{t.legend}: </span>
              {STATES.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <svg aria-hidden viewBox="-9 -9 18 18" className="size-4">
                    <StarMark state={s} r={5} />
                  </svg>
                  <span>
                    <span className="text-fg">{t.states[s]}</span> — {t.stateHint[s]}
                  </span>
                </span>
              ))}
              <span>{t.size}</span>
            </figcaption>
          </figure>

          <aside className="space-y-6 lg:col-span-4" aria-live="polite">
            {star ? (
              <section aria-labelledby="sky-detail" className="panel p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{t.detail.area(groupName(star.group), categories.find((c) => c.id === star.category)?.name[locale] ?? '')}</p>
                    <h2 id="sky-detail" className="mt-2 text-xl font-semibold">
                      {nameOf(star.id)}
                    </h2>
                  </div>
                  <IconButton label={t.detail.close} size="sm" onClick={() => setParam('skill', null)}>
                    <X className="size-4" />
                  </IconButton>
                </div>
                <p className="mt-2 text-sm text-fg-muted">{skills().find((s) => s.id === star.id)?.description[locale]}</p>
                {mine.state.get(star.id) && <p className="mt-3 text-sm font-medium">{t.detail.state(t.states[mine.state.get(star.id)!])}</p>}

                <h3 className="mt-5 text-sm font-semibold">{t.detail.taught(star.courseIds.length)}</h3>
                <ul className="mt-2 space-y-2">
                  {star.courseIds.flatMap((id) => {
                    const c = byId.get(id);
                    return c
                      ? [
                          <li key={id} className="flex items-start justify-between gap-2 rounded-xl border border-line p-3">
                            <div className="min-w-0">
                              <Link to={coursePath(c)} className="text-sm font-medium leading-snug hover:text-accent-text">
                                {c.title}
                              </Link>
                              <p className="text-xs text-fg-muted">{c.provider.name}</p>
                            </div>
                            <SaveButton course={c} />
                          </li>,
                        ]
                      : [];
                  })}
                </ul>

                <h3 className="mt-5 text-sm font-semibold">{t.detail.together}</h3>
                {neighborsOf(star.id, sky.links).length ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {neighborsOf(star.id, sky.links).map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => select(n.id)}
                          {...peek(n.id)}
                          title={t.detail.sharedCourses(n.courses)}
                          className="inline-flex h-8 items-center rounded-full border border-accent/30 bg-accent-soft px-3 text-sm transition-colors hover:border-accent"
                        >
                          {nameOf(n.id)}
                          <span className="sr-only"> — {t.detail.sharedCourses(n.courses)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-fg-muted">{t.detail.together0}</p>
                )}
                <ButtonLink to={explorePath({ q: nameOf(star.id) })} variant="ghost" size="sm" className="mt-4" iconLeft={<Search className="size-4" />}>
                  {t.detail.search}
                </ButtonLink>
              </section>
            ) : (
              <p className="rounded-2xl border border-dashed border-line-strong p-5 text-sm text-fg-muted">{t.detail.hint}</p>
            )}

            <section aria-labelledby="sky-mine" className="panel p-6">
              <h2 id="sky-mine" className="text-lg font-semibold">
                {lit ? t.mine.title : t.mine.emptyTitle}
              </h2>
              {lit ? (
                <>
                  <p className="mt-1 text-sm text-fg-muted">{t.mine.summary(mine.have, mine.learning)}</p>
                  {mine.next.length > 0 && (
                    <>
                      <h3 className="mt-5 text-sm font-semibold">{t.mine.nextTitle}</h3>
                      <p className="text-xs text-fg-subtle">{t.mine.nextLead}</p>
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {mine.next.map((id) => (
                          <li key={id}>
                            <button
                              type="button"
                              onClick={() => selectAndShow(id)}
                              {...peek(id)}
                              aria-pressed={selected === id}
                              className="inline-flex h-8 items-center rounded-full border border-dashed px-3 text-sm transition-colors hover:bg-surface-2"
                              style={{ borderColor: 'var(--series-3)' }}
                            >
                              {nameOf(id)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <ButtonLink to="/saved" variant="ghost" size="sm" className="mt-4" iconLeft={<Bookmark className="size-4" />}>
                    {t.mine.shelf}
                  </ButtonLink>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-fg-muted">{t.mine.empty}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ButtonLink to="/trail" size="sm" iconLeft={<Compass className="size-4" />}>
                      {t.mine.emptyTrail}
                    </ButtonLink>
                    <ButtonLink to="/explore" size="sm" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
                      {t.mine.emptyExplore}
                    </ButtonLink>
                  </div>
                </>
              )}
            </section>
          </aside>
        </div>

        <section aria-labelledby="sky-list" className="mt-14">
          <h2 id="sky-list" className="text-title">
            {t.list.title}
          </h2>
          <p className="mt-2 text-fg-muted">{t.list.lead}</p>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {categoryGroups
              .filter((g) => group === null || g.id === group)
              .map((g) => {
                const members = sky.stars.filter((s) => s.group === g.id);
                const open = group === g.id || members.some((s) => s.id === selected);
                return (
                  <details key={`${g.id}-${open}`} open={open} className="panel p-4">
                    <summary className="cursor-pointer font-semibold">
                      {g.name[locale]} <span className="font-mono text-xs font-normal text-fg-muted">· {members.length}</span>
                    </summary>
                    <ul className="mt-3 grid grid-cols-1 gap-1">
                      {members.map((s) => {
                        const st = mine.state.get(s.id);
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              aria-pressed={selected === s.id}
                              aria-label={`${t.list.select(nameOf(s.id), s.courseIds.length)}${st ? ` — ${t.states[st]}` : ''}`}
                              onClick={() => selectAndShow(s.id)}
                              {...peek(s.id)}
                              className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2', selected === s.id && 'bg-accent-soft')}
                            >
                              <svg aria-hidden viewBox="-9 -9 18 18" className="size-4 shrink-0">
                                <StarMark state={st} r={5} />
                              </svg>
                              <span className="min-w-0 flex-1 truncate">{nameOf(s.id)}</span>
                              {st && <span className="text-xs text-fg-muted">{t.states[st]}</span>}
                              <span className="w-16 text-right font-mono text-xs text-fg-subtle">{t.list.courses(s.courseIds.length)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
          </div>
        </section>
      </div>
    </>
  );
}
