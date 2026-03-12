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

describe('HexGrid.hexDistance', () => {
  it('should return 0 for same coordinate', () => {
    expect(HexGrid.hexDistance({ q: 3, r: 4 }, { q: 3, r: 4 })).toBe(0);
  });

  it('should return 1 for adjacent hexes', () => {
    expect(HexGrid.hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    expect(HexGrid.hexDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1);
    expect(HexGrid.hexDistance({ q: 0, r: 0 }, { q: -1, r: 1 })).toBe(1);
  });

  it('should compute correct distance for distant hexes', () => {
    expect(HexGrid.hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(HexGrid.hexDistance({ q: 0, r: 0 }, { q: 0, r: 5 })).toBe(5);
    expect(HexGrid.hexDistance({ q: 1, r: 2 }, { q: 4, r: 5 })).toBe(6);
  });
});

describe('HexGrid.findNearestTerrain', () => {
  it('should return 0 if the building tile matches', () => {
    const grid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++)
      for (let r = 0; r < 10; r++)
        grid.setTile(q, r, TerrainType.Mountain);
    expect(grid.findNearestTerrain({ q: 5, r: 5 }, TerrainType.Mountain)).toBe(0);
  });

  it('should return 1 for adjacent matching terrain', () => {
    const grid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++)
      for (let r = 0; r < 10; r++)
        grid.setTile(q, r, TerrainType.Grassland);
    grid.setTile(4, 5, TerrainType.Forest);
    expect(grid.findNearestTerrain({ q: 5, r: 5 }, TerrainType.Forest)).toBe(1);
  });

  it('should find terrain at greater distances', () => {
    const grid = new HexGrid(20, 20);
    for (let q = 0; q < 20; q++)
      for (let r = 0; r < 20; r++)
        grid.setTile(q, r, TerrainType.Grassland);
    grid.setTile(10, 5, TerrainType.Water);
    const dist = grid.findNearestTerrain({ q: 5, r: 5 }, TerrainType.Water);
    expect(dist).toBe(5);
  });

  it('should return maxRadius when no matching terrain exists', () => {
    const grid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++)
      for (let r = 0; r < 10; r++)
        grid.setTile(q, r, TerrainType.Grassland);
    expect(grid.findNearestTerrain({ q: 5, r: 5 }, TerrainType.Water, 10)).toBe(10);
  });

  it('should find terrain with world wrapping', () => {
    const grid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++)
      for (let r = 0; r < 10; r++)
        grid.setTile(q, r, TerrainType.Grassland);
    grid.setTile(9, 0, TerrainType.Forest);
    // Coord (0, 0) wraps around — q=9 is neighbor via wrapping
    const dist = grid.findNearestTerrain({ q: 0, r: 0 }, TerrainType.Forest);
    expect(dist).toBe(1);
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
