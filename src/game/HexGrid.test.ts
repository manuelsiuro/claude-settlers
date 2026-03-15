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

  it('should check bounds correctly', () => {
    const grid = new HexGrid(10, 8);
    expect(grid.isInBounds(0, 0)).toBe(true);
    expect(grid.isInBounds(9, 7)).toBe(true);
    expect(grid.isInBounds(5, 5)).toBe(true);
    expect(grid.isInBounds(-1, 0)).toBe(false);
    expect(grid.isInBounds(0, -1)).toBe(false);
    expect(grid.isInBounds(10, 0)).toBe(false);
    expect(grid.isInBounds(0, 8)).toBe(false);
  });

  it('should return undefined for out-of-bounds coordinates', () => {
    const grid = new HexGrid(10, 10);
    grid.setTile(0, 0, TerrainType.Water);
    expect(grid.getTile(10, 10)).toBeUndefined();
    expect(grid.getTile(-1, 0)).toBeUndefined();
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

  it('should return fewer than 6 neighbors at map edges', () => {
    const grid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        grid.setTile(q, r, TerrainType.Grassland);
      }
    }
    // Corner tile should have fewer neighbors
    const neighbors = grid.getNeighbors(0, 0);
    expect(neighbors.length).toBeLessThan(6);
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

describe('HexGrid.hexDistanceWrapped (deprecated, delegates to hexDistance)', () => {
  it('should return same as hexDistance', () => {
    const dist = HexGrid.hexDistanceWrapped({ q: 5, r: 5 }, { q: 10, r: 5 }, 32, 32);
    expect(dist).toBe(HexGrid.hexDistance({ q: 5, r: 5 }, { q: 10, r: 5 }));
  });

  it('should return 0 for same coordinate', () => {
    expect(HexGrid.hexDistanceWrapped({ q: 5, r: 5 }, { q: 5, r: 5 }, 32, 32)).toBe(0);
  });

  it('should be symmetric', () => {
    const a = { q: 4, r: 4 };
    const b = { q: 27, r: 27 };
    const d1 = HexGrid.hexDistanceWrapped(a, b, 32, 32);
    const d2 = HexGrid.hexDistanceWrapped(b, a, 32, 32);
    expect(d1).toBe(d2);
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

  it('should not find terrain across map boundary (no wrapping)', () => {
    const grid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++)
      for (let r = 0; r < 10; r++)
        grid.setTile(q, r, TerrainType.Grassland);
    grid.setTile(9, 0, TerrainType.Forest);
    // q=9 is 9 hexes away from (0,0) since there's no wrapping
    const dist = grid.findNearestTerrain({ q: 0, r: 0 }, TerrainType.Forest);
    expect(dist).toBe(9);
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
