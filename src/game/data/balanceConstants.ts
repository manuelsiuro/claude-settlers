/**
 * Centralized gameplay-tunable constants.
 *
 * Only balance values live here — tick-frequency / system plumbing
 * constants (ROUTING_INTERVAL, SPAWN_INTERVAL, CHECK_INTERVAL, etc.)
 * stay in their respective manager files.
 *
 * Numeric constants use `let` so that `applyBalanceOverrides()` can
 * patch them at runtime. ES module live bindings ensure all importers
 * see the updated values automatically.
 */

import { ResourceType } from '../ResourceType';
import { UnitType } from '../UnitType';
import type { Difficulty } from '../GameConfig';

// ─── Woodcutter ─────────────────────────────────────────────────────────────

/** Seconds the woodcutter spends chopping a tree */
export let WOODCUTTER_CHOP_DURATION = 8.0;
/** Seconds the woodcutter waits before searching for another tree */
export let WOODCUTTER_IDLE_COOLDOWN = 2.0;

// ─── Forester ───────────────────────────────────────────────────────────────

/** Seconds the forester spends planting a tree */
export let FORESTER_PLANT_DURATION = 5.0;
/** Seconds the forester waits before planting another tree */
export let FORESTER_IDLE_COOLDOWN = 3.0;

// ─── Geologist ──────────────────────────────────────────────────────────────

/** Seconds the geologist spends prospecting a tile */
export let GEOLOGIST_PROSPECT_DURATION = 5.0;
/** Seconds the geologist waits before prospecting another tile */
export let GEOLOGIST_IDLE_COOLDOWN = 2.0;

// ─── Trees ──────────────────────────────────────────────────────────────────

/** Maximum trees allowed on a single hex tile */
export let TREES_MAX_PER_TILE = 10;
/** Seconds for a sapling to grow to young stage */
export let TREES_SAPLING_GROWTH_TIME = 60;
/** Seconds for a young tree to grow to mature stage */
export let TREES_YOUNG_GROWTH_TIME = 90;

// ─── Combat ─────────────────────────────────────────────────────────────────

/** Number of duel wins required for a knight to rank up */
export let COMBAT_WINS_PER_RANK = 2;
/** Gold bonus multiplier per gold bar in storage */
export let COMBAT_GOLD_BONUS_PER_BAR = 0.05;
/** Maximum gold bonus (caps at this value) */
export let COMBAT_MAX_GOLD_BONUS = 0.5;

// ─── Building Upgrades ──────────────────────────────────────────────────────

/** Maximum upgrade level per axis */
export let UPGRADES_MAX_LEVEL = 10;

/** Maximum upgrade level for work radius (+1 hex per level) */
export let WORK_RADIUS_MAX_LEVEL = 3;

// ─── Victory Conditions ─────────────────────────────────────────────────────

/** Fraction of total territory needed for domination victory */
export let VICTORY_DOMINATION_THRESHOLD = 0.75;
/** Gold bars needed for economic victory */
export let VICTORY_ECONOMIC_GOLD_TARGET = 50;
/** Total processed goods needed for peaceful victory */
export let VICTORY_PEACEFUL_GOODS_TARGET = 100;

// ─── Population & Housing ──────────────────────────────────────────────────

/** Base population capacity provided by the Castle */
export let CASTLE_POPULATION_CAPACITY = 15;
/** Population capacity for Small House */
export let SMALL_HOUSE_CAPACITY = 8;
/** Population capacity for Medium House */
export let MEDIUM_HOUSE_CAPACITY = 16;
/** Population capacity for Large House */
export let LARGE_HOUSE_CAPACITY = 25;
/** Usage ratio at which the HUD counter shows a warning color */
export let POPULATION_WARNING_THRESHOLD = 0.9;
/** Usage ratio below which the HUD counter is normal (green) */
export let POPULATION_CAUTION_THRESHOLD = 0.75;

/** Population color severity based on usage ratio */
export function getPopulationSeverity(ratio: number): 'critical' | 'warning' | 'normal' {
  if (ratio >= POPULATION_WARNING_THRESHOLD) return 'critical';
  if (ratio >= POPULATION_CAUTION_THRESHOLD) return 'warning';
  return 'normal';
}

// ─── Hunger / Feeding ──────────────────────────────────────────────────────

/** Base satiation decay rate per second (full → starving in ~500s) */
export let HUNGER_DECAY_RATE = 0.002;
/** Decay multiplier when unit is working */
export let HUNGER_WORKING_MULTIPLIER = 1.2;
/** Decay multiplier for garrisoned knights */
export let HUNGER_GARRISONED_MULTIPLIER = 0.5;
/** Satiation threshold: below this = hungry penalties */
export let HUNGER_HUNGRY_THRESHOLD = 0.50;
/** Satiation threshold: below this = starving penalties */
export let HUNGER_STARVING_THRESHOLD = 0.25;
/** Speed penalty when hungry */
export let HUNGER_SPEED_PENALTY_HUNGRY = 0.20;
/** Speed penalty when starving */
export let HUNGER_SPEED_PENALTY_STARVING = 0.40;
/** Production penalty when hungry */
export let HUNGER_PRODUCTION_PENALTY_HUNGRY = 0.15;
/** Production penalty when starving */
export let HUNGER_PRODUCTION_PENALTY_STARVING = 0.30;

/** Get the display color for a satiation value, aligned with penalty thresholds */
export function getSatiationColor(satiation: number): string {
  if (satiation >= HUNGER_HUNGRY_THRESHOLD) return '#4CAF50';   // green: no penalties
  if (satiation >= HUNGER_STARVING_THRESHOLD) return '#FFB74D'; // amber: hungry
  return '#EF5350';                                              // red: starving
}

/** Get the status label for a satiation value */
export function getSatiationStatus(satiation: number): '' | 'Hungry' | 'Starving' {
  if (satiation >= HUNGER_HUNGRY_THRESHOLD) return '';
  if (satiation >= HUNGER_STARVING_THRESHOLD) return 'Hungry';
  return 'Starving';
}

// ─── Day/Night ─────────────────────────────────────────────────────────────

/** Maximum night production slowdown (25% slower at full night) */
export let NIGHT_PRODUCTION_SLOWDOWN = 0.25;
/** Night speed penalty for civilian units */
export let NIGHT_SPEED_PENALTY_CIVILIAN = 0.40;
/** Night speed penalty for transporters */
export let NIGHT_SPEED_PENALTY_TRANSPORTER = 0.35;
/** Night speed penalty for knights */
export let NIGHT_SPEED_PENALTY_KNIGHT = 0.15;
/** Night speed penalty for builders */
export let NIGHT_SPEED_PENALTY_BUILDER = 0.30;
/** TorchTower/FlagLight night penalty reduction (50%) */
export let TORCH_TOWER_NIGHT_REDUCTION = 0.50;
/** Radius in hexes for TorchTower light mitigation */
export let TORCH_TOWER_LIGHT_RADIUS = 5;

// ─── Morale ────────────────────────────────────────────────────────────────

/** Base morale value when no drinks served */
export let MORALE_BASE = 0.50;
/** Rolling window for drink events (seconds) */
export let MORALE_WINDOW = 300;
/** Maximum morale bonus from drink variety */
export let MORALE_VARIETY_BONUS_MAX = 0.20;
/** Morale bonus per unique drink type served */
export let MORALE_VARIETY_PER_TYPE = 0.10;
/** Maximum morale bonus from drink volume */
export let MORALE_VOLUME_BONUS_MAX = 0.20;
/** Morale bonus per drink served in window */
export let MORALE_VOLUME_PER_DRINK = 0.02;
/** Gold bar morale bonus per bar */
export let MORALE_GOLD_BONUS_PER_BAR = 0.01;
/** Maximum gold morale bonus */
export let MORALE_GOLD_BONUS_MAX = 0.10;
/** Base morale-to-multiplier value (at morale=0.5) */
export let MORALE_MULTIPLIER_BASE = 0.85;
/** Morale-to-multiplier scaling factor */
export let MORALE_MULTIPLIER_SCALE = 0.8;

// ─── Difficulty-Based Starting Resources ───────────────────────────────────

/** Resource types included in all starting configurations (order matters for readability) */
export const STARTING_RESOURCE_TYPES = [
  ResourceType.Wood, ResourceType.Stone, ResourceType.Planks,
  ResourceType.Fish, ResourceType.Bread, ResourceType.IronBars,
  ResourceType.Axe, ResourceType.Pickaxe, ResourceType.Saw,
  ResourceType.Scythe, ResourceType.FishingRod, ResourceType.Hammer,
  ResourceType.Shovel, ResourceType.Crucible,
] as const;

/** Per-difficulty starting amounts (same order as STARTING_RESOURCE_TYPES) */
const STARTING_AMOUNTS: Record<Difficulty, readonly number[]> = {
  easy:   [16, 10, 8, 10, 10, 10, 3, 3, 1, 1, 1, 3, 1, 1],
  normal: [12,  8, 6,  8,  8,  8, 2, 2, 1, 1, 1, 2, 1, 1],
  hard:   [ 8,  5, 4,  4,  4,  4, 1, 1, 1, 1, 1, 1, 1, 1],
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
export let ANIMAL_FEED_INTERVAL = 10.0;

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

// ─── Balance Override System ──────────────────────────────────────────────

export interface BalanceConfigOverrides {
  woodcutter?: { chopDuration?: number; idleCooldown?: number };
  forester?: { plantDuration?: number; idleCooldown?: number };
  geologist?: { prospectDuration?: number; idleCooldown?: number };
  trees?: { maxPerTile?: number; saplingGrowthTime?: number; youngGrowthTime?: number };
  combat?: { winsPerRank?: number; goldBonusPerBar?: number; maxGoldBonus?: number };
  upgrades?: { maxLevel?: number; workRadiusMaxLevel?: number };
  victory?: { dominationThreshold?: number; economicGoldTarget?: number; peacefulGoodsTarget?: number };
  population?: {
    castleCapacity?: number; smallHouseCapacity?: number;
    mediumHouseCapacity?: number; largeHouseCapacity?: number;
    warningThreshold?: number; cautionThreshold?: number;
  };
  hunger?: {
    decayRate?: number; workingMultiplier?: number; garrisonedMultiplier?: number;
    hungryThreshold?: number; starvingThreshold?: number;
    speedPenaltyHungry?: number; speedPenaltyStarving?: number;
    productionPenaltyHungry?: number; productionPenaltyStarving?: number;
  };
  night?: {
    productionSlowdown?: number; speedPenaltyCivilian?: number;
    speedPenaltyTransporter?: number; speedPenaltyKnight?: number;
    speedPenaltyBuilder?: number; torchTowerReduction?: number;
    torchTowerRadius?: number;
  };
  morale?: {
    base?: number; window?: number;
    varietyBonusMax?: number; varietyPerType?: number;
    volumeBonusMax?: number; volumePerDrink?: number;
    goldBonusPerBar?: number; goldBonusMax?: number;
    multiplierBase?: number; multiplierScale?: number;
  };
  animals?: { feedInterval?: number };
  startingResources?: Partial<Record<Difficulty, { resource: string; amount: number }[]>>;
}

/** Apply balance overrides from a config object. Only specified values are changed. */
export function applyBalanceOverrides(config: BalanceConfigOverrides): void {
  // Woodcutter
  if (config.woodcutter?.chopDuration !== undefined) WOODCUTTER_CHOP_DURATION = config.woodcutter.chopDuration;
  if (config.woodcutter?.idleCooldown !== undefined) WOODCUTTER_IDLE_COOLDOWN = config.woodcutter.idleCooldown;
  // Forester
  if (config.forester?.plantDuration !== undefined) FORESTER_PLANT_DURATION = config.forester.plantDuration;
  if (config.forester?.idleCooldown !== undefined) FORESTER_IDLE_COOLDOWN = config.forester.idleCooldown;
  // Geologist
  if (config.geologist?.prospectDuration !== undefined) GEOLOGIST_PROSPECT_DURATION = config.geologist.prospectDuration;
  if (config.geologist?.idleCooldown !== undefined) GEOLOGIST_IDLE_COOLDOWN = config.geologist.idleCooldown;
  // Trees
  if (config.trees?.maxPerTile !== undefined) TREES_MAX_PER_TILE = config.trees.maxPerTile;
  if (config.trees?.saplingGrowthTime !== undefined) TREES_SAPLING_GROWTH_TIME = config.trees.saplingGrowthTime;
  if (config.trees?.youngGrowthTime !== undefined) TREES_YOUNG_GROWTH_TIME = config.trees.youngGrowthTime;
  // Combat
  if (config.combat?.winsPerRank !== undefined) COMBAT_WINS_PER_RANK = config.combat.winsPerRank;
  if (config.combat?.goldBonusPerBar !== undefined) COMBAT_GOLD_BONUS_PER_BAR = config.combat.goldBonusPerBar;
  if (config.combat?.maxGoldBonus !== undefined) COMBAT_MAX_GOLD_BONUS = config.combat.maxGoldBonus;
  // Upgrades
  if (config.upgrades?.maxLevel !== undefined) UPGRADES_MAX_LEVEL = config.upgrades.maxLevel;
  if (config.upgrades?.workRadiusMaxLevel !== undefined) WORK_RADIUS_MAX_LEVEL = config.upgrades.workRadiusMaxLevel;
  // Victory
  if (config.victory?.dominationThreshold !== undefined) VICTORY_DOMINATION_THRESHOLD = config.victory.dominationThreshold;
  if (config.victory?.economicGoldTarget !== undefined) VICTORY_ECONOMIC_GOLD_TARGET = config.victory.economicGoldTarget;
  if (config.victory?.peacefulGoodsTarget !== undefined) VICTORY_PEACEFUL_GOODS_TARGET = config.victory.peacefulGoodsTarget;
  // Population
  if (config.population?.castleCapacity !== undefined) CASTLE_POPULATION_CAPACITY = config.population.castleCapacity;
  if (config.population?.smallHouseCapacity !== undefined) SMALL_HOUSE_CAPACITY = config.population.smallHouseCapacity;
  if (config.population?.mediumHouseCapacity !== undefined) MEDIUM_HOUSE_CAPACITY = config.population.mediumHouseCapacity;
  if (config.population?.largeHouseCapacity !== undefined) LARGE_HOUSE_CAPACITY = config.population.largeHouseCapacity;
  if (config.population?.warningThreshold !== undefined) POPULATION_WARNING_THRESHOLD = config.population.warningThreshold;
  if (config.population?.cautionThreshold !== undefined) POPULATION_CAUTION_THRESHOLD = config.population.cautionThreshold;
  // Hunger
  if (config.hunger?.decayRate !== undefined) HUNGER_DECAY_RATE = config.hunger.decayRate;
  if (config.hunger?.workingMultiplier !== undefined) HUNGER_WORKING_MULTIPLIER = config.hunger.workingMultiplier;
  if (config.hunger?.garrisonedMultiplier !== undefined) HUNGER_GARRISONED_MULTIPLIER = config.hunger.garrisonedMultiplier;
  if (config.hunger?.hungryThreshold !== undefined) HUNGER_HUNGRY_THRESHOLD = config.hunger.hungryThreshold;
  if (config.hunger?.starvingThreshold !== undefined) HUNGER_STARVING_THRESHOLD = config.hunger.starvingThreshold;
  if (config.hunger?.speedPenaltyHungry !== undefined) HUNGER_SPEED_PENALTY_HUNGRY = config.hunger.speedPenaltyHungry;
  if (config.hunger?.speedPenaltyStarving !== undefined) HUNGER_SPEED_PENALTY_STARVING = config.hunger.speedPenaltyStarving;
  if (config.hunger?.productionPenaltyHungry !== undefined) HUNGER_PRODUCTION_PENALTY_HUNGRY = config.hunger.productionPenaltyHungry;
  if (config.hunger?.productionPenaltyStarving !== undefined) HUNGER_PRODUCTION_PENALTY_STARVING = config.hunger.productionPenaltyStarving;
  // Night
  if (config.night?.productionSlowdown !== undefined) NIGHT_PRODUCTION_SLOWDOWN = config.night.productionSlowdown;
  if (config.night?.speedPenaltyCivilian !== undefined) NIGHT_SPEED_PENALTY_CIVILIAN = config.night.speedPenaltyCivilian;
  if (config.night?.speedPenaltyTransporter !== undefined) NIGHT_SPEED_PENALTY_TRANSPORTER = config.night.speedPenaltyTransporter;
  if (config.night?.speedPenaltyKnight !== undefined) NIGHT_SPEED_PENALTY_KNIGHT = config.night.speedPenaltyKnight;
  if (config.night?.speedPenaltyBuilder !== undefined) NIGHT_SPEED_PENALTY_BUILDER = config.night.speedPenaltyBuilder;
  if (config.night?.torchTowerReduction !== undefined) TORCH_TOWER_NIGHT_REDUCTION = config.night.torchTowerReduction;
  if (config.night?.torchTowerRadius !== undefined) TORCH_TOWER_LIGHT_RADIUS = config.night.torchTowerRadius;
  // Morale
  if (config.morale?.base !== undefined) MORALE_BASE = config.morale.base;
  if (config.morale?.window !== undefined) MORALE_WINDOW = config.morale.window;
  if (config.morale?.varietyBonusMax !== undefined) MORALE_VARIETY_BONUS_MAX = config.morale.varietyBonusMax;
  if (config.morale?.varietyPerType !== undefined) MORALE_VARIETY_PER_TYPE = config.morale.varietyPerType;
  if (config.morale?.volumeBonusMax !== undefined) MORALE_VOLUME_BONUS_MAX = config.morale.volumeBonusMax;
  if (config.morale?.volumePerDrink !== undefined) MORALE_VOLUME_PER_DRINK = config.morale.volumePerDrink;
  if (config.morale?.goldBonusPerBar !== undefined) MORALE_GOLD_BONUS_PER_BAR = config.morale.goldBonusPerBar;
  if (config.morale?.goldBonusMax !== undefined) MORALE_GOLD_BONUS_MAX = config.morale.goldBonusMax;
  if (config.morale?.multiplierBase !== undefined) MORALE_MULTIPLIER_BASE = config.morale.multiplierBase;
  if (config.morale?.multiplierScale !== undefined) MORALE_MULTIPLIER_SCALE = config.morale.multiplierScale;
  // Animals
  if (config.animals?.feedInterval !== undefined) ANIMAL_FEED_INTERVAL = config.animals.feedInterval;
  // Starting Resources
  if (config.startingResources) {
    for (const [diff, items] of Object.entries(config.startingResources)) {
      if (items) {
        CASTLE_STARTING_RESOURCES_BY_DIFFICULTY[diff as Difficulty] = items.map(item => ({
          resource: item.resource as ResourceType,
          amount: item.amount,
        }));
      }
    }
  }
}

/** Reset all balance constants to their default values. */
export function resetBalanceDefaults(): void {
  WOODCUTTER_CHOP_DURATION = 8.0;
  WOODCUTTER_IDLE_COOLDOWN = 2.0;
  FORESTER_PLANT_DURATION = 5.0;
  FORESTER_IDLE_COOLDOWN = 3.0;
  GEOLOGIST_PROSPECT_DURATION = 5.0;
  GEOLOGIST_IDLE_COOLDOWN = 2.0;
  TREES_MAX_PER_TILE = 10;
  TREES_SAPLING_GROWTH_TIME = 60;
  TREES_YOUNG_GROWTH_TIME = 90;
  COMBAT_WINS_PER_RANK = 2;
  COMBAT_GOLD_BONUS_PER_BAR = 0.05;
  COMBAT_MAX_GOLD_BONUS = 0.5;
  UPGRADES_MAX_LEVEL = 10;
  WORK_RADIUS_MAX_LEVEL = 3;
  VICTORY_DOMINATION_THRESHOLD = 0.75;
  VICTORY_ECONOMIC_GOLD_TARGET = 50;
  VICTORY_PEACEFUL_GOODS_TARGET = 100;
  CASTLE_POPULATION_CAPACITY = 15;
  SMALL_HOUSE_CAPACITY = 8;
  MEDIUM_HOUSE_CAPACITY = 16;
  LARGE_HOUSE_CAPACITY = 25;
  POPULATION_WARNING_THRESHOLD = 0.9;
  POPULATION_CAUTION_THRESHOLD = 0.75;
  HUNGER_DECAY_RATE = 0.002;
  HUNGER_WORKING_MULTIPLIER = 1.2;
  HUNGER_GARRISONED_MULTIPLIER = 0.5;
  HUNGER_HUNGRY_THRESHOLD = 0.50;
  HUNGER_STARVING_THRESHOLD = 0.25;
  HUNGER_SPEED_PENALTY_HUNGRY = 0.20;
  HUNGER_SPEED_PENALTY_STARVING = 0.40;
  HUNGER_PRODUCTION_PENALTY_HUNGRY = 0.15;
  HUNGER_PRODUCTION_PENALTY_STARVING = 0.30;
  NIGHT_PRODUCTION_SLOWDOWN = 0.25;
  NIGHT_SPEED_PENALTY_CIVILIAN = 0.40;
  NIGHT_SPEED_PENALTY_TRANSPORTER = 0.35;
  NIGHT_SPEED_PENALTY_KNIGHT = 0.15;
  NIGHT_SPEED_PENALTY_BUILDER = 0.30;
  TORCH_TOWER_NIGHT_REDUCTION = 0.50;
  TORCH_TOWER_LIGHT_RADIUS = 5;
  MORALE_BASE = 0.50;
  MORALE_WINDOW = 300;
  MORALE_VARIETY_BONUS_MAX = 0.20;
  MORALE_VARIETY_PER_TYPE = 0.10;
  MORALE_VOLUME_BONUS_MAX = 0.20;
  MORALE_VOLUME_PER_DRINK = 0.02;
  MORALE_GOLD_BONUS_PER_BAR = 0.01;
  MORALE_GOLD_BONUS_MAX = 0.10;
  MORALE_MULTIPLIER_BASE = 0.85;
  MORALE_MULTIPLIER_SCALE = 0.8;
  ANIMAL_FEED_INTERVAL = 10.0;
  // Starting Resources
  CASTLE_STARTING_RESOURCES_BY_DIFFICULTY.easy = buildResourceList(STARTING_AMOUNTS.easy);
  CASTLE_STARTING_RESOURCES_BY_DIFFICULTY.normal = buildResourceList(STARTING_AMOUNTS.normal);
  CASTLE_STARTING_RESOURCES_BY_DIFFICULTY.hard = buildResourceList(STARTING_AMOUNTS.hard);
}
