import * as THREE from 'three';
import type { Building } from '../game/Building';
import { BuildingState } from '../game/Building';
import { BuildingType } from '../game/BuildingType';
import { HexGrid } from '../game/HexGrid';
import { MapRenderer } from './MapRenderer';

/**
 * Effect type identifiers for different particle pools.
 */
export const ParticleEffect = {
  Smoke: 'smoke',
  Sparks: 'sparks',
  WoodChips: 'wood_chips',
  ConstructionDust: 'construction_dust',
  TreeDebris: 'tree_debris',
  CompletionFlash: 'completion_flash',
} as const;

export type ParticleEffect = (typeof ParticleEffect)[keyof typeof ParticleEffect];

/** Per-particle data stored in typed arrays */
interface ParticleData {
  /** World position XYZ */
  positions: Float32Array;
  /** Size per particle */
  sizes: Float32Array;
  /** Alpha (opacity) per particle */
  alphas: Float32Array;
  /** Color RGB per particle */
  colors: Float32Array;
  /** Velocity XYZ per particle */
  velocities: Float32Array;
  /** Remaining lifetime in seconds */
  lifetimes: Float32Array;
  /** Max lifetime (for alpha fade calculation) */
  maxLifetimes: Float32Array;
  /** Whether slot is active */
  active: Uint8Array;
  /** Per-particle gravity */
  gravity: Float32Array;
  /** Start color RGB per particle */
  colorStart: Float32Array;
  /** End color RGB per particle */
  colorEnd: Float32Array;
  /** Size start per particle */
  sizeStart: Float32Array;
  /** Size end per particle */
  sizeEnd: Float32Array;
}

/** Configuration for a particle emitter bound to a building */
interface EmitterConfig {
  effect: ParticleEffect;
  rate: number; // particles per second
  offsetY: number; // Y offset above building base
}

/** Map of building types to their emitter configurations */
const BUILDING_EMITTERS: Partial<Record<string, EmitterConfig[]>> = {
  [BuildingType.Bakery]: [{ effect: ParticleEffect.Smoke, rate: 3, offsetY: 0.5 }],
  [BuildingType.IronSmelter]: [
    { effect: ParticleEffect.Smoke, rate: 3, offsetY: 0.55 },
    { effect: ParticleEffect.Sparks, rate: 5, offsetY: 0.3 },
  ],
  [BuildingType.BlacksmithArmory]: [
    { effect: ParticleEffect.Smoke, rate: 2, offsetY: 0.5 },
    { effect: ParticleEffect.Sparks, rate: 5, offsetY: 0.25 },
  ],
  [BuildingType.GoldsmithMint]: [{ effect: ParticleEffect.Smoke, rate: 2, offsetY: 0.5 }],
  [BuildingType.Sawmill]: [{ effect: ParticleEffect.WoodChips, rate: 8, offsetY: 0.15 }],
};

/** Effect-specific particle properties */
interface EffectConfig {
  color: THREE.Color;
  colorEnd: THREE.Color;
  sizeStart: number;
  sizeEnd: number;
  lifetimeMin: number;
  lifetimeMax: number;
  velocityY: number;
  velocitySpread: number;
  gravity: number;
}

const EFFECT_CONFIGS: Record<string, EffectConfig> = {
  [ParticleEffect.Smoke]: {
    color: new THREE.Color(0.5, 0.5, 0.5),
    colorEnd: new THREE.Color(0.85, 0.85, 0.85),
    sizeStart: 3.0,
    sizeEnd: 6.0,
    lifetimeMin: 3.0,
    lifetimeMax: 5.0,
    velocityY: 0.15,
    velocitySpread: 0.02,
    gravity: 0,
  },
  [ParticleEffect.Sparks]: {
    color: new THREE.Color(1.0, 0.6, 0.1),
    colorEnd: new THREE.Color(1.0, 1.0, 0.3),
    sizeStart: 2.0,
    sizeEnd: 0.5,
    lifetimeMin: 0.5,
    lifetimeMax: 1.0,
    velocityY: 0.4,
    velocitySpread: 0.15,
    gravity: -0.5,
  },
  [ParticleEffect.WoodChips]: {
    color: new THREE.Color(0.76, 0.6, 0.35),
    colorEnd: new THREE.Color(0.76, 0.6, 0.35),
    sizeStart: 1.5,
    sizeEnd: 1.0,
    lifetimeMin: 0.3,
    lifetimeMax: 0.8,
    velocityY: 0.3,
    velocitySpread: 0.2,
    gravity: -0.8,
  },
  [ParticleEffect.ConstructionDust]: {
    color: new THREE.Color(0.82, 0.76, 0.62),
    colorEnd: new THREE.Color(0.82, 0.76, 0.62),
    sizeStart: 3.0,
    sizeEnd: 5.0,
    lifetimeMin: 1.0,
    lifetimeMax: 2.0,
    velocityY: 0.1,
    velocitySpread: 0.05,
    gravity: 0,
  },
  [ParticleEffect.TreeDebris]: {
    color: new THREE.Color(0.45, 0.3, 0.15),
    colorEnd: new THREE.Color(0.3, 0.5, 0.2),
    sizeStart: 2.0,
    sizeEnd: 1.0,
    lifetimeMin: 0.5,
    lifetimeMax: 1.0,
    velocityY: 0.5,
    velocitySpread: 0.25,
    gravity: -1.0,
  },
  [ParticleEffect.CompletionFlash]: {
    color: new THREE.Color(0.3, 1.0, 0.3),
    colorEnd: new THREE.Color(0.3, 1.0, 0.3),
    sizeStart: 4.0,
    sizeEnd: 1.0,
    lifetimeMin: 0.3,
    lifetimeMax: 0.5,
    velocityY: 0.6,
    velocitySpread: 0.3,
    gravity: -0.3,
  },
};

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  uniform float uFrustum;
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Scale point size inversely with ortho frustum (zoom level)
    gl_PointSize = aSize * (20.0 / uFrustum);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    // Soft circle falloff
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float softness = 1.0 - smoothstep(0.3, 0.5, d);
    gl_FragColor = vec4(vColor, vAlpha * softness);
  }
`;

/**
 * Pool-based particle system using THREE.Points for efficient rendering.
 * Single draw call per pool. Pre-allocated typed arrays with ring-buffer allocation.
 */
class ParticlePool {
  private maxParticles: number;
  private data: ParticleData;
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private nextSlot = 0;

  constructor(maxParticles: number) {
    this.maxParticles = maxParticles;

    this.data = {
      positions: new Float32Array(maxParticles * 3),
      sizes: new Float32Array(maxParticles),
      alphas: new Float32Array(maxParticles),
      colors: new Float32Array(maxParticles * 3),
      velocities: new Float32Array(maxParticles * 3),
      lifetimes: new Float32Array(maxParticles),
      maxLifetimes: new Float32Array(maxParticles),
      active: new Uint8Array(maxParticles),
      gravity: new Float32Array(maxParticles),
      colorStart: new Float32Array(maxParticles * 3),
      colorEnd: new Float32Array(maxParticles * 3),
      sizeStart: new Float32Array(maxParticles),
      sizeEnd: new Float32Array(maxParticles),
    };

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.data.positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.data.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.data.alphas, 1));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.data.colors, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uFrustum: { value: 10.0 },
      },
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
  }

  getObject(): THREE.Points {
    return this.points;
  }

  /** Update the frustum uniform so particle sizes scale with ortho zoom */
  setFrustum(frustum: number): void {
    const mat = this.points.material as THREE.ShaderMaterial;
    mat.uniforms.uFrustum.value = frustum;
  }

  /** Emit a single particle at the given world position */
  emit(x: number, y: number, z: number, config: EffectConfig): void {
    const i = this.nextSlot;
    this.nextSlot = (this.nextSlot + 1) % this.maxParticles;

    const i3 = i * 3;
    this.data.positions[i3] = x;
    this.data.positions[i3 + 1] = y;
    this.data.positions[i3 + 2] = z;

    const vSpread = config.velocitySpread;
    this.data.velocities[i3] = (Math.random() - 0.5) * vSpread * 2;
    this.data.velocities[i3 + 1] = config.velocityY + (Math.random() - 0.5) * vSpread;
    this.data.velocities[i3 + 2] = (Math.random() - 0.5) * vSpread * 2;

    this.data.colors[i3] = config.color.r;
    this.data.colors[i3 + 1] = config.color.g;
    this.data.colors[i3 + 2] = config.color.b;

    this.data.colorStart[i3] = config.color.r;
    this.data.colorStart[i3 + 1] = config.color.g;
    this.data.colorStart[i3 + 2] = config.color.b;
    this.data.colorEnd[i3] = config.colorEnd.r;
    this.data.colorEnd[i3 + 1] = config.colorEnd.g;
    this.data.colorEnd[i3 + 2] = config.colorEnd.b;

    const lifetime = config.lifetimeMin + Math.random() * (config.lifetimeMax - config.lifetimeMin);
    this.data.lifetimes[i] = lifetime;
    this.data.maxLifetimes[i] = lifetime;
    this.data.sizes[i] = config.sizeStart;
    this.data.sizeStart[i] = config.sizeStart;
    this.data.sizeEnd[i] = config.sizeEnd;
    this.data.gravity[i] = config.gravity;
    this.data.alphas[i] = 1.0;
    this.data.active[i] = 1;
  }

  /** Update all active particles */
  update(deltaTime: number): void {
    let anyActive = false;

    for (let i = 0; i < this.maxParticles; i++) {
      if (!this.data.active[i]) continue;

      this.data.lifetimes[i] -= deltaTime;
      if (this.data.lifetimes[i] <= 0) {
        this.data.active[i] = 0;
        this.data.alphas[i] = 0;
        this.data.sizes[i] = 0;
        continue;
      }

      anyActive = true;
      const i3 = i * 3;
      const t = 1.0 - this.data.lifetimes[i] / this.data.maxLifetimes[i]; // 0→1

      // Position update
      this.data.positions[i3] += this.data.velocities[i3] * deltaTime;
      this.data.positions[i3 + 1] += this.data.velocities[i3 + 1] * deltaTime;
      this.data.positions[i3 + 2] += this.data.velocities[i3 + 2] * deltaTime;

      // Per-particle gravity
      this.data.velocities[i3 + 1] += this.data.gravity[i] * deltaTime;

      // Alpha fade out in last 30% of lifetime
      this.data.alphas[i] = t > 0.7 ? 1.0 - (t - 0.7) / 0.3 : 1.0;

      // Size interpolation
      this.data.sizes[i] = this.data.sizeStart[i] + (this.data.sizeEnd[i] - this.data.sizeStart[i]) * t;

      // Color interpolation — blend from start to end color
      this.data.colors[i3] = this.data.colorStart[i3] + (this.data.colorEnd[i3] - this.data.colorStart[i3]) * t;
      this.data.colors[i3 + 1] = this.data.colorStart[i3 + 1] + (this.data.colorEnd[i3 + 1] - this.data.colorStart[i3 + 1]) * t;
      this.data.colors[i3 + 2] = this.data.colorStart[i3 + 2] + (this.data.colorEnd[i3 + 2] - this.data.colorStart[i3 + 2]) * t;
    }

    // Update GPU buffers
    if (anyActive) {
      (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (this.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
      (this.geometry.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.points.removeFromParent();
  }
}

/**
 * Manages particle effects for the entire game.
 * Binds emitters to buildings and spawns particles based on building state.
 */
export class ParticleSystem {
  private pool: ParticlePool;
  /** Accumulator per building emitter: buildingId_effectIndex → seconds since last emit */
  private emitterAccumulators: Map<string, number> = new Map();

  constructor() {
    this.pool = new ParticlePool(800);
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.pool.getObject());
  }

  /**
   * Update particles and emit new ones from active building emitters.
   * Call each frame from Game.ts animate loop.
   */
  update(
    deltaTime: number,
    buildings: readonly Building[],
    grid: HexGrid,
    frustum?: number,
  ): void {
    if (frustum !== undefined) {
      this.pool.setFrustum(frustum);
    }
    // Emit particles for active producing buildings
    for (const building of buildings) {
      const emitters = BUILDING_EMITTERS[building.type];
      if (!emitters) continue;

      const isProducing = building.state === BuildingState.Active && building.productionProgress > 0;
      const isConstructing = building.state === BuildingState.UnderConstruction;

      if (!isProducing && !isConstructing) continue;

      const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
      const tile = grid.getTile(building.coord.q, building.coord.r);
      const baseY = tile ? MapRenderer.getTileY(tile) : 0;

      for (let ei = 0; ei < emitters.length; ei++) {
        const emitter = emitters[ei];
        if (!isProducing && emitter.effect !== ParticleEffect.ConstructionDust) continue;

        const config = EFFECT_CONFIGS[emitter.effect];
        if (!config) continue;

        const key = `${building.id}_${ei}`;
        const acc = (this.emitterAccumulators.get(key) ?? 0) + deltaTime;
        const interval = 1.0 / emitter.rate;

        if (acc >= interval) {
          this.emitterAccumulators.set(key, acc - interval);
          this.pool.emit(
            x + (Math.random() - 0.5) * 0.1,
            baseY + emitter.offsetY,
            z + (Math.random() - 0.5) * 0.1,
            config,
          );
        } else {
          this.emitterAccumulators.set(key, acc);
        }
      }
    }

    // Emit construction dust for buildings under construction
    for (const building of buildings) {
      if (building.state !== BuildingState.UnderConstruction) continue;
      if (!building.hasWorker) continue;

      const key = `${building.id}_construction`;
      const acc = (this.emitterAccumulators.get(key) ?? 0) + deltaTime;
      const interval = 0.25; // 4/s

      if (acc >= interval) {
        this.emitterAccumulators.set(key, acc - interval);
        const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
        const tile = grid.getTile(building.coord.q, building.coord.r);
        const baseY = tile ? MapRenderer.getTileY(tile) : 0;
        this.pool.emit(
          x + (Math.random() - 0.5) * 0.3,
          baseY + 0.1,
          z + (Math.random() - 0.5) * 0.3,
          EFFECT_CONFIGS[ParticleEffect.ConstructionDust],
        );
      } else {
        this.emitterAccumulators.set(key, acc);
      }
    }

    this.pool.update(deltaTime);
  }

  /** Emit a burst of particles at a world position (for one-shot events) */
  emitBurst(
    x: number, y: number, z: number,
    effect: ParticleEffect,
    count: number,
  ): void {
    const config = EFFECT_CONFIGS[effect];
    if (!config) return;
    for (let i = 0; i < count; i++) {
      this.pool.emit(
        x + (Math.random() - 0.5) * 0.2,
        y,
        z + (Math.random() - 0.5) * 0.2,
        config,
      );
    }
  }

  dispose(): void {
    this.pool.dispose();
    this.emitterAccumulators.clear();
  }
}
