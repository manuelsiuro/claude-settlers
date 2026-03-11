import { describe, it, expect, beforeEach } from 'vitest';
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

function setupWithKnights(gameState: GameState, knightManager: KnightManager) {
  // Place buildings for two players
  const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
  const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 15, r: 15 }, 2);

  if (!hut1.ok || !hut2.ok) throw new Error('Failed to place buildings');

  hut1.building.state = BuildingState.Active;
  hut2.building.state = BuildingState.Active;

  // Recruit knights
  addToInventory(hut1.building.inputInventory, ResourceType.Swords, 1);
  addToInventory(hut1.building.inputInventory, ResourceType.Shields, 1);
  addToInventory(hut2.building.inputInventory, ResourceType.Swords, 1);
  addToInventory(hut2.building.inputInventory, ResourceType.Shields, 1);

  knightManager.update(2);

  const knight1Id = hut1.building.knightIds[0];
  const knight2Id = hut2.building.knightIds[0];

  return { hut1: hut1.building, hut2: hut2.building, knight1Id, knight2Id };
}

describe('CombatManager', () => {
  let gameState: GameState;
  let knightManager: KnightManager;
  let combatManager: CombatManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    const grid = makeGrid();
    gameState = new GameState(grid);
    knightManager = new KnightManager(gameState);
    combatManager = new CombatManager(gameState, knightManager);
  });

  it('should resolve a duel — attacker wins when roll is low', () => {
    const { knight1Id, knight2Id, hut2 } = setupWithKnights(gameState, knightManager);

    // Force attacker to win
    combatManager.random = () => 0.1;

    const result = combatManager.resolveDuel(knight1Id, knight2Id);
    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe(knight1Id);
    expect(result!.loserId).toBe(knight2Id);

    // Loser should be removed
    expect(gameState.getUnit(knight2Id)).toBeUndefined();
    expect(hut2.knightIds).not.toContain(knight2Id);

    // Winner should still exist
    expect(gameState.getUnit(knight1Id)).toBeDefined();
  });

  it('should resolve a duel — defender wins when roll is high', () => {
    const { knight1Id, knight2Id, hut1 } = setupWithKnights(gameState, knightManager);

    // Force defender to win (equal strength = 50% cutoff, roll above wins for defender)
    combatManager.random = () => 0.9;

    const result = combatManager.resolveDuel(knight1Id, knight2Id);
    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe(knight2Id);
    expect(result!.loserId).toBe(knight1Id);

    // Attacker removed
    expect(gameState.getUnit(knight1Id)).toBeUndefined();
    expect(hut1.knightIds).not.toContain(knight1Id);
  });

  it('should favor higher-rank knight', () => {
    const { knight1Id, knight2Id } = setupWithKnights(gameState, knightManager);

    // Promote knight1 to rank 5
    const knight1 = gameState.getUnit(knight1Id)!;
    knight1.knightRank = 5;

    // With rank 5 vs rank 1:
    // strength: 5 vs 1 → attackerWinProb = 5/6 ≈ 0.833
    // Roll of 0.8 (< 0.833) → attacker should win
    combatManager.random = () => 0.8;

    const result = combatManager.resolveDuel(knight1Id, knight2Id);
    expect(result!.winnerId).toBe(knight1Id);
  });

  it('should advance rank after 2 combat wins', () => {
    const { knight1Id } = setupWithKnights(gameState, knightManager);
    combatManager.random = () => 0.1; // always attacker wins

    // First duel — win #1
    // Spawn new opponent
    const opponent1 = gameState.spawnUnit(UnitType.Knight, { q: 15, r: 15 }, 2);
    const result1 = combatManager.resolveDuel(knight1Id, opponent1.id);
    expect(result1!.rankUp).toBe(false);
    expect(combatManager.getCombatWins(knight1Id)).toBe(1);

    // Second duel — win #2 → rank up
    const opponent2 = gameState.spawnUnit(UnitType.Knight, { q: 15, r: 15 }, 2);
    const result2 = combatManager.resolveDuel(knight1Id, opponent2.id);
    expect(result2!.rankUp).toBe(true);

    const knight1 = gameState.getUnit(knight1Id)!;
    expect(knight1.knightRank).toBe(2); // was 1, now 2
    expect(combatManager.getCombatWins(knight1Id)).toBe(0); // reset after rank up
  });

  it('should cap rank at 5', () => {
    const { knight1Id } = setupWithKnights(gameState, knightManager);
    const knight1 = gameState.getUnit(knight1Id)!;
    knight1.knightRank = 5;

    combatManager.random = () => 0.01;

    // Win 2 duels — should NOT rank above 5
    const opp1 = gameState.spawnUnit(UnitType.Knight, { q: 15, r: 15 }, 2);
    combatManager.resolveDuel(knight1Id, opp1.id);

    const opp2 = gameState.spawnUnit(UnitType.Knight, { q: 15, r: 15 }, 2);
    const result = combatManager.resolveDuel(knight1Id, opp2.id);

    expect(knight1.knightRank).toBe(5);
    expect(result!.rankUp).toBe(false);
  });

  it('should return null for invalid units', () => {
    expect(combatManager.resolveDuel('nonexistent1', 'nonexistent2')).toBeNull();
  });

  it('should return null if unit is not a knight', () => {
    const serf = gameState.spawnUnit(UnitType.Builder, { q: 10, r: 10 }, 1);
    const { knight1Id } = setupWithKnights(gameState, knightManager);

    expect(combatManager.resolveDuel(serf.id, knight1Id)).toBeNull();
  });

  it('should account for gold bonus in combat probability', () => {
    // Place Castle for player 1 with gold
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 3, r: 3 }, 1);
    expect(castle.ok).toBe(true);
    if (castle.ok) {
      addToInventory(castle.building.outputInventory, ResourceType.GoldBars, 10); // +50% bonus
    }

    const { knight1Id, knight2Id } = setupWithKnights(gameState, knightManager);

    // Both rank 1: knight1 strength = 1 * 1.5 = 1.5, knight2 strength = 1 * 1.0 = 1.0
    // attackerWinProb = 1.5 / 2.5 = 0.6
    // Roll of 0.55 (< 0.6) → attacker should win
    combatManager.random = () => 0.55;

    const result = combatManager.resolveDuel(knight1Id, knight2Id);
    expect(result!.winnerId).toBe(knight1Id);
  });
});
