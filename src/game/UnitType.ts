import { ResourceType } from './ResourceType';

/**
 * All unit types in the game.
 * Uses const object + type alias pattern (required by erasableSyntaxOnly).
 */
export const UnitType = {
  // Logistics
  Transporter: 'transporter',
  Builder: 'builder',

  // Gathering
  Woodcutter: 'woodcutter',
  Forester: 'forester',
  Stonemason: 'stonemason',
  Miner: 'miner',
  Farmer: 'farmer',
  Fisherman: 'fisherman',
  Geologist: 'geologist',

  // Processing (original)
  SawmillWorker: 'sawmill_worker',
  Miller: 'miller',
  Baker: 'baker',
  PigFarmer: 'pig_farmer',
  Butcher: 'butcher',
  SmelterWorker: 'smelter_worker',
  Goldsmith: 'goldsmith',
  Toolmaker: 'toolmaker',
  Blacksmith: 'blacksmith',

  // Expansion: civilian workers
  Orchardist: 'orchardist',
  Vintner: 'vintner',
  Winemaker: 'winemaker',
  Brewer: 'brewer',
  Dairymaid: 'dairymaid',
  CheeseMaker: 'cheese_maker',
  Tanner: 'tanner',
  Weaver: 'weaver',
  CharcoalBurner: 'charcoal_burner',
  Fletcher: 'fletcher',
  Engineer: 'engineer',
  Stablehand: 'stablehand',
  Rancher: 'rancher',
  Shepherd: 'shepherd',

  // Military
  Knight: 'knight',
  Archer: 'archer',
  Cavalry: 'cavalry',
  SiegeOperator: 'siege_operator',
  Scout: 'scout',

  // Transport
  Donkey: 'donkey',
  HorseTransport: 'horse_transport',
} as const;

export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export interface UnitDefinition {
  type: UnitType;
  label: string;
  category: 'civilian' | 'military' | 'transport';
  /** Tool required by this profession (null if none) */
  requiredTool: ResourceType | null;
  /** Movement speed in hexes per second */
  moveSpeed: number;
  /** Combat strength (military units only; 0 = non-combat) */
  combatStrength?: number;
  /** Attack range in hexes (0 = melee, >0 = ranged) */
  attackRange?: number;
  /** Fog of war vision radius override (default 2 for civilians, varies for military) */
  visionRadius?: number;
  /** Damage multiplier against buildings (siege units) */
  buildingDamage?: number;
  /** First-strike charge damage multiplier (cavalry) */
  chargeMultiplier?: number;
  /** Items required for recruitment at military buildings */
  recruitmentItems?: { resource: ResourceType; amount: number }[];
  /** Carry capacity for transport units (default 1) */
  carryCapacity?: number;
}

export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  [UnitType.Transporter]: {
    type: UnitType.Transporter,
    label: 'Transporter',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 0.70,
    carryCapacity: 1,
  },
  [UnitType.Builder]: {
    type: UnitType.Builder,
    label: 'Builder',
    category: 'civilian',
    requiredTool: ResourceType.Hammer,
    moveSpeed: 1.2,
  },
  [UnitType.Woodcutter]: {
    type: UnitType.Woodcutter,
    label: 'Woodcutter',
    category: 'civilian',
    requiredTool: ResourceType.Axe,
    moveSpeed: 1.0,
  },
  [UnitType.Forester]: {
    type: UnitType.Forester,
    label: 'Forester',
    category: 'civilian',
    requiredTool: ResourceType.Shovel,
    moveSpeed: 1.0,
  },
  [UnitType.Stonemason]: {
    type: UnitType.Stonemason,
    label: 'Stonemason',
    category: 'civilian',
    requiredTool: ResourceType.Pickaxe,
    moveSpeed: 1.0,
  },
  [UnitType.Miner]: {
    type: UnitType.Miner,
    label: 'Miner',
    category: 'civilian',
    requiredTool: ResourceType.Pickaxe,
    moveSpeed: 0.8,
  },
  [UnitType.Farmer]: {
    type: UnitType.Farmer,
    label: 'Farmer',
    category: 'civilian',
    requiredTool: ResourceType.Scythe,
    moveSpeed: 1.0,
  },
  [UnitType.Fisherman]: {
    type: UnitType.Fisherman,
    label: 'Fisherman',
    category: 'civilian',
    requiredTool: ResourceType.FishingRod,
    moveSpeed: 1.0,
  },
  [UnitType.Geologist]: {
    type: UnitType.Geologist,
    label: 'Geologist',
    category: 'civilian',
    requiredTool: ResourceType.Hammer,
    moveSpeed: 0.8,
  },
  [UnitType.SawmillWorker]: {
    type: UnitType.SawmillWorker,
    label: 'Sawmill Worker',
    category: 'civilian',
    requiredTool: ResourceType.Saw,
    moveSpeed: 1.0,
  },
  [UnitType.Miller]: {
    type: UnitType.Miller,
    label: 'Miller',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Baker]: {
    type: UnitType.Baker,
    label: 'Baker',
    category: 'civilian',
    requiredTool: ResourceType.RollingPin,
    moveSpeed: 1.0,
  },
  [UnitType.PigFarmer]: {
    type: UnitType.PigFarmer,
    label: 'Pig Farmer',
    category: 'civilian',
    requiredTool: ResourceType.Shovel,
    moveSpeed: 1.0,
  },
  [UnitType.Butcher]: {
    type: UnitType.Butcher,
    label: 'Butcher',
    category: 'civilian',
    requiredTool: ResourceType.Cleaver,
    moveSpeed: 1.0,
  },
  [UnitType.SmelterWorker]: {
    type: UnitType.SmelterWorker,
    label: 'Smelter Worker',
    category: 'civilian',
    requiredTool: ResourceType.Crucible,
    moveSpeed: 1.0,
  },
  [UnitType.Goldsmith]: {
    type: UnitType.Goldsmith,
    label: 'Goldsmith',
    category: 'civilian',
    requiredTool: ResourceType.Crucible,
    moveSpeed: 1.0,
  },
  [UnitType.Toolmaker]: {
    type: UnitType.Toolmaker,
    label: 'Toolmaker',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Blacksmith]: {
    type: UnitType.Blacksmith,
    label: 'Blacksmith',
    category: 'civilian',
    requiredTool: ResourceType.Tongs,
    moveSpeed: 1.0,
  },
  // Expansion: civilian workers
  [UnitType.Orchardist]: {
    type: UnitType.Orchardist,
    label: 'Orchardist',
    category: 'civilian',
    requiredTool: ResourceType.Scythe,
    moveSpeed: 1.0,
  },
  [UnitType.Vintner]: {
    type: UnitType.Vintner,
    label: 'Vintner',
    category: 'civilian',
    requiredTool: ResourceType.Scythe,
    moveSpeed: 1.0,
  },
  [UnitType.Winemaker]: {
    type: UnitType.Winemaker,
    label: 'Winemaker',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Brewer]: {
    type: UnitType.Brewer,
    label: 'Brewer',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Dairymaid]: {
    type: UnitType.Dairymaid,
    label: 'Dairymaid',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.CheeseMaker]: {
    type: UnitType.CheeseMaker,
    label: 'Cheese Maker',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Tanner]: {
    type: UnitType.Tanner,
    label: 'Tanner',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Weaver]: {
    type: UnitType.Weaver,
    label: 'Weaver',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.CharcoalBurner]: {
    type: UnitType.CharcoalBurner,
    label: 'Charcoal Burner',
    category: 'civilian',
    requiredTool: ResourceType.Axe,
    moveSpeed: 1.0,
  },
  [UnitType.Fletcher]: {
    type: UnitType.Fletcher,
    label: 'Fletcher',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Engineer]: {
    type: UnitType.Engineer,
    label: 'Engineer',
    category: 'civilian',
    requiredTool: ResourceType.Hammer,
    moveSpeed: 1.0,
  },
  [UnitType.Stablehand]: {
    type: UnitType.Stablehand,
    label: 'Stablehand',
    category: 'civilian',
    requiredTool: ResourceType.Shovel,
    moveSpeed: 1.0,
  },
  [UnitType.Rancher]: {
    type: UnitType.Rancher,
    label: 'Rancher',
    category: 'civilian',
    requiredTool: ResourceType.Shovel,
    moveSpeed: 1.0,
  },
  [UnitType.Shepherd]: {
    type: UnitType.Shepherd,
    label: 'Shepherd',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },

  // Military
  [UnitType.Knight]: {
    type: UnitType.Knight,
    label: 'Knight',
    category: 'military',
    requiredTool: null,
    moveSpeed: 1.2,
    combatStrength: 1.0,
    attackRange: 0,
    visionRadius: 3,
    recruitmentItems: [
      { resource: ResourceType.Swords, amount: 1 },
      { resource: ResourceType.Shields, amount: 1 },
    ],
  },
  [UnitType.Archer]: {
    type: UnitType.Archer,
    label: 'Archer',
    category: 'military',
    requiredTool: null,
    moveSpeed: 1.0,
    combatStrength: 0.6,
    attackRange: 3,
    visionRadius: 5,
    recruitmentItems: [
      { resource: ResourceType.Bow, amount: 1 },
      { resource: ResourceType.Arrows, amount: 1 },
    ],
  },
  [UnitType.Cavalry]: {
    type: UnitType.Cavalry,
    label: 'Cavalry',
    category: 'military',
    requiredTool: null,
    moveSpeed: 1.8,
    combatStrength: 1.3,
    attackRange: 0,
    visionRadius: 4,
    chargeMultiplier: 1.3,
    recruitmentItems: [
      { resource: ResourceType.Horses, amount: 1 },
      { resource: ResourceType.Swords, amount: 1 },
      { resource: ResourceType.Shields, amount: 1 },
    ],
  },
  [UnitType.SiegeOperator]: {
    type: UnitType.SiegeOperator,
    label: 'Siege Operator',
    category: 'military',
    requiredTool: null,
    moveSpeed: 0.6,
    combatStrength: 0.5,
    attackRange: 0,
    visionRadius: 2,
    buildingDamage: 3.0,
    recruitmentItems: [
      { resource: ResourceType.SiegeRam, amount: 1 },
    ],
  },
  [UnitType.Scout]: {
    type: UnitType.Scout,
    label: 'Scout',
    category: 'military',
    requiredTool: null,
    moveSpeed: 2.0,
    combatStrength: 0.2,
    attackRange: 0,
    visionRadius: 12,
    recruitmentItems: [],  // serf promotion, no items needed
  },

  // Transport
  [UnitType.Donkey]: {
    type: UnitType.Donkey,
    label: 'Donkey',
    category: 'transport',
    requiredTool: null,
    moveSpeed: 0.45,
    carryCapacity: 3,
  },
  [UnitType.HorseTransport]: {
    type: UnitType.HorseTransport,
    label: 'Horse Cart',
    category: 'transport',
    requiredTool: null,
    moveSpeed: 0.60,
    carryCapacity: 8,
  },
};

/**
 * Maps BuildingDefinition.worker string → UnitType.
 * Used to determine what unit type a building needs.
 */
export const WORKER_TO_UNIT_TYPE: Record<string, UnitType> = {
  'Woodcutter': UnitType.Woodcutter,
  'Forester': UnitType.Forester,
  'Stonemason': UnitType.Stonemason,
  'Fisherman': UnitType.Fisherman,
  'Sawmill Worker': UnitType.SawmillWorker,
  'Farmer': UnitType.Farmer,
  'Geologist': UnitType.Geologist,
  'Miner': UnitType.Miner,
  'Miller': UnitType.Miller,
  'Baker': UnitType.Baker,
  'Pig Farmer': UnitType.PigFarmer,
  'Butcher': UnitType.Butcher,
  'Smelter Worker': UnitType.SmelterWorker,
  'Goldsmith': UnitType.Goldsmith,
  'Toolmaker': UnitType.Toolmaker,
  'Blacksmith': UnitType.Blacksmith,
  // Expansion workers
  'Orchardist': UnitType.Orchardist,
  'Vintner': UnitType.Vintner,
  'Winemaker': UnitType.Winemaker,
  'Brewer': UnitType.Brewer,
  'Dairymaid': UnitType.Dairymaid,
  'Cheese Maker': UnitType.CheeseMaker,
  'Tanner': UnitType.Tanner,
  'Weaver': UnitType.Weaver,
  'Charcoal Burner': UnitType.CharcoalBurner,
  'Fletcher': UnitType.Fletcher,
  'Engineer': UnitType.Engineer,
  'Stablehand': UnitType.Stablehand,
  'Rancher': UnitType.Rancher,
  'Shepherd': UnitType.Shepherd,
};

/** Get the UnitType needed to work at a building, or null if no worker needed */
export function getWorkerUnitType(workerLabel: string): UnitType | null {
  return WORKER_TO_UNIT_TYPE[workerLabel] ?? null;
}
