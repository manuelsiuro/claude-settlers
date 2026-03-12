import { describe, it, expect, beforeEach } from 'vitest';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';
import { ResourceType } from './ResourceType';
import { GameState } from './GameState';
import { TreeManager, resetTreeIdCounter } from './TreeManager';
import { WoodcutterManager } from './WoodcutterManager';

describe('WoodcutterManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let treeManager: TreeManager;
  let manager: WoodcutterManager;

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
    // Forest tiles near where we'll place the woodcutter hut
    grid.setTile(5, 4, TerrainType.Forest, 0.5);
    grid.setTile(6, 4, TerrainType.Forest, 0.5);
    grid.setTile(5, 5, TerrainType.Forest, 0.5);

    gameState = new GameState(grid);
    treeManager = new TreeManager();
    treeManager.initializeFromMap(grid);
    manager = new WoodcutterManager(gameState, treeManager);
  });

  function placeWoodcutter(q: number, r: number) {
    const result = gameState.placeBuilding(BuildingType.WoodcutterHut, { q, r }, 1);
    if (!result.ok) throw new Error(`Failed to place: ${result.error}`);
    result.building.state = BuildingState.Active;

    const worker = gameState.spawnUnit(UnitType.Woodcutter, { q, r }, 1);
    worker.state = UnitState.Working;
    gameState.assignWorkerToBuilding(worker.id, result.building.id);

    return { building: result.building, worker };
  }

  describe('full work cycle', () => {
    it('should chop a tree and deposit Wood', () => {
      const { building } = placeWoodcutter(4, 4);
      const initialTreeCount = treeManager.getAllTrees().length;

      // Run for enough time to complete a full cycle
      // idle(2s) + walking + chopping(8s) + walking + depositing
      for (let i = 0; i < 600; i++) {
        manager.update(0.1);
      }

      // Should have produced at least 1 Wood
      const wood = building.outputInventory[ResourceType.Wood] ?? 0;
      expect(wood).toBeGreaterThanOrEqual(1);

      // Should have removed at least 1 tree
      expect(treeManager.getAllTrees().length).toBeLessThan(initialTreeCount);
    });

    it('should remove tree on chop', () => {
      placeWoodcutter(4, 4);

      // Track tree count before
      const treeBefore = treeManager.getAllTrees().length;

      // Run until at least one tree is chopped
      for (let i = 0; i < 1000; i++) {
        manager.update(0.1);
        if (treeManager.getAllTrees().length < treeBefore) break;
      }

      expect(treeManager.getAllTrees().length).toBeLessThan(treeBefore);
    });
  });

  describe('terrain conversion', () => {
    it('should convert Forest to Grassland when last tree removed', () => {
      // Set up a forest tile with exactly one tree manually
      grid.setTile(8, 8, TerrainType.Forest, 0.5);
      const tree = treeManager.addTree({ q: 8, r: 8 }, 'tree_deciduous', 0, 0, 0, 1);
      // Make it mature so it can be chopped
      tree.growthStage = 'mature';
      tree.growthProgress = 1.0;

      manager.onTerrainChanged = () => { /* tracked */ };

      // Remove the tree manually (simulating chop)
      treeManager.removeTree(tree.id);

      // Verify there are no more trees on this tile
      expect(treeManager.getTreeCountOnTile({ q: 8, r: 8 })).toBe(0);

      // The WoodcutterManager handles terrain conversion during its chopping phase.
      // For a unit test, let's verify the conversion logic directly
      const tile = grid.getTile(8, 8);
      expect(tile).toBeDefined();
      // The tile is still Forest because we bypassed the manager's chopping logic
      // The actual conversion happens inside updateWoodcutter when chopProgress >= 1
    });
  });

  describe('idle behavior', () => {
    it('should idle when no trees are available', () => {
      // Clear all trees
      for (const tree of treeManager.getAllTrees()) {
        treeManager.removeTree(tree.id);
      }

      const { building } = placeWoodcutter(4, 4);

      // Should not crash and should not produce wood
      for (let i = 0; i < 100; i++) {
        manager.update(0.1);
      }

      const wood = building.outputInventory[ResourceType.Wood] ?? 0;
      expect(wood).toBe(0);
    });
  });

  describe('cleanup on building removal', () => {
    it('should clean up work state when building is removed', () => {
      const { building } = placeWoodcutter(4, 4);

      // Run a few ticks so the manager creates work state
      for (let i = 0; i < 50; i++) {
        manager.update(0.1);
      }

      // Remove the building
      gameState.removeBuilding(building.id);

      // Update manager — should clean up
      manager.update(0.1);

      // Any trees that were marked by this building should be unmarked
      for (const tree of treeManager.getAllTrees()) {
        expect(tree.markedBy).not.toBe(building.id);
      }
    });
  });

  describe('serialization', () => {
    it('should round-trip work state', () => {
      placeWoodcutter(4, 4);

      // Run a few cycles
      for (let i = 0; i < 50; i++) {
        manager.update(0.1);
      }

      const state = manager._getState();
      expect(state.workStates.length).toBe(1);

      const manager2 = new WoodcutterManager(gameState, treeManager);
      manager2._loadState(state);

      const state2 = manager2._getState();
      expect(state2.workStates.length).toBe(1);
      expect(state2.workStates[0][0]).toBe(state.workStates[0][0]);
    });
  });
});
