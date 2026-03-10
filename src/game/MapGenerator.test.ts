import { describe, it, expect } from 'vitest';
import { generateMap } from './MapGenerator';
import { TerrainType } from './TerrainType';

describe('MapGenerator', () => {
  it('should generate a map with correct number of tiles', () => {
    const grid = generateMap({ width: 20, height: 20, seed: 42 });
    expect(grid.size).toBe(400);
  });

  it('should produce deterministic maps from the same seed', () => {
    const grid1 = generateMap({ width: 15, height: 15, seed: 123 });
    const grid2 = generateMap({ width: 15, height: 15, seed: 123 });

    const tiles1 = grid1.getAllTiles();
    const tiles2 = grid2.getAllTiles();

    for (let i = 0; i < tiles1.length; i++) {
      expect(tiles1[i].terrain).toBe(tiles2[i].terrain);
      expect(tiles1[i].elevation).toBe(tiles2[i].elevation);
    }
  });

  it('should produce different maps from different seeds', () => {
    const grid1 = generateMap({ width: 20, height: 20, seed: 1 });
    const grid2 = generateMap({ width: 20, height: 20, seed: 2 });

    const tiles1 = grid1.getAllTiles();
    const tiles2 = grid2.getAllTiles();

    let differences = 0;
    for (let i = 0; i < tiles1.length; i++) {
      if (tiles1[i].terrain !== tiles2[i].terrain) differences++;
    }
    expect(differences).toBeGreaterThan(0);
  });

  it('should contain all 5 terrain types', () => {
    const grid = generateMap({ width: 30, height: 30, seed: 42 });
    const terrainSet = new Set(grid.getAllTiles().map(t => t.terrain));

    expect(terrainSet.has(TerrainType.Grassland)).toBe(true);
    expect(terrainSet.has(TerrainType.Forest)).toBe(true);
    expect(terrainSet.has(TerrainType.Mountain)).toBe(true);
    expect(terrainSet.has(TerrainType.Water)).toBe(true);
    expect(terrainSet.has(TerrainType.Desert)).toBe(true);
  });

  it('should roughly match target terrain proportions', () => {
    const grid = generateMap({ width: 50, height: 50, seed: 42 });
    const tiles = grid.getAllTiles();
    const total = tiles.length;

    const counts: Record<string, number> = {};
    for (const tile of tiles) {
      counts[tile.terrain] = (counts[tile.terrain] || 0) + 1;
    }

    // Allow ±10% tolerance from target
    const grassRatio = counts[TerrainType.Grassland] / total;
    expect(grassRatio).toBeGreaterThan(0.2);
    expect(grassRatio).toBeLessThan(0.55);

    const waterRatio = counts[TerrainType.Water] / total;
    expect(waterRatio).toBeGreaterThan(0.05);
    expect(waterRatio).toBeLessThan(0.25);
  });

  it('should have elevation values in [0, 1]', () => {
    const grid = generateMap({ width: 20, height: 20, seed: 42 });
    for (const tile of grid.getAllTiles()) {
      expect(tile.elevation).toBeGreaterThanOrEqual(0);
      expect(tile.elevation).toBeLessThanOrEqual(1);
    }
  });
});
