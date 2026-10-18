// All music and sound effects are synthesised with the Web Audio API. No sound files.
const BPM = 122;
const STEP = 60 / BPM / 4; // one 16th note

// A minor: Am - F - C - G (one bar each).
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [55, 60, 64],
  [55, 59, 62],
];
const BASS = [33, 29, 36, 31];
const ARP = [0, 1, 2, 1, 2, 0, 1, 2];
const LEAD = [ // a short hook that plays every other phrase in-game
  76, -1, 74, 76, -1, 72, -1, 69, -1, -1, 72, -1, 74, -1, 72, -1,
  72, -1, 69, 72, -1, 77, -1, 76, -1, -1, 72, -1, 69, -1, -1, -1,
  76, -1, 74, 76, -1, 79, -1, 76, -1, -1, 72, -1, 74, -1, 76, -1,
  74, -1, 71, 74, -1, 79, -1, 78, -1, 74, -1, -1, 71, -1, -1, -1,
];

const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicLevel = 0.6;
    this.sfxLevel = 0.8;
    this.mode = 'menu';
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.coinStreak = 0;
    this.lastCoin = 0;
    this.jetSource = null;
    this.intensity = 0;
  }

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 1400;
    this.musicVol = ctx.createGain();
    this.musicBus.connect(this.musicFilter).connect(this.musicVol).connect(this.master);

    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);

    // Echo for the arpeggio.
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.musicBus);

    // One second of white noise, reused for drums and effects.
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.setVolumes(this.musicLevel * 100, this.sfxLevel * 100);
    this.setMode(this.mode);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 25);
  }

  setVolumes(music, sfx) {
    this.musicLevel = music / 100;
    this.sfxLevel = sfx / 100;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicVol.gain.setTargetAtTime(this.musicLevel * 0.55, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.sfxLevel * 0.9, t, 0.05);
  }

  /** 'menu' (soft, muffled), 'game' (full band), 'pause' (very muffled), 'over'. */
  setMode(mode) {
    this.mode = mode;
    if (!this.ctx) return;
    const f = { menu: 1500, game: 16000, pause: 450, over: 700 }[mode] ?? 16000;
    this.musicFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.15);
    if (mode !== 'game') this.jet(false);
  }

  /** 0..1, how far into the speed ramp we are: adds more drive to the music. */
  setIntensity(x) {
    this.intensity = x;
  }

  // ---------- building blocks ----------

  _tone(type, freq, t, dur, vol, dest, { slideTo = 0, attack = 0.005, filter = 0, q = 1 } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      f.Q.value = q;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return osc;
  }

  _noise(t, dur, vol, dest, type = 'highpass', freq = 6000, sweepTo = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ---------- music ----------

  _schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05; // after a stall
    while (this.nextTime < ctx.currentTime + 0.12) {
      this._playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step++;
    }
  }

  _playStep(step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const phrase = Math.floor(step / 64);
    const chord = CHORDS[bar];
    const out = this.musicBus;
    const inGame = this.mode === 'game';

    // Pad: soft detuned chord at the start of each bar.
    if (s === 0) {
      for (const n of chord) {
        for (const d of [-6, 6]) {
          const o = this._tone('sawtooth', mtof(n - 12), t, STEP * 16, 0.018, out, { attack: 0.4, filter: 900 });
          o.detune.value = d;
        }
      }
    }
    // Arpeggio (half as busy in the menu).
    if (inGame || s % 2 === 0) {
      const n = chord[ARP[s % 8]] + 12 + (s >= 8 && inGame ? 12 : 0);
      this._tone('square', mtof(n), t, STEP * 0.9, 0.035, out, { filter: 3200 });
      this._tone('square', mtof(n), t, STEP * 0.9, 0.02, this.delay, { filter: 2400 });
    }
    if (!inGame) return;

    // Bass: driving 8ths with octave jumps.
    if (s % 2 === 0) {
      const n = BASS[bar] + (s % 4 === 2 ? 12 : 0);
      this._tone('sawtooth', mtof(n), t, STEP * 1.6, 0.13, out, { filter: 380 + this.intensity * 500, q: 6 });
    }
    // Drums.
    if (s % 4 === 0) {
      this._tone('sine', 150, t, 0.32, 0.55, out, { slideTo: 42 });
      this._noise(t, 0.02, 0.15, out, 'lowpass', 3000);
    }
    if (s === 4 || s === 12) {
      this._noise(t, 0.18, 0.22, out, 'bandpass', 1800);
      this._tone('triangle', 220, t, 0.1, 0.12, out, { slideTo: 140 });
    }
    if (s % 2 === 1 || this.intensity > 0.4) this._noise(t, s % 4 === 2 ? 0.09 : 0.035, 0.06, out, 'highpass', 8000);
    // Lead hook every other phrase.
    if (phrase % 2 === 1) {
      const n = LEAD[(step % 64)];
      if (n > 0) this._tone('triangle', mtof(n), t, STEP * 1.8, 0.07, out, { attack: 0.01 });
    }
  }

  // ---------- sound effects ----------

  _now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  coin() {
    if (!this.ctx) return;
    const t = this._now();
    this.coinStreak = t - this.lastCoin < 0.45 ? Math.min(this.coinStreak + 1, 12) : 0;
    this.lastCoin = t;
    const base = 83 + this.coinStreak; // pitch climbs with a coin streak
    this._tone('square', mtof(base), t, 0.07, 0.07, this.sfx, { filter: 6000 });
    this._tone('sine', mtof(base + 7), t + 0.05, 0.14, 0.12, this.sfx);
  }

  jump() {
    if (!this.ctx) return;
    const t = this._now();
    this._tone('sine', 280, t, 0.18, 0.2, this.sfx, { slideTo: 720 });
    this._noise(t, 0.08, 0.05, this.sfx, 'highpass', 4000);
  }

  slide() {
    if (!this.ctx) return;
    this._noise(this._now(), 0.3, 0.16, this.sfx, 'bandpass', 2400, 500);
  }

  lane() {
    if (!this.ctx) return;
    const t = this._now();
    this._noise(t, 0.09, 0.09, this.sfx, 'bandpass', 3000, 1200);
    this._tone('triangle', 520, t, 0.05, 0.05, this.sfx, { slideTo: 380 });
  }

  power(type) {
    if (!this.ctx) return;
    const t = this._now();
    const root = { magnet: 64, shield: 67, double: 69, jetpack: 60 }[type] ?? 64;
    [0, 4, 7, 12, 16].forEach((iv, i) => this._tone('triangle', mtof(root + iv), t + i * 0.055, 0.22, 0.13, this.sfx));
    this._tone('sine', mtof(root + 24), t + 0.28, 0.4, 0.06, this.sfx);
  }

  powerEnd() {
    if (!this.ctx) return;
    const t = this._now();
    this._tone('triangle', mtof(72), t, 0.12, 0.08, this.sfx);
    this._tone('triangle', mtof(67), t + 0.1, 0.18, 0.08, this.sfx);
  }

  shieldBreak() {
    if (!this.ctx) return;
    const t = this._now();
    this._noise(t, 0.4, 0.3, this.sfx, 'highpass', 2500);
    this._tone('sine', 1900, t, 0.45, 0.14, this.sfx, { slideTo: 380 });
    this._tone('sine', 120, t, 0.3, 0.3, this.sfx, { slideTo: 50 });
  }

  crash() {
    if (!this.ctx) return;
    const t = this._now();
    this._tone('sine', 140, t, 0.7, 0.6, this.sfx, { slideTo: 32 });
    this._tone('sawtooth', 90, t, 0.5, 0.18, this.sfx, { slideTo: 30, filter: 600 });
    this._noise(t, 0.9, 0.45, this.sfx, 'lowpass', 2500, 120);
    this.jet(false);
  }

  fall() {
    if (!this.ctx) return;
    const t = this._now();
    this._tone('sine', 700, t, 1.0, 0.18, this.sfx, { slideTo: 60 });
  }

  click() {
    if (!this.ctx) return;
    this._tone('triangle', 900, this._now(), 0.05, 0.06, this.sfx, { slideTo: 1200 });
  }

  newBest() {
    if (!this.ctx) return;
    const t = this._now();
    [72, 76, 79, 84, 88].forEach((n, i) => this._tone('square', mtof(n), t + i * 0.09, 0.25, 0.06, this.sfx, { filter: 4000 }));
  }

  /** Looping jetpack roar while flying. */
  jet(on) {
    if (!this.ctx) return;
    const t = this._now();
    if (on && !this.jetSource) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700;
      f.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.3);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t);
      this.jetSource = { src, g };
    } else if (!on && this.jetSource) {
      const { src, g } = this.jetSource;
      g.gain.setTargetAtTime(0.0001, t, 0.12);
      src.stop(t + 0.6);
      this.jetSource = null;
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}
