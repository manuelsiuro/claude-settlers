import { TerrainType } from '../game/TerrainType';

// ---------------------------------------------------------------------------
// Terrain color palettes
// ---------------------------------------------------------------------------

/** Color variants for terrain types that change with seasons (currently summer only). */
const SEASONAL_COLORS: Partial<Record<TerrainType, number[]>> = {
  [TerrainType.Grassland]: [0x7cfc00, 0x90ee90, 0x228b22],
  [TerrainType.Forest]: [0x1a7a2a, 0x4e7a3a, 0x3a6a2e],
};

/** Color palettes for terrain types that don't change with seasons. */
const STATIC_COLORS: Partial<Record<TerrainType, number[]>> = {
  [TerrainType.Mountain]: [0x808080, 0xa9a9a9, 0x5d5d5d],
  [TerrainType.Water]: [0x0000ff, 0xadd8e6, 0x40e0d0],
  [TerrainType.Desert]: [0xf4a460, 0xd2b48c, 0xf5f5dc],
};

// ---------------------------------------------------------------------------
// Public colour lookup
// ---------------------------------------------------------------------------

/** Pick a color variant based on a hash, using the terrain's palette. */
export function getTerrainColor(terrain: TerrainType, q: number, r: number): number {
  const colors = SEASONAL_COLORS[terrain] ?? STATIC_COLORS[terrain]!;
  const hash = Math.abs((q * 73856093) ^ (r * 19349663)) % colors.length;
  return colors[hash];
}
