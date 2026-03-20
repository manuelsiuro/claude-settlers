/**
 * Centralized gameplay-tunable constants.
 *
 * Only balance values live here — tick-frequency / system plumbing
 * constants (ROUTING_INTERVAL, SPAWN_INTERVAL, CHECK_INTERVAL, etc.)
 * stay in their respective manager files.
 */

import { ResourceType } from '../ResourceType';
import { UnitType } from '../UnitType';
import type { Difficulty } from '../GameConfig';

// ─── Woodcutter ─────────────────────────────────────────────────────────────

/** Seconds the woodcutter spends chopping a tree */
export const WOODCUTTER_CHOP_DURATION = 8.0;
/** Seconds the woodcutter waits before searching for another tree */
export const WOODCUTTER_IDLE_COOLDOWN = 2.0;

// ─── Forester ───────────────────────────────────────────────────────────────

/** Seconds the forester spends planting a tree */
export const FORESTER_PLANT_DURATION = 5.0;
/** Seconds the forester waits before planting another tree */
export const FORESTER_IDLE_COOLDOWN = 3.0;

// ─── Geologist ──────────────────────────────────────────────────────────────

/** Seconds the geologist spends prospecting a tile */
export const GEOLOGIST_PROSPECT_DURATION = 5.0;
/** Seconds the geologist waits before prospecting another tile */
export const GEOLOGIST_IDLE_COOLDOWN = 2.0;

// ─── Trees ──────────────────────────────────────────────────────────────────

/** Maximum trees allowed on a single hex tile */
export const TREES_MAX_PER_TILE = 10;
/** Seconds for a sapling to grow to young stage */
export const TREES_SAPLING_GROWTH_TIME = 60;
/** Seconds for a young tree to grow to mature stage */
export const TREES_YOUNG_GROWTH_TIME = 90;

// ─── Combat ─────────────────────────────────────────────────────────────────

/** Number of duel wins required for a knight to rank up */
export const COMBAT_WINS_PER_RANK = 2;
/** Gold bonus multiplier per gold bar in storage */
export const COMBAT_GOLD_BONUS_PER_BAR = 0.05;
/** Maximum gold bonus (caps at this value) */
export const COMBAT_MAX_GOLD_BONUS = 0.5;

// ─── Building Upgrades ──────────────────────────────────────────────────────

/** Maximum upgrade level per axis */
export const UPGRADES_MAX_LEVEL = 10;

/** Maximum upgrade level for work radius (+1 hex per level) */
export const WORK_RADIUS_MAX_LEVEL = 3;

// ─── Victory Conditions ─────────────────────────────────────────────────────

/** Fraction of total territory needed for domination victory */
export const VICTORY_DOMINATION_THRESHOLD = 0.75;
/** Gold bars needed for economic victory */
export const VICTORY_ECONOMIC_GOLD_TARGET = 50;
/** Total processed goods needed for peaceful victory */
export const VICTORY_PEACEFUL_GOODS_TARGET = 100;

// ─── Population & Housing ──────────────────────────────────────────────────

/** Base population capacity provided by the Castle */
export const CASTLE_POPULATION_CAPACITY = 15;
/** Population capacity for Small House */
export const SMALL_HOUSE_CAPACITY = 8;
/** Population capacity for Medium House */
export const MEDIUM_HOUSE_CAPACITY = 16;
/** Population capacity for Large House */
export const LARGE_HOUSE_CAPACITY = 25;
/** Usage ratio at which the HUD counter shows a warning color */
export const POPULATION_WARNING_THRESHOLD = 0.9;
/** Usage ratio below which the HUD counter is normal (green) */
export const POPULATION_CAUTION_THRESHOLD = 0.75;

/** Population color severity based on usage ratio */
export function getPopulationSeverity(ratio: number): 'critical' | 'warning' | 'normal' {
  if (ratio >= POPULATION_WARNING_THRESHOLD) return 'critical';
  if (ratio >= POPULATION_CAUTION_THRESHOLD) return 'warning';
  return 'normal';
}

// ─── Hunger / Feeding ──────────────────────────────────────────────────────

/** Base satiation decay rate per second (full → starving in ~200s) */
export const HUNGER_DECAY_RATE = 0.005;
/** Decay multiplier when unit is working */
export const HUNGER_WORKING_MULTIPLIER = 1.2;
/** Decay multiplier for garrisoned knights */
export const HUNGER_GARRISONED_MULTIPLIER = 0.5;
/** Satiation threshold: below this = hungry penalties */
export const HUNGER_HUNGRY_THRESHOLD = 0.50;
/** Satiation threshold: below this = starving penalties */
export const HUNGER_STARVING_THRESHOLD = 0.25;
/** Speed penalty when hungry */
export const HUNGER_SPEED_PENALTY_HUNGRY = 0.20;
/** Speed penalty when starving */
export const HUNGER_SPEED_PENALTY_STARVING = 0.40;
/** Production penalty when hungry */
export const HUNGER_PRODUCTION_PENALTY_HUNGRY = 0.15;
/** Production penalty when starving */
export const HUNGER_PRODUCTION_PENALTY_STARVING = 0.30;

// ─── Day/Night ─────────────────────────────────────────────────────────────

/** Maximum night production slowdown (25% slower at full night) */
export const NIGHT_PRODUCTION_SLOWDOWN = 0.25;
/** Night speed penalty for civilian units */
export const NIGHT_SPEED_PENALTY_CIVILIAN = 0.40;
/** Night speed penalty for transporters */
export const NIGHT_SPEED_PENALTY_TRANSPORTER = 0.35;
/** Night speed penalty for knights */
export const NIGHT_SPEED_PENALTY_KNIGHT = 0.15;
/** Night speed penalty for builders */
export const NIGHT_SPEED_PENALTY_BUILDER = 0.30;
/** TorchTower/FlagLight night penalty reduction (50%) */
export const TORCH_TOWER_NIGHT_REDUCTION = 0.50;
/** Radius in hexes for TorchTower light mitigation */
export const TORCH_TOWER_LIGHT_RADIUS = 5;

// ─── Morale ────────────────────────────────────────────────────────────────

/** Base morale value when no drinks served */
export const MORALE_BASE = 0.50;
/** Rolling window for drink events (seconds) */
export const MORALE_WINDOW = 300;
/** Maximum morale bonus from drink variety */
export const MORALE_VARIETY_BONUS_MAX = 0.20;
/** Morale bonus per unique drink type served */
export const MORALE_VARIETY_PER_TYPE = 0.10;
/** Maximum morale bonus from drink volume */
export const MORALE_VOLUME_BONUS_MAX = 0.20;
/** Morale bonus per drink served in window */
export const MORALE_VOLUME_PER_DRINK = 0.02;
/** Gold bar morale bonus per bar */
export const MORALE_GOLD_BONUS_PER_BAR = 0.01;
/** Maximum gold morale bonus */
export const MORALE_GOLD_BONUS_MAX = 0.10;
/** Base morale-to-multiplier value (at morale=0.5) */
export const MORALE_MULTIPLIER_BASE = 0.85;
/** Morale-to-multiplier scaling factor */
export const MORALE_MULTIPLIER_SCALE = 0.8;

// ─── Difficulty-Based Starting Resources ───────────────────────────────────

/** Resource types included in all starting configurations (order matters for readability) */
const STARTING_RESOURCE_TYPES = [
  ResourceType.Wood, ResourceType.Stone, ResourceType.Planks,
  ResourceType.Fish, ResourceType.Bread, ResourceType.IronBars,
  ResourceType.Axe, ResourceType.Pickaxe, ResourceType.Saw,
  ResourceType.Scythe, ResourceType.FishingRod, ResourceType.Hammer,
  ResourceType.Shovel, ResourceType.Crucible,
] as const;

/** Per-difficulty starting amounts (same order as STARTING_RESOURCE_TYPES) */
const STARTING_AMOUNTS: Record<Difficulty, readonly number[]> = {
  easy:   [16, 10, 8, 6, 6, 10, 3, 3, 1, 1, 1, 3, 1, 1],
  normal: [12,  8, 6, 4, 4,  8, 2, 2, 1, 1, 1, 2, 1, 1],
  hard:   [ 8,  5, 4, 2, 2,  4, 1, 1, 1, 1, 1, 1, 1, 1],
};

function buildResourceList(amounts: readonly number[]): { resource: ResourceType; amount: number }[] {
  return STARTING_RESOURCE_TYPES.map((resource, i) => ({ resource, amount: amounts[i] }));
}

export const CASTLE_STARTING_RESOURCES_BY_DIFFICULTY: Record<Difficulty, { resource: ResourceType; amount: number }[]> = {
  easy: buildResourceList(STARTING_AMOUNTS.easy),
  normal: buildResourceList(STARTING_AMOUNTS.normal),
  hard: buildResourceList(STARTING_AMOUNTS.hard),
};

// ── Road upgrade costs ──────────────────────────────────────────────────────
export const ROAD_QUALITY_NAMES = ['Path', 'Dirt Road', 'Stone Road', 'Paved Road'];

export const ROAD_UPGRADE_COSTS: { resource: ResourceType; amount: number }[][] = [
  // 0→1: Dirt Road
  [{ resource: ResourceType.Planks, amount: 1 }],
  // 1→2: Stone Road
  [{ resource: ResourceType.Stone, amount: 2 }],
  // 2→3: Paved Road
  [{ resource: ResourceType.Stone, amount: 2 }, { resource: ResourceType.Planks, amount: 1 }],
];

export const ROAD_UPGRADE_TIMES = [5, 10, 15]; // seconds per upgrade level

/** Get upgrade cost for a road at the given quality level. Returns [] if already max. */
export function getRoadUpgradeCost(currentQuality: number): { resource: ResourceType; amount: number }[] {
  return ROAD_UPGRADE_COSTS[currentQuality] ?? [];
}

// ── Animal lifecycle constants ──────────────────────────────────────────────
/** How often animals attempt to feed (seconds) */
export const ANIMAL_FEED_INTERVAL = 10.0;

export interface AnimalSpec {
  /** Resources accepted as feed (any one satisfies) */
  feedResources: ResourceType[];
  /** Seconds between required feedings */
  feedRate: number;
  /** Maximum lifespan in seconds */
  lifespan: number;
  /** Seconds without food before death */
  starvationTime: number;
}

export const ANIMAL_SPECS: Partial<Record<string, AnimalSpec>> = {
  [UnitType.Donkey]: {
    feedResources: [ResourceType.Hay, ResourceType.Grain],
    feedRate: 120,
    lifespan: 1200, // 20 min
    starvationTime: 60,
  },
  [UnitType.HorseTransport]: {
    feedResources: [ResourceType.Hay, ResourceType.Grain],
    feedRate: 90,
    lifespan: 900, // 15 min
    starvationTime: 45,
  },
};
