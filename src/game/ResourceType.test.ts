import { describe, it, expect } from 'vitest';
import { ResourceType, RESOURCE_PROPERTIES, TOOL_TYPES, isToolType, isFood } from './ResourceType';

describe('ResourceType', () => {
  it('should define all 49 resource types', () => {
    const types = Object.values(ResourceType);
    expect(types).toHaveLength(49);
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
      ResourceType.IronBars, ResourceType.GoldBars,
      ResourceType.Swords, ResourceType.Shields,
      ...TOOL_TYPES,
    ];
    for (const type of processedTypes) {
      expect(RESOURCE_PROPERTIES[type].category).toBe('processed');
    }
  });

  it('should mark food resources correctly via satiationValue', () => {
    expect(isFood(ResourceType.Fish)).toBe(true);
    expect(isFood(ResourceType.Bread)).toBe(true);
    expect(isFood(ResourceType.Meat)).toBe(true);
    expect(isFood(ResourceType.Wood)).toBe(false);
    expect(isFood(ResourceType.IronBars)).toBe(false);
  });

  it('should categorize pigs as animal', () => {
    expect(RESOURCE_PROPERTIES[ResourceType.Pigs].category).toBe('animal');
  });

  it('should define 11 tool types', () => {
    expect(TOOL_TYPES).toHaveLength(11);
    for (const t of TOOL_TYPES) {
      expect(isToolType(t)).toBe(true);
    }
  });

  it('should not mark non-tools as tool types', () => {
    expect(isToolType(ResourceType.Wood)).toBe(false);
    expect(isToolType(ResourceType.Swords)).toBe(false);
  });
});
