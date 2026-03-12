import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionManager, getDistanceMultiplier, getDistanceRating } from './ProductionManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';
import { ResourceType } from './ResourceType';

describe('ProductionManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let production: ProductionManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();

    grid = new HexGrid(16, 16);
    for (let q = 0; q < 16; q++) {
      for (let r = 0; r < 16; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    grid.setTile(6, 8, TerrainType.Water, 0.1); // For fisherman
    grid.setTile(3, 4, TerrainType.Forest, 0.5); // Near woodcutter at (4,4)
    grid.setTile(5, 4, TerrainType.Mountain, 0.5); // Near quarry at (4,4)

    gameState = new GameState(grid);
    production = new ProductionManager(gameState);
  });

  function placeActiveBuilding(type: BuildingType, q: number, r: number) {
    const result = gameState.placeBuilding(type, { q, r }, 1);
    if (!result.ok) throw new Error(`Failed to place ${type}: ${result.error}`);
    result.building.state = BuildingState.Active;
    return result.building;
  }

  function assignWorkingUnit(buildingId: string, unitType: UnitType) {
    const building = gameState.getBuilding(buildingId)!;
    const unit = gameState.spawnUnit(unitType, building.coord, 1);
    gameState.assignWorkerToBuilding(unit.id, buildingId);
    unit.state = UnitState.Working;
    return unit;
  }

  describe('gathering buildings (no inputs)', () => {
    it('should produce output over time for quarry', () => {
      const building = placeActiveBuilding(BuildingType.Quarry, 4, 4);
      assignWorkingUnit(building.id, UnitType.Stonemason);

      const def = BUILDING_DEFINITIONS[BuildingType.Quarry];
      const prodTime = def.production!.productionTime;

      // Run for full production cycle
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Stone]).toBe(1);
      expect(building.productionProgress).toBe(0);
    });

    it('should produce stone from quarry', () => {
      const building = placeActiveBuilding(BuildingType.Quarry, 4, 4);
      assignWorkingUnit(building.id, UnitType.Stonemason);

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Quarry].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Stone]).toBe(1);
    });

    it('should produce fish from fisherman', () => {
      const building = placeActiveBuilding(BuildingType.FishermanHut, 5, 8);
      assignWorkingUnit(building.id, UnitType.Fisherman);

      const prodTime = BUILDING_DEFINITIONS[BuildingType.FishermanHut].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Fish]).toBe(1);
    });

    it('should accumulate output over multiple cycles', () => {
      const building = placeActiveBuilding(BuildingType.Quarry, 4, 4);
      assignWorkingUnit(building.id, UnitType.Stonemason);

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Quarry].production!.productionTime;

      production.update(prodTime);
      production.update(prodTime);
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Stone]).toBe(3);
    });

    it('should not produce beyond storage capacity', () => {
      const building = placeActiveBuilding(BuildingType.Quarry, 4, 4);
      assignWorkingUnit(building.id, UnitType.Stonemason);

      const def = BUILDING_DEFINITIONS[BuildingType.Quarry];
      const prodTime = def.production!.productionTime;

      // Fill to capacity
      building.outputInventory[ResourceType.Stone] = def.storageCapacity;

      production.update(prodTime);

      // Should not exceed capacity
      expect(building.outputInventory[ResourceType.Stone]).toBe(def.storageCapacity);
    });

    it('should advance production progress incrementally', () => {
      const building = placeActiveBuilding(BuildingType.Quarry, 4, 4);
      assignWorkingUnit(building.id, UnitType.Stonemason);

      // Run for half the production time
      const prodTime = BUILDING_DEFINITIONS[BuildingType.Quarry].production!.productionTime;
      production.update(prodTime / 2);

      expect(building.productionProgress).toBeCloseTo(0.5, 5);
      expect(building.outputInventory[ResourceType.Stone]).toBeUndefined();
    });
  });

  describe('processing buildings (with inputs)', () => {
    it('should produce planks from wood at sawmill', () => {
      const building = placeActiveBuilding(BuildingType.Sawmill, 4, 4);
      assignWorkingUnit(building.id, UnitType.SawmillWorker);

      // Add input wood
      building.inputInventory[ResourceType.Wood] = 3;

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Sawmill].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Planks]).toBe(1);
      expect(building.inputInventory[ResourceType.Wood]).toBe(2); // consumed 1
    });

    it('should produce flour from grain at windmill', () => {
      const building = placeActiveBuilding(BuildingType.Windmill, 4, 4);
      assignWorkingUnit(building.id, UnitType.Miller);

      building.inputInventory[ResourceType.Grain] = 2;

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Windmill].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Flour]).toBe(1);
      expect(building.inputInventory[ResourceType.Grain]).toBe(1);
    });

    it('should not produce without required inputs', () => {
      const building = placeActiveBuilding(BuildingType.Sawmill, 4, 4);
      assignWorkingUnit(building.id, UnitType.SawmillWorker);

      // No wood in input — should not produce
      const prodTime = BUILDING_DEFINITIONS[BuildingType.Sawmill].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Planks]).toBeUndefined();
      expect(building.productionProgress).toBe(0);
    });

    it('should consume multiple inputs (smelter: iron ore + coal)', () => {
      const building = placeActiveBuilding(BuildingType.IronSmelter, 4, 4);
      assignWorkingUnit(building.id, UnitType.SmelterWorker);

      building.inputInventory[ResourceType.IronOre] = 2;
      building.inputInventory[ResourceType.CoalOre] = 2;

      const prodTime = BUILDING_DEFINITIONS[BuildingType.IronSmelter].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.IronBars]).toBe(1);
      expect(building.inputInventory[ResourceType.IronOre]).toBe(1);
      expect(building.inputInventory[ResourceType.CoalOre]).toBe(1);
    });

    it('should produce multiple outputs (blacksmith: sword + shield)', () => {
      const building = placeActiveBuilding(BuildingType.BlacksmithArmory, 4, 4);
      assignWorkingUnit(building.id, UnitType.Blacksmith);

      building.inputInventory[ResourceType.IronBars] = 2;
      building.inputInventory[ResourceType.CoalOre] = 1;
      building.inputInventory[ResourceType.Planks] = 1;

      const prodTime = BUILDING_DEFINITIONS[BuildingType.BlacksmithArmory].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Swords]).toBe(1);
      expect(building.outputInventory[ResourceType.Shields]).toBe(1);
    });
  });

  describe('worker requirements', () => {
    it('should not produce without a worker', () => {
      const building = placeActiveBuilding(BuildingType.Quarry, 4, 4);
      // No worker assigned

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Quarry].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Stone]).toBeUndefined();
      expect(building.productionProgress).toBe(0);
    });

    it('should not produce if worker is not in Working state', () => {
      const building = placeActiveBuilding(BuildingType.Quarry, 4, 4);
      const unit = gameState.spawnUnit(UnitType.Stonemason, building.coord, 1);
      gameState.assignWorkerToBuilding(unit.id, building.id);
      unit.state = UnitState.WalkingToWork; // Not yet working

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Quarry].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Stone]).toBeUndefined();
    });

    it('should not produce for Planned buildings', () => {
      const result = gameState.placeBuilding(BuildingType.Quarry, { q: 4, r: 4 }, 1);
      if (!result.ok) throw new Error('Failed');
      // Building stays Planned (default)

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Quarry].production!.productionTime;
      production.update(prodTime);

      expect(result.building.outputInventory[ResourceType.Stone]).toBeUndefined();
    });
  });

  describe('distance-scaled production', () => {
    it('should produce at base rate with distance 0', () => {
      const building = placeActiveBuilding(BuildingType.Quarry, 4, 4);
      building.resourceDistance = 0;
      assignWorkingUnit(building.id, UnitType.Stonemason);

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Quarry].production!.productionTime;
      production.update(prodTime);

      expect(building.outputInventory[ResourceType.Stone]).toBe(1);
    });

    it('should produce slower with distance 5 (2.0x)', () => {
      const building = placeActiveBuilding(BuildingType.Quarry, 4, 4);
      building.resourceDistance = 5;
      assignWorkingUnit(building.id, UnitType.Stonemason);

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Quarry].production!.productionTime;
      // At distance 5, multiplier = 1.0 + (5-1)*0.25 = 2.0
      // So base production time should not complete in prodTime
      production.update(prodTime);
      expect(building.outputInventory[ResourceType.Stone]).toBeUndefined();

      // Should complete in 2.0x the base time
      production.update(prodTime);
      expect(building.outputInventory[ResourceType.Stone]).toBe(1);
    });

    it('should cap multiplier at 3.0x for distance 10+', () => {
      expect(getDistanceMultiplier(10)).toBe(3.0);
      expect(getDistanceMultiplier(15)).toBe(3.0);
      expect(getDistanceMultiplier(20)).toBe(3.0);
    });

    it('processing buildings should ignore distance', () => {
      const building = placeActiveBuilding(BuildingType.Sawmill, 4, 4);
      building.resourceDistance = 10; // should be ignored
      assignWorkingUnit(building.id, UnitType.SawmillWorker);
      building.inputInventory[ResourceType.Wood] = 1;

      const prodTime = BUILDING_DEFINITIONS[BuildingType.Sawmill].production!.productionTime;
      production.update(prodTime);

      // Should produce at base rate, ignoring resourceDistance
      expect(building.outputInventory[ResourceType.Planks]).toBe(1);
    });
  });

  describe('getDistanceMultiplier', () => {
    it('should return 1.0 for distance 0-1', () => {
      expect(getDistanceMultiplier(0)).toBe(1.0);
      expect(getDistanceMultiplier(1)).toBe(1.0);
    });

    it('should return correct values for intermediate distances', () => {
      expect(getDistanceMultiplier(2)).toBeCloseTo(1.25);
      expect(getDistanceMultiplier(3)).toBeCloseTo(1.5);
      expect(getDistanceMultiplier(5)).toBeCloseTo(2.0);
      expect(getDistanceMultiplier(9)).toBeCloseTo(3.0);
    });
  });

  describe('getDistanceRating', () => {
    it('should return correct ratings for multiplier thresholds', () => {
      expect(getDistanceRating(1.0).label).toBe('Perfect');
      expect(getDistanceRating(1.5).label).toBe('Good');
      expect(getDistanceRating(1.75).label).toBe('Medium');
      expect(getDistanceRating(2.5).label).toBe('Poor');
    });
  });

  describe('buildings without production', () => {
    it('should skip Castle (no production recipe)', () => {
      placeActiveBuilding(BuildingType.Castle, 8, 8);

      // Should not crash
      production.update(10);
    });

    it('should skip Warehouse (no production recipe)', () => {
      placeActiveBuilding(BuildingType.Warehouse, 4, 4);
      production.update(10);
    });
  });
});
