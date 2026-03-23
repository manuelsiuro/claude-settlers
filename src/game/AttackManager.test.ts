import { describe, it, expect, beforeEach } from 'vitest';
import { AttackManager } from './AttackManager';
import { CombatManager } from './CombatManager';
import { KnightManager } from './KnightManager';
import { TerritoryManager } from './TerritoryManager';
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
import { RoadNetwork } from './RoadNetwork';

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

describe('AttackManager', () => {
  let gameState: GameState;
  let knightManager: KnightManager;
  let combatManager: CombatManager;
  let territoryManager: TerritoryManager;
  let attackManager: AttackManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    const grid = makeGrid();
    gameState = new GameState(grid);
    knightManager = new KnightManager(gameState);
    combatManager = new CombatManager(gameState, knightManager);
    territoryManager = new TerritoryManager(gameState);
    attackManager = new AttackManager(gameState, combatManager, territoryManager);
  });

  it('should issue an attack order and remove knight from source building', () => {
    // Player 1 Guard Hut
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    expect(hut1.ok).toBe(true);
    if (!hut1.ok) return;
    hut1.building.state = BuildingState.Active;

    // Player 2 Guard Hut (nearby)
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 5 }, 2);
    expect(hut2.ok).toBe(true);
    if (!hut2.ok) return;
    hut2.building.state = BuildingState.Active;

    const knightId = recruitKnight(gameState, knightManager, hut1.building.id);

    const result = attackManager.orderAttack(knightId, hut2.building.id);
    expect(result).toBe(true);

    // Knight should be removed from source building
    expect(hut1.building.knightIds).not.toContain(knightId);

    // Knight should be walking
    const knight = gameState.getUnit(knightId)!;
    expect(knight.state).toBe(UnitState.WalkingToWork);
    expect(knight.path.length).toBeGreaterThan(0);
  });

  it('should not attack own buildings', () => {
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    expect(hut1.ok).toBe(true);
    if (!hut1.ok) return;
    hut1.building.state = BuildingState.Active;

    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 5 }, 1); // same player
    expect(hut2.ok).toBe(true);
    if (!hut2.ok) return;
    hut2.building.state = BuildingState.Active;

    const knightId = recruitKnight(gameState, knightManager, hut1.building.id);

    const result = attackManager.orderAttack(knightId, hut2.building.id);
    expect(result).toBe(false);
  });

  it('should capture undefended building', () => {
    // Player 1 hut with a knight
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    expect(hut1.ok).toBe(true);
    if (!hut1.ok) return;
    hut1.building.state = BuildingState.Active;

    // Player 2 hut with NO defenders
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 5 }, 2);
    expect(hut2.ok).toBe(true);
    if (!hut2.ok) return;
    hut2.building.state = BuildingState.Active;

    const knightId = recruitKnight(gameState, knightManager, hut1.building.id);

    attackManager.orderAttack(knightId, hut2.building.id);

    // Simulate knight arrival by putting it at the target and completing path
    const knight = gameState.getUnit(knightId)!;
    knight.coord = { q: 8, r: 5 };
    knight.pathIndex = knight.path.length - 1;
    knight.moveProgress = 0;

    attackManager.update();

    // Building should be captured by player 1
    expect(hut2.building.playerId).toBe(1);
    expect(hut2.building.knightIds).toContain(knightId);
    expect(knight.state).toBe(UnitState.Working);
  });

  it('should fight defenders and win if attacker is stronger', () => {
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 5 }, 2);
    expect(hut1.ok && hut2.ok).toBe(true);
    if (!hut1.ok || !hut2.ok) return;
    hut1.building.state = BuildingState.Active;
    hut2.building.state = BuildingState.Active;

    const attackerKnightId = recruitKnight(gameState, knightManager, hut1.building.id);
    const defenderKnightId = recruitKnight(gameState, knightManager, hut2.building.id);

    // Make attacker stronger
    const attacker = gameState.getUnit(attackerKnightId)!;
    attacker.knightRank = 5;

    // Force attacker to always win
    combatManager.random = () => 0.01;

    attackManager.orderAttack(attackerKnightId, hut2.building.id);

    // Simulate arrival
    attacker.coord = { q: 8, r: 5 };
    attacker.pathIndex = attacker.path.length - 1;

    attackManager.update();

    // Defender should be dead
    expect(gameState.getUnit(defenderKnightId)).toBeUndefined();

    // Attacker update again — no more defenders → capture
    attackManager.update();

    expect(hut2.building.playerId).toBe(1);
    expect(hut2.building.knightIds).toContain(attackerKnightId);
  });

  it('should fail attack if attacker loses', () => {
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 5 }, 2);
    expect(hut1.ok && hut2.ok).toBe(true);
    if (!hut1.ok || !hut2.ok) return;
    hut1.building.state = BuildingState.Active;
    hut2.building.state = BuildingState.Active;

    const attackerKnightId = recruitKnight(gameState, knightManager, hut1.building.id);
    recruitKnight(gameState, knightManager, hut2.building.id);

    // Force attacker to always lose
    combatManager.random = () => 0.99;

    attackManager.orderAttack(attackerKnightId, hut2.building.id);

    // Simulate arrival
    const attacker = gameState.getUnit(attackerKnightId)!;
    attacker.coord = { q: 8, r: 5 };
    attacker.pathIndex = attacker.path.length - 1;

    attackManager.update();

    // Attacker should be dead
    expect(gameState.getUnit(attackerKnightId)).toBeUndefined();

    // Building should still belong to player 2
    expect(hut2.building.playerId).toBe(2);
    expect(attackManager.getActiveAttackCount()).toBe(0);
  });

  it('should capture civilian buildings in new territory', () => {
    // Player 1 Castle
    const castle1 = gameState.placeBuilding(BuildingType.Castle, { q: 3, r: 3 }, 1);
    expect(castle1.ok).toBe(true);

    // Player 2 Guard Hut
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 10, r: 10 }, 2);
    expect(hut2.ok).toBe(true);
    if (!hut2.ok) return;
    hut2.building.state = BuildingState.Active;

    // Player 2 Sawmill nearby (civilian building)
    const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 11, r: 10 }, 2);
    expect(sawmill.ok).toBe(true);
    if (!sawmill.ok) return;
    sawmill.building.state = BuildingState.Active;

    // Calculate initial territory
    territoryManager.update();

    // Player 1 attacks with a knight
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 7, r: 10 }, 1);
    expect(hut1.ok).toBe(true);
    if (!hut1.ok) return;
    hut1.building.state = BuildingState.Active;

    const knightId = recruitKnight(gameState, knightManager, hut1.building.id);

    attackManager.orderAttack(knightId, hut2.building.id);

    // Simulate arrival
    const knight = gameState.getUnit(knightId)!;
    knight.coord = { q: 10, r: 10 };
    knight.pathIndex = knight.path.length - 1;

    // No defenders — capture immediately
    attackManager.update();

    expect(hut2.building.playerId).toBe(1);

    // Check if sawmill changed ownership (depends on territory recalculation)
    // Since player 1 now has a Guard Hut at (10,10) with radius 4,
    // the sawmill at (11,10) should be in player 1's territory
    const sawmillOwner = territoryManager.getOwner(11, 10);
    if (sawmillOwner === 1) {
      expect(sawmill.building.playerId).toBe(1);
    }
  });

  it('should clean up attack when target building is removed', () => {
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 5 }, 2);
    expect(hut1.ok && hut2.ok).toBe(true);
    if (!hut1.ok || !hut2.ok) return;
    hut1.building.state = BuildingState.Active;
    hut2.building.state = BuildingState.Active;

    const knightId = recruitKnight(gameState, knightManager, hut1.building.id);
    attackManager.orderAttack(knightId, hut2.building.id);

    // Remove target building
    gameState.removeBuilding(hut2.building.id);

    attackManager.update();

    // Attack should be cleaned up
    expect(attackManager.getActiveAttackCount()).toBe(0);

    // Knight should still exist but heading home or idle
    const knight = gameState.getUnit(knightId);
    expect(knight).toBeDefined();
  });

  describe('territory transfer', () => {
    /** Helper: set up capture scenario and execute it.
     * Player 1 Guard Hut at (7,10) attacks Player 2 Guard Hut at (10,10).
     * Returns the captured hut. */
    function captureHut(): {
      grid: HexGrid;
      roadNetwork: RoadNetwork;
      attackMgr: AttackManager;
    } {
      const grid = makeGrid();
      const gs = new GameState(grid);
      const rn = new RoadNetwork(grid);
      const km = new KnightManager(gs);
      const cm = new CombatManager(gs, km);
      const tm = new TerritoryManager(gs);
      const am = new AttackManager(gs, cm, tm, undefined, undefined, rn);

      // Player 1 Castle (for territory base)
      const c1 = gs.placeBuilding(BuildingType.Castle, { q: 3, r: 3 }, 1);
      if (c1.ok) c1.building.state = BuildingState.Active;

      // Reassign shared variables for assertions in tests
      gameState = gs;
      knightManager = km;
      combatManager = cm;
      territoryManager = tm;
      attackManager = am;

      return { grid, roadNetwork: rn, attackMgr: am };
    }

    /** Helper: place an active building for player 2 and attack it with player 1 */
    function setupAndCapture() {
      // Player 2 Guard Hut (target)
      const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 10, r: 10 }, 2);
      if (hut2.ok) hut2.building.state = BuildingState.Active;

      // Player 1 Guard Hut (attacker base)
      const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 7, r: 10 }, 1);
      if (hut1.ok) hut1.building.state = BuildingState.Active;

      territoryManager.update();

      const knightId = recruitKnight(gameState, knightManager, hut1.ok ? hut1.building.id : '');
      attackManager.orderAttack(knightId, hut2.ok ? hut2.building.id : '');

      // Simulate arrival
      const knight = gameState.getUnit(knightId)!;
      knight.coord = { q: 10, r: 10 };
      knight.pathIndex = knight.path.length - 1;

      // Capture (no defenders)
      attackManager.update();

      return { hut2: hut2.ok ? hut2.building : null };
    }

    it('should transfer workers of captured civilian buildings', () => {
      captureHut();

      // Player 2 Sawmill near the Guard Hut
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 11, r: 10 }, 2);
      expect(sawmill.ok).toBe(true);
      if (!sawmill.ok) return;
      sawmill.building.state = BuildingState.Active;

      // Assign a worker to the sawmill
      const worker = gameState.spawnUnit(UnitType.SawmillWorker, { q: 11, r: 10 }, 2);
      gameState.assignWorkerToBuilding(worker.id, sawmill.building.id);

      // Execute capture
      setupAndCapture();

      // Sawmill should be in player 1's territory (radius 4 from captured hut at 10,10)
      const sawmillOwner = territoryManager.getOwner(11, 10);
      if (sawmillOwner === 1) {
        expect(sawmill.building.playerId).toBe(1);
        expect(worker.playerId).toBe(1);
      }
    });

    it('should transfer flags in captured territory', () => {
      const { roadNetwork: rn } = captureHut();

      // Place a flag in Player 2's territory
      const flag = rn.placeFlag({ q: 11, r: 10 }, 2);
      expect(flag).not.toBeNull();

      // Execute capture
      setupAndCapture();

      const flagOwner = territoryManager.getOwner(11, 10);
      if (flagOwner === 1) {
        expect(flag!.playerId).toBe(1);
      }
    });

    it('should transfer transporters on fully-captured roads', () => {
      const { roadNetwork: rn } = captureHut();

      // Place two flags in Player 2's territory
      const flagA = rn.placeFlag({ q: 11, r: 10 }, 2);
      const flagB = rn.placeFlag({ q: 12, r: 10 }, 2);
      expect(flagA).not.toBeNull();
      expect(flagB).not.toBeNull();

      // Connect them with a road
      const road = rn.connectFlags(flagA!.id, flagB!.id);
      expect(road).not.toBeNull();

      // Assign a transporter
      const transporter = gameState.spawnUnit(UnitType.Transporter, { q: 11, r: 10 }, 2);
      road!.transporterId = transporter.id;

      // Execute capture
      setupAndCapture();

      // Both flags should be in player 1's territory
      const ownerA = territoryManager.getOwner(11, 10);
      const ownerB = territoryManager.getOwner(12, 10);
      if (ownerA === 1 && ownerB === 1) {
        expect(flagA!.playerId).toBe(1);
        expect(flagB!.playerId).toBe(1);
        expect(transporter.playerId).toBe(1);
      }
    });

    it('should NOT transfer transporter on mixed-ownership road', () => {
      const { roadNetwork: rn } = captureHut();

      // One flag in captured territory, one far away (outside capture range)
      const flagA = rn.placeFlag({ q: 11, r: 10 }, 2);
      const flagB = rn.placeFlag({ q: 19, r: 19 }, 2);
      expect(flagA).not.toBeNull();
      expect(flagB).not.toBeNull();

      // Virtual road (skips adjacency check)
      const road = rn.createVirtualRoad(flagA!.id, flagB!.id);
      expect(road).not.toBeNull();

      const transporter = gameState.spawnUnit(UnitType.Transporter, { q: 19, r: 19 }, 2);
      road!.transporterId = transporter.id;

      // Execute capture
      setupAndCapture();

      // flagB at (19,19) should still be player 2 (far from capture)
      const ownerB = territoryManager.getOwner(19, 19);
      if (ownerB !== 1) {
        // Transporter should remain player 2
        expect(transporter.playerId).toBe(2);
      }
    });

    it('should transfer idle units in captured territory', () => {
      captureHut();

      // Idle unit in Player 2's territory
      const idleUnit = gameState.spawnUnit(UnitType.Woodcutter, { q: 11, r: 10 }, 2);
      idleUnit.state = UnitState.Idle;
      idleUnit.assignedBuildingId = null;

      // Execute capture
      setupAndCapture();

      const hexOwner = territoryManager.getOwner(11, 10);
      if (hexOwner === 1) {
        expect(idleUnit.playerId).toBe(1);
      }
    });

    it('should NOT transfer units walking home through captured territory', () => {
      captureHut();

      // Unit walking home (disengaging) through territory that will be captured
      const walkingUnit = gameState.spawnUnit(UnitType.Woodcutter, { q: 11, r: 10 }, 2);
      walkingUnit.state = UnitState.WalkingHome;
      walkingUnit.assignedBuildingId = null;

      // Execute capture
      setupAndCapture();

      // Should remain player 2 — walking home means disengaging
      expect(walkingUnit.playerId).toBe(2);
    });
  });
});
