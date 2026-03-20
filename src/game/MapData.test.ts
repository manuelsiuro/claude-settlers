import { describe, it, expect } from 'vitest';
import { TerrainType } from './TerrainType';
import { ResourceType } from './ResourceType';
import {
  MAP_DATA_VERSION,
  validateMapData,
  buildGridFromMapData,
  exportGridToMapData,
} from './MapData';
import type { MapData, MapTileData } from './MapData';

function createTestMapData(overrides: Partial<MapData> = {}): MapData {
  const width = overrides.width ?? 8;
  const height = overrides.height ?? 8;
  const tiles: MapTileData[] = [];
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      tiles.push({ q, r, terrain: TerrainType.Grassland, elevation: 0.3 });
    }
  }
  return {
    version: MAP_DATA_VERSION,
    id: 'test-map-id',
    name: 'Test Map',
    description: 'A test map',
    width,
    height,
    tiles: overrides.tiles ?? tiles,
    startingPositions: overrides.startingPositions ?? [{ playerId: 1, q: 1, r: 1 }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('MapData', () => {
  describe('validateMapData', () => {
    it('should accept valid map data', () => {
      const data = createTestMapData();
      expect(validateMapData(data)).toEqual([]);
    });

    it('should reject non-object', () => {
      expect(validateMapData(null)).toEqual(['MapData must be a non-null object']);
      expect(validateMapData('string')).toEqual(['MapData must be a non-null object']);
    });

    it('should reject wrong version', () => {
      const data = createTestMapData({ version: 99 });
      const errors = validateMapData(data);
      expect(errors.some((e) => e.includes('version'))).toBe(true);
    });

    it('should reject missing id', () => {
      const data = createTestMapData({ id: '' });
      const errors = validateMapData(data);
      expect(errors.some((e) => e.includes('id'))).toBe(true);
    });

    it('should reject wrong tile count', () => {
      const data = createTestMapData({ tiles: [] });
      const errors = validateMapData(data);
      expect(errors.some((e) => e.includes('tiles'))).toBe(true);
    });
  });

  describe('buildGridFromMapData', () => {
    it('should create a HexGrid from map data', () => {
      const data = createTestMapData();
      const grid = buildGridFromMapData(data);
      expect(grid.width).toBe(8);
      expect(grid.height).toBe(8);
      const tile = grid.getTile(0, 0);
      expect(tile).toBeDefined();
      expect(tile!.terrain).toBe(TerrainType.Grassland);
    });

    it('should restore deposits', () => {
      const tiles: MapTileData[] = [];
      for (let r = 0; r < 8; r++) {
        for (let q = 0; q < 8; q++) {
          if (q === 2 && r === 2) {
            tiles.push({
              q, r,
              terrain: TerrainType.Mountain,
              elevation: 0.8,
              deposit: { resource: ResourceType.IronOre },
            });
          } else {
            tiles.push({ q, r, terrain: TerrainType.Grassland, elevation: 0.3 });
          }
        }
      }
      const data = createTestMapData({ tiles });
      const grid = buildGridFromMapData(data);
      const deposit = grid.getDeposit(2, 2);
      expect(deposit).toBeDefined();
      expect(deposit!.resource).toBe(ResourceType.IronOre);
      expect(deposit!.revealed).toBe(false);
    });
  });

  describe('exportGridToMapData', () => {
    it('should round-trip through export and build', () => {
      const original = createTestMapData();
      const grid = buildGridFromMapData(original);
      const exported = exportGridToMapData(grid, {
        id: original.id,
        name: original.name,
        description: original.description,
        startingPositions: original.startingPositions,
      });

      expect(exported.version).toBe(MAP_DATA_VERSION);
      expect(exported.tiles.length).toBe(original.tiles.length);
      expect(exported.width).toBe(original.width);
      expect(exported.height).toBe(original.height);

      // Rebuild and check
      const rebuilt = buildGridFromMapData(exported);
      expect(rebuilt.width).toBe(8);
      const tile = rebuilt.getTile(1, 1);
      expect(tile!.terrain).toBe(TerrainType.Grassland);
    });
  });
});
