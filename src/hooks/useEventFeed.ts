import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { deriveAgentStatuses, deriveOpsMetrics } from '@/domain/operations';
import { useServices } from '@/services/context';

/**
 * Assina o EventService (simulado ou real) e deriva métricas e estados dos
 * agentes. Um relógio recalcula estados dependentes de tempo (ativo → ocioso)
 * mesmo sem novos eventos; quem só exibe o último evento passa `clockMs: 0`
 * e não re-renderiza a cada segundo. O relógio para com a aba oculta.
 */
export function useEventFeed({ clockMs = 1000, startWhenIdle = false }: { clockMs?: number; startWhenIdle?: boolean } = {}) {
  const { events: service } = useServices();
  const state = useSyncExternalStore(service.subscribe, service.getState, service.getState);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!startWhenIdle) {
      service.start();
      return;
    }
    // Em vitrines (ex.: faixa da home) a simulação — que executa o pipeline
    // real — só começa quando o navegador fica ocioso, fora do carregamento.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => service.start(), { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => service.start(), 1500);
    return () => clearTimeout(t);
  }, [service, startWhenIdle]);

  useEffect(() => {
    if (!clockMs) return;
    let t: ReturnType<typeof setInterval> | undefined;
    const run = () => {
      clearInterval(t);
      t = document.hidden ? undefined : setInterval(() => setNow(new Date()), clockMs);
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', run);
    };
  }, [clockMs]);

  const metrics = useMemo(() => deriveOpsMetrics(state.events, now), [state.events, now]);
  const agents = useMemo(() => deriveAgentStatuses(state.events, now), [state.events, now]);

  return {
    ...state,
    metrics,
    agents,
    now,
    pause: () => service.pause(),
    resume: () => service.resume(),
  };
}
