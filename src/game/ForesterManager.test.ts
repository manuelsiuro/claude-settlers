import { describe, it, expect, beforeEach } from 'vitest';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';
import { GameState } from './GameState';
import { TreeManager, resetTreeIdCounter } from './TreeManager';
import { ForesterManager } from './ForesterManager';

describe('ForesterManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let treeManager: TreeManager;
  let manager: ForesterManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetTreeIdCounter();

    grid = new HexGrid(12, 12);
    for (let q = 0; q < 12; q++) {
      for (let r = 0; r < 12; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    // A few forest tiles nearby
    grid.setTile(4, 3, TerrainType.Forest, 0.5);
    grid.setTile(5, 3, TerrainType.Forest, 0.5);

    gameState = new GameState(grid);
    treeManager = new TreeManager();
    treeManager.initializeFromMap(grid);
    manager = new ForesterManager(gameState, treeManager);
  });

  function placeForester(q: number, r: number) {
    const result = gameState.placeBuilding(BuildingType.ForesterHut, { q, r }, 1);
    if (!result.ok) throw new Error(`Failed to place: ${result.error}`);
    result.building.state = BuildingState.Active;

    const worker = gameState.spawnUnit(UnitType.Forester, { q, r }, 1);
    worker.state = UnitState.Working;
    gameState.assignWorkerToBuilding(worker.id, result.building.id);

    return { building: result.building, worker };
  }

  describe('full work cycle', () => {
    it('should plant a sapling', () => {
      placeForester(5, 5);
      const initialTreeCount = treeManager.getAllTrees().length;

      // Run for enough time to complete a planting cycle
      // idle(3s) + walking + planting(5s) + walking
      for (let i = 0; i < 600; i++) {
        manager.update(0.1);
      }

      // Should have planted at least 1 tree
      expect(treeManager.getAllTrees().length).toBeGreaterThan(initialTreeCount);
    });

    it('should create saplings not mature trees', () => {
      placeForester(5, 5);
      for (let i = 0; i < 600; i++) {
        manager.update(0.1);
      }

      // New trees should be saplings
      const saplings = treeManager.getAllTrees().filter((t) => t.growthStage === 'sapling');
      expect(saplings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('terrain conversion', () => {
    it('should convert Grassland to Forest when planting', () => {
      let terrainChanged = false;
      manager.onTerrainChanged = () => { terrainChanged = true; };

      placeForester(5, 5);

      // Run until planting happens
      for (let i = 0; i < 1000; i++) {
        manager.update(0.1);
        if (terrainChanged) break;
      }

      // Should have changed terrain at least once
      // (This depends on whether the forester plants on a grassland tile)
      // Since most nearby tiles are grassland, this should trigger
      expect(terrainChanged).toBe(true);
    });
  });

  describe('density limit', () => {
    it('should not plant more than MAX_TREES_PER_TILE (4) trees on one tile', () => {
      // Pre-fill a tile with 4 trees
      for (let i = 0; i < 4; i++) {
        treeManager.addTree({ q: 6, r: 6 }, 'tree_deciduous', i * 0.2, 0, 0, 1);
      }

      expect(treeManager.getTreeCountOnTile({ q: 6, r: 6 })).toBe(4);

      // The findPlantableSpot should skip this tile
      const spot = treeManager.findPlantableSpot(
        { q: 6, r: 6 },
        0,
        grid,
        gameState,
      );
      // At radius 0, should not find (6,6)
      expect(spot).toBeNull();
    });
  });

  describe('plantable spot validation', () => {
    it('should not plant on tiles with buildings', () => {
      gameState.placeBuilding(BuildingType.Castle, { q: 7, r: 7 }, 1);

      const spot = treeManager.findPlantableSpot(
        { q: 7, r: 7 },
        0,
        grid,
        gameState,
      );
      expect(spot).toBeNull();
    });

    it('should not plant on water tiles', () => {
      grid.setTile(7, 7, TerrainType.Water, 0.1);

      const spot = treeManager.findPlantableSpot(
        { q: 7, r: 7 },
        0,
        grid,
        gameState,
      );
      expect(spot).toBeNull();
    });

    it('should not plant on mountain tiles', () => {
      grid.setTile(7, 7, TerrainType.Mountain, 0.8);

      const spot = treeManager.findPlantableSpot(
        { q: 7, r: 7 },
        0,
        grid,
        gameState,
      );
      expect(spot).toBeNull();
    });
  });

  describe('serialization', () => {
    it('should round-trip work state', () => {
      placeForester(5, 5);

      // Run a few cycles
      for (let i = 0; i < 50; i++) {
        manager.update(0.1);
      }

      const state = manager._getState();
      expect(state.workStates.length).toBe(1);

      const manager2 = new ForesterManager(gameState, treeManager);
      manager2._loadState(state);

      const state2 = manager2._getState();
      expect(state2.workStates.length).toBe(1);
      expect(state2.workStates[0][0]).toBe(state.workStates[0][0]);
    });

    it('should preserve plantedTiles set', () => {
      placeForester(5, 5);

      // Run long enough to plant something
      for (let i = 0; i < 600; i++) {
        manager.update(0.1);
      }

      const state = manager._getState();
      const ws = state.workStates[0]?.[1];

      if (ws && ws.plantedTiles.length > 0) {
        const manager2 = new ForesterManager(gameState, treeManager);
        manager2._loadState(state);

        const state2 = manager2._getState();
        expect(state2.workStates[0][1].plantedTiles.length).toBe(ws.plantedTiles.length);
      }
    });
  });
});
