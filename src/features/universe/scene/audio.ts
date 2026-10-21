/**
 * Som do Universe, todo gerado na hora com a Web Audio API (nenhum arquivo
 * baixado). A cidade deixa de ser uma maquete muda:
 *  - fundo da cidade: um rumor grave e o chiado do trânsito distante, que
 *    "respira" devagar; no alto, dá lugar ao vento, que cresce com a altura e
 *    a velocidade;
 *  - motores por modelo: sedã e táxi são elétricos (um zumbido que sobe com a
 *    velocidade, em duas harmônicas), o esportivo tem um ronco grave sintético
 *    por baixo do zumbido; o carro voador, uma turbina (sopro filtrado que
 *    abre com o empuxo, mais um assobio);
 *  - o trânsito: o carro mais próximo passa com volume e lado (estéreo)
 *    conforme a distância e a direção em relação à câmera;
 *  - passos a pé (um baque curto a cada passada), porta ao entrar e sair e um
 *    sinal suave ao abrir um local.
 * O processamento roda na linha de áudio do navegador; a cena só ajusta alguns
 * parâmetros por quadro (com rampas, sem estalos). Começa num gesto do
 * visitante (o clique de "Explorar em 3D"), como os navegadores exigem.
 */

type Voice = { gain: GainNode };

export interface SoundFrame {
  mode: 'foot' | 'car' | 'hover';
  carClass?: 'sedan' | 'sport' | 'taxi';
  /** Velocidade do jogador ou do veículo (m/s, sempre positiva). */
  speed: number;
  /** 0…1: acelerador (carro) ou empuxo (voador). */
  throttle: number;
  /** Altura acima do chão (m). */
  altitude: number;
  /** Carro do trânsito mais próximo: distância (m) e lado (−1 esquerda … 1 direita). */
  traffic: { distance: number; pan: number } | null;
}

export class UniverseAudio {
  readonly ctx: AudioContext;
  private master: GainNode;
  private noise: AudioBuffer;
  private city: Voice & { hiss: GainNode };
  private wind: Voice & { filter: BiquadFilterNode };
  private electric: Voice & { a: OscillatorNode; b: OscillatorNode };
  private growl: Voice & { osc: OscillatorNode; filter: BiquadFilterNode };
  private turbine: Voice & { filter: BiquadFilterNode; whistle: OscillatorNode; whistleGain: GainNode };
  private pass: Voice & { pan: StereoPannerNode; filter: BiquadFilterNode };
  private on = true;
  private level = 0.7;
  private meter: AnalyserNode;
  private meterData = new Float32Array(512);

  constructor() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp).connect(c.destination);
    // Medidor na saída (só leitura): permite conferir nos testes que há som de verdade.
    this.meter = c.createAnalyser();
    this.meter.fftSize = 512;
    comp.connect(this.meter);
    // Ruído rosado (aproximação de Paul Kellet), 2 s em laço: base do rumor, do vento, da turbina e dos passos.
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    const loop = () => {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      s.loopStart = Math.random();
      s.start(0, Math.random() * 1.5);
      return s;
    };
    const voice = (input: AudioNode) => {
      const gain = c.createGain();
      gain.gain.value = 0;
      input.connect(gain).connect(this.master);
      return gain;
    };
    // Fundo da cidade: rumor grave + chiado distante (com um LFO lento no chiado).
    const rumble = c.createBiquadFilter();
    rumble.type = 'lowpass';
    rumble.frequency.value = 220;
    loop().connect(rumble);
    const cityGain = voice(rumble);
    const hissF = c.createBiquadFilter();
    hissF.type = 'bandpass';
    hissF.frequency.value = 900;
    hissF.Q.value = 0.6;
    const hiss = c.createGain();
    hiss.gain.value = 0.35;
    loop().connect(hissF).connect(hiss).connect(cityGain);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = c.createGain();
    lfoAmt.gain.value = 0.15;
    lfo.connect(lfoAmt).connect(hiss.gain);
    lfo.start();
    this.city = { gain: cityGain, hiss };
    // Vento: ruído em banda que se desloca.
    const windF = c.createBiquadFilter();
    windF.type = 'bandpass';
    windF.frequency.value = 500;
    windF.Q.value = 0.9;
    loop().connect(windF);
    this.wind = { gain: voice(windF), filter: windF };
    // Motor elétrico: duas harmônicas, levemente desafinadas.
    const ea = c.createOscillator();
    const eb = c.createOscillator();
    ea.type = 'sine';
    eb.type = 'triangle';
    const eMix = c.createGain();
    eMix.gain.value = 0.5;
    ea.connect(eMix);
    eb.connect(eMix);
    ea.start();
    eb.start();
    this.electric = { gain: voice(eMix), a: ea, b: eb };
    // Ronco do esportivo: dente de serra grave num passa-baixa.
    const go = c.createOscillator();
    go.type = 'sawtooth';
    const gf = c.createBiquadFilter();
    gf.type = 'lowpass';
    gf.frequency.value = 300;
    gf.Q.value = 4;
    go.connect(gf);
    go.start();
    this.growl = { gain: voice(gf), osc: go, filter: gf };
    // Turbina do voador: sopro filtrado + assobio.
    const tf = c.createBiquadFilter();
    tf.type = 'bandpass';
    tf.Q.value = 1.2;
    tf.frequency.value = 700;
    loop().connect(tf);
    const tg = voice(tf);
    const whistle = c.createOscillator();
    whistle.type = 'sine';
    const whistleGain = c.createGain();
    whistleGain.gain.value = 0;
    whistle.connect(whistleGain).connect(tg);
    whistle.start();
    this.turbine = { gain: tg, filter: tf, whistle, whistleGain };
    // Carro do trânsito que passa: sopro + zumbido, com lado.
    const pf = c.createBiquadFilter();
    pf.type = 'bandpass';
    pf.frequency.value = 600;
    pf.Q.value = 0.8;
    const pan = c.createStereoPanner();
    loop().connect(pf).connect(pan);
    this.pass = { gain: voice(pan), pan, filter: pf };
    this.setLevel();
  }

  get enabled() {
    return this.on;
  }

  /** Nível RMS da saída agora (0 = silêncio). */
  rms() {
    this.meter.getFloatTimeDomainData(this.meterData);
    let sum = 0;
    for (const v of this.meterData) sum += v * v;
    return Math.sqrt(sum / this.meterData.length);
  }

  /** Liga ou desliga o som (com rampa). */
  setEnabled(on: boolean) {
    this.on = on;
    if (on && this.ctx.state === 'suspended') void this.ctx.resume();
    this.setLevel();
  }

  /** Retoma o contexto (alguns navegadores só deixam depois de um gesto). */
  resume() {
    if (this.on && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private setLevel() {
    this.master.gain.setTargetAtTime(this.on ? this.level : 0, this.ctx.currentTime, 0.4);
  }

  /** Chamado a cada quadro pela cena: ajusta as vozes ao que está acontecendo. */
  update(f: SoundFrame) {
    const t = this.ctx.currentTime;
    const ramp = (p: AudioParam, v: number, k = 0.12) => p.setTargetAtTime(v, t, k);
    const flying = f.mode === 'hover';
    const high = Math.min(1, Math.max(0, (f.altitude - 6) / 50));
    // Fundo: a cidade some aos poucos com a altura; o vento cresce com a altura e a velocidade.
    ramp(this.city.gain.gain, 0.32 * (1 - high * 0.75), 0.8);
    const windLevel = flying ? 0.08 + high * 0.35 + Math.min(1, f.speed / 40) * 0.35 : 0.04;
    ramp(this.wind.gain.gain, windLevel, 0.6);
    ramp(this.wind.filter.frequency, 350 + high * 500 + f.speed * 18, 0.6);
    // Motores.
    const car = f.mode === 'car';
    const s = f.speed;
    const whine = 70 + s * 9;
    ramp(this.electric.a.frequency, whine, 0.08);
    ramp(this.electric.b.frequency, whine * 2.01, 0.08);
    ramp(this.electric.gain.gain, car ? (f.carClass === 'sport' ? 0.05 : 0.09) * (0.35 + f.throttle * 0.65 + Math.min(1, s / 30) * 0.4) : 0, 0.15);
    // Esportivo: "marchas" (o tom sobe e cai a cada faixa de velocidade).
    const gear = (s % 11) / 11;
    ramp(this.growl.osc.frequency, 38 + gear * 55 + Math.floor(s / 11) * 4, 0.06);
    ramp(this.growl.filter.frequency, 180 + f.throttle * 700 + gear * 300, 0.08);
    ramp(this.growl.gain.gain, car && f.carClass === 'sport' ? 0.14 * (0.4 + f.throttle * 0.6) : 0, 0.15);
    // Turbina.
    ramp(this.turbine.gain.gain, flying ? 0.22 + f.throttle * 0.25 : 0, 0.3);
    ramp(this.turbine.filter.frequency, 500 + f.throttle * 900 + s * 15, 0.25);
    ramp(this.turbine.whistle.frequency, 900 + f.throttle * 700 + s * 12, 0.2);
    ramp(this.turbine.whistleGain.gain, flying ? 0.05 + f.throttle * 0.06 : 0, 0.3);
    // Trânsito que passa perto.
    if (f.traffic) {
      const k = 1 / (1 + (f.traffic.distance * f.traffic.distance) / 60);
      ramp(this.pass.gain.gain, (flying ? 0.15 : 0.6) * k, 0.15);
      ramp(this.pass.pan.pan, Math.max(-1, Math.min(1, f.traffic.pan)), 0.1);
      ramp(this.pass.filter.frequency, 450 + k * 600, 0.15);
    } else ramp(this.pass.gain.gain, 0, 0.3);
  }

  /** Um passo: baque curto e grave, com variação. */
  step(running: boolean) {
    this.burst(running ? 0.16 : 0.1, 260 + Math.random() * 120, 0.07);
  }

  /** Porta do veículo (entrar ou sair). */
  door() {
    this.burst(0.35, 180, 0.12);
    this.tone(1400, 0.05, 0.03, 0.04);
  }

  /** Sinal ao abrir um local: duas notas suaves. */
  chime() {
    this.tone(784, 0.07, 0.35, 0);
    this.tone(1175, 0.06, 0.45, 0.12);
  }

  private burst(level: number, freq: number, length: number) {
    if (!this.on) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, length + 0.02);
  }

  private tone(freq: number, level: number, length: number, delay: number) {
    if (!this.on) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + length + 0.05);
  }

  dispose() {
    void this.ctx.close();
  }
}

/** Cria o som se o navegador tiver Web Audio (no gesto do visitante); senão, segue sem som. */
export function createUniverseAudio(): UniverseAudio | null {
  try {
    return typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) ? new UniverseAudio() : null;
  } catch {
    return null;
  }
}
