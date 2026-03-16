import { TerrainType } from '../game/TerrainType';

// ---------------------------------------------------------------------------
// Season type & state
// ---------------------------------------------------------------------------

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

let currentSeason: Season = 'summer';

/** Set the active season (affects grassland and forest terrain colors). */
export function setSeason(season: Season): void {
  currentSeason = season;
}

/** Get the currently active season. */
export function getSeason(): Season {
  return currentSeason;
}

// ---------------------------------------------------------------------------
// Season-specific palettes for grassland & forest
// ---------------------------------------------------------------------------

/** Per-season color variants for terrain types that change with seasons. */
const SEASONAL_COLORS: Record<Season, Partial<Record<TerrainType, number[]>>> = {
  spring: {
    // Brighter greens with a hint of yellow
    [TerrainType.Grassland]: [0x88ff22, 0xa0f060, 0x44c020],
    [TerrainType.Forest]: [0x2a9c2a, 0x5e8a40, 0x4a7e38],
  },
  summer: {
    // Original / default palette
    [TerrainType.Grassland]: [0x7cfc00, 0x90ee90, 0x228b22],
    [TerrainType.Forest]: [0x1a7a2a, 0x4e7a3a, 0x3a6a2e],
  },
  autumn: {
    // Orange/brown/red tones for forest, golden grassland
    [TerrainType.Grassland]: [0xdaa520, 0xc8a83e, 0xb89530],
    [TerrainType.Forest]: [0xcc5500, 0x8b4513, 0xb22222],
  },
  winter: {
    // White/grey tones, snow-covered look
    [TerrainType.Grassland]: [0xe8e8e8, 0xd0d8d0, 0xc0c8c0],
    [TerrainType.Forest]: [0xb0b8b0, 0x9aa89a, 0x8a988a],
  },
};

// ---------------------------------------------------------------------------
// Season-invariant palettes (desert, mountain, water)
// ---------------------------------------------------------------------------

const STATIC_COLORS: Partial<Record<TerrainType, number[]>> = {
  [TerrainType.Mountain]: [0x808080, 0xa9a9a9, 0x5d5d5d],
  [TerrainType.Water]: [0x0000ff, 0xadd8e6, 0x40e0d0],
  [TerrainType.Desert]: [0xf4a460, 0xd2b48c, 0xf5f5dc],
};

// ---------------------------------------------------------------------------
// Public colour lookup (backward-compatible)
// ---------------------------------------------------------------------------

/**
 * Ground tile colors per terrain type.
 *
 * @deprecated Prefer {@link getTerrainColor} which respects the current season.
 * This constant always returns the *summer* palette for backward compatibility.
 */
export const TERRAIN_GROUND_COLORS: Record<TerrainType, number[]> = {
  [TerrainType.Grassland]: [0x7cfc00, 0x90ee90, 0x228b22],
  [TerrainType.Forest]: [0x1a7a2a, 0x4e7a3a, 0x3a6a2e],
  [TerrainType.Mountain]: [0x808080, 0xa9a9a9, 0x5d5d5d],
  [TerrainType.Water]: [0x0000ff, 0xadd8e6, 0x40e0d0],
  [TerrainType.Desert]: [0xf4a460, 0xd2b48c, 0xf5f5dc],
};

/** Pick a color variant based on a hash, using the current season's palette. */
export function getTerrainColor(terrain: TerrainType, q: number, r: number): number {
  // Use seasonal palette for grassland/forest; static palette for others
  const seasonalPalette = SEASONAL_COLORS[currentSeason][terrain];
  const colors = seasonalPalette ?? STATIC_COLORS[terrain] ?? TERRAIN_GROUND_COLORS[terrain];
  const hash = Math.abs((q * 73856093) ^ (r * 19349663)) % colors.length;
  return colors[hash];
}

// ---------------------------------------------------------------------------
// Tree season color (for TreeSwayShader uniform)
// ---------------------------------------------------------------------------

/** Seasonal foliage colors for trees (single representative color per season). */
const TREE_SEASON_COLORS: Record<Season, number> = {
  spring: 0x3da83d,  // Fresh bright green
  summer: 0x1a7a2a,  // Medium green (matches forest base)
  autumn: 0xcc5500,  // Burnt orange
  winter: 0x9aa89a,  // Muted grey-green (bare / frost)
};

/**
 * Returns the seasonal tree foliage color as a hex number.
 * Intended to be passed as a uniform to the tree sway shader.
 */
export function getTreeSeasonColor(): number {
  return TREE_SEASON_COLORS[currentSeason];
}
