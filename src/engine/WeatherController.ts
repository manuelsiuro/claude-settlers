import * as THREE from 'three';

export const WeatherType = {
  None: 'none',
  Rain: 'rain',
  Snow: 'snow',
} as const;

export type WeatherType = (typeof WeatherType)[keyof typeof WeatherType];

/**
 * Weather effects system with its own particle pool (separate from ParticleSystem).
 * Renders rain or snow using THREE.Points with 2000-particle budget.
 * Particles spawn in a box above the camera and fall downward, recycling when they
 * drop below Y=0.
 */
export class WeatherController {
  private weatherType: WeatherType = 'none';
  private points: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.PointsMaterial | null = null;
  private positions: Float32Array;
  private velocities: Float32Array;
  /** Per-particle phase offset for snow sine drift */
  private phases: Float32Array;
  private particleCount = 2000;
  private scene: THREE.Scene | null = null;
  private elapsedTime = 0;

  /** Spawn box dimensions */
  private static readonly SPAWN_WIDTH = 30;
  private static readonly SPAWN_HEIGHT_MIN = 10;
  private static readonly SPAWN_HEIGHT_MAX = 15;

  constructor() {
    this.positions = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount * 3);
    this.phases = new Float32Array(this.particleCount);

    // Initialize phase offsets for snow drift
    for (let i = 0; i < this.particleCount; i++) {
      this.phases[i] = Math.random() * Math.PI * 2;
    }
  }

  addToScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  setWeather(type: WeatherType): void {
    if (type === this.weatherType) return;

    // Remove existing points from scene
    if (this.points && this.scene) {
      this.scene.remove(this.points);
    }
    this.disposeGeometry();

    this.weatherType = type;

    if (type === 'none') {
      this.points = null;
      return;
    }

    // Create geometry with position attribute
    this.geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.geometry.setAttribute('position', posAttr);

    // Configure material based on weather type
    if (type === 'rain') {
      this.material = new THREE.PointsMaterial({
        color: 0xaaccff, // blue-white
        size: 0.03,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    } else {
      // Snow
      this.material = new THREE.PointsMaterial({
        color: 0xffffff, // white
        size: 0.06,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
    }

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;

    // Initialize all particles at random positions (spread out so they don't all
    // appear at the top simultaneously)
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      this.positions[i3] = (Math.random() - 0.5) * WeatherController.SPAWN_WIDTH;
      this.positions[i3 + 1] = Math.random() * WeatherController.SPAWN_HEIGHT_MAX;
      this.positions[i3 + 2] = (Math.random() - 0.5) * WeatherController.SPAWN_WIDTH;

      this.initVelocity(i, type);
    }

    posAttr.needsUpdate = true;

    if (this.scene) {
      this.scene.add(this.points);
    }
  }

  /** Initialize velocity for particle i based on weather type */
  private initVelocity(i: number, type: WeatherType): void {
    const i3 = i * 3;
    if (type === 'rain') {
      this.velocities[i3] = 0; // no X drift
      this.velocities[i3 + 1] = -(8 + Math.random() * 4); // Y: -8 to -12
      this.velocities[i3 + 2] = 0; // no Z drift
    } else {
      // Snow
      this.velocities[i3] = 0; // X drift handled by sine wave in update
      this.velocities[i3 + 1] = -(1 + Math.random()); // Y: -1 to -2
      this.velocities[i3 + 2] = 0; // Z drift handled by sine wave in update
    }
  }

  /** Update each frame — moves particles, recycles ones below ground */
  update(deltaTime: number, cameraPosition: THREE.Vector3): void {
    if (this.weatherType === 'none' || !this.points || !this.geometry) return;

    this.elapsedTime += deltaTime;

    const halfWidth = WeatherController.SPAWN_WIDTH / 2;
    const camX = cameraPosition.x;
    const camZ = cameraPosition.z;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Move particle
      if (this.weatherType === 'snow') {
        // Snow has sine-wave horizontal drift
        const drift = Math.sin(this.elapsedTime + this.phases[i]) * 0.5;
        this.positions[i3] += drift * deltaTime;
        this.positions[i3 + 2] += Math.cos(this.elapsedTime * 0.7 + this.phases[i]) * 0.3 * deltaTime;
      }

      this.positions[i3] += this.velocities[i3] * deltaTime;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * deltaTime;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * deltaTime;

      // Recycle particle if below ground
      if (this.positions[i3 + 1] < 0) {
        this.positions[i3] = camX + (Math.random() - 0.5) * WeatherController.SPAWN_WIDTH;
        this.positions[i3 + 1] =
          WeatherController.SPAWN_HEIGHT_MIN +
          Math.random() * (WeatherController.SPAWN_HEIGHT_MAX - WeatherController.SPAWN_HEIGHT_MIN);
        this.positions[i3 + 2] = camZ + (Math.random() - 0.5) * WeatherController.SPAWN_WIDTH;

        this.initVelocity(i, this.weatherType);
      }

      // Keep particles within spawn box horizontally (re-center on camera)
      if (this.positions[i3] < camX - halfWidth || this.positions[i3] > camX + halfWidth) {
        this.positions[i3] = camX + (Math.random() - 0.5) * WeatherController.SPAWN_WIDTH;
      }
      if (this.positions[i3 + 2] < camZ - halfWidth || this.positions[i3 + 2] > camZ + halfWidth) {
        this.positions[i3 + 2] = camZ + (Math.random() - 0.5) * WeatherController.SPAWN_WIDTH;
      }
    }

    // Flag position buffer for GPU upload
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Get the current weather type */
  getWeatherType(): WeatherType {
    return this.weatherType;
  }

  dispose(): void {
    if (this.points && this.scene) {
      this.scene.remove(this.points);
    }
    this.disposeGeometry();
    this.points = null;
    this.scene = null;
  }

  private disposeGeometry(): void {
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
  }
}
