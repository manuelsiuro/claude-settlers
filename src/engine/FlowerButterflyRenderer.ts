import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import { MapRenderer } from './MapRenderer';
import { shaderTimeManager } from './ShaderTimeManager';
import { createRng } from '../game/noise';

// ── Shaders ──

const BUTTERFLY_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uFrustum;
  uniform float uNightness;
  uniform vec2 uWindDir;
  attribute vec3 aHome;
  attribute float aPhase;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Wander offset from home position using sine waves
    float t = uTime * 0.8 + aPhase;
    vec3 pos = aHome + vec3(
      sin(t * 1.1) * 0.5 + sin(t * 0.3 + aPhase) * 0.3 + uWindDir.x * uTime * 0.05,
      0.2 + sin(t * 1.5 + aPhase * 3.0) * 0.15 + abs(sin(t * 0.7)) * 0.1,
      cos(t * 0.9 + aPhase * 2.0) * 0.5 + sin(t * 0.4) * 0.3 + uWindDir.y * uTime * 0.05
    );
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    // Wing flap via point size oscillation
    float wingFlap = 3.0 + sin(uTime * 12.0 + aPhase * 5.0) * 1.5;
    gl_PointSize = wingFlap * (8.0 / uFrustum);
    // Daytime only: fade out when nightness > 0.3
    vAlpha = smoothstep(0.5, 0.3, uNightness);
    vColor = aColor;
  }
`;

const BUTTERFLY_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    // Draw butterfly shape: two wing lobes
    float leftWing = length(uv - vec2(-0.35, 0.0));
    float rightWing = length(uv - vec2(0.35, 0.0));
    float body = abs(uv.x) < 0.08 ? 0.0 : 1.0;
    float wing = min(leftWing, rightWing);
    float shape = 1.0 - smoothstep(0.25, 0.45, wing);
    shape = max(shape, 1.0 - smoothstep(0.0, 0.1, abs(uv.x)) * (1.0 - step(abs(uv.y), 0.4)));
    if (shape < 0.1 || vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, shape * vAlpha * 0.9);
  }
`;

// ── Butterfly colors ──

const BUTTERFLY_COLORS: [number, number, number][] = [
  [1.0, 1.0, 1.0],     // White
  [1.0, 0.95, 0.4],    // Yellow
  [0.6, 0.85, 1.0],    // Light blue
  [1.0, 0.65, 0.3],    // Orange
];

// ── Renderer ──

/**
 * Renders ambient butterflies near grassland tile positions.
 * Uses THREE.Points with custom vertex/fragment shaders for GPU-driven
 * wandering and wing flap animation. Butterflies are daytime-only,
 * fading out when nightness exceeds 0.3.
 */
export class FlowerButterflyRenderer {
  private points: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private enabled = true;
  private maxButterflies: number;

  constructor(maxButterflies = 25) {
    this.maxButterflies = maxButterflies;
  }

  addToScene(scene: THREE.Scene, grid: HexGrid): void {
    // Detect mobile — reduce butterfly count
    const isMobile = window.innerWidth <= 768;
    const count = isMobile ? Math.min(this.maxButterflies, 15) : this.maxButterflies;

    // Collect candidate grassland tile world positions
    const homePositions = this.findGrasslandPositions(grid, count);
    if (homePositions.length === 0) return;

    this.createGeometry(homePositions);
    if (this.points) {
      scene.add(this.points);
    }
  }

  setNightness(nightness: number): void {
    if (this.material) {
      this.material.uniforms.uNightness.value = nightness;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.points) {
      this.points.visible = enabled;
    }
  }

  update(_deltaTime: number, _cameraPosition: THREE.Vector3, frustum: number): void {
    if (!this.enabled || !this.material) return;
    this.material.uniforms.uFrustum.value = frustum;
  }

  dispose(): void {
    if (this.points) {
      this.points.removeFromParent();
    }
    if (this.material) {
      shaderTimeManager.unregister(
        this.material as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } },
      );
      this.material.dispose();
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    this.points = null;
    this.material = null;
    this.geometry = null;
  }

  // ── Private Methods ──

  /**
   * Find random grassland tile positions to anchor butterflies near.
   * Uses seeded RNG for deterministic placement across sessions.
   */
  private findGrasslandPositions(
    grid: HexGrid,
    count: number,
  ): THREE.Vector3[] {
    const rng = createRng(7777); // Deterministic seed for butterflies
    const tiles = grid.getAllTiles();
    const grasslandTiles = tiles.filter((t) => t.terrain === TerrainType.Grassland);

    if (grasslandTiles.length === 0) return [];

    // Shuffle grassland tiles deterministically
    for (let i = grasslandTiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [grasslandTiles[i], grasslandTiles[j]] = [grasslandTiles[j], grasslandTiles[i]];
    }

    const positions: THREE.Vector3[] = [];
    const numPositions = Math.min(count, grasslandTiles.length);

    for (let i = 0; i < numPositions; i++) {
      const tile = grasslandTiles[i];
      const { x, z } = HexGrid.hexToWorld(tile.coord.q, tile.coord.r);
      const y = MapRenderer.getTileY(tile);
      // Small random offset within hex
      positions.push(new THREE.Vector3(
        x + (rng() - 0.5) * 0.6,
        y + 0.15, // Slightly above ground
        z + (rng() - 0.5) * 0.6,
      ));
    }

    return positions;
  }

  private createGeometry(homePositions: THREE.Vector3[]): void {
    const count = homePositions.length;
    if (count === 0) return;

    const positions = new Float32Array(count * 3); // Dummy positions required by Three.js
    const aHome = new Float32Array(count * 3);
    const aPhase = new Float32Array(count);
    const aColor = new Float32Array(count * 3);

    const rng = createRng(8888); // Separate seed for attributes

    for (let i = 0; i < count; i++) {
      const home = homePositions[i];
      aHome[i * 3] = home.x;
      aHome[i * 3 + 1] = home.y;
      aHome[i * 3 + 2] = home.z;

      aPhase[i] = rng() * Math.PI * 2;

      // Pick a random butterfly color
      const colorIdx = Math.floor(rng() * BUTTERFLY_COLORS.length);
      const [r, g, b] = BUTTERFLY_COLORS[colorIdx];
      aColor[i * 3] = r;
      aColor[i * 3 + 1] = g;
      aColor[i * 3 + 2] = b;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aHome', new THREE.BufferAttribute(aHome, 3));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));

    // Wind direction (normalized)
    const windDir = new THREE.Vector2(1.0, 0.3).normalize();

    this.material = new THREE.ShaderMaterial({
      vertexShader: BUTTERFLY_VERTEX,
      fragmentShader: BUTTERFLY_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uFrustum: { value: 10 },
        uNightness: { value: 0 },
        uWindDir: { value: windDir },
      },
    });

    // Register uTime with ShaderTimeManager for automatic updates
    shaderTimeManager.register(
      this.material as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } },
    );

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }
}
