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

// ─── Terrain Gathering ─────────────────────────────────────────────────────

/** Fraction of productionTime spent at the gathering site (the rest is travel) */
export let TERRAIN_GATHERING_WORK_FRACTION = 0.4;
/** Seconds the gatherer waits before searching for another terrain tile */
export let TERRAIN_GATHERING_IDLE_COOLDOWN = 3;

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

/** Base satiation decay rate per second (full → starving in ~1000s) */
export let HUNGER_DECAY_RATE = 0.001;
/** Decay multiplier when unit is working (1.0 = no extra penalty) */
export let HUNGER_WORKING_MULTIPLIER = 1.0;
/** Decay multiplier for garrisoned knights */
export let HUNGER_GARRISONED_MULTIPLIER = 0.5;
/** Decay multiplier for workers in food-producing buildings */
export let HUNGER_FOOD_PRODUCER_MULTIPLIER = 0.5;
/** Satiation threshold: below this = hungry penalties */
export let HUNGER_HUNGRY_THRESHOLD = 0.35;
/** Satiation threshold: below this = starving penalties */
export let HUNGER_STARVING_THRESHOLD = 0.15;
/** Speed penalty when hungry */
export let HUNGER_SPEED_PENALTY_HUNGRY = 0.10;
/** Speed penalty when starving */
export let HUNGER_SPEED_PENALTY_STARVING = 0.25;
/** Production penalty when hungry */
export let HUNGER_PRODUCTION_PENALTY_HUNGRY = 0.05;
/** Production penalty when starving */
export let HUNGER_PRODUCTION_PENALTY_STARVING = 0.15;

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
/** Morale bonus per unique luxury type served */
export let MORALE_LUXURY_VARIETY_PER_TYPE = 0.05;
/** Maximum morale bonus from luxury variety */
export let MORALE_LUXURY_VARIETY_MAX = 0.10;
/** Morale bonus per luxury item served in window */
export let MORALE_LUXURY_VOLUME_PER_ITEM = 0.008;
/** Maximum morale bonus from luxury volume */
export let MORALE_LUXURY_VOLUME_MAX = 0.08;

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

// ─── Ambient Life & Decorations ──────────────────────────────────────────────

/** Wild animal visual scales (uniform XYZ) */
export let WILD_ANIMAL_SCALE_DEER = 0.15;
export let WILD_ANIMAL_SCALE_RABBIT = 0.30;
export let WILD_ANIMAL_SCALE_MOUNTAIN_GOAT = 0.12;
export let WILD_ANIMAL_SCALE_FISH = 0.30;

/** Bird flock rendering */
export let BIRD_MODEL_SCALE = 0.25;
export let BIRD_FLOCK_COUNT = 5;
export let BIRD_MIN_PER_FLOCK = 3;
export let BIRD_MAX_PER_FLOCK = 8;
export let BIRD_FLOCK_SPREAD = 2.0;
export let BIRD_MIN_HEIGHT = 6;
export let BIRD_MAX_HEIGHT = 12;
export let BIRD_MIN_SPEED = 1.5;
export let BIRD_MAX_SPEED = 3.0;
export let BIRD_WING_FLAP_FREQ = 6.0;
export let BIRD_WING_FLAP_AMPLITUDE = 0.4;
export let BIRD_WRAP_DISTANCE = 20;
export let BIRD_NIGHTNESS_FADE_START = 0.5;
export let BIRD_NIGHTNESS_FADE_END = 0.7;

/** Bee rendering near flowers */
export let BEE_MODEL_SCALE = 0.08;
export let BEE_MAX_COUNT_DESKTOP = 25;
export let BEE_MAX_COUNT_MOBILE = 15;
export let BEE_WING_FLAP_FREQ = 20.0;
export let BEE_WING_FLAP_AMPLITUDE = 0.3;
export let BEE_WANDER_RADIUS = 0.5;
export let BEE_HOVER_HEIGHT = 0.2;
export let BEE_NIGHTNESS_FADE_START = 0.3;
export let BEE_NIGHTNESS_FADE_END = 0.5;

/** Grassland flower patch placement */
export let FLOWER_PATCHES_MIN = 3;
export let FLOWER_PATCHES_MAX = 6;
export let FLOWER_PATCH_SCALE_MIN = 3.0;
export let FLOWER_PATCH_SCALE_MAX = 5.0;
export let FLOWER_PATCH_SPREAD = 0.45;

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

// ─── Marketplace ─────────────────────────────────────────────────────────

/** Base trade values — dimensionless relative worth of each resource */
export let MARKETPLACE_BASE_VALUES: Record<string, number> = {
  // Raw materials (1–6)
  wood: 2, stone: 3, grain: 2, fish: 3,
  iron_ore: 4, coal_ore: 3, gold_ore: 6,
  grapes: 3, fruit: 2, water_barrel: 1,
  milk: 3, hay: 1, wool: 3, raw_leather: 3,
  // Processed goods (4–20)
  planks: 4, flour: 4, bread: 7, meat: 8,
  iron_bars: 8, gold_bars: 15, swords: 12, shields: 12,
  wine: 8, beer: 6, cheese: 7, cloth: 6,
  worked_leather: 7, arrows: 5, bow: 10, siege_ram: 20,
  // Tools (6)
  axe: 6, pickaxe: 6, saw: 6, scythe: 6,
  fishing_rod: 6, hammer_tool: 6, shovel: 6,
  rolling_pin: 6, cleaver: 6, crucible: 6, tongs: 6,
  // Animals (8–12)
  pigs: 8, cattle: 10, horses: 12,
};

/** Fee applied to Market trades (fraction of value lost) */
export let MARKETPLACE_FEE = 0.10;
/** Seconds between trades at the Market */
export let MARKETPLACE_TRADE_COOLDOWN = 3.0;
/** Max items per single trade at Market */
export let MARKETPLACE_MAX_TRADE_SIZE = 10;
/** Seconds between NPC stock refreshes */
export let MARKETPLACE_RESTOCK_INTERVAL = 60;
/** Min items NPC has per offered resource */
export let MARKETPLACE_NPC_STOCK_MIN = 3;
/** Max items NPC has per offered resource */
export let MARKETPLACE_NPC_STOCK_MAX = 8;
/** Number of resource types the NPC offers per restock */
export let MARKETPLACE_OFFERED_RESOURCE_COUNT = 12;
/** Extra offer probability for resources the player is short of */
export let MARKETPLACE_SCARCITY_BONUS = 0.50;

/** Dynamic pricing: multiplier increase per unit bought */
export let MARKETPLACE_PRICE_SHIFT_BUY = 0.05;
/** Dynamic pricing: multiplier decrease per unit sold */
export let MARKETPLACE_PRICE_SHIFT_SELL = 0.03;
/** Dynamic pricing: decay speed toward 1.0 per second */
export let MARKETPLACE_PRICE_DECAY_RATE = 0.002;
/** Dynamic pricing: minimum multiplier floor */
export let MARKETPLACE_PRICE_MIN = 0.5;
/** Dynamic pricing: maximum multiplier ceiling */
export let MARKETPLACE_PRICE_MAX = 2.0;

/** Castle trade fee (higher than Market) */
export let CASTLE_TRADE_FEE = 0.25;
/** Seconds between trades at the Castle */
export let CASTLE_TRADE_COOLDOWN = 10.0;
/** Max items per single trade at Castle */
export let CASTLE_TRADE_MAX_SIZE = 5;
/** Whether Castle trading is enabled */
export let CASTLE_TRADE_ENABLED = true;

/** Seconds between traveling merchant visits */
export let MERCHANT_VISIT_INTERVAL = 300;
/** How long the merchant stays (seconds) */
export let MERCHANT_VISIT_DURATION = 60;
/** Number of special deals per merchant visit */
export let MERCHANT_DEAL_COUNT = 3;
/** Discount on merchant deals (fraction, 0.20 = 20% better) */
export let MERCHANT_DISCOUNT = 0.20;

/** Seconds between auto-trade rule evaluations */
export let AUTOTRADE_CHECK_INTERVAL = 15.0;
/** Maximum number of active auto-trade rules */
export let AUTOTRADE_MAX_RULES = 8;

/** Seconds between AI trade evaluations */
export let AI_TRADE_CHECK_INTERVAL = 30;
/** AI trades surplus when stock > consumption rate × this */
export let AI_TRADE_SURPLUS_THRESHOLD = 1.5;
/** AI buys when stock < consumption rate × this */
export let AI_TRADE_SHORTAGE_THRESHOLD = 0.5;
/** AI won't trade if price multiplier exceeds this */
export let AI_TRADE_PRICE_SENSITIVITY = 1.3;

// ─── Balance Override System ──────────────────────────────────────────────

export interface BalanceConfigOverrides {
  woodcutter?: { chopDuration?: number; idleCooldown?: number };
  forester?: { plantDuration?: number; idleCooldown?: number };
  geologist?: { prospectDuration?: number; idleCooldown?: number };
  terrainGathering?: { workFraction?: number; idleCooldown?: number };
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
    foodProducerMultiplier?: number;
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
    luxuryVarietyPerType?: number; luxuryVarietyMax?: number;
    luxuryVolumePerItem?: number; luxuryVolumeMax?: number;
  };
  animals?: { feedInterval?: number };
  ambientLife?: {
    scaleDeer?: number; scaleRabbit?: number;
    scaleMountainGoat?: number; scaleFish?: number;
    flowerPatchesMin?: number; flowerPatchesMax?: number;
    flowerPatchScaleMin?: number; flowerPatchScaleMax?: number;
    flowerPatchSpread?: number;
    birdScale?: number; birdFlockCount?: number;
    birdMinPerFlock?: number; birdMaxPerFlock?: number;
    birdMinHeight?: number; birdMaxHeight?: number;
    birdWingFlapFreq?: number; birdWingFlapAmplitude?: number;
    beeScale?: number; beeMaxCountDesktop?: number; beeMaxCountMobile?: number;
    beeWingFlapFreq?: number; beeWingFlapAmplitude?: number;
    beeWanderRadius?: number; beeHoverHeight?: number;
  };
  marketplace?: {
    fee?: number; tradeCooldown?: number; maxTradeSize?: number;
    priceShiftBuy?: number; priceShiftSell?: number;
    priceDecayRate?: number; priceMin?: number; priceMax?: number;
    restockInterval?: number; npcStockMin?: number; npcStockMax?: number;
    offeredResourceCount?: number; scarcityBonus?: number;
    castleTradeFee?: number; castleTradeCooldown?: number;
    castleTradeMaxSize?: number; castleTradeEnabled?: boolean;
    merchantVisitInterval?: number; merchantVisitDuration?: number;
    merchantDealCount?: number; merchantDiscount?: number;
    autoTradeCheckInterval?: number; autoTradeMaxRules?: number;
    aiTradeCheckInterval?: number; aiTradeSurplusThreshold?: number;
    aiTradeShortageThreshold?: number; aiTradePriceSensitivity?: number;
    baseValues?: Partial<Record<string, number>>;
  };
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
  // Terrain Gathering
  if (config.terrainGathering?.workFraction !== undefined) TERRAIN_GATHERING_WORK_FRACTION = config.terrainGathering.workFraction;
  if (config.terrainGathering?.idleCooldown !== undefined) TERRAIN_GATHERING_IDLE_COOLDOWN = config.terrainGathering.idleCooldown;
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
  if (config.hunger?.foodProducerMultiplier !== undefined) HUNGER_FOOD_PRODUCER_MULTIPLIER = config.hunger.foodProducerMultiplier;
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
  if (config.morale?.luxuryVarietyPerType !== undefined) MORALE_LUXURY_VARIETY_PER_TYPE = config.morale.luxuryVarietyPerType;
  if (config.morale?.luxuryVarietyMax !== undefined) MORALE_LUXURY_VARIETY_MAX = config.morale.luxuryVarietyMax;
  if (config.morale?.luxuryVolumePerItem !== undefined) MORALE_LUXURY_VOLUME_PER_ITEM = config.morale.luxuryVolumePerItem;
  if (config.morale?.luxuryVolumeMax !== undefined) MORALE_LUXURY_VOLUME_MAX = config.morale.luxuryVolumeMax;
  // Animals
  if (config.animals?.feedInterval !== undefined) ANIMAL_FEED_INTERVAL = config.animals.feedInterval;
  // Ambient Life & Decorations
  if (config.ambientLife?.scaleDeer !== undefined) WILD_ANIMAL_SCALE_DEER = config.ambientLife.scaleDeer;
  if (config.ambientLife?.scaleRabbit !== undefined) WILD_ANIMAL_SCALE_RABBIT = config.ambientLife.scaleRabbit;
  if (config.ambientLife?.scaleMountainGoat !== undefined) WILD_ANIMAL_SCALE_MOUNTAIN_GOAT = config.ambientLife.scaleMountainGoat;
  if (config.ambientLife?.scaleFish !== undefined) WILD_ANIMAL_SCALE_FISH = config.ambientLife.scaleFish;
  if (config.ambientLife?.flowerPatchesMin !== undefined) FLOWER_PATCHES_MIN = config.ambientLife.flowerPatchesMin;
  if (config.ambientLife?.flowerPatchesMax !== undefined) FLOWER_PATCHES_MAX = config.ambientLife.flowerPatchesMax;
  if (config.ambientLife?.flowerPatchScaleMin !== undefined) FLOWER_PATCH_SCALE_MIN = config.ambientLife.flowerPatchScaleMin;
  if (config.ambientLife?.flowerPatchScaleMax !== undefined) FLOWER_PATCH_SCALE_MAX = config.ambientLife.flowerPatchScaleMax;
  if (config.ambientLife?.flowerPatchSpread !== undefined) FLOWER_PATCH_SPREAD = config.ambientLife.flowerPatchSpread;
  if (config.ambientLife?.birdScale !== undefined) BIRD_MODEL_SCALE = config.ambientLife.birdScale;
  if (config.ambientLife?.birdFlockCount !== undefined) BIRD_FLOCK_COUNT = config.ambientLife.birdFlockCount;
  if (config.ambientLife?.birdMinPerFlock !== undefined) BIRD_MIN_PER_FLOCK = config.ambientLife.birdMinPerFlock;
  if (config.ambientLife?.birdMaxPerFlock !== undefined) BIRD_MAX_PER_FLOCK = config.ambientLife.birdMaxPerFlock;
  if (config.ambientLife?.birdMinHeight !== undefined) BIRD_MIN_HEIGHT = config.ambientLife.birdMinHeight;
  if (config.ambientLife?.birdMaxHeight !== undefined) BIRD_MAX_HEIGHT = config.ambientLife.birdMaxHeight;
  if (config.ambientLife?.birdWingFlapFreq !== undefined) BIRD_WING_FLAP_FREQ = config.ambientLife.birdWingFlapFreq;
  if (config.ambientLife?.birdWingFlapAmplitude !== undefined) BIRD_WING_FLAP_AMPLITUDE = config.ambientLife.birdWingFlapAmplitude;
  if (config.ambientLife?.beeScale !== undefined) BEE_MODEL_SCALE = config.ambientLife.beeScale;
  if (config.ambientLife?.beeMaxCountDesktop !== undefined) BEE_MAX_COUNT_DESKTOP = config.ambientLife.beeMaxCountDesktop;
  if (config.ambientLife?.beeMaxCountMobile !== undefined) BEE_MAX_COUNT_MOBILE = config.ambientLife.beeMaxCountMobile;
  if (config.ambientLife?.beeWingFlapFreq !== undefined) BEE_WING_FLAP_FREQ = config.ambientLife.beeWingFlapFreq;
  if (config.ambientLife?.beeWingFlapAmplitude !== undefined) BEE_WING_FLAP_AMPLITUDE = config.ambientLife.beeWingFlapAmplitude;
  if (config.ambientLife?.beeWanderRadius !== undefined) BEE_WANDER_RADIUS = config.ambientLife.beeWanderRadius;
  if (config.ambientLife?.beeHoverHeight !== undefined) BEE_HOVER_HEIGHT = config.ambientLife.beeHoverHeight;
  // Marketplace
  if (config.marketplace?.fee !== undefined) MARKETPLACE_FEE = config.marketplace.fee;
  if (config.marketplace?.tradeCooldown !== undefined) MARKETPLACE_TRADE_COOLDOWN = config.marketplace.tradeCooldown;
  if (config.marketplace?.maxTradeSize !== undefined) MARKETPLACE_MAX_TRADE_SIZE = config.marketplace.maxTradeSize;
  if (config.marketplace?.priceShiftBuy !== undefined) MARKETPLACE_PRICE_SHIFT_BUY = config.marketplace.priceShiftBuy;
  if (config.marketplace?.priceShiftSell !== undefined) MARKETPLACE_PRICE_SHIFT_SELL = config.marketplace.priceShiftSell;
  if (config.marketplace?.priceDecayRate !== undefined) MARKETPLACE_PRICE_DECAY_RATE = config.marketplace.priceDecayRate;
  if (config.marketplace?.priceMin !== undefined) MARKETPLACE_PRICE_MIN = config.marketplace.priceMin;
  if (config.marketplace?.priceMax !== undefined) MARKETPLACE_PRICE_MAX = config.marketplace.priceMax;
  if (config.marketplace?.restockInterval !== undefined) MARKETPLACE_RESTOCK_INTERVAL = config.marketplace.restockInterval;
  if (config.marketplace?.npcStockMin !== undefined) MARKETPLACE_NPC_STOCK_MIN = config.marketplace.npcStockMin;
  if (config.marketplace?.npcStockMax !== undefined) MARKETPLACE_NPC_STOCK_MAX = config.marketplace.npcStockMax;
  if (config.marketplace?.offeredResourceCount !== undefined) MARKETPLACE_OFFERED_RESOURCE_COUNT = config.marketplace.offeredResourceCount;
  if (config.marketplace?.scarcityBonus !== undefined) MARKETPLACE_SCARCITY_BONUS = config.marketplace.scarcityBonus;
  if (config.marketplace?.castleTradeFee !== undefined) CASTLE_TRADE_FEE = config.marketplace.castleTradeFee;
  if (config.marketplace?.castleTradeCooldown !== undefined) CASTLE_TRADE_COOLDOWN = config.marketplace.castleTradeCooldown;
  if (config.marketplace?.castleTradeMaxSize !== undefined) CASTLE_TRADE_MAX_SIZE = config.marketplace.castleTradeMaxSize;
  if (config.marketplace?.castleTradeEnabled !== undefined) CASTLE_TRADE_ENABLED = config.marketplace.castleTradeEnabled;
  if (config.marketplace?.merchantVisitInterval !== undefined) MERCHANT_VISIT_INTERVAL = config.marketplace.merchantVisitInterval;
  if (config.marketplace?.merchantVisitDuration !== undefined) MERCHANT_VISIT_DURATION = config.marketplace.merchantVisitDuration;
  if (config.marketplace?.merchantDealCount !== undefined) MERCHANT_DEAL_COUNT = config.marketplace.merchantDealCount;
  if (config.marketplace?.merchantDiscount !== undefined) MERCHANT_DISCOUNT = config.marketplace.merchantDiscount;
  if (config.marketplace?.autoTradeCheckInterval !== undefined) AUTOTRADE_CHECK_INTERVAL = config.marketplace.autoTradeCheckInterval;
  if (config.marketplace?.autoTradeMaxRules !== undefined) AUTOTRADE_MAX_RULES = config.marketplace.autoTradeMaxRules;
  if (config.marketplace?.aiTradeCheckInterval !== undefined) AI_TRADE_CHECK_INTERVAL = config.marketplace.aiTradeCheckInterval;
  if (config.marketplace?.aiTradeSurplusThreshold !== undefined) AI_TRADE_SURPLUS_THRESHOLD = config.marketplace.aiTradeSurplusThreshold;
  if (config.marketplace?.aiTradeShortageThreshold !== undefined) AI_TRADE_SHORTAGE_THRESHOLD = config.marketplace.aiTradeShortageThreshold;
  if (config.marketplace?.aiTradePriceSensitivity !== undefined) AI_TRADE_PRICE_SENSITIVITY = config.marketplace.aiTradePriceSensitivity;
  if (config.marketplace?.baseValues) {
    for (const [res, val] of Object.entries(config.marketplace.baseValues)) {
      if (val !== undefined) MARKETPLACE_BASE_VALUES[res] = val;
    }
  }
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
  TERRAIN_GATHERING_WORK_FRACTION = 0.4;
  TERRAIN_GATHERING_IDLE_COOLDOWN = 3;
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
  HUNGER_DECAY_RATE = 0.001;
  HUNGER_WORKING_MULTIPLIER = 1.0;
  HUNGER_GARRISONED_MULTIPLIER = 0.5;
  HUNGER_FOOD_PRODUCER_MULTIPLIER = 0.5;
  HUNGER_HUNGRY_THRESHOLD = 0.35;
  HUNGER_STARVING_THRESHOLD = 0.15;
  HUNGER_SPEED_PENALTY_HUNGRY = 0.10;
  HUNGER_SPEED_PENALTY_STARVING = 0.25;
  HUNGER_PRODUCTION_PENALTY_HUNGRY = 0.05;
  HUNGER_PRODUCTION_PENALTY_STARVING = 0.15;
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
  MORALE_LUXURY_VARIETY_PER_TYPE = 0.05;
  MORALE_LUXURY_VARIETY_MAX = 0.10;
  MORALE_LUXURY_VOLUME_PER_ITEM = 0.008;
  MORALE_LUXURY_VOLUME_MAX = 0.08;
  ANIMAL_FEED_INTERVAL = 10.0;
  // Ambient Life & Decorations
  WILD_ANIMAL_SCALE_DEER = 0.15;
  WILD_ANIMAL_SCALE_RABBIT = 0.30;
  WILD_ANIMAL_SCALE_MOUNTAIN_GOAT = 0.12;
  WILD_ANIMAL_SCALE_FISH = 0.30;
  FLOWER_PATCHES_MIN = 3;
  FLOWER_PATCHES_MAX = 6;
  FLOWER_PATCH_SCALE_MIN = 3.0;
  FLOWER_PATCH_SCALE_MAX = 5.0;
  FLOWER_PATCH_SPREAD = 0.45;
  BIRD_MODEL_SCALE = 0.25;
  BIRD_FLOCK_COUNT = 5;
  BIRD_MIN_PER_FLOCK = 3;
  BIRD_MAX_PER_FLOCK = 8;
  BIRD_FLOCK_SPREAD = 2.0;
  BIRD_MIN_HEIGHT = 6;
  BIRD_MAX_HEIGHT = 12;
  BIRD_MIN_SPEED = 1.5;
  BIRD_MAX_SPEED = 3.0;
  BIRD_WING_FLAP_FREQ = 6.0;
  BIRD_WING_FLAP_AMPLITUDE = 0.4;
  BIRD_WRAP_DISTANCE = 20;
  BIRD_NIGHTNESS_FADE_START = 0.5;
  BIRD_NIGHTNESS_FADE_END = 0.7;
  BEE_MODEL_SCALE = 0.08;
  BEE_MAX_COUNT_DESKTOP = 25;
  BEE_MAX_COUNT_MOBILE = 15;
  BEE_WING_FLAP_FREQ = 20.0;
  BEE_WING_FLAP_AMPLITUDE = 0.3;
  BEE_WANDER_RADIUS = 0.5;
  BEE_HOVER_HEIGHT = 0.2;
  BEE_NIGHTNESS_FADE_START = 0.3;
  BEE_NIGHTNESS_FADE_END = 0.5;
  // Marketplace
  MARKETPLACE_BASE_VALUES = {
    wood: 2, stone: 3, grain: 2, fish: 3,
    iron_ore: 4, coal_ore: 3, gold_ore: 6,
    grapes: 3, fruit: 2, water_barrel: 1,
    milk: 3, hay: 1, wool: 3, raw_leather: 3,
    planks: 4, flour: 4, bread: 7, meat: 8,
    iron_bars: 8, gold_bars: 15, swords: 12, shields: 12,
    wine: 8, beer: 6, cheese: 7, cloth: 6,
    worked_leather: 7, arrows: 5, bow: 10, siege_ram: 20,
    axe: 6, pickaxe: 6, saw: 6, scythe: 6,
    fishing_rod: 6, hammer_tool: 6, shovel: 6,
    rolling_pin: 6, cleaver: 6, crucible: 6, tongs: 6,
    pigs: 8, cattle: 10, horses: 12,
  };
  MARKETPLACE_FEE = 0.10;
  MARKETPLACE_TRADE_COOLDOWN = 3.0;
  MARKETPLACE_MAX_TRADE_SIZE = 10;
  MARKETPLACE_RESTOCK_INTERVAL = 60;
  MARKETPLACE_NPC_STOCK_MIN = 3;
  MARKETPLACE_NPC_STOCK_MAX = 8;
  MARKETPLACE_OFFERED_RESOURCE_COUNT = 12;
  MARKETPLACE_SCARCITY_BONUS = 0.50;
  MARKETPLACE_PRICE_SHIFT_BUY = 0.05;
  MARKETPLACE_PRICE_SHIFT_SELL = 0.03;
  MARKETPLACE_PRICE_DECAY_RATE = 0.002;
  MARKETPLACE_PRICE_MIN = 0.5;
  MARKETPLACE_PRICE_MAX = 2.0;
  CASTLE_TRADE_FEE = 0.25;
  CASTLE_TRADE_COOLDOWN = 10.0;
  CASTLE_TRADE_MAX_SIZE = 5;
  CASTLE_TRADE_ENABLED = true;
  MERCHANT_VISIT_INTERVAL = 300;
  MERCHANT_VISIT_DURATION = 60;
  MERCHANT_DEAL_COUNT = 3;
  MERCHANT_DISCOUNT = 0.20;
  AUTOTRADE_CHECK_INTERVAL = 15.0;
  AUTOTRADE_MAX_RULES = 8;
  AI_TRADE_CHECK_INTERVAL = 30;
  AI_TRADE_SURPLUS_THRESHOLD = 1.5;
  AI_TRADE_SHORTAGE_THRESHOLD = 0.5;
  AI_TRADE_PRICE_SENSITIVITY = 1.3;
  // Starting Resources
  CASTLE_STARTING_RESOURCES_BY_DIFFICULTY.easy = buildResourceList(STARTING_AMOUNTS.easy);
  CASTLE_STARTING_RESOURCES_BY_DIFFICULTY.normal = buildResourceList(STARTING_AMOUNTS.normal);
  CASTLE_STARTING_RESOURCES_BY_DIFFICULTY.hard = buildResourceList(STARTING_AMOUNTS.hard);
}
