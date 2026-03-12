import { describe, it, expect, beforeEach } from 'vitest';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { TreeManager, resetTreeIdCounter } from './TreeManager';
import { GameState } from './GameState';
import { BuildingType } from './BuildingType';
import { resetBuildingIdCounter } from './Building';

describe('TreeManager', () => {
  let grid: HexGrid;
  let treeManager: TreeManager;
  let gameState: GameState;

  beforeEach(() => {
    resetTreeIdCounter();
    resetBuildingIdCounter();

    grid = new HexGrid(12, 12);
    for (let q = 0; q < 12; q++) {
      for (let r = 0; r < 12; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    // Place some forest tiles
    grid.setTile(3, 3, TerrainType.Forest, 0.5);
    grid.setTile(3, 4, TerrainType.Forest, 0.5);
    grid.setTile(4, 3, TerrainType.Forest, 0.5);
    grid.setTile(4, 4, TerrainType.Forest, 0.5);

    gameState = new GameState(grid);
    treeManager = new TreeManager();
  });

  describe('initializeFromMap', () => {
    it('should create trees on all forest tiles', () => {
      treeManager.initializeFromMap(grid);
      const trees = treeManager.getAllTrees();

      // Each forest tile has 2-4 trees, and we have 4 forest tiles
      expect(trees.length).toBeGreaterThanOrEqual(8);
      expect(trees.length).toBeLessThanOrEqual(16);
    });

    it('should create all trees as mature', () => {
      treeManager.initializeFromMap(grid);
      for (const tree of treeManager.getAllTrees()) {
        expect(tree.growthStage).toBe('mature');
        expect(tree.growthProgress).toBe(1.0);
      }
    });

    it('should not create trees on non-forest tiles', () => {
      treeManager.initializeFromMap(grid);
      for (const tree of treeManager.getAllTrees()) {
        const tile = grid.getTile(tree.tileCoord.q, tree.tileCoord.r);
        expect(tile).toBeDefined();
        expect(tile!.terrain).toBe(TerrainType.Forest);
      }
    });

    it('should produce deterministic results (same grid → same trees)', () => {
      treeManager.initializeFromMap(grid);
      const trees1 = treeManager.getAllTrees().map((t) => ({
        coord: t.tileCoord,
        localX: t.localX,
        localZ: t.localZ,
        modelType: t.modelType,
      }));

      resetTreeIdCounter();
      const tm2 = new TreeManager();
      tm2.initializeFromMap(grid);
      const trees2 = tm2.getAllTrees().map((t) => ({
        coord: t.tileCoord,
        localX: t.localX,
        localZ: t.localZ,
        modelType: t.modelType,
      }));

      expect(trees1.length).toBe(trees2.length);
      for (let i = 0; i < trees1.length; i++) {
        expect(trees1[i].localX).toBeCloseTo(trees2[i].localX);
        expect(trees1[i].localZ).toBeCloseTo(trees2[i].localZ);
        expect(trees1[i].modelType).toBe(trees2[i].modelType);
      }
    });

    it('should maintain per-tile index consistency', () => {
      treeManager.initializeFromMap(grid);

      for (const tree of treeManager.getAllTrees()) {
        const count = treeManager.getTreeCountOnTile(tree.tileCoord);
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('addTree', () => {
    it('should create a sapling', () => {
      const tree = treeManager.addTree(
        { q: 5, r: 5 },
        'tree_deciduous',
        0.1,
        0.2,
        1.0,
        0.9,
      );

      expect(tree.growthStage).toBe('sapling');
      expect(tree.growthProgress).toBe(0);
      expect(tree.tileCoord).toEqual({ q: 5, r: 5 });
      expect(treeManager.getTreeCountOnTile({ q: 5, r: 5 })).toBe(1);
    });

    it('should fire onTreeChanged callback', () => {
      let called = false;
      treeManager.onTreeChanged = () => { called = true; };
      treeManager.addTree({ q: 5, r: 5 }, 'tree_conifer', 0, 0, 0, 1);
      expect(called).toBe(true);
    });
  });

  describe('removeTree', () => {
    it('should remove tree and return its coord', () => {
      treeManager.initializeFromMap(grid);
      const trees = treeManager.getAllTrees();
      const tree = trees[0];
      const countBefore = treeManager.getTreeCountOnTile(tree.tileCoord);

      const coord = treeManager.removeTree(tree.id);

      expect(coord).toEqual(tree.tileCoord);
      expect(treeManager.getTree(tree.id)).toBeUndefined();
      expect(treeManager.getTreeCountOnTile(tree.tileCoord)).toBe(countBefore - 1);
    });

    it('should return null for non-existent tree', () => {
      expect(treeManager.removeTree('nonexistent')).toBeNull();
    });

    it('should fire onTreeChanged callback', () => {
      const tree = treeManager.addTree({ q: 5, r: 5 }, 'tree_deciduous', 0, 0, 0, 1);
      let called = false;
      treeManager.onTreeChanged = () => { called = true; };
      treeManager.removeTree(tree.id);
      expect(called).toBe(true);
    });
  });

  describe('growth', () => {
    it('should grow sapling to young', () => {
      treeManager.addTree({ q: 5, r: 5 }, 'tree_deciduous', 0, 0, 0, 1);
      const trees = treeManager.getAllTrees();
      const tree = trees[0];

      // Simulate 60 seconds (SAPLING_GROWTH_TIME)
      for (let i = 0; i < 60; i++) {
        treeManager.update(1.0);
      }

      expect(tree.growthStage).toBe('young');
    });

    it('should grow young to mature', () => {
      const tree = treeManager.addTree({ q: 5, r: 5 }, 'tree_deciduous', 0, 0, 0, 1);

      // Grow through sapling (60s) + young (90s) = 150s + margin
      for (let i = 0; i < 160; i++) {
        treeManager.update(1.0);
      }

      expect(tree.growthStage).toBe('mature');
      expect(tree.growthProgress).toBe(1.0);
    });

    it('should fire onTreeChanged on stage transitions', () => {
      treeManager.addTree({ q: 5, r: 5 }, 'tree_deciduous', 0, 0, 0, 1);

      let callCount = 0;
      treeManager.onTreeChanged = () => { callCount++; };

      // Grow through sapling (60s)
      for (let i = 0; i < 61; i++) {
        treeManager.update(1.0);
      }

      expect(callCount).toBeGreaterThanOrEqual(1);
    });

    it('should not update mature trees', () => {
      treeManager.initializeFromMap(grid);
      const trees = treeManager.getAllTrees();

      let changed = false;
      treeManager.onTreeChanged = () => { changed = true; };

      treeManager.update(1.0);

      expect(changed).toBe(false);
      for (const tree of trees) {
        expect(tree.growthStage).toBe('mature');
      }
    });
  });

  describe('findNearestMatureTree', () => {
    it('should find a mature tree near origin', () => {
      treeManager.initializeFromMap(grid);

      const result = treeManager.findNearestMatureTree({ q: 3, r: 3 }, 5, grid);
      expect(result).not.toBeNull();
      expect(result!.growthStage).toBe('mature');
    });

    it('should not find trees when none exist', () => {
      // Empty tree manager
      const result = treeManager.findNearestMatureTree({ q: 5, r: 5 }, 5, grid);
      expect(result).toBeNull();
    });

    it('should skip marked trees', () => {
      treeManager.initializeFromMap(grid);
      const trees = treeManager.getAllTrees();

      // Mark all trees as reserved
      for (const tree of trees) {
        tree.markedForCut = true;
        tree.markedBy = 'test';
      }

      const result = treeManager.findNearestMatureTree({ q: 3, r: 3 }, 5, grid);
      expect(result).toBeNull();
    });

    it('should skip saplings', () => {
      treeManager.addTree({ q: 5, r: 5 }, 'tree_deciduous', 0, 0, 0, 1);

      const result = treeManager.findNearestMatureTree({ q: 5, r: 5 }, 5, grid);
      expect(result).toBeNull();
    });
  });

  describe('findPlantableSpot', () => {
    it('should find a spot on forest tile with room', () => {
      // Forest tile at (3,3) has some trees but less than 4 (could be 2-4)
      treeManager.initializeFromMap(grid);

      // Find a tile with less than 4 trees
      const spot = treeManager.findPlantableSpot({ q: 3, r: 3 }, 3, grid, gameState);

      // Should find at least one plantable spot nearby
      if (spot) {
        const count = treeManager.getTreeCountOnTile(spot);
        expect(count).toBeLessThan(4);
      }
    });

    it('should find a spot on empty grassland', () => {
      // (5,5) is grassland with no trees
      const spot = treeManager.findPlantableSpot({ q: 5, r: 5 }, 3, grid, gameState);
      expect(spot).not.toBeNull();
    });

    it('should not plant on water or mountain tiles', () => {
      grid.setTile(5, 5, TerrainType.Water, 0.1);
      grid.setTile(6, 5, TerrainType.Mountain, 0.8);

      // Only water/mountain around (5,5), (6,5) — but grassland elsewhere
      const spot = treeManager.findPlantableSpot({ q: 5, r: 5 }, 1, grid, gameState);

      if (spot) {
        const tile = grid.getTile(spot.q, spot.r);
        expect(tile!.terrain).not.toBe(TerrainType.Water);
        expect(tile!.terrain).not.toBe(TerrainType.Mountain);
      }
    });

    it('should not plant on tiles with buildings', () => {
      const result = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
      expect(result.ok).toBe(true);

      const spot = treeManager.findPlantableSpot({ q: 5, r: 5 }, 0, grid, gameState);
      // Should not return the tile with the castle
      if (spot) {
        expect(spot.q !== 5 || spot.r !== 5).toBe(true);
      }
    });

    it('should respect exclude tiles', () => {
      const exclude = new Set<string>();
      exclude.add(HexGrid.key(5, 5));
      exclude.add(HexGrid.key(5, 6));

      const spot = treeManager.findPlantableSpot({ q: 5, r: 5 }, 1, grid, gameState, exclude);
      if (spot) {
        expect(spot.q !== 5 || spot.r !== 5).toBe(true);
        expect(spot.q !== 5 || spot.r !== 6).toBe(true);
      }
    });
  });

  describe('unmarkTreesForBuilding', () => {
    it('should unmark all trees reserved by a building', () => {
      treeManager.initializeFromMap(grid);
      const trees = treeManager.getAllTrees();

      trees[0].markedForCut = true;
      trees[0].markedBy = 'building_1';
      trees[1].markedForCut = true;
      trees[1].markedBy = 'building_1';
      trees[2].markedForCut = true;
      trees[2].markedBy = 'building_2';

      treeManager.unmarkTreesForBuilding('building_1');

      expect(trees[0].markedForCut).toBe(false);
      expect(trees[0].markedBy).toBeNull();
      expect(trees[1].markedForCut).toBe(false);
      expect(trees[1].markedBy).toBeNull();
      // building_2 should be unaffected
      expect(trees[2].markedForCut).toBe(true);
      expect(trees[2].markedBy).toBe('building_2');
    });
  });

  describe('serialization', () => {
    it('should round-trip tree state', () => {
      treeManager.initializeFromMap(grid);
      const originalCount = treeManager.getAllTrees().length;

      // Add a sapling
      treeManager.addTree({ q: 5, r: 5 }, 'tree_conifer', 0.1, 0.2, 1.5, 0.9);

      // Grow it a bit
      treeManager.update(30);

      const state = treeManager._getState();
      expect(state.trees.length).toBe(originalCount + 1);

      // Restore into new manager
      resetTreeIdCounter();
      const tm2 = new TreeManager();
      tm2._loadState(state);

      const restored = tm2.getAllTrees();
      expect(restored.length).toBe(originalCount + 1);

      // Check the sapling is restored with correct growth
      const sapling = restored.find((t) => t.tileCoord.q === 5 && t.tileCoord.r === 5);
      expect(sapling).toBeDefined();
      expect(sapling!.modelType).toBe('tree_conifer');
    });

    it('should preserve per-tile index after load', () => {
      treeManager.initializeFromMap(grid);
      const state = treeManager._getState();

      const tm2 = new TreeManager();
      tm2._loadState(state);

      // Check per-tile counts match
      expect(tm2.getTreeCountOnTile({ q: 3, r: 3 })).toBe(
        treeManager.getTreeCountOnTile({ q: 3, r: 3 }),
      );
      expect(tm2.getTreeCountOnTile({ q: 3, r: 4 })).toBe(
        treeManager.getTreeCountOnTile({ q: 3, r: 4 }),
      );
    });
  });
});
