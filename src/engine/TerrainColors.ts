import { TerrainType } from '../game/TerrainType';

/** Ground tile colors per terrain type (from docs/terrains.md) */
export const TERRAIN_GROUND_COLORS: Record<TerrainType, number[]> = {
  [TerrainType.Grassland]: [0x7cfc00, 0x90ee90, 0x228b22],
  [TerrainType.Forest]: [0x006400, 0x3b5323, 0x2e4a1e],
  [TerrainType.Mountain]: [0x808080, 0xa9a9a9, 0x5d5d5d],
  [TerrainType.Water]: [0x0000ff, 0xadd8e6, 0x40e0d0],
  [TerrainType.Desert]: [0xf4a460, 0xd2b48c, 0xf5f5dc],
};

/** Pick a color variant based on a hash for visual variety */
export function getTerrainColor(terrain: TerrainType, q: number, r: number): number {
  const colors = TERRAIN_GROUND_COLORS[terrain];
  const hash = Math.abs((q * 73856093) ^ (r * 19349663)) % colors.length;
  return colors[hash];
}
