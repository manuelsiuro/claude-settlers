import { ResourceType } from './ResourceType';
import { TerrainType } from './TerrainType';

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
} as const;

export type BuildingType = (typeof BuildingType)[keyof typeof BuildingType];

export type BuildingCategory = 'core' | 'gathering' | 'processing' | 'military' | 'logistics';

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
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  // ============================================================
  // CORE
  // ============================================================
  [BuildingType.Castle]: {
    type: BuildingType.Castle,
    label: 'Castle',
    description: 'Your seat of power and main storage hub',
    category: 'core',
    tier: 0,
    cost: [],
    worker: '',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 8,
    visionRadius: 10,
    storageCapacity: 150,
    constructionTime: 0,
  },

  // ============================================================
  // TIER 1: Basic Economy & Expansion
  // ============================================================
  [BuildingType.WoodcutterHut]: {
    type: BuildingType.WoodcutterHut,
    label: "Woodcutter's Hut",
    description: 'Harvests wood from nearby forests',
    category: 'gathering',
    tier: 1,
    cost: [{ resource: ResourceType.Wood, amount: 2 }],
    worker: 'Woodcutter',
    workerTool: ResourceType.Tools,
    production: {
      inputs: [],
      outputs: [{ resource: ResourceType.Wood, amount: 1 }],
      productionTime: 15,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: TerrainType.Forest,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 6,
    constructionTime: 20,
  },

  [BuildingType.ForesterHut]: {
    type: BuildingType.ForesterHut,
    label: "Forester's Hut",
    description: 'Plants new trees to sustain wood supply',
    category: 'gathering',
    tier: 1,
    cost: [{ resource: ResourceType.Wood, amount: 2 }],
    worker: 'Forester',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: TerrainType.Forest,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 0,
    constructionTime: 15,
  },

  [BuildingType.Quarry]: {
    type: BuildingType.Quarry,
    label: 'Quarry',
    description: 'Extracts stone from mountain terrain',
    category: 'gathering',
    tier: 1,
    cost: [{ resource: ResourceType.Wood, amount: 2 }],
    worker: 'Stonemason',
    workerTool: ResourceType.Tools,
    production: {
      inputs: [],
      outputs: [{ resource: ResourceType.Stone, amount: 1 }],
      productionTime: 20,
    },
    allowedTerrain: [TerrainType.Grassland, TerrainType.Mountain],
    adjacentTerrain: null,
    harvestTerrain: TerrainType.Mountain,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 6,
    constructionTime: 20,
  },

  [BuildingType.FishermanHut]: {
    type: BuildingType.FishermanHut,
    label: "Fisherman's Hut",
    description: 'Catches fish near water to feed miners',
    category: 'gathering',
    tier: 1,
    cost: [{ resource: ResourceType.Wood, amount: 2 }],
    worker: 'Fisherman',
    workerTool: ResourceType.Tools,
    production: {
      inputs: [],
      outputs: [{ resource: ResourceType.Fish, amount: 1 }],
      productionTime: 18,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: TerrainType.Water,
    harvestTerrain: TerrainType.Water,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 6,
    constructionTime: 15,
  },

  [BuildingType.GuardHut]: {
    type: BuildingType.GuardHut,
    label: 'Guard Hut',
    description: 'Small outpost that expands borders and houses knights',
    category: 'military',
    tier: 1,
    cost: [{ resource: ResourceType.Wood, amount: 3 }],
    worker: '',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 3,
    influenceRadius: 4,
    visionRadius: 6,
    storageCapacity: 3,
    constructionTime: 25,
  },

  // ============================================================
  // TIER 2: Resource Processing & Advanced Gathering
  // ============================================================
  [BuildingType.Sawmill]: {
    type: BuildingType.Sawmill,
    label: 'Sawmill',
    description: 'Cuts wood into planks for construction',
    category: 'processing',
    tier: 2,
    cost: [{ resource: ResourceType.Wood, amount: 3 }],
    worker: 'Sawmill Worker',
    workerTool: '',
    production: {
      inputs: [{ resource: ResourceType.Wood, amount: 1 }],
      outputs: [{ resource: ResourceType.Planks, amount: 1 }],
      productionTime: 12,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 6,
    constructionTime: 25,
  },

  [BuildingType.Farm]: {
    type: BuildingType.Farm,
    label: 'Farm',
    description: 'Grows grain on grassland for flour and pig feed',
    category: 'gathering',
    tier: 2,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Farmer',
    workerTool: ResourceType.Tools,
    production: {
      inputs: [],
      outputs: [{ resource: ResourceType.Grain, amount: 1 }],
      productionTime: 25,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: TerrainType.Grassland,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 6,
    constructionTime: 30,
  },

  [BuildingType.GeologistHut]: {
    type: BuildingType.GeologistHut,
    label: "Geologist's Hut",
    description: 'Surveys mountains to reveal mineral deposits',
    category: 'gathering',
    tier: 2,
    cost: [
      { resource: ResourceType.Wood, amount: 2 },
      { resource: ResourceType.Planks, amount: 1 },
    ],
    worker: 'Geologist',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: TerrainType.Mountain,
    harvestTerrain: TerrainType.Mountain,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 4,
    constructionTime: 20,
  },

  [BuildingType.IronMine]: {
    type: BuildingType.IronMine,
    label: 'Iron Mine',
    description: 'Mines iron ore from mountain deposits',
    category: 'gathering',
    tier: 2,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Miner',
    workerTool: ResourceType.Tools,
    production: {
      inputs: [{ resource: ResourceType.Fish, amount: 1 }],
      outputs: [{ resource: ResourceType.IronOre, amount: 1 }],
      productionTime: 30,
    },
    allowedTerrain: [TerrainType.Mountain],
    adjacentTerrain: null,
    harvestTerrain: TerrainType.Mountain,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 4,
    constructionTime: 35,
  },

  [BuildingType.CoalMine]: {
    type: BuildingType.CoalMine,
    label: 'Coal Mine',
    description: 'Mines coal needed for smelting and baking',
    category: 'gathering',
    tier: 2,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Miner',
    workerTool: ResourceType.Tools,
    production: {
      inputs: [{ resource: ResourceType.Fish, amount: 1 }],
      outputs: [{ resource: ResourceType.CoalOre, amount: 1 }],
      productionTime: 30,
    },
    allowedTerrain: [TerrainType.Mountain],
    adjacentTerrain: null,
    harvestTerrain: TerrainType.Mountain,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 4,
    constructionTime: 35,
  },

  [BuildingType.GoldMine]: {
    type: BuildingType.GoldMine,
    label: 'Gold Mine',
    description: 'Mines gold ore to boost knight combat strength',
    category: 'gathering',
    tier: 2,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Miner',
    workerTool: ResourceType.Tools,
    production: {
      inputs: [{ resource: ResourceType.Fish, amount: 1 }],
      outputs: [{ resource: ResourceType.GoldOre, amount: 1 }],
      productionTime: 35,
    },
    allowedTerrain: [TerrainType.Mountain],
    adjacentTerrain: null,
    harvestTerrain: TerrainType.Mountain,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 4,
    constructionTime: 35,
  },

  [BuildingType.StoneMine]: {
    type: BuildingType.StoneMine,
    label: 'Stone Mine',
    description: 'Deep-mines stone from mountain deposits',
    category: 'gathering',
    tier: 2,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Planks, amount: 2 },
      { resource: ResourceType.Stone, amount: 1 },
    ],
    worker: 'Miner',
    workerTool: ResourceType.Tools,
    production: {
      inputs: [{ resource: ResourceType.Fish, amount: 1 }],
      outputs: [{ resource: ResourceType.Stone, amount: 1 }],
      productionTime: 25,
    },
    allowedTerrain: [TerrainType.Mountain],
    adjacentTerrain: null,
    harvestTerrain: TerrainType.Mountain,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 4,
    constructionTime: 35,
  },

  [BuildingType.Watchtower]: {
    type: BuildingType.Watchtower,
    label: 'Watchtower',
    description: 'Fortified tower with wider territory reach',
    category: 'military',
    tier: 2,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Stone, amount: 3 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: '',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 6,
    influenceRadius: 6,
    visionRadius: 10,
    storageCapacity: 6,
    constructionTime: 40,
  },

  // ============================================================
  // TIER 3: Specialized Production & Military
  // ============================================================
  [BuildingType.Windmill]: {
    type: BuildingType.Windmill,
    label: 'Windmill',
    description: 'Grinds grain into flour for bread',
    category: 'processing',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Stone, amount: 2 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Miller',
    workerTool: '',
    production: {
      inputs: [{ resource: ResourceType.Grain, amount: 1 }],
      outputs: [{ resource: ResourceType.Flour, amount: 1 }],
      productionTime: 15,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 6,
    constructionTime: 35,
  },

  [BuildingType.Bakery]: {
    type: BuildingType.Bakery,
    label: 'Bakery',
    description: 'Bakes flour and coal into bread for your people',
    category: 'processing',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Stone, amount: 2 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Baker',
    workerTool: '',
    production: {
      inputs: [
        { resource: ResourceType.Flour, amount: 1 },
        { resource: ResourceType.CoalOre, amount: 1 },
      ],
      outputs: [{ resource: ResourceType.Bread, amount: 1 }],
      productionTime: 18,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 6,
    constructionTime: 35,
  },

  [BuildingType.PigFarm]: {
    type: BuildingType.PigFarm,
    label: 'Pig Farm',
    description: 'Raises pigs from grain for the slaughterhouse',
    category: 'processing',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Pig Farmer',
    workerTool: '',
    production: {
      inputs: [{ resource: ResourceType.Grain, amount: 1 }],
      outputs: [{ resource: ResourceType.Pigs, amount: 1 }],
      productionTime: 30,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 4,
    constructionTime: 30,
  },

  [BuildingType.Slaughterhouse]: {
    type: BuildingType.Slaughterhouse,
    label: 'Slaughterhouse',
    description: 'Produces meat from pigs to feed workers',
    category: 'processing',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Stone, amount: 2 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Butcher',
    workerTool: '',
    production: {
      inputs: [{ resource: ResourceType.Pigs, amount: 1 }],
      outputs: [{ resource: ResourceType.Meat, amount: 1 }],
      productionTime: 15,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 4,
    constructionTime: 30,
  },

  [BuildingType.IronSmelter]: {
    type: BuildingType.IronSmelter,
    label: 'Iron Smelter',
    description: 'Smelts iron ore with coal into iron bars',
    category: 'processing',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Stone, amount: 3 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Smelter Worker',
    workerTool: '',
    production: {
      inputs: [
        { resource: ResourceType.IronOre, amount: 1 },
        { resource: ResourceType.CoalOre, amount: 1 },
      ],
      outputs: [{ resource: ResourceType.IronBars, amount: 1 }],
      productionTime: 20,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 4,
    constructionTime: 40,
  },

  [BuildingType.ToolmakerWorkshop]: {
    type: BuildingType.ToolmakerWorkshop,
    label: "Toolmaker's Workshop",
    description: 'Crafts tools from iron bars, essential for workers',
    category: 'processing',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Stone, amount: 2 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Toolmaker',
    workerTool: '',
    production: {
      inputs: [
        { resource: ResourceType.IronBars, amount: 1 },
        { resource: ResourceType.Planks, amount: 1 },
      ],
      outputs: [{ resource: ResourceType.Tools, amount: 1 }],
      productionTime: 20,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 6,
    constructionTime: 35,
  },

  [BuildingType.GoldsmithMint]: {
    type: BuildingType.GoldsmithMint,
    label: 'Goldsmith / Mint',
    description: 'Refines gold ore into bars that boost knights',
    category: 'processing',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Stone, amount: 2 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Goldsmith',
    workerTool: '',
    production: {
      inputs: [
        { resource: ResourceType.GoldOre, amount: 1 },
        { resource: ResourceType.CoalOre, amount: 1 },
      ],
      outputs: [{ resource: ResourceType.GoldBars, amount: 1 }],
      productionTime: 25,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 4,
    constructionTime: 35,
  },

  [BuildingType.BlacksmithArmory]: {
    type: BuildingType.BlacksmithArmory,
    label: 'Blacksmith / Armory',
    description: 'Forges swords and shields to recruit knights',
    category: 'processing',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Stone, amount: 2 },
      { resource: ResourceType.Planks, amount: 2 },
    ],
    worker: 'Blacksmith',
    workerTool: '',
    production: {
      inputs: [
        { resource: ResourceType.IronBars, amount: 2 },
        { resource: ResourceType.CoalOre, amount: 1 },
        { resource: ResourceType.Planks, amount: 1 },
      ],
      outputs: [
        { resource: ResourceType.Swords, amount: 1 },
        { resource: ResourceType.Shields, amount: 1 },
      ],
      productionTime: 25,
    },
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 6,
    constructionTime: 35,
  },

  [BuildingType.Barracks]: {
    type: BuildingType.Barracks,
    label: 'Barracks',
    description: 'Major fortress with large territory and knight capacity',
    category: 'military',
    tier: 3,
    cost: [
      { resource: ResourceType.Wood, amount: 5 },
      { resource: ResourceType.Stone, amount: 5 },
      { resource: ResourceType.Planks, amount: 3 },
    ],
    worker: '',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 12,
    influenceRadius: 8,
    visionRadius: 9,
    storageCapacity: 12,
    constructionTime: 60,
  },

  // ============================================================
  // LOGISTICS
  // ============================================================
  [BuildingType.Warehouse]: {
    type: BuildingType.Warehouse,
    label: 'Warehouse',
    description: 'Extra storage depot for overflow goods',
    category: 'logistics',
    tier: 2,
    cost: [
      { resource: ResourceType.Wood, amount: 3 },
      { resource: ResourceType.Planks, amount: 3 },
    ],
    worker: '',
    workerTool: '',
    production: null,
    allowedTerrain: [TerrainType.Grassland],
    adjacentTerrain: null,
    harvestTerrain: null,
    knightSlots: 0,
    influenceRadius: 0,
    visionRadius: 0,
    storageCapacity: 30,
    constructionTime: 30,
  },
};

/** Get all building types in a specific category */
export function getBuildingsByCategory(category: BuildingCategory): BuildingDefinition[] {
  return Object.values(BUILDING_DEFINITIONS).filter((b) => b.category === category);
}

/** Get all building types in a specific tier */
export function getBuildingsByTier(tier: number): BuildingDefinition[] {
  return Object.values(BUILDING_DEFINITIONS).filter((b) => b.tier === tier);
}
