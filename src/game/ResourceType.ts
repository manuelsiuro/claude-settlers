/**
 * All resource types in the game economy.
 * Uses const object + type alias pattern (required by erasableSyntaxOnly).
 */
export const ResourceType = {
  // Raw materials
  Wood: 'wood',
  Stone: 'stone',
  Grain: 'grain',
  Fish: 'fish',
  IronOre: 'iron_ore',
  CoalOre: 'coal_ore',
  GoldOre: 'gold_ore',

  // Processed goods
  Planks: 'planks',
  Flour: 'flour',
  Bread: 'bread',
  Meat: 'meat',
  IronBars: 'iron_bars',
  GoldBars: 'gold_bars',
  Swords: 'swords',
  Shields: 'shields',

  // Tools (individual types)
  Axe: 'axe',
  Pickaxe: 'pickaxe',
  Saw: 'saw',
  Scythe: 'scythe',
  FishingRod: 'fishing_rod',
  Hammer: 'hammer_tool',
  Shovel: 'shovel',
  RollingPin: 'rolling_pin',
  Cleaver: 'cleaver',
  Crucible: 'crucible',
  Tongs: 'tongs',

  // Animals
  Pigs: 'pigs',
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export interface ResourceProperties {
  label: string;
  category: 'raw' | 'processed' | 'animal';
  /** Whether this resource counts as food for miners */
  isFood: boolean;
}

export const RESOURCE_PROPERTIES: Record<ResourceType, ResourceProperties> = {
  [ResourceType.Wood]: { label: 'Wood', category: 'raw', isFood: false },
  [ResourceType.Stone]: { label: 'Stone', category: 'raw', isFood: false },
  [ResourceType.Grain]: { label: 'Grain', category: 'raw', isFood: false },
  [ResourceType.Fish]: { label: 'Fish', category: 'raw', isFood: true },
  [ResourceType.IronOre]: { label: 'Iron Ore', category: 'raw', isFood: false },
  [ResourceType.CoalOre]: { label: 'Coal', category: 'raw', isFood: false },
  [ResourceType.GoldOre]: { label: 'Gold Ore', category: 'raw', isFood: false },
  [ResourceType.Planks]: { label: 'Planks', category: 'processed', isFood: false },
  [ResourceType.Flour]: { label: 'Flour', category: 'processed', isFood: false },
  [ResourceType.Bread]: { label: 'Bread', category: 'processed', isFood: true },
  [ResourceType.Meat]: { label: 'Meat', category: 'processed', isFood: true },
  [ResourceType.IronBars]: { label: 'Iron Bars', category: 'processed', isFood: false },
  [ResourceType.GoldBars]: { label: 'Gold Bars', category: 'processed', isFood: false },
  [ResourceType.Swords]: { label: 'Swords', category: 'processed', isFood: false },
  [ResourceType.Shields]: { label: 'Shields', category: 'processed', isFood: false },
  [ResourceType.Axe]: { label: 'Axe', category: 'processed', isFood: false },
  [ResourceType.Pickaxe]: { label: 'Pickaxe', category: 'processed', isFood: false },
  [ResourceType.Saw]: { label: 'Saw', category: 'processed', isFood: false },
  [ResourceType.Scythe]: { label: 'Scythe', category: 'processed', isFood: false },
  [ResourceType.FishingRod]: { label: 'Fishing Rod', category: 'processed', isFood: false },
  [ResourceType.Hammer]: { label: 'Hammer', category: 'processed', isFood: false },
  [ResourceType.Shovel]: { label: 'Shovel', category: 'processed', isFood: false },
  [ResourceType.RollingPin]: { label: 'Rolling Pin', category: 'processed', isFood: false },
  [ResourceType.Cleaver]: { label: 'Cleaver', category: 'processed', isFood: false },
  [ResourceType.Crucible]: { label: 'Crucible', category: 'processed', isFood: false },
  [ResourceType.Tongs]: { label: 'Tongs', category: 'processed', isFood: false },
  [ResourceType.Pigs]: { label: 'Pigs', category: 'animal', isFood: false },
};

/** All individual tool resource types */
export const TOOL_TYPES: ResourceType[] = [
  ResourceType.Axe,
  ResourceType.Pickaxe,
  ResourceType.Saw,
  ResourceType.Scythe,
  ResourceType.FishingRod,
  ResourceType.Hammer,
  ResourceType.Shovel,
  ResourceType.RollingPin,
  ResourceType.Cleaver,
  ResourceType.Crucible,
  ResourceType.Tongs,
];

/** Check if a resource type is a tool */
export function isToolType(r: ResourceType): boolean {
  return TOOL_TYPES.includes(r);
}
