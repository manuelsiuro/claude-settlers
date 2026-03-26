import type { BuildingType, BuildingDefinition, BuildingCategory } from '../../BuildingType';
import { CORE_BUILDINGS } from './core';
import { GATHERING_BUILDINGS } from './gathering';
import { PROCESSING_BUILDINGS } from './processing';
import { MILITARY_BUILDINGS } from './military';
import { HOUSING_BUILDINGS } from './housing';
import { LOGISTICS_BUILDINGS } from './logistics';
import { LIVING_WORLD_BUILDINGS } from './livingWorld';

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  ...CORE_BUILDINGS,
  ...GATHERING_BUILDINGS,
  ...PROCESSING_BUILDINGS,
  ...MILITARY_BUILDINGS,
  ...HOUSING_BUILDINGS,
  ...LOGISTICS_BUILDINGS,
  ...LIVING_WORLD_BUILDINGS,
} as Record<BuildingType, BuildingDefinition>;

/** Get all building types in a specific category */
export function getBuildingsByCategory(category: BuildingCategory): BuildingDefinition[] {
  return Object.values(BUILDING_DEFINITIONS).filter((b) => b.category === category);
}

/** Get all building types in a specific tier */
export function getBuildingsByTier(tier: number): BuildingDefinition[] {
  return Object.values(BUILDING_DEFINITIONS).filter((b) => b.tier === tier);
}
