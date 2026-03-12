import type { Building } from './Building';
import { createBuilding, BuildingState } from './Building';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { HexGrid } from './HexGrid';
import type { HexCoord } from './HexGrid';
import type { Unit } from './Unit';
import { createUnit, UnitState } from './Unit';
import type { UnitType } from './UnitType';
import { WORKER_TO_UNIT_TYPE } from './UnitType';

export type PlacementError =
  | 'invalid_terrain'
  | 'tile_occupied'
  | 'no_adjacent_terrain'
  | 'tile_not_found'
  | 'outside_territory';

export type PlacementResult =
  | { ok: true; building: Building }
  | { ok: false; error: PlacementError };

/**
 * Central game state: manages all placed buildings, units, and validates placement.
 */
export class GameState {
  private buildings: Map<string, Building> = new Map();
  /** Quick lookup: hex coord key -> building id */
  private buildingsByCoord: Map<string, string> = new Map();
  private units: Map<string, Unit> = new Map();
  /** Reverse index: building ID → assigned unit ID (O(1) worker lookup) */
  private workerByBuilding: Map<string, string> = new Map();
  private grid: HexGrid;

  /**
   * Optional territory check function.
   * When set, building placement requires the hex to be in the player's territory.
   * Castle placement is exempt.
   */
  territoryCheck: ((q: number, r: number, playerId: number) => boolean) | null = null;

  /** Optional callback when a building is removed (for territory recalculation) */
  onBuildingRemoved: ((building: Building) => void) | null = null;

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

    // Check territory (Castle is exempt — it's the starting building)
    if (this.territoryCheck && type !== BuildingType.Castle) {
      if (!this.territoryCheck(coord.q, coord.r, playerId)) {
        return { ok: false, error: 'outside_territory' };
      }
    }

    const building = createBuilding(type, coord, playerId);

    // Compute resource distance for gathering buildings
    if (def.harvestTerrain) {
      building.resourceDistance = this.grid.findNearestTerrain(coord, def.harvestTerrain);
    }

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

  /** Remove a building and send its worker home */
  removeBuilding(id: string): boolean {
    const building = this.buildings.get(id);
    if (!building) return false;

    // Unassign the worker (if any) so it can be sent home
    const workerId = this.workerByBuilding.get(id);
    if (workerId) {
      const worker = this.units.get(workerId);
      if (worker) {
        worker.assignedBuildingId = null;
      }
      this.workerByBuilding.delete(id);
    }

    const coordKey = HexGrid.key(building.coord.q, building.coord.r);
    this.buildingsByCoord.delete(coordKey);
    this.buildings.delete(id);

    this.onBuildingRemoved?.(building);

    return true;
  }

  /** Check if a tile has a building */
  hasBuildingAt(q: number, r: number): boolean {
    return this.buildingsByCoord.has(HexGrid.key(q, r));
  }

  /** Check if a building type can be placed at a coordinate (without actually placing) */
  canPlace(type: BuildingType, coord: HexCoord, playerId?: number): PlacementError | null {
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

    // Check territory (Castle is exempt)
    if (this.territoryCheck && type !== BuildingType.Castle && playerId !== undefined) {
      if (!this.territoryCheck(coord.q, coord.r, playerId)) {
        return 'outside_territory';
      }
    }

    return null;
  }

  // ===================================================================
  // Unit management
  // ===================================================================

  /** Spawn a new unit at the given coordinate */
  spawnUnit(type: UnitType, coord: HexCoord, playerId: number): Unit {
    const unit = createUnit(type, coord, playerId);
    this.units.set(unit.id, unit);
    return unit;
  }

  /** Get a unit by its ID */
  getUnit(id: string): Unit | undefined {
    return this.units.get(id);
  }

  /** Get all units */
  getAllUnits(): Unit[] {
    return Array.from(this.units.values());
  }

  /** Get all units owned by a player */
  getUnitsByPlayer(playerId: number): Unit[] {
    return this.getAllUnits().filter((u) => u.playerId === playerId);
  }

  /** Get all units of a specific type */
  getUnitsByType(type: UnitType): Unit[] {
    return this.getAllUnits().filter((u) => u.type === type);
  }

  /** Get the unit assigned to a building, if any (O(1) via reverse index) */
  getWorkerForBuilding(buildingId: string): Unit | undefined {
    const unitId = this.workerByBuilding.get(buildingId);
    if (!unitId) return undefined;
    return this.units.get(unitId);
  }

  /** Assign a unit to a building and update the reverse index */
  assignWorkerToBuilding(unitId: string, buildingId: string): void {
    const unit = this.units.get(unitId);
    if (!unit) return;
    // Unassign from previous building if any
    if (unit.assignedBuildingId) {
      this.workerByBuilding.delete(unit.assignedBuildingId);
    }
    unit.assignedBuildingId = buildingId;
    this.workerByBuilding.set(buildingId, unitId);
  }

  /** Unassign a unit from its building and update the reverse index */
  unassignWorker(unitId: string): void {
    const unit = this.units.get(unitId);
    if (!unit) return;
    if (unit.assignedBuildingId) {
      this.workerByBuilding.delete(unit.assignedBuildingId);
    }
    unit.assignedBuildingId = null;
  }

  /** Remove a unit and clean up reverse index */
  removeUnit(id: string): boolean {
    const unit = this.units.get(id);
    if (!unit) return false;
    if (unit.assignedBuildingId) {
      this.workerByBuilding.delete(unit.assignedBuildingId);
    }
    return this.units.delete(id);
  }

  /**
   * Get all active buildings that need a worker but don't have one assigned.
   * Returns buildings with a worker field defined and no unit currently assigned.
   */
  getBuildingsNeedingWorkers(playerId: number): Building[] {
    return this.getBuildingsByPlayer(playerId).filter((building) => {
      const def = BUILDING_DEFINITIONS[building.type];
      if (!def.worker) return false;
      if (building.state !== 'active') return false;
      return !this.workerByBuilding.has(building.id);
    });
  }

  /**
   * Get idle units at the Castle that can be assigned to jobs.
   */
  getIdleUnitsAtCastle(playerId: number): Unit[] {
    return this.getUnitsByPlayer(playerId).filter(
      (u) => u.state === UnitState.Idle && u.assignedBuildingId === null,
    );
  }

  /**
   * Get the required UnitType for a building's worker, or null.
   */
  getRequiredWorkerType(buildingId: string): UnitType | null {
    const building = this.buildings.get(buildingId);
    if (!building) return null;
    const def = BUILDING_DEFINITIONS[building.type];
    if (!def.worker) return null;
    return WORKER_TO_UNIT_TYPE[def.worker] ?? null;
  }

  /** Find the active Castle building for a player */
  findCastle(playerId: number): Building | undefined {
    return this.getBuildingsByPlayer(playerId)
      .find((b) => b.type === BuildingType.Castle && b.state === BuildingState.Active);
  }

  /** Get the hex grid */
  getGrid(): HexGrid {
    return this.grid;
  }

  /** Serialization: get all internal state for save */
  _getState(): {
    buildings: Building[];
    units: Unit[];
    workerByBuilding: [string, string][];
  } {
    return {
      buildings: Array.from(this.buildings.values()),
      units: Array.from(this.units.values()),
      workerByBuilding: Array.from(this.workerByBuilding.entries()),
    };
  }

  /** Serialization: restore all internal state from save */
  _loadState(state: {
    buildings: Building[];
    units: Unit[];
    workerByBuilding: [string, string][];
  }): void {
    this.buildings.clear();
    this.buildingsByCoord.clear();
    this.units.clear();
    this.workerByBuilding.clear();

    for (const building of state.buildings) {
      this.buildings.set(building.id, building);
      this.buildingsByCoord.set(HexGrid.key(building.coord.q, building.coord.r), building.id);
    }
    for (const unit of state.units) {
      this.units.set(unit.id, unit);
    }
    this.workerByBuilding = new Map(state.workerByBuilding);
  }
}
