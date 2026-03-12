import { describe, it, expect } from 'vitest';
import { AudioManager } from './AudioManager';
import type { SfxType } from './AudioManager';

describe('AudioManager', () => {
  it('should export AudioManager class', () => {
    expect(AudioManager).toBeDefined();
  });

  it('should start muted=false with default volumes', () => {
    const am = new AudioManager();
    expect(am.muted).toBe(false);
    expect(am.masterVolume).toBe(0.5);
    expect(am.sfxVolume).toBe(0.8);
    expect(am.musicVolume).toBe(0.3);
    expect(am.isMusicPlaying).toBe(false);
  });

  it('should toggle mute', () => {
    const am = new AudioManager();
    am.muted = true;
    expect(am.muted).toBe(true);
    am.muted = false;
    expect(am.muted).toBe(false);
  });

  it('should clamp volume between 0 and 1', () => {
    const am = new AudioManager();
    am.masterVolume = -0.5;
    expect(am.masterVolume).toBe(0);
    am.masterVolume = 1.5;
    expect(am.masterVolume).toBe(1);
    am.sfxVolume = -1;
    expect(am.sfxVolume).toBe(0);
    am.musicVolume = 2;
    expect(am.musicVolume).toBe(1);
  });

  it('should not throw when playing SFX while muted (no AudioContext)', () => {
    const am = new AudioManager();
    am.muted = true;
    const sfxTypes: SfxType[] = [
      'building_placed', 'building_complete', 'flag_placed', 'road_built',
      'knight_recruited', 'combat_clash', 'under_attack', 'building_captured',
      'building_destroyed', 'victory', 'defeat', 'ui_click', 'notification',
    ];
    for (const sfx of sfxTypes) {
      expect(() => am.play(sfx)).not.toThrow();
    }
  });

  it('should not start music when muted', () => {
    const am = new AudioManager();
    am.muted = true;
    am.startMusic();
    expect(am.isMusicPlaying).toBe(false);
  });

  it('should not throw on stopMusic when not playing', () => {
    const am = new AudioManager();
    expect(() => am.stopMusic()).not.toThrow();
  });

  it('should not throw on dispose without context', () => {
    const am = new AudioManager();
    expect(() => am.dispose()).not.toThrow();
  });
});
