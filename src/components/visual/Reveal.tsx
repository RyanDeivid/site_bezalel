import { useEffect, useRef, type ComponentType, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/cn';

interface RevealProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: 'div' | 'section' | 'li' | 'article' | 'aside';
  /** Atraso (ms) para escalonar itens vizinhos; limitado a 180 ms. */
  delay?: number;
}

/* Um único IntersectionObserver para todos os elementos (barato), disparando
   um pouco ANTES de o elemento entrar na tela: rolando rápido, o conteúdo já
   está surgindo — nunca um "cartão vazio". */
let observer: IntersectionObserver | null = null;

function reveal(el: HTMLElement) {
  observer?.unobserve(el);
  el.dataset.reveal = 'in';
  // Terminada a transição, o elemento volta a ser comum (sem camada própria na GPU).
  const done = (e: TransitionEvent) => {
    if (e.target !== el) return;
    el.removeEventListener('transitionend', done);
    delete el.dataset.reveal;
  };
  el.addEventListener('transitionend', done);
}

function getObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target as HTMLElement);
    },
    { rootMargin: '0px 0px 18% 0px' },
  );
  return observer;
}

/* Classificação inicial também por IntersectionObserver (assíncrona): medir
   com getBoundingClientRect forçaria o layout de seções que o navegador está
   adiando (content-visibility). Só o que está abaixo da tela é recolhido. */
let classifier: IntersectionObserver | null = null;

function getClassifier(): IntersectionObserver {
  classifier ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      classifier?.unobserve(el);
      const bottom = entry.rootBounds?.bottom ?? window.innerHeight;
      if (!entry.isIntersecting && entry.boundingClientRect.top >= bottom) {
        el.dataset.reveal = 'pending';
        getObserver().observe(el);
      }
    }
  });
  return classifier;
}

function prefersReducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Entrada suave ao rolar (opacidade + deslocamento curto).
 *
 * O HTML pré-gerado não esconde nada: sem JavaScript, ou antes dele, tudo
 * aparece. Depois da hidratação, só o que ainda está ABAIXO da tela é
 * recolhido (o visitante não vê isso acontecer) e revelado ao se aproximar.
 * O que já estava visível fica como está. Movimento reduzido: sem efeito.
 */
export function Reveal({ children, as = 'div', delay = 0, className, style, ...rest }: RevealProps) {
  // Todas as tags permitidas aceitam os mesmos atributos HTML genéricos.
  const Tag = as as unknown as ComponentType<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }>;
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return;
    getClassifier().observe(el);
    return () => {
      classifier?.unobserve(el);
      observer?.unobserve(el);
      delete el.dataset.reveal;
    };
  }, []);

  return (
    <Tag ref={ref} style={{ '--reveal-delay': `${Math.min(delay, 180)}ms`, ...style } as CSSProperties} className={cn(className)} {...rest}>
      {children}
    </Tag>
  );
}
