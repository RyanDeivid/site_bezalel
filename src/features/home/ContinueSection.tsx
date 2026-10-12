import { ArrowRight, Bookmark } from 'lucide-react';
import { useMemo, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { ButtonLink } from '@/components/ui/Button';
import { curated } from '@/data/catalog/store';
import { progressSummary } from '@/domain/tools/shelf';
import { LAST_TRAIL_KEY } from '@/domain/tools/keys';
import { trailFromParams } from '@/domain/tools/trail';
import { useShelf } from '@/hooks/useShelf';
import { readStorage } from '@/lib/storage';
import { continueText as TEXT } from './continue-content';


const subscribeStorage = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

/** Última trilha montada neste navegador (null na pré-renderização e na hidratação). */
function useLastTrail(): string | null {
  return useSyncExternalStore(
    subscribeStorage,
    () => readStorage(LAST_TRAIL_KEY),
    () => null,
  );
}

/**
 * "Continue de onde parou" (efeito do gradiente de meta): para quem volta,
 * o curso em andamento e quanto falta da trilha — com os dados que o próprio
 * visitante marcou, guardados só no navegador dele. Quem chega pela primeira
 * vez não vê nada aqui (nada é inventado para "parecer ativo").
 */
export default function ContinueSection() {
  const { locale } = usePreferences();
  const t = TEXT[locale];
  const [shelf] = useShelf();
  const last = useLastTrail();
  const data = useMemo(() => {
    const all = curated();
    const byId = new Map(all.map((c) => [c.id, c]));
    const bySlug = new Map(all.map((c) => [c.slug, c]));
    const doing = Object.entries(shelf.progress).flatMap(([id, p]) => (p === 'doing' && byId.has(id) ? [byId.get(id)!] : []))[0] ?? null;
    const parsed = last ? trailFromParams(new URLSearchParams(last)) : null;
    const trailIds = parsed ? parsed.slugs.flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!.id] : [])) : [];
    const trail = trailIds.length ? progressSummary(shelf, trailIds) : null;
    return { doing, trail, saved: shelf.saved.filter((id) => byId.has(id)).length };
  }, [shelf, last]);

  const { doing, trail, saved } = data;
  if (!doing && !trail && !saved) return null;
  const left = trail ? trail.total - trail.done : 0;

  return (
    <section aria-labelledby="continue-title" className="container-page py-10">
      <div className="panel page-enter flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 id="continue-title" className="eyebrow">
            {t.eyebrow}
          </h2>
          {doing && (
            <p className="mt-3 text-lg font-semibold">
              <span className="text-fg-muted">{t.doing}: </span>
              <Link to={`/course/${doing.slug}`} className="hover:text-accent-text">
                {doing.title}
              </Link>
            </p>
          )}
          {trail && (
            <div className="mt-3 max-w-md">
              <p className="text-sm text-fg-muted">
                {t.trail(trail.done, trail.total)}
                {left > 0 && trail.done > 0 && ` · ${t.left(left)}`}
              </p>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={trail.total} aria-valuenow={trail.done} aria-label={t.trailProgress} className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(trail.done / trail.total) * 100}%` }} />
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-fg-subtle">{t.note}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {trail && last && (
            <ButtonLink to={`/trail?${last}`} iconRight={<ArrowRight className="size-4" />}>
              {t.openTrail}
            </ButtonLink>
          )}
          {saved > 0 && (
            <ButtonLink to="/saved" variant="secondary" iconLeft={<Bookmark className="size-4" />}>
              {t.openShelf(saved)}
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}
