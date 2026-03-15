import { describe, it, expect, beforeEach } from 'vitest';
import { findPath, hexDistance } from './Pathfinding';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';

describe('Pathfinding', () => {
  let grid: HexGrid;

  beforeEach(() => {
    // Create a 10x10 all-grassland grid
    grid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
  });

  describe('findPath', () => {
    it('should return single-element path for same start and goal', () => {
      const path = findPath(grid, { q: 3, r: 3 }, { q: 3, r: 3 });
      expect(path).toEqual([{ q: 3, r: 3 }]);
    });

    it('should find a path between adjacent hexes', () => {
      const path = findPath(grid, { q: 3, r: 3 }, { q: 4, r: 3 });
      expect(path).toHaveLength(2);
      expect(path[0]).toEqual({ q: 3, r: 3 });
      expect(path[1]).toEqual({ q: 4, r: 3 });
    });

    it('should find a path over multiple steps', () => {
      const path = findPath(grid, { q: 0, r: 0 }, { q: 5, r: 0 });
      expect(path.length).toBeGreaterThanOrEqual(2);
      // Path should start at origin and end at goal
      expect(path[0]).toEqual({ q: 0, r: 0 });
      expect(path[path.length - 1]).toEqual({ q: 5, r: 0 });
    });

    it('should find optimal-length path', () => {
      const path = findPath(grid, { q: 0, r: 0 }, { q: 3, r: 0 });
      // Hex distance from (0,0) to (3,0) is 3
      expect(path).toHaveLength(4); // 3 steps + start = 4 nodes
    });

    it('should avoid water tiles', () => {
      // Place water wall across the middle
      for (let r = 0; r < 10; r++) {
        grid.setTile(5, r, TerrainType.Water, 0.1);
      }
      // Leave one gap at r=4
      grid.setTile(5, 4, TerrainType.Grassland, 0.5);

      const path = findPath(grid, { q: 3, r: 4 }, { q: 7, r: 4 });
      expect(path.length).toBeGreaterThan(0);

      // No node in the path should be on water
      for (const coord of path) {
        const tile = grid.getTile(coord.q, coord.r);
        expect(tile?.terrain).not.toBe(TerrainType.Water);
      }
    });

    it('should return empty path when goal is unreachable (surrounded by water)', () => {
      // Surround (5,5) with water
      const neighbors = grid.getNeighbors(5, 5);
      for (const n of neighbors) {
        grid.setTile(n.coord.q, n.coord.r, TerrainType.Water, 0.1);
      }

      const path = findPath(grid, { q: 0, r: 0 }, { q: 5, r: 5 });
      expect(path).toHaveLength(0);
    });

    it('should return empty path when goal is water', () => {
      grid.setTile(5, 5, TerrainType.Water, 0.1);
      const path = findPath(grid, { q: 0, r: 0 }, { q: 5, r: 5 });
      expect(path).toHaveLength(0);
    });

    it('should walk through forest and mountain tiles', () => {
      grid.setTile(3, 3, TerrainType.Forest, 0.6);
      grid.setTile(4, 3, TerrainType.Mountain, 0.8);

      const path = findPath(grid, { q: 2, r: 3 }, { q: 5, r: 3 });
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual({ q: 5, r: 3 });
    });

    it('should find long path without wrapping', () => {
      // On a 10x10 grid, going from q=0 to q=9 takes 9 steps (no wrapping)
      const path = findPath(grid, { q: 0, r: 0 }, { q: 9, r: 0 });
      expect(path.length).toBeGreaterThan(0);
      expect(path).toHaveLength(10); // 9 steps + start = 10 nodes
    });

    it('should respect maxSteps limit', () => {
      // With maxSteps=1, even a 2-step path should fail
      const path = findPath(grid, { q: 0, r: 0 }, { q: 5, r: 5 }, 1);
      // Should return empty since we can't explore enough
      expect(path).toHaveLength(0);
    });
  });

  describe('hexDistance', () => {
    it('should return 0 for same position', () => {
      expect(hexDistance({ q: 3, r: 3 }, { q: 3, r: 3 }, grid)).toBe(0);
    });

    it('should return 1 for adjacent hexes', () => {
      expect(hexDistance({ q: 3, r: 3 }, { q: 4, r: 3 }, grid)).toBe(1);
    });

    it('should return correct distance for straight line', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 5, r: 0 }, grid)).toBe(5);
    });

    it('should compute direct distance without wrapping', () => {
      // On a 10x10 grid, (0,0) to (9,0) is distance 9 (no wrapping)
      const dist = hexDistance({ q: 0, r: 0 }, { q: 9, r: 0 }, grid);
      expect(dist).toBe(9);
    });
  });
});
