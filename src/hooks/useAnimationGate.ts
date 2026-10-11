import { useEffect, useRef } from 'react';

/*
 * Portão de animações decorativas: tudo que anima dentro do elemento (CSS e
 * SMIL dos SVGs) só roda enquanto ele está DE FATO na tela.
 *
 * Por quê: animações de SVG (traços correndo, elipses pulsando) não rodam no
 * compositor — custam estilo, layout e pintura na thread principal a cada
 * quadro. Medido num celular médio simulado, três seções da home assim
 * ocupavam ~98% da thread principal mesmo com a página parada, inclusive
 * quando estavam logo abaixo da tela (o navegador mantém vizinhas renderizadas).
 *
 * Também faz o SMIL respeitar "reduzir movimento" — o CSS global não o alcança.
 */

let io: IntersectionObserver | null = null;

function reducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function setRunning(el: Element, running: boolean) {
  const run = running && !reducedMotion();
  el.toggleAttribute('data-anim-paused', !run);
  const svgs = el instanceof SVGSVGElement ? [el] : Array.from(el.querySelectorAll('svg'));
  for (const svg of svgs) {
    if (run) svg.unpauseAnimations?.();
    else svg.pauseAnimations?.();
  }
}

function getObserver(): IntersectionObserver {
  io ??= new IntersectionObserver((entries) => {
    for (const entry of entries) setRunning(entry.target, entry.isIntersecting);
  });
  return io;
}

/** Devolve a ref a ser posta no contêiner cujas animações devem ser controladas. */
export function useAnimationGate<T extends Element>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    setRunning(el, false);
    const observer = getObserver();
    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);
  return ref;
}
