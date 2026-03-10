import { describe, it, expect } from 'vitest';
import { HexGrid, HEX_WIDTH, HEX_HEIGHT } from './HexGrid';
import { TerrainType } from './TerrainType';

describe('HexGrid', () => {
  it('should create a grid with correct dimensions', () => {
    const grid = new HexGrid(10, 10);
    expect(grid.width).toBe(10);
    expect(grid.height).toBe(10);
    expect(grid.size).toBe(0);
  });

  it('should set and get tiles', () => {
    const grid = new HexGrid(10, 10);
    grid.setTile(3, 4, TerrainType.Grassland, 0);
    const tile = grid.getTile(3, 4);
    expect(tile).toBeDefined();
    expect(tile!.terrain).toBe(TerrainType.Grassland);
    expect(tile!.coord).toEqual({ q: 3, r: 4 });
  });

  it('should return undefined for empty coordinates', () => {
    const grid = new HexGrid(10, 10);
    expect(grid.getTile(0, 0)).toBeUndefined();
  });

  it('should wrap coordinates for world wrapping', () => {
    const grid = new HexGrid(10, 8);
    // Positive overflow
    expect(grid.wrap(12, 3)).toEqual({ q: 2, r: 3 });
    // Negative overflow
    expect(grid.wrap(-1, -1)).toEqual({ q: 9, r: 7 });
    // No overflow
    expect(grid.wrap(5, 5)).toEqual({ q: 5, r: 5 });
  });

  it('should get tiles with world wrapping', () => {
    const grid = new HexGrid(10, 10);
    grid.setTile(0, 0, TerrainType.Water);
    // Accessing (10, 10) should wrap to (0, 0)
    const tile = grid.getTile(10, 10);
    expect(tile).toBeDefined();
    expect(tile!.terrain).toBe(TerrainType.Water);
  });

  it('should return 6 neighbors', () => {
    const grid = new HexGrid(10, 10);
    // Fill all tiles
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        grid.setTile(q, r, TerrainType.Grassland);
      }
    }
    const neighbors = grid.getNeighbors(5, 5);
    expect(neighbors.length).toBe(6);
  });

  it('should get all tiles', () => {
    const grid = new HexGrid(3, 3);
    grid.setTile(0, 0, TerrainType.Grassland);
    grid.setTile(1, 1, TerrainType.Forest);
    grid.setTile(2, 2, TerrainType.Mountain);
    expect(grid.getAllTiles().length).toBe(3);
  });
});

describe('HexGrid coordinate conversion', () => {
  it('should convert hex (0,0) to world origin', () => {
    const pos = HexGrid.hexToWorld(0, 0);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(0);
  });

  it('should convert hex to world and back (round trip)', () => {
    const testCoords = [
      { q: 0, r: 0 },
      { q: 3, r: 5 },
      { q: 7, r: 2 },
      { q: 1, r: 9 },
    ];
    for (const coord of testCoords) {
      const world = HexGrid.hexToWorld(coord.q, coord.r);
      const back = HexGrid.worldToHex(world.x, world.z);
      expect(back.q).toBe(coord.q);
      expect(back.r).toBe(coord.r);
    }
  });

  it('should have correct hex dimensions', () => {
    expect(HEX_WIDTH).toBeCloseTo(Math.sqrt(3));
    expect(HEX_HEIGHT).toBe(2);
  });

  it('should round fractional hex coordinates correctly', () => {
    // Point very close to (2, 3)
    const result = HexGrid.hexRound(2.1, 2.9);
    expect(result).toEqual({ q: 2, r: 3 });
  });
});
