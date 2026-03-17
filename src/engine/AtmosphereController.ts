import * as THREE from 'three';

export const TimeOfDay = {
  Dawn: 'dawn',
  Morning: 'morning',
  Midday: 'midday',
  GoldenHour: 'golden_hour',
  Evening: 'evening',
  Night: 'night',
} as const;

export type TimeOfDay = (typeof TimeOfDay)[keyof typeof TimeOfDay];

export interface ColorGradingParams {
  warmTint: [number, number, number];
  contrast: number;
  saturation: number;
}

export interface CycleState {
  sunAngle: number;
  nightness: number;
  phase: TimeOfDay;
  targetPhase: TimeOfDay;
  phaseProgress: number;
  transitioning: boolean;
}

interface Preset {
  skyColor: number;
  groundColor: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  fogColor: number;
  clearColor: number;
  fogDensity: number;
  exposure: number;
  sunAngle: number;
  colorGrading: ColorGradingParams;
  nightness: number;
}

const PRESETS: Record<TimeOfDay, Preset> = {
  [TimeOfDay.Dawn]: {
    skyColor: 0xffaa77,
    groundColor: 0x556644,
    hemiIntensity: 0.55,
    sunColor: 0xff8855,
    sunIntensity: 0.5,
    fogColor: 0xddaa88,
    clearColor: 0xddaa88,
    fogDensity: 0.012,
    exposure: 0.85,
    sunAngle: 15,
    colorGrading: { warmTint: [1.08, 1.0, 0.88], contrast: 1.02, saturation: 1.15 },
    nightness: 0.3,
  },
  [TimeOfDay.Morning]: {
    skyColor: 0xaaddff,
    groundColor: 0x77aa66,
    hemiIntensity: 0.8,
    sunColor: 0xffdd99,
    sunIntensity: 0.9,
    fogColor: 0xd4e4ee,
    clearColor: 0xd4e4ee,
    fogDensity: 0.010,
    exposure: 0.95,
    sunAngle: 45,
    colorGrading: { warmTint: [1.04, 1.0, 0.94], contrast: 1.05, saturation: 1.1 },
    nightness: 0.0,
  },
  [TimeOfDay.Midday]: {
    skyColor: 0x87ceeb,
    groundColor: 0x6a9c5f,
    hemiIntensity: 1.0,
    sunColor: 0xfff8ee,
    sunIntensity: 1.2,
    fogColor: 0xc8dce8,
    clearColor: 0xc8dce8,
    fogDensity: 0.008,
    exposure: 1.0,
    sunAngle: 85,
    colorGrading: { warmTint: [1.02, 1.0, 0.96], contrast: 1.08, saturation: 1.1 },
    nightness: 0.0,
  },
  [TimeOfDay.GoldenHour]: {
    skyColor: 0xffcc66,
    groundColor: 0x887744,
    hemiIntensity: 0.7,
    sunColor: 0xffaa44,
    sunIntensity: 0.8,
    fogColor: 0xddbb88,
    clearColor: 0xddbb88,
    fogDensity: 0.011,
    exposure: 0.9,
    sunAngle: 160,
    colorGrading: { warmTint: [1.1, 1.0, 0.85], contrast: 1.04, saturation: 1.2 },
    nightness: 0.2,
  },
  [TimeOfDay.Evening]: {
    skyColor: 0xdd6644,
    groundColor: 0x556644,
    hemiIntensity: 0.55,
    sunColor: 0xff5533,
    sunIntensity: 0.5,
    fogColor: 0xcc8866,
    clearColor: 0xcc8866,
    fogDensity: 0.012,
    exposure: 0.8,
    sunAngle: 175,
    colorGrading: { warmTint: [1.08, 0.98, 0.88], contrast: 1.02, saturation: 1.15 },
    nightness: 0.6,
  },
  [TimeOfDay.Night]: {
    skyColor: 0x334466,
    groundColor: 0x223322,
    hemiIntensity: 0.45,
    sunColor: 0x8899cc,
    sunIntensity: 0.35,
    fogColor: 0x2a3344,
    clearColor: 0x2a3344,
    fogDensity: 0.014,
    exposure: 0.6,
    sunAngle: 280,
    colorGrading: { warmTint: [0.92, 0.96, 1.08], contrast: 0.95, saturation: 0.85 },
    nightness: 1.0,
  },
};

const CYCLE_ORDER: TimeOfDay[] = [
  TimeOfDay.Dawn,
  TimeOfDay.Morning,
  TimeOfDay.Midday,
  TimeOfDay.GoldenHour,
  TimeOfDay.Evening,
  TimeOfDay.Night,
];

/** Duration of each time-of-day preset before transitioning (in seconds) */
const PRESET_DURATION = 180; // 3 minutes × 6 = 18 min full cycle

/** Duration of the transition between presets (in seconds) */
const TRANSITION_DURATION = 30;

/** Radius for the sun arc */
const SUN_ARC_RADIUS = 25;

/**
 * Controls time-of-day lighting presets.
 * Smoothly lerps between 6 presets (Dawn/Morning/Midday/GoldenHour/Evening/Night).
 * Can auto-cycle or be set manually.
 */
export class AtmosphereController {
  private hemiLight: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;
  private fog: THREE.FogExp2 | null;
  private renderer: THREE.WebGLRenderer;

  private currentPreset: TimeOfDay = TimeOfDay.Midday;
  private targetPreset: TimeOfDay = TimeOfDay.Midday;
  private transitionProgress = 1; // 1 = fully at current preset
  private cycleTimer = 0;
  private autoCycle = false;

  private _currentSunAngle = 85;
  private _currentNightness = 0;

  // Reusable color objects to avoid per-frame allocations
  private readonly _colorA = new THREE.Color();
  private readonly _colorB = new THREE.Color();

  /** Callback fired when the active preset changes (for envMap regeneration) */
  onPresetChanged: (() => void) | null = null;

  /** Callback fired each frame during transitions with interpolated color grading params */
  onColorGradingUpdate: ((params: ColorGradingParams) => void) | null = null;

  /** Callback fired when nightness value changes (0=day, 1=full night) */
  onNightnessUpdate: ((nightness: number) => void) | null = null;

  constructor(
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    fog: THREE.FogExp2 | null,
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
    this.onPresetChanged?.();
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

  /** Returns interpolated cycle state for UI consumption */
  getCycleState(): CycleState {
    return {
      sunAngle: this._currentSunAngle,
      nightness: this._currentNightness,
      phase: this.currentPreset,
      targetPhase: this.targetPreset,
      phaseProgress: this.cycleTimer / PRESET_DURATION,
      transitioning: this.transitionProgress < 1,
    };
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
        this.onPresetChanged?.();
      }
    }
  }

  private applyPreset(p: Preset): void {
    this.hemiLight.color.setHex(p.skyColor);
    this.hemiLight.groundColor.setHex(p.groundColor);
    this.hemiLight.intensity = p.hemiIntensity;
    this.dirLight.color.setHex(p.sunColor);
    this.dirLight.intensity = p.sunIntensity;
    if (this.fog) {
      this.fog.color.setHex(p.fogColor);
      this.fog.density = p.fogDensity;
    }
    this.renderer.setClearColor(p.clearColor);
    this.renderer.toneMappingExposure = p.exposure;
    this._currentSunAngle = p.sunAngle;
    this._currentNightness = p.nightness;
    this.applySunPosition(p.sunAngle);
    this.onColorGradingUpdate?.(p.colorGrading);
    this.onNightnessUpdate?.(p.nightness);
  }

  private applyLerped(from: Preset, to: Preset, t: number): void {
    // Use HSL lerp for colors to avoid muddy grey/green intermediates
    this._colorA.setHex(from.skyColor).lerpHSL(this._colorB.setHex(to.skyColor), t);
    this.hemiLight.color.copy(this._colorA);

    this._colorA.setHex(from.groundColor).lerpHSL(this._colorB.setHex(to.groundColor), t);
    this.hemiLight.groundColor.copy(this._colorA);

    this.hemiLight.intensity = from.hemiIntensity + (to.hemiIntensity - from.hemiIntensity) * t;

    this._colorA.setHex(from.sunColor).lerpHSL(this._colorB.setHex(to.sunColor), t);
    this.dirLight.color.copy(this._colorA);

    this.dirLight.intensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * t;

    if (this.fog) {
      this._colorA.setHex(from.fogColor).lerpHSL(this._colorB.setHex(to.fogColor), t);
      this.fog.color.copy(this._colorA);
      this.fog.density = from.fogDensity + (to.fogDensity - from.fogDensity) * t;
    }

    this._colorA.setHex(from.clearColor).lerpHSL(this._colorB.setHex(to.clearColor), t);
    this.renderer.setClearColor(this._colorA);

    // Exposure
    this.renderer.toneMappingExposure = from.exposure + (to.exposure - from.exposure) * t;

    // Sun arc position — handle Night→Dawn wrapping (280→375 instead of backward)
    let fromAngle = from.sunAngle;
    let toAngle = to.sunAngle;
    if (toAngle - fromAngle > 180) {
      fromAngle += 360;
    } else if (fromAngle - toAngle > 180) {
      toAngle += 360;
    }
    const angle = fromAngle + (toAngle - fromAngle) * t;
    this._currentSunAngle = angle % 360;
    this.applySunPosition(angle);

    // Interpolate color grading params
    const cg: ColorGradingParams = {
      warmTint: [
        from.colorGrading.warmTint[0] + (to.colorGrading.warmTint[0] - from.colorGrading.warmTint[0]) * t,
        from.colorGrading.warmTint[1] + (to.colorGrading.warmTint[1] - from.colorGrading.warmTint[1]) * t,
        from.colorGrading.warmTint[2] + (to.colorGrading.warmTint[2] - from.colorGrading.warmTint[2]) * t,
      ],
      contrast: from.colorGrading.contrast + (to.colorGrading.contrast - from.colorGrading.contrast) * t,
      saturation: from.colorGrading.saturation + (to.colorGrading.saturation - from.colorGrading.saturation) * t,
    };
    this.onColorGradingUpdate?.(cg);

    // Interpolate nightness
    const nightness = from.nightness + (to.nightness - from.nightness) * t;
    this._currentNightness = nightness;
    this.onNightnessUpdate?.(nightness);
  }

  private applySunPosition(angleDeg: number): void {
    const rad = (angleDeg * Math.PI) / 180;
    const x = SUN_ARC_RADIUS * Math.cos(rad);
    const y = Math.max(-5, SUN_ARC_RADIUS * Math.sin(rad));
    const z = 10; // fixed offset on Z axis
    this.dirLight.position.set(x, y, z);
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
