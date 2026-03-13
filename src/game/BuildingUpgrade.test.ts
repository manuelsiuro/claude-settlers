import { describe, it, expect, beforeEach } from 'vitest';
import { BuildingType } from './BuildingType';
import { createBuilding, hasInputSpace, hasOutputSpace, addToInventory } from './Building';
import { ResourceType } from './ResourceType';
import {
  BUILDING_UPGRADES,
  UpgradeAxis,
  getUpgradeConfig,
  getUpgradeCost,
  getEffectiveStorageCapacity,
  getProductionSpeedMultiplier,
  getMaxWorkers,
  canUpgrade,
  getUpgradeTime,
} from './BuildingUpgrade';
import { resetBuildingIdCounter } from './Building';

describe('BuildingUpgrade', () => {
  beforeEach(() => {
    resetBuildingIdCounter();
  });

  describe('BUILDING_UPGRADES registry', () => {
    it('should have storage upgrades for buildings with storageCapacity > 0', () => {
      expect(BUILDING_UPGRADES[BuildingType.Castle]?.[UpgradeAxis.Storage]).toBeDefined();
      expect(BUILDING_UPGRADES[BuildingType.Sawmill]?.[UpgradeAxis.Storage]).toBeDefined();
      expect(BUILDING_UPGRADES[BuildingType.Warehouse]?.[UpgradeAxis.Storage]).toBeDefined();
    });

    it('should NOT have storage upgrades for ForesterHut (storageCapacity = 0)', () => {
      expect(BUILDING_UPGRADES[BuildingType.ForesterHut]).toBeUndefined();
    });

    it('should have production upgrades for buildings with production recipes', () => {
      expect(BUILDING_UPGRADES[BuildingType.Sawmill]?.[UpgradeAxis.Production]).toBeDefined();
      expect(BUILDING_UPGRADES[BuildingType.Windmill]?.[UpgradeAxis.Production]).toBeDefined();
    });

    it('should NOT have production upgrades for Castle (no production)', () => {
      expect(BUILDING_UPGRADES[BuildingType.Castle]?.[UpgradeAxis.Production]).toBeUndefined();
    });

    it('should have worker upgrades only for processing buildings', () => {
      expect(BUILDING_UPGRADES[BuildingType.Sawmill]?.[UpgradeAxis.Workers]).toBeDefined();
      expect(BUILDING_UPGRADES[BuildingType.Bakery]?.[UpgradeAxis.Workers]).toBeDefined();
      // Gathering buildings should not have worker upgrades
      expect(BUILDING_UPGRADES[BuildingType.WoodcutterHut]?.[UpgradeAxis.Workers]).toBeUndefined();
      expect(BUILDING_UPGRADES[BuildingType.Farm]?.[UpgradeAxis.Workers]).toBeUndefined();
    });
  });

  describe('getUpgradeConfig', () => {
    it('should return config with max level 10 for valid building/axis pairs', () => {
      const config = getUpgradeConfig(BuildingType.Sawmill, UpgradeAxis.Storage);
      expect(config).not.toBeNull();
      expect(config!.maxLevel).toBe(10);
      expect(config!.levels).toHaveLength(10);
    });

    it('should return null for invalid pairs', () => {
      expect(getUpgradeConfig(BuildingType.Castle, UpgradeAxis.Production)).toBeNull();
    });

    it('should have 10 levels for production upgrades', () => {
      const config = getUpgradeConfig(BuildingType.Sawmill, UpgradeAxis.Production);
      expect(config).not.toBeNull();
      expect(config!.maxLevel).toBe(10);
      expect(config!.levels).toHaveLength(10);
    });

    it('should have 10 levels for worker upgrades on processing buildings', () => {
      const config = getUpgradeConfig(BuildingType.Sawmill, UpgradeAxis.Workers);
      expect(config).not.toBeNull();
      expect(config!.maxLevel).toBe(10);
      expect(config!.levels).toHaveLength(10);
    });
  });

  describe('getUpgradeCost', () => {
    it('should return cost for level 0→1', () => {
      const cost = getUpgradeCost(BuildingType.Sawmill, UpgradeAxis.Storage, 0);
      expect(cost).not.toBeNull();
      expect(cost!.length).toBeGreaterThan(0);
    });

    it('should return null when at max level', () => {
      const cost = getUpgradeCost(BuildingType.Sawmill, UpgradeAxis.Storage, 10);
      expect(cost).toBeNull();
    });

    it('should scale costs with level — higher levels cost more', () => {
      const cost1 = getUpgradeCost(BuildingType.Sawmill, UpgradeAxis.Storage, 0)!;
      const cost5 = getUpgradeCost(BuildingType.Sawmill, UpgradeAxis.Storage, 4)!;
      const cost10 = getUpgradeCost(BuildingType.Sawmill, UpgradeAxis.Storage, 9)!;

      const totalCost = (c: typeof cost1) => c.reduce((sum, r) => sum + r.amount, 0);
      expect(totalCost(cost5)).toBeGreaterThan(totalCost(cost1));
      expect(totalCost(cost10)).toBeGreaterThan(totalCost(cost5));
    });

    it('should add iron at level 4+ and gold at level 7+', () => {
      const cost3 = getUpgradeCost(BuildingType.Sawmill, UpgradeAxis.Storage, 2)!;
      const cost4 = getUpgradeCost(BuildingType.Sawmill, UpgradeAxis.Storage, 3)!;
      const cost7 = getUpgradeCost(BuildingType.Sawmill, UpgradeAxis.Storage, 6)!;

      const hasIron = (c: typeof cost3) => c.some((r) => r.resource === ResourceType.IronBars);
      const hasGold = (c: typeof cost3) => c.some((r) => r.resource === ResourceType.GoldBars);

      expect(hasIron(cost3)).toBe(false);
      expect(hasIron(cost4)).toBe(true);
      expect(hasGold(cost4)).toBe(false);
      expect(hasGold(cost7)).toBe(true);
    });
  });

  describe('getEffectiveStorageCapacity', () => {
    it('should return base capacity at level 0', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      expect(getEffectiveStorageCapacity(building)).toBe(6); // base capacity
    });

    it('should return 1.4x at level 1', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.upgradeLevels[UpgradeAxis.Storage] = 1;
      // ceil(6 * 1.4) = ceil(8.4) = 9
      expect(getEffectiveStorageCapacity(building)).toBe(9);
    });

    it('should return 3.0x at level 5', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.upgradeLevels[UpgradeAxis.Storage] = 5;
      // ceil(6 * 3.0) = 18
      expect(getEffectiveStorageCapacity(building)).toBe(18);
    });

    it('should return 5.0x at level 10', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.upgradeLevels[UpgradeAxis.Storage] = 10;
      // ceil(6 * 5.0) = 30
      expect(getEffectiveStorageCapacity(building)).toBe(30);
    });
  });

  describe('getProductionSpeedMultiplier', () => {
    it('should return 1.0 at level 0', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      expect(getProductionSpeedMultiplier(building)).toBe(1.0);
    });

    it('should return 0.95 at level 1 (5% faster)', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.upgradeLevels[UpgradeAxis.Production] = 1;
      expect(getProductionSpeedMultiplier(building)).toBe(0.95);
    });

    it('should return 0.75 at level 5 (33% faster)', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.upgradeLevels[UpgradeAxis.Production] = 5;
      expect(getProductionSpeedMultiplier(building)).toBe(0.75);
    });

    it('should return 0.50 at level 10 (2x throughput)', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.upgradeLevels[UpgradeAxis.Production] = 10;
      expect(getProductionSpeedMultiplier(building)).toBe(0.50);
    });
  });

  describe('getMaxWorkers', () => {
    it('should return 1 for buildings without worker upgrades', () => {
      const building = createBuilding(BuildingType.WoodcutterHut, { q: 5, r: 5 }, 1);
      expect(getMaxWorkers(building)).toBe(1);
    });

    it('should return 2 for processing buildings at worker level 1', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.upgradeLevels[UpgradeAxis.Workers] = 1;
      expect(getMaxWorkers(building)).toBe(2);
    });

    it('should return 4 at worker level 6', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.upgradeLevels[UpgradeAxis.Workers] = 6;
      expect(getMaxWorkers(building)).toBe(4);
    });

    it('should return 6 at worker level 10', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.upgradeLevels[UpgradeAxis.Workers] = 10;
      expect(getMaxWorkers(building)).toBe(6);
    });
  });

  describe('canUpgrade', () => {
    it('should return true for active building below max level', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.state = 'active';
      expect(canUpgrade(building, UpgradeAxis.Storage)).toBe(true);
    });

    it('should return false for non-active building', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.state = 'planned';
      expect(canUpgrade(building, UpgradeAxis.Storage)).toBe(false);
    });

    it('should return false when already upgrading', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.state = 'active';
      building.activeUpgrade = { axis: 'storage', targetLevel: 1, resourcesDelivered: {}, constructionProgress: 0 };
      expect(canUpgrade(building, UpgradeAxis.Storage)).toBe(false);
    });

    it('should return false when at max level', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.state = 'active';
      building.upgradeLevels[UpgradeAxis.Storage] = 10;
      expect(canUpgrade(building, UpgradeAxis.Storage)).toBe(false);
    });
  });

  describe('hasInputSpace with upgrades', () => {
    it('should use effective capacity from storage upgrade', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.state = 'active';
      // Fill to base capacity (6)
      for (let i = 0; i < 6; i++) {
        addToInventory(building.inputInventory, ResourceType.Wood, 1);
      }
      expect(hasInputSpace(building)).toBe(false);

      // Upgrade storage to level 1 (capacity becomes 8)
      building.upgradeLevels[UpgradeAxis.Storage] = 1;
      expect(hasInputSpace(building)).toBe(true);
    });
  });

  describe('hasOutputSpace with upgrades', () => {
    it('should use effective capacity from storage upgrade', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      building.state = 'active';
      // Fill to base capacity (6)
      for (let i = 0; i < 6; i++) {
        addToInventory(building.outputInventory, ResourceType.Planks, 1);
      }
      expect(hasOutputSpace(building)).toBe(false);

      // Upgrade storage to level 1 (capacity becomes 8)
      building.upgradeLevels[UpgradeAxis.Storage] = 1;
      expect(hasOutputSpace(building)).toBe(true);
    });
  });

  describe('getUpgradeTime', () => {
    it('should scale with target level', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      // Sawmill constructionTime = 25
      // Level 1: 25 * (0.3 + 0.1 * 1) = 25 * 0.4 = 10
      expect(getUpgradeTime(building, 1)).toBe(10);
      // Level 5: 25 * (0.3 + 0.1 * 5) = 25 * 0.8 = 20
      expect(getUpgradeTime(building, 5)).toBe(20);
      // Level 10: 25 * (0.3 + 0.1 * 10) = 25 * 1.3 = 32.5
      expect(getUpgradeTime(building, 10)).toBe(32.5);
    });

    it('should default to level 1 when no target level specified', () => {
      const building = createBuilding(BuildingType.Sawmill, { q: 5, r: 5 }, 1);
      expect(getUpgradeTime(building)).toBe(10);
    });
  });
});
