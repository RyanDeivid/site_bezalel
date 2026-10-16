import { ArrowRight, BookOpen, Bookmark, CornerDownLeft, Languages, Moon, Search, Wind } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { Dialog } from '@/components/ui/Dialog';
import { curated } from '@/data/catalog/store';
import { searchCatalog } from '@/domain/catalog/search';
import { useShelf } from '@/hooks/useShelf';
import { cn } from '@/lib/cn';
import { normalizeText } from '@/lib/text';
import { searchVocabulary } from '@/services/catalog/vocabulary';
import type { Locale } from '@/types/domain';

const TEXT: Record<Locale, { title: string; placeholder: string; label: string; courses: string; saved: string; pages: string; actions: string; empty: string; hint: string; theme: string; language: string; motion: string }> = {
  'pt-BR': {
    title: 'Buscar e ir para…',
    placeholder: 'Curso, página ou ação',
    label: 'Buscar cursos, páginas e ações',
    courses: 'Cursos',
    saved: 'Na sua estante',
    pages: 'Páginas',
    actions: 'Ações',
    empty: 'Nada encontrado.',
    hint: '↑ ↓ para escolher · Enter para abrir · Esc para fechar',
    theme: 'Alternar tema claro/escuro',
    language: 'Switch to English',
    motion: 'Reduzir/restaurar animações',
  },
  en: {
    title: 'Search and go to…',
    placeholder: 'Course, page or action',
    label: 'Search courses, pages and actions',
    courses: 'Courses',
    saved: 'On your shelf',
    pages: 'Pages',
    actions: 'Actions',
    empty: 'Nothing found.',
    hint: '↑ ↓ to choose · Enter to open · Esc to close',
    theme: 'Toggle light/dark theme',
    language: 'Mudar para português',
    motion: 'Reduce/restore animations',
  },
};

interface Item {
  id: string;
  group: 'courses' | 'saved' | 'pages' | 'actions';
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

/**
 * Paleta de comandos (Ctrl+K): busca no catálogo verificado, páginas e ações
 * de preferência. Padrão combobox + listbox da WAI-ARIA: o foco fica no campo
 * e as setas movem a opção ativa (aria-activedescendant).
 */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { m, locale, setLocale, toggleTheme, toggleMotion } = usePreferences();
  const t = TEXT[locale];
  const navigate = useNavigate();
  const [shelf] = useShelf();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const vocab = useMemo(() => searchVocabulary(), []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const close = () => {
    setQuery('');
    setActive(0);
    onClose();
  };
  const go = (to: string) => () => navigate(to, { viewTransition: true });

  const items = useMemo<Item[]>(() => {
    const q = normalizeText(query.trim());
    const pages: Array<[string, string]> = [
      ['/', m.nav.home],
      ['/explore', m.nav.explore],
      ['/trail', m.nav.trail],
      ['/skills', m.meta.skills.title],
      ['/saved', m.nav.saved],
      ['/insights', m.nav.insights],
      ['/agents', m.nav.agents],
      ['/lab', m.nav.lab],
      ['/universe', m.nav.universe],
      ['/assistant', m.nav.assistantLong],
      ['/about', m.nav.about],
      ['/methodology', m.nav.methodology],
    ];
    const pageItems: Item[] = pages
      .filter(([, label]) => !q || normalizeText(label).includes(q))
      .map(([to, label]) => ({ id: `p${to}`, group: 'pages', label, icon: to === '/saved' ? <Bookmark className="size-4" /> : <ArrowRight className="size-4" />, run: go(to) }));
    const actions: Item[] = [
      { id: 'a-theme', group: 'actions' as const, label: t.theme, icon: <Moon className="size-4" />, run: toggleTheme },
      { id: 'a-lang', group: 'actions' as const, label: t.language, icon: <Languages className="size-4" />, run: () => setLocale(locale === 'pt-BR' ? 'en' : 'pt-BR') },
      { id: 'a-motion', group: 'actions' as const, label: t.motion, icon: <Wind className="size-4" />, run: toggleMotion },
    ].filter((a) => !q || normalizeText(a.label).includes(q));
    let courses: Item[] = [];
    if (q.length >= 2) {
      courses = searchCatalog(curated(), { q: query, pageSize: 6 }, vocab).hits.map(({ course }) => ({
        id: `c-${course.id}`,
        group: 'courses',
        label: course.title,
        hint: course.provider.name,
        icon: <BookOpen className="size-4" />,
        run: go(`/course/${course.slug}`),
      }));
    } else if (!q) {
      const byId = new Map(curated().map((c) => [c.id, c]));
      courses = shelf.saved.slice(0, 4).flatMap((id) => {
        const c = byId.get(id);
        return c ? [{ id: `s-${c.id}`, group: 'saved' as const, label: c.title, hint: c.provider.name, icon: <Bookmark className="size-4" />, run: go(`/course/${c.slug}`) }] : [];
      });
    }
    return [...courses, ...pageItems, ...actions];
    // `go` depende só de navigate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, m, t, shelf.saved, vocab, locale, setLocale, toggleTheme, toggleMotion, navigate]);

  const current = Math.min(active, Math.max(0, items.length - 1));
  const choose = (item: Item | undefined) => {
    if (!item) return;
    close();
    item.run();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((current + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((current - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[current]);
    }
  };

  // Mantém a opção ativa visível ao navegar pelas setas.
  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [current, listId]);

  const labels = { courses: t.courses, saved: t.saved, pages: t.pages, actions: t.actions };
  return (
    <Dialog open={open} onClose={close} title={t.title}>
      <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 focus-within:border-accent">
        <Search aria-hidden className="size-4 text-fg-subtle" />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-label={t.label}
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={items.length ? `${listId}-${current}` : undefined}
          placeholder={t.placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-12 w-full bg-transparent outline-none"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <ul id={listId} role="listbox" aria-label={t.label} className="mt-3 max-h-[min(60vh,26rem)] overflow-y-auto">
        {items.map((item, i) => (
          <li key={item.id} role="presentation">
            {(i === 0 || items[i - 1]!.group !== item.group) && (
              <p aria-hidden className="px-3 pb-1 pt-3 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle">
                {labels[item.group]}
              </p>
            )}
            <div
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === current}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(item)}
              className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2', i === current ? 'bg-accent-soft text-fg' : 'text-fg-muted')}
            >
              <span aria-hidden className="text-accent-text">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.label}</span>
                {item.hint && <span className="block truncate text-xs text-fg-subtle">{item.hint}</span>}
              </span>
              {i === current && <CornerDownLeft aria-hidden className="size-3.5 text-fg-subtle" />}
            </div>
          </li>
        ))}
      </ul>
      {!items.length && <p className="px-3 py-4 text-sm text-fg-subtle">{t.empty}</p>}
      <p className="mt-3 hidden text-xs text-fg-subtle sm:block">{t.hint}</p>
    </Dialog>
  );
}
