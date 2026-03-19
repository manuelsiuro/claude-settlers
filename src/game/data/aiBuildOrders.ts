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
  BuildingType.GuardHut,
  BuildingType.GuardHut,
  BuildingType.FishermanHut,
  BuildingType.Farm,
  BuildingType.IronMine,
  BuildingType.CoalMine,
  BuildingType.IronSmelter,
  BuildingType.BlacksmithArmory,
  BuildingType.Barracks,
  BuildingType.Barracks,
  BuildingType.Watchtower,
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
  BuildingType.GuardHut,
  BuildingType.BlacksmithArmory,
  BuildingType.GoldMine,
  BuildingType.GoldsmithMint,
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
  BuildingType.FishermanHut,       // skipped if no water-adjacent hex in territory
  BuildingType.GuardHut,           // placed at border to expand territory

  // ── Tier 2: food & resource extraction ─────────────────────────────────
  BuildingType.Farm,
  BuildingType.GuardHut,           // border expansion
  BuildingType.Warehouse,          // overflow storage before mining chain saturates Castle
  BuildingType.GeologistHut,       // prospect mountains for ore deposits
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

  // ── Late game: gold economy + extra military ────────────────────────────
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
    attackThreshold: 8,
    decisionInterval: 2.5,
    attackInterval: 8.0,
    skipChance: 0,
    knightsPerAttack: 2,
  },
};
