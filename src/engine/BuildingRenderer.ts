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
  // ── Core ──
  [BuildingType.Castle]: 0.15,

  // ── Tier 1: Basic Economy ──
  [BuildingType.WoodcutterHut]: 0.29,
  [BuildingType.ForesterHut]: 0.15,
  [BuildingType.Quarry]: 0.17,
  [BuildingType.FishermanHut]: 0.20,
  [BuildingType.GuardHut]: 0.13,

  // ── Tier 2: Processing & Gathering ──
  [BuildingType.Sawmill]: 0.17,
  [BuildingType.Farm]: 0.135,
  [BuildingType.GeologistHut]: 0.18,
  [BuildingType.IronMine]: 0.09,
  [BuildingType.CoalMine]: 0.10,
  [BuildingType.GoldMine]: 0.09,
  [BuildingType.StoneMine]: 0.10,
  [BuildingType.Watchtower]: 0.09,

  // ── Tier 3: Specialized Production & Military ──
  [BuildingType.Windmill]: 0.17,
  [BuildingType.Bakery]: 0.21,
  [BuildingType.PigFarm]: 0.11,
  [BuildingType.Slaughterhouse]: 0.16,
  [BuildingType.IronSmelter]: 0.12,
  [BuildingType.ToolmakerWorkshop]: 0.23,
  [BuildingType.GoldsmithMint]: 0.16,
  [BuildingType.BlacksmithArmory]: 0.22,
  [BuildingType.Barracks]: 0.12,

  // ── Logistics ──
  [BuildingType.Warehouse]: 0.12,
  [BuildingType.Harbor]: 0.12,

  // ── Housing ──
  [BuildingType.SmallHouse]: 2.5,
  [BuildingType.MediumHouse]: 2.1,
  [BuildingType.LargeHouse]: 1.7,

  // ── Expansion: Food & Farming ──
  [BuildingType.Well]: 0.18,
  [BuildingType.Orchard]: 0.16,
  [BuildingType.Vineyard]: 0.18,
  [BuildingType.Winery]: 0.17,
  [BuildingType.Brewery]: 0.18,
  [BuildingType.DairyFarm]: 0.16,
  [BuildingType.CheeseMakerBuilding]: 0.20,
  [BuildingType.Hayfield]: 0.16,

  // ── Expansion: Crafting & Animals ──
  [BuildingType.Tannery]: 0.18,
  [BuildingType.WeaversHut]: 0.20,
  [BuildingType.CharcoalBurner]: 0.18,
  [BuildingType.FletchersWorkshop]: 0.18,
  [BuildingType.SiegeWorkshop]: 0.15,
  [BuildingType.Stable]: 0.16,
  [BuildingType.CattleRanch]: 0.16,
  [BuildingType.SheepFarm]: 0.16,
  [BuildingType.Butchery]: 0.18,

  // ── Expansion: Military ──
  [BuildingType.Fortress]: 0.12,
  [BuildingType.ArcheryRange]: 0.16,
  [BuildingType.TorchTower]: 0.20,

  // ── Expansion: Special ──
  [BuildingType.InnTavern]: 0.17,
  [BuildingType.Market]: 0.16,

  // ── Living World ──
  [BuildingType.HuntingLodge]: 0.18,
  [BuildingType.TrappersHut]: 0.18,
  [BuildingType.Furrier]: 0.20,
  [BuildingType.Apiary]: 0.16,
  [BuildingType.Meadery]: 0.18,
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

    // Clone materials so each building instance has its own copy.
    // Without this, BuildingAnimator's setOpacity/setEmissive on one building
    // (e.g., during demolition or construction) would affect ALL buildings of the same type.
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        child.material = child.material.clone();
      }
    });

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

  /** Replace a building's 3D model (for type transformation like house upgrades) */
  swapBuildingModel(building: Building, grid: HexGrid): void {
    this.removeBuilding(building.id);
    this.addBuilding(building, grid);
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

  /**
   * Dispose cloned materials for a building mesh.
   * Geometry is still shared with AssetLoader originals so we do NOT dispose it.
   * Materials were cloned per-building in addBuilding(), so they're safe to dispose.
   */
  private disposeMesh(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        child.material.dispose();
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
