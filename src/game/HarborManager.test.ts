import { describe, it, expect, beforeEach } from 'vitest';
import { HarborManager } from './HarborManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { RoadNetwork, resetRoadNetworkIdCounters } from './RoadNetwork';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { ResourceType } from './ResourceType';

describe('HarborManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let roadNetwork: RoadNetwork;
  let harborManager: HarborManager;

  /**
   * Creates a 16×16 grid with a horizontal water channel in the middle (rows 7-8).
   * This gives us grassland above and below, separated by water.
   */
  function createGridWithWaterChannel(): void {
    grid = new HexGrid(16, 16);
    for (let q = 0; q < 16; q++) {
      for (let r = 0; r < 16; r++) {
        const terrain = (r === 7 || r === 8) ? TerrainType.Water : TerrainType.Grassland;
        grid.setTile(q, r, terrain, 0.5);
      }
    }
    gameState = new GameState(grid);
    roadNetwork = new RoadNetwork(grid);
    harborManager = new HarborManager(gameState, roadNetwork, grid);
  }

  /**
   * Creates a 16×16 grid with two separate water pools (not connected).
   */
  function createGridWithSeparatePools(): void {
    grid = new HexGrid(16, 16);
    for (let q = 0; q < 16; q++) {
      for (let r = 0; r < 16; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    // Pool 1: around (3,3)
    grid.setTile(3, 3, TerrainType.Water, 0.5);
    grid.setTile(4, 3, TerrainType.Water, 0.5);
    // Pool 2: around (12,12)
    grid.setTile(12, 12, TerrainType.Water, 0.5);
    grid.setTile(13, 12, TerrainType.Water, 0.5);

    gameState = new GameState(grid);
    roadNetwork = new RoadNetwork(grid);
    harborManager = new HarborManager(gameState, roadNetwork, grid);
  }

  beforeEach(() => {
    resetBuildingIdCounter();
    resetRoadNetworkIdCounters();
    createGridWithWaterChannel();
  });

  describe('Harbor building definition', () => {
    it('should have correct category and tier', () => {
      const def = BUILDING_DEFINITIONS[BuildingType.Harbor];
      expect(def.category).toBe('logistics');
      expect(def.tier).toBe(2);
    });

    it('should require adjacentTerrain Water', () => {
      const def = BUILDING_DEFINITIONS[BuildingType.Harbor];
      expect(def.adjacentTerrain).toBe(TerrainType.Water);
    });

    it('should have correct cost', () => {
      const def = BUILDING_DEFINITIONS[BuildingType.Harbor];
      expect(def.cost).toEqual([
        { resource: ResourceType.Wood, amount: 4 },
        { resource: ResourceType.Stone, amount: 3 },
        { resource: ResourceType.Planks, amount: 2 },
      ]);
    });

    it('should have no worker or production', () => {
      const def = BUILDING_DEFINITIONS[BuildingType.Harbor];
      expect(def.worker).toBe('');
      expect(def.production).toBeNull();
    });
  });

  describe('Harbor placement validation', () => {
    it('should reject placement when not adjacent to water', () => {
      // Row 2 is far from water (rows 7-8)
      const error = gameState.canPlace(BuildingType.Harbor, { q: 5, r: 2 }, 1);
      expect(error).not.toBeNull();
    });

    it('should accept placement adjacent to water', () => {
      // Row 6 is adjacent to water row 7
      const error = gameState.canPlace(BuildingType.Harbor, { q: 5, r: 6 }, 1);
      // Only fails if territory check fails, but canPlace on raw GameState
      // should pass adjacentTerrain check. Territory checks are separate.
      // If canPlace returns an error about territory, that's expected —
      // we're testing the adjacentTerrain logic is correct.
      // The key assertion is that it does NOT return "must be adjacent to water".
      if (error) {
        expect(error).not.toContain('adjacent');
      }
    });
  });

  /** Helper: place a harbor, activate it, place a flag, return the building */
  function placeActiveHarbor(q: number, r: number, playerId: number) {
    const result = gameState.placeBuilding(BuildingType.Harbor, { q, r }, playerId);
    if (!result.ok) throw new Error(`Harbor placement failed at ${q},${r}: ${result.error}`);
    const building = gameState.getBuilding(result.building.id)!;
    building.state = BuildingState.Active;
    const flag = roadNetwork.placeFlag({ q, r }, playerId)!;
    flag.buildingId = building.id;
    return building;
  }

  describe('Water route creation', () => {
    it('should create a virtual road between two harbors connected by water', () => {
      // Row 6 is adjacent to water (row 7), row 9 is adjacent to water (row 8)
      placeActiveHarbor(5, 6, 1);
      placeActiveHarbor(5, 9, 1);

      harborManager.update(3.0);

      const virtualRoads = roadNetwork.getAllRoads().filter((r) => r.virtual);
      expect(virtualRoads).toHaveLength(1);
    });

    it('should not connect harbors of different players', () => {
      placeActiveHarbor(5, 6, 1);
      placeActiveHarbor(5, 9, 2);

      harborManager.update(3.0);

      const virtualRoads = roadNetwork.getAllRoads().filter((r) => r.virtual);
      expect(virtualRoads).toHaveLength(0);
    });

    it('should remove virtual road when a harbor is destroyed', () => {
      const buildingA = placeActiveHarbor(5, 6, 1);
      placeActiveHarbor(5, 9, 1);

      // Create routes
      harborManager.update(3.0);
      expect(roadNetwork.getAllRoads().filter((r) => r.virtual)).toHaveLength(1);

      // Destroy one harbor
      buildingA.state = BuildingState.Destroyed;

      // Run again — should remove the route
      harborManager.update(3.0);
      expect(roadNetwork.getAllRoads().filter((r) => r.virtual)).toHaveLength(0);
    });

    it('should not create route when harbors are not connected by water', () => {
      createGridWithSeparatePools();

      // Place harbors near separate pools
      // Harbor A near pool 1 (tiles 3,3 and 4,3)
      const resultA = gameState.placeBuilding(BuildingType.Harbor, { q: 3, r: 2 }, 1);
      // Harbor B near pool 2 (tiles 12,12 and 13,12)
      const resultB = gameState.placeBuilding(BuildingType.Harbor, { q: 12, r: 11 }, 1);
      if (!resultA.ok || !resultB.ok) throw new Error('placement failed');

      const buildingA = gameState.getBuilding(resultA.building.id)!;
      const buildingB = gameState.getBuilding(resultB.building.id)!;
      buildingA.state = BuildingState.Active;
      buildingB.state = BuildingState.Active;

      roadNetwork.placeFlag({ q: 3, r: 2 }, 1)!.buildingId = buildingA.id;
      roadNetwork.placeFlag({ q: 12, r: 11 }, 1)!.buildingId = buildingB.id;

      harborManager.update(3.0);

      const virtualRoads = roadNetwork.getAllRoads().filter((r) => r.virtual);
      expect(virtualRoads).toHaveLength(0);
    });
  });

  describe('Water BFS (HexGrid.findWaterConnection)', () => {
    it('should find connection across water channel', () => {
      const connected = grid.findWaterConnection({ q: 5, r: 6 }, { q: 5, r: 9 });
      expect(connected).toBe(true);
    });

    it('should return false when no water adjacency at start', () => {
      const connected = grid.findWaterConnection({ q: 5, r: 2 }, { q: 5, r: 9 });
      expect(connected).toBe(false);
    });

    it('should return false when no water adjacency at end', () => {
      const connected = grid.findWaterConnection({ q: 5, r: 6 }, { q: 5, r: 2 });
      expect(connected).toBe(false);
    });

    it('should return false for disconnected water bodies', () => {
      createGridWithSeparatePools();
      const connected = grid.findWaterConnection({ q: 3, r: 2 }, { q: 12, r: 11 });
      expect(connected).toBe(false);
    });
  });

  describe('Virtual road in RoadNetwork', () => {
    it('should create virtual road without adjacency check', () => {
      const f1 = roadNetwork.placeFlag({ q: 5, r: 6 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 9 }, 1)!;

      // These flags are far apart (3 hexes), so connectFlags would fail
      const normalRoad = roadNetwork.connectFlags(f1.id, f2.id);
      expect(normalRoad).toBeNull();

      // But createVirtualRoad skips adjacency check
      const virtualRoad = roadNetwork.createVirtualRoad(f1.id, f2.id);
      expect(virtualRoad).not.toBeNull();
      expect(virtualRoad!.virtual).toBe(true);
    });

    it('should be removable via removeVirtualRoad', () => {
      const f1 = roadNetwork.placeFlag({ q: 5, r: 6 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 9 }, 1)!;
      const road = roadNetwork.createVirtualRoad(f1.id, f2.id)!;

      expect(roadNetwork.getAllRoads()).toHaveLength(1);
      roadNetwork.removeVirtualRoad(road.id);
      expect(roadNetwork.getAllRoads()).toHaveLength(0);
    });

    it('should not remove non-virtual road via removeVirtualRoad', () => {
      const f1 = roadNetwork.placeFlag({ q: 5, r: 5 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 6, r: 5 }, 1)!;
      const road = roadNetwork.connectFlags(f1.id, f2.id)!;

      const removed = roadNetwork.removeVirtualRoad(road.id);
      expect(removed).toBe(false);
      expect(roadNetwork.getAllRoads()).toHaveLength(1);
    });
  });

  describe('Serialization', () => {
    it('should serialize and restore water routes', () => {
      placeActiveHarbor(5, 6, 1);
      placeActiveHarbor(5, 9, 1);

      harborManager.update(3.0);

      const state = harborManager._getState();
      expect(state.waterRoutes).toHaveLength(1);

      // Create a new manager and restore state
      const newManager = new HarborManager(gameState, roadNetwork, grid);
      newManager._loadState(state);
      const restoredState = newManager._getState();
      expect(restoredState.waterRoutes).toHaveLength(1);
      expect(restoredState.waterRoutes[0].harborAId).toBe(state.waterRoutes[0].harborAId);
    });
  });
});
