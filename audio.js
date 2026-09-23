/* ===================================================
   AMIGA TURBO RACER - PROCEDURAL RETRO AUDIO SYSTEM
   Synthesizes authentic arcade engine revs, squeals,
   crash impacts, turbo whoosh, and countdown bleeps
   using the native Web Audio API (Zero external audio).
   =================================================== */

window.ATR = window.ATR || {};

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.8;
    this.isMuted = false;
    this.isStarted = false;

    // Active engine sound nodes for Player 1 & 2
    this.p1Engine = null;
    this.p2Engine = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.isStarted = true;
    } catch (e) {
      console.warn("Web Audio not supported or blocked by browser policy.", e);
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  // Create looped twin-oscillator engine synth
  createEngineSource() {
    if (!this.ctx) return null;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    osc1.frequency.setValueAtTime(65, this.ctx.currentTime);
    osc2.frequency.setValueAtTime(32.5, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();

    return { osc1, osc2, gain, filter };
  }

  startEngines(isSplitScreen = false) {
    this.init();
    if (!this.ctx) return;
    if (!this.p1Engine) this.p1Engine = this.createEngineSource();
    if (isSplitScreen && !this.p2Engine) {
      this.p2Engine = this.createEngineSource();
    }
  }

  stopEngines() {
    if (this.p1Engine && this.p1Engine.gain && this.ctx) {
      this.p1Engine.gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    }
    if (this.p2Engine && this.p2Engine.gain && this.ctx) {
      this.p2Engine.gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    }
  }

  updateEngine(playerNum, speedRatio, isAccelerating) {
    if (!this.ctx) return;
    const engine = playerNum === 1 ? this.p1Engine : this.p2Engine;
    if (!engine) return;

    const baseFreq = 55 + speedRatio * 180 + (isAccelerating ? 25 : 0);
    const targetGain = 0.08 + speedRatio * 0.12;

    const t = this.ctx.currentTime;
    engine.osc1.frequency.setTargetAtTime(baseFreq, t, 0.08);
    engine.osc2.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.08);
    engine.filter.frequency.setTargetAtTime(350 + speedRatio * 800, t, 0.08);
    engine.gain.gain.setTargetAtTime(targetGain, t, 0.08);
  }

  // Countdown Beep (low beep for 3, 2, 1; high beep for GO!)
  playBeep(isGo = false) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isGo ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isGo ? 0.6 : 0.3));

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + (isGo ? 0.65 : 0.35));
  }

  // Crash / Impact Boom
  playCrash() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
  }

  // Turbo Whoosh
  playTurbo() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  // Tire Skid Squeal
  playSkid() {
    if (!this.ctx || this._skidCooldown) return;
    this._skidCooldown = true;
    setTimeout(() => { this._skidCooldown = false; }, 300);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(950, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(700, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
}

window.ATR.Audio = new AudioSystem();
