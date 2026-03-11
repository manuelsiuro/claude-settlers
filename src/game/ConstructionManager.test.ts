import { describe, it, expect, beforeEach } from 'vitest';
import { ConstructionManager } from './ConstructionManager';
import { UnitManager } from './UnitManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import {
  BuildingState,
  resetBuildingIdCounter,
  initializeCastleResources,
  getInventoryAmount,
} from './Building';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';
import { ResourceType } from './ResourceType';

describe('ConstructionManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let construction: ConstructionManager;
  let unitManager: UnitManager;

  /** Simulate one game loop tick (same order as Game.ts) */
  function tick(dt: number) {
    unitManager.update(dt);
    construction.update(dt);
  }

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();

    grid = new HexGrid(16, 16);
    for (let q = 0; q < 16; q++) {
      for (let r = 0; r < 16; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }

    gameState = new GameState(grid);
    construction = new ConstructionManager(gameState);
    unitManager = new UnitManager(gameState);
  });

  function placeCastleWithResources() {
    const result = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    if (!result.ok) throw new Error('Failed to place castle');
    initializeCastleResources(result.building);
    return result.building;
  }

  describe('resource delivery', () => {
    it('should deliver construction resources from Castle to Planned building', () => {
      const castle = placeCastleWithResources();
      const woodBefore = getInventoryAmount(castle.outputInventory, ResourceType.Wood);

      // Place a woodcutter hut (costs 2 wood)
      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 10, r: 8 }, 1);
      if (!result.ok) throw new Error('Failed to place building');
      const building = result.building;
      expect(building.state).toBe(BuildingState.Planned);

      // Run enough ticks to deliver resources (2 wood, 1 per tick at 1s intervals)
      construction.update(1.1);
      construction.update(1.1);

      // Should have delivered 2 wood and transitioned to UnderConstruction
      expect(building.constructionDelivered[ResourceType.Wood]).toBe(2);
      expect(building.state).toBe(BuildingState.UnderConstruction);
      expect(getInventoryAmount(castle.outputInventory, ResourceType.Wood)).toBe(woodBefore - 2);
    });

    it('should not deliver if Castle has no resources', () => {
      const result0 = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
      if (!result0.ok) throw new Error('Failed');
      // Castle has no resources (not initialized)

      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 10, r: 8 }, 1);
      if (!result.ok) throw new Error('Failed');

      construction.update(5.0);

      expect(result.building.state).toBe(BuildingState.Planned);
    });

    it('should deliver one resource per tick', () => {
      placeCastleWithResources();

      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 10, r: 8 }, 1);
      if (!result.ok) throw new Error('Failed');

      // One tick
      construction.update(1.1);
      expect(result.building.constructionDelivered[ResourceType.Wood]).toBe(1);
      expect(result.building.state).toBe(BuildingState.Planned); // needs 2 wood total
    });
  });

  describe('builder spawning', () => {
    it('should spawn a builder when building transitions to UnderConstruction', () => {
      placeCastleWithResources();

      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 10, r: 8 }, 1);
      if (!result.ok) throw new Error('Failed');

      // Deliver resources
      construction.update(1.1);
      construction.update(1.1);
      expect(result.building.state).toBe(BuildingState.UnderConstruction);

      // Next update should spawn builder
      construction.update(0.1);

      const units = gameState.getAllUnits();
      const builders = units.filter((u) => u.type === UnitType.Builder);
      expect(builders).toHaveLength(1);
      expect(builders[0].state).toBe(UnitState.WalkingToWork);
      expect(builders[0].assignedBuildingId).toBe(result.building.id);
    });

    it('should not spawn duplicate builders for same building', () => {
      placeCastleWithResources();

      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 10, r: 8 }, 1);
      if (!result.ok) throw new Error('Failed');

      // Deliver and transition
      construction.update(1.1);
      construction.update(1.1);

      // Multiple updates — should only spawn one builder
      construction.update(0.1);
      construction.update(0.1);
      construction.update(0.1);

      const builders = gameState.getAllUnits().filter((u) => u.type === UnitType.Builder);
      expect(builders).toHaveLength(1);
    });
  });

  describe('construction progress', () => {
    it('should advance construction when builder is working', () => {
      placeCastleWithResources();

      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 9, r: 8 }, 1);
      if (!result.ok) throw new Error('Failed');
      const building = result.building;

      // Deliver resources
      tick(1.1);
      tick(1.1);

      // Spawn builder
      tick(0.1);

      // Move builder to arrive (adjacent tile, quick — UnitManager handles movement)
      for (let i = 0; i < 10; i++) {
        tick(0.5);
      }

      const builder = gameState.getAllUnits().find((u) => u.type === UnitType.Builder);
      expect(builder?.state).toBe(UnitState.Working);
      expect(building.constructionProgress).toBeGreaterThan(0);
    });

    it('should transition to Active when construction completes', () => {
      placeCastleWithResources();

      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 9, r: 8 }, 1);
      if (!result.ok) throw new Error('Failed');
      const building = result.building;

      // Deliver resources
      tick(1.1);
      tick(1.1);

      // Spawn builder and move to site
      tick(0.1);
      for (let i = 0; i < 10; i++) {
        tick(0.5);
      }

      // Run for full construction time
      const constructionTime = BUILDING_DEFINITIONS[BuildingType.WoodcutterHut].constructionTime;
      tick(constructionTime);

      expect(building.state).toBe(BuildingState.Active);
      expect(building.constructionProgress).toBe(1.0);
    });

    it('should send builder home after construction completes', () => {
      placeCastleWithResources();

      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 9, r: 8 }, 1);
      if (!result.ok) throw new Error('Failed');

      // Full lifecycle: deliver → spawn → arrive → construct
      tick(1.1);
      tick(1.1);
      tick(0.1);
      for (let i = 0; i < 10; i++) {
        tick(0.5);
      }

      const constructionTime = BUILDING_DEFINITIONS[BuildingType.WoodcutterHut].constructionTime;
      tick(constructionTime);

      const builder = gameState.getAllUnits().find((u) => u.type === UnitType.Builder);
      expect(builder?.state).toBe(UnitState.WalkingHome);
      expect(builder?.assignedBuildingId).toBeNull();
    });
  });

  describe('builder pathfinding failure', () => {
    it('should remove builder unit if path to building is blocked', () => {
      placeCastleWithResources();

      // Place building surrounded by water so it's unreachable (all 6 hex neighbors)
      grid.setTile(11, 7, TerrainType.Grassland, 0.5);
      for (const [q, r] of [[12, 7], [12, 6], [11, 6], [10, 7], [10, 8], [11, 8]]) {
        grid.setTile(q, r, TerrainType.Water, 0.0);
      }

      const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 11, r: 7 }, 1);
      if (!result.ok) throw new Error('Failed to place building');

      // Deliver resources
      construction.update(1.1);
      construction.update(1.1);
      expect(result.building.state).toBe(BuildingState.UnderConstruction);

      // Try to spawn builder — path will fail
      construction.update(0.1);

      // Builder should NOT accumulate as idle unit
      const builders = gameState.getAllUnits().filter((u) => u.type === UnitType.Builder);
      expect(builders).toHaveLength(0);

      // Repeated attempts should not pile up units
      construction.update(1.1);
      construction.update(1.1);
      const allUnits = gameState.getAllUnits();
      expect(allUnits).toHaveLength(0);
    });
  });

  describe('multiple buildings', () => {
    it('should handle multiple planned buildings simultaneously', () => {
      placeCastleWithResources();

      const r1 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 10, r: 8 }, 1);
      const r2 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 6, r: 8 }, 1);
      if (!r1.ok || !r2.ok) throw new Error('Failed');

      // Deliver to both (each needs 2 wood, Castle has 12)
      for (let i = 0; i < 5; i++) {
        construction.update(1.1);
      }

      // Both should eventually transition
      expect(r1.building.state).toBe(BuildingState.UnderConstruction);
      expect(r2.building.state).toBe(BuildingState.UnderConstruction);
    });
  });
});
