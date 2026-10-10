import { useEffect, useState } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { readSession, writeSession } from '@/lib/storage';

const KEY = 'bz-intro-seen';
const DURATION_MS = 2600;

/**
 * Abertura da marca: o símbolo é "construído" face a face, o nome surge
 * letra a letra e o slogan aparece palavra por palavra. Roda uma vez por
 * sessão, pode ser pulada (clique ou qualquer tecla) e é omitida quando o
 * usuário prefere movimento reduzido. É decorativa (aria-hidden): o
 * conteúdo da página já está renderizado por baixo.
 */
export function BrandIntro() {
  const { reducedMotion, m } = usePreferences();
  const [phase, setPhase] = useState<'hidden' | 'playing' | 'leaving'>(() =>
    typeof window !== 'undefined' && !readSession(KEY) && !navigator.webdriver ? 'playing' : 'hidden',
  );

  useEffect(() => {
    if (phase !== 'playing') return;
    if (reducedMotion) {
      writeSession(KEY, '1');
      const id = requestAnimationFrame(() => setPhase('hidden'));
      return () => cancelAnimationFrame(id);
    }
    writeSession(KEY, '1');
    const leave = setTimeout(() => setPhase('leaving'), DURATION_MS);
    const skip = () => setPhase('leaving');
    window.addEventListener('keydown', skip, { once: true });
    return () => {
      clearTimeout(leave);
      window.removeEventListener('keydown', skip);
    };
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = setTimeout(() => setPhase('hidden'), 700);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'hidden') return null;

  const letters = 'BEZALEL'.split('');
  const words = m.common.slogan.split(' ');

  return (
    <div
      aria-hidden
      onClick={() => setPhase('leaving')}
      className="fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-bg-abyss transition-opacity duration-700 ease-[var(--ease-out)]"
      style={{ opacity: phase === 'leaving' ? 0 : 1 }}
    >
      <div className="bg-blueprint absolute inset-0 opacity-60 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
      <div className="relative flex flex-col items-center gap-7 text-fg">
        <BezalelMark animated className="size-24 md:size-28" />
        <div className="flex gap-[0.42em] font-sans text-2xl font-semibold tracking-[0.1em] md:text-3xl">
          {letters.map((l, i) => (
            <span key={i} className="bz-intro-letter" style={{ animationDelay: `${900 + i * 70}ms` }}>
              {l}
            </span>
          ))}
        </div>
        <div className="flex gap-3 font-mono text-xs uppercase tracking-[0.3em] text-accent-text">
          {words.map((w, i) => (
            <span key={w} className="bz-intro-word" style={{ animationDelay: `${1500 + i * 220}ms` }}>
              {w}
            </span>
          ))}
        </div>
        <span className="bz-intro-line absolute -bottom-10 h-px w-48 bg-gradient-to-r from-transparent via-accent to-transparent" />
      </div>
    </div>
  );
}
