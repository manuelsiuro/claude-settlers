import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';

describe('GameState', () => {
  let grid: HexGrid;
  let state: GameState;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    // Create a small test grid with known terrain
    grid = new HexGrid(8, 8);
    // Fill with grassland
    for (let q = 0; q < 8; q++) {
      for (let r = 0; r < 8; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    // Add some special terrain
    grid.setTile(0, 0, TerrainType.Water, 0.1);
    grid.setTile(1, 0, TerrainType.Mountain, 0.8);
    grid.setTile(7, 7, TerrainType.Desert, 0.3);
    state = new GameState(grid);
  });

  describe('placeBuilding', () => {
    it('should place a Castle on grassland', () => {
      const result = state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.building.type).toBe(BuildingType.Castle);
        expect(result.building.playerId).toBe(1);
      }
    });

    it('should reject placement on water', () => {
      const result = state.placeBuilding(BuildingType.Castle, { q: 0, r: 0 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('invalid_terrain');
      }
    });

    it('should reject placement on desert', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 7, r: 7 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('invalid_terrain');
      }
    });

    it('should reject placement on occupied tile', () => {
      state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('tile_occupied');
      }
    });

    it('should place Mine on mountain', () => {
      const result = state.placeBuilding(BuildingType.IronMine, { q: 1, r: 0 }, 1);
      expect(result.ok).toBe(true);
    });

    it('should reject Mine on grassland', () => {
      const result = state.placeBuilding(BuildingType.IronMine, { q: 4, r: 4 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('invalid_terrain');
      }
    });

    it('should enforce adjacent water for Fisherman Hut', () => {
      // Tile (1, 1) is grassland and adjacent to water at (0, 0)
      // But we need to check neighbor adjacency via the grid
      // Place next to water
      const result = state.placeBuilding(BuildingType.FishermanHut, { q: 0, r: 1 }, 1);
      expect(result.ok).toBe(true);
    });

    it('should reject Fisherman Hut without adjacent water', () => {
      const result = state.placeBuilding(BuildingType.FishermanHut, { q: 4, r: 4 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('no_adjacent_terrain');
      }
    });
  });

  describe('getBuildingAt', () => {
    it('should return the building at a coordinate', () => {
      state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      const building = state.getBuildingAt(4, 4);
      expect(building).toBeDefined();
      expect(building!.type).toBe(BuildingType.Castle);
    });

    it('should return undefined for empty tile', () => {
      expect(state.getBuildingAt(3, 3)).toBeUndefined();
    });
  });

  describe('removeBuilding', () => {
    it('should remove a placed building', () => {
      const result = state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      if (result.ok) {
        expect(state.removeBuilding(result.building.id)).toBe(true);
        expect(state.getBuildingAt(4, 4)).toBeUndefined();
      }
    });

    it('should return false for non-existent building', () => {
      expect(state.removeBuilding('nonexistent')).toBe(false);
    });

    it('should unassign worker when building is removed', () => {
      const castle = state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      if (!castle.ok) throw new Error('Failed to place castle');
      const woodcutter = state.placeBuilding(BuildingType.WoodcutterHut, { q: 5, r: 4 }, 1);
      if (!woodcutter.ok) throw new Error('Failed to place woodcutter');

      const unit = state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
      state.assignWorkerToBuilding(unit.id, woodcutter.building.id);

      expect(state.getWorkerForBuilding(woodcutter.building.id)).toBe(unit);
      expect(unit.assignedBuildingId).toBe(woodcutter.building.id);

      state.removeBuilding(woodcutter.building.id);

      expect(unit.assignedBuildingId).toBeNull();
      expect(state.getWorkerForBuilding(woodcutter.building.id)).toBeUndefined();
    });
  });

  describe('getAllBuildings', () => {
    it('should return all placed buildings', () => {
      state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      expect(state.getAllBuildings()).toHaveLength(2);
    });
  });

  describe('canPlace', () => {
    it('should return null for valid placement', () => {
      expect(state.canPlace(BuildingType.Castle, { q: 4, r: 4 })).toBeNull();
    });

    it('should return error for invalid placement', () => {
      expect(state.canPlace(BuildingType.Castle, { q: 0, r: 0 })).toBe('invalid_terrain');
    });

    it('should return outside_territory when territory check is set', () => {
      // Set up territory check that only allows (4,4)
      state.territoryCheck = (q, r) => q === 4 && r === 4;

      // Castle is exempt from territory check
      expect(state.canPlace(BuildingType.Castle, { q: 3, r: 3 }, 1)).toBeNull();

      // Non-castle needs territory
      expect(state.canPlace(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1)).toBeNull();
      expect(state.canPlace(BuildingType.WoodcutterHut, { q: 5, r: 5 }, 1)).toBe('outside_territory');
    });

    it('should block placeBuilding when outside territory', () => {
      state.territoryCheck = () => false;

      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('outside_territory');

      // Castle should still work
      const castleResult = state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      expect(castleResult.ok).toBe(true);
    });
  });

  // ================================================================
  // Unit management
  // ================================================================

  describe('spawnUnit', () => {
    it('should create and track a unit', () => {
      const unit = state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
      expect(unit.id).toBe('unit_1');
      expect(unit.type).toBe(UnitType.Woodcutter);
      expect(unit.playerId).toBe(1);
      expect(state.getUnit(unit.id)).toBe(unit);
    });

    it('should create units with unique IDs', () => {
      const u1 = state.spawnUnit(UnitType.Builder, { q: 4, r: 4 }, 1);
      const u2 = state.spawnUnit(UnitType.Farmer, { q: 4, r: 4 }, 1);
      expect(u1.id).not.toBe(u2.id);
    });
  });

  describe('getAllUnits / getUnitsByPlayer / getUnitsByType', () => {
    it('should return all spawned units', () => {
      state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
      state.spawnUnit(UnitType.Builder, { q: 3, r: 3 }, 1);
      state.spawnUnit(UnitType.Knight, { q: 5, r: 5 }, 2);
      expect(state.getAllUnits()).toHaveLength(3);
    });

    it('should filter by player', () => {
      state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
      state.spawnUnit(UnitType.Builder, { q: 3, r: 3 }, 2);
      expect(state.getUnitsByPlayer(1)).toHaveLength(1);
      expect(state.getUnitsByPlayer(2)).toHaveLength(1);
    });

    it('should filter by type', () => {
      state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
      state.spawnUnit(UnitType.Woodcutter, { q: 3, r: 3 }, 1);
      state.spawnUnit(UnitType.Builder, { q: 2, r: 2 }, 1);
      expect(state.getUnitsByType(UnitType.Woodcutter)).toHaveLength(2);
      expect(state.getUnitsByType(UnitType.Builder)).toHaveLength(1);
    });
  });

  describe('removeUnit', () => {
    it('should remove a unit', () => {
      const unit = state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
      expect(state.removeUnit(unit.id)).toBe(true);
      expect(state.getUnit(unit.id)).toBeUndefined();
    });

    it('should clean up reverse index when removing assigned unit', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        const unit = state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
        state.assignWorkerToBuilding(unit.id, result.building.id);
        state.removeUnit(unit.id);
        expect(state.getWorkerForBuilding(result.building.id)).toBeUndefined();
      }
    });

    it('should return false for non-existent unit', () => {
      expect(state.removeUnit('nonexistent')).toBe(false);
    });
  });

  describe('getWorkerForBuilding', () => {
    it('should return the unit assigned to a building', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        const unit = state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
        state.assignWorkerToBuilding(unit.id, result.building.id);
        expect(state.getWorkerForBuilding(result.building.id)).toBe(unit);
      }
    });

    it('should return undefined when no worker assigned', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        expect(state.getWorkerForBuilding(result.building.id)).toBeUndefined();
      }
    });

    it('should return undefined after unassigning worker', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        const unit = state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
        state.assignWorkerToBuilding(unit.id, result.building.id);
        state.unassignWorker(unit.id);
        expect(state.getWorkerForBuilding(result.building.id)).toBeUndefined();
        expect(unit.assignedBuildingId).toBeNull();
      }
    });
  });

  describe('getBuildingsNeedingWorkers', () => {
    it('should return active buildings with no assigned worker', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        // Set to active (normally done by construction system)
        result.building.state = BuildingState.Active;
        const needing = state.getBuildingsNeedingWorkers(1);
        expect(needing).toHaveLength(1);
        expect(needing[0].id).toBe(result.building.id);
      }
    });

    it('should not include buildings that already have workers', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        result.building.state = BuildingState.Active;
        const unit = state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
        state.assignWorkerToBuilding(unit.id, result.building.id);
        expect(state.getBuildingsNeedingWorkers(1)).toHaveLength(0);
      }
    });

    it('should not include buildings that are not active', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        // Building starts as 'planned', not 'active'
        expect(state.getBuildingsNeedingWorkers(1)).toHaveLength(0);
      }
    });

    it('should not include buildings with no worker slot (military, Castle)', () => {
      const castleResult = state.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      if (castleResult.ok) {
        expect(state.getBuildingsNeedingWorkers(1)).toHaveLength(0);
      }
    });
  });

  describe('getIdleUnitsAtCastle', () => {
    it('should return idle unassigned units', () => {
      state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
      state.spawnUnit(UnitType.Builder, { q: 4, r: 4 }, 1);
      expect(state.getIdleUnitsAtCastle(1)).toHaveLength(2);
    });

    it('should not include assigned units', () => {
      const unit = state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
      state.assignWorkerToBuilding(unit.id, 'building_1');
      expect(state.getIdleUnitsAtCastle(1)).toHaveLength(0);
    });

    it('should not include non-idle units', () => {
      const unit = state.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
      unit.state = UnitState.Working;
      expect(state.getIdleUnitsAtCastle(1)).toHaveLength(0);
    });
  });

  describe('getRequiredWorkerType', () => {
    it('should return correct unit type for a building', () => {
      const result = state.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        expect(state.getRequiredWorkerType(result.building.id)).toBe(UnitType.Woodcutter);
      }
    });

    it('should return null for buildings with no worker', () => {
      const result = state.placeBuilding(BuildingType.GuardHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        expect(state.getRequiredWorkerType(result.building.id)).toBeNull();
      }
    });

    it('should return null for non-existent building', () => {
      expect(state.getRequiredWorkerType('nonexistent')).toBeNull();
    });
  });
});
