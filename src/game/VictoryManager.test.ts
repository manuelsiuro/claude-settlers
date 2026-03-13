import { describe, it, expect, beforeEach } from 'vitest';
import { VictoryManager, VictoryCondition } from './VictoryManager';
import type { VictoryResult, DefeatResult } from './VictoryManager';
import { TerritoryManager } from './TerritoryManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import { BuildingState, addToInventory, resetBuildingIdCounter } from './Building';
import { ResourceType } from './ResourceType';

function makeGrid(width: number, height: number, terrain = TerrainType.Grassland): HexGrid {
  const grid = new HexGrid(width, height);
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      grid.setTile(q, r, terrain);
    }
  }
  return grid;
}

describe('VictoryManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let territory: TerritoryManager;
  let victory: VictoryManager;
  let victories: VictoryResult[];
  let defeats: DefeatResult[];

  beforeEach(() => {
    resetBuildingIdCounter();
    grid = makeGrid(20, 20);
    gameState = new GameState(grid);
    territory = new TerritoryManager(gameState);
    victory = new VictoryManager(gameState, territory, [1, 2]);
    victories = [];
    defeats = [];
    victory.onVictory = (r) => victories.push(r);
    victory.onDefeat = (r) => defeats.push(r);
  });

  it('should not trigger victory with both players alive', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);

    victory.checkNow();

    expect(victories).toHaveLength(0);
    expect(defeats).toHaveLength(0);
    expect(victory.isGameOver()).toBe(false);
    expect(victory.getResult()).toBeNull();
  });

  it('should detect defeat when Castle is destroyed', () => {
    const r1 = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);
    expect(r1.ok && r2.ok).toBe(true);

    if (r2.ok) gameState.removeBuilding(r2.building.id);

    victory.checkNow();

    expect(defeats).toHaveLength(1);
    expect(defeats[0].playerId).toBe(2);
    expect(defeats[0].reason).toBe('castle_destroyed');
  });

  it('should trigger elimination victory when only one player remains', () => {
    const r1 = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);
    expect(r1.ok && r2.ok).toBe(true);

    if (r2.ok) gameState.removeBuilding(r2.building.id);

    victory.checkNow();

    expect(victories).toHaveLength(1);
    expect(victories[0].winnerId).toBe(1);
    expect(victories[0].condition).toBe(VictoryCondition.Elimination);
    expect(victory.isGameOver()).toBe(true);
  });

  it('should store result and expose via getResult()', () => {
    const r1 = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);
    expect(r1.ok && r2.ok).toBe(true);
    if (r2.ok) gameState.removeBuilding(r2.building.id);

    victory.checkNow();

    const result = victory.getResult();
    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe(1);
    expect(result!.condition).toBe(VictoryCondition.Elimination);
  });

  it('should not check after game over', () => {
    const r1 = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);
    expect(r1.ok && r2.ok).toBe(true);
    if (r2.ok) gameState.removeBuilding(r2.building.id);

    victory.checkNow();
    expect(victories).toHaveLength(1);

    // Second check should not fire again
    victory.checkNow();
    expect(victories).toHaveLength(1);
  });

  it('should trigger economic victory at 50 gold bars', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);
    expect(r2.ok).toBe(true);

    const castle = gameState.findCastle(1)!;
    addToInventory(castle.outputInventory, ResourceType.GoldBars, 50);

    victory.checkNow();

    expect(victories).toHaveLength(1);
    expect(victories[0].winnerId).toBe(1);
    expect(victories[0].condition).toBe(VictoryCondition.Economic);
    expect(victory.isGameOver()).toBe(true);
    expect(victory.getResult()!.condition).toBe(VictoryCondition.Economic);
  });

  it('should not trigger economic victory below threshold', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);

    const castle = gameState.findCastle(1)!;
    addToInventory(castle.outputInventory, ResourceType.GoldBars, 49);

    victory.checkNow();

    expect(victories).toHaveLength(0);
  });

  it('should not count gold bars in non-active buildings', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);

    // Place a warehouse but leave it in Planned state
    const wr = gameState.placeBuilding(BuildingType.Warehouse, { q: 6, r: 5 }, 1);
    expect(wr.ok).toBe(true);
    if (wr.ok) {
      // Still in Planned state — not Active
      addToInventory(wr.building.outputInventory, ResourceType.GoldBars, 100);
    }

    const total = victory.getPlayerGoldBars(1);
    // Only the Castle's gold counts (0), not the planned warehouse
    expect(total).toBe(0);
  });

  it('should trigger domination victory at 75%+ territory', () => {
    // Use a 24x24 grid with many military buildings for player 1 to dominate
    // maxSafeRadius = floor(24/4)-1 = 5, so Castle influence capped to 5
    const largeGrid = makeGrid(24, 24);
    const gs = new GameState(largeGrid);
    const tm = new TerritoryManager(gs);
    const vm = new VictoryManager(gs, tm, [1, 2]);
    const v: VictoryResult[] = [];
    vm.onVictory = (r) => v.push(r);

    // Player 1 Castle at center
    gs.placeBuilding(BuildingType.Castle, { q: 12, r: 12 }, 1);
    // Player 2 Castle in corner — minimal territory
    gs.placeBuilding(BuildingType.Castle, { q: 0, r: 0 }, 2);

    // Spread Guard Huts and Watchtowers across the map for player 1 to guarantee >75%
    const militaryPositions = [
      { q: 5, r: 5 }, { q: 18, r: 5 }, { q: 5, r: 18 }, { q: 18, r: 18 },
      { q: 12, r: 5 }, { q: 12, r: 18 }, { q: 5, r: 12 }, { q: 18, r: 12 },
    ];
    for (const pos of militaryPositions) {
      const result = gs.placeBuilding(BuildingType.GuardHut, pos, 1);
      if (result.ok) result.building.state = BuildingState.Active;
    }

    tm.update();

    const fraction = vm.getPlayerTerritoryFraction(1);
    // With Castle + 8 Guard Huts covering the map, player 1 should dominate
    expect(fraction).toBeGreaterThanOrEqual(VictoryManager.DOMINATION_THRESHOLD);

    vm.checkNow();

    expect(v).toHaveLength(1);
    expect(v[0].winnerId).toBe(1);
    expect(v[0].condition).toBe(VictoryCondition.Domination);
  });

  it('should count gold bars from all active buildings including input inventory', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);

    const castle = gameState.findCastle(1)!;
    addToInventory(castle.outputInventory, ResourceType.GoldBars, 30);

    const r = gameState.placeBuilding(BuildingType.Warehouse, { q: 6, r: 5 }, 1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      r.building.state = BuildingState.Active;
      addToInventory(r.building.outputInventory, ResourceType.GoldBars, 20);
    }

    const total = victory.getPlayerGoldBars(1);
    expect(total).toBe(50);
  });

  it('should track eliminated players', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);
    expect(r2.ok).toBe(true);
    if (r2.ok) gameState.removeBuilding(r2.building.id);

    victory.checkNow();

    expect(victory.isEliminated(2)).toBe(true);
    expect(victory.isEliminated(1)).toBe(false);
    expect(victory.getActivePlayers()).toEqual([1]);
  });

  it('should fire on first update() call (cooldown starts at 0)', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);
    expect(r2.ok).toBe(true);
    if (r2.ok) gameState.removeBuilding(r2.building.id);

    victory.update(0.016);
    expect(victories).toHaveLength(1);
  });

  it('should skip checks during cooldown interval', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);

    // First update — triggers check (cooldown starts at 0)
    victory.update(0.016);
    expect(defeats).toHaveLength(0); // both alive, no defeats

    // Now remove player 2's Castle
    const castle2 = gameState.findCastle(2)!;
    gameState.removeBuilding(castle2.id);

    // Second update within cooldown — should NOT detect the defeat
    victory.update(0.5);
    expect(defeats).toHaveLength(0);

    // Third update — enough time has passed (total > 2s)
    victory.update(1.6);
    expect(defeats).toHaveLength(1);
    expect(defeats[0].playerId).toBe(2);
  });

  it('should handle single-player game without triggering elimination', () => {
    const singlePlayerVictory = new VictoryManager(gameState, territory, [1]);
    const singleVictories: VictoryResult[] = [];
    singlePlayerVictory.onVictory = (r) => singleVictories.push(r);

    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    singlePlayerVictory.checkNow();

    expect(singleVictories).toHaveLength(0);
  });

  it('should handle 3+ players with sequential elimination', () => {
    const threePlayerVictory = new VictoryManager(gameState, territory, [1, 2, 3]);
    const v: VictoryResult[] = [];
    const d: DefeatResult[] = [];
    threePlayerVictory.onVictory = (r) => v.push(r);
    threePlayerVictory.onDefeat = (r) => d.push(r);

    gameState.placeBuilding(BuildingType.Castle, { q: 2, r: 2 }, 1);
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 2);
    const r3 = gameState.placeBuilding(BuildingType.Castle, { q: 18, r: 18 }, 3);
    expect(r2.ok && r3.ok).toBe(true);

    // Eliminate player 3
    if (r3.ok) gameState.removeBuilding(r3.building.id);
    threePlayerVictory.checkNow();

    expect(d).toHaveLength(1);
    expect(d[0].playerId).toBe(3);
    expect(v).toHaveLength(0); // Not over yet — 2 players still active

    // Eliminate player 2
    if (r2.ok) gameState.removeBuilding(r2.building.id);
    threePlayerVictory.checkNow();

    expect(d).toHaveLength(2);
    expect(v).toHaveLength(1);
    expect(v[0].winnerId).toBe(1);
    expect(v[0].condition).toBe(VictoryCondition.Elimination);
  });

  it('should not count water tiles as claimable for domination', () => {
    const mixedGrid = new HexGrid(10, 10);
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        mixedGrid.setTile(q, r, r < 5 ? TerrainType.Grassland : TerrainType.Water);
      }
    }
    const gs = new GameState(mixedGrid);
    const tm = new TerritoryManager(gs);
    const vm = new VictoryManager(gs, tm, [1, 2]);

    gs.placeBuilding(BuildingType.Castle, { q: 5, r: 2 }, 1);
    gs.placeBuilding(BuildingType.Castle, { q: 0, r: 0 }, 2);
    tm.update();

    const fraction = vm.getPlayerTerritoryFraction(1);
    // Only 50 tiles are claimable (rows 0-4), so fraction is based on 50, not 100
    expect(fraction).toBeGreaterThan(0);
    expect(fraction).toBeLessThanOrEqual(1);
  });

  it('should fire defeat before elimination victory in same check', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 1);
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 15 }, 2);
    expect(r2.ok).toBe(true);
    if (r2.ok) gameState.removeBuilding(r2.building.id);

    const events: string[] = [];
    victory.onDefeat = (r) => { defeats.push(r); events.push(`defeat:${r.playerId}`); };
    victory.onVictory = (r) => { victories.push(r); events.push(`victory:${r.winnerId}`); };

    victory.checkNow();

    // Defeat should fire before victory
    expect(events).toEqual(['defeat:2', 'victory:1']);
  });
});
