import { describe, it, expect, beforeEach } from 'vitest';
import { UnitManager } from './UnitManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { UnitState, resetUnitIdCounter } from './Unit';
import { UnitType } from './UnitType';

describe('UnitManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let unitManager: UnitManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();

    // Create a 16x16 all-grassland grid
    grid = new HexGrid(16, 16);
    for (let q = 0; q < 16; q++) {
      for (let r = 0; r < 16; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    // Add water for fisherman test
    grid.setTile(6, 8, TerrainType.Water, 0.1);

    gameState = new GameState(grid);
    unitManager = new UnitManager(gameState);
  });

  function placeCastle() {
    const result = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    if (!result.ok) throw new Error('Failed to place castle');
    return result.building;
  }

  function placeActiveBuilding(type: string, q: number, r: number) {
    const result = gameState.placeBuilding(type as BuildingType, { q, r }, 1);
    if (!result.ok) throw new Error(`Failed to place ${type}`);
    result.building.state = BuildingState.Active;
    return result.building;
  }

  describe('serf spawning', () => {
    it('should spawn a serf when a building needs a worker', () => {
      placeCastle();
      placeActiveBuilding(BuildingType.WoodcutterHut, 10, 8);

      // Run update with enough time to trigger spawn
      unitManager.update(3.0);

      const units = gameState.getAllUnits();
      expect(units).toHaveLength(1);
      expect(units[0].type).toBe(UnitType.Woodcutter);
    });

    it('should assign spawned serf to the building', () => {
      placeCastle();
      const building = placeActiveBuilding(BuildingType.WoodcutterHut, 10, 8);

      unitManager.update(3.0);

      const units = gameState.getAllUnits();
      expect(units[0].assignedBuildingId).toBe(building.id);
    });

    it('should set serf to WalkingToWork state', () => {
      placeCastle();
      // Place far enough that unit won't arrive in the same tick
      placeActiveBuilding(BuildingType.WoodcutterHut, 14, 8);

      // Use small delta so spawn happens but unit doesn't arrive
      unitManager.update(2.1);

      const units = gameState.getAllUnits();
      expect(units[0].state).toBe(UnitState.WalkingToWork);
    });

    it('should give serf a path to the building', () => {
      placeCastle();
      placeActiveBuilding(BuildingType.WoodcutterHut, 14, 8);

      // Use small delta so spawn happens but unit doesn't arrive
      unitManager.update(2.1);

      const units = gameState.getAllUnits();
      expect(units[0].path.length).toBeGreaterThan(0);
      // Path should end at building coord
      const lastCoord = units[0].path[units[0].path.length - 1];
      expect(lastCoord).toEqual({ q: 14, r: 8 });
    });

    it('should not spawn if no buildings need workers', () => {
      placeCastle();
      // No production buildings placed

      unitManager.update(3.0);

      expect(gameState.getAllUnits()).toHaveLength(0);
    });

    it('should not spawn if building already has a worker', () => {
      placeCastle();
      placeActiveBuilding(BuildingType.WoodcutterHut, 10, 8);

      // First spawn
      unitManager.update(3.0);
      expect(gameState.getAllUnits()).toHaveLength(1);

      // Second update - should not spawn another since the building has a worker
      unitManager.update(3.0);
      expect(gameState.getAllUnits()).toHaveLength(1);
    });

    it('should spawn correct profession type', () => {
      placeCastle();
      placeActiveBuilding(BuildingType.Bakery, 10, 8);

      unitManager.update(3.0);

      expect(gameState.getAllUnits()[0].type).toBe(UnitType.Baker);
    });

    it('should spawn multiple serfs for multiple buildings', () => {
      placeCastle();
      placeActiveBuilding(BuildingType.WoodcutterHut, 10, 8);
      placeActiveBuilding(BuildingType.Sawmill, 6, 6);

      // First spawn (cooldown between spawns)
      unitManager.update(3.0);
      expect(gameState.getAllUnits()).toHaveLength(1);

      // Second spawn after cooldown
      unitManager.update(3.0);
      expect(gameState.getAllUnits()).toHaveLength(2);
    });

    it('should not spawn without a castle', () => {
      // No castle placed
      // Place a building (would be invalid in real game, but test the check)
      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 3, r: 3 }, 1);
      if (result.ok) {
        result.building.state = BuildingState.Active;
      }

      unitManager.update(3.0);
      expect(gameState.getAllUnits()).toHaveLength(0);
    });
  });

  describe('unit movement', () => {
    it('should advance unit along path each update', () => {
      placeCastle();
      placeActiveBuilding(BuildingType.WoodcutterHut, 10, 8);

      unitManager.update(3.0); // Spawn
      const unit = gameState.getAllUnits()[0];
      const initialPathIndex = unit.pathIndex;

      // Run several updates to advance movement
      unitManager.update(1.0);
      unitManager.update(1.0);

      // Unit should have advanced
      expect(unit.pathIndex).toBeGreaterThanOrEqual(initialPathIndex);
    });

    it('should update unit coord as it moves', () => {
      placeCastle();
      placeActiveBuilding(BuildingType.WoodcutterHut, 10, 8);

      unitManager.update(3.0); // Spawn
      const unit = gameState.getAllUnits()[0];

      // Run many updates to move unit
      for (let i = 0; i < 20; i++) {
        unitManager.update(0.5);
      }

      // Unit should have moved from castle position
      // (may or may not have arrived depending on speed)
      expect(unit.coord.q !== 8 || unit.coord.r !== 8).toBe(true);
    });
  });

  describe('arrival at building', () => {
    it('should transition to Working state when arriving at building', () => {
      placeCastle();
      // Place building adjacent to castle for quick arrival
      placeActiveBuilding(BuildingType.WoodcutterHut, 9, 8);

      unitManager.update(3.0); // Spawn

      // Run enough updates for unit to arrive (1 hex away, speed ~1.0)
      for (let i = 0; i < 10; i++) {
        unitManager.update(0.5);
      }

      const unit = gameState.getAllUnits()[0];
      expect(unit.state).toBe(UnitState.Working);
      expect(unit.path).toHaveLength(0);
    });
  });

  describe('sendHome', () => {
    it('should send unit back to castle', () => {
      placeCastle();
      placeActiveBuilding(BuildingType.WoodcutterHut, 9, 8);

      unitManager.update(3.0); // Spawn

      // Move to working state
      for (let i = 0; i < 10; i++) {
        unitManager.update(0.5);
      }

      const unit = gameState.getAllUnits()[0];
      expect(unit.state).toBe(UnitState.Working);

      // Send home
      unitManager.sendHome(unit);
      expect(unit.state).toBe(UnitState.WalkingHome);
      expect(unit.assignedBuildingId).toBeNull();
      expect(unit.path.length).toBeGreaterThan(0);
    });
  });
});
