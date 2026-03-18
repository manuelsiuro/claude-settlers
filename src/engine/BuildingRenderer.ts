import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { Building } from '../game/Building';
import { BuildingType } from '../game/BuildingType';
import { assetLoader } from './AssetLoader';
import { BUILDING_MODEL_MAP } from './BuildingModels';
import { MapRenderer } from './MapRenderer';
import type { FogOfWarManager } from '../game/FogOfWarManager';

/**
 * Scale factors for building models to fit hex tiles.
 * Computed from GLB bounding boxes: scale = (HEX_WIDTH * fillRatio) / max(bbox.x, bbox.z)
 * HEX_WIDTH = sqrt(3) ≈ 1.732
 */
export const BUILDING_SCALE: Record<string, number> = {
  // Large (85-90% fill)
  [BuildingType.Castle]: 0.15,
  [BuildingType.Barracks]: 0.12,
  // Medium-large (75-80% fill)
  [BuildingType.Farm]: 0.135,
  [BuildingType.PigFarm]: 0.11,
  [BuildingType.Warehouse]: 0.12,
  // Medium (65-75% fill)
  [BuildingType.Sawmill]: 0.17,
  [BuildingType.Windmill]: 0.17,
  [BuildingType.Bakery]: 0.21,
  [BuildingType.Slaughterhouse]: 0.16,
  [BuildingType.IronSmelter]: 0.12,
  [BuildingType.ToolmakerWorkshop]: 0.23,
  [BuildingType.GoldsmithMint]: 0.16,
  [BuildingType.BlacksmithArmory]: 0.22,
  // Medium-compact (60-65% fill)
  [BuildingType.IronMine]: 0.09,
  [BuildingType.CoalMine]: 0.10,
  [BuildingType.GoldMine]: 0.09,
  [BuildingType.StoneMine]: 0.10,
  [BuildingType.Quarry]: 0.17,
  // Small (50-60% fill)
  [BuildingType.WoodcutterHut]: 0.29,
  [BuildingType.ForesterHut]: 0.15,
  [BuildingType.FishermanHut]: 0.20,
  [BuildingType.GeologistHut]: 0.18,
  [BuildingType.GuardHut]: 0.13,
  // Tall-narrow (50-55% fill)
  [BuildingType.Watchtower]: 0.09,
  // Logistics
  [BuildingType.Harbor]: 0.12,
};

const DEFAULT_BUILDING_SCALE = 0.15;

/**
 * Renders placed buildings on the hex map.
 * Manages 3D building meshes and keeps them in sync with game state.
 */
export class BuildingRenderer {
  private buildingGroup: THREE.Group;
  private buildingMeshes: Map<string, THREE.Group> = new Map();
  private fogManager: FogOfWarManager | null = null;
  private humanPlayerId = 1;

  constructor() {
    this.buildingGroup = new THREE.Group();
    this.buildingGroup.name = 'buildings';
  }

  /** Set fog of war manager for visibility filtering */
  setFogOfWar(fogManager: FogOfWarManager, humanPlayerId: number): void {
    this.fogManager = fogManager;
    this.humanPlayerId = humanPlayerId;
  }

  /** Update building visibility based on fog of war. Call each frame. */
  updateFogVisibility(buildings: Building[]): void {
    if (!this.fogManager) return;
    for (const building of buildings) {
      if (building.playerId === this.humanPlayerId) continue; // Own buildings always visible
      const mesh = this.buildingMeshes.get(building.id);
      if (!mesh) continue;

      const explored = this.fogManager.isExplored(
        building.coord.q, building.coord.r, this.humanPlayerId,
      );
      // Enemy buildings: hidden if unexplored, shown if explored (even if not currently visible)
      mesh.visible = explored;
    }
  }

  /** Add to scene */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addToScene(scene: THREE.Scene, _grid: HexGrid): void {
    scene.add(this.buildingGroup);
  }

  /** Add a building mesh to the scene */
  addBuilding(building: Building, grid: HexGrid): void {
    const modelName = BUILDING_MODEL_MAP[building.type];
    if (!modelName) return;

    const mesh = assetLoader.getBuildingModel(modelName);
    const scale = BUILDING_SCALE[building.type] ?? DEFAULT_BUILDING_SCALE;
    mesh.scale.setScalar(scale);

    // Position on hex tile
    const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
    const tile = grid.getTile(building.coord.q, building.coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;

    mesh.position.set(x, y, z);
    mesh.name = `building_${building.id}`;
    mesh.userData.buildingId = building.id;

    // Metal material adjustments for forge-type buildings
    if (
      building.type === BuildingType.BlacksmithArmory ||
      building.type === BuildingType.IronSmelter ||
      building.type === BuildingType.GoldsmithMint
    ) {
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.metalness = 0.6;
          child.material.roughness = 0.4;
        }
      });
    }

    this.buildingGroup.add(mesh);
    this.buildingMeshes.set(building.id, mesh);

  }

  /** Remove a building mesh from the scene */
  removeBuilding(buildingId: string): void {
    const mesh = this.buildingMeshes.get(buildingId);
    if (!mesh) return;

    this.buildingGroup.remove(mesh);
    this.disposeMesh(mesh);
    this.buildingMeshes.delete(buildingId);

  }

  /** Get the 3D mesh for a building (for selection highlighting etc.) */
  getMesh(buildingId: string): THREE.Group | undefined {
    return this.buildingMeshes.get(buildingId);
  }

  /** Remove building from internal map without disposing (animator handles scene removal) */
  forgetBuilding(buildingId: string): void {
    this.buildingMeshes.delete(buildingId);
  }

  /** Enable or disable castShadow on all building meshes */
  setCastShadow(enabled: boolean): void {
    for (const group of this.buildingMeshes.values()) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = enabled;
        }
      });
    }
  }

  /** Get all building meshes (for building animator) */
  getAllMeshes(): ReadonlyMap<string, THREE.Group> {
    return this.buildingMeshes;
  }

  private disposeMesh(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

  /** Clean up everything */
  dispose(): void {
    for (const mesh of this.buildingMeshes.values()) {
      this.disposeMesh(mesh);
    }
    this.buildingMeshes.clear();

    const disposeGroup = (group: THREE.Group) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
      group.removeFromParent();
    };

    disposeGroup(this.buildingGroup);
  }
}
