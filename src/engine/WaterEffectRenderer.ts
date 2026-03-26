import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import { shaderTimeManager } from './ShaderTimeManager';

// ── Shaders ──

const SPARKLE_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uFrustum;
  attribute float aLifetime;
  attribute float aMaxLifetime;
  attribute float aPhase;
  varying float vAlpha;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    // Compute normalized lifetime progress (0 = just spawned, 1 = expired)
    float progress = aLifetime / aMaxLifetime;

    // Pulse: fade in quickly, hold bright, fade out
    // 0..0.15 = fade in, 0.15..0.7 = bright, 0.7..1.0 = fade out
    float fadeIn = smoothstep(0.0, 0.15, progress);
    float fadeOut = 1.0 - smoothstep(0.7, 1.0, progress);
    vAlpha = fadeIn * fadeOut;

    // Add a subtle twinkle flicker
    float twinkle = 0.8 + 0.2 * sin(uTime * 12.0 + aPhase * 6.28);
    vAlpha *= twinkle;

    // Scale point size by frustum (smaller when zoomed out)
    gl_PointSize = (3.0 + sin(aPhase * 6.28) * 1.5) * (10.0 / uFrustum);
  }
`;

const SPARKLE_FRAGMENT = /* glsl */ `
  varying float vAlpha;

  void main() {
    // Soft radial falloff for a glowing dot
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float dist = length(uv);
    float glow = 1.0 - smoothstep(0.0, 1.0, dist);
    // Sharpen the center for a bright sparkle core
    float core = 1.0 - smoothstep(0.0, 0.3, dist);
    float brightness = mix(glow * 0.5, 1.0, core);

    if (brightness < 0.01 || vAlpha < 0.01) discard;

    // Bright white with slight warm tint
    vec3 color = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 1.0, 1.0), core);
    gl_FragColor = vec4(color, brightness * vAlpha);
  }
`;

// ── Per-sparkle state ──

interface SparkleData {
  x: number;
  y: number;
  z: number;
  lifetime: number;
  maxLifetime: number;
  phase: number;
  active: boolean;
}

/**
 * Renders sun sparkle points on water tiles.
 * Bright white dots that flash briefly, creating a shimmering water surface effect.
 * Spawn rate scales with sun angle (more at dawn/golden hour, none at night).
 * Disabled on mobile for performance.
 */
export class WaterEffectRenderer {
  private sparklePoints: THREE.Points | null = null;
  private sparkleGeometry: THREE.BufferGeometry | null = null;
  private sparkleMaterial: THREE.ShaderMaterial | null = null;
  private waterPositions: { x: number; z: number }[] = [];
  private sparkles: SparkleData[] = [];
  private nightness = 0;
  private enabled = true;
  private maxSparkles: number;

  // Reusable buffers to avoid per-frame allocations
  private positionArray: Float32Array | null = null;
  private lifetimeArray: Float32Array | null = null;
  private maxLifetimeArray: Float32Array | null = null;
  private phaseArray: Float32Array | null = null;

  constructor(maxSparkles = 60) {
    // Disable on mobile
    const isMobile = window.innerWidth <= 768;
    this.maxSparkles = isMobile ? 0 : maxSparkles;
  }

  /** Add sparkle points to the scene */
  addToScene(scene: THREE.Scene): void {
    if (this.maxSparkles === 0) return;

    const count = this.maxSparkles;

    // Create buffer geometry with attributes
    this.sparkleGeometry = new THREE.BufferGeometry();
    this.positionArray = new Float32Array(count * 3);
    this.lifetimeArray = new Float32Array(count);
    this.maxLifetimeArray = new Float32Array(count);
    this.phaseArray = new Float32Array(count);

    this.sparkleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positionArray, 3),
    );
    this.sparkleGeometry.setAttribute(
      'aLifetime',
      new THREE.BufferAttribute(this.lifetimeArray, 1),
    );
    this.sparkleGeometry.setAttribute(
      'aMaxLifetime',
      new THREE.BufferAttribute(this.maxLifetimeArray, 1),
    );
    this.sparkleGeometry.setAttribute(
      'aPhase',
      new THREE.BufferAttribute(this.phaseArray, 1),
    );

    // Create shader material
    this.sparkleMaterial = new THREE.ShaderMaterial({
      vertexShader: SPARKLE_VERTEX,
      fragmentShader: SPARKLE_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uFrustum: { value: 10 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Register uTime with ShaderTimeManager for automatic updates
    shaderTimeManager.register(
      this.sparkleMaterial as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } },
    );

    this.sparklePoints = new THREE.Points(this.sparkleGeometry, this.sparkleMaterial);
    this.sparklePoints.frustumCulled = false;
    this.sparklePoints.name = 'water_sparkles';
    this.sparklePoints.renderOrder = 800;

    // Initialize sparkle data (all inactive, will spawn on first update)
    this.sparkles = [];
    for (let i = 0; i < count; i++) {
      this.sparkles.push({
        x: 0,
        y: -100, // Off-screen until activated
        z: 0,
        lifetime: 0,
        maxLifetime: 0.5,
        phase: Math.random(),
        active: false,
      });
    }

    // Write initial buffer data
    this.syncBuffers();

    scene.add(this.sparklePoints);
  }

  /** Cache world positions of all water tiles for sparkle placement */
  initWaterPositions(grid: HexGrid): void {
    this.waterPositions = [];
    const tiles = grid.getAllTiles();
    for (const tile of tiles) {
      if (tile.terrain === TerrainType.Water) {
        const { x, z } = HexGrid.hexToWorld(tile.coord.q, tile.coord.r);
        this.waterPositions.push({ x, z });
      }
    }
  }

  setNightness(nightness: number): void {
    this.nightness = nightness;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.sparklePoints) this.sparklePoints.visible = enabled;
  }

  update(deltaTime: number, cameraPosition: THREE.Vector3, frustum: number): void {
    if (!this.enabled || !this.sparklePoints || !this.sparkleMaterial) return;
    if (this.maxSparkles === 0 || this.waterPositions.length === 0) return;

    // Update frustum uniform (uTime is managed by ShaderTimeManager)
    this.sparkleMaterial.uniforms.uFrustum.value = frustum;

    // Determine spawn rate based on nightness
    // At night (nightness > 0.5), no new sparkles spawn
    const spawnChance = this.nightness > 0.5 ? 0 : (1 - this.nightness * 1.5);

    // Find water tiles near camera (within 15 hex units)
    const nearbyWater = this.getNearbyWaterPositions(cameraPosition, 15);
    if (nearbyWater.length === 0) {
      // Hide all sparkles if no water nearby
      for (const sparkle of this.sparkles) {
        sparkle.active = false;
        sparkle.y = -100;
      }
      this.syncBuffers();
      return;
    }

    // Update existing sparkles and respawn expired ones
    let hasActiveSparkles = false;
    for (let i = 0; i < this.sparkles.length; i++) {
      const sparkle = this.sparkles[i];

      if (sparkle.active) {
        sparkle.lifetime += deltaTime;
        if (sparkle.lifetime >= sparkle.maxLifetime) {
          // Expired — try to respawn
          if (spawnChance > 0 && Math.random() < spawnChance) {
            this.respawnSparkle(sparkle, nearbyWater);
          } else {
            sparkle.active = false;
            sparkle.y = -100;
          }
        }
        hasActiveSparkles = true;
      } else {
        // Inactive sparkle — try to spawn
        if (spawnChance > 0 && Math.random() < spawnChance * deltaTime * 3) {
          this.respawnSparkle(sparkle, nearbyWater);
          hasActiveSparkles = true;
        }
      }
    }

    if (hasActiveSparkles) {
      this.syncBuffers();
    }
  }

  dispose(): void {
    if (this.sparklePoints) {
      this.sparklePoints.removeFromParent();
      this.sparklePoints = null;
    }
    if (this.sparkleGeometry) {
      this.sparkleGeometry.dispose();
      this.sparkleGeometry = null;
    }
    if (this.sparkleMaterial) {
      shaderTimeManager.unregister(
        this.sparkleMaterial as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } },
      );
      this.sparkleMaterial.dispose();
      this.sparkleMaterial = null;
    }
    this.sparkles = [];
    this.waterPositions = [];
    this.positionArray = null;
    this.lifetimeArray = null;
    this.maxLifetimeArray = null;
    this.phaseArray = null;
  }

  // ── Private Methods ──

  /** Get water tile positions within range of camera */
  private getNearbyWaterPositions(
    cameraPosition: THREE.Vector3,
    range: number,
  ): { x: number; z: number }[] {
    const rangeSq = range * range;
    const cx = cameraPosition.x;
    const cz = cameraPosition.z;
    const result: { x: number; z: number }[] = [];

    for (const wp of this.waterPositions) {
      const dx = wp.x - cx;
      const dz = wp.z - cz;
      if (dx * dx + dz * dz <= rangeSq) {
        result.push(wp);
      }
    }
    return result;
  }

  /** Respawn a sparkle at a random nearby water tile */
  private respawnSparkle(
    sparkle: SparkleData,
    nearbyWater: { x: number; z: number }[],
  ): void {
    const tile = nearbyWater[Math.floor(Math.random() * nearbyWater.length)];
    // Add slight random offset within the hex tile
    sparkle.x = tile.x + (Math.random() - 0.5) * 0.8;
    sparkle.y = -0.05 + Math.random() * 0.05; // Just above water surface (water Y = -0.1)
    sparkle.z = tile.z + (Math.random() - 0.5) * 0.8;
    sparkle.lifetime = 0;
    sparkle.maxLifetime = 0.3 + Math.random() * 0.5; // 0.3 to 0.8 seconds
    sparkle.phase = Math.random();
    sparkle.active = true;
  }

  /** Sync sparkle data into GPU buffer attributes */
  private syncBuffers(): void {
    if (
      !this.positionArray ||
      !this.lifetimeArray ||
      !this.maxLifetimeArray ||
      !this.phaseArray ||
      !this.sparkleGeometry
    ) {
      return;
    }

    for (let i = 0; i < this.sparkles.length; i++) {
      const s = this.sparkles[i];
      this.positionArray[i * 3] = s.x;
      this.positionArray[i * 3 + 1] = s.y;
      this.positionArray[i * 3 + 2] = s.z;
      this.lifetimeArray[i] = s.lifetime;
      this.maxLifetimeArray[i] = s.maxLifetime;
      this.phaseArray[i] = s.phase;
    }

    const posAttr = this.sparkleGeometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    const ltAttr = this.sparkleGeometry.getAttribute('aLifetime') as THREE.BufferAttribute;
    ltAttr.needsUpdate = true;
    const mltAttr = this.sparkleGeometry.getAttribute('aMaxLifetime') as THREE.BufferAttribute;
    mltAttr.needsUpdate = true;
    const phAttr = this.sparkleGeometry.getAttribute('aPhase') as THREE.BufferAttribute;
    phAttr.needsUpdate = true;
  }
}
