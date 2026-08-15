/**
 * Audio 100 % synthetise (Web Audio API) : aucune ressource externe.
 * - Musique : sequenceur procedural, un theme par monde + titre + boss.
 * - SFX : petites enveloppes oscillateur/bruit, un timbre par evenement.
 * Le contexte est cree au premier geste utilisateur (politique autoplay).
 */

import { Rng } from '../core/rng';
import { clamp } from '../core/math';

export type MusicId = 'title' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'boss' | 'menu';

interface TrackDef {
  bpm: number;
  root: number; // midi
  scale: number[];
  prog: number[]; // degres de la progression (indices dans la gamme)
  drums: 'soft' | 'market' | 'industrial' | 'rain' | 'battle' | 'none';
  lead: 'flute' | 'pluck' | 'bells' | 'saw' | 'organ';
  padLevel: number;
  swing: number;
  bassOct: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PENTA_MIN = [0, 3, 5, 7, 10];

const TRACKS: Record<MusicId, TrackDef> = {
  title: { bpm: 92, root: 57, scale: MAJOR, prog: [0, 5, 3, 4], drums: 'soft', lead: 'bells', padLevel: 0.5, swing: 0.12, bassOct: -1 },
  menu: { bpm: 84, root: 55, scale: MAJOR, prog: [0, 3, 4, 3], drums: 'none', lead: 'bells', padLevel: 0.55, swing: 0.1, bassOct: -1 },
  w1: { bpm: 104, root: 60, scale: MAJOR, prog: [0, 4, 5, 3], drums: 'soft', lead: 'flute', padLevel: 0.42, swing: 0.16, bassOct: -1 },
  w2: { bpm: 116, root: 62, scale: DORIAN, prog: [0, 3, 5, 4], drums: 'market', lead: 'pluck', padLevel: 0.38, swing: 0.2, bassOct: -1 },
  w3: { bpm: 98, root: 55, scale: MINOR, prog: [0, 5, 2, 4], drums: 'industrial', lead: 'organ', padLevel: 0.5, swing: 0.05, bassOct: -2 },
  w4: { bpm: 110, root: 58, scale: MINOR, prog: [0, 6, 4, 5], drums: 'rain', lead: 'saw', padLevel: 0.48, swing: 0.08, bassOct: -1 },
  w5: { bpm: 126, root: 53, scale: MINOR, prog: [0, 1, 5, 4], drums: 'industrial', lead: 'saw', padLevel: 0.46, swing: 0, bassOct: -2 },
  boss: { bpm: 142, root: 51, scale: MINOR, prog: [0, 0, 5, 6], drums: 'battle', lead: 'saw', padLevel: 0.4, swing: 0, bassOct: -2 },
};

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Degre de gamme -> note midi (gere les octaves au-dela de la gamme). */
function degreeToMidi(root: number, scale: number[], degree: number): number {
  const oct = Math.floor(degree / scale.length);
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  return root + scale[idx] + oct * 12;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  private convolver: ConvolverNode | null = null;
  private reverbSend!: GainNode;
  private noiseBuf: AudioBuffer | null = null;

  musicVol = 0.55;
  sfxVol = 0.8;
  private duck = 1;
  private duckTarget = 1;

  private current: MusicId | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private schedTimer = 0;
  private rng = new Rng(1234);
  private started = false;
  private muted = false;
  private lastSfxAt: Record<string, number> = {};

  /** Initialise le contexte : doit etre appele depuis un geste utilisateur. */
  init(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    } catch {
      return false;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVol;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(this.master);

    // Petite reverbe par reponse impulsionnelle synthetique.
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.makeImpulse(1.6, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.28;
    this.reverbSend.connect(this.convolver);
    this.convolver.connect(this.master);

    this.noiseBuf = this.makeNoise(2);
    this.started = true;
    return true;
  }

  private makeImpulse(duration: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = clamp(music, 0, 1);
    this.sfxVol = clamp(sfx, 0, 1);
    if (this.ctx) {
      this.musicBus.gain.value = this.musicVol * this.duck * (this.muted ? 0 : 1);
      this.sfxBus.gain.value = this.sfxVol * (this.muted ? 0 : 1);
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.setVolumes(this.musicVol, this.sfxVol);
  }

  /** Attenue la musique pendant un jingle / une cinematique. */
  duckMusic(amount = 0.25, _seconds = 1.2) {
    this.duckTarget = amount;
    window.setTimeout(() => { this.duckTarget = 1; }, _seconds * 1000);
  }

  playMusic(id: MusicId, restart = false) {
    if (!this.ctx) return;
    if (this.current === id && !restart) return;
    this.current = id;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.rng = new Rng(Rng.hashString(id));
  }

  stopMusic() {
    this.current = null;
  }

  /** Boucle de scheduling (appelee chaque frame). */
  update(dt: number) {
    if (!this.ctx) return;
    this.duck += (this.duckTarget - this.duck) * Math.min(1, dt * 4);
    this.musicBus.gain.value = this.musicVol * this.duck * (this.muted ? 0 : 1);
    if (!this.current) return;

    const def = TRACKS[this.current];
    const spb = 60 / def.bpm;
    const stepDur = spb / 2; // croches
    const now = this.ctx.currentTime;
    this.schedTimer = 0;
    let guard = 0;
    while (this.nextNoteTime < now + 0.25 && guard++ < 32) {
      this.scheduleStep(def, this.step, this.nextNoteTime);
      const swing = this.step % 2 === 1 ? def.swing * stepDur : 0;
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 128;
      void swing;
    }
  }

  // --- Musique -------------------------------------------------------------

  private scheduleStep(def: TrackDef, step: number, t: number) {
    const bar = Math.floor(step / 8) % def.prog.length;
    const chordDeg = def.prog[bar];
    const inBar = step % 8;
    const spb = 60 / def.bpm;

    // Basse : fondamentale + quinte
    if (inBar === 0 || inBar === 3 || inBar === 6) {
      const n = degreeToMidi(def.root, def.scale, chordDeg) + 12 * def.bassOct;
      this.voice(n + (inBar === 6 ? 7 : 0), t, spb * 0.55, 'triangle', 0.22, 0.008, 0.3, 320);
    }

    // Nappe : accord tenu en debut de mesure
    if (inBar === 0 && def.padLevel > 0) {
      const notes = [chordDeg, chordDeg + 2, chordDeg + 4];
      for (const d of notes) {
        const n = degreeToMidi(def.root, def.scale, d);
        this.voice(n, t, spb * 3.6, 'sawtooth', 0.035 * def.padLevel, 0.5, 1.4, 900, 0.3);
      }
    }

    // Melodie / arpege
    const density = def.lead === 'saw' ? 0.75 : 0.55;
    if (this.rng.next() < density) {
      const pool = [chordDeg, chordDeg + 2, chordDeg + 4, chordDeg + 7, chordDeg + 5];
      const d = this.rng.pick(pool) + (this.rng.bool(0.25) ? 7 : 0);
      const n = degreeToMidi(def.root, def.scale, d) + 12;
      const wave: OscillatorType =
        def.lead === 'flute' ? 'sine'
          : def.lead === 'bells' ? 'sine'
            : def.lead === 'organ' ? 'square'
              : def.lead === 'pluck' ? 'triangle' : 'sawtooth';
      const dur = def.lead === 'bells' ? spb * 1.2 : spb * 0.42;
      const amp = def.lead === 'saw' ? 0.08 : 0.1;
      this.voice(n, t, dur, wave, amp, 0.006, def.lead === 'bells' ? 1.1 : 0.18, 3200, 0.25);
      if (def.lead === 'bells') this.voice(n + 12, t, dur * 0.7, 'sine', amp * 0.3, 0.005, 0.9, 5000, 0.3);
    }

    // Percussions
    this.drums(def, step, t);
  }

  private drums(def: TrackDef, step: number, t: number) {
    if (def.drums === 'none') return;
    const s = step % 8;
    const heavy = def.drums === 'industrial' || def.drums === 'battle';
    if (s === 0 || (heavy && s === 4) || (def.drums === 'market' && s === 5)) this.kick(t, heavy ? 0.5 : 0.36);
    if (s === 4 || (def.drums === 'battle' && s === 6)) this.snare(t, def.drums === 'soft' ? 0.12 : 0.22);
    if (def.drums !== 'soft' || s % 2 === 0) this.hat(t, def.drums === 'rain' ? 0.05 : 0.075);
    if (def.drums === 'industrial' && s === 2) this.metal(t, 0.09);
  }

  private voice(
    midi: number, t: number, dur: number, wave: OscillatorType,
    amp: number, attack: number, release: number, cutoff = 4000, reverb = 0.12,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = midiToFreq(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.Q.value = 0.7;
    osc.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    if (reverb > 0 && this.reverbSend) {
      const rs = ctx.createGain();
      rs.gain.value = reverb;
      g.connect(rs);
      rs.connect(this.reverbSend);
    }
    osc.start(t);
    osc.stop(t + dur + release + 0.05);
  }

  private kick(t: number, amp: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private noiseSource(t: number, dur: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.start(t);
    src.stop(t + dur);
    return src;
  }

  private snare(t: number, amp: number) {
    const ctx = this.ctx!;
    const src = this.noiseSource(t, 0.2);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
  }

  private hat(t: number, amp: number) {
    const ctx = this.ctx!;
    const src = this.noiseSource(t, 0.06);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
  }

  private metal(t: number, amp: number) {
    const ctx = this.ctx!;
    for (const ratio of [1, 1.41, 1.97]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 420 * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(amp * 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 900;
      osc.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  }

  // --- SFX -----------------------------------------------------------------

  /** Anti-spam : un meme SFX n'est pas rejoue plus souvent que `minGap` ms. */
  private throttle(id: string, minGap: number): boolean {
    const now = performance.now();
    if ((this.lastSfxAt[id] ?? -1e9) + minGap > now) return false;
    this.lastSfxAt[id] = now;
    return true;
  }

  private blip(freq: number, dur: number, wave: OscillatorType, amp: number, slideTo?: number, filter = 8000) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    osc.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, amp: number, type: BiquadFilterType, freq: number, sweepTo?: number, q = 1) {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  sfx(name: string, variant = 0) {
    if (!this.ctx) return;
    switch (name) {
      case 'net':
        if (!this.throttle('net', 60)) return;
        this.noiseBurst(0.22, 0.24, 'bandpass', 2600, 700, 1.4);
        this.blip(720, 0.14, 'triangle', 0.07, 320);
        break;
      case 'capture':
        this.blip(520 + variant * 40, 0.1, 'sine', 0.24, 1180);
        this.blip(880 + variant * 60, 0.16, 'triangle', 0.13, 1500);
        this.noiseBurst(0.13, 0.1, 'highpass', 2400);
        break;
      case 'sword':
        if (!this.throttle('sword', 70)) return;
        this.noiseBurst(0.16, 0.22, 'bandpass', 4200, 1200, 2.2);
        this.blip(300, 0.09, 'sawtooth', 0.06, 120);
        break;
      case 'hitmob':
        this.noiseBurst(0.14, 0.24, 'lowpass', 1400, 300);
        this.blip(180, 0.12, 'square', 0.1, 70);
        break;
      case 'stun':
        this.blip(1300, 0.09, 'sine', 0.12, 700);
        this.blip(1000, 0.14, 'sine', 0.09, 1500);
        break;
      case 'squeak':
        if (!this.throttle('squeak', 90)) return;
        this.blip(1500 + variant * 130, 0.09, 'square', 0.07, 2300, 6000);
        break;
      case 'alert':
        this.blip(880, 0.07, 'square', 0.1, 1500);
        this.blip(1320, 0.09, 'square', 0.08, 1900);
        break;
      case 'step':
        if (!this.throttle('step', 110)) return;
        this.noiseBurst(0.06, 0.05 + variant * 0.01, 'bandpass', 900 + variant * 300, 400, 1.2);
        break;
      case 'hurt':
        this.blip(420, 0.22, 'sawtooth', 0.22, 120, 2200);
        this.noiseBurst(0.2, 0.16, 'lowpass', 1200, 200);
        break;
      case 'dash':
        this.noiseBurst(0.24, 0.16, 'bandpass', 900, 3600, 1.5);
        break;
      case 'grapple':
        this.blip(240, 0.26, 'sawtooth', 0.11, 900, 2600);
        break;
      case 'glue':
        this.noiseBurst(0.3, 0.16, 'lowpass', 700, 220);
        this.blip(180, 0.24, 'sine', 0.09, 90);
        break;
      case 'radar':
        this.blip(1450, 0.4, 'sine', 0.09, 900);
        break;
      case 'lure':
        this.blip(660, 0.1, 'triangle', 0.1, 880);
        this.blip(880, 0.16, 'triangle', 0.08, 1180);
        break;
      case 'skates':
        this.noiseBurst(0.4, 0.1, 'bandpass', 2200, 5200, 3);
        break;
      case 'boomerang':
        this.blip(900, 0.5, 'sine', 0.09, 500, 3000);
        break;
      case 'glide':
        this.noiseBurst(0.6, 0.1, 'bandpass', 500, 1800, 0.8);
        break;
      case 'unlock':
        this.blip(523, 0.12, 'triangle', 0.16, 523);
        window.setTimeout(() => this.blip(659, 0.12, 'triangle', 0.16), 90);
        window.setTimeout(() => this.blip(784, 0.24, 'triangle', 0.18), 180);
        window.setTimeout(() => this.blip(1046, 0.4, 'sine', 0.16), 290);
        break;
      case 'ui':
        if (!this.throttle('ui', 40)) return;
        this.blip(620, 0.05, 'square', 0.06, 760, 4000);
        break;
      case 'uiconfirm':
        this.blip(700, 0.07, 'square', 0.09, 1050, 5000);
        break;
      case 'uiback':
        this.blip(420, 0.09, 'square', 0.07, 260, 3000);
        break;
      case 'error':
        this.blip(220, 0.16, 'square', 0.1, 160, 1800);
        break;
      case 'win': {
        const notes = [523, 659, 784, 1046, 1318];
        this.duckMusic(0.25, 2);
        notes.forEach((f, i) => window.setTimeout(() => this.blip(f, i === 4 ? 0.6 : 0.16, 'triangle', 0.2), i * 110));
        break;
      }
      case 'lose': {
        const notes = [523, 440, 349, 262];
        this.duckMusic(0.25, 2);
        notes.forEach((f, i) => window.setTimeout(() => this.blip(f, i === 3 ? 0.7 : 0.2, 'triangle', 0.18), i * 150));
        break;
      }
      case 'thunder':
        this.noiseBurst(1.3, 0.2, 'lowpass', 700, 120, 0.6);
        break;
      case 'bosshit':
        this.blip(120, 0.3, 'sawtooth', 0.24, 55, 1200);
        this.noiseBurst(0.35, 0.2, 'lowpass', 900, 180);
        break;
      case 'roar':
        this.blip(90, 0.8, 'sawtooth', 0.26, 160, 900);
        this.noiseBurst(0.9, 0.16, 'lowpass', 500, 900);
        break;
      default:
        break;
    }
  }

  get ready(): boolean {
    return this.started && !!this.ctx;
  }
}

export const audio = new AudioEngine();
