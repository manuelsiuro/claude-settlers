import type { Game } from '../../engine/Game';
import { RESOURCE_PROPERTIES, ResourceType, isFood } from '../../game/ResourceType';

/** Sum all resources across all player buildings. */
export function getTotalResources(game: Game): number {
  let total = 0;
  const buildings = game.getGameState().getBuildingsByPlayer(game.getHumanPlayerId());
  for (const b of buildings) {
    for (const inv of [b.inputInventory, b.outputInventory]) {
      for (const amount of Object.values(inv)) {
        total += amount ?? 0;
      }
    }
  }
  return total;
}

/** Get per-resource totals across all player buildings. */
export function getAllPlayerResources(game: Game): Partial<Record<ResourceType, number>> {
  const totals: Partial<Record<ResourceType, number>> = {};
  const buildings = game.getGameState().getBuildingsByPlayer(game.getHumanPlayerId());
  for (const b of buildings) {
    for (const inv of [b.inputInventory, b.outputInventory]) {
      for (const [res, amount] of Object.entries(inv)) {
        if (amount && amount > 0) {
          const r = res as ResourceType;
          totals[r] = (totals[r] ?? 0) + amount;
        }
      }
    }
  }
  return totals;
}

export const RAW_RESOURCES: Set<ResourceType> = new Set([
  ResourceType.Wood, ResourceType.Stone, ResourceType.Grain, ResourceType.Fish,
  ResourceType.IronOre, ResourceType.CoalOre, ResourceType.GoldOre,
  ResourceType.Grapes, ResourceType.Fruit, ResourceType.WaterBarrel,
  ResourceType.Milk, ResourceType.Hay, ResourceType.Wool, ResourceType.RawLeather,
  ResourceType.Cattle, ResourceType.Horses,
]);

export const MILITARY_RESOURCES: Set<ResourceType> = new Set([
  ResourceType.Swords, ResourceType.Shields, ResourceType.Arrows,
  ResourceType.Bow, ResourceType.SiegeRam, ResourceType.GoldBars,
]);

export type ResourceFilter = 'all' | 'raw' | 'processed' | 'food' | 'military';

export function matchesFilter(r: ResourceType, resourceFilter: ResourceFilter): boolean {
  if (resourceFilter === 'all') return true;
  if (resourceFilter === 'raw') return RAW_RESOURCES.has(r);
  if (resourceFilter === 'food') return isFood(r);
  if (resourceFilter === 'military') return MILITARY_RESOURCES.has(r);
  if (resourceFilter === 'processed') return !RAW_RESOURCES.has(r);
  return true;
}

export function sliceHistory(data: number[], maxPts: number): number[] {
  if (data.length <= maxPts) return data;
  return data.slice(data.length - maxPts);
}

export const TIME_SCALE_POINTS: Record<string, number> = { '5m': 10, '15m': 30, '30m': 60, '1hr': 120 };

/** Known label helper — avoids repeated RESOURCE_PROPERTIES lookups */
export function resLabel(r: ResourceType): string {
  return RESOURCE_PROPERTIES[r].label;
}
