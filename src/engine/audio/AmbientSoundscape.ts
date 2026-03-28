/**
 * AmbientSoundscape — Non-spatial background audio that reacts to game state.
 *
 * Cross-fades between ambient layers based on time of day and weather.
 * Uses rawDelta so ambient continues playing when the game is paused.
 */

import type { AudioAssetLoader } from '../AudioAssetLoader';

interface AmbientLayer {
  soundId: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  targetVolume: number;
}

const FADE_DURATION = 3.0; // seconds for cross-fade

export class AmbientSoundscape {
  private ctx: AudioContext;
  private outputGain: GainNode;
  private assetLoader: AudioAssetLoader;
  private activeLayers = new Map<string, AmbientLayer>();
  private enabled = true;
  private currentPhase = '';
  private currentWeather = 'none';

  constructor(
    ctx: AudioContext,
    outputGain: GainNode,
    assetLoader: AudioAssetLoader,
  ) {
    this.ctx = ctx;
    this.outputGain = outputGain;
    this.assetLoader = assetLoader;
  }

  /**
   * Update the ambient soundscape based on current game state.
   * Called from SpatialAudioEngine.update().
   */
  async update(
    phase: string,
    weather: string,
    nightness: number,
  ): Promise<void> {
    if (!this.enabled) return;

    const phaseChanged = phase !== this.currentPhase;
    const weatherChanged = weather !== this.currentWeather;

    if (!phaseChanged && !weatherChanged) {
      // Just modulate volume by nightness for existing layers
      this.modulateByNightness(nightness);
      return;
    }

    this.currentPhase = phase;
    this.currentWeather = weather;

    // Determine which sounds should be active
    const desiredSounds = this.getDesiredSounds(phase, weather);

    // Stop sounds that are no longer desired
    for (const [soundId] of this.activeLayers) {
      if (!desiredSounds.has(soundId)) {
        this.fadeOutLayer(soundId);
      }
    }

    // Start sounds that are newly desired
    for (const [soundId, volume] of desiredSounds) {
      if (!this.activeLayers.has(soundId)) {
        await this.fadeInLayer(soundId, volume);
      }
    }
  }

  /** Get the set of sounds that should be active for the current state. */
  private getDesiredSounds(
    phase: string,
    weather: string,
  ): Map<string, number> {
    const desired = new Map<string, number>();

    const allEntries = this.assetLoader.getAllEntries();
    for (const [soundId, entry] of Object.entries(allEntries)) {
      if (entry.category !== 'environment' && entry.category !== 'weather') continue;

      // Check time of day filter
      if (entry.timeOfDay && entry.timeOfDay.length > 0) {
        if (!entry.timeOfDay.includes(phase)) continue;
      }

      // Weather sounds only play during matching weather
      if (entry.category === 'weather') {
        if (weather === 'none') continue;
        if (soundId.includes('rain') && weather !== 'rain') continue;
        if (soundId.includes('snow') && weather !== 'snow') continue;
      }

      // Default volume based on category
      const vol = entry.category === 'weather' ? 0.4 : 0.25;
      desired.set(soundId, vol);
    }

    return desired;
  }

  /** Fade in a new ambient layer. */
  private async fadeInLayer(soundId: string, targetVolume: number): Promise<void> {
    const buffer = await this.assetLoader.getBuffer(soundId);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(targetVolume, this.ctx.currentTime + FADE_DURATION);

    source.connect(gain).connect(this.outputGain);
    source.start();

    this.activeLayers.set(soundId, {
      soundId,
      source,
      gain,
      targetVolume,
    });
  }

  /** Fade out and remove an ambient layer. */
  private fadeOutLayer(soundId: string): void {
    const layer = this.activeLayers.get(soundId);
    if (!layer) return;

    const t = this.ctx.currentTime;
    layer.gain.gain.setValueAtTime(layer.gain.gain.value, t);
    layer.gain.gain.linearRampToValueAtTime(0, t + FADE_DURATION);
    layer.source.stop(t + FADE_DURATION + 0.1);

    this.activeLayers.delete(soundId);
  }

  /** Modulate ambient volume based on nightness (0=day, 1=night). */
  private modulateByNightness(nightness: number): void {
    for (const [soundId, layer] of this.activeLayers) {
      // Night sounds get louder at night, day sounds get quieter
      const isNightSound = soundId.includes('night') || soundId.includes('cricket') || soundId.includes('owl');
      const factor = isNightSound ? (0.3 + 0.7 * nightness) : (1.0 - 0.5 * nightness);
      const vol = layer.targetVolume * factor;
      layer.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      for (const [soundId] of this.activeLayers) {
        this.fadeOutLayer(soundId);
      }
    }
  }

  dispose(): void {
    for (const [, layer] of this.activeLayers) {
      try {
        layer.source.stop();
      } catch {
        // Already stopped
      }
    }
    this.activeLayers.clear();
  }
}
