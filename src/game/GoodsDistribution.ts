import type { ResourceType } from './ResourceType';

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
}

/** Create default distribution settings (all priorities at 3) */
export function createDefaultDistribution(): GoodsDistributionSettings {
  return {
    resourcePriority: {},
    buildingImportance: new Map(),
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
): { resourcePriority: Record<string, number>; buildingImportance: [string, number][] } {
  return {
    resourcePriority: { ...settings.resourcePriority } as Record<string, number>,
    buildingImportance: Array.from(settings.buildingImportance.entries()),
  };
}

/** Deserialize settings from save data */
export function deserializeDistribution(
  data: { resourcePriority: Record<string, number>; buildingImportance: [string, number][] },
): GoodsDistributionSettings {
  return {
    resourcePriority: { ...data.resourcePriority } as Partial<Record<ResourceType, number>>,
    buildingImportance: new Map(data.buildingImportance),
  };
}
