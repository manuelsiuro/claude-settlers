import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { Flag } from '../game/RoadNetwork';
import type { Building } from '../game/Building';
import { BuildingState } from '../game/Building';
import { MapRenderer } from './MapRenderer';

/** Lantern sits at top of flag pole */
const LANTERN_Y_OFFSET = 0.6;

/** Ground glow Y offset above terrain to prevent z-fighting */
const GLOW_Y_OFFSET = 0.03;

/** Max instanced lanterns/glow sprites */
const MAX_INSTANCES = 500;

/**
 * Renders warm lantern glows atop flag poles and ground light pools at night.
 * Uses 2 InstancedMesh draw calls (lanterns + ground glow) — no PointLights.
 * Also applies a subtle warm emissive tint to active buildings at night.
 */
export class FlagLightSystem {
  private lanternPool: THREE.InstancedMesh;
  private lanternMaterial: THREE.MeshStandardMaterial;
  private groundGlow: THREE.InstancedMesh;
  private groundMaterial: THREE.MeshBasicMaterial;
  private glowTexture: THREE.Texture;
  private nightness = 0;
  private elapsedTime = 0;

  // Reusable matrix to avoid per-frame allocations
  private readonly _matrix = new THREE.Matrix4();

  constructor() {
    // Lantern: tiny emissive cube
    this.lanternMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: new THREE.Color(1.0, 0.7, 0.3),
      emissiveIntensity: 0,
      transparent: true,
      depthWrite: false,
    });

    const lanternGeom = new THREE.BoxGeometry(1, 1, 1);
    this.lanternPool = new THREE.InstancedMesh(lanternGeom, this.lanternMaterial, MAX_INSTANCES);
    this.lanternPool.count = 0;
    this.lanternPool.frustumCulled = false;
    this.lanternPool.name = 'flag_lanterns';

    // Ground glow: radial gradient plane with additive blending
    this.glowTexture = this.createGlowTexture();
    this.groundMaterial = new THREE.MeshBasicMaterial({
      map: this.glowTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const glowGeom = new THREE.PlaneGeometry(1, 1);
    glowGeom.rotateX(-Math.PI / 2);
    this.groundGlow = new THREE.InstancedMesh(glowGeom, this.groundMaterial, MAX_INSTANCES);
    this.groundGlow.count = 0;
    this.groundGlow.frustumCulled = false;
    this.groundGlow.name = 'flag_ground_glow';
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.lanternPool);
    scene.add(this.groundGlow);
  }

  setNightness(value: number): void {
    this.nightness = value;
  }

  update(
    deltaTime: number,
    flags: readonly Flag[],
    buildings: readonly Building[],
    grid: HexGrid,
    getMesh: (id: string) => THREE.Group | undefined,
  ): void {
    this.elapsedTime += deltaTime;

    if (this.nightness < 0.01) {
      // Daytime — hide everything and reset building emissive
      this.lanternPool.count = 0;
      this.groundGlow.count = 0;
      this.resetBuildingEmissive(buildings, getMesh);
      return;
    }

    // Update material intensities driven by nightness
    this.lanternMaterial.emissiveIntensity = this.nightness * 3.0;
    this.groundMaterial.opacity = this.nightness * 0.5;

    const matrix = this._matrix;
    const t = this.elapsedTime;
    let idx = 0;

    for (const flag of flags) {
      if (idx >= MAX_INSTANCES) break;

      const { x, z } = HexGrid.hexToWorld(flag.coord.q, flag.coord.r);
      const tile = grid.getTile(flag.coord.q, flag.coord.r);
      const groundY = tile ? MapRenderer.getTileY(tile) : 0;

      // Lantern atop flag pole with flicker
      const phase = (flag.coord.q * 7 + flag.coord.r * 13) % 100;
      const flicker = 0.85 + 0.15 * Math.sin(t * 8 + phase) * Math.sin(t * 13 + phase * 1.7);
      const size = 0.06 * flicker;
      matrix.makeScale(size, size, size);
      matrix.setPosition(x, groundY + LANTERN_Y_OFFSET, z);
      this.lanternPool.setMatrixAt(idx, matrix);

      // Ground glow beneath flag
      matrix.makeScale(1.6, 1, 1.6);
      matrix.setPosition(x, groundY + GLOW_Y_OFFSET, z);
      this.groundGlow.setMatrixAt(idx, matrix);

      idx++;
    }

    this.lanternPool.count = idx;
    this.lanternPool.instanceMatrix.needsUpdate = true;
    this.groundGlow.count = idx;
    this.groundGlow.instanceMatrix.needsUpdate = true;

    // Subtle warm emissive tint on active buildings
    this.applyBuildingEmissive(buildings, getMesh);
  }

  private applyBuildingEmissive(
    buildings: readonly Building[],
    getMesh: (id: string) => THREE.Group | undefined,
  ): void {
    const intensity = this.nightness * 0.04;
    const r = 1.0 * intensity;
    const g = 0.7 * intensity;
    const b = 0.3 * intensity;

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      const mesh = getMesh(building.id);
      if (!mesh) continue;
      mesh.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial
        ) {
          child.material.emissive.setRGB(r, g, b);
        }
      });
    }
  }

  private resetBuildingEmissive(
    buildings: readonly Building[],
    getMesh: (id: string) => THREE.Group | undefined,
  ): void {
    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      const mesh = getMesh(building.id);
      if (!mesh) continue;
      mesh.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial
        ) {
          child.material.emissive.setRGB(0, 0, 0);
        }
      });
    }
  }

  /** Generate a warm radial gradient texture for ground glow */
  private createGlowTexture(): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0, 'rgba(255, 180, 80, 0.5)');
    gradient.addColorStop(0.5, 'rgba(255, 180, 80, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 180, 80, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  dispose(): void {
    this.lanternPool.geometry.dispose();
    this.lanternMaterial.dispose();
    this.lanternPool.removeFromParent();

    this.groundGlow.geometry.dispose();
    this.groundMaterial.dispose();
    this.groundGlow.removeFromParent();

    this.glowTexture.dispose();
  }
}
