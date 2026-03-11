import { describe, it, expect, beforeEach } from 'vitest';
import type { ResourceInventory } from './Building';
import {
  BuildingState,
  createBuilding,
  getBuildingDefinition,
  hasAllConstructionResources,
  getRemainingConstructionCost,
  getInventoryTotal,
  hasOutputSpace,
  hasRequiredInputs,
  addToInventory,
  removeFromInventory,
  getInventoryAmount,
  initializeCastleResources,
  CASTLE_STARTING_RESOURCES,
  resetBuildingIdCounter,
} from './Building';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { ResourceType } from './ResourceType';

describe('Building', () => {
  beforeEach(() => {
    resetBuildingIdCounter();
  });

  describe('createBuilding', () => {
    it('should create a building with a unique ID', () => {
      const b1 = createBuilding(BuildingType.WoodcutterHut, { q: 0, r: 0 }, 1);
      const b2 = createBuilding(BuildingType.Sawmill, { q: 1, r: 0 }, 1);
      expect(b1.id).toBe('building_1');
      expect(b2.id).toBe('building_2');
    });

    it('Castle should start as Active with full construction', () => {
      const castle = createBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
      expect(castle.state).toBe(BuildingState.Active);
      expect(castle.constructionProgress).toBe(1);
    });

    it('non-Castle buildings should start as Planned', () => {
      const hut = createBuilding(BuildingType.WoodcutterHut, { q: 3, r: 2 }, 1);
      expect(hut.state).toBe(BuildingState.Planned);
      expect(hut.constructionProgress).toBe(0);
    });

    it('should store coordinate and player ID', () => {
      const b = createBuilding(BuildingType.Farm, { q: 10, r: 7 }, 2);
      expect(b.coord).toEqual({ q: 10, r: 7 });
      expect(b.playerId).toBe(2);
    });

    it('should initialize with empty inventories', () => {
      const b = createBuilding(BuildingType.Sawmill, { q: 0, r: 0 }, 1);
      expect(getInventoryTotal(b.inputInventory)).toBe(0);
      expect(getInventoryTotal(b.outputInventory)).toBe(0);
      expect(getInventoryTotal(b.constructionDelivered)).toBe(0);
    });
  });

  describe('getBuildingDefinition', () => {
    it('should return the correct definition', () => {
      const b = createBuilding(BuildingType.Sawmill, { q: 0, r: 0 }, 1);
      const def = getBuildingDefinition(b);
      expect(def.type).toBe(BuildingType.Sawmill);
      expect(def.label).toBe('Sawmill');
    });
  });

  describe('hasAllConstructionResources', () => {
    it('Castle should always have all resources (no cost)', () => {
      const castle = createBuilding(BuildingType.Castle, { q: 0, r: 0 }, 1);
      expect(hasAllConstructionResources(castle)).toBe(true);
    });

    it('building with no deliveries should not have all resources', () => {
      const hut = createBuilding(BuildingType.WoodcutterHut, { q: 0, r: 0 }, 1);
      expect(hasAllConstructionResources(hut)).toBe(false);
    });

    it('building with all resources delivered should return true', () => {
      const hut = createBuilding(BuildingType.WoodcutterHut, { q: 0, r: 0 }, 1);
      hut.constructionDelivered[ResourceType.Wood] = 2;
      expect(hasAllConstructionResources(hut)).toBe(true);
    });

    it('building with partial resources should return false', () => {
      const sawmill = createBuilding(BuildingType.Sawmill, { q: 0, r: 0 }, 1);
      sawmill.constructionDelivered[ResourceType.Wood] = 1; // needs 3
      expect(hasAllConstructionResources(sawmill)).toBe(false);
    });
  });

  describe('getRemainingConstructionCost', () => {
    it('should return full cost when nothing delivered', () => {
      const hut = createBuilding(BuildingType.WoodcutterHut, { q: 0, r: 0 }, 1);
      const remaining = getRemainingConstructionCost(hut);
      expect(remaining).toEqual([{ resource: ResourceType.Wood, amount: 2 }]);
    });

    it('should return empty when all delivered', () => {
      const hut = createBuilding(BuildingType.WoodcutterHut, { q: 0, r: 0 }, 1);
      hut.constructionDelivered[ResourceType.Wood] = 2;
      const remaining = getRemainingConstructionCost(hut);
      expect(remaining).toHaveLength(0);
    });

    it('should handle multi-resource costs', () => {
      const watchtower = createBuilding(BuildingType.Watchtower, { q: 0, r: 0 }, 1);
      watchtower.constructionDelivered[ResourceType.Wood] = 3; // fulfilled
      watchtower.constructionDelivered[ResourceType.Stone] = 1; // needs 3, delivered 1
      // Planks: needs 2, delivered 0
      const remaining = getRemainingConstructionCost(watchtower);
      expect(remaining).toEqual(
        expect.arrayContaining([
          { resource: ResourceType.Stone, amount: 2 },
          { resource: ResourceType.Planks, amount: 2 },
        ]),
      );
      expect(remaining).toHaveLength(2);
    });
  });

  describe('getInventoryTotal', () => {
    it('should return 0 for empty inventory', () => {
      expect(getInventoryTotal({})).toBe(0);
    });

    it('should sum all resource amounts', () => {
      expect(
        getInventoryTotal({
          [ResourceType.Wood]: 3,
          [ResourceType.Stone]: 5,
        }),
      ).toBe(8);
    });
  });

  describe('hasOutputSpace', () => {
    it('should have space when empty', () => {
      const sawmill = createBuilding(BuildingType.Sawmill, { q: 0, r: 0 }, 1);
      expect(hasOutputSpace(sawmill)).toBe(true);
    });

    it('should not have space when full', () => {
      const sawmill = createBuilding(BuildingType.Sawmill, { q: 0, r: 0 }, 1);
      const capacity = BUILDING_DEFINITIONS[BuildingType.Sawmill].storageCapacity;
      sawmill.outputInventory[ResourceType.Planks] = capacity;
      expect(hasOutputSpace(sawmill)).toBe(false);
    });
  });

  describe('hasRequiredInputs', () => {
    it('should return false for buildings without production', () => {
      const guardHut = createBuilding(BuildingType.GuardHut, { q: 0, r: 0 }, 1);
      expect(hasRequiredInputs(guardHut)).toBe(false);
    });

    it('should return true for gathering buildings (no inputs)', () => {
      const woodcutter = createBuilding(BuildingType.WoodcutterHut, { q: 0, r: 0 }, 1);
      expect(hasRequiredInputs(woodcutter)).toBe(true);
    });

    it('should return false when inputs missing', () => {
      const sawmill = createBuilding(BuildingType.Sawmill, { q: 0, r: 0 }, 1);
      expect(hasRequiredInputs(sawmill)).toBe(false);
    });

    it('should return true when all inputs present', () => {
      const sawmill = createBuilding(BuildingType.Sawmill, { q: 0, r: 0 }, 1);
      sawmill.inputInventory[ResourceType.Wood] = 1;
      expect(hasRequiredInputs(sawmill)).toBe(true);
    });

    it('should check multiple inputs (Bakery needs Flour + Coal)', () => {
      const bakery = createBuilding(BuildingType.Bakery, { q: 0, r: 0 }, 1);
      bakery.inputInventory[ResourceType.Flour] = 1;
      expect(hasRequiredInputs(bakery)).toBe(false);
      bakery.inputInventory[ResourceType.CoalOre] = 1;
      expect(hasRequiredInputs(bakery)).toBe(true);
    });
  });

  describe('addToInventory', () => {
    it('should add resources to empty inventory', () => {
      const inv: ResourceInventory = {};
      addToInventory(inv, ResourceType.Wood, 5);
      expect(inv[ResourceType.Wood]).toBe(5);
    });

    it('should accumulate resources', () => {
      const inv = { [ResourceType.Wood]: 3 };
      addToInventory(inv, ResourceType.Wood, 2);
      expect(inv[ResourceType.Wood]).toBe(5);
    });
  });

  describe('removeFromInventory', () => {
    it('should remove resources and return amount removed', () => {
      const inv = { [ResourceType.Wood]: 5 };
      const removed = removeFromInventory(inv, ResourceType.Wood, 3);
      expect(removed).toBe(3);
      expect(inv[ResourceType.Wood]).toBe(2);
    });

    it('should not remove more than available', () => {
      const inv = { [ResourceType.Wood]: 2 };
      const removed = removeFromInventory(inv, ResourceType.Wood, 5);
      expect(removed).toBe(2);
      expect(inv[ResourceType.Wood]).toBeUndefined(); // cleaned up
    });

    it('should return 0 for missing resource', () => {
      const inv: ResourceInventory = {};
      const removed = removeFromInventory(inv, ResourceType.Wood, 1);
      expect(removed).toBe(0);
    });
  });

  describe('getInventoryAmount', () => {
    it('should return amount for existing resource', () => {
      const inv = { [ResourceType.Stone]: 7 };
      expect(getInventoryAmount(inv, ResourceType.Stone)).toBe(7);
    });

    it('should return 0 for missing resource', () => {
      expect(getInventoryAmount({} as ResourceInventory, ResourceType.Stone)).toBe(0);
    });
  });

  describe('Castle starting resources', () => {
    it('should have defined starting resources', () => {
      expect(CASTLE_STARTING_RESOURCES.length).toBeGreaterThan(0);
      for (const { amount } of CASTLE_STARTING_RESOURCES) {
        expect(amount).toBeGreaterThan(0);
      }
    });

    it('should initialize castle with resources', () => {
      const castle = createBuilding(BuildingType.Castle, { q: 0, r: 0 }, 1);
      initializeCastleResources(castle);

      // Should have wood, stone, planks, tools
      expect(getInventoryAmount(castle.outputInventory, ResourceType.Wood)).toBeGreaterThan(0);
      expect(getInventoryAmount(castle.outputInventory, ResourceType.Stone)).toBeGreaterThan(0);
      expect(getInventoryAmount(castle.outputInventory, ResourceType.Planks)).toBeGreaterThan(0);
      expect(getInventoryAmount(castle.outputInventory, ResourceType.Tools)).toBeGreaterThan(0);
    });
  });
});
