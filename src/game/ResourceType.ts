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

  // Raw materials: food & farming
  Grapes: 'grapes',
  Fruit: 'fruit',
  WaterBarrel: 'water_barrel',
  Milk: 'milk',
  Hay: 'hay',
  Wool: 'wool',
  RawLeather: 'raw_leather',

  // Processed goods: food, drink & crafting
  Wine: 'wine',
  Beer: 'beer',
  Cheese: 'cheese',
  Cloth: 'cloth',
  WorkedLeather: 'worked_leather',
  Arrows: 'arrows',
  Bow: 'bow',
  SiegeRam: 'siege_ram',

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
  Cattle: 'cattle',
  Horses: 'horses',
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export interface ResourceProperties {
  label: string;
  category: 'raw' | 'processed' | 'animal';
  /** Satiation restored when consumed (0 = not a food). Also determines isFood: satiationValue > 0 */
  satiationValue: number;
  /** Whether this resource counts as a drink (for morale) */
  isDrink: boolean;
}

/** Check if a resource is food (has satiation value) */
export function isFood(resource: ResourceType): boolean {
  return RESOURCE_PROPERTIES[resource].satiationValue > 0;
}

export const RESOURCE_PROPERTIES: Record<ResourceType, ResourceProperties> = {
  // Raw materials
  [ResourceType.Wood]: { label: 'Wood', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.Stone]: { label: 'Stone', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.Grain]: { label: 'Grain', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.Fish]: { label: 'Fish', category: 'raw',satiationValue: 0.40, isDrink: false },
  [ResourceType.IronOre]: { label: 'Iron Ore', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.CoalOre]: { label: 'Coal', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.GoldOre]: { label: 'Gold Ore', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.Grapes]: { label: 'Grapes', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.Fruit]: { label: 'Fruit', category: 'raw',satiationValue: 0.35, isDrink: false },
  [ResourceType.WaterBarrel]: { label: 'Water Barrel', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.Milk]: { label: 'Milk', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.Hay]: { label: 'Hay', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.Wool]: { label: 'Wool', category: 'raw',satiationValue: 0, isDrink: false },
  [ResourceType.RawLeather]: { label: 'Raw Leather', category: 'raw',satiationValue: 0, isDrink: false },

  // Processed goods
  [ResourceType.Planks]: { label: 'Planks', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Flour]: { label: 'Flour', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Bread]: { label: 'Bread', category: 'processed',satiationValue: 0.60, isDrink: false },
  [ResourceType.Meat]: { label: 'Meat', category: 'processed',satiationValue: 0.80, isDrink: false },
  [ResourceType.IronBars]: { label: 'Iron Bars', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.GoldBars]: { label: 'Gold Bars', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Swords]: { label: 'Swords', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Shields]: { label: 'Shields', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Wine]: { label: 'Wine', category: 'processed',satiationValue: 0.30, isDrink: true },
  [ResourceType.Beer]: { label: 'Beer', category: 'processed',satiationValue: 0.25, isDrink: true },
  [ResourceType.Cheese]: { label: 'Cheese', category: 'processed',satiationValue: 0.55, isDrink: false },
  [ResourceType.Cloth]: { label: 'Cloth', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.WorkedLeather]: { label: 'Worked Leather', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Arrows]: { label: 'Arrows', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Bow]: { label: 'Bow', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.SiegeRam]: { label: 'Siege Ram', category: 'processed',satiationValue: 0, isDrink: false },

  // Tools
  [ResourceType.Axe]: { label: 'Axe', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Pickaxe]: { label: 'Pickaxe', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Saw]: { label: 'Saw', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Scythe]: { label: 'Scythe', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.FishingRod]: { label: 'Fishing Rod', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Hammer]: { label: 'Hammer', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Shovel]: { label: 'Shovel', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.RollingPin]: { label: 'Rolling Pin', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Cleaver]: { label: 'Cleaver', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Crucible]: { label: 'Crucible', category: 'processed',satiationValue: 0, isDrink: false },
  [ResourceType.Tongs]: { label: 'Tongs', category: 'processed',satiationValue: 0, isDrink: false },

  // Animals
  [ResourceType.Pigs]: { label: 'Pigs', category: 'animal',satiationValue: 0, isDrink: false },
  [ResourceType.Cattle]: { label: 'Cattle', category: 'animal',satiationValue: 0, isDrink: false },
  [ResourceType.Horses]: { label: 'Horses', category: 'animal',satiationValue: 0, isDrink: false },
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
