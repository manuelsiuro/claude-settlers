import type { Building } from './Building';
import { createBuilding } from './Building';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { HexGrid } from './HexGrid';
import type { HexCoord } from './HexGrid';

export type PlacementError =
  | 'invalid_terrain'
  | 'tile_occupied'
  | 'no_adjacent_terrain'
  | 'tile_not_found';

export type PlacementResult =
  | { ok: true; building: Building }
  | { ok: false; error: PlacementError };

/**
 * Central game state: manages all placed buildings and validates placement.
 */
export class GameState {
  private buildings: Map<string, Building> = new Map();
  /** Quick lookup: hex coord key -> building id */
  private buildingsByCoord: Map<string, string> = new Map();
  private grid: HexGrid;

  constructor(grid: HexGrid) {
    this.grid = grid;
  }

  /** Try to place a building at the given coordinate. Returns result with error or building. */
  placeBuilding(
    type: BuildingType,
    coord: HexCoord,
    playerId: number,
  ): PlacementResult {
    const def = BUILDING_DEFINITIONS[type];

    // Check tile exists
    const tile = this.grid.getTile(coord.q, coord.r);
    if (!tile) {
      return { ok: false, error: 'tile_not_found' };
    }

    // Check terrain is allowed
    if (!def.allowedTerrain.includes(tile.terrain)) {
      return { ok: false, error: 'invalid_terrain' };
    }

    // Check tile is not occupied
    const coordKey = HexGrid.key(coord.q, coord.r);
    if (this.buildingsByCoord.has(coordKey)) {
      return { ok: false, error: 'tile_occupied' };
    }

    // Check adjacent terrain requirement (e.g., fisherman needs water neighbor)
    if (def.adjacentTerrain) {
      const neighbors = this.grid.getNeighbors(coord.q, coord.r);
      const hasRequired = neighbors.some((n) => n.terrain === def.adjacentTerrain);
      if (!hasRequired) {
        return { ok: false, error: 'no_adjacent_terrain' };
      }
    }

    const building = createBuilding(type, coord, playerId);
    this.buildings.set(building.id, building);
    this.buildingsByCoord.set(coordKey, building.id);

    return { ok: true, building };
  }

  /** Get a building by its ID */
  getBuilding(id: string): Building | undefined {
    return this.buildings.get(id);
  }

  /** Get building at a hex coordinate */
  getBuildingAt(q: number, r: number): Building | undefined {
    const key = HexGrid.key(q, r);
    const id = this.buildingsByCoord.get(key);
    if (!id) return undefined;
    return this.buildings.get(id);
  }

  /** Get all buildings */
  getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  /** Get all buildings owned by a player */
  getBuildingsByPlayer(playerId: number): Building[] {
    return this.getAllBuildings().filter((b) => b.playerId === playerId);
  }

  /** Remove a building */
  removeBuilding(id: string): boolean {
    const building = this.buildings.get(id);
    if (!building) return false;
    const coordKey = HexGrid.key(building.coord.q, building.coord.r);
    this.buildingsByCoord.delete(coordKey);
    this.buildings.delete(id);
    return true;
  }

  /** Check if a tile has a building */
  hasBuildingAt(q: number, r: number): boolean {
    return this.buildingsByCoord.has(HexGrid.key(q, r));
  }

  /** Check if a building type can be placed at a coordinate (without actually placing) */
  canPlace(type: BuildingType, coord: HexCoord): PlacementError | null {
    const def = BUILDING_DEFINITIONS[type];
    const tile = this.grid.getTile(coord.q, coord.r);

    if (!tile) return 'tile_not_found';
    if (!def.allowedTerrain.includes(tile.terrain)) return 'invalid_terrain';
    if (this.buildingsByCoord.has(HexGrid.key(coord.q, coord.r))) return 'tile_occupied';

    if (def.adjacentTerrain) {
      const neighbors = this.grid.getNeighbors(coord.q, coord.r);
      if (!neighbors.some((n) => n.terrain === def.adjacentTerrain)) {
        return 'no_adjacent_terrain';
      }
    }

    return null;
  }
}
