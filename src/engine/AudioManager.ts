/**
 * AudioManager — Procedural sound effects and ambient music using Web Audio API.
 *
 * All sounds are synthesised on-the-fly (oscillators + noise), so no audio files
 * are needed. Designed to be lightweight and mobile-friendly.
 */

/** Sound effect identifiers */
export type SfxType =
  | 'building_placed'
  | 'building_complete'
  | 'flag_placed'
  | 'road_built'
  | 'knight_recruited'
  | 'combat_clash'
  | 'under_attack'
  | 'building_captured'
  | 'building_destroyed'
  | 'victory'
  | 'defeat'
  | 'ui_click'
  | 'notification';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private _muted = false;
  private _masterVolume = 0.5;
  private _sfxVolume = 0.8;
  private _musicVolume = 0.3;

  // Ambient music state
  private musicOscillators: OscillatorNode[] = [];
  private musicGains: GainNode[] = [];
  private musicPlaying = false;
  private musicLfoId: number | null = null;

  /** Lazily initialise the AudioContext (must be called after user gesture). */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._masterVolume;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._musicVolume;
      this.musicGain.connect(this.masterGain);
    }
    // Resume context if suspended (e.g. after tab goes background)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // ---------------------------------------------------------------
  // Volume & mute controls
  // ---------------------------------------------------------------

  get muted(): boolean {
    return this._muted;
  }

  set muted(v: boolean) {
    this._muted = v;
    if (this.masterGain) {
      this.masterGain.gain.value = v ? 0 : this._masterVolume;
    }
    if (v) {
      this.stopMusic();
    }
  }

  get masterVolume(): number {
    return this._masterVolume;
  }

  set masterVolume(v: number) {
    this._masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.value = this._masterVolume;
    }
  }

  get sfxVolume(): number {
    return this._sfxVolume;
  }

  set sfxVolume(v: number) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this._sfxVolume;
    }
  }

  get musicVolume(): number {
    return this._musicVolume;
  }

  set musicVolume(v: number) {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) {
      this.musicGain.gain.value = this._musicVolume;
    }
  }

  // ---------------------------------------------------------------
  // Sound effects
  // ---------------------------------------------------------------

  /** Play a sound effect by name. */
  play(sfx: SfxType): void {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const dest = this.sfxGain!;

    switch (sfx) {
      case 'building_placed':
        this.playBuildingPlaced(ctx, dest);
        break;
      case 'building_complete':
        this.playBuildingComplete(ctx, dest);
        break;
      case 'flag_placed':
        this.playFlagPlaced(ctx, dest);
        break;
      case 'road_built':
        this.playRoadBuilt(ctx, dest);
        break;
      case 'knight_recruited':
        this.playKnightRecruited(ctx, dest);
        break;
      case 'combat_clash':
        this.playCombatClash(ctx, dest);
        break;
      case 'under_attack':
        this.playUnderAttack(ctx, dest);
        break;
      case 'building_captured':
        this.playBuildingCaptured(ctx, dest);
        break;
      case 'building_destroyed':
        this.playBuildingDestroyed(ctx, dest);
        break;
      case 'victory':
        this.playVictory(ctx, dest);
        break;
      case 'defeat':
        this.playDefeat(ctx, dest);
        break;
      case 'ui_click':
        this.playUIClick(ctx, dest);
        break;
      case 'notification':
        this.playNotification(ctx, dest);
        break;
    }
  }

  // ------ individual SFX synth routines ------

  /** Satisfying low thud */
  private playBuildingPlaced(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Ascending two-tone chime */
  private playBuildingComplete(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    // First note
    this.playTone(ctx, dest, 523.25, 'sine', 0.3, t, 0.12); // C5
    // Second note (higher)
    this.playTone(ctx, dest, 659.25, 'sine', 0.3, t + 0.12, 0.18); // E5
  }

  /** Soft click — short high-freq burst */
  private playFlagPlaced(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /** Light tap — filtered noise click */
  private playRoadBuilt(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.08);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** Trumpet-like fanfare */
  private playKnightRecruited(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    this.playTone(ctx, dest, 392.0, 'sawtooth', 0.15, t, 0.1); // G4
    this.playTone(ctx, dest, 523.25, 'sawtooth', 0.15, t + 0.1, 0.1); // C5
    this.playTone(ctx, dest, 659.25, 'sawtooth', 0.15, t + 0.2, 0.2); // E5
  }

  /** Metallic clash — noise + high sine */
  private playCombatClash(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    // Noise burst
    this.playNoiseBurst(ctx, dest, 0.25, t, 0.15);
    // Metallic ring
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Alarm — oscillating between two tones */
  private playUnderAttack(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const offset = i * 0.2;
      this.playTone(ctx, dest, 880, 'square', 0.12, t + offset, 0.08);
      this.playTone(ctx, dest, 660, 'square', 0.12, t + offset + 0.1, 0.08);
    }
  }

  /** Victory horn — ascending chord */
  private playBuildingCaptured(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    this.playTone(ctx, dest, 349.23, 'sawtooth', 0.12, t, 0.15); // F4
    this.playTone(ctx, dest, 440.0, 'sawtooth', 0.12, t + 0.1, 0.15); // A4
    this.playTone(ctx, dest, 523.25, 'sawtooth', 0.12, t + 0.2, 0.25); // C5
  }

  /** Crash — noise with falling pitch */
  private playBuildingDestroyed(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    this.playNoiseBurst(ctx, dest, 0.3, t, 0.3);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** Triumphant fanfare — major chord arpeggio */
  private playVictory(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]; // C4 E4 G4 C5 E5 G5
    notes.forEach((freq, i) => {
      this.playTone(ctx, dest, freq, 'sawtooth', 0.12, t + i * 0.12, 0.3);
    });
  }

  /** Sad descending minor tones */
  private playDefeat(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    const notes = [392.0, 349.23, 293.66, 261.63]; // G4 F4 D4 C4
    notes.forEach((freq, i) => {
      this.playTone(ctx, dest, freq, 'sine', 0.2, t + i * 0.25, 0.35);
    });
  }

  /** Subtle click */
  private playUIClick(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  /** Bell-like notification chime */
  private playNotification(ctx: AudioContext, dest: AudioNode): void {
    const t = ctx.currentTime;
    // Fundamental + harmonic for bell timbre
    this.playTone(ctx, dest, 880, 'sine', 0.15, t, 0.25);
    this.playTone(ctx, dest, 1760, 'sine', 0.06, t, 0.15); // 2nd harmonic
    this.playTone(ctx, dest, 2640, 'sine', 0.03, t, 0.1); // 3rd harmonic
  }

  // ------ helpers ------

  /** Play a single tone with envelope */
  private playTone(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    type: OscillatorType,
    volume: number,
    startTime: number,
    duration: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  /** Play a burst of filtered noise */
  private playNoiseBurst(
    ctx: AudioContext,
    dest: AudioNode,
    volume: number,
    startTime: number,
    duration: number,
  ): void {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    source.connect(filter).connect(gain).connect(dest);
    source.start(startTime);
    source.stop(startTime + duration + 0.01);
  }

  // ---------------------------------------------------------------
  // Ambient music — gentle procedural drone
  // ---------------------------------------------------------------

  /** Start the ambient background music */
  startMusic(): void {
    if (this._muted || this.musicPlaying) return;
    const ctx = this.ensureContext();
    const dest = this.musicGain!;

    this.musicPlaying = true;

    // Pentatonic drone notes: C3, G3, C4 (peaceful medieval feel)
    const baseNotes = [130.81, 196.0, 261.63];

    for (const freq of baseNotes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0;
      // Fade in gently over 3 seconds
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 3);
      osc.connect(gain).connect(dest);
      osc.start();
      this.musicOscillators.push(osc);
      this.musicGains.push(gain);
    }

    // Add a triangle wave for warmth
    const warmOsc = ctx.createOscillator();
    const warmGain = ctx.createGain();
    warmOsc.type = 'triangle';
    warmOsc.frequency.value = 65.41; // C2 sub-bass
    warmGain.gain.value = 0;
    warmGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);
    warmOsc.connect(warmGain).connect(dest);
    warmOsc.start();
    this.musicOscillators.push(warmOsc);
    this.musicGains.push(warmGain);

    // Slow LFO to gently modulate volumes (breathing effect)
    let lfoPhase = 0;
    const lfoTick = (): void => {
      if (!this.musicPlaying) return;
      lfoPhase += 0.002; // Very slow
      const mod = 0.5 + 0.5 * Math.sin(lfoPhase);
      for (const g of this.musicGains) {
        // Modulate between 60% and 100% of target volume
        const base = g === this.musicGains[this.musicGains.length - 1] ? 0.05 : 0.08;
        g.gain.value = base * (0.6 + 0.4 * mod);
      }
      this.musicLfoId = requestAnimationFrame(lfoTick);
    };
    this.musicLfoId = requestAnimationFrame(lfoTick);
  }

  /** Stop the ambient background music */
  stopMusic(): void {
    if (!this.musicPlaying) return;
    this.musicPlaying = false;

    if (this.musicLfoId !== null) {
      cancelAnimationFrame(this.musicLfoId);
      this.musicLfoId = null;
    }

    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // Fade out over 1s, then stop
    for (let i = 0; i < this.musicGains.length; i++) {
      const gain = this.musicGains[i];
      const osc = this.musicOscillators[i];
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 1);
      osc.stop(t + 1.05);
    }

    this.musicOscillators = [];
    this.musicGains = [];
  }

  get isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  // ---------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------

  dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
  }
}

/** Singleton audio manager instance */
export const audioManager = new AudioManager();
