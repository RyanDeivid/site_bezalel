import { useEffect, useRef, useState } from 'react';

/** Observa quando um elemento entra na viewport. `once` mantém verdadeiro após a 1ª vez. */
export function useInView<T extends Element>(options: { rootMargin?: string; threshold?: number; once?: boolean } = {}) {
  const { rootMargin = '0px 0px -10% 0px', threshold = 0.15, once = true } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) setInView(false);
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, inView };
}
