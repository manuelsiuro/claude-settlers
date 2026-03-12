import { HexGrid } from './HexGrid';
import type { ResourceDeposit } from './HexGrid';
import { TerrainType } from './TerrainType';
import { ResourceType } from './ResourceType';
import { SeededNoise } from './noise';

export interface MapConfig {
  width: number;
  height: number;
  seed: number;
  /** Scale of the noise (lower = larger features). Default: 0.08 */
  noiseScale?: number;
  /** Target proportions for terrain types */
  terrainBalance?: Partial<Record<TerrainType, number>>;
}

const DEFAULT_BALANCE: Record<TerrainType, number> = {
  [TerrainType.Grassland]: 0.35,
  [TerrainType.Forest]: 0.30,
  [TerrainType.Mountain]: 0.15,
  [TerrainType.Water]: 0.12,
  [TerrainType.Desert]: 0.08,
};

/**
 * Generates a hex grid map using seeded noise.
 * Uses two noise layers: one for elevation, one for moisture.
 * Terrain is assigned based on thresholds derived from elevation + moisture.
 */
export function generateMap(config: MapConfig): HexGrid {
  const { width, height, seed, noiseScale = 0.08 } = config;
  const balance = { ...DEFAULT_BALANCE, ...config.terrainBalance };

  const grid = new HexGrid(width, height);
  const elevationNoise = new SeededNoise(seed);
  const moistureNoise = new SeededNoise(seed + 12345);
  const depositNoise = new SeededNoise(seed + 54321);

  // Compute raw values for all tiles
  const rawData: { q: number; r: number; elevation: number; moisture: number }[] = [];

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const elevation = elevationNoise.fbm(q * noiseScale, r * noiseScale, 4);
      const moisture = moistureNoise.fbm(
        q * noiseScale * 1.3 + 100,
        r * noiseScale * 1.3 + 100,
        3
      );
      rawData.push({ q, r, elevation, moisture });
    }
  }

  // Sort by elevation to assign terrain by percentile thresholds
  const sorted = [...rawData].sort((a, b) => a.elevation - b.elevation);
  const total = sorted.length;

  // Compute cumulative thresholds
  const waterEnd = Math.floor(balance[TerrainType.Water] * total);
  const desertEnd = waterEnd + Math.floor(balance[TerrainType.Desert] * total);
  const grasslandEnd = desertEnd + Math.floor(balance[TerrainType.Grassland] * total);
  const forestEnd = grasslandEnd + Math.floor(balance[TerrainType.Forest] * total);

  // Build a lookup from coord to rank
  const rankMap = new Map<string, number>();
  sorted.forEach((item, index) => {
    rankMap.set(HexGrid.key(item.q, item.r), index);
  });

  // Assign terrain based on rank
  for (const data of rawData) {
    const rank = rankMap.get(HexGrid.key(data.q, data.r))!;
    let terrain: TerrainType;

    if (rank < waterEnd) {
      terrain = TerrainType.Water;
    } else if (rank < desertEnd) {
      // Desert appears at low elevation, low moisture edges
      terrain = TerrainType.Desert;
    } else if (rank < grasslandEnd) {
      terrain = TerrainType.Grassland;
    } else if (rank < forestEnd) {
      // Use moisture to decide forest vs grassland for middle elevations
      if (data.moisture > 0) {
        terrain = TerrainType.Forest;
      } else {
        terrain = TerrainType.Grassland;
      }
    } else {
      terrain = TerrainType.Mountain;
    }

    // Normalize elevation to [0, 1] for rendering
    const minE = sorted[0].elevation;
    const maxE = sorted[sorted.length - 1].elevation;
    const range = maxE - minE || 1;
    const normalizedElevation = (data.elevation - minE) / range;

    // Assign resource deposits to mountain tiles
    let deposit: ResourceDeposit | undefined;
    if (terrain === TerrainType.Mountain) {
      deposit = assignDeposit(data.q, data.r, depositNoise);
    }

    grid.setTile(data.q, data.r, terrain, normalizedElevation, deposit);
  }

  return grid;
}

/**
 * Assign a resource deposit to a mountain tile based on noise.
 * ~30% IronOre, ~30% CoalOre, ~25% GoldOre, ~15% no deposit.
 * All deposits start hidden and unclaimed.
 */
function assignDeposit(q: number, r: number, noise: SeededNoise): ResourceDeposit | undefined {
  // Use noise at a high frequency to get pseudo-random per-tile values
  const v = (noise.noise2D(q * 0.73 + 50, r * 0.73 + 50) + 1) / 2; // normalize to [0, 1]

  if (v < 0.30) {
    return { resource: ResourceType.IronOre, revealed: false, claimed: false };
  } else if (v < 0.60) {
    return { resource: ResourceType.CoalOre, revealed: false, claimed: false };
  } else if (v < 0.85) {
    return { resource: ResourceType.GoldOre, revealed: false, claimed: false };
  }
  // 15% chance: no deposit
  return undefined;
}
