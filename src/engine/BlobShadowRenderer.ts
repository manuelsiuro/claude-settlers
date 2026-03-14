import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { Building } from '../game/Building';
import { BuildingState } from '../game/Building';
import { BuildingType } from '../game/BuildingType';
import type { Unit } from '../game/Unit';
import { getUnitWorldPosition } from '../game/Unit';
import { MapRenderer } from './MapRenderer';

/** Shadow Y offset above ground to prevent z-fighting */
const SHADOW_Y = 0.02;

/** Building shadow sizes (radius) — larger buildings get larger shadows */
const BUILDING_SHADOW_SIZE: Partial<Record<string, number>> = {
  [BuildingType.Castle]: 1.0,
  [BuildingType.Barracks]: 0.8,
  [BuildingType.Watchtower]: 0.5,
  [BuildingType.Warehouse]: 0.7,
};
const DEFAULT_BUILDING_SHADOW_SIZE = 0.45;

/** Unit shadow radius */
const UNIT_SHADOW_SIZE = 0.2;

/** Max instances per pool */
const MAX_BUILDING_SHADOWS = 200;
const MAX_UNIT_SHADOWS = 300;

/**
 * Renders circular blob shadows beneath buildings and units.
 * Uses two InstancedMesh draw calls (one for buildings, one for units)
 * with a shared radial gradient texture for minimal GPU cost.
 */
export class BlobShadowRenderer {
  private buildingInstanced: THREE.InstancedMesh | null = null;
  private unitInstanced: THREE.InstancedMesh | null = null;
  private texture: THREE.Texture;
  private material: THREE.MeshBasicMaterial;
  private grid: HexGrid;

  constructor() {
    this.grid = new HexGrid(1, 1);
    this.texture = this.createShadowTexture();
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  addToScene(scene: THREE.Scene, grid: HexGrid): void {
    this.grid = grid;
    const planeGeom = new THREE.PlaneGeometry(1, 1);
    planeGeom.rotateX(-Math.PI / 2); // Flat on ground

    // Building shadows
    this.buildingInstanced = new THREE.InstancedMesh(
      planeGeom, this.material, MAX_BUILDING_SHADOWS,
    );
    this.buildingInstanced.count = 0;
    this.buildingInstanced.frustumCulled = false;
    this.buildingInstanced.name = 'blob_shadows_buildings';
    scene.add(this.buildingInstanced);

    // Unit shadows
    this.unitInstanced = new THREE.InstancedMesh(
      planeGeom.clone(), this.material, MAX_UNIT_SHADOWS,
    );
    this.unitInstanced.count = 0;
    this.unitInstanced.frustumCulled = false;
    this.unitInstanced.name = 'blob_shadows_units';
    scene.add(this.unitInstanced);
  }

  /** Update shadow positions each frame */
  update(buildings: Building[], units: Unit[]): void {
    this.updateBuildings(buildings);
    this.updateUnits(units);
  }

  private updateBuildings(buildings: Building[]): void {
    if (!this.buildingInstanced) return;

    const matrix = new THREE.Matrix4();
    let idx = 0;

    for (const building of buildings) {
      if (idx >= MAX_BUILDING_SHADOWS) break;
      if (building.state === BuildingState.Destroyed) continue;
      if (building.state === BuildingState.Planned) continue;

      const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
      const tile = this.grid.getTile(building.coord.q, building.coord.r);
      const y = (tile ? MapRenderer.getTileY(tile) : 0) + SHADOW_Y;
      const size = (BUILDING_SHADOW_SIZE[building.type] ?? DEFAULT_BUILDING_SHADOW_SIZE) * 2;

      matrix.makeScale(size, 1, size);
      matrix.setPosition(x, y, z);
      this.buildingInstanced.setMatrixAt(idx, matrix);
      idx++;
    }

    this.buildingInstanced.count = idx;
    this.buildingInstanced.instanceMatrix.needsUpdate = true;
  }

  private updateUnits(units: Unit[]): void {
    if (!this.unitInstanced) return;

    const matrix = new THREE.Matrix4();
    let idx = 0;
    const size = UNIT_SHADOW_SIZE * 2;

    for (const unit of units) {
      if (idx >= MAX_UNIT_SHADOWS) break;

      const interpCoord = getUnitWorldPosition(unit);
      const { x, z } = HexGrid.hexToWorld(interpCoord.q, interpCoord.r);
      const tile = this.grid.getTile(unit.coord.q, unit.coord.r);
      const y = (tile ? MapRenderer.getTileY(tile) : 0) + SHADOW_Y;

      matrix.makeScale(size, 1, size);
      matrix.setPosition(x, y, z);
      this.unitInstanced.setMatrixAt(idx, matrix);
      idx++;
    }

    this.unitInstanced.count = idx;
    this.unitInstanced.instanceMatrix.needsUpdate = true;
  }

  /** Generate a radial gradient circle texture for soft shadows */
  private createShadowTexture(): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  dispose(): void {
    if (this.buildingInstanced) {
      this.buildingInstanced.geometry.dispose();
      this.buildingInstanced.removeFromParent();
    }
    if (this.unitInstanced) {
      this.unitInstanced.geometry.dispose();
      this.unitInstanced.removeFromParent();
    }
    this.material.dispose();
    this.texture.dispose();
  }
}
