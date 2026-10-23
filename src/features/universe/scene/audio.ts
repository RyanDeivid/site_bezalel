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
 *    sinal suave ao abrir um local;
 *  - a pé, uma ambientação que muda devagar em vez de um chiado parado: um
 *    acorde suave (dois bancos que se alternam com fusão lenta, cada nota com
 *    o seu "respirar"), sinos distantes e esparsos numa reverberação, e o
 *    rumor da cidade bem mais baixo, oscilando em ritmos que não se repetem.
 *    No veículo, a ambientação recua (a cabine isola) e o motor domina.
 * O processamento roda na linha de áudio do navegador; a cena só ajusta alguns
 * parâmetros por quadro (com rampas, sem estalos). Começa num gesto do
 * visitante (o clique de "Explorar em 3D"), como os navegadores exigem.
 */

type Voice = { gain: GainNode };

/**
 * Acordes da ambientação (Hz, cinco notas cada), em ré maior, abertos: Ré com nona, Si menor com nona,
 * Sol com sétima maior e décima primeira aumentada, Lá com nona. Calmos e levemente luminosos (a noite de
 * uma cidade futurista), sem melodia que canse.
 */
const CHORDS: ReadonlyArray<readonly number[]> = [
  [146.83, 220, 277.18, 329.63, 369.99],
  [123.47, 185, 220, 277.18, 293.66],
  [98, 146.83, 185, 246.94, 277.18],
  [110, 164.81, 246.94, 277.18, 329.63],
];
/** Notas dos sinos por acorde (pentatônica, uma oitava acima). */
const BELLS: ReadonlyArray<readonly number[]> = [
  [587.33, 659.25, 739.99, 880, 987.77],
  [493.88, 587.33, 659.25, 739.99, 880],
  [587.33, 739.99, 880, 987.77, 1108.73],
  [554.37, 659.25, 739.99, 880, 987.77],
];

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
  private pad: { banks: Array<{ gain: GainNode; voices: Array<{ a: OscillatorNode; b: OscillatorNode }> }>; bus: GainNode; current: number; nextChange: number; chord: number };
  private bells: { bus: GainNode; next: number };
  private on = true;
  private level = 0.5;
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
    // Oscilador lento (LFO) somado a um parâmetro: o "respirar" das vozes.
    const lfo = (target: AudioParam, rate: number, depth: number) => {
      const o = c.createOscillator();
      o.frequency.value = rate;
      const g = c.createGain();
      g.gain.value = depth;
      o.connect(g).connect(target);
      o.start(c.currentTime + Math.random() * 3);
    };
    // Reverberação: resposta ao impulso sintética (ruído estéreo que decai em ~2 s), sem arquivo.
    const reverb = c.createConvolver();
    const irLen = Math.floor(c.sampleRate * 2.2);
    const ir = c.createBuffer(2, irLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    reverb.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(this.master);
    // Fundo da cidade: rumor grave e um chiado distante, baixos, oscilando em ritmos que não coincidem
    // (antes era um ruído quase parado e alto, que cansava).
    const rumble = c.createBiquadFilter();
    rumble.type = 'lowpass';
    rumble.frequency.value = 160;
    lfo(rumble.frequency, 0.031, 45);
    loop().connect(rumble);
    const cityGain = voice(rumble);
    const hissF = c.createBiquadFilter();
    hissF.type = 'bandpass';
    hissF.frequency.value = 700;
    hissF.Q.value = 0.5;
    lfo(hissF.frequency, 0.019, 220);
    const hiss = c.createGain();
    hiss.gain.value = 0.16;
    lfo(hiss.gain, 0.047, 0.1);
    lfo(hiss.gain, 0.0113, 0.06);
    loop().connect(hissF).connect(hiss).connect(cityGain);
    this.city = { gain: cityGain, hiss };
    // Ambientação: dois bancos de cinco notas que se alternam (um some enquanto o outro surge com o
    // acorde seguinte), cada nota com dois osciladores levemente desafinados e um respirar próprio,
    // tudo por um passa-baixa que abre e fecha devagar, e parte para a reverberação.
    const padFilter = c.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.4;
    lfo(padFilter.frequency, 0.023, 350);
    const padBus = c.createGain();
    padBus.gain.value = 0;
    padFilter.connect(padBus);
    padBus.connect(this.master);
    const padSend = c.createGain();
    padSend.gain.value = 0.7;
    padBus.connect(padSend).connect(reverb);
    const banks = [0, 1].map(() => {
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.connect(padFilter);
      const voices = CHORDS[0]!.map((f) => {
        const a = c.createOscillator();
        const b = c.createOscillator();
        a.type = 'sine';
        b.type = 'triangle';
        a.frequency.value = f;
        b.frequency.value = f;
        a.detune.value = -4;
        b.detune.value = 5;
        const vg = c.createGain();
        vg.gain.value = 0.11;
        lfo(vg.gain, 0.05 + Math.random() * 0.09, 0.06);
        const mix = c.createGain();
        mix.gain.value = 0.5;
        a.connect(mix);
        b.connect(mix);
        mix.connect(vg).connect(gain);
        a.start();
        b.start();
        return { a, b };
      });
      return { gain, voices };
    });
    this.pad = { banks, bus: padBus, current: 0, nextChange: 0, chord: 0 };
    // Sinos distantes: notas da escala pentatônica do acorde, raras, quase só reverberação.
    const bellBus = c.createGain();
    bellBus.gain.value = 0;
    const bellDry = c.createGain();
    bellDry.gain.value = 0.35;
    bellBus.connect(bellDry).connect(this.master);
    bellBus.connect(reverb);
    this.bells = { bus: bellBus, next: c.currentTime + 4 };
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

  /** Suspende tudo (a aba saiu da tela: outro app, tela bloqueada) ou retoma, se o som estiver ligado. */
  setHidden(hidden: boolean) {
    if (hidden) {
      if (this.ctx.state === 'running') void this.ctx.suspend();
    } else this.resume();
  }

  /** Chamado a cada quadro pela cena: ajusta as vozes ao que está acontecendo. */
  update(f: SoundFrame) {
    const t = this.ctx.currentTime;
    const ramp = (p: AudioParam, v: number, k = 0.12) => p.setTargetAtTime(v, t, k);
    const flying = f.mode === 'hover';
    const high = Math.min(1, Math.max(0, (f.altitude - 6) / 50));
    const foot = f.mode === 'foot';
    // Fundo: a cidade some aos poucos com a altura; o vento cresce com a altura e a velocidade.
    ramp(this.city.gain.gain, (foot ? 0.13 : 0.09) * (1 - high * 0.75), 0.8);
    // Ambientação: inteira a pé, recuada dentro do veículo (a cabine isola, o motor domina).
    ramp(this.pad.bus.gain, foot ? 1 : 0.35, 1.5);
    ramp(this.bells.bus.gain, foot ? 1 : 0.25, 1.5);
    this.evolve(t);
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
      ramp(this.pass.gain.gain, (flying ? 0.12 : 0.4) * k, 0.15);
      ramp(this.pass.pan.pan, Math.max(-1, Math.min(1, f.traffic.pan)), 0.1);
      ramp(this.pass.filter.frequency, 450 + k * 600, 0.15);
    } else ramp(this.pass.gain.gain, 0, 0.3);
  }

  /** Troca o acorde de tempos em tempos (fusão lenta entre os bancos) e toca um sino de vez em quando. */
  private evolve(t: number) {
    const pad = this.pad;
    if (t >= pad.nextChange) {
      const first = pad.nextChange === 0;
      pad.chord = first ? 0 : (pad.chord + 1) % CHORDS.length;
      const into = first ? 0 : 1 - pad.current;
      const notes = CHORDS[pad.chord]!;
      const bank = pad.banks[into]!;
      // O banco que entra recebe as notas novas enquanto está mudo, e sobe; o outro desce.
      bank.voices.forEach((v, i) => {
        v.a.frequency.setValueAtTime(notes[i]!, t);
        v.b.frequency.setValueAtTime(notes[i]!, t);
      });
      bank.gain.gain.setTargetAtTime(0.5, t, first ? 2 : 3);
      if (!first) pad.banks[pad.current]!.gain.gain.setTargetAtTime(0, t, 3);
      pad.current = into;
      pad.nextChange = t + 15 + Math.random() * 6;
    }
    const bells = this.bells;
    if (t >= bells.next) {
      const scale = BELLS[pad.chord]!;
      const pick = () => scale[Math.floor(Math.random() * scale.length)]!;
      this.bell(pick(), 0.022 + Math.random() * 0.016, bells.bus);
      // Às vezes, uma segunda nota logo depois (um pequeno motivo).
      if (Math.random() < 0.35) this.bell(pick(), 0.016, bells.bus, 0.35 + Math.random() * 0.4);
      bells.next = t + 5 + Math.random() * 9;
    }
  }

  /** Um sino: fundamental e um parcial inarmônico (o timbre de sino), ataque curto, cauda longa. */
  private bell(freq: number, level: number, out: AudioNode, delay = 0) {
    if (!this.on) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    for (const [mult, amp, len] of [
      [1, 1, 2.8],
      [2.76, 0.28, 1.2],
    ] as const) {
      const o = c.createOscillator();
      o.frequency.value = freq * mult;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level * amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + len + 0.05);
    }
  }

  /** Um passo: baque curto e grave, com variação. */
  step(running: boolean) {
    this.burst(running ? 0.1 : 0.06, 220 + Math.random() * 100, 0.07);
  }

  /** Porta do veículo (entrar ou sair). */
  door() {
    this.burst(0.35, 180, 0.12);
    this.tone(1400, 0.05, 0.03, 0.04);
  }

  /** Porta do elevador abrindo ou fechando: um sopro curto e macio. */
  elevatorDoor() {
    this.burst(0.08, 520, 0.35);
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
