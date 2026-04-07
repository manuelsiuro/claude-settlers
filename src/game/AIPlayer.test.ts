import { describe, it, expect, beforeEach } from 'vitest';
import { AIPlayer } from './AIPlayer';
import { GameState } from './GameState';
import { TerritoryManager } from './TerritoryManager';
import { AttackManager } from './AttackManager';
import { KnightManager } from './KnightManager';
import { CombatManager } from './CombatManager';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { BuildingType } from './BuildingType';
import {
  BuildingState,
  addToInventory,
  initializeCastleResources,
  resetBuildingIdCounter,
} from './Building';
import { ResourceType } from './ResourceType';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';
import { Difficulty } from './GameConfig';
import { UpgradeManager } from './UpgradeManager';
import { RoadNetwork } from './RoadNetwork';
import { PopulationManager } from './PopulationManager';
import { GameRng } from './GameRng';
import { CommandExecutor } from './CommandExecutor';
import { LogisticsManager } from './LogisticsManager';
import { ToolProductionManager } from './ToolProductionManager';
import { MarketplaceManager } from './MarketplaceManager';
import { DiplomacyManager } from './DiplomacyManager';
import type { Building } from './Building';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeGrid(width = 20, height = 20): HexGrid {
  const grid = new HexGrid(width, height);
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      grid.setTile(q, r, TerrainType.Grassland);
    }
  }
  return grid;
}

interface AISetup {
  ai: AIPlayer;
  placed: Building[];
  gameState: GameState;
  territoryManager: TerritoryManager;
  attackManager: AttackManager;
  knightManager: KnightManager;
}

function makeManagers(gameState: GameState): {
  territoryManager: TerritoryManager;
  knightManager: KnightManager;
  attackManager: AttackManager;
} {
  const territoryManager = new TerritoryManager(gameState);
  const knightManager = new KnightManager(gameState);
  const combatManager = new CombatManager(gameState, knightManager);
  const attackManager = new AttackManager(gameState, combatManager, territoryManager);
  gameState.territoryCheck = (q, r, pid) => territoryManager.isOwnedBy(q, r, pid);
  return { territoryManager, knightManager, attackManager };
}

function makeCommandExecutor(
  gameState: GameState,
  grid: HexGrid,
  roadNetwork: RoadNetwork,
  territoryManager: TerritoryManager,
  attackManager: AttackManager,
  upgradeManager: UpgradeManager,
): CommandExecutor {
  return new CommandExecutor({
    gameState,
    grid,
    roadNetwork,
    territoryManager,
    attackManager,
    upgradeManager,
    toolProductionManager: new ToolProductionManager(gameState),
    marketplaceManager: new MarketplaceManager(gameState),
    diplomacyManager: new DiplomacyManager(),
    logisticsManager: new LogisticsManager(gameState, roadNetwork),
  });
}

/** Place a Castle for the AI, initialize resources, update territory. */
function setupAI(
  gameState: GameState,
  territoryManager: TerritoryManager,
  attackManager: AttackManager,
  knightManager: KnightManager,
  playerId = 2,
  difficulty: Difficulty = Difficulty.Normal,
): AISetup {
  const result = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, playerId);
  if (!result.ok) throw new Error('Castle placement failed');
  initializeCastleResources(result.building);
  // Add extra resources so AI can afford its first several buildings
  addToInventory(result.building.outputInventory, ResourceType.Wood, 30);
  addToInventory(result.building.outputInventory, ResourceType.Stone, 20);
  addToInventory(result.building.outputInventory, ResourceType.Planks, 20);
  // Add individual tools for AI workers
  addToInventory(result.building.outputInventory, ResourceType.Axe, 5);
  addToInventory(result.building.outputInventory, ResourceType.Pickaxe, 5);
  addToInventory(result.building.outputInventory, ResourceType.Saw, 3);
  addToInventory(result.building.outputInventory, ResourceType.Scythe, 3);
  addToInventory(result.building.outputInventory, ResourceType.FishingRod, 3);
  addToInventory(result.building.outputInventory, ResourceType.Hammer, 5);
  addToInventory(result.building.outputInventory, ResourceType.Shovel, 3);
  addToInventory(result.building.outputInventory, ResourceType.Crucible, 3);
  addToInventory(result.building.outputInventory, ResourceType.RollingPin, 3);
  addToInventory(result.building.outputInventory, ResourceType.Cleaver, 3);
  addToInventory(result.building.outputInventory, ResourceType.Tongs, 3);
  territoryManager.markDirty(); // ensure territory is recalculated after Castle placement
  territoryManager.update();

  const placed: Building[] = [];
  const grid = gameState.getGrid();
  const roadNetwork = new RoadNetwork(grid);
  const upgradeManager = new UpgradeManager(gameState);
  const commandExecutor = makeCommandExecutor(gameState, grid, roadNetwork, territoryManager, attackManager, upgradeManager);
  const ai = new AIPlayer(
    playerId,
    difficulty,
    gameState,
    territoryManager,
    attackManager,
    knightManager,
    upgradeManager,
    roadNetwork,
    new PopulationManager(gameState),
    (building: Building) => placed.push(building),
    new GameRng(42),
    commandExecutor,
  );
  return { ai, placed, gameState, territoryManager, attackManager, knightManager };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AIPlayer', () => {
  let gameState: GameState;
  let territoryManager: TerritoryManager;
  let knightManager: KnightManager;
  let attackManager: AttackManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    const grid = makeGrid();
    gameState = new GameState(grid);
    ({ territoryManager, knightManager, attackManager } = makeManagers(gameState));
  });

  it('should report correct player ID', () => {
    const { ai } = setupAI(gameState, territoryManager, attackManager, knightManager, 3);
    expect(ai.getPlayerId()).toBe(3);
  });

  it('should have correct decision and attack intervals for each difficulty', () => {
    const g2 = new GameState(makeGrid());
    const m2 = makeManagers(g2);
    const { ai: easy } = setupAI(g2, m2.territoryManager, m2.attackManager, m2.knightManager, 2, Difficulty.Easy);

    const g3 = new GameState(makeGrid());
    const m3 = makeManagers(g3);
    const { ai: normal } = setupAI(g3, m3.territoryManager, m3.attackManager, m3.knightManager, 2, Difficulty.Normal);

    const g4 = new GameState(makeGrid());
    const m4 = makeManagers(g4);
    const { ai: hard } = setupAI(g4, m4.territoryManager, m4.attackManager, m4.knightManager, 2, Difficulty.Hard);

    expect(easy.decisionInterval).toBe(10.0);
    expect(normal.decisionInterval).toBe(5.0);
    expect(hard.decisionInterval).toBe(2.5);
    // Attack intervals scale with difficulty
    expect(easy.attackInterval).toBe(20.0);
    expect(normal.attackInterval).toBe(15.0);
    expect(hard.attackInterval).toBe(12.0);
  });

  it('should not build before the decision interval elapses', () => {
    const { ai, placed } = setupAI(gameState, territoryManager, attackManager, knightManager);
    // A tiny delta — nowhere near the decision interval
    ai.update(0.01);
    expect(placed.length).toBe(0);
  });

  it('should build the first building in the order (WoodcutterHut) when resources are available', () => {
    const { ai, placed } = setupAI(gameState, territoryManager, attackManager, knightManager);
    expect(ai.getBuildOrderIndex()).toBe(0);
    // Pass enough time to trigger a decision
    ai.update(20);
    expect(placed.length).toBeGreaterThan(0);
    expect(placed[0].type).toBe(BuildingType.WoodcutterHut);
  });

  it('should advance build order index after a successful placement', () => {
    const { ai } = setupAI(gameState, territoryManager, attackManager, knightManager);
    expect(ai.getBuildOrderIndex()).toBe(0);
    ai.update(20); // triggers decision → places WoodcutterHut
    expect(ai.getBuildOrderIndex()).toBe(1);
  });

  it('should not build if the AI cannot afford the next building', () => {
    // Empty Castle — no resources
    const result = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 2);
    if (!result.ok) throw new Error('Castle placement failed');
    // Do NOT add any resources
    territoryManager.update();

    const placed: Building[] = [];
    const grid = gameState.getGrid();
    const roadNetwork = new RoadNetwork(grid);
    const upgradeManager = new UpgradeManager(gameState);
    const commandExecutor = makeCommandExecutor(gameState, grid, roadNetwork, territoryManager, attackManager, upgradeManager);
    const ai = new AIPlayer(
      2,
      Difficulty.Normal,
      gameState,
      territoryManager,
      attackManager,
      knightManager,
      upgradeManager,
      roadNetwork,
      new PopulationManager(gameState),
      (b: Building) => placed.push(b),
      new GameRng(42),
      commandExecutor,
    );

    ai.update(20);
    // WoodcutterHut costs 2 wood — should not build
    expect(placed.length).toBe(0);
    expect(ai.getBuildOrderIndex()).toBe(0);
  });

  it('should skip a building after MAX_HEX_RETRIES consecutive failures to find a valid hex', () => {
    // Build a map where territory exists but no valid placement hex for WoodcutterHut
    // (all territory hexes occupied or wrong terrain — we'll use a 1-grassland + all-water grid)
    const tinyGrid = new HexGrid(5, 5);
    for (let q = 0; q < 5; q++) {
      for (let r = 0; r < 5; r++) {
        tinyGrid.setTile(q, r, TerrainType.Water);
      }
    }
    // Only the Castle hex is grassland
    tinyGrid.setTile(2, 2, TerrainType.Grassland);

    const tinyState = new GameState(tinyGrid);
    const tinyManagers = makeManagers(tinyState);

    const castle = tinyState.placeBuilding(BuildingType.Castle, { q: 2, r: 2 }, 2);
    if (!castle.ok) throw new Error('Castle placement failed');
    initializeCastleResources(castle.building);
    addToInventory(castle.building.outputInventory, ResourceType.Wood, 30);
    tinyManagers.territoryManager.update();

    const placed: Building[] = [];
    const tinyRoadNetwork = new RoadNetwork(tinyGrid);
    const tinyUpgradeManager = new UpgradeManager(tinyState);
    const tinyCommandExecutor = makeCommandExecutor(tinyState, tinyGrid, tinyRoadNetwork, tinyManagers.territoryManager, tinyManagers.attackManager, tinyUpgradeManager);
    const ai = new AIPlayer(
      2,
      Difficulty.Normal,
      tinyState,
      tinyManagers.territoryManager,
      tinyManagers.attackManager,
      tinyManagers.knightManager,
      tinyUpgradeManager,
      tinyRoadNetwork,
      new PopulationManager(tinyState),
      (b: Building) => placed.push(b),
      new GameRng(42),
      tinyCommandExecutor,
    );

    // Territory has only the Castle hex (all water neighbors are blocked from expansion).
    // WoodcutterHut can't go there (tile_occupied). So each decision returns null.
    // After 3 retries the first build order item is skipped (index → 1).
    ai.update(20); // retry 1
    ai.update(20); // retry 2
    ai.update(20); // retry 3 → skip, index = 1
    expect(ai.getBuildOrderIndex()).toBe(1);
  });

  it('should place buildings owned by the correct player', () => {
    const { ai, placed } = setupAI(gameState, territoryManager, attackManager, knightManager, 2);
    ai.update(20);
    for (const b of placed) {
      expect(b.playerId).toBe(2);
    }
  });

  it('should not attack before build order step 12', () => {
    const { ai } = setupAI(gameState, territoryManager, attackManager, knightManager, 2);

    // Set up a player 1 Castle + Guard Hut as attack target
    const p1Castle = gameState.placeBuilding(BuildingType.Castle, { q: 2, r: 2 }, 1);
    if (!p1Castle.ok) throw new Error();
    territoryManager.markDirty();
    territoryManager.update(); // establish player 1's territory before placing the Guard Hut
    const p1Hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 3, r: 3 }, 1);
    if (!p1Hut.ok) throw new Error();
    p1Hut.building.state = BuildingState.Active;

    // Spawn an AI knight (stationed = Working)
    const knight = gameState.spawnUnit(UnitType.Knight, { q: 10, r: 11 }, 2);
    knight.state = UnitState.Working;

    // Build order is at 0 — no attacks should be issued
    expect(ai.getBuildOrderIndex()).toBe(0);
    // Pass time to trigger attack cooldown (attackCooldown starts at 9.0s = 15.0 * 0.6)
    ai.update(16); // triggers attack check
    expect(attackManager.getActiveAttackCount()).toBe(0);
  });

  it('should order an attack when build order is past step 12 and a knight is available', () => {
    const { ai } = setupAI(gameState, territoryManager, attackManager, knightManager, 2);

    // Enemy military building for player 1
    const p1Castle = gameState.placeBuilding(BuildingType.Castle, { q: 2, r: 2 }, 1);
    if (!p1Castle.ok) throw new Error();
    territoryManager.markDirty();
    territoryManager.update();
    const p1Hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 3, r: 3 }, 1);
    if (!p1Hut.ok) throw new Error();
    p1Hut.building.state = BuildingState.Active;

    // Spawn AI knight stationed at a military building
    const knight = gameState.spawnUnit(UnitType.Knight, { q: 10, r: 11 }, 2);
    knight.state = UnitState.Working;

    // Force build order past step 12 to unlock attack logic
    ai._setBuildOrderIndex(12);

    // Reset attack cooldown so it fires on the next update
    // (pass > attackInterval seconds so the first cooldown fires)
    ai.update(16); // triggers attack cooldown expiry (attackCooldown starts at 9.0s = 15.0 * 0.6)
    expect(attackManager.getActiveAttackCount()).toBe(1);
  });

  it('should target the weakest enemy building (fewest defending knights)', () => {
    const { ai } = setupAI(gameState, territoryManager, attackManager, knightManager, 2);

    // Player 1: one strong building (full 3 knights) and one weak building (no knights)
    const p1Castle = gameState.placeBuilding(BuildingType.Castle, { q: 2, r: 2 }, 1);
    if (!p1Castle.ok) throw new Error();
    // Give Castle fake knight IDs so it's not the weakest target
    p1Castle.building.knightIds = ['k_c1', 'k_c2'];
    territoryManager.markDirty();
    territoryManager.update();

    const strongHut = gameState.placeBuilding(BuildingType.GuardHut, { q: 3, r: 3 }, 1);
    if (!strongHut.ok) throw new Error();
    strongHut.building.state = BuildingState.Active;
    // Give it 3 fake knight IDs to simulate full occupancy
    strongHut.building.knightIds = ['k_dummy1', 'k_dummy2', 'k_dummy3'];

    const weakHut = gameState.placeBuilding(BuildingType.GuardHut, { q: 4, r: 4 }, 1);
    if (!weakHut.ok) throw new Error();
    weakHut.building.state = BuildingState.Active;
    // No knights in weakHut — this is the weakest target

    // AI knight stationed
    const knight = gameState.spawnUnit(UnitType.Knight, { q: 10, r: 11 }, 2);
    knight.state = UnitState.Working;

    ai._setBuildOrderIndex(12);
    ai.update(16);

    expect(attackManager.getActiveAttackCount()).toBe(1);
    // The attacking knight should be heading to weakHut (assignedBuildingId = weakHut.id)
    const updatedKnight = gameState.getUnit(knight.id)!;
    expect(updatedKnight.assignedBuildingId).toBe(weakHut.building.id);
  });

  it('should place multiple buildings as the economy grows', () => {
    const { ai, placed } = setupAI(gameState, territoryManager, attackManager, knightManager);
    // Trigger several decisions
    for (let i = 0; i < 5; i++) {
      ai.update(20);
    }
    expect(placed.length).toBeGreaterThanOrEqual(3);
  });

  it('should prefer military buildings over the Castle when attacking', () => {
    const { ai } = setupAI(gameState, territoryManager, attackManager, knightManager, 2);

    // Player 1: Castle (0 knights — always the "weakest" naive pick) + Guard Hut (0 knights)
    const p1Castle = gameState.placeBuilding(BuildingType.Castle, { q: 2, r: 2 }, 1);
    if (!p1Castle.ok) throw new Error();
    territoryManager.markDirty();
    territoryManager.update();

    const p1Hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 3, r: 3 }, 1);
    if (!p1Hut.ok) throw new Error();
    p1Hut.building.state = BuildingState.Active;
    // Guard Hut also has 0 knights

    const knight = gameState.spawnUnit(UnitType.Knight, { q: 10, r: 11 }, 2);
    knight.state = UnitState.Working;

    ai._setBuildOrderIndex(12);
    ai.update(16);

    expect(attackManager.getActiveAttackCount()).toBe(1);
    // Must target the GuardHut, NOT the Castle (Castle is 0-knight but must be deprioritized)
    const updatedKnight = gameState.getUnit(knight.id)!;
    expect(updatedKnight.assignedBuildingId).toBe(p1Hut.building.id);
  });

  it('should not re-order a knight that is already in combat (assigned to enemy building)', () => {
    const { ai } = setupAI(gameState, territoryManager, attackManager, knightManager, 2);

    const p1Castle = gameState.placeBuilding(BuildingType.Castle, { q: 2, r: 2 }, 1);
    if (!p1Castle.ok) throw new Error();
    territoryManager.markDirty();
    territoryManager.update();
    const p1Hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 3, r: 3 }, 1);
    if (!p1Hut1.ok) throw new Error();
    p1Hut1.building.state = BuildingState.Active;
    const p1Hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 4, r: 4 }, 1);
    if (!p1Hut2.ok) throw new Error();
    p1Hut2.building.state = BuildingState.Active;

    // Simulate a knight that has arrived at an enemy building mid-combat:
    // state=Working but assignedBuildingId points to an enemy-owned building.
    const knight = gameState.spawnUnit(UnitType.Knight, { q: 3, r: 3 }, 2);
    knight.state = UnitState.Working;
    knight.assignedBuildingId = p1Hut1.building.id; // enemy building — knight is fighting there

    ai._setBuildOrderIndex(12);
    ai.update(16); // triggers attack check

    // The mid-combat knight must NOT receive a second attack order
    expect(attackManager.getActiveAttackCount()).toBe(0);
    // The enemy building's knightIds must be intact (not corrupted by a bad orderAttack call)
    expect(p1Hut1.building.knightIds).toEqual([]);
  });

  it('should place military buildings (GuardHut) at territory border hexes', () => {
    const { ai, placed } = setupAI(gameState, territoryManager, attackManager, knightManager);

    // Jump straight to GuardHut in the build order (avoids FishermanHut water-adjacency
    // skip logic that would consume several decision ticks on an all-grassland map).
    // GuardHut is at index 7 in balanced build order (after SmallHouse was inserted at 5).
    ai._setBuildOrderIndex(7);

    // Snapshot territory before the placement
    const territorySnapshot = new Set(
      territoryManager.getPlayerTerritory(2).map((c) => `${c.q},${c.r}`),
    );

    ai.update(20); // places GuardHut (index 7)

    const guardHut = placed.find((b) => b.type === BuildingType.GuardHut);
    expect(guardHut).toBeDefined();

    // GuardHut must be placed at a tile that had at least one non-owned neighbor
    const grid = gameState.getGrid();
    const neighbors = grid.getNeighbors(guardHut!.coord.q, guardHut!.coord.r);
    const hasBorderNeighbor = neighbors.some((n) => !territorySnapshot.has(`${n.coord.q},${n.coord.r}`));
    expect(hasBorderNeighbor).toBe(true);
  });

  it('should not skip a building due to can-afford waits consuming retry budget', () => {
    // The AI starts with NO resources, so canAfford always fails.
    // hexRetryCount should stay at 0. Then when resources arrive, placement should work.
    const result = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 2);
    if (!result.ok) throw new Error('Castle placement failed');
    territoryManager.markDirty();
    territoryManager.update();

    const placed: Building[] = [];
    const grid = gameState.getGrid();
    const roadNetwork = new RoadNetwork(grid);
    const upgradeManager = new UpgradeManager(gameState);
    const commandExecutor = makeCommandExecutor(gameState, grid, roadNetwork, territoryManager, attackManager, upgradeManager);
    const ai = new AIPlayer(
      2,
      Difficulty.Normal,
      gameState,
      territoryManager,
      attackManager,
      knightManager,
      upgradeManager,
      roadNetwork,
      new PopulationManager(gameState),
      (b: Building) => placed.push(b),
      new GameRng(42),
      commandExecutor,
    );

    // 3 ticks with no resources — should NOT advance the index via skip logic
    ai.update(20);
    ai.update(20);
    ai.update(20);
    expect(ai.getBuildOrderIndex()).toBe(0); // still at 0, not skipped

    // Now give resources — next decision should successfully place
    addToInventory(result.building.outputInventory, ResourceType.Wood, 10);
    ai.update(20);
    expect(placed.length).toBe(1); // placed WoodcutterHut
    expect(ai.getBuildOrderIndex()).toBe(1);
  });
});
