import { useEffect, useState } from 'react';
import { usePreferences } from '@/app/preferences-context';
import { useInView } from '@/hooks/useInView';
import { formatNumber } from '@/lib/format';

/** Número que conta até o valor final quando entra na tela. */
export function CountUp({ value, durationMs = 1400, className }: { value: number; durationMs?: number; className?: string }) {
  const { reducedMotion, locale } = usePreferences();
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) {
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(2, -10 * p);
      setShown(Math.round(value * (p === 1 ? 1 : eased)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, durationMs, reducedMotion]);

  return (
    <span ref={ref} className={className} aria-label={formatNumber(value, locale)}>
      <span aria-hidden>{formatNumber(shown, locale)}</span>
    </span>
  );
}
