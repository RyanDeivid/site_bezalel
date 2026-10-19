import { ArrowDown, ArrowUp, CircleStop, Footprints, Gauge, Zap } from 'lucide-react';
import type { MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Joystick } from '@/components/three/Joystick';
import { cn } from '@/lib/cn';
import type { UniverseRuntime } from './world/runtime';

type HoldKey = keyof UniverseRuntime['buttons'];

/** Botão "segurar" (pedal, subir, correr): liga enquanto o dedo está em cima. */
function HoldButton({ runtime, k, label, children, big }: { runtime: UniverseRuntime; k: HoldKey; label: string; children: ReactNode; big?: boolean }) {
  const set = (on: boolean) => setHold(runtime, k, on);
  return (
    <button
      type="button"
      aria-label={label}
      className={cn('glass grid touch-none select-none place-items-center rounded-full border border-line-strong active:bg-accent-soft', big ? 'size-16' : 'size-12')}
      onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onContextMenu={(e: MouseEvent) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** Escrito fora do componente: o estado do jogo é um objeto mutável (não é estado do React). */
function setHold(rt: UniverseRuntime, k: HoldKey, on: boolean) {
  rt.buttons[k] = on;
}

/**
 * Controles de toque por modo, no padrão dos jogos de celular: o polegar
 * esquerdo move (a pé) ou vira (no carro, como um volante); o direito corre,
 * acelera e freia (pedais) ou sobe e desce (carro voador).
 */
export function TouchControls({ runtime, mode, labels }: { runtime: UniverseRuntime; mode: 'foot' | 'car' | 'hover'; labels: Record<'joystick' | 'steering' | 'run' | 'gas' | 'brake' | 'handbrake' | 'up' | 'down' | 'boost', string> }) {
  return (
    <>
      <div className="absolute bottom-4 left-4">
        <Joystick runtime={runtime} label={mode === 'car' ? labels.steering : labels.joystick} />
      </div>
      <div className="absolute bottom-4 right-4 flex items-end gap-2">
        {mode === 'foot' && (
          <HoldButton runtime={runtime} k="run" label={labels.run} big>
            <Footprints className="size-6" />
          </HoldButton>
        )}
        {mode === 'car' && (
          <>
            <div className="flex flex-col gap-2">
              <HoldButton runtime={runtime} k="handbrake" label={labels.handbrake}>
                <CircleStop className="size-5" />
              </HoldButton>
              <HoldButton runtime={runtime} k="brake" label={labels.brake} big>
                <ArrowDown className="size-6" />
              </HoldButton>
            </div>
            <HoldButton runtime={runtime} k="gas" label={labels.gas} big>
              <Gauge className="size-7" />
            </HoldButton>
          </>
        )}
        {mode === 'hover' && (
          <div className="flex flex-col gap-2">
            <HoldButton runtime={runtime} k="up" label={labels.up}>
              <ArrowUp className="size-5" />
            </HoldButton>
            <HoldButton runtime={runtime} k="down" label={labels.down}>
              <ArrowDown className="size-5" />
            </HoldButton>
            <HoldButton runtime={runtime} k="run" label={labels.boost}>
              <Zap className="size-5" />
            </HoldButton>
          </div>
        )}
      </div>
    </>
  );
}
