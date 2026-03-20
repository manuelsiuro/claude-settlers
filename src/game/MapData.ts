import { HexGrid } from './HexGrid';
import type { ResourceDeposit } from './HexGrid';
import { TerrainType } from './TerrainType';
import { ResourceType } from './ResourceType';
import type { BalanceConfigOverrides } from './data/balanceConstants';

export const MAP_DATA_VERSION = 1;

export interface MapTileData {
  q: number;
  r: number;
  terrain: string; // TerrainType value
  elevation: number; // 0.0–1.0
  deposit?: { resource: string }; // 'iron_ore' | 'coal_ore' | 'gold_ore'
}

export interface StartingPosition {
  playerId: number; // 1–4
  q: number;
  r: number;
}

/** Pre-placed building in the map editor */
export interface MapBuildingData {
  type: string; // BuildingType value
  q: number;
  r: number;
  playerId: number;
}

/** Pre-placed flag in the map editor */
export interface MapFlagData {
  q: number;
  r: number;
  playerId: number;
}

/** Pre-placed road connecting two flag coordinates */
export interface MapRoadData {
  flagA: { q: number; r: number };
  flagB: { q: number; r: number };
  quality: number; // 0=path, 1=dirt, 2=stone, 3=paved
}

export interface MapData {
  version: number;
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  tiles: MapTileData[];
  startingPositions: StartingPosition[];
  buildings?: MapBuildingData[];
  flags?: MapFlagData[];
  roads?: MapRoadData[];
  balanceConfig?: BalanceConfigOverrides;
  thumbnail?: string; // base64 PNG data URL
  createdAt: number;
  updatedAt: number;
}

/** Lightweight entry for the map index (no full tile data) */
export interface MapListEntry {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail?: string;
  playerCount: number;
  createdAt: number;
  updatedAt: number;
}

const VALID_TERRAINS = new Set<string>(Object.values(TerrainType));
const VALID_DEPOSITS = new Set<string>([
  ResourceType.IronOre,
  ResourceType.CoalOre,
  ResourceType.GoldOre,
]);

/** Validate a MapData object. Returns an array of error strings. */
export function validateMapData(data: unknown): string[] {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push('MapData must be a non-null object');
    return errors;
  }

  const d = data as Record<string, unknown>;

  if (d.version !== MAP_DATA_VERSION) {
    errors.push(`Unsupported version: ${d.version} (expected ${MAP_DATA_VERSION})`);
  }
  if (typeof d.id !== 'string' || d.id.length === 0) {
    errors.push('Missing or invalid id');
  }
  if (typeof d.name !== 'string' || d.name.length === 0) {
    errors.push('Missing or invalid name');
  }
  if (typeof d.width !== 'number' || d.width < 8 || d.width > 128) {
    errors.push('Width must be 8–128');
  }
  if (typeof d.height !== 'number' || d.height < 8 || d.height > 128) {
    errors.push('Height must be 8–128');
  }

  if (!Array.isArray(d.tiles)) {
    errors.push('tiles must be an array');
  } else {
    const expectedCount = (d.width as number) * (d.height as number);
    if (d.tiles.length !== expectedCount) {
      errors.push(`Expected ${expectedCount} tiles, got ${d.tiles.length}`);
    }
    for (let i = 0; i < Math.min(d.tiles.length, 10); i++) {
      const t = d.tiles[i] as Record<string, unknown>;
      if (!VALID_TERRAINS.has(t.terrain as string)) {
        errors.push(`Tile ${i}: invalid terrain "${t.terrain}"`);
      }
      if (t.deposit) {
        const dep = t.deposit as Record<string, unknown>;
        if (!VALID_DEPOSITS.has(dep.resource as string)) {
          errors.push(`Tile ${i}: invalid deposit resource "${dep.resource}"`);
        }
        if (t.terrain !== TerrainType.Mountain) {
          errors.push(`Tile ${i}: deposits only allowed on Mountain tiles`);
        }
      }
    }
  }

  if (!Array.isArray(d.startingPositions)) {
    errors.push('startingPositions must be an array');
  }

  return errors;
}

/** Build a HexGrid from MapData tile array */
export function buildGridFromMapData(data: MapData): HexGrid {
  const grid = new HexGrid(data.width, data.height);

  for (const tile of data.tiles) {
    const terrain = tile.terrain as TerrainType;
    let deposit: ResourceDeposit | undefined;
    if (tile.deposit) {
      deposit = {
        resource: tile.deposit.resource as ResourceType,
        revealed: false,
        claimed: false,
      };
    }
    grid.setTile(tile.q, tile.r, terrain, tile.elevation, deposit);
  }

  return grid;
}

/** Export a HexGrid to MapData format */
export function exportGridToMapData(
  grid: HexGrid,
  metadata: {
    id: string;
    name: string;
    description: string;
    startingPositions: StartingPosition[];
    buildings?: MapBuildingData[];
    flags?: MapFlagData[];
    roads?: MapRoadData[];
    balanceConfig?: BalanceConfigOverrides;
    thumbnail?: string;
  },
): MapData {
  const tiles: MapTileData[] = [];

  for (const tile of grid.getAllTiles()) {
    const tileData: MapTileData = {
      q: tile.coord.q,
      r: tile.coord.r,
      terrain: tile.terrain,
      elevation: tile.elevation,
    };
    if (tile.deposit) {
      tileData.deposit = { resource: tile.deposit.resource };
    }
    tiles.push(tileData);
  }

  return {
    version: MAP_DATA_VERSION,
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    width: grid.width,
    height: grid.height,
    tiles,
    startingPositions: metadata.startingPositions,
    buildings: metadata.buildings,
    flags: metadata.flags,
    roads: metadata.roads,
    balanceConfig: metadata.balanceConfig,
    thumbnail: metadata.thumbnail,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
