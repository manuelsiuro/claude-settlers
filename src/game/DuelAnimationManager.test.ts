import { describe, it, expect, beforeEach } from 'vitest';
import { DuelAnimationManager } from './DuelAnimationManager';
import { CombatManager } from './CombatManager';
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
import { UnitState, resetUnitIdCounter } from './Unit';
import { DuelPhase } from './CombatAnimationState';

function makeGrid(): HexGrid {
  const grid = new HexGrid(20, 20);
  for (let q = 0; q < 20; q++) {
    for (let r = 0; r < 20; r++) {
      grid.setTile(q, r, TerrainType.Grassland);
    }
  }
  return grid;
}

function recruitKnight(
  gameState: GameState,
  knightManager: KnightManager,
  buildingId: string,
): string {
  const building = gameState.getBuilding(buildingId)!;
  addToInventory(building.inputInventory, ResourceType.Swords, 1);
  addToInventory(building.inputInventory, ResourceType.Shields, 1);
  knightManager.update(2);
  return building.knightIds[building.knightIds.length - 1];
}

const getWorldY = () => 0;

describe('DuelAnimationManager', () => {
  let gameState: GameState;
  let knightManager: KnightManager;
  let combatManager: CombatManager;
  let dam: DuelAnimationManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    const grid = makeGrid();
    gameState = new GameState(grid);
    knightManager = new KnightManager(gameState);
    combatManager = new CombatManager(gameState, knightManager);
    dam = new DuelAnimationManager();
  });

  function setupTwoKnights() {
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 5 }, 2);
    if (!hut1.ok || !hut2.ok) throw new Error('Failed to place buildings');
    hut1.building.state = BuildingState.Active;
    hut2.building.state = BuildingState.Active;

    const knight1Id = recruitKnight(gameState, knightManager, hut1.building.id);
    const knight2Id = recruitKnight(gameState, knightManager, hut2.building.id);

    // Force attacker to win
    combatManager.random = () => 0.1;

    return { knight1Id, knight2Id, hut1: hut1.building, hut2: hut2.building };
  }

  it('should start a duel and create an ActiveDuel in Approach phase', () => {
    const { knight1Id, knight2Id } = setupTwoKnights();

    const started = dam.startDuel(knight1Id, knight2Id, combatManager, gameState, getWorldY);
    expect(started).toBe(true);

    const duels = dam.getActiveDuels();
    expect(duels).toHaveLength(1);
    expect(duels[0].attackerId).toBe(knight1Id);
    expect(duels[0].defenderId).toBe(knight2Id);
    expect(duels[0].phase).toBe(DuelPhase.Approach);
  });

  it('should set both combatants to Fighting state', () => {
    const { knight1Id, knight2Id } = setupTwoKnights();

    dam.startDuel(knight1Id, knight2Id, combatManager, gameState, getWorldY);

    const attacker = gameState.getUnit(knight1Id)!;
    const defender = gameState.getUnit(knight2Id)!;
    expect(attacker.state).toBe(UnitState.Fighting);
    expect(defender.state).toBe(UnitState.Fighting);
  });

  it('should report isInDuel correctly', () => {
    const { knight1Id, knight2Id } = setupTwoKnights();

    expect(dam.isInDuel(knight1Id)).toBe(false);
    expect(dam.isInDuel(knight2Id)).toBe(false);

    dam.startDuel(knight1Id, knight2Id, combatManager, gameState, getWorldY);

    expect(dam.isInDuel(knight1Id)).toBe(true);
    expect(dam.isInDuel(knight2Id)).toBe(true);
  });

  it('should advance phases and return completed duels after ~2s', () => {
    const { knight1Id, knight2Id } = setupTwoKnights();

    dam.startDuel(knight1Id, knight2Id, combatManager, gameState, getWorldY);

    // Tick small increments — should not be done yet
    let result = dam.update(0.1);
    expect(result).toHaveLength(0);
    expect(dam.getActiveDuels()).toHaveLength(1);

    // Tick enough to complete all phases
    // Approach=0.5 + Clash=0.3*N (2-4 clashes) + Recoil=0.2 + Result=0.8
    // Max total: 0.5 + 0.3*4 + 0.2 + 0.8 = 2.7s
    // Tick 3 seconds to be safe
    result = dam.update(3.0);

    expect(result).toHaveLength(1);
    expect(result[0].attackerId).toBe(knight1Id);
    expect(result[0].result.winnerId).toBe(knight1Id);
    expect(result[0].result.loserId).toBe(knight2Id);

    // Duel should be cleaned up
    expect(dam.getActiveDuels()).toHaveLength(0);
    expect(dam.isInDuel(knight1Id)).toBe(false);
    expect(dam.isInDuel(knight2Id)).toBe(false);
  });

  it('should prevent duplicate duels for the same knight', () => {
    const { knight1Id, knight2Id } = setupTwoKnights();

    // Spawn a third knight for player 2
    const opp = gameState.spawnUnit(UnitType.Knight, { q: 10, r: 10 }, 2);

    dam.startDuel(knight1Id, knight2Id, combatManager, gameState, getWorldY);

    // Try to start another duel with knight1 (already in a duel)
    const started = dam.startDuel(knight1Id, opp.id, combatManager, gameState, getWorldY);
    expect(started).toBe(false);
    expect(dam.getActiveDuels()).toHaveLength(1);
  });

  it('should handle multiple concurrent duels independently', () => {
    // Create 4 knights: 2 pairs
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 3, r: 3 }, 1);
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 6, r: 3 }, 2);
    const hut3 = gameState.placeBuilding(BuildingType.GuardHut, { q: 3, r: 10 }, 1);
    const hut4 = gameState.placeBuilding(BuildingType.GuardHut, { q: 6, r: 10 }, 2);
    if (!hut1.ok || !hut2.ok || !hut3.ok || !hut4.ok) throw new Error('Failed to place');
    hut1.building.state = BuildingState.Active;
    hut2.building.state = BuildingState.Active;
    hut3.building.state = BuildingState.Active;
    hut4.building.state = BuildingState.Active;

    combatManager.random = () => 0.1;

    const k1 = recruitKnight(gameState, knightManager, hut1.building.id);
    const k2 = recruitKnight(gameState, knightManager, hut2.building.id);
    const k3 = recruitKnight(gameState, knightManager, hut3.building.id);
    const k4 = recruitKnight(gameState, knightManager, hut4.building.id);

    dam.startDuel(k1, k2, combatManager, gameState, getWorldY);
    dam.startDuel(k3, k4, combatManager, gameState, getWorldY);

    expect(dam.getActiveDuels()).toHaveLength(2);

    // Complete both
    const results = dam.update(3.0);
    expect(results).toHaveLength(2);
    expect(dam.getActiveDuels()).toHaveLength(0);
  });

  it('should return false for invalid preCompute', () => {
    const started = dam.startDuel('fake1', 'fake2', combatManager, gameState, getWorldY);
    expect(started).toBe(false);
    expect(dam.getActiveDuels()).toHaveLength(0);
  });

  it('should have no-op serialization (ephemeral duels)', () => {
    const state = dam._getState();
    expect(state).toEqual({});
    // Should not throw
    dam._loadState({});
  });
});
