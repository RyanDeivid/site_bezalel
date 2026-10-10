import { useRef, useState, type PointerEvent } from 'react';
import { useT } from '@/app/preferences-context';
import type { LabRuntime } from '../layout';

const RADIUS = 42;

/** Joystick virtual para telas de toque: escreve o vetor de movimento no runtime. */
export function Joystick({ runtime }: { runtime: LabRuntime }) {
  const m = useT();
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);

  function update(e: PointerEvent<HTMLDivElement>) {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    runtime.joystick.x = dx / RADIUS;
    runtime.joystick.y = -dy / RADIUS;
    runtime.target = null;
  }

  function release() {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    runtime.joystick.x = 0;
    runtime.joystick.y = 0;
  }

  return (
    <div
      ref={base}
      role="application"
      aria-label={m.lab.hud.joystick}
      className="relative size-28 touch-none rounded-full border border-line-strong bg-bg/60 backdrop-blur"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span aria-hidden className="absolute inset-4 rounded-full border border-dashed border-line" />
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 size-12 rounded-full border border-accent/70 bg-accent-soft shadow-[var(--glow-accent)]"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
