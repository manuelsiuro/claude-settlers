import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState, addToInventory, getInventoryAmount } from './Building';
import { ResourceType } from './ResourceType';
import { UnitState } from './Unit';
import { resetBuildingIdCounter } from './Building';
import { resetUnitIdCounter } from './Unit';
import { UpgradeManager } from './UpgradeManager';
import { UpgradeAxis, getEffectiveStorageCapacity } from './BuildingUpgrade';

function makeGrid(): HexGrid {
  const grid = new HexGrid(20, 20);
  for (let q = 0; q < 20; q++) {
    for (let r = 0; r < 20; r++) {
      grid.setTile(q, r, TerrainType.Grassland, 0);
    }
  }
  return grid;
}

describe('UpgradeManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let upgradeManager: UpgradeManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    grid = makeGrid();
    gameState = new GameState(grid);
    upgradeManager = new UpgradeManager(gameState);
  });

  it('should start an upgrade on an active building', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 7, r: 7 }, 1);
    expect(sawmill.ok).toBe(true);
    if (!sawmill.ok) return;

    sawmill.building.state = BuildingState.Active;

    const result = upgradeManager.startUpgrade(sawmill.building.id, UpgradeAxis.Storage);
    expect(result).toBe(true);
    expect(sawmill.building.activeUpgrade).not.toBeNull();
    expect(sawmill.building.activeUpgrade!.axis).toBe(UpgradeAxis.Storage);
    expect(sawmill.building.activeUpgrade!.targetLevel).toBe(1);
  });

  it('should not start upgrade on non-active building', () => {
    const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 7, r: 7 }, 1);
    expect(sawmill.ok).toBe(true);
    if (!sawmill.ok) return;

    // Building is in Planned state
    const result = upgradeManager.startUpgrade(sawmill.building.id, UpgradeAxis.Storage);
    expect(result).toBe(false);
    expect(sawmill.building.activeUpgrade).toBeNull();
  });

  it('should not start upgrade when already upgrading', () => {
    const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 7, r: 7 }, 1);
    if (!sawmill.ok) return;
    sawmill.building.state = BuildingState.Active;

    upgradeManager.startUpgrade(sawmill.building.id, UpgradeAxis.Storage);
    const result = upgradeManager.startUpgrade(sawmill.building.id, UpgradeAxis.Production);
    expect(result).toBe(false);
  });

  it('should deliver resources from Castle during update', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    if (!castle.ok) return;
    castle.building.state = BuildingState.Active;
    // Stock Castle with resources
    addToInventory(castle.building.outputInventory, ResourceType.Planks, 10);
    addToInventory(castle.building.outputInventory, ResourceType.Stone, 10);

    const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 7, r: 7 }, 1);
    if (!sawmill.ok) return;
    sawmill.building.state = BuildingState.Active;

    upgradeManager.startUpgrade(sawmill.building.id, UpgradeAxis.Storage);

    // Run several update ticks to deliver resources
    for (let i = 0; i < 10; i++) {
      upgradeManager.update(1.1);
    }

    // Resources should have been delivered from Castle
    const delivered = sawmill.building.activeUpgrade?.resourcesDelivered;
    expect(delivered).toBeDefined();
    // At least some resources should have been delivered
    const totalDelivered = Object.values(delivered!).reduce((a, b) => a + (b ?? 0), 0);
    expect(totalDelivered).toBeGreaterThan(0);
  });

  it('should complete upgrade and increment level', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    if (!castle.ok) return;
    castle.building.state = BuildingState.Active;
    addToInventory(castle.building.outputInventory, ResourceType.Planks, 20);
    addToInventory(castle.building.outputInventory, ResourceType.Stone, 20);

    const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 7, r: 7 }, 1);
    if (!sawmill.ok) return;
    sawmill.building.state = BuildingState.Active;

    upgradeManager.startUpgrade(sawmill.building.id, UpgradeAxis.Storage);

    // Fast-forward: deliver all resources
    for (let i = 0; i < 20; i++) {
      upgradeManager.update(1.1);
    }

    // Find builder and force it to Working state (simulating arrival)
    const units = gameState.getAllUnits();
    const builder = units.find(u => u.state === UnitState.WalkingToWork);
    if (builder) {
      builder.state = UnitState.Working;
      builder.coord = { ...sawmill.building.coord };
    }

    // Advance construction to completion
    for (let i = 0; i < 100; i++) {
      upgradeManager.update(1.0);
    }

    expect(sawmill.building.upgradeLevels[UpgradeAxis.Storage]).toBe(1);
    expect(sawmill.building.activeUpgrade).toBeNull();
    // New formula: ceil(6 * 1.25) = 8
    expect(getEffectiveStorageCapacity(sawmill.building)).toBe(8);
  });

  it('should cancel upgrade and refund resources', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    if (!castle.ok) return;
    castle.building.state = BuildingState.Active;
    addToInventory(castle.building.outputInventory, ResourceType.Planks, 10);
    addToInventory(castle.building.outputInventory, ResourceType.Stone, 10);

    const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 7, r: 7 }, 1);
    if (!sawmill.ok) return;
    sawmill.building.state = BuildingState.Active;

    upgradeManager.startUpgrade(sawmill.building.id, UpgradeAxis.Storage);

    // Deliver some resources
    for (let i = 0; i < 5; i++) {
      upgradeManager.update(1.1);
    }

    // Track how many resources were delivered
    const deliveredPlanks = getInventoryAmount(sawmill.building.activeUpgrade!.resourcesDelivered, ResourceType.Planks);
    const deliveredStone = getInventoryAmount(sawmill.building.activeUpgrade!.resourcesDelivered, ResourceType.Stone);
    const castlePlanksBefore = getInventoryAmount(castle.building.outputInventory, ResourceType.Planks);
    const castleStoneBefore = getInventoryAmount(castle.building.outputInventory, ResourceType.Stone);

    // Cancel the upgrade
    const cancelled = upgradeManager.cancelUpgrade(sawmill.building.id);
    expect(cancelled).toBe(true);
    expect(sawmill.building.activeUpgrade).toBeNull();

    // Resources should be refunded to Castle
    const castlePlanksAfter = getInventoryAmount(castle.building.outputInventory, ResourceType.Planks);
    const castleStoneAfter = getInventoryAmount(castle.building.outputInventory, ResourceType.Stone);
    expect(castlePlanksAfter).toBe(castlePlanksBefore + deliveredPlanks);
    expect(castleStoneAfter).toBe(castleStoneBefore + deliveredStone);
  });

  it('should return false when cancelling with no active upgrade', () => {
    const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 7, r: 7 }, 1);
    if (!sawmill.ok) return;
    sawmill.building.state = BuildingState.Active;

    const result = upgradeManager.cancelUpgrade(sawmill.building.id);
    expect(result).toBe(false);
  });

  it('should serialize and deserialize state', () => {
    const state = upgradeManager._getState();
    expect(state.builderAssignments).toEqual([]);
    expect(state.deliveryCooldown).toBeDefined();

    const mgr2 = new UpgradeManager(gameState);
    mgr2._loadState(state);
    const state2 = mgr2._getState();
    expect(state2.builderAssignments).toEqual(state.builderAssignments);
  });
});
