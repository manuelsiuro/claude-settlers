import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { FeedingManager, getHungerSpeedMultiplier, getHungerProductionMultiplier } from './FeedingManager';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { ResourceType } from './ResourceType';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';

describe('FeedingManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let feedingManager: FeedingManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    grid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    gameState = new GameState(grid);
    feedingManager = new FeedingManager(gameState);
  });

  describe('satiation decay', () => {
    it('should decay satiation over time for idle units', () => {
      const unit = gameState.spawnUnit(UnitType.Woodcutter, { q: 0, r: 0 }, 1);
      expect(unit.satiation).toBe(1.0);

      feedingManager.update(10.0); // 10 seconds
      // Base decay: 0.001/s * 10s = 0.01
      expect(unit.satiation).toBeCloseTo(0.99, 2);
    });

    it('should decay at same rate for working units (no working penalty)', () => {
      const unit = gameState.spawnUnit(UnitType.Woodcutter, { q: 0, r: 0 }, 1);
      unit.state = UnitState.Working;

      feedingManager.update(10.0);
      // Working decay: 0.001 * 1.0 * 10 = 0.01 (same as idle)
      expect(unit.satiation).toBeCloseTo(0.99, 2);
    });

    it('should decay slower for garrisoned knights', () => {
      const unit = gameState.spawnUnit(UnitType.Knight, { q: 0, r: 0 }, 1);
      unit.state = UnitState.Idle;
      unit.assignedBuildingId = 'building_1';

      feedingManager.update(10.0);
      // Garrisoned decay: 0.001 * 0.5 * 10 = 0.005
      expect(unit.satiation).toBeCloseTo(0.995, 3);
    });

    it('should decay slower for food producer workers', () => {
      // Place a farm (no adjacency requirement) and assign a worker
      const result = gameState.placeBuilding(BuildingType.Farm, { q: 3, r: 3 }, 1);
      if (!result.ok) throw new Error('Farm placement failed');
      result.building.state = BuildingState.Active;

      const unit = gameState.spawnUnit(UnitType.Farmer, { q: 3, r: 3 }, 1);
      unit.state = UnitState.Working;
      unit.assignedBuildingId = result.building.id;

      feedingManager.update(10.0);
      // Food producer decay: 0.001 * 1.0 * 0.5 * 10 = 0.005
      expect(unit.satiation).toBeCloseTo(0.995, 3);
    });

    it('should not go below 0', () => {
      const unit = gameState.spawnUnit(UnitType.Woodcutter, { q: 0, r: 0 }, 1);
      unit.satiation = 0.01;

      feedingManager.update(100.0); // Way more than needed
      expect(unit.satiation).toBe(0);
    });
  });

  describe('feeding from storage', () => {
    it('should feed hungry units from Castle inventory', () => {
      // Place a castle with fish
      const result = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
      if (!result.ok) throw new Error('Castle failed');
      result.building.outputInventory[ResourceType.Fish] = 5;
      result.building.state = BuildingState.Active;

      // Create a hungry unit
      const unit = gameState.spawnUnit(UnitType.Woodcutter, { q: 5, r: 5 }, 1);
      unit.satiation = 0.30;

      // Force feeding (need to wait for interval)
      feedingManager.update(5.1); // Trigger feeding interval
      // Fish restores 0.50, so satiation should be ~0.30 + 0.50 - small decay
      expect(unit.satiation).toBeGreaterThan(0.50);
      expect(result.building.outputInventory[ResourceType.Fish]).toBe(4);
    });

    it('should prioritize food producer workers over regular workers', () => {
      const result = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
      if (!result.ok) throw new Error('Castle failed');
      // Only 1 fish available
      result.building.outputInventory[ResourceType.Fish] = 1;
      result.building.state = BuildingState.Active;

      // Place a farm (no adjacency requirement)
      const farmResult = gameState.placeBuilding(BuildingType.Farm, { q: 4, r: 4 }, 1);
      if (!farmResult.ok) throw new Error('Farm placement failed');
      farmResult.building.state = BuildingState.Active;

      // Regular working unit
      const regularWorker = gameState.spawnUnit(UnitType.Woodcutter, { q: 5, r: 5 }, 1);
      regularWorker.state = UnitState.Working;
      regularWorker.satiation = 0.40;

      // Food producer worker (should get fed first)
      const foodWorker = gameState.spawnUnit(UnitType.Farmer, { q: 4, r: 4 }, 1);
      foodWorker.state = UnitState.Working;
      foodWorker.assignedBuildingId = farmResult.building.id;
      foodWorker.satiation = 0.40;

      feedingManager.update(5.1);

      // Food worker should have been fed (priority 1.5 < 2)
      expect(foodWorker.satiation).toBeGreaterThan(0.50);
      // Regular worker should NOT have been fed (only 1 fish was available)
      expect(regularWorker.satiation).toBeLessThan(0.50);
    });
  });

  describe('getState/loadState', () => {
    it('should round-trip state', () => {
      feedingManager.update(3.0);
      const state = feedingManager._getState();
      const fm2 = new FeedingManager(gameState);
      fm2._loadState(state);
      expect(fm2._getState()).toEqual(state);
    });
  });
});

describe('Hunger multipliers', () => {
  it('should return 1.0 when well-fed', () => {
    expect(getHungerSpeedMultiplier(0.80)).toBe(1.0);
    expect(getHungerProductionMultiplier(0.80)).toBe(1.0);
  });

  it('should apply hungry penalty below 0.35', () => {
    expect(getHungerSpeedMultiplier(0.30)).toBe(0.90);
    expect(getHungerProductionMultiplier(0.30)).toBe(0.95);
  });

  it('should apply starving penalty below 0.15', () => {
    expect(getHungerSpeedMultiplier(0.10)).toBe(0.75);
    expect(getHungerProductionMultiplier(0.10)).toBe(0.85);
  });
});
