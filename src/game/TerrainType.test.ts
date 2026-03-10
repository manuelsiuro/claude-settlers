import { describe, it, expect } from 'vitest';
import { TerrainType, TERRAIN_PROPERTIES } from './TerrainType';

describe('TerrainType', () => {
  it('should have 5 terrain types', () => {
    const types = Object.values(TerrainType);
    expect(types.length).toBe(5);
  });

  it('should have properties for every terrain type', () => {
    for (const type of Object.values(TerrainType)) {
      expect(TERRAIN_PROPERTIES[type]).toBeDefined();
      expect(TERRAIN_PROPERTIES[type].label).toBeTruthy();
    }
  });

  it('grassland should be buildable', () => {
    expect(TERRAIN_PROPERTIES[TerrainType.Grassland].buildable).toBe(true);
  });

  it('water should be impassable', () => {
    expect(TERRAIN_PROPERTIES[TerrainType.Water].movementCost).toBe(Infinity);
  });

  it('desert should not be buildable', () => {
    expect(TERRAIN_PROPERTIES[TerrainType.Desert].buildable).toBe(false);
  });

  it('forest and mountain should be harvestable', () => {
    expect(TERRAIN_PROPERTIES[TerrainType.Forest].harvestable).toBe(true);
    expect(TERRAIN_PROPERTIES[TerrainType.Mountain].harvestable).toBe(true);
  });
});
