import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useT } from '@/app/preferences-context';
import { IconButton } from '@/components/ui/Button';
import { isSaved, toggleSaved } from '@/domain/tools/shelf';
import { useShelf } from '@/hooks/useShelf';
import { cn } from '@/lib/cn';
import type { Course } from '@/types/domain';

/**
 * Salvar/remover um curso da "Minha estante" (guardada só no navegador).
 * Registros de demonstração não entram: a estante é feita de cursos reais.
 */
export function SaveButton({
  course,
  size = 'sm',
  withLabel = false,
  className,
}: {
  course: Pick<Course, 'id' | 'title' | 'origin'>;
  size?: 'sm' | 'md';
  withLabel?: boolean;
  className?: string;
}) {
  const m = useT();
  const [shelf, update] = useShelf();
  if (course.origin === 'demo') return null;
  const saved = isSaved(shelf, course.id);
  const Icon = saved ? BookmarkCheck : Bookmark;
  const label = saved ? m.shelf.unsave(course.title) : m.shelf.save(course.title);
  const toggle = () => update((s) => toggleSaved(s, course.id));
  if (withLabel) {
    return (
      <button
        type="button"
        aria-pressed={saved}
        aria-label={label}
        onClick={toggle}
        className={cn(
          'inline-flex h-12 items-center gap-2 rounded-xl border px-5 font-medium transition-colors',
          saved ? 'border-accent/60 bg-accent-soft text-accent-text' : 'border-line-strong text-fg hover:border-accent/60',
          className,
        )}
      >
        <Icon aria-hidden className="size-4" />
        {saved ? m.shelf.savedShort : m.shelf.saveShort}
      </button>
    );
  }
  return (
    <IconButton label={label} size={size} active={saved} aria-pressed={saved} onClick={toggle} className={className}>
      <Icon className="size-4" />
    </IconButton>
  );
}
