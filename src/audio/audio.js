/**
 * Hollowmere's soundscape, synthesised at runtime (no audio downloads):
 * layered rain, wind gusts, a low D-minor drone, a sparse music-box motif,
 * a distant chapel bell, thunder, footsteps and UI ticks.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.musicVol = 0.7;
    this.sfxVol = 0.8;
    this.muted = false;
  }

  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.started = true;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 1, ctx.currentTime + 3);

    this.music = ctx.createGain();
    this.music.gain.value = this.musicVol;
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.music.connect(this.master);
    this.sfx.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(4.5, 2.6);
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.55;
    this.reverb.connect(this.reverbOut).connect(this.master);

    this.noise = this._noiseBuffer(4);
    this.brown = this._brownBuffer(6);

    this._rain();
    this._wind();
    this._drone();
    this._scheduleMotif();
    this._scheduleBell();
    this._scheduleDrips();
  }

  setMusic(v) {
    this.musicVol = v;
    if (this.music) this.music.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }
  setSfx(v) {
    this.sfxVol = v;
    if (this.sfx) this.sfx.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.25);
  }
  setRain(level) {
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(0.1 + level * 0.32, this.ctx.currentTime, 0.8);
  }

  /* ---------------- building blocks ---------------- */

  _noiseBuffer(sec) {
    const b = this.ctx.createBuffer(2, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return b;
  }

  _brownBuffer(sec) {
    const b = this.ctx.createBuffer(2, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return b;
  }

  _impulse(sec, decay) {
    const rate = this.ctx.sampleRate;
    const b = this.ctx.createBuffer(2, rate * sec, rate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay);
    }
    return b;
  }

  _loop(buffer) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * buffer.duration);
    return s;
  }

  _rain() {
    const ctx = this.ctx;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.3;
    this.rainGain.connect(this.sfx);
    // far hiss
    const far = this._loop(this.noise);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    const g1 = ctx.createGain();
    g1.gain.value = 0.32;
    far.connect(hp).connect(lp).connect(g1).connect(this.rainGain);
    // near patter on roofs
    const near = this._loop(this.noise);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.08;
    lfo.connect(lfoG).connect(g2.gain);
    lfo.start();
    near.connect(bp).connect(g2).connect(this.rainGain);
    // low rumble of water
    const low = this._loop(this.brown);
    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = 380;
    const g3 = ctx.createGain();
    g3.gain.value = 0.35;
    low.connect(lp2).connect(g3).connect(this.rainGain);
  }

  _wind() {
    const ctx = this.ctx;
    const src = this._loop(this.brown);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    src.connect(bp).connect(g).connect(this.sfx);
    const gust = () => {
      const t = ctx.currentTime;
      const dur = 4 + Math.random() * 6;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.22, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.03, t + dur);
      bp.frequency.setTargetAtTime(300 + Math.random() * 500, t, dur * 0.3);
      setTimeout(gust, dur * 1000 + Math.random() * 3000);
    };
    gust();
  }

  _drone() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.0;
    out.gain.linearRampToValueAtTime(0.085, ctx.currentTime + 8);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.Q.value = 0.8;
    out.connect(lp);
    lp.connect(this.music);
    lp.connect(this.reverb);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 260;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    // D2, A2, F3 (+ a dissonant E that drifts in and out)
    [[73.42, 'sawtooth', 0.5], [110.0, 'sawtooth', 0.35], [174.61, 'triangle', 0.4], [164.81, 'sine', 0.18]].forEach(([f, type, v], i) => {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = det + Math.random() * 3;
        const g = ctx.createGain();
        g.gain.value = v * 0.5;
        if (i === 3) {
          const l = ctx.createOscillator();
          l.frequency.value = 0.031;
          const lg = ctx.createGain();
          lg.gain.value = v * 0.5;
          l.connect(lg).connect(g.gain);
          l.start();
          g.gain.value = 0;
        }
        o.connect(g).connect(out);
        o.start();
      }
    });
  }

  _pluck(freq, when, vol = 0.12, dest = this.music) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 3.01;
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 2.4);
    g2.gain.setValueAtTime(vol * 0.3, when);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
    o.connect(g);
    o2.connect(g2);
    g.connect(dest);
    g2.connect(dest);
    g.connect(this.reverb);
    g2.connect(this.reverb);
    o.start(when);
    o2.start(when);
    o.stop(when + 2.6);
    o2.stop(when + 2.6);
  }

  _scheduleMotif() {
    // a music box that remembers only part of its tune
    const phrases = [
      [587.33, 698.46, 659.25, 554.37],
      [880.0, 698.46, 587.33],
      [587.33, 659.25, 698.46, 783.99, 698.46],
      [466.16, 440.0, 554.37, 587.33],
    ];
    const play = () => {
      if (!this.ctx) return;
      const p = phrases[Math.floor(Math.random() * phrases.length)];
      const t0 = this.ctx.currentTime + 0.1;
      const n = Math.random() < 0.3 ? p.length - 1 : p.length; // sometimes it stops short
      for (let i = 0; i < n; i++) this._pluck(p[i], t0 + i * (0.42 + Math.random() * 0.08), 0.06);
      setTimeout(play, 9000 + Math.random() * 12000);
    };
    setTimeout(play, 5000);
  }

  bell(vol = 0.18) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;
    const base = 146.83; // D3, far away
    [[1, 1], [2.0, 0.6], [2.4, 0.45], [3.0, 0.3], [4.2, 0.2], [5.4, 0.12]].forEach(([r, a]) => {
      const o = ctx.createOscillator();
      o.frequency.value = base * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 6 / r + 1.5);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      o.connect(g).connect(lp);
      lp.connect(this.sfx);
      lp.connect(this.reverb);
      o.start(t);
      o.stop(t + 9);
    });
  }

  _scheduleBell() {
    const ring = () => {
      const count = Math.random() < 0.25 ? 3 : 1;
      for (let i = 0; i < count; i++) setTimeout(() => this.bell(0.13), i * 2600);
      setTimeout(ring, 38000 + Math.random() * 30000);
    };
    setTimeout(ring, 16000);
  }

  _scheduleDrips() {
    const drip = () => {
      if (this.ctx) {
        const ctx = this.ctx;
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sine';
        const f = 900 + Math.random() * 900;
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.05);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05 * Math.random() + 0.02, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.random() * 2 - 1;
        o.connect(g).connect(pan).connect(this.sfx);
        g.connect(this.reverb);
        o.start(t);
        o.stop(t + 0.15);
      }
      setTimeout(drip, 500 + Math.random() * 2200);
    };
    drip();
  }

  thunder(intensity = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.brown;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(70, t + 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9 * intensity, t + 0.08);
    g.gain.linearRampToValueAtTime(0.5 * intensity, t + 0.6);
    g.gain.linearRampToValueAtTime(0.7 * intensity, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 6);
    src.connect(lp).connect(g);
    g.connect(this.sfx);
    g.connect(this.reverb);
    src.start(t, Math.random() * 2);
    src.stop(t + 6.5);
  }

  footstep() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600 + Math.random() * 500;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 3);
    src.stop(t + 0.2);
    // a faint lantern clink every few steps
    if (Math.random() < 0.3) this._pluck(2200 + Math.random() * 400, t + 0.03, 0.012, this.sfx);
  }

  caw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (let k = 0; k < 2; k++) {
      const t = ctx.currentTime + k * 0.32;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, t);
      o.frequency.linearRampToValueAtTime(380, t + 0.22);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1300;
      bp.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(bp).connect(g);
      g.connect(this.sfx);
      g.connect(this.reverb);
      o.start(t);
      o.stop(t + 0.3);
    }
  }

  uiHover() {
    if (!this.ctx) return;
    this._pluck(1318.5, this.ctx.currentTime, 0.025, this.sfx);
  }

  uiSelect() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._pluck(587.33, t, 0.06, this.sfx);
    this._pluck(880.0, t + 0.09, 0.05, this.sfx);
  }

  page() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    src.connect(hp).connect(g).connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + 0.4);
  }

  swell() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [146.83, 220, 293.66, 349.23].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 2.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 6);
      o.connect(g);
      g.connect(this.music);
      g.connect(this.reverb);
      o.start(t + i * 0.05);
      o.stop(t + 6.2);
    });
  }
}
