import { useT } from '@/app/preferences-context';
import { BezalelMark } from '@/components/brand/BezalelMark';

/** Exibido enquanto o código de uma rota é baixado (code splitting). */
export function RouteFallback() {
  const m = useT();
  return (
    <div className="container-page grid min-h-[50vh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-4 text-fg-muted">
        <BezalelMark className="size-10 animate-pulse" />
        <span className="font-mono text-xs uppercase tracking-[0.2em]">{m.common.loading}</span>
      </div>
    </div>
  );
}
