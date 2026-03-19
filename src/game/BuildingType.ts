import type { ResourceType } from './ResourceType';
import type { TerrainType } from './TerrainType';

/**
 * All building types in the game.
 * Uses const object + type alias pattern (required by erasableSyntaxOnly).
 */
export const BuildingType = {
  // Core
  Castle: 'castle',

  // Tier 1: Basic Economy & Expansion
  WoodcutterHut: 'woodcutter_hut',
  ForesterHut: 'forester_hut',
  Quarry: 'quarry',
  FishermanHut: 'fisherman_hut',
  GuardHut: 'guard_hut',

  // Tier 2: Resource Processing & Advanced Gathering
  Sawmill: 'sawmill',
  Farm: 'farm',
  GeologistHut: 'geologist_hut',
  IronMine: 'iron_mine',
  CoalMine: 'coal_mine',
  GoldMine: 'gold_mine',
  StoneMine: 'stone_mine',
  Watchtower: 'watchtower',

  // Tier 3: Specialized Production & Military
  Windmill: 'windmill',
  Bakery: 'bakery',
  PigFarm: 'pig_farm',
  Slaughterhouse: 'slaughterhouse',
  IronSmelter: 'iron_smelter',
  ToolmakerWorkshop: 'toolmaker_workshop',
  GoldsmithMint: 'goldsmith_mint',
  BlacksmithArmory: 'blacksmith_armory',
  Barracks: 'barracks',

  // Logistics
  Warehouse: 'warehouse',
  Harbor: 'harbor',

  // Housing
  SmallHouse: 'small_house',
  MediumHouse: 'medium_house',
  LargeHouse: 'large_house',
} as const;

export type BuildingType = (typeof BuildingType)[keyof typeof BuildingType];

export type BuildingCategory = 'core' | 'gathering' | 'processing' | 'military' | 'logistics' | 'housing';

export interface BuildingCost {
  resource: ResourceType;
  amount: number;
}

export interface ProductionRecipe {
  inputs: { resource: ResourceType; amount: number }[];
  outputs: { resource: ResourceType; amount: number }[];
  /** Production time in seconds */
  productionTime: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  label: string;
  description: string;
  category: BuildingCategory;
  tier: number;
  /** Resources required for construction */
  cost: BuildingCost[];
  /** Worker type label (empty string for buildings with no worker) */
  worker: string;
  /** Tool required by the worker (empty string if none) */
  workerTool: ResourceType | '';
  /** Production recipe (null if building doesn't produce) */
  production: ProductionRecipe | null;
  /** Allowed terrain types for placement */
  allowedTerrain: TerrainType[];
  /** Must be adjacent to this terrain type (e.g., fisherman near water) */
  adjacentTerrain: TerrainType | null;
  /** Terrain type the worker walks to for gathering (null for non-gathering buildings) */
  harvestTerrain: TerrainType | null;
  /** Number of knight slots (military buildings only) */
  knightSlots: number;
  /** Territory influence radius in hex tiles (military buildings only) */
  influenceRadius: number;
  /** Vision radius in hex tiles (for fog of war) */
  visionRadius: number;
  /** Max items stored per resource type */
  storageCapacity: number;
  /** Construction time in seconds */
  constructionTime: number;
  /** Work radius in hex tiles for gathering/prospecting buildings (0 = not applicable) */
  workRadius: number;
  /** Population capacity provided by this building (housing buildings) */
  populationCapacity: number;
}

export { BUILDING_DEFINITIONS, getBuildingsByCategory, getBuildingsByTier } from './data/buildingDefinitions';
