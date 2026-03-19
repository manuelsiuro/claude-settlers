import { describe, it, expect } from 'vitest';
import {
  BuildingType,
  BUILDING_DEFINITIONS,
  getBuildingsByCategory,
  getBuildingsByTier,
} from './BuildingType';
import { ResourceType } from './ResourceType';
import { TerrainType } from './TerrainType';

describe('BuildingType', () => {
  it('should define all building types', () => {
    const types = Object.values(BuildingType);
    // 1 core + 5 tier1 + 8 tier2 + 9 tier3 + 2 logistics = 25 values
    expect(types.length).toBeGreaterThanOrEqual(25);
  });

  it('should have unique string values for each type', () => {
    const values = Object.values(BuildingType);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('should have a definition for every building type', () => {
    for (const type of Object.values(BuildingType)) {
      const def = BUILDING_DEFINITIONS[type];
      expect(def).toBeDefined();
      expect(def.label).toBeTruthy();
      expect(def.type).toBe(type);
      expect(def.allowedTerrain.length).toBeGreaterThan(0);
    }
  });
});

describe('BuildingDefinitions', () => {
  it('Castle should be tier 0 with no cost and no construction time', () => {
    const castle = BUILDING_DEFINITIONS[BuildingType.Castle];
    expect(castle.tier).toBe(0);
    expect(castle.cost).toHaveLength(0);
    expect(castle.constructionTime).toBe(0);
    expect(castle.influenceRadius).toBeGreaterThan(0);
    expect(castle.storageCapacity).toBeGreaterThan(0);
  });

  it('Tier 1 buildings should only cost Wood', () => {
    const tier1 = getBuildingsByTier(1);
    expect(tier1.length).toBeGreaterThan(0);
    for (const def of tier1) {
      for (const cost of def.cost) {
        expect(cost.resource).toBe(ResourceType.Wood);
      }
    }
  });

  it('production buildings should have valid production recipes', () => {
    for (const def of Object.values(BUILDING_DEFINITIONS)) {
      if (def.production) {
        expect(def.production.productionTime).toBeGreaterThan(0);
        // Dynamic-output buildings (e.g., Toolmaker) may have empty outputs
        for (const output of def.production.outputs) {
          expect(output.amount).toBeGreaterThan(0);
        }
      }
    }
  });

  it('military buildings should have knight slots and influence radius', () => {
    const military = getBuildingsByCategory('military');
    expect(military.length).toBeGreaterThan(0);
    for (const def of military) {
      expect(def.knightSlots).toBeGreaterThan(0);
      expect(def.influenceRadius).toBeGreaterThan(0);
    }
  });

  it('non-military buildings should have zero knight slots', () => {
    const nonMilitary = Object.values(BUILDING_DEFINITIONS).filter(
      (d) => d.category !== 'military' && d.category !== 'core',
    );
    for (const def of nonMilitary) {
      expect(def.knightSlots).toBe(0);
    }
  });

  it('mines should require mountain terrain', () => {
    const mines = [
      BuildingType.IronMine, BuildingType.CoalMine,
      BuildingType.GoldMine, BuildingType.StoneMine,
    ];
    for (const mineType of mines) {
      const def = BUILDING_DEFINITIONS[mineType];
      expect(def.allowedTerrain).toContain(TerrainType.Mountain);
    }
  });

  it('Fisherman Hut should require adjacent water', () => {
    const fisherman = BUILDING_DEFINITIONS[BuildingType.FishermanHut];
    expect(fisherman.adjacentTerrain).toBe(TerrainType.Water);
  });

  it('Sawmill should convert Wood to Planks', () => {
    const sawmill = BUILDING_DEFINITIONS[BuildingType.Sawmill];
    expect(sawmill.production).toBeTruthy();
    expect(sawmill.production!.inputs).toEqual([
      { resource: ResourceType.Wood, amount: 1 },
    ]);
    expect(sawmill.production!.outputs).toEqual([
      { resource: ResourceType.Planks, amount: 1 },
    ]);
  });

  it('Bakery should require Flour and Coal', () => {
    const bakery = BUILDING_DEFINITIONS[BuildingType.Bakery];
    expect(bakery.production).toBeTruthy();
    const inputResources = bakery.production!.inputs.map((i) => i.resource);
    expect(inputResources).toContain(ResourceType.Flour);
    expect(inputResources).toContain(ResourceType.CoalOre);
  });

  it('Barracks should have the most knight slots', () => {
    const barracks = BUILDING_DEFINITIONS[BuildingType.Barracks];
    const guardHut = BUILDING_DEFINITIONS[BuildingType.GuardHut];
    const watchtower = BUILDING_DEFINITIONS[BuildingType.Watchtower];
    expect(barracks.knightSlots).toBeGreaterThan(watchtower.knightSlots);
    expect(watchtower.knightSlots).toBeGreaterThan(guardHut.knightSlots);
  });
});

describe('getBuildingsByCategory', () => {
  it('should return military buildings', () => {
    const military = getBuildingsByCategory('military');
    expect(military.map((b) => b.type)).toEqual(
      expect.arrayContaining([
        BuildingType.GuardHut, BuildingType.Watchtower, BuildingType.Barracks,
      ]),
    );
  });

  it('should return processing buildings', () => {
    const processing = getBuildingsByCategory('processing');
    expect(processing.length).toBeGreaterThan(5);
    for (const def of processing) {
      expect(def.category).toBe('processing');
    }
  });
});

describe('getBuildingsByTier', () => {
  it('tier 0 should only contain Castle', () => {
    const tier0 = getBuildingsByTier(0);
    expect(tier0).toHaveLength(1);
    expect(tier0[0].type).toBe(BuildingType.Castle);
  });

  it('tier 1 should have basic buildings', () => {
    const tier1 = getBuildingsByTier(1);
    expect(tier1.length).toBeGreaterThanOrEqual(5);
  });
});
