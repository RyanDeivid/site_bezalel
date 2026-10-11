/**
 * Som da catraca, sintetizado na hora (Web Audio, sem arquivo). Desligado por
 * padrão: só toca depois que o visitante liga o som (gesto do usuário).
 */
export interface Clicker {
  tick(): void;
  /** Encaixe de capítulo: um "clunk" mais grave. */
  detent(): void;
  close(): void;
}

export function createClicker(): Clicker | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  let lastTick = 0;

  function blip(freq: number, gain: number, length: number, type: OscillatorType) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq * 1.6;
    filter.Q.value = 4;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(filter).connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  return {
    tick() {
      const now = performance.now();
      if (now - lastTick < 28) return; // giro rápido: sem metralhadora
      lastTick = now;
      if (ctx.state === 'suspended') void ctx.resume();
      blip(1900, 0.05, 0.03, 'square');
    },
    detent() {
      if (ctx.state === 'suspended') void ctx.resume();
      blip(180, 0.16, 0.16, 'triangle');
      blip(720, 0.05, 0.08, 'square');
    },
    close() {
      void ctx.close();
    },
  };
}
