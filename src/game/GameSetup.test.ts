import { describe, it, expect, beforeEach } from 'vitest';
import { generateMap } from './MapGenerator';
import { GameState } from './GameState';
import { BuildingType } from './BuildingType';
import { TerrainType } from './TerrainType';
import { initializeCastleResources, resetBuildingIdCounter } from './Building';
import { SCENARIO_TERRAIN_BALANCE, Scenario, MapSize } from './GameConfig';
import { HexGrid } from './HexGrid';

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
    it('should place castles for 2 players with good toroidal separation', () => {
      const w = 24, h = 24;
      const grid = generateMap({ width: w, height: h, seed: 42 });
      const gs = new GameState(grid);

      // Quarter-based positions (toroidal-aware)
      const qQuarter = Math.floor(w / 4);
      const rQuarter = Math.floor(h / 4);
      const q3Quarter = Math.floor((3 * w) / 4);
      const r3Quarter = Math.floor((3 * h) / 4);

      placeCastleNear(gs, qQuarter, rQuarter, 1, grid);
      placeCastleNear(gs, q3Quarter, r3Quarter, 2, grid);

      const castle1 = gs.findCastle(1);
      const castle2 = gs.findCastle(2);
      expect(castle1).toBeDefined();
      expect(castle2).toBeDefined();
      expect(castle1!.playerId).toBe(1);
      expect(castle2!.playerId).toBe(2);

      // Measure toroidal distance — should be well separated
      const toroidalDist = HexGrid.hexDistanceWrapped(
        castle1!.coord, castle2!.coord, w, h,
      );
      expect(toroidalDist).toBeGreaterThan(8);
    });

    it('should place castles for 4 players in 2x2 grid pattern', () => {
      const w = 32, h = 32;
      const grid = generateMap({ width: w, height: h, seed: 42 });
      const gs = new GameState(grid);

      const qQuarter = Math.floor(w / 4);
      const rQuarter = Math.floor(h / 4);
      const q3Quarter = Math.floor((3 * w) / 4);
      const r3Quarter = Math.floor((3 * h) / 4);

      const positions = [
        { q: qQuarter, r: rQuarter },
        { q: q3Quarter, r: rQuarter },
        { q: qQuarter, r: r3Quarter },
        { q: q3Quarter, r: r3Quarter },
      ];

      for (let i = 0; i < 4; i++) {
        placeCastleNear(gs, positions[i].q, positions[i].r, i + 1, grid);
      }

      for (let i = 1; i <= 4; i++) {
        const castle = gs.findCastle(i);
        expect(castle).toBeDefined();
        expect(castle!.playerId).toBe(i);
      }

      // All pairs should have good toroidal separation
      const castles = [1, 2, 3, 4].map(id => gs.findCastle(id)!);
      for (let i = 0; i < castles.length; i++) {
        for (let j = i + 1; j < castles.length; j++) {
          const dist = HexGrid.hexDistanceWrapped(
            castles[i].coord, castles[j].coord, w, h,
          );
          expect(dist).toBeGreaterThan(6);
        }
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

/** Helper: spiral outward from target to place a Castle on grassland, with wrapping */
function placeCastleNear(
  gs: GameState,
  targetQ: number,
  targetR: number,
  playerId: number,
  grid: HexGrid,
): void {
  const maxRadius = 8;
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.abs(dq) + Math.abs(dr) + Math.abs(-dq - dr) > 2 * radius) continue;
        const wrapped = grid.wrap(targetQ + dq, targetR + dr);
        const result = gs.placeBuilding(BuildingType.Castle, wrapped, playerId);
        if (result.ok) return;
      }
    }
  }
}
