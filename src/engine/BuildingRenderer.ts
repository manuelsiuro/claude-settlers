import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { Building } from '../game/Building';
import { BuildingType } from '../game/BuildingType';
import { assetLoader } from './AssetLoader';
import { BUILDING_MODEL_MAP } from './BuildingModels';
import { MapRenderer } from './MapRenderer';
import type { FogOfWarManager } from '../game/FogOfWarManager';

/** Scale factors for building models to fit hex tiles nicely */
const BUILDING_SCALE: Partial<Record<string, number>> = {
  [BuildingType.Castle]: 1.2,
  [BuildingType.Barracks]: 0.9,
  [BuildingType.IronMine]: 2.5,
  [BuildingType.CoalMine]: 2.5,
  [BuildingType.GoldMine]: 2.5,
  [BuildingType.StoneMine]: 2.5,
  // Undersized models (raw footprint < 0.35)
  [BuildingType.GoldsmithMint]: 2.0,
  [BuildingType.GuardHut]: 1.8,
  [BuildingType.IronSmelter]: 1.7,
  [BuildingType.Bakery]: 1.7,
  [BuildingType.GeologistHut]: 1.5,
  [BuildingType.BlacksmithArmory]: 1.6,
  [BuildingType.Watchtower]: 1.7,
  // Mid-tier buildings slightly undersized (raw footprint 0.42–0.50)
  [BuildingType.WoodcutterHut]: 1.15,
  [BuildingType.ForesterHut]: 1.15,
  [BuildingType.ToolmakerWorkshop]: 1.2,
  [BuildingType.Slaughterhouse]: 1.2,
};

const DEFAULT_BUILDING_SCALE = 1.0;

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
