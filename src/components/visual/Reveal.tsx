import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/cn';

interface RevealProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: 'div' | 'section' | 'li' | 'article' | 'aside';
  delay?: number;
}

/**
 * Entrada suave ao rolar (opacidade + deslocamento curto). O CSS ignora o
 * efeito com movimento reduzido; sem IntersectionObserver o conteúdo aparece
 * direto. Nunca esconde conteúdo de leitores de tela.
 */
export function Reveal({ children, as = 'div', delay = 0, className, style, ...rest }: RevealProps) {
  // Todas as tags permitidas aceitam os mesmos atributos HTML genéricos.
  const Tag = as as unknown as ComponentType<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement>; 'data-reveal'?: string; 'data-revealed'?: string }>;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <Tag
      ref={ref}
      data-reveal=""
      data-revealed={shown ? 'true' : 'false'}
      style={{ '--reveal-delay': `${delay}ms`, ...style } as CSSProperties}
      className={cn(className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
