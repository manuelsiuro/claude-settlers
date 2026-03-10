import { describe, it, expect } from 'vitest';
import { HexGrid, HEX_SIZE, HEX_WIDTH, HEX_HEIGHT } from './HexGrid';
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
    expect(grid.wrap(12, 3)).toEqual({ q: 2, r: 3 });
    expect(grid.wrap(-1, -1)).toEqual({ q: 9, r: 7 });
    expect(grid.wrap(5, 5)).toEqual({ q: 5, r: 5 });
  });

  it('should get tiles with world wrapping', () => {
    const grid = new HexGrid(10, 10);
    grid.setTile(0, 0, TerrainType.Water);
    const tile = grid.getTile(10, 10);
    expect(tile).toBeDefined();
    expect(tile!.terrain).toBe(TerrainType.Water);
  });

  it('should return 6 neighbors', () => {
    const grid = new HexGrid(10, 10);
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

  it('should compute wrap vectors', () => {
    const grid = new HexGrid(10, 8);
    const { wrapQ, wrapR } = grid.getWrapVectors();
    // wrapQ should be purely horizontal (q-direction offset)
    expect(wrapQ.x).toBeCloseTo(Math.sqrt(3) * 10);
    expect(wrapQ.z).toBeCloseTo(0);
    // wrapR has both x and z components (r-direction is diagonal)
    expect(wrapR.x).toBeCloseTo(Math.sqrt(3) / 2 * 8);
    expect(wrapR.z).toBeCloseTo(1.5 * 8);
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
      { q: 15, r: 0 },
      { q: 0, r: 12 },
    ];
    for (const coord of testCoords) {
      const world = HexGrid.hexToWorld(coord.q, coord.r);
      const back = HexGrid.worldToHex(world.x, world.z);
      expect(back.q).toBe(coord.q);
      expect(back.r).toBe(coord.r);
    }
  });

  it('should have correct hex dimensions for pointy-top', () => {
    expect(HEX_WIDTH).toBeCloseTo(Math.sqrt(3) * HEX_SIZE);
    expect(HEX_HEIGHT).toBe(2 * HEX_SIZE);
  });

  it('neighbor at (1,0) should be sqrt(3) units to the right', () => {
    const origin = HexGrid.hexToWorld(0, 0);
    const neighbor = HexGrid.hexToWorld(1, 0);
    const dx = neighbor.x - origin.x;
    const dz = neighbor.z - origin.z;
    expect(dx).toBeCloseTo(Math.sqrt(3));
    expect(dz).toBeCloseTo(0);
  });

  it('neighbor at (0,1) should be at correct diagonal offset', () => {
    const origin = HexGrid.hexToWorld(0, 0);
    const neighbor = HexGrid.hexToWorld(0, 1);
    const dx = neighbor.x - origin.x;
    const dz = neighbor.z - origin.z;
    expect(dx).toBeCloseTo(Math.sqrt(3) / 2);
    expect(dz).toBeCloseTo(1.5);
  });

  it('should round fractional hex coordinates correctly', () => {
    const result = HexGrid.hexRound(2.1, 2.9);
    expect(result).toEqual({ q: 2, r: 3 });
  });
});
