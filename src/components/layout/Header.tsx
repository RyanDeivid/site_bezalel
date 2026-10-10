import { Languages, Menu, Moon, Sparkles, Sun, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { Logo } from '@/components/brand/Logo';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { MobileMenu } from './MobileMenu';
import { PRIMARY_NAV } from './nav-items';

export function Header() {
  const { m, theme, toggleTheme, locale, setLocale, motion, toggleMotion } = usePreferences();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled ? 'border-b border-line bg-bg/80 backdrop-blur-xl backdrop-saturate-150' : 'border-b border-transparent',
      )}
    >
      <div className="container-page flex h-[var(--header-h)] items-center gap-4">
        <Logo />
        <nav aria-label={m.nav.primary} className="ml-6 hidden flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  viewTransition
                  className={({ isActive }) =>
                    cn(
                      'relative inline-flex h-9 items-center rounded-lg px-3 text-[0.92rem] transition-colors duration-200',
                      'after:absolute after:inset-x-3 after:-bottom-[15px] after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-300',
                      isActive ? 'text-fg after:scale-x-100' : 'text-fg-muted hover:bg-surface-2/70 hover:text-fg',
                    )
                  }
                >
                  {m.nav[item.key]}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLocale(locale === 'pt-BR' ? 'en' : 'pt-BR')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-mono text-xs tracking-wider text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label={m.nav.switchLanguage}
            title={m.nav.switchLanguage}
          >
            <Languages aria-hidden className="size-4" />
            {m.nav.languageShort}
          </button>
          <IconButton label={motion === 'full' ? m.nav.motionReduce : m.nav.motionRestore} onClick={toggleMotion} active={motion === 'reduced'} className="hidden sm:inline-flex">
            {motion === 'full' ? <Sparkles className="size-4" /> : <Wind className="size-4" />}
          </IconButton>
          <IconButton label={theme === 'dark' ? m.nav.themeToLight : m.nav.themeToDark} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
          <IconButton label={m.nav.openMenu} onClick={() => setMenuOpen(true)} className="lg:hidden" aria-expanded={menuOpen} aria-haspopup="dialog">
            <Menu className="size-5" />
          </IconButton>
        </div>
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
