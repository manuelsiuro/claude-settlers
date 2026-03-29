import { BuildingType } from '../BuildingType';
import { Difficulty } from '../GameConfig';

/**
 * Aggressive: Fewer economy buildings, earlier military, attacks at build step 8.
 */
const AGGRESSIVE_BUILD_ORDER: BuildingType[] = [
  BuildingType.WoodcutterHut,
  BuildingType.ForesterHut,
  BuildingType.Quarry,
  BuildingType.Sawmill,
  BuildingType.SmallHouse,
  BuildingType.GuardHut,
  BuildingType.GuardHut,
  BuildingType.FishermanHut,
  BuildingType.Farm,
  BuildingType.IronMine,
  BuildingType.CoalMine,
  BuildingType.IronSmelter,
  BuildingType.MediumHouse,
  BuildingType.BlacksmithArmory,
  BuildingType.FletchersWorkshop,         // arrows for archers
  BuildingType.ArcheryRange,              // ranged unit recruitment
  BuildingType.Barracks,
  BuildingType.Barracks,
  BuildingType.Watchtower,
  BuildingType.Fortress,                  // 20 knight slots
];

/**
 * Economic: Full production chains, delayed military, attacks at build step 16+.
 */
const ECONOMIC_BUILD_ORDER: BuildingType[] = [
  BuildingType.WoodcutterHut,
  BuildingType.ForesterHut,
  BuildingType.WoodcutterHut,
  BuildingType.Quarry,
  BuildingType.Sawmill,
  BuildingType.SmallHouse,
  BuildingType.FishermanHut,
  BuildingType.Farm,
  BuildingType.Warehouse,
  BuildingType.Harbor,             // water logistics (skipped if no water-adjacent hex)
  BuildingType.GeologistHut,
  BuildingType.Windmill,
  BuildingType.Bakery,
  BuildingType.IronMine,
  BuildingType.CoalMine,
  BuildingType.IronSmelter,
  BuildingType.ToolmakerWorkshop,
  BuildingType.MediumHouse,
  BuildingType.GuardHut,
  BuildingType.BlacksmithArmory,
  BuildingType.GoldMine,
  BuildingType.GoldsmithMint,
  // ── Expansion: full food & crafting chains ───────────────────────────────
  BuildingType.Orchard,                   // fruit production
  BuildingType.Vineyard,                  // grapes for wine
  BuildingType.Winery,                    // grapes → wine
  BuildingType.Well,                      // water for brewery
  BuildingType.CattleRanch,              // cattle for butchery + leather
  BuildingType.SheepFarm,               // wool for cloth
  BuildingType.Tannery,                  // raw leather → worked leather
  BuildingType.WeaversHut,              // wool → cloth
  BuildingType.Stable,                    // horse breeding
  BuildingType.HuntingLodge,             // game meat from forest tiles
  BuildingType.Apiary,                   // honey from forest tiles
  BuildingType.TrappersHut,              // pelts from forest tiles
  BuildingType.Meadery,                  // honey → mead (drink for morale)
  BuildingType.Furrier,                  // pelts → fur coats (luxury for morale)
  BuildingType.LargeHouse,
  BuildingType.Market,                    // trade hub
  BuildingType.Barracks,
  BuildingType.Watchtower,
];

/**
 * Balanced: Default build order with a mix of economy and military.
 * Mountain-specific buildings (GeologistHut, IronMine, CoalMine, GoldMine) will be
 * skipped automatically if no mountain tiles exist in the AI's territory.
 * FishermanHut will be skipped if no water-adjacent tiles are available.
 */
const BALANCED_BUILD_ORDER: BuildingType[] = [
  // ── Tier 1: basic economy ───────────────────────────────────────────────
  BuildingType.WoodcutterHut,
  BuildingType.ForesterHut,
  BuildingType.WoodcutterHut,
  BuildingType.Quarry,
  BuildingType.Sawmill,
  BuildingType.SmallHouse,         // population housing
  BuildingType.FishermanHut,       // skipped if no water-adjacent hex in territory
  BuildingType.GuardHut,           // placed at border to expand territory

  // ── Tier 2: food & resource extraction ─────────────────────────────────
  BuildingType.Farm,
  BuildingType.GuardHut,           // border expansion
  BuildingType.Warehouse,          // overflow storage before mining chain saturates Castle
  BuildingType.GeologistHut,       // prospect mountains for ore deposits
  BuildingType.MediumHouse,        // population housing
  BuildingType.IronMine,           // requires prospected iron deposit
  BuildingType.CoalMine,           // requires prospected coal deposit
  BuildingType.Harbor,             // water logistics (skipped if no water-adjacent hex)

  // ── Tier 3: processing & military arms ─────────────────────────────────
  BuildingType.Windmill,
  BuildingType.Bakery,
  BuildingType.GuardHut,           // border expansion
  BuildingType.IronSmelter,
  BuildingType.ToolmakerWorkshop,
  BuildingType.BlacksmithArmory,
  BuildingType.Barracks,           // placed at border for max influence
  BuildingType.Watchtower,         // border

  // ── Expansion: food diversity & morale ────────────────────────────────
  BuildingType.Well,               // water for brewery
  BuildingType.Brewery,            // water + grain → beer
  BuildingType.Hayfield,           // hay for dairy farm
  BuildingType.DairyFarm,          // hay + cattle → milk
  BuildingType.CheeseMakerBuilding, // milk → cheese
  BuildingType.InnTavern,          // serves drinks for morale

  // ── Living world: hunting, trapping & luxury goods ──────────────────────
  BuildingType.HuntingLodge,       // game meat from forest tiles
  BuildingType.Apiary,             // honey from forest tiles
  BuildingType.TrappersHut,        // pelts from forest tiles
  BuildingType.Meadery,            // honey → mead (drink for morale)
  BuildingType.Furrier,            // pelts → fur coats (luxury for morale)

  // ── Late game: gold economy + extra military ────────────────────────────
  BuildingType.LargeHouse,         // population housing
  BuildingType.GoldMine,           // requires prospected gold deposit
  BuildingType.GoldsmithMint,
  BuildingType.Barracks,
  BuildingType.Barracks,
];

/** Consecutive "no valid hex" ticks before a building is skipped. */
export const MAX_HEX_RETRIES = 3;

/** Per-difficulty AI tuning parameters */
export interface DifficultyConfig {
  buildOrder: BuildingType[];
  attackThreshold: number;
  decisionInterval: number;
  attackInterval: number;
  /** Fraction of decision ticks to skip (0 = never skip) */
  skipChance: number;
  /** Number of knights sent per attack */
  knightsPerAttack: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  [Difficulty.Easy]: {
    buildOrder: ECONOMIC_BUILD_ORDER,
    attackThreshold: 16,
    decisionInterval: 10.0,
    attackInterval: 20.0,
    skipChance: 0.3,
    knightsPerAttack: 1,
  },
  [Difficulty.Normal]: {
    buildOrder: BALANCED_BUILD_ORDER,
    attackThreshold: 12,
    decisionInterval: 5.0,
    attackInterval: 15.0,
    skipChance: 0,
    knightsPerAttack: 1,
  },
  [Difficulty.Hard]: {
    buildOrder: AGGRESSIVE_BUILD_ORDER,
    attackThreshold: 10,
    decisionInterval: 2.5,
    attackInterval: 12.0,
    skipChance: 0,
    knightsPerAttack: 2,
  },
};

// ============================================================
// AI Personalities
// ============================================================

export type AIPersonality = 'balanced' | 'economist' | 'militarist' | 'turtle';

export const AI_PERSONALITY_LABELS: Record<AIPersonality, string> = {
  balanced: 'Balanced',
  economist: 'Economist',
  militarist: 'Militarist',
  turtle: 'Turtle',
};

export const AI_PERSONALITY_DESCRIPTIONS: Record<AIPersonality, string> = {
  balanced: 'Mixed economy and military strategy',
  economist: 'Focuses on production chains and trading',
  militarist: 'Aggressive early military expansion',
  turtle: 'Defensive, builds walls of guard huts',
};

/**
 * Turtle: defensive economy-first player. Extra guard huts, delayed attacks.
 */
const TURTLE_BUILD_ORDER: BuildingType[] = [
  BuildingType.WoodcutterHut,
  BuildingType.ForesterHut,
  BuildingType.WoodcutterHut,
  BuildingType.Quarry,
  BuildingType.Sawmill,
  BuildingType.SmallHouse,
  BuildingType.GuardHut,
  BuildingType.GuardHut,
  BuildingType.GuardHut,
  BuildingType.FishermanHut,
  BuildingType.Farm,
  BuildingType.Warehouse,
  BuildingType.Windmill,
  BuildingType.Bakery,
  BuildingType.MediumHouse,
  BuildingType.GeologistHut,
  BuildingType.IronMine,
  BuildingType.CoalMine,
  BuildingType.IronSmelter,
  BuildingType.ToolmakerWorkshop,
  BuildingType.Watchtower,
  BuildingType.Watchtower,
  BuildingType.BlacksmithArmory,
  BuildingType.LargeHouse,
  BuildingType.GoldMine,
  BuildingType.GoldsmithMint,
  BuildingType.Fortress,
  BuildingType.Barracks,
];

/** Personality overrides applied on top of the base difficulty config. */
export interface PersonalityOverrides {
  buildOrder?: BuildingType[];
  attackThresholdDelta: number;
  decisionIntervalMultiplier: number;
  attackIntervalMultiplier: number;
  knightsPerAttackDelta: number;
}

export const PERSONALITY_OVERRIDES: Record<AIPersonality, PersonalityOverrides> = {
  balanced: {
    attackThresholdDelta: 0,
    decisionIntervalMultiplier: 1.0,
    attackIntervalMultiplier: 1.0,
    knightsPerAttackDelta: 0,
  },
  economist: {
    buildOrder: ECONOMIC_BUILD_ORDER,
    attackThresholdDelta: 4,
    decisionIntervalMultiplier: 0.8,
    attackIntervalMultiplier: 1.5,
    knightsPerAttackDelta: 0,
  },
  militarist: {
    buildOrder: AGGRESSIVE_BUILD_ORDER,
    attackThresholdDelta: -3,
    decisionIntervalMultiplier: 0.7,
    attackIntervalMultiplier: 0.7,
    knightsPerAttackDelta: 1,
  },
  turtle: {
    buildOrder: TURTLE_BUILD_ORDER,
    attackThresholdDelta: 6,
    decisionIntervalMultiplier: 1.2,
    attackIntervalMultiplier: 2.0,
    knightsPerAttackDelta: 0,
  },
};

/** Apply personality overrides to a base difficulty config */
export function applyPersonality(base: DifficultyConfig, personality: AIPersonality): DifficultyConfig {
  const overrides = PERSONALITY_OVERRIDES[personality];
  return {
    buildOrder: overrides.buildOrder ?? base.buildOrder,
    attackThreshold: Math.max(1, base.attackThreshold + overrides.attackThresholdDelta),
    decisionInterval: base.decisionInterval * overrides.decisionIntervalMultiplier,
    attackInterval: base.attackInterval * overrides.attackIntervalMultiplier,
    skipChance: base.skipChance,
    knightsPerAttack: Math.max(1, base.knightsPerAttack + overrides.knightsPerAttackDelta),
  };
}

/** Deterministically assign a personality to an AI player based on player index */
const PERSONALITY_ROTATION: AIPersonality[] = ['balanced', 'militarist', 'economist', 'turtle'];

export function getPersonalityForPlayer(playerIndex: number): AIPersonality {
  return PERSONALITY_ROTATION[playerIndex % PERSONALITY_ROTATION.length];
}
