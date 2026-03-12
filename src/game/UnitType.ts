import type { ResourceType } from './ResourceType';

/**
 * All unit types in the game.
 * 18 serf professions + 1 military unit (Knight).
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

  // Processing
  SawmillWorker: 'sawmill_worker',
  Miller: 'miller',
  Baker: 'baker',
  PigFarmer: 'pig_farmer',
  Butcher: 'butcher',
  SmelterWorker: 'smelter_worker',
  Goldsmith: 'goldsmith',
  Toolmaker: 'toolmaker',
  Blacksmith: 'blacksmith',

  // Military
  Knight: 'knight',
} as const;

export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export interface UnitDefinition {
  type: UnitType;
  label: string;
  category: 'civilian' | 'military';
  /** Tool required by this profession (null if none) */
  requiredTool: ResourceType | null;
  /** Movement speed in hexes per second */
  moveSpeed: number;
}

export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  [UnitType.Transporter]: {
    type: UnitType.Transporter,
    label: 'Transporter',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 0.55,
  },
  [UnitType.Builder]: {
    type: UnitType.Builder,
    label: 'Builder',
    category: 'civilian',
    requiredTool: 'tools' as ResourceType,
    moveSpeed: 1.2,
  },
  [UnitType.Woodcutter]: {
    type: UnitType.Woodcutter,
    label: 'Woodcutter',
    category: 'civilian',
    requiredTool: 'tools' as ResourceType,
    moveSpeed: 1.0,
  },
  [UnitType.Forester]: {
    type: UnitType.Forester,
    label: 'Forester',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Stonemason]: {
    type: UnitType.Stonemason,
    label: 'Stonemason',
    category: 'civilian',
    requiredTool: 'tools' as ResourceType,
    moveSpeed: 1.0,
  },
  [UnitType.Miner]: {
    type: UnitType.Miner,
    label: 'Miner',
    category: 'civilian',
    requiredTool: 'tools' as ResourceType,
    moveSpeed: 0.8,
  },
  [UnitType.Farmer]: {
    type: UnitType.Farmer,
    label: 'Farmer',
    category: 'civilian',
    requiredTool: 'tools' as ResourceType,
    moveSpeed: 1.0,
  },
  [UnitType.Fisherman]: {
    type: UnitType.Fisherman,
    label: 'Fisherman',
    category: 'civilian',
    requiredTool: 'tools' as ResourceType,
    moveSpeed: 1.0,
  },
  [UnitType.Geologist]: {
    type: UnitType.Geologist,
    label: 'Geologist',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 0.8,
  },
  [UnitType.SawmillWorker]: {
    type: UnitType.SawmillWorker,
    label: 'Sawmill Worker',
    category: 'civilian',
    requiredTool: null,
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
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.PigFarmer]: {
    type: UnitType.PigFarmer,
    label: 'Pig Farmer',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Butcher]: {
    type: UnitType.Butcher,
    label: 'Butcher',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.SmelterWorker]: {
    type: UnitType.SmelterWorker,
    label: 'Smelter Worker',
    category: 'civilian',
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Goldsmith]: {
    type: UnitType.Goldsmith,
    label: 'Goldsmith',
    category: 'civilian',
    requiredTool: null,
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
    requiredTool: null,
    moveSpeed: 1.0,
  },
  [UnitType.Knight]: {
    type: UnitType.Knight,
    label: 'Knight',
    category: 'military',
    requiredTool: null,
    moveSpeed: 1.2,
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
};

/** Get the UnitType needed to work at a building, or null if no worker needed */
export function getWorkerUnitType(workerLabel: string): UnitType | null {
  return WORKER_TO_UNIT_TYPE[workerLabel] ?? null;
}
