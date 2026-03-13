import type { Building } from './Building';
import { BUILDING_DEFINITIONS } from './BuildingType';
import type { BuildingType } from './BuildingType';
import { ResourceType } from './ResourceType';

export const UpgradeAxis = {
  Storage: 'storage',
  Production: 'production',
  Workers: 'workers',
} as const;

export type UpgradeAxis = (typeof UpgradeAxis)[keyof typeof UpgradeAxis];

export interface UpgradeLevelConfig {
  cost: { resource: ResourceType; amount: number }[];
  /** Capacity for Storage, time multiplier for Production, worker count for Workers */
  value: number;
}

export interface BuildingUpgradeConfig {
  maxLevel: number;
  levels: UpgradeLevelConfig[]; // Index 0 = cost to go from level 0→1
}

export type BuildingUpgradeSpec = Partial<Record<UpgradeAxis, BuildingUpgradeConfig>>;

/** Max upgrade level for all axes */
const MAX_LEVEL = 10;

/**
 * Storage capacity formula: Math.ceil(baseCapacity * (1 + 0.4 * level))
 * Lv.1: 1.4x → Lv.5: 3.0x → Lv.10: 5.0x
 */
function storageValue(baseCapacity: number, level: number): number {
  return Math.ceil(baseCapacity * (1 + 0.4 * level));
}

/**
 * Production speed multiplier: Math.max(0.50, 1.0 - 0.05 * level)
 * Lv.1: 0.95 (5% faster) → Lv.5: 0.75 (33% faster) → Lv.10: 0.50 (2x throughput)
 */
function productionValue(level: number): number {
  return Math.max(0.50, 1.0 - 0.05 * level);
}

/**
 * Worker count: 1 + Math.ceil(level / 2)
 * Lv.1: 2 → Lv.4: 3 → Lv.6: 4 → Lv.8: 5 → Lv.10: 6
 */
function workerValue(level: number): number {
  return 1 + Math.ceil(level / 2);
}

/**
 * Storage/Production upgrade cost based on tier and target level:
 *   planks = 2 + level + (tier >= 3 ? 1 : 0)
 *   stone  = 1 + Math.ceil(level / 2)
 *   iron   = level >= 4 ? Math.ceil((level - 3) / 2) : 0
 *   gold   = level >= 7 ? Math.ceil((level - 6) / 2) : 0
 */
function getScaledCost(tier: number, level: number): { resource: ResourceType; amount: number }[] {
  const cost: { resource: ResourceType; amount: number }[] = [];
  cost.push({ resource: ResourceType.Planks, amount: 2 + level + (tier >= 3 ? 1 : 0) });
  cost.push({ resource: ResourceType.Stone, amount: 1 + Math.ceil(level / 2) });
  if (level >= 4) {
    cost.push({ resource: ResourceType.IronBars, amount: Math.ceil((level - 3) / 2) });
  }
  if (level >= 7) {
    cost.push({ resource: ResourceType.GoldBars, amount: Math.ceil((level - 6) / 2) });
  }
  return cost;
}

/**
 * Worker upgrade cost — Planks + Stone + Tools scaling, Iron at level 4+, Gold at level 7+
 */
function getWorkerCost(level: number): { resource: ResourceType; amount: number }[] {
  const cost: { resource: ResourceType; amount: number }[] = [];
  cost.push({ resource: ResourceType.Planks, amount: 2 + level });
  cost.push({ resource: ResourceType.Stone, amount: 1 + Math.ceil(level / 2) });
  cost.push({ resource: ResourceType.Tools, amount: Math.ceil(level / 2) });
  if (level >= 4) {
    cost.push({ resource: ResourceType.IronBars, amount: Math.ceil((level - 3) / 2) });
  }
  if (level >= 7) {
    cost.push({ resource: ResourceType.GoldBars, amount: Math.ceil((level - 6) / 2) });
  }
  return cost;
}

/**
 * Build the upgrade registry dynamically based on building definitions.
 * - Storage: available on all buildings with storageCapacity > 0 (max level 10)
 * - Production: available on all buildings with a production recipe (max level 10)
 * - Workers: available on processing buildings only (max level 10)
 */
function buildUpgradeRegistry(): Partial<Record<BuildingType, BuildingUpgradeSpec>> {
  const registry: Partial<Record<BuildingType, BuildingUpgradeSpec>> = {};

  for (const [type, def] of Object.entries(BUILDING_DEFINITIONS)) {
    const bt = type as BuildingType;
    const spec: BuildingUpgradeSpec = {};
    let hasUpgrades = false;

    // Storage upgrades
    if (def.storageCapacity > 0) {
      const levels: UpgradeLevelConfig[] = [];
      for (let lv = 1; lv <= MAX_LEVEL; lv++) {
        levels.push({
          cost: getScaledCost(def.tier, lv),
          value: storageValue(def.storageCapacity, lv),
        });
      }
      spec[UpgradeAxis.Storage] = { maxLevel: MAX_LEVEL, levels };
      hasUpgrades = true;
    }

    // Production upgrades
    if (def.production) {
      const levels: UpgradeLevelConfig[] = [];
      for (let lv = 1; lv <= MAX_LEVEL; lv++) {
        levels.push({
          cost: getScaledCost(def.tier, lv),
          value: productionValue(lv),
        });
      }
      spec[UpgradeAxis.Production] = { maxLevel: MAX_LEVEL, levels };
      hasUpgrades = true;
    }

    // Worker upgrades (processing buildings only)
    if (def.category === 'processing' && def.production) {
      const levels: UpgradeLevelConfig[] = [];
      for (let lv = 1; lv <= MAX_LEVEL; lv++) {
        levels.push({
          cost: getWorkerCost(lv),
          value: workerValue(lv),
        });
      }
      spec[UpgradeAxis.Workers] = { maxLevel: MAX_LEVEL, levels };
      hasUpgrades = true;
    }

    if (hasUpgrades) {
      registry[bt] = spec;
    }
  }

  return registry;
}

/** The upgrade registry — maps building types to their available upgrades */
export const BUILDING_UPGRADES = buildUpgradeRegistry();

/** Get upgrade config for a building type and axis */
export function getUpgradeConfig(
  buildingType: BuildingType,
  axis: UpgradeAxis,
): BuildingUpgradeConfig | null {
  return BUILDING_UPGRADES[buildingType]?.[axis] ?? null;
}

/** Get the cost to upgrade from currentLevel to currentLevel+1, or null if at max */
export function getUpgradeCost(
  buildingType: BuildingType,
  axis: UpgradeAxis,
  currentLevel: number,
): { resource: ResourceType; amount: number }[] | null {
  const config = getUpgradeConfig(buildingType, axis);
  if (!config || currentLevel >= config.maxLevel) return null;
  return config.levels[currentLevel].cost;
}

/** Get effective storage capacity accounting for upgrade level */
export function getEffectiveStorageCapacity(building: Building): number {
  const def = BUILDING_DEFINITIONS[building.type];
  const level = building.upgradeLevels?.[UpgradeAxis.Storage] ?? 0;
  if (level === 0) return def.storageCapacity;
  const config = getUpgradeConfig(building.type, UpgradeAxis.Storage);
  if (!config || level > config.maxLevel) return def.storageCapacity;
  return config.levels[level - 1].value;
}

/** Get production speed multiplier accounting for upgrade level */
export function getProductionSpeedMultiplier(building: Building): number {
  const level = building.upgradeLevels?.[UpgradeAxis.Production] ?? 0;
  if (level === 0) return 1.0;
  const config = getUpgradeConfig(building.type, UpgradeAxis.Production);
  if (!config || level > config.maxLevel) return 1.0;
  return config.levels[level - 1].value;
}

/** Get max workers for a building (1 base + worker upgrades) */
export function getMaxWorkers(building: Building): number {
  const level = building.upgradeLevels?.[UpgradeAxis.Workers] ?? 0;
  if (level === 0) return 1;
  const config = getUpgradeConfig(building.type, UpgradeAxis.Workers);
  if (!config || level > config.maxLevel) return 1;
  return config.levels[level - 1].value;
}

/** Check if a building can be upgraded on a given axis */
export function canUpgrade(building: Building, axis: UpgradeAxis): boolean {
  if (building.state !== 'active') return false;
  if (building.activeUpgrade) return false;
  const config = getUpgradeConfig(building.type, axis);
  if (!config) return false;
  const currentLevel = building.upgradeLevels?.[axis] ?? 0;
  return currentLevel < config.maxLevel;
}

/**
 * Get upgrade construction time scaled by target level.
 * Formula: def.constructionTime * (0.3 + 0.1 * targetLevel)
 * Lv.1: 0.4x base → Lv.5: 0.8x → Lv.10: 1.3x
 */
export function getUpgradeTime(building: Building, targetLevel?: number): number {
  const def = BUILDING_DEFINITIONS[building.type];
  const level = targetLevel ?? 1;
  return def.constructionTime * (0.3 + 0.1 * level);
}
