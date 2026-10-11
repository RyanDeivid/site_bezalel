/**
 * Engrenagens desenhadas em SVG (caminho determinístico — igual no servidor e
 * no navegador). Dentes trapezoidais, cubo e janelas entre os raios.
 */
export function gearPath(teeth: number, pitch: number, opts: { hub?: number; windows?: number } = {}): string {
  const module = (2 * Math.PI * pitch) / teeth;
  const outer = pitch + module * 0.32;
  const root = pitch - module * 0.38;
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  const p = (r: number, a: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    pts.push(p(root, a - step * 0.5), p(root, a - step * 0.27), p(outer, a - step * 0.14), p(outer, a + step * 0.14), p(root, a + step * 0.27));
  }
  let d = `M${pts.join(' L')} Z`;
  // Furo central.
  const hub = opts.hub ?? pitch * 0.18;
  d += ` M${hub} 0 A${hub} ${hub} 0 1 0 ${-hub} 0 A${hub} ${hub} 0 1 0 ${hub} 0 Z`;
  // Janelas entre os raios (aliviam o peso, como numa engrenagem real).
  const windows = opts.windows ?? 0;
  if (windows) {
    const r0 = pitch * 0.34;
    const r1 = root - module * 0.45;
    const span = (Math.PI * 2) / windows;
    for (let w = 0; w < windows; w++) {
      const a0 = w * span + span * 0.16;
      const a1 = (w + 1) * span - span * 0.16;
      d += ` M${p(r0, a0)} L${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
    }
  }
  return d;
}

/** Engrenamento: quantas voltas cada peça dá por volta da manivela (sinal = sentido). */
export const GEARS = {
  /** Coroa da manivela. */
  crown: { teeth: 24, pitch: 70 },
  /** Engrenagem intermediária (gira ao contrário, 2× mais rápido). */
  idler: { teeth: 12, pitch: 35 },
  /** Pinhão (mesmo sentido da coroa, 3× mais rápido). */
  pinion: { teeth: 8, pitch: 23.33 },
} as const;
