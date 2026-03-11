import { describe, it, expect, beforeEach } from 'vitest';
import { KnightManager } from './KnightManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import {
  BuildingState,
  addToInventory,
  resetBuildingIdCounter,
} from './Building';
import { ResourceType } from './ResourceType';
import { UnitType } from './UnitType';
import { resetUnitIdCounter } from './Unit';

function makeGrid(): HexGrid {
  const grid = new HexGrid(20, 20);
  for (let q = 0; q < 20; q++) {
    for (let r = 0; r < 20; r++) {
      grid.setTile(q, r, TerrainType.Grassland);
    }
  }
  return grid;
}

describe('KnightManager', () => {
  let gameState: GameState;
  let knightManager: KnightManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    const grid = makeGrid();
    gameState = new GameState(grid);
    knightManager = new KnightManager(gameState);
  });

  it('should recruit a knight when military building has Sword + Shield', () => {
    const result = gameState.placeBuilding(BuildingType.GuardHut, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const building = result.building;
    building.state = BuildingState.Active;
    addToInventory(building.inputInventory, ResourceType.Swords, 1);
    addToInventory(building.inputInventory, ResourceType.Shields, 1);

    knightManager.update(2); // exceed cooldown

    // Should have spawned a knight
    expect(building.knightIds).toHaveLength(1);

    const knight = gameState.getUnit(building.knightIds[0]);
    expect(knight).toBeDefined();
    expect(knight!.type).toBe(UnitType.Knight);
    expect(knight!.playerId).toBe(1);
    expect(knight!.coord).toEqual({ q: 10, r: 10 });

    // Resources should be consumed
    expect(building.inputInventory[ResourceType.Swords]).toBeUndefined();
    expect(building.inputInventory[ResourceType.Shields]).toBeUndefined();
  });

  it('should not recruit if no Sword or Shield', () => {
    const result = gameState.placeBuilding(BuildingType.GuardHut, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const building = result.building;
    building.state = BuildingState.Active;
    addToInventory(building.inputInventory, ResourceType.Swords, 1);
    // No shields

    knightManager.update(2);

    expect(building.knightIds).toHaveLength(0);
  });

  it('should not recruit if building is not Active', () => {
    const result = gameState.placeBuilding(BuildingType.GuardHut, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const building = result.building;
    building.state = BuildingState.Planned;
    addToInventory(building.inputInventory, ResourceType.Swords, 1);
    addToInventory(building.inputInventory, ResourceType.Shields, 1);

    knightManager.update(2);

    expect(building.knightIds).toHaveLength(0);
  });

  it('should not exceed knight slots', () => {
    const result = gameState.placeBuilding(BuildingType.GuardHut, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const building = result.building;
    building.state = BuildingState.Active;

    // Guard Hut has 3 slots — add 4 sets of weapons
    addToInventory(building.inputInventory, ResourceType.Swords, 4);
    addToInventory(building.inputInventory, ResourceType.Shields, 4);

    // Run multiple ticks
    for (let i = 0; i < 5; i++) {
      knightManager.update(2);
    }

    // Should only have 3 knights (Guard Hut has 3 slots)
    expect(building.knightIds).toHaveLength(3);

    // Should still have 1 leftover of each weapon
    expect(building.inputInventory[ResourceType.Swords]).toBe(1);
    expect(building.inputInventory[ResourceType.Shields]).toBe(1);
  });

  it('should not recruit in non-military buildings', () => {
    const result = gameState.placeBuilding(BuildingType.Sawmill, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const building = result.building;
    building.state = BuildingState.Active;
    addToInventory(building.inputInventory, ResourceType.Swords, 1);
    addToInventory(building.inputInventory, ResourceType.Shields, 1);

    knightManager.update(2);

    expect(building.knightIds).toHaveLength(0);
  });

  it('should clean up references to dead knights', () => {
    const result = gameState.placeBuilding(BuildingType.GuardHut, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const building = result.building;
    building.state = BuildingState.Active;
    addToInventory(building.inputInventory, ResourceType.Swords, 1);
    addToInventory(building.inputInventory, ResourceType.Shields, 1);

    knightManager.update(2);
    expect(building.knightIds).toHaveLength(1);

    const knightId = building.knightIds[0];
    gameState.removeUnit(knightId);

    knightManager.update(2);

    expect(building.knightIds).toHaveLength(0);
  });

  it('should calculate gold bonus from Castle and Warehouses', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);
    if (!castle.ok) return;

    // No gold → bonus is 1.0
    expect(knightManager.getGoldBonus(1)).toBe(1.0);

    // Add 4 gold bars → 4 * 0.05 = 0.20, so 1.2
    addToInventory(castle.building.outputInventory, ResourceType.GoldBars, 4);
    expect(knightManager.getGoldBonus(1)).toBeCloseTo(1.2);

    // Add enough to cap at 1.5 (10 gold → 0.50)
    addToInventory(castle.building.outputInventory, ResourceType.GoldBars, 6);
    expect(knightManager.getGoldBonus(1)).toBeCloseTo(1.5);

    // More gold doesn't exceed 1.5 cap
    addToInventory(castle.building.outputInventory, ResourceType.GoldBars, 10);
    expect(knightManager.getGoldBonus(1)).toBeCloseTo(1.5);
  });

  it('should calculate knight strength from rank and gold bonus', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);

    const hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 12, r: 10 }, 1);
    expect(hut.ok).toBe(true);
    if (!hut.ok) return;

    hut.building.state = BuildingState.Active;
    addToInventory(hut.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut.building.inputInventory, ResourceType.Shields, 1);

    knightManager.update(2);

    const knightId = hut.building.knightIds[0];
    const knight = gameState.getUnit(knightId)!;
    expect(knight.knightRank).toBe(1);

    // Rank 1, no gold → strength = 1.0
    expect(knightManager.getKnightStrength(knightId)).toBeCloseTo(1.0);

    // Promote to rank 3
    knight.knightRank = 3;
    expect(knightManager.getKnightStrength(knightId)).toBeCloseTo(3.0);

    // Add gold bonus (4 gold = 1.2x)
    if (castle.ok) {
      addToInventory(castle.building.outputInventory, ResourceType.GoldBars, 4);
    }
    expect(knightManager.getKnightStrength(knightId)).toBeCloseTo(3.6);
  });

  it('should report available slots correctly', () => {
    const result = gameState.placeBuilding(BuildingType.Watchtower, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const building = result.building;
    building.state = BuildingState.Active;

    // Watchtower has 6 slots, 0 occupied
    expect(knightManager.getAvailableSlots(building.id)).toBe(6);
    expect(knightManager.getStationedCount(building.id)).toBe(0);

    // Add 2 knights
    addToInventory(building.inputInventory, ResourceType.Swords, 2);
    addToInventory(building.inputInventory, ResourceType.Shields, 2);
    knightManager.update(2);
    knightManager.update(2);

    expect(knightManager.getStationedCount(building.id)).toBe(2);
    expect(knightManager.getAvailableSlots(building.id)).toBe(4);
  });

  it('should call onKnightRecruited callback', () => {
    let called = false;
    knightManager.onKnightRecruited = () => { called = true; };

    const result = gameState.placeBuilding(BuildingType.GuardHut, { q: 10, r: 10 }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    result.building.state = BuildingState.Active;
    addToInventory(result.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(result.building.inputInventory, ResourceType.Shields, 1);

    knightManager.update(2);

    expect(called).toBe(true);
  });
});
