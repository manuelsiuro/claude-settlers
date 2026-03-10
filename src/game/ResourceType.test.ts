import { describe, it, expect } from 'vitest';
import { ResourceType, RESOURCE_PROPERTIES } from './ResourceType';

describe('ResourceType', () => {
  it('should define all 17 resource types', () => {
    const types = Object.values(ResourceType);
    expect(types).toHaveLength(17);
  });

  it('should have unique string values for each type', () => {
    const values = Object.values(ResourceType);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('should have properties for every resource type', () => {
    for (const type of Object.values(ResourceType)) {
      expect(RESOURCE_PROPERTIES[type]).toBeDefined();
      expect(RESOURCE_PROPERTIES[type].label).toBeTruthy();
      expect(RESOURCE_PROPERTIES[type].category).toBeTruthy();
    }
  });

  it('should categorize raw materials correctly', () => {
    const rawTypes = [
      ResourceType.Wood, ResourceType.Stone, ResourceType.Grain,
      ResourceType.Fish, ResourceType.IronOre, ResourceType.CoalOre, ResourceType.GoldOre,
    ];
    for (const type of rawTypes) {
      expect(RESOURCE_PROPERTIES[type].category).toBe('raw');
    }
  });

  it('should categorize processed goods correctly', () => {
    const processedTypes = [
      ResourceType.Planks, ResourceType.Flour, ResourceType.Bread, ResourceType.Meat,
      ResourceType.IronBars, ResourceType.GoldBars, ResourceType.Tools,
      ResourceType.Swords, ResourceType.Shields,
    ];
    for (const type of processedTypes) {
      expect(RESOURCE_PROPERTIES[type].category).toBe('processed');
    }
  });

  it('should mark food resources correctly', () => {
    expect(RESOURCE_PROPERTIES[ResourceType.Fish].isFood).toBe(true);
    expect(RESOURCE_PROPERTIES[ResourceType.Bread].isFood).toBe(true);
    expect(RESOURCE_PROPERTIES[ResourceType.Meat].isFood).toBe(true);
    expect(RESOURCE_PROPERTIES[ResourceType.Wood].isFood).toBe(false);
    expect(RESOURCE_PROPERTIES[ResourceType.IronBars].isFood).toBe(false);
  });

  it('should categorize pigs as animal', () => {
    expect(RESOURCE_PROPERTIES[ResourceType.Pigs].category).toBe('animal');
  });
});
