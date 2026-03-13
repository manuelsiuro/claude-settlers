import { describe, it, expect } from 'vitest';
import {
  createDefaultDistribution,
  getResourcePriority,
  setResourcePriority,
  getBuildingImportance,
  setBuildingImportance,
  getRoutingScore,
  getResourceCategoryWeights,
  setResourceCategoryWeights,
  serializeDistribution,
  deserializeDistribution,
} from './GoodsDistribution';
import { ResourceType } from './ResourceType';

describe('GoodsDistribution', () => {
  it('should create default settings with priority 3 for all resources', () => {
    const settings = createDefaultDistribution();
    expect(getResourcePriority(settings, ResourceType.Wood)).toBe(3);
    expect(getResourcePriority(settings, ResourceType.IronOre)).toBe(3);
  });

  it('should set and get resource priority (clamped 1-5)', () => {
    const settings = createDefaultDistribution();
    setResourcePriority(settings, ResourceType.Wood, 5);
    expect(getResourcePriority(settings, ResourceType.Wood)).toBe(5);

    setResourcePriority(settings, ResourceType.Wood, 0);
    expect(getResourcePriority(settings, ResourceType.Wood)).toBe(1);

    setResourcePriority(settings, ResourceType.Wood, 10);
    expect(getResourcePriority(settings, ResourceType.Wood)).toBe(5);
  });

  it('should set and get building importance', () => {
    const settings = createDefaultDistribution();
    expect(getBuildingImportance(settings, 'building_1')).toBe(3);

    setBuildingImportance(settings, 'building_1', 5);
    expect(getBuildingImportance(settings, 'building_1')).toBe(5);
  });

  it('should calculate routing score based on priority, importance, and distance', () => {
    const settings = createDefaultDistribution();
    setResourcePriority(settings, ResourceType.Wood, 5);
    setBuildingImportance(settings, 'b1', 4);
    setBuildingImportance(settings, 'b2', 2);

    const score1 = getRoutingScore(settings, ResourceType.Wood, 'b1', 3);
    const score2 = getRoutingScore(settings, ResourceType.Wood, 'b2', 3);
    expect(score1).toBeGreaterThan(score2); // Higher importance = higher score

    const scoreClose = getRoutingScore(settings, ResourceType.Wood, 'b1', 1);
    const scoreFar = getRoutingScore(settings, ResourceType.Wood, 'b1', 5);
    expect(scoreClose).toBeGreaterThan(scoreFar); // Closer = higher score
  });

  it('should serialize and deserialize round-trip', () => {
    const settings = createDefaultDistribution();
    setResourcePriority(settings, ResourceType.Wood, 5);
    setResourcePriority(settings, ResourceType.Stone, 1);
    setBuildingImportance(settings, 'b1', 4);

    const serialized = serializeDistribution(settings);
    const restored = deserializeDistribution(serialized);

    expect(getResourcePriority(restored, ResourceType.Wood)).toBe(5);
    expect(getResourcePriority(restored, ResourceType.Stone)).toBe(1);
    expect(getBuildingImportance(restored, 'b1')).toBe(4);
    expect(getBuildingImportance(restored, 'other')).toBe(3); // default
  });

  describe('CategoryWeights', () => {
    it('should return default category weights for Wood', () => {
      const settings = createDefaultDistribution();
      const w = getResourceCategoryWeights(settings, ResourceType.Wood);
      expect(w.production).toBe(50);
      expect(w.construction).toBe(40);
      expect(w.storage).toBe(10);
    });

    it('should return fallback category weights for non-configured resources', () => {
      const settings = createDefaultDistribution();
      const w = getResourceCategoryWeights(settings, ResourceType.Fish);
      expect(w.production).toBe(70);
      expect(w.construction).toBe(20);
      expect(w.storage).toBe(10);
    });

    it('should set and get category weights', () => {
      const settings = createDefaultDistribution();
      setResourceCategoryWeights(settings, ResourceType.Wood, { production: 30, construction: 60, storage: 10 });
      const w = getResourceCategoryWeights(settings, ResourceType.Wood);
      expect(w.production).toBe(30);
      expect(w.construction).toBe(60);
      expect(w.storage).toBe(10);
    });

    it('should reject weights that do not sum to 100', () => {
      const settings = createDefaultDistribution();
      expect(() =>
        setResourceCategoryWeights(settings, ResourceType.Wood, { production: 50, construction: 50, storage: 50 }),
      ).toThrow();
    });

    it('should serialize and deserialize category weights', () => {
      const settings = createDefaultDistribution();
      setResourceCategoryWeights(settings, ResourceType.Stone, { production: 20, construction: 70, storage: 10 });

      const serialized = serializeDistribution(settings);
      expect(serialized.resourceCategoryWeights).toBeDefined();

      const restored = deserializeDistribution(serialized);
      const w = getResourceCategoryWeights(restored, ResourceType.Stone);
      expect(w.production).toBe(20);
      expect(w.construction).toBe(70);
      expect(w.storage).toBe(10);
    });

    it('should deserialize without category weights (backward compat)', () => {
      const data = {
        resourcePriority: {},
        buildingImportance: [] as [string, number][],
      };
      const restored = deserializeDistribution(data);
      const w = getResourceCategoryWeights(restored, ResourceType.Wood);
      // Should use built-in defaults
      expect(w.production).toBe(50);
      expect(w.construction).toBe(40);
      expect(w.storage).toBe(10);
    });
  });
});
