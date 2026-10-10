import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { deriveAgentStatuses, deriveOpsMetrics } from '@/domain/operations';
import { useServices } from '@/services/context';

/**
 * Assina o EventService (simulado ou real) e deriva métricas e estados dos
 * agentes. Um relógio de 1 s recalcula estados dependentes de tempo
 * (ativo → ocioso) mesmo sem novos eventos.
 */
export function useEventFeed() {
  const { events: service } = useServices();
  const state = useSyncExternalStore(service.subscribe, service.getState, service.getState);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    service.start();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [service]);

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
