/**
 * Determinism verification tests for multiplayer lockstep.
 *
 * Two headless simulations with the same seed and commands
 * must produce byte-identical serialized state.
 */
import { describe, test, expect } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { resetBuildingIdCounter, initializeCastleResources, addToInventory } from './Building';
import { resetUnitIdCounter } from './Unit';
import { resetRoadNetworkIdCounters } from './RoadNetwork';
import { BuildingType } from './BuildingType';
import { ResourceType } from './ResourceType';
import { Difficulty } from './GameConfig';
import { GameRng } from './GameRng';
import { CommandExecutor } from './CommandExecutor';
import { createManagers } from '../engine/GameSystems';
import type { GameManagers } from '../engine/GameSystems';
import { serializeGame } from './SaveLoad';
import { AIPlayer } from './AIPlayer';
import { resetTreeIdCounter } from './TreeManager';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeGrid(width = 20, height = 20): HexGrid {
  const grid = new HexGrid(width, height);
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const tile = grid.getTile(q, r);
      if (tile) {
        // Water border, grass interior, some forest
        if (q === 0 || r === 0 || q === width - 1 || r === height - 1) {
          tile.terrain = TerrainType.Water;
        } else if ((q + r) % 5 === 0) {
          tile.terrain = TerrainType.Forest;
        } else {
          tile.terrain = TerrainType.Grassland;
        }
      }
    }
  }
  return grid;
}

interface HeadlessSim {
  gameState: GameState;
  managers: GameManagers;
  executor: CommandExecutor;
  gameRng: GameRng;
  aiPlayers: AIPlayer[];
  tick: (dt: number) => void;
  serialize: () => string;
}

function createHeadlessSim(seed: number, opts?: { withAI?: boolean }): HeadlessSim {
  // Reset all ID counters so both sims start identically
  resetBuildingIdCounter();
  resetUnitIdCounter();
  resetRoadNetworkIdCounters();
  resetTreeIdCounter();

  const grid = makeGrid();
  const gameState = new GameState(grid);
  const gameRng = new GameRng(seed);

  const config = {
    seed,
    mapSize: 20,
    numPlayers: opts?.withAI ? 2 : 1,
    difficulty: Difficulty.Normal,
    scenario: 'default' as const,
  };

  const managers = createManagers({
    gameState,
    grid,
    config,
    humanPlayerId: 1,
    gameRng,
    getElevation: () => 0, // headless: flat terrain
  });

  const executor = new CommandExecutor({
    gameState,
    roadNetwork: managers.roadNetwork,
    grid,
    territoryManager: managers.territoryManager,
    attackManager: managers.attackManager,
    upgradeManager: managers.upgradeManager,
    toolProductionManager: managers.toolProductionManager,
    marketplaceManager: managers.marketplaceManager,
    diplomacyManager: managers.diplomacyManager,
    logisticsManager: managers.logisticsManager,
  });

  // Place castle for player 1
  gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
  const castle1 = gameState.findCastle(1);
  if (castle1) initializeCastleResources(castle1);

  const aiPlayers: AIPlayer[] = [];
  if (opts?.withAI) {
    // Place castle for player 2
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 5 }, 2);
    const castle2 = gameState.findCastle(2);
    if (castle2) {
      initializeCastleResources(castle2);
      addToInventory(castle2.outputInventory, ResourceType.Wood, 20);
      addToInventory(castle2.outputInventory, ResourceType.Stone, 10);
    }

    gameState.territoryCheck = (q, r, pid) => managers.territoryManager.isOwnedBy(q, r, pid);
    managers.territoryManager.markDirty();
    managers.territoryManager.update();

    const ai = new AIPlayer(
      2,
      Difficulty.Normal,
      gameState,
      managers.territoryManager,
      managers.attackManager,
      managers.knightManager,
      managers.upgradeManager,
      managers.roadNetwork,
      managers.populationManager,
      () => {}, // no renderer in headless
      gameRng,
      executor,
    );
    ai.setMarketplaceManager(managers.marketplaceManager);
    ai.setDiplomacyManager(managers.diplomacyManager);
    aiPlayers.push(ai);
  }

  managers.territoryManager.markDirty();
  managers.territoryManager.update();

  // Initialize trees on forest tiles
  managers.treeManager.initializeFromMap(grid);

  function tick(dt: number): void {
    managers.territoryManager.update();
    managers.unitManager.update(dt);
    managers.constructionManager.update(dt);
    managers.upgradeManager.update(dt);
    managers.productionManager.update(dt);
    managers.toolProductionManager.update(dt);
    managers.geologistManager.update(dt);
    managers.treeManager.update(dt);
    managers.woodcutterManager.update(dt);
    managers.terrainGatheringManager.update(dt);
    managers.foresterManager.update(dt);
    managers.logisticsManager.update(dt);
    managers.harborManager.update(dt);
    managers.transporterManager.update(dt);
    managers.knightManager.update(dt);
    managers.attackManager.update(dt);
    managers.combatManager.cleanupStaleData();
    managers.victoryManager.update(dt);
    for (const ai of aiPlayers) {
      ai.update(dt);
    }
    managers.feedingManager.update(dt);
    managers.moraleManager.update(dt);
    managers.marketplaceManager.update(dt);
    managers.animalLifecycleManager.update(dt);
    managers.economyTracker.update(dt);
    managers.dashboardTracker.update(dt);
    managers.randomEventManager.update(dt);
    managers.fogOfWarManager.markDirty();
    managers.fogOfWarManager.update();
  }

  function serialize(): string {
    const data = serializeGame(
      config,
      gameState,
      managers.roadNetwork,
      managers,
      aiPlayers,
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
      undefined,
      { rngState: gameRng.getState(), accumulator: 0 },
    );
    // Strip non-deterministic timestamp for comparison
    data.timestamp = 0;
    return JSON.stringify(data);
  }

  return { gameState, managers, executor, gameRng, aiPlayers, tick, serialize };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('Determinism', () => {
  test('two simulations with same seed produce identical state (no commands)', () => {
    const TICKS = 100;
    const FIXED_STEP = 0.05;

    // Reset counters before first sim
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    resetTreeIdCounter();
    const sim1 = createHeadlessSim(42);

    // Reset counters before second sim
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    resetTreeIdCounter();
    const sim2 = createHeadlessSim(42);

    for (let i = 0; i < TICKS; i++) {
      sim1.tick(FIXED_STEP);
      sim2.tick(FIXED_STEP);
    }

    expect(sim1.serialize()).toBe(sim2.serialize());
  });

  test('two simulations with same seed + same commands produce identical state', () => {
    const FIXED_STEP = 0.05;

    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    resetTreeIdCounter();
    const sim1 = createHeadlessSim(123);

    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    resetTreeIdCounter();
    const sim2 = createHeadlessSim(123);

    // Run 20 ticks
    for (let i = 0; i < 20; i++) {
      sim1.tick(FIXED_STEP);
      sim2.tick(FIXED_STEP);
    }

    // Execute same commands on both
    const cmd = {
      type: 'PlaceBuilding' as const,
      playerId: 1,
      buildingType: BuildingType.WoodcutterHut,
      coord: { q: 9, r: 10 },
    };
    sim1.executor.execute(cmd);
    sim2.executor.execute(cmd);

    // Run 80 more ticks
    for (let i = 0; i < 80; i++) {
      sim1.tick(FIXED_STEP);
      sim2.tick(FIXED_STEP);
    }

    expect(sim1.serialize()).toBe(sim2.serialize());
  });

  test('different seeds produce different state', () => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    resetTreeIdCounter();
    const sim1 = createHeadlessSim(42);

    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    resetTreeIdCounter();
    const sim2 = createHeadlessSim(99);

    for (let i = 0; i < 50; i++) {
      sim1.tick(0.05);
      sim2.tick(0.05);
    }

    // States should differ (different RNG sequences for random events, etc.)
    // Note: they might match if no randomness is consumed in 50 ticks,
    // but with RandomEventManager consuming RNG at construction, they will differ.
    expect(sim1.serialize()).not.toBe(sim2.serialize());
  });

  test('GameRng state is preserved through save/load cycle', () => {
    const rng = new GameRng(777);
    // Advance 100 steps
    for (let i = 0; i < 100; i++) rng.next();
    const state = rng.getState();

    // Capture next 50 values
    const expected: number[] = [];
    for (let i = 0; i < 50; i++) expected.push(rng.next());

    // Simulate save/load
    const restored = new GameRng(0);
    restored.setState(state);
    for (let i = 0; i < 50; i++) {
      expect(restored.next()).toBe(expected[i]);
    }
  });

  test('two simulations with AI produce identical state', () => {
    const TICKS = 50;
    const FIXED_STEP = 0.05;

    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    resetTreeIdCounter();
    const sim1 = createHeadlessSim(42, { withAI: true });

    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    resetTreeIdCounter();
    const sim2 = createHeadlessSim(42, { withAI: true });

    for (let i = 0; i < TICKS; i++) {
      sim1.tick(FIXED_STEP);
      sim2.tick(FIXED_STEP);
    }

    expect(sim1.serialize()).toBe(sim2.serialize());
  });
});
