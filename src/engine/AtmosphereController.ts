import * as THREE from 'three';

export const TimeOfDay = {
  Morning: 'morning',
  Midday: 'midday',
  Evening: 'evening',
  Night: 'night',
} as const;

export type TimeOfDay = (typeof TimeOfDay)[keyof typeof TimeOfDay];

interface Preset {
  skyColor: number;
  groundColor: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  fogColor: number;
  clearColor: number;
}

const PRESETS: Record<TimeOfDay, Preset> = {
  [TimeOfDay.Morning]: {
    skyColor: 0xffd4a0,
    groundColor: 0x5a7c3f,
    hemiIntensity: 0.6,
    sunColor: 0xffcc88,
    sunIntensity: 0.7,
    fogColor: 0xe8d4c0,
    clearColor: 0xe8d4c0,
  },
  [TimeOfDay.Midday]: {
    skyColor: 0x87ceeb,
    groundColor: 0x4a7c3f,
    hemiIntensity: 0.7,
    sunColor: 0xfff4e0,
    sunIntensity: 0.9,
    fogColor: 0xc8dce8,
    clearColor: 0xc8dce8,
  },
  [TimeOfDay.Evening]: {
    skyColor: 0xff8844,
    groundColor: 0x3a5c2f,
    hemiIntensity: 0.5,
    sunColor: 0xff6622,
    sunIntensity: 0.6,
    fogColor: 0xd4a088,
    clearColor: 0xd4a088,
  },
  [TimeOfDay.Night]: {
    skyColor: 0x1a1a3e,
    groundColor: 0x0a1a0a,
    hemiIntensity: 0.2,
    sunColor: 0x6688cc,
    sunIntensity: 0.3,
    fogColor: 0x1a1a2e,
    clearColor: 0x1a1a2e,
  },
};

const CYCLE_ORDER: TimeOfDay[] = [
  TimeOfDay.Morning,
  TimeOfDay.Midday,
  TimeOfDay.Evening,
  TimeOfDay.Night,
];

/** Duration of each time-of-day preset before transitioning (in seconds) */
const PRESET_DURATION = 300; // 5 minutes

/** Duration of the transition between presets (in seconds) */
const TRANSITION_DURATION = 30;

/**
 * Controls time-of-day lighting presets.
 * Smoothly lerps between 4 presets (Morning/Midday/Evening/Night).
 * Can auto-cycle or be set manually.
 */
export class AtmosphereController {
  private hemiLight: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;
  private fog: THREE.FogExp2;
  private renderer: THREE.WebGLRenderer;

  private currentPreset: TimeOfDay = TimeOfDay.Midday;
  private targetPreset: TimeOfDay = TimeOfDay.Midday;
  private transitionProgress = 1; // 1 = fully at current preset
  private cycleTimer = 0;
  private autoCycle = false;

  constructor(
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    fog: THREE.FogExp2,
    renderer: THREE.WebGLRenderer,
  ) {
    this.hemiLight = hemiLight;
    this.dirLight = dirLight;
    this.fog = fog;
    this.renderer = renderer;
  }

  /** Set the time of day immediately (no transition) */
  setPreset(preset: TimeOfDay): void {
    this.currentPreset = preset;
    this.targetPreset = preset;
    this.transitionProgress = 1;
    this.applyPreset(PRESETS[preset]);
  }

  /** Enable/disable auto-cycling through presets */
  setAutoCycle(enabled: boolean): void {
    this.autoCycle = enabled;
    this.cycleTimer = 0;
  }

  isAutoCycling(): boolean {
    return this.autoCycle;
  }

  getCurrentPreset(): TimeOfDay {
    return this.currentPreset;
  }

  /** Update each frame. Handles transitions and auto-cycling. */
  update(deltaTime: number): void {
    if (this.autoCycle) {
      this.cycleTimer += deltaTime;
      if (this.cycleTimer >= PRESET_DURATION && this.transitionProgress >= 1) {
        // Start transition to next preset
        const idx = CYCLE_ORDER.indexOf(this.currentPreset);
        this.targetPreset = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
        this.transitionProgress = 0;
        this.cycleTimer = 0;
      }
    }

    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + deltaTime / TRANSITION_DURATION);

      const from = PRESETS[this.currentPreset];
      const to = PRESETS[this.targetPreset];
      const t = this.smoothstep(this.transitionProgress);

      this.applyLerped(from, to, t);

      if (this.transitionProgress >= 1) {
        this.currentPreset = this.targetPreset;
      }
    }
  }

  private applyPreset(p: Preset): void {
    this.hemiLight.color.setHex(p.skyColor);
    this.hemiLight.groundColor.setHex(p.groundColor);
    this.hemiLight.intensity = p.hemiIntensity;
    this.dirLight.color.setHex(p.sunColor);
    this.dirLight.intensity = p.sunIntensity;
    this.fog.color.setHex(p.fogColor);
    this.renderer.setClearColor(p.clearColor);
  }

  private applyLerped(from: Preset, to: Preset, t: number): void {
    const c = new THREE.Color();

    c.setHex(from.skyColor).lerp(new THREE.Color(to.skyColor), t);
    this.hemiLight.color.copy(c);

    c.setHex(from.groundColor).lerp(new THREE.Color(to.groundColor), t);
    this.hemiLight.groundColor.copy(c);

    this.hemiLight.intensity = from.hemiIntensity + (to.hemiIntensity - from.hemiIntensity) * t;

    c.setHex(from.sunColor).lerp(new THREE.Color(to.sunColor), t);
    this.dirLight.color.copy(c);

    this.dirLight.intensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * t;

    c.setHex(from.fogColor).lerp(new THREE.Color(to.fogColor), t);
    this.fog.color.copy(c);

    c.setHex(from.clearColor).lerp(new THREE.Color(to.clearColor), t);
    this.renderer.setClearColor(c);
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
