import { describe, it, expect, beforeEach } from 'vitest';
import { generateMap } from './MapGenerator';
import { GameState } from './GameState';
import { BuildingType } from './BuildingType';
import { TerrainType } from './TerrainType';
import { initializeCastleResources, resetBuildingIdCounter } from './Building';
import { SCENARIO_TERRAIN_BALANCE, Scenario, MapSize } from './GameConfig';

describe('Game Setup', () => {
  beforeEach(() => {
    resetBuildingIdCounter();
  });

  describe('Map generation with scenarios', () => {
    it('should generate a map with default terrain balance', () => {
      const grid = generateMap({ width: 24, height: 24, seed: 42 });
      expect(grid.width).toBe(24);
      expect(grid.height).toBe(24);

      const tiles = grid.getAllTiles();
      expect(tiles.length).toBe(24 * 24);

      // Should have all terrain types
      const terrainCounts = new Map<TerrainType, number>();
      for (const tile of tiles) {
        terrainCounts.set(tile.terrain, (terrainCounts.get(tile.terrain) ?? 0) + 1);
      }
      expect(terrainCounts.size).toBe(5);
    });

    it('should generate island scenario with more water', () => {
      const balance = SCENARIO_TERRAIN_BALANCE[Scenario.Island];
      const grid = generateMap({ width: 32, height: 32, seed: 123, terrainBalance: balance });

      const tiles = grid.getAllTiles();
      const waterCount = tiles.filter(t => t.terrain === TerrainType.Water).length;
      const waterFraction = waterCount / tiles.length;

      // Island scenario should have ~35% water
      expect(waterFraction).toBeGreaterThan(0.25);
    });

    it('should generate continent scenario with less water', () => {
      const balance = SCENARIO_TERRAIN_BALANCE[Scenario.Continent];
      const grid = generateMap({ width: 32, height: 32, seed: 123, terrainBalance: balance });

      const tiles = grid.getAllTiles();
      const waterCount = tiles.filter(t => t.terrain === TerrainType.Water).length;
      const waterFraction = waterCount / tiles.length;

      expect(waterFraction).toBeLessThan(0.1);
    });

    it('should support different map sizes', () => {
      for (const size of [MapSize.Small, MapSize.Medium, MapSize.Large]) {
        const grid = generateMap({ width: size, height: size, seed: 42 });
        expect(grid.width).toBe(size);
        expect(grid.height).toBe(size);
        expect(grid.getAllTiles().length).toBe(size * size);
      }
    });

    it('should generate deterministic maps from same seed', () => {
      const grid1 = generateMap({ width: 16, height: 16, seed: 99 });
      const grid2 = generateMap({ width: 16, height: 16, seed: 99 });

      const tiles1 = grid1.getAllTiles();
      const tiles2 = grid2.getAllTiles();
      for (let i = 0; i < tiles1.length; i++) {
        expect(tiles1[i].terrain).toBe(tiles2[i].terrain);
      }
    });

    it('should generate different maps from different seeds', () => {
      const grid1 = generateMap({ width: 16, height: 16, seed: 1 });
      const grid2 = generateMap({ width: 16, height: 16, seed: 2 });

      const tiles1 = grid1.getAllTiles();
      const tiles2 = grid2.getAllTiles();
      let differences = 0;
      for (let i = 0; i < tiles1.length; i++) {
        if (tiles1[i].terrain !== tiles2[i].terrain) differences++;
      }
      expect(differences).toBeGreaterThan(0);
    });
  });

  describe('Multi-player castle placement', () => {
    it('should place castles for 2 players at opposite corners', () => {
      const grid = generateMap({ width: 24, height: 24, seed: 42 });
      const gs = new GameState(grid);

      const margin = Math.max(3, Math.floor(24 * 0.15));
      // Player 1 at top-left quadrant
      placeCastleNear(gs, margin, margin, 1, grid);
      // Player 2 at bottom-right quadrant
      placeCastleNear(gs, 24 - margin - 1, 24 - margin - 1, 2, grid);

      const castle1 = gs.findCastle(1);
      const castle2 = gs.findCastle(2);
      expect(castle1).toBeDefined();
      expect(castle2).toBeDefined();
      expect(castle1!.playerId).toBe(1);
      expect(castle2!.playerId).toBe(2);

      // Castles should be far apart
      const dq = Math.abs(castle1!.coord.q - castle2!.coord.q);
      const dr = Math.abs(castle1!.coord.r - castle2!.coord.r);
      expect(dq + dr).toBeGreaterThan(10);
    });

    it('should place castles for 4 players in all corners', () => {
      const grid = generateMap({ width: 32, height: 32, seed: 42 });
      const gs = new GameState(grid);

      const margin = Math.max(3, Math.floor(32 * 0.15));
      const positions = [
        { q: margin, r: margin },
        { q: 32 - margin - 1, r: margin },
        { q: margin, r: 32 - margin - 1 },
        { q: 32 - margin - 1, r: 32 - margin - 1 },
      ];

      for (let i = 0; i < 4; i++) {
        placeCastleNear(gs, positions[i].q, positions[i].r, i + 1, grid);
      }

      for (let i = 1; i <= 4; i++) {
        const castle = gs.findCastle(i);
        expect(castle).toBeDefined();
        expect(castle!.playerId).toBe(i);
      }
    });

    it('should initialize castle resources for all players', () => {
      const grid = generateMap({ width: 24, height: 24, seed: 42 });
      const gs = new GameState(grid);

      placeCastleNear(gs, 5, 5, 1, grid);
      placeCastleNear(gs, 18, 18, 2, grid);

      const castle1 = gs.findCastle(1)!;
      const castle2 = gs.findCastle(2)!;

      initializeCastleResources(castle1);
      initializeCastleResources(castle2);

      // Both castles should have starting resources
      expect(Object.values(castle1.outputInventory).some(v => (v ?? 0) > 0)).toBe(true);
      expect(Object.values(castle2.outputInventory).some(v => (v ?? 0) > 0)).toBe(true);
    });
  });
});

/** Helper: spiral outward from target to place a Castle on grassland */
function placeCastleNear(
  gs: GameState,
  targetQ: number,
  targetR: number,
  playerId: number,
  grid: { width: number; height: number },
): void {
  const maxRadius = 8;
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.abs(dq) + Math.abs(dr) + Math.abs(-dq - dr) > 2 * radius) continue;
        const q = targetQ + dq;
        const r = targetR + dr;
        if (q < 0 || q >= grid.width || r < 0 || r >= grid.height) continue;
        const result = gs.placeBuilding(BuildingType.Castle, { q, r }, playerId);
        if (result.ok) return;
      }
    }
  }
}
