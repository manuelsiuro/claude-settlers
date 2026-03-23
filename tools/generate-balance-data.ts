/**
 * Generates balance-data.json from game source files.
 * Run: npm run balance-data
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { ResourceType, RESOURCE_PROPERTIES } from '../src/game/ResourceType';
import { UnitType, UNIT_DEFINITIONS } from '../src/game/UnitType';
import { BUILDING_DEFINITIONS } from '../src/game/data/buildingDefinitions';
import { DIFFICULTY_CONFIGS } from '../src/game/data/aiBuildOrders';
import {
  WOODCUTTER_CHOP_DURATION, WOODCUTTER_IDLE_COOLDOWN,
  FORESTER_PLANT_DURATION, FORESTER_IDLE_COOLDOWN,
  GEOLOGIST_PROSPECT_DURATION, GEOLOGIST_IDLE_COOLDOWN,
  TREES_MAX_PER_TILE, TREES_SAPLING_GROWTH_TIME, TREES_YOUNG_GROWTH_TIME,
  COMBAT_WINS_PER_RANK, COMBAT_GOLD_BONUS_PER_BAR, COMBAT_MAX_GOLD_BONUS,
  UPGRADES_MAX_LEVEL, WORK_RADIUS_MAX_LEVEL,
  VICTORY_DOMINATION_THRESHOLD, VICTORY_ECONOMIC_GOLD_TARGET, VICTORY_PEACEFUL_GOODS_TARGET,
  CASTLE_POPULATION_CAPACITY, SMALL_HOUSE_CAPACITY, MEDIUM_HOUSE_CAPACITY, LARGE_HOUSE_CAPACITY,
  POPULATION_WARNING_THRESHOLD, POPULATION_CAUTION_THRESHOLD,
  HUNGER_DECAY_RATE, HUNGER_WORKING_MULTIPLIER, HUNGER_GARRISONED_MULTIPLIER,
  HUNGER_HUNGRY_THRESHOLD, HUNGER_STARVING_THRESHOLD,
  HUNGER_SPEED_PENALTY_HUNGRY, HUNGER_SPEED_PENALTY_STARVING,
  HUNGER_PRODUCTION_PENALTY_HUNGRY, HUNGER_PRODUCTION_PENALTY_STARVING,
  NIGHT_PRODUCTION_SLOWDOWN, NIGHT_SPEED_PENALTY_CIVILIAN, NIGHT_SPEED_PENALTY_TRANSPORTER,
  NIGHT_SPEED_PENALTY_KNIGHT, NIGHT_SPEED_PENALTY_BUILDER,
  TORCH_TOWER_NIGHT_REDUCTION, TORCH_TOWER_LIGHT_RADIUS,
  MORALE_BASE, MORALE_WINDOW, MORALE_VARIETY_BONUS_MAX, MORALE_VARIETY_PER_TYPE,
  MORALE_VOLUME_BONUS_MAX, MORALE_VOLUME_PER_DRINK,
  MORALE_GOLD_BONUS_PER_BAR, MORALE_GOLD_BONUS_MAX,
  MORALE_MULTIPLIER_BASE, MORALE_MULTIPLIER_SCALE,
  CASTLE_STARTING_RESOURCES_BY_DIFFICULTY,
  ROAD_QUALITY_NAMES, ROAD_UPGRADE_COSTS, ROAD_UPGRADE_TIMES,
  ANIMAL_FEED_INTERVAL, ANIMAL_SPECS,
  MARKETPLACE_BASE_VALUES, MARKETPLACE_FEE, MARKETPLACE_TRADE_COOLDOWN,
  MARKETPLACE_MAX_TRADE_SIZE, MARKETPLACE_RESTOCK_INTERVAL,
  MARKETPLACE_NPC_STOCK_MIN, MARKETPLACE_NPC_STOCK_MAX,
  MARKETPLACE_OFFERED_RESOURCE_COUNT, MARKETPLACE_SCARCITY_BONUS,
  MARKETPLACE_PRICE_SHIFT_BUY, MARKETPLACE_PRICE_SHIFT_SELL,
  MARKETPLACE_PRICE_DECAY_RATE, MARKETPLACE_PRICE_MIN, MARKETPLACE_PRICE_MAX,
  CASTLE_TRADE_FEE, CASTLE_TRADE_COOLDOWN, CASTLE_TRADE_MAX_SIZE, CASTLE_TRADE_ENABLED,
  MERCHANT_VISIT_INTERVAL, MERCHANT_VISIT_DURATION, MERCHANT_DEAL_COUNT, MERCHANT_DISCOUNT,
  AUTOTRADE_CHECK_INTERVAL, AUTOTRADE_MAX_RULES,
  AI_TRADE_CHECK_INTERVAL, AI_TRADE_SURPLUS_THRESHOLD,
  AI_TRADE_SHORTAGE_THRESHOLD, AI_TRADE_PRICE_SENSITIVITY,
} from '../src/game/data/balanceConstants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Constants ──────────────────────────────────────────────────────
const constants = {
  woodcutter: {
    chopDuration: WOODCUTTER_CHOP_DURATION,
    idleCooldown: WOODCUTTER_IDLE_COOLDOWN,
  },
  forester: {
    plantDuration: FORESTER_PLANT_DURATION,
    idleCooldown: FORESTER_IDLE_COOLDOWN,
  },
  geologist: {
    prospectDuration: GEOLOGIST_PROSPECT_DURATION,
    idleCooldown: GEOLOGIST_IDLE_COOLDOWN,
  },
  trees: {
    maxPerTile: TREES_MAX_PER_TILE,
    saplingGrowthTime: TREES_SAPLING_GROWTH_TIME,
    youngGrowthTime: TREES_YOUNG_GROWTH_TIME,
  },
  combat: {
    winsPerRank: COMBAT_WINS_PER_RANK,
    goldBonusPerBar: COMBAT_GOLD_BONUS_PER_BAR,
    maxGoldBonus: COMBAT_MAX_GOLD_BONUS,
  },
  upgrades: {
    maxLevel: UPGRADES_MAX_LEVEL,
    workRadiusMaxLevel: WORK_RADIUS_MAX_LEVEL,
  },
  victory: {
    dominationThreshold: VICTORY_DOMINATION_THRESHOLD,
    economicGoldTarget: VICTORY_ECONOMIC_GOLD_TARGET,
    peacefulGoodsTarget: VICTORY_PEACEFUL_GOODS_TARGET,
  },
  population: {
    castleCapacity: CASTLE_POPULATION_CAPACITY,
    smallHouseCapacity: SMALL_HOUSE_CAPACITY,
    mediumHouseCapacity: MEDIUM_HOUSE_CAPACITY,
    largeHouseCapacity: LARGE_HOUSE_CAPACITY,
    warningThreshold: POPULATION_WARNING_THRESHOLD,
    cautionThreshold: POPULATION_CAUTION_THRESHOLD,
  },
  hunger: {
    decayRate: HUNGER_DECAY_RATE,
    workingMultiplier: HUNGER_WORKING_MULTIPLIER,
    garrisonedMultiplier: HUNGER_GARRISONED_MULTIPLIER,
    hungryThreshold: HUNGER_HUNGRY_THRESHOLD,
    starvingThreshold: HUNGER_STARVING_THRESHOLD,
    speedPenaltyHungry: HUNGER_SPEED_PENALTY_HUNGRY,
    speedPenaltyStarving: HUNGER_SPEED_PENALTY_STARVING,
    productionPenaltyHungry: HUNGER_PRODUCTION_PENALTY_HUNGRY,
    productionPenaltyStarving: HUNGER_PRODUCTION_PENALTY_STARVING,
  },
  night: {
    productionSlowdown: NIGHT_PRODUCTION_SLOWDOWN,
    speedPenaltyCivilian: NIGHT_SPEED_PENALTY_CIVILIAN,
    speedPenaltyTransporter: NIGHT_SPEED_PENALTY_TRANSPORTER,
    speedPenaltyKnight: NIGHT_SPEED_PENALTY_KNIGHT,
    speedPenaltyBuilder: NIGHT_SPEED_PENALTY_BUILDER,
    torchTowerReduction: TORCH_TOWER_NIGHT_REDUCTION,
    torchTowerRadius: TORCH_TOWER_LIGHT_RADIUS,
  },
  morale: {
    base: MORALE_BASE,
    window: MORALE_WINDOW,
    varietyBonusMax: MORALE_VARIETY_BONUS_MAX,
    varietyPerType: MORALE_VARIETY_PER_TYPE,
    volumeBonusMax: MORALE_VOLUME_BONUS_MAX,
    volumePerDrink: MORALE_VOLUME_PER_DRINK,
    goldBonusPerBar: MORALE_GOLD_BONUS_PER_BAR,
    goldBonusMax: MORALE_GOLD_BONUS_MAX,
    multiplierBase: MORALE_MULTIPLIER_BASE,
    multiplierScale: MORALE_MULTIPLIER_SCALE,
  },
  animals: {
    feedInterval: ANIMAL_FEED_INTERVAL,
    specs: ANIMAL_SPECS,
  },
  marketplace: {
    fee: MARKETPLACE_FEE,
    tradeCooldown: MARKETPLACE_TRADE_COOLDOWN,
    maxTradeSize: MARKETPLACE_MAX_TRADE_SIZE,
    restockInterval: MARKETPLACE_RESTOCK_INTERVAL,
    npcStockMin: MARKETPLACE_NPC_STOCK_MIN,
    npcStockMax: MARKETPLACE_NPC_STOCK_MAX,
    offeredResourceCount: MARKETPLACE_OFFERED_RESOURCE_COUNT,
    scarcityBonus: MARKETPLACE_SCARCITY_BONUS,
    priceShiftBuy: MARKETPLACE_PRICE_SHIFT_BUY,
    priceShiftSell: MARKETPLACE_PRICE_SHIFT_SELL,
    priceDecayRate: MARKETPLACE_PRICE_DECAY_RATE,
    priceMin: MARKETPLACE_PRICE_MIN,
    priceMax: MARKETPLACE_PRICE_MAX,
    castleTradeFee: CASTLE_TRADE_FEE,
    castleTradeCooldown: CASTLE_TRADE_COOLDOWN,
    castleTradeMaxSize: CASTLE_TRADE_MAX_SIZE,
    castleTradeEnabled: CASTLE_TRADE_ENABLED,
    merchantVisitInterval: MERCHANT_VISIT_INTERVAL,
    merchantVisitDuration: MERCHANT_VISIT_DURATION,
    merchantDealCount: MERCHANT_DEAL_COUNT,
    merchantDiscount: MERCHANT_DISCOUNT,
    autoTradeCheckInterval: AUTOTRADE_CHECK_INTERVAL,
    autoTradeMaxRules: AUTOTRADE_MAX_RULES,
    aiTradeCheckInterval: AI_TRADE_CHECK_INTERVAL,
    aiTradeSurplusThreshold: AI_TRADE_SURPLUS_THRESHOLD,
    aiTradeShortageThreshold: AI_TRADE_SHORTAGE_THRESHOLD,
    aiTradePriceSensitivity: AI_TRADE_PRICE_SENSITIVITY,
    baseValues: MARKETPLACE_BASE_VALUES,
  },
};

// ── Starting resources ─────────────────────────────────────────────
const startingResources: Record<string, { resource: string; amount: number }[]> = {};
for (const [diff, list] of Object.entries(CASTLE_STARTING_RESOURCES_BY_DIFFICULTY)) {
  startingResources[diff] = list.map(({ resource, amount }) => ({ resource, amount }));
}

// ── Roads ──────────────────────────────────────────────────────────
const roads = {
  qualityNames: ROAD_QUALITY_NAMES,
  upgradeCosts: ROAD_UPGRADE_COSTS,
  upgradeTimes: ROAD_UPGRADE_TIMES,
};

// ── Buildings (strip non-balance fields) ───────────────────────────
const buildings: Record<string, unknown> = {};
for (const [type, def] of Object.entries(BUILDING_DEFINITIONS)) {
  buildings[type] = {
    label: def.label,
    category: def.category,
    tier: def.tier,
    cost: def.cost,
    worker: def.worker || null,
    workerTool: def.workerTool || null,
    production: def.production,
    knightSlots: def.knightSlots,
    influenceRadius: def.influenceRadius,
    storageCapacity: def.storageCapacity,
    constructionTime: def.constructionTime,
    workRadius: def.workRadius,
    populationCapacity: def.populationCapacity,
  };
}

// ── Resources ──────────────────────────────────────────────────────
const resources: Record<string, unknown> = {};
for (const [type, props] of Object.entries(RESOURCE_PROPERTIES)) {
  resources[type] = {
    label: props.label,
    category: props.category,
    satiationValue: props.satiationValue,
    isDrink: props.isDrink,
  };
}

// ── Units ──────────────────────────────────────────────────────────
const units: Record<string, unknown> = {};
for (const [type, def] of Object.entries(UNIT_DEFINITIONS)) {
  units[type] = {
    label: def.label,
    category: def.category,
    requiredTool: def.requiredTool ?? null,
    moveSpeed: def.moveSpeed,
    combatStrength: def.combatStrength ?? 0,
    attackRange: def.attackRange ?? 0,
    visionRadius: def.visionRadius ?? 2,
    buildingDamage: def.buildingDamage ?? 0,
    chargeMultiplier: def.chargeMultiplier ?? 0,
    recruitmentItems: def.recruitmentItems ?? [],
    carryCapacity: def.carryCapacity ?? 1,
  };
}

// ── Difficulty configs ─────────────────────────────────────────────
const difficulty: Record<string, unknown> = {};
for (const [diff, config] of Object.entries(DIFFICULTY_CONFIGS)) {
  difficulty[diff] = {
    buildOrder: config.buildOrder,
    attackThreshold: config.attackThreshold,
    decisionInterval: config.decisionInterval,
    attackInterval: config.attackInterval,
    skipChance: config.skipChance,
    knightsPerAttack: config.knightsPerAttack,
  };
}

// ── Output ─────────────────────────────────────────────────────────
const output = {
  generatedAt: new Date().toISOString(),
  version: '1.0.0',
  constants,
  startingResources,
  roads,
  buildings,
  resources,
  units,
  difficulty,
};

const outPath = path.resolve(__dirname, 'balance-data.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

const buildingCount = Object.keys(buildings).length;
const resourceCount = Object.keys(resources).length;
const unitCount = Object.keys(units).length;
console.log(`Generated ${outPath}`);
console.log(`  ${buildingCount} buildings, ${resourceCount} resources, ${unitCount} units`);
