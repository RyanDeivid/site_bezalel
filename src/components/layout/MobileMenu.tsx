import { ArrowUpRight, Sparkles, Wind, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { INSTITUTIONAL_NAV, PRIMARY_NAV } from './nav-items';

/** Menu de tela cheia para telas pequenas, em <dialog> nativo (foco preso, Esc fecha). */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { m, motion, toggleMotion } = usePreferences();
  const location = useLocation();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal?.();
    if (!open && el.open) el.close?.();
  }, [open]);

  // Fecha ao navegar.
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (lastPath.current !== location.pathname) {
      lastPath.current = location.pathname;
      onClose();
    }
  }, [location.pathname, onClose]);

  return (
    <dialog
      ref={ref}
      aria-label={m.nav.primary}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-bg-abyss/70 backdrop:backdrop-blur"
    >
      {open && (
        <div className="page-enter flex h-full flex-col bg-bg text-fg">
          <div className="container-page flex h-[var(--header-h)] items-center justify-between border-b border-line">
            <span className="flex items-center gap-3">
              <BezalelMark className="size-7" />
              <span className="font-semibold uppercase tracking-[0.32em]">Bezalel</span>
            </span>
            <IconButton label={m.nav.closeMenu} onClick={onClose}>
              <X className="size-5" />
            </IconButton>
          </div>
          <nav className="container-page flex-1 overflow-y-auto py-6">
            <ul className="flex flex-col">
              {[{ to: '/', key: 'home' as const }, ...PRIMARY_NAV].map((item, i) => (
                <li key={item.to} className="border-b border-line" style={{ animation: `bz-fade-up 500ms var(--ease-out) ${i * 45}ms both` }}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn('flex items-center justify-between py-4 text-2xl font-medium tracking-tight', isActive ? 'text-accent-text' : 'text-fg')
                    }
                  >
                    {m.nav[item.key]}
                    <ArrowUpRight aria-hidden className="size-5 text-fg-subtle" />
                  </NavLink>
                </li>
              ))}
            </ul>
            <ul className="mt-8 grid grid-cols-2 gap-3 text-sm">
              {INSTITUTIONAL_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className="text-fg-muted hover:text-fg">
                    {m.nav[item.key]}
                  </NavLink>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={toggleMotion}
              className="mt-8 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-fg-muted"
              aria-pressed={motion === 'reduced'}
            >
              {motion === 'full' ? <Sparkles className="size-4" /> : <Wind className="size-4" />}
              {motion === 'full' ? m.nav.motionReduce : m.nav.motionRestore}
            </button>
          </nav>
        </div>
      )}
    </dialog>
  );
}
