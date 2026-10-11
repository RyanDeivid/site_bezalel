import { useEffect, useRef, useState } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';
import { writeSession } from '@/lib/storage';

const KEY = 'bz-intro-seen';

/** Já tocou nesta página: voltar para a home por navegação interna não repete. */
let played = false;

/**
 * Abertura da marca: o símbolo é "construído" face a face, o nome surge
 * letra a letra e o slogan aparece palavra por palavra.
 *
 * Vem no HTML pré-gerado e é toda em CSS: começa na primeira pintura, antes
 * de o JavaScript chegar, e some sozinha (animação `bz-intro-out`). O script
 * do index.html marca `data-intro="off"` no <html> — e o CSS a esconde antes
 * de pintar — para quem já a viu nesta sessão, pediu menos movimento ou é um
 * navegador automatizado. Toque, clique, tecla ou rolagem pulam a abertura.
 * É decorativa (aria-hidden): o conteúdo da página já está por baixo.
 */
export function BrandIntro() {
  const { m } = usePreferences();
  // Na hidratação `played` é sempre falso (igual ao HTML pré-gerado).
  const [phase, setPhase] = useState<'playing' | 'leaving' | 'hidden'>(() => (played ? 'hidden' : 'playing'));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (played || root.dataset.intro === 'off' || !el) {
      // Já escondida pelo CSS (ou já vista); só remove do DOM.
      const id = requestAnimationFrame(() => setPhase('hidden'));
      return () => cancelAnimationFrame(id);
    }
    played = true;
    writeSession(KEY, '1');
    const leave = () => setPhase((p) => (p === 'playing' ? 'leaving' : p));
    const done = (e: AnimationEvent) => {
      if (e.target === el && e.animationName === 'bz-intro-out') setPhase('hidden');
    };
    el.addEventListener('animationend', done);
    // Depois que a entrada do hero (que espera a abertura) terminou, libera o
    // resto do site da espera — feito antes, a entrada pularia para o fim.
    const release = setTimeout(() => (root.dataset.intro = 'off'), 3200);
    const opts = { once: true, passive: true } as const;
    window.addEventListener('keydown', leave, opts);
    window.addEventListener('wheel', leave, opts);
    window.addEventListener('touchstart', leave, opts);
    return () => {
      clearTimeout(release);
      root.dataset.intro = 'off';
      el.removeEventListener('animationend', done);
      window.removeEventListener('keydown', leave);
      window.removeEventListener('wheel', leave);
      window.removeEventListener('touchstart', leave);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'leaving') return;
    // Daqui em diante o resto da página não espera mais pela abertura.
    document.documentElement.dataset.intro = 'off';
    const t = setTimeout(() => setPhase('hidden'), 450);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'hidden') return null;

  const letters = 'BEZALEL'.split('');
  const words = m.common.slogan.split(' ');

  return (
    <div
      ref={ref}
      aria-hidden
      onClick={() => setPhase('leaving')}
      className="bz-intro fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-bg-abyss"
      data-leaving={phase === 'leaving' ? '' : undefined}
    >
      <div className="bg-blueprint absolute inset-0 opacity-60 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
      <div className="relative flex flex-col items-center gap-7 text-fg">
        <BezalelMark animated className="size-24 md:size-28" />
        <div className="flex gap-[0.42em] font-sans text-2xl font-semibold tracking-[0.1em] md:text-3xl">
          {letters.map((l, i) => (
            <span key={i} className="bz-intro-letter" style={{ animationDelay: `calc(var(--intro-step) * ${i} + var(--intro-letters))` }}>
              {l}
            </span>
          ))}
        </div>
        <div className="flex gap-3 font-mono text-xs uppercase tracking-[0.3em] text-accent-text">
          {words.map((w, i) => (
            <span key={w} className="bz-intro-word" style={{ animationDelay: `calc(var(--intro-step) * ${i * 3} + var(--intro-words))` }}>
              {w}
            </span>
          ))}
        </div>
        <span className="bz-intro-line absolute -bottom-10 h-px w-48 bg-gradient-to-r from-transparent via-accent to-transparent" />
      </div>
    </div>
  );
}
