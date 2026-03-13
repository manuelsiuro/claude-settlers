import type { ResourceType } from './ResourceType';

/** Category allocation weights for resource distribution (must sum to 100) */
export interface CategoryWeights {
  production: number;
  construction: number;
  storage: number;
}

/** Smart default category weights per resource */
const DEFAULT_CATEGORY_WEIGHTS: Partial<Record<ResourceType, CategoryWeights>> = {
  wood: { production: 50, construction: 40, storage: 10 },
  stone: { production: 30, construction: 60, storage: 10 },
  planks: { production: 40, construction: 50, storage: 10 },
};

const FALLBACK_CATEGORY_WEIGHTS: CategoryWeights = { production: 70, construction: 20, storage: 10 };

/**
 * Goods distribution priority settings.
 * Players can set per-resource priority (1-5) and per-building importance (1-5).
 * Higher numbers = higher priority for resource routing.
 */
export interface GoodsDistributionSettings {
  /** Priority per resource type (1-5, default 3) */
  resourcePriority: Partial<Record<ResourceType, number>>;
  /** Importance per building ID (1-5, default 3) */
  buildingImportance: Map<string, number>;
  /** Category allocation weights per resource type */
  resourceCategoryWeights: Partial<Record<ResourceType, CategoryWeights>>;
}

/** Create default distribution settings (all priorities at 3) */
export function createDefaultDistribution(): GoodsDistributionSettings {
  return {
    resourcePriority: {},
    buildingImportance: new Map(),
    resourceCategoryWeights: {},
  };
}

/** Get resource priority (default 3) */
export function getResourcePriority(
  settings: GoodsDistributionSettings,
  resource: ResourceType,
): number {
  return settings.resourcePriority[resource] ?? 3;
}

/** Set resource priority (clamped 1-5) */
export function setResourcePriority(
  settings: GoodsDistributionSettings,
  resource: ResourceType,
  priority: number,
): void {
  settings.resourcePriority[resource] = Math.max(1, Math.min(5, Math.round(priority)));
}

/** Get building importance (default 3) */
export function getBuildingImportance(
  settings: GoodsDistributionSettings,
  buildingId: string,
): number {
  return settings.buildingImportance.get(buildingId) ?? 3;
}

/** Set building importance (clamped 1-5) */
export function setBuildingImportance(
  settings: GoodsDistributionSettings,
  buildingId: string,
  importance: number,
): void {
  settings.buildingImportance.set(buildingId, Math.max(1, Math.min(5, Math.round(importance))));
}

/** Get category weights for a resource (uses smart defaults if not set) */
export function getResourceCategoryWeights(
  settings: GoodsDistributionSettings,
  resource: ResourceType,
): CategoryWeights {
  return settings.resourceCategoryWeights[resource]
    ?? DEFAULT_CATEGORY_WEIGHTS[resource]
    ?? FALLBACK_CATEGORY_WEIGHTS;
}

/** Set category weights for a resource (validates sum = 100) */
export function setResourceCategoryWeights(
  settings: GoodsDistributionSettings,
  resource: ResourceType,
  weights: CategoryWeights,
): void {
  const sum = weights.production + weights.construction + weights.storage;
  if (Math.abs(sum - 100) > 1) {
    throw new Error(`Category weights must sum to 100, got ${sum}`);
  }
  settings.resourceCategoryWeights[resource] = {
    production: Math.round(weights.production),
    construction: Math.round(weights.construction),
    storage: Math.round(weights.storage),
  };
}

/** Compute composite routing score for resource delivery (higher = prefer) */
export function getRoutingScore(
  settings: GoodsDistributionSettings,
  resource: ResourceType,
  buildingId: string,
  distance: number,
): number {
  const resPriority = getResourcePriority(settings, resource);
  const bldImportance = getBuildingImportance(settings, buildingId);
  // Score = importance × priority, distance breaks ties (lower distance = higher score)
  return (bldImportance * resPriority) / Math.max(1, distance);
}

/** Serialize settings for save/load */
export function serializeDistribution(
  settings: GoodsDistributionSettings,
): {
  resourcePriority: Record<string, number>;
  buildingImportance: [string, number][];
  resourceCategoryWeights?: Record<string, CategoryWeights>;
} {
  const catWeights = Object.keys(settings.resourceCategoryWeights).length > 0
    ? { ...settings.resourceCategoryWeights } as Record<string, CategoryWeights>
    : undefined;
  return {
    resourcePriority: { ...settings.resourcePriority } as Record<string, number>,
    buildingImportance: Array.from(settings.buildingImportance.entries()),
    resourceCategoryWeights: catWeights,
  };
}

/** Deserialize settings from save data */
export function deserializeDistribution(
  data: {
    resourcePriority: Record<string, number>;
    buildingImportance: [string, number][];
    resourceCategoryWeights?: Record<string, CategoryWeights>;
  },
): GoodsDistributionSettings {
  return {
    resourcePriority: { ...data.resourcePriority } as Partial<Record<ResourceType, number>>,
    buildingImportance: new Map(data.buildingImportance),
    resourceCategoryWeights: (data.resourceCategoryWeights ?? {}) as Partial<Record<ResourceType, CategoryWeights>>,
  };
}
