import type { GraphicsSettings, AudioSettings } from './GameConfig';
import { DEFAULT_GRAPHICS, DEFAULT_AUDIO } from './GameConfig';

const KEY = 'feudal-settings';

export interface PersistedSettings {
  graphics: GraphicsSettings;
  audio: AudioSettings;
}

export function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        graphics: { ...DEFAULT_GRAPHICS, ...p.graphics },
        audio: { ...DEFAULT_AUDIO, ...p.audio },
      };
    }
  } catch { /* corrupt → use defaults */ }
  return { graphics: { ...DEFAULT_GRAPHICS }, audio: { ...DEFAULT_AUDIO } };
}

export function saveSettings(s: PersistedSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}
