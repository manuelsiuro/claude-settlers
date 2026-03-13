import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { RoadNetwork, resetRoadNetworkIdCounters, getRoadNetworkIdCounters } from './RoadNetwork';
import { UnitManager } from './UnitManager';
import { ProductionManager } from './ProductionManager';
import { ConstructionManager } from './ConstructionManager';
import { TransporterManager } from './TransporterManager';
import { LogisticsManager } from './LogisticsManager';
import { TerritoryManager } from './TerritoryManager';
import { KnightManager } from './KnightManager';
import { CombatManager } from './CombatManager';
import { AttackManager } from './AttackManager';
import { VictoryManager } from './VictoryManager';
import { GeologistManager } from './GeologistManager';
import { TreeManager } from './TreeManager';
import { WoodcutterManager } from './WoodcutterManager';
import { ForesterManager } from './ForesterManager';
import { UpgradeManager } from './UpgradeManager';
import { AIPlayer } from './AIPlayer';
import { BuildingType } from './BuildingType';
import {
  BuildingState,
  initializeCastleResources,
  resetBuildingIdCounter,
  getBuildingIdCounter,
} from './Building';
import { ResourceType } from './ResourceType';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter, getUnitIdCounter } from './Unit';
import { Difficulty, DEFAULT_CONFIG } from './GameConfig';
import type { GameConfig } from './GameConfig';
import { serializeGame, deserializeGame } from './SaveLoad';
import type { SaveData } from './SaveLoad';

/** Create a small test grid with all grassland + some forest and a mountain */
function makeTestGrid(): HexGrid {
  const grid = new HexGrid(16, 16);
  for (let q = 0; q < 16; q++) {
    for (let r = 0; r < 16; r++) {
      grid.setTile(q, r, TerrainType.Grassland, 0.5);
    }
  }
  // Add some forest
  grid.setTile(5, 5, TerrainType.Forest, 0.5);
  // Add mountain for mining
  grid.setTile(6, 6, TerrainType.Mountain, 0.8);
  // Add water for fishing
  grid.setTile(7, 7, TerrainType.Water, 0.1);
  return grid;
}

function createManagers(gameState: GameState, roadNetwork: RoadNetwork, territoryManager: TerritoryManager) {
  const unitManager = new UnitManager(gameState);
  const productionManager = new ProductionManager(gameState);
  const constructionManager = new ConstructionManager(gameState);
  const transporterManager = new TransporterManager(gameState, roadNetwork);
  const logisticsManager = new LogisticsManager(gameState, roadNetwork);
  const knightManager = new KnightManager(gameState);
  const combatManager = new CombatManager(gameState, knightManager);
  const attackManager = new AttackManager(gameState, combatManager, territoryManager);
  const playerIds = [1, 2];
  const victoryManager = new VictoryManager(gameState, territoryManager, playerIds);
  const geologistManager = new GeologistManager(gameState);
  const treeManager = new TreeManager();
  const woodcutterManager = new WoodcutterManager(gameState, treeManager);
  const foresterManager = new ForesterManager(gameState, treeManager);

  return {
    unitManager,
    productionManager,
    constructionManager,
    transporterManager,
    logisticsManager,
    territoryManager,
    knightManager,
    combatManager,
    attackManager,
    victoryManager,
    geologistManager,
    treeManager,
    woodcutterManager,
    foresterManager,
    upgradeManager: new UpgradeManager(gameState),
  };
}

const testConfig: GameConfig = {
  ...DEFAULT_CONFIG,
  numPlayers: 2,
  seed: 42,
};

describe('SaveLoad: round-trip serialization', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let roadNetwork: RoadNetwork;
  let territoryManager: TerritoryManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    grid = makeTestGrid();
    gameState = new GameState(grid);
    roadNetwork = new RoadNetwork(grid);
    territoryManager = new TerritoryManager(gameState);
  });

  it('should round-trip empty game state', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);
    const data = serializeGame(
      testConfig,
      gameState,
      roadNetwork,
      managers,
      [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.version).toBe(4);
    expect(data.config).toEqual(testConfig);
    expect(data.buildings).toEqual([]);
    expect(data.units).toEqual([]);
    expect(data.flags).toEqual([]);
    expect(data.roads).toEqual([]);
  });

  it('should round-trip buildings with inventories', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Place a Castle with starting resources
    const castleResult = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    expect(castleResult.ok).toBe(true);
    if (castleResult.ok) {
      initializeCastleResources(castleResult.building);
    }

    // Place a Woodcutter (planned state)
    gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 9, r: 8 }, 1);

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.buildings.length).toBe(2);
    expect(data.buildings[0].type).toBe(BuildingType.Castle);
    expect(data.buildings[0].outputInventory['wood']).toBe(12);

    // Deserialize into fresh state
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    expect(gs2.getAllBuildings().length).toBe(2);
    const castle = gs2.getAllBuildings().find(b => b.type === BuildingType.Castle);
    expect(castle).toBeDefined();
    expect(castle!.outputInventory['wood']).toBe(12);
    expect(castle!.state).toBe(BuildingState.Active);

    const woodcutter = gs2.getAllBuildings().find(b => b.type === BuildingType.WoodcutterHut);
    expect(woodcutter).toBeDefined();
    expect(woodcutter!.state).toBe(BuildingState.Planned);
  });

  it('should round-trip units with paths and state', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Spawn a unit with a path
    const unit = gameState.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
    unit.state = UnitState.WalkingToWork;
    unit.path = [{ q: 4, r: 4 }, { q: 5, r: 4 }, { q: 6, r: 4 }];
    unit.pathIndex = 1;
    unit.moveProgress = 0.5;
    unit.assignedBuildingId = 'building_99';

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.units.length).toBe(1);

    // Deserialize
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    const restored = gs2.getAllUnits()[0];
    expect(restored.type).toBe(UnitType.Woodcutter);
    expect(restored.state).toBe(UnitState.WalkingToWork);
    expect(restored.path.length).toBe(3);
    expect(restored.pathIndex).toBe(1);
    expect(restored.moveProgress).toBe(0.5);
    expect(restored.assignedBuildingId).toBe('building_99');
  });

  it('should round-trip road network (flags, roads, goods)', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    const flagA = roadNetwork.placeFlag({ q: 3, r: 3 }, 1);
    const flagB = roadNetwork.placeFlag({ q: 4, r: 3 }, 1);
    expect(flagA).not.toBeNull();
    expect(flagB).not.toBeNull();

    const road = roadNetwork.connectFlags(flagA!.id, flagB!.id);
    expect(road).not.toBeNull();

    // Add a good at flagA
    flagA!.goods.push({ resource: ResourceType.Wood, destinationFlagId: flagB!.id });

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.flags.length).toBe(2);
    expect(data.roads.length).toBe(1);
    expect(data.flags[0].goods.length).toBe(1);

    // Deserialize
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    expect(rn2.getAllFlags().length).toBe(2);
    expect(rn2.getAllRoads().length).toBe(1);
    // Adjacency should be rebuilt
    expect(rn2.areConnected(flagA!.id, flagB!.id)).toBe(true);
    // Goods should be restored
    const restoredFlag = rn2.getFlag(flagA!.id);
    expect(restoredFlag!.goods.length).toBe(1);
    expect(restoredFlag!.goods[0].resource).toBe(ResourceType.Wood);
  });

  it('should round-trip ID counters to prevent collisions', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Create some entities to advance counters
    gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    gameState.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
    gameState.spawnUnit(UnitType.Builder, { q: 5, r: 4 }, 1);
    roadNetwork.placeFlag({ q: 3, r: 3 }, 1);
    roadNetwork.placeFlag({ q: 4, r: 3 }, 1);

    const savedBuildingId = getBuildingIdCounter();
    const savedUnitId = getUnitIdCounter();
    const savedCounters = getRoadNetworkIdCounters();

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.nextBuildingId).toBe(savedBuildingId);
    expect(data.nextUnitId).toBe(savedUnitId);
    expect(data.nextFlagId).toBe(savedCounters.nextFlagId);

    // Reset counters (simulating fresh process)
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();

    // Deserialize
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    // Counters should be restored
    expect(getBuildingIdCounter()).toBe(savedBuildingId);
    expect(getUnitIdCounter()).toBe(savedUnitId);
    expect(getRoadNetworkIdCounters().nextFlagId).toBe(savedCounters.nextFlagId);
  });

  it('should round-trip manager states (cooldowns, assignments)', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Place a castle and a building under construction with a builder assigned
    const castleResult = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    if (castleResult.ok) initializeCastleResources(castleResult.building);
    const wcResult = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 9, r: 8 }, 1);
    if (wcResult.ok) {
      wcResult.building.state = BuildingState.UnderConstruction;
    }

    // Simulate a few ticks to generate manager state
    for (let i = 0; i < 5; i++) {
      managers.unitManager.update(0.5);
      managers.constructionManager.update(0.5);
    }

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    // Verify construction manager state was saved
    expect(data.constructionManager.builderAssignments.length).toBeGreaterThan(0);

    // Deserialize
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    // Verify builder assignment was restored
    const restoredState = managers2.constructionManager._getState();
    expect(restoredState.builderAssignments.length).toBe(
      data.constructionManager.builderAssignments.length,
    );
  });

  it('should round-trip territory state', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Place a castle to generate territory
    gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    territoryManager.markDirty();
    territoryManager.update();

    const version = territoryManager.getVersion();
    expect(version).toBeGreaterThan(0);
    expect(territoryManager.isOwnedBy(8, 8, 1)).toBe(true);

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.territoryManager.territory.length).toBeGreaterThan(0);
    expect(data.territoryManager.version).toBe(version);

    // Deserialize
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    expect(tm2.getVersion()).toBe(version);
    expect(tm2.isOwnedBy(8, 8, 1)).toBe(true);
  });

  it('should round-trip combat manager wins', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Spawn a knight and give it a combat win
    const knight = gameState.spawnUnit(UnitType.Knight, { q: 4, r: 4 }, 1);
    knight.state = UnitState.Working;
    knight.knightRank = 2;

    // Manually record combat wins via a duel
    const enemy = gameState.spawnUnit(UnitType.Knight, { q: 5, r: 5 }, 2);
    enemy.state = UnitState.Working;
    managers.combatManager.random = () => 0.1; // attacker wins
    managers.combatManager.resolveDuel(knight.id, enemy.id);

    const winsAfterDuel = managers.combatManager.getCombatWins(knight.id);
    expect(winsAfterDuel).toBe(1);

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.combatManager.combatWins.length).toBe(1);

    // Deserialize
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    expect(managers2.combatManager.getCombatWins(knight.id)).toBe(winsAfterDuel);
  });

  it('should round-trip victory manager state (eliminations, game over)', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Simulate player 2 being eliminated
    managers.victoryManager._loadState({
      eliminatedPlayers: [2],
      gameOver: false,
      result: null,
      checkCooldown: 1.5,
    });

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.victoryManager.eliminatedPlayers).toEqual([2]);
    expect(data.victoryManager.gameOver).toBe(false);

    // Deserialize
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    expect(managers2.victoryManager.isEliminated(2)).toBe(true);
    expect(managers2.victoryManager.isGameOver()).toBe(false);
  });

  it('should round-trip AI player state', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Place castles for both players
    gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 12, r: 12 }, 2);
    gameState.territoryCheck = (q, r, pid) => territoryManager.isOwnedBy(q, r, pid);
    territoryManager.markDirty();
    territoryManager.update();

    // Create an AI player
    const ai = new AIPlayer(
      2, Difficulty.Normal, gameState, territoryManager,
      managers.attackManager, managers.knightManager, managers.upgradeManager, () => {},
    );
    // Simulate some decisions
    ai._setBuildOrderIndex(5);
    ai.update(10); // trigger decision

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [ai],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.aiPlayers.length).toBe(1);
    expect(data.aiPlayers[0].playerId).toBe(2);
    expect(data.aiPlayers[0].buildOrderIndex).toBeGreaterThanOrEqual(5);

    // Deserialize with a fresh AI
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);
    const ai2 = new AIPlayer(
      2, Difficulty.Normal, gs2, tm2,
      managers2.attackManager, managers2.knightManager, managers2.upgradeManager, () => {},
    );

    deserializeGame(data, gs2, rn2, managers2, [ai2]);

    expect(ai2.getBuildOrderIndex()).toBeGreaterThanOrEqual(5);
  });

  it('should round-trip worker assignments (workerByBuilding)', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Place castle + woodcutter
    const castleResult = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    if (castleResult.ok) initializeCastleResources(castleResult.building);
    const wcResult = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 9, r: 8 }, 1);
    expect(wcResult.ok).toBe(true);
    if (!wcResult.ok) return;

    // Activate woodcutter and assign a worker
    wcResult.building.state = BuildingState.Active;
    const worker = gameState.spawnUnit(UnitType.Woodcutter, { q: 9, r: 8 }, 1);
    worker.state = UnitState.Working;
    gameState.assignWorkerToBuilding(worker.id, wcResult.building.id);

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.workerByBuilding.length).toBe(1);

    // Deserialize
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    const restoredWorker = gs2.getWorkerForBuilding(wcResult.building.id);
    expect(restoredWorker).toBeDefined();
    expect(restoredWorker!.id).toBe(worker.id);
    expect(restoredWorker!.type).toBe(UnitType.Woodcutter);
  });

  it('should produce valid JSON (full serialization round-trip through JSON.parse)', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Set up a realistic game state
    gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 9, r: 8 }, 1);
    gameState.spawnUnit(UnitType.Woodcutter, { q: 9, r: 8 }, 1);
    roadNetwork.placeFlag({ q: 8, r: 8 }, 1);
    roadNetwork.placeFlag({ q: 9, r: 8 }, 1);
    const f1 = roadNetwork.getFlagAt(8, 8)!;
    const f2 = roadNetwork.getFlagAt(9, 8)!;
    roadNetwork.connectFlags(f1.id, f2.id);

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 20, y: 20, z: 20 }, target: { x: 0, y: 0, z: 0 } },
    );

    // Round-trip through JSON (simulates localStorage/file save)
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json) as SaveData;

    expect(parsed.version).toBe(4);
    expect(parsed.config.seed).toBe(42);
    expect(parsed.buildings.length).toBe(2);
    expect(parsed.units.length).toBe(1);
    expect(parsed.flags.length).toBe(2);
    expect(parsed.roads.length).toBe(1);
    expect(parsed.frustum).toBe(10);
    expect(parsed.cameraPosition.x).toBe(20);

    // Deserialize the JSON-parsed data
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(parsed, gs2, rn2, managers2, []);

    expect(gs2.getAllBuildings().length).toBe(2);
    expect(gs2.getAllUnits().length).toBe(1);
    expect(rn2.getAllFlags().length).toBe(2);
    expect(rn2.getAllRoads().length).toBe(1);
    expect(rn2.areConnected(f1.id, f2.id)).toBe(true);
  });

  it('should round-trip transporter state (carrying goods)', () => {
    const managers = createManagers(gameState, roadNetwork, territoryManager);

    // Set up flags and a road
    const flagA = roadNetwork.placeFlag({ q: 3, r: 3 }, 1)!;
    const flagB = roadNetwork.placeFlag({ q: 4, r: 3 }, 1)!;
    roadNetwork.connectFlags(flagA.id, flagB.id);

    // Let TransporterManager auto-spawn a transporter for the road
    managers.transporterManager.update(2);

    // Verify a transporter was created
    const stateBeforeSave = managers.transporterManager._getState();
    expect(stateBeforeSave.transporterStates.length).toBeGreaterThan(0);

    const data = serializeGame(
      testConfig, gameState, roadNetwork, managers, [],
      { frustum: 10, position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    );

    expect(data.transporterManager.transporterStates.length).toBeGreaterThan(0);

    // Deserialize
    const grid2 = makeTestGrid();
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const tm2 = new TerritoryManager(gs2);
    const managers2 = createManagers(gs2, rn2, tm2);

    deserializeGame(data, gs2, rn2, managers2, []);

    const restoredState = managers2.transporterManager._getState();
    expect(restoredState.transporterStates.length).toBe(
      data.transporterManager.transporterStates.length,
    );
  });
});
