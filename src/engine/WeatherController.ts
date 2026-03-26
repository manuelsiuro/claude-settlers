import * as THREE from 'three';
import { shaderTimeManager } from './ShaderTimeManager';

export const WeatherType = {
  None: 'none',
  Rain: 'rain',
  Snow: 'snow',
} as const;

export type WeatherType = (typeof WeatherType)[keyof typeof WeatherType];

// ── Rain Shaders ──

const RAIN_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWind;
  uniform vec3 uCamPos;
  uniform float uFrustum;
  uniform float uOpacity;
  uniform float uSpawnWidth;
  uniform float uSpawnHeight;

  attribute float aSpeed;
  attribute float aPhase;
  attribute vec2 aLocalXZ;

  varying float vAlpha;

  void main() {
    // GPU-driven Y cycling — no CPU position updates needed
    float cyclePos = mod(uTime * aSpeed + aPhase * uSpawnHeight, uSpawnHeight);
    float y = uSpawnHeight - cyclePos;

    // Local XZ position relative to camera
    float x = uCamPos.x + aLocalXZ.x * uSpawnWidth;
    float z = uCamPos.z + aLocalXZ.y * uSpawnWidth;

    // Wind drift accumulates over fall time
    float fallTime = cyclePos / aSpeed;
    x += uWind.x * fallTime * 0.5;
    z += uWind.y * fallTime * 0.5;

    vec3 pos = vec3(x, y, z);
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Faster drops = taller streaks, responsive to frustum zoom
    float baseSize = 3.0 + aSpeed * 0.3;
    gl_PointSize = baseSize * (10.0 / uFrustum);

    // Height fade near ground
    float heightFade = smoothstep(0.0, 2.0, y);
    vAlpha = heightFade * uOpacity;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const RAIN_FRAGMENT = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);

    // Elongate X to create vertical streaks
    float dx = center.x * 3.0;
    float dy = center.y;
    float d = sqrt(dx * dx + dy * dy);

    // Soft edges
    float alpha = 1.0 - smoothstep(0.15, 0.5, d);
    alpha *= vAlpha;

    if (alpha < 0.01) discard;

    // Blue-white color
    vec3 color = vec3(0.7, 0.8, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Snow Shaders ──

const SNOW_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWind;
  uniform vec3 uCamPos;
  uniform float uFrustum;
  uniform float uOpacity;
  uniform float uSpawnWidth;
  uniform float uSpawnHeight;

  attribute float aSpeed;
  attribute float aPhase;
  attribute vec2 aLocalXZ;
  attribute float aSize;

  varying float vAlpha;

  void main() {
    // GPU-driven Y cycling (slower than rain)
    float cyclePos = mod(uTime * aSpeed + aPhase * uSpawnHeight, uSpawnHeight);
    float y = uSpawnHeight - cyclePos;

    // Base XZ position relative to camera
    float x = uCamPos.x + aLocalXZ.x * uSpawnWidth;
    float z = uCamPos.z + aLocalXZ.y * uSpawnWidth;

    // Multi-layered organic drift — 3 sine waves at different frequencies
    float phaseOffset = aPhase * 6.2831;
    float driftX = sin(uTime * 0.8 + phaseOffset) * 0.4
                 + sin(uTime * 1.3 + phaseOffset * 1.7) * 0.25
                 + sin(uTime * 2.1 + phaseOffset * 2.3) * 0.15;
    float driftZ = cos(uTime * 0.8 + phaseOffset * 1.1) * 0.35
                 + cos(uTime * 1.3 + phaseOffset * 1.9) * 0.2
                 + cos(uTime * 2.1 + phaseOffset * 2.5) * 0.12;

    x += driftX;
    z += driftZ;

    // Gentle wind drift
    float fallTime = cyclePos / aSpeed;
    x += uWind.x * fallTime * 0.3;
    z += uWind.y * fallTime * 0.3;

    vec3 pos = vec3(x, y, z);
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Per-particle size variation, responsive to frustum zoom
    float baseSize = 5.0 * aSize;
    gl_PointSize = baseSize * (10.0 / uFrustum);

    // Subtle alpha pulsing for twinkling feel
    float pulse = 0.6 + 0.4 * sin(uTime * 0.5 + phaseOffset);
    vAlpha = pulse * uOpacity;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SNOW_FRAGMENT = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float d = length(center);

    // Soft round flake with smooth falloff
    float alpha = 1.0 - smoothstep(0.2, 0.5, d);
    alpha *= vAlpha;

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

// ── Splash Shader (rain ground rings) ──

const SPLASH_VERTEX = /* glsl */ `
  uniform float uFrustum;
  attribute float aAlpha;
  attribute float aSplashSize;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSplashSize * 3.0 * (10.0 / uFrustum);
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SPLASH_FRAGMENT = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float d = length(center);

    // Ring shape (not filled circle)
    float ring = smoothstep(0.25, 0.35, d) * (1.0 - smoothstep(0.4, 0.5, d));
    float alpha = ring * vAlpha;

    if (alpha < 0.01) discard;

    vec3 color = vec3(0.8, 0.85, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Splash particle state ──

interface SplashParticle {
  age: number;
  lifetime: number;
}

/**
 * Weather effects system with GPU-driven shaders.
 * Rain: elongated streaks with wind drift and ground splash rings.
 * Snow: soft drifting flakes with organic turbulence and twinkling.
 * Smooth fade transitions between weather states.
 */
export class WeatherController {
  private weatherType: WeatherType = 'none';
  private targetWeatherType: WeatherType = 'none';
  private scene: THREE.Scene | null = null;

  // Precipitation system
  private precipPoints: THREE.Points | null = null;
  private precipGeometry: THREE.BufferGeometry | null = null;
  private precipMaterial: THREE.ShaderMaterial | null = null;

  // Splash system (rain only)
  private splashPoints: THREE.Points | null = null;
  private splashGeometry: THREE.BufferGeometry | null = null;
  private splashMaterial: THREE.ShaderMaterial | null = null;
  private splashPositions: Float32Array | null = null;
  private splashAlphas: Float32Array | null = null;
  private splashSizes: Float32Array | null = null;
  private splashParticles: SplashParticle[] = [];

  // Transition state
  private transitionOpacity = 0;
  private fadingOut = false;
  private static readonly TRANSITION_DURATION = 2.0; // seconds

  // Auto-scheduling state
  private autoScheduleEnabled = false;
  private autoTimer = 0;
  private currentNightness = 0;

  // Wind
  private wind = new THREE.Vector2(0.5, 0.2);
  private elapsedTime = 0;

  // Particle counts
  private static readonly RAIN_COUNT = 2000;
  private static readonly SNOW_COUNT = 1200;
  private static readonly SPLASH_COUNT = 30;

  // Spawn box
  private static readonly SPAWN_WIDTH = 30;
  private static readonly SPAWN_HEIGHT = 15;

  addToScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /** Enable or disable automatic weather scheduling */
  setAutoSchedule(enabled: boolean): void {
    this.autoScheduleEnabled = enabled;
    if (enabled) {
      // Pick a random wait time before first weather event: 90–240s
      this.autoTimer = 90 + Math.random() * 150;
    } else if (this.weatherType !== 'none' || this.targetWeatherType !== 'none') {
      // Fade weather to none when disabling auto mode
      this.setWeatherInternal('none');
    }
  }

  /** Update cached nightness value for rain vs snow selection */
  setNightness(nightness: number): void {
    this.currentNightness = nightness;
  }

  setWeather(type: WeatherType): void {
    // Manual weather change disables auto-scheduling to avoid fighting the user
    if (this.autoScheduleEnabled) {
      this.autoScheduleEnabled = false;
    }
    this.setWeatherInternal(type);
  }

  private setWeatherInternal(type: WeatherType): void {
    if (type === this.targetWeatherType) return;
    this.targetWeatherType = type;

    if (this.weatherType === 'none') {
      // No current weather — create and fade in directly
      this.weatherType = type;
      if (type !== 'none') {
        this.createPrecipitation(type);
        this.fadingOut = false;
        // transitionOpacity starts at 0 and ramps up in update()
      }
    } else if (type === 'none') {
      // Fade out current weather
      this.fadingOut = true;
    } else {
      // Switching between rain/snow — fade out current first
      this.fadingOut = true;
    }
  }

  /** Update each frame — handles transitions, wind, and splash particles */
  update(deltaTime: number, cameraPosition: THREE.Vector3, frustum: number): void {
    this.elapsedTime += deltaTime;

    // Update wind with gentle variation
    this.wind.set(
      0.5 + Math.sin(this.elapsedTime * 0.1) * 0.3,
      0.2 + Math.cos(this.elapsedTime * 0.13) * 0.15,
    );

    // Handle transitions
    if (this.fadingOut) {
      this.transitionOpacity = Math.max(0, this.transitionOpacity - deltaTime / WeatherController.TRANSITION_DURATION);
      if (this.transitionOpacity <= 0) {
        this.fadingOut = false;
        this.disposePrecipitation();
        this.weatherType = this.targetWeatherType;
        if (this.weatherType !== 'none') {
          this.createPrecipitation(this.weatherType);
          // transitionOpacity is 0, will ramp up below
        }
      }
    } else if (this.weatherType !== 'none' && this.transitionOpacity < 1) {
      this.transitionOpacity = Math.min(1, this.transitionOpacity + deltaTime / WeatherController.TRANSITION_DURATION);
    }

    // Auto-scheduling logic
    if (this.autoScheduleEnabled) {
      this.autoTimer -= deltaTime;
      if (this.autoTimer <= 0) {
        if (this.weatherType === 'none' && !this.fadingOut && this.transitionOpacity <= 0) {
          // No weather active — start a random weather event
          const type: WeatherType = this.currentNightness > 0.5
            ? (Math.random() < 0.6 ? 'snow' : 'rain')
            : (Math.random() < 0.8 ? 'rain' : 'snow');
          this.setWeatherInternal(type);
          // Duration: 60–180s
          this.autoTimer = 60 + Math.random() * 120;
        } else if (this.weatherType !== 'none' && !this.fadingOut && this.transitionOpacity >= 1) {
          // Weather fully active — fade it out
          this.setWeatherInternal('none');
          // Gap before next event: 90–240s
          this.autoTimer = 90 + Math.random() * 150;
        }
      }
    }

    // Update precipitation uniforms
    if (this.precipMaterial) {
      this.precipMaterial.uniforms.uWind.value.copy(this.wind);
      this.precipMaterial.uniforms.uCamPos.value.copy(cameraPosition);
      this.precipMaterial.uniforms.uFrustum.value = frustum;
      this.precipMaterial.uniforms.uOpacity.value = this.transitionOpacity;
    }

    // Update splash particles (rain only)
    if (this.weatherType === 'rain' && this.splashGeometry && this.splashPositions && this.splashAlphas && this.splashSizes) {
      this.updateSplash(deltaTime, cameraPosition, frustum);
    }
  }

  /** Get the current weather type (reflects what's active, not what's pending) */
  getWeatherType(): WeatherType {
    return this.weatherType;
  }

  /** Get the display weather type (reflects target, for UI) */
  getTargetWeatherType(): WeatherType {
    return this.targetWeatherType;
  }

  /** Get current transition opacity (0-1) for atmosphere overlay */
  getTransitionOpacity(): number {
    return this.transitionOpacity;
  }

  /** Get current wind direction (normalized) for ambient renderers */
  getWindDirection(): THREE.Vector2 {
    return this.wind;
  }

  dispose(): void {
    this.disposePrecipitation();
    this.scene = null;
  }

  // ── Private Methods ──

  private createPrecipitation(type: WeatherType): void {
    if (!this.scene) return;

    const isRain = type === 'rain';
    const count = isRain ? WeatherController.RAIN_COUNT : WeatherController.SNOW_COUNT;

    // Create per-particle attributes (set once, never updated on CPU)
    const aSpeed = new Float32Array(count);
    const aPhase = new Float32Array(count);
    const aLocalXZ = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      aSpeed[i] = isRain ? 8 + Math.random() * 4 : 1 + Math.random();
      aPhase[i] = Math.random();
      aLocalXZ[i * 2] = Math.random() - 0.5;
      aLocalXZ[i * 2 + 1] = Math.random() - 0.5;
    }

    this.precipGeometry = new THREE.BufferGeometry();
    // Dummy position attribute (shader ignores it but Three.js requires it)
    this.precipGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.precipGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
    this.precipGeometry.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    this.precipGeometry.setAttribute('aLocalXZ', new THREE.BufferAttribute(aLocalXZ, 2));

    if (isRain) {
      this.precipMaterial = new THREE.ShaderMaterial({
        vertexShader: RAIN_VERTEX,
        fragmentShader: RAIN_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uWind: { value: this.wind.clone() },
          uCamPos: { value: new THREE.Vector3() },
          uFrustum: { value: 10 },
          uOpacity: { value: 0 },
          uSpawnWidth: { value: WeatherController.SPAWN_WIDTH },
          uSpawnHeight: { value: WeatherController.SPAWN_HEIGHT },
        },
      });
    } else {
      // Snow — needs aSize attribute
      const aSize = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        aSize[i] = 0.8 + Math.random() * 0.4;
      }
      this.precipGeometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));

      this.precipMaterial = new THREE.ShaderMaterial({
        vertexShader: SNOW_VERTEX,
        fragmentShader: SNOW_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        uniforms: {
          uTime: { value: 0 },
          uWind: { value: this.wind.clone() },
          uCamPos: { value: new THREE.Vector3() },
          uFrustum: { value: 10 },
          uOpacity: { value: 0 },
          uSpawnWidth: { value: WeatherController.SPAWN_WIDTH },
          uSpawnHeight: { value: WeatherController.SPAWN_HEIGHT },
        },
      });
    }

    // Register with ShaderTimeManager for automatic uTime updates
    shaderTimeManager.register(this.precipMaterial as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } });

    this.precipPoints = new THREE.Points(this.precipGeometry, this.precipMaterial);
    this.precipPoints.frustumCulled = false;
    this.scene.add(this.precipPoints);

    // Create splash system for rain
    if (isRain) {
      this.createSplashSystem();
    }
  }

  private createSplashSystem(): void {
    if (!this.scene) return;

    const count = WeatherController.SPLASH_COUNT;
    this.splashPositions = new Float32Array(count * 3);
    this.splashAlphas = new Float32Array(count);
    this.splashSizes = new Float32Array(count);
    this.splashParticles = [];

    for (let i = 0; i < count; i++) {
      this.splashParticles.push({ age: 999, lifetime: 0.3 }); // start expired
      this.splashAlphas[i] = 0;
      this.splashSizes[i] = 0;
    }

    this.splashGeometry = new THREE.BufferGeometry();
    this.splashGeometry.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3));
    this.splashGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.splashAlphas, 1));
    this.splashGeometry.setAttribute('aSplashSize', new THREE.BufferAttribute(this.splashSizes, 1));

    this.splashMaterial = new THREE.ShaderMaterial({
      vertexShader: SPLASH_VERTEX,
      fragmentShader: SPLASH_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uFrustum: { value: 10 },
      },
    });

    this.splashPoints = new THREE.Points(this.splashGeometry, this.splashMaterial);
    this.splashPoints.frustumCulled = false;
    this.scene.add(this.splashPoints);
  }

  private updateSplash(deltaTime: number, cameraPosition: THREE.Vector3, frustum: number): void {
    if (!this.splashPositions || !this.splashAlphas || !this.splashSizes || !this.splashGeometry || !this.splashMaterial) return;

    const count = WeatherController.SPLASH_COUNT;
    const halfWidth = WeatherController.SPAWN_WIDTH / 2;

    // Spawn 2-3 new splashes per frame
    const spawnCount = 2 + (Math.random() > 0.5 ? 1 : 0);
    let spawned = 0;

    for (let i = 0; i < count && spawned < spawnCount; i++) {
      const p = this.splashParticles[i];
      if (p.age >= p.lifetime) {
        // Respawn this particle
        const i3 = i * 3;
        this.splashPositions[i3] = cameraPosition.x + (Math.random() - 0.5) * halfWidth * 2;
        this.splashPositions[i3 + 1] = 0.01;
        this.splashPositions[i3 + 2] = cameraPosition.z + (Math.random() - 0.5) * halfWidth * 2;
        p.age = 0;
        p.lifetime = 0.25 + Math.random() * 0.1;
        spawned++;
      }
    }

    // Update all splash particles
    for (let i = 0; i < count; i++) {
      const p = this.splashParticles[i];
      p.age += deltaTime;
      const t = Math.min(p.age / p.lifetime, 1);

      if (t < 1) {
        // Expand from size 2 to 5, fade from 1 to 0
        this.splashAlphas[i] = (1 - t) * this.transitionOpacity;
        this.splashSizes[i] = 2.0 + t * 3.0;
      } else {
        this.splashAlphas[i] = 0;
        this.splashSizes[i] = 0;
      }
    }

    // Flag for GPU upload
    (this.splashGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.splashGeometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (this.splashGeometry.attributes.aSplashSize as THREE.BufferAttribute).needsUpdate = true;

    this.splashMaterial.uniforms.uFrustum.value = frustum;
  }

  private disposePrecipitation(): void {
    if (this.precipPoints && this.scene) {
      this.scene.remove(this.precipPoints);
    }
    if (this.precipMaterial) {
      shaderTimeManager.unregister(this.precipMaterial as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } });
      this.precipMaterial.dispose();
    }
    if (this.precipGeometry) {
      this.precipGeometry.dispose();
    }
    this.precipPoints = null;
    this.precipMaterial = null;
    this.precipGeometry = null;

    // Dispose splash system
    if (this.splashPoints && this.scene) {
      this.scene.remove(this.splashPoints);
    }
    if (this.splashMaterial) {
      this.splashMaterial.dispose();
    }
    if (this.splashGeometry) {
      this.splashGeometry.dispose();
    }
    this.splashPoints = null;
    this.splashMaterial = null;
    this.splashGeometry = null;
    this.splashPositions = null;
    this.splashAlphas = null;
    this.splashSizes = null;
    this.splashParticles = [];

    this.transitionOpacity = 0;
  }
}
