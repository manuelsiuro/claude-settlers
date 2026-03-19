/**
 * Centralized gameplay-tunable constants.
 *
 * Only balance values live here — tick-frequency / system plumbing
 * constants (ROUTING_INTERVAL, SPAWN_INTERVAL, CHECK_INTERVAL, etc.)
 * stay in their respective manager files.
 */

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
