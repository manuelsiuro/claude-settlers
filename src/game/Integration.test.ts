import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { RoadNetwork, resetRoadNetworkIdCounters } from './RoadNetwork';
import { UnitManager } from './UnitManager';
import { ProductionManager } from './ProductionManager';
import { ConstructionManager } from './ConstructionManager';
import { TransporterManager } from './TransporterManager';
import { LogisticsManager } from './LogisticsManager';
import { TerritoryManager } from './TerritoryManager';
import { KnightManager } from './KnightManager';
import { CombatManager } from './CombatManager';
import { AttackManager } from './AttackManager';
import { BuildingType } from './BuildingType';
import { BuildingState, initializeCastleResources, resetBuildingIdCounter, addToInventory } from './Building';
import { ResourceType } from './ResourceType';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';

describe('Integration: Full Production Chain', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let roadNetwork: RoadNetwork;
  let unitManager: UnitManager;
  let productionManager: ProductionManager;
  let constructionManager: ConstructionManager;
  let transporterManager: TransporterManager;
  let logisticsManager: LogisticsManager;

  /** Run one full game tick through all managers */
  function tick(dt: number) {
    unitManager.update(dt);
    constructionManager.update(dt);
    productionManager.update(dt);
    logisticsManager.update(dt);
    transporterManager.update(dt);
  }

  /** Run many small ticks to simulate time */
  function simulate(seconds: number, stepSize = 0.5) {
    const steps = Math.ceil(seconds / stepSize);
    for (let i = 0; i < steps; i++) {
      tick(stepSize);
    }
  }

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();

    grid = new HexGrid(16, 16);
    for (let q = 0; q < 16; q++) {
      for (let r = 0; r < 16; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }

    gameState = new GameState(grid);
    roadNetwork = new RoadNetwork(grid);
    unitManager = new UnitManager(gameState);
    productionManager = new ProductionManager(gameState);
    constructionManager = new ConstructionManager(gameState);
    transporterManager = new TransporterManager(gameState, roadNetwork);
    logisticsManager = new LogisticsManager(gameState, roadNetwork);
  });

  it('should transport Wood from Woodcutter to Sawmill', () => {
    // Set up Castle at (8,8)
    const castleResult = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    expect(castleResult.ok).toBe(true);
    if (!castleResult.ok) return;
    initializeCastleResources(castleResult.building);

    // Place Woodcutter at (4,4) — already active with worker for simplicity
    const wcResult = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
    expect(wcResult.ok).toBe(true);
    if (!wcResult.ok) return;
    wcResult.building.state = BuildingState.Active;
    wcResult.building.hasWorker = true;

    // Spawn and assign a worker manually
    const worker = gameState.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
    worker.state = UnitState.Working;
    gameState.assignWorkerToBuilding(worker.id, wcResult.building.id);

    // Place Sawmill at (6,4) — already active with worker
    const smResult = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);
    expect(smResult.ok).toBe(true);
    if (!smResult.ok) return;
    smResult.building.state = BuildingState.Active;
    smResult.building.hasWorker = true;

    const smWorker = gameState.spawnUnit(UnitType.SawmillWorker, { q: 6, r: 4 }, 1);
    smWorker.state = UnitState.Working;
    gameState.assignWorkerToBuilding(smWorker.id, smResult.building.id);

    // Run logistics once to create flags for buildings
    logisticsManager.update(1.0);

    // Connect flags with road: wc(4,4) — (5,4) — sawmill(6,4)
    const f1 = roadNetwork.getFlagAt(4, 4)!;
    const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
    const f3 = roadNetwork.getFlagAt(6, 4)!;
    expect(f1).toBeDefined();
    expect(f3).toBeDefined();
    roadNetwork.connectFlags(f1.id, f2.id);
    roadNetwork.connectFlags(f2.id, f3.id);

    // Simulate until woodcutter produces Wood (15s production time)
    simulate(20);

    // Woodcutter should have produced at least 1 Wood
    // It may be in outputInventory, at a flag, in transit, or already at sawmill
    const wcOutput = wcResult.building.outputInventory[ResourceType.Wood] ?? 0;
    const flagGoods = f1.goods.filter((g) => g.resource === ResourceType.Wood).length
      + f2.goods.filter((g) => g.resource === ResourceType.Wood).length
      + f3.goods.filter((g) => g.resource === ResourceType.Wood).length;
    const transporters = gameState.getAllUnits().filter((u) => u.type === UnitType.Transporter);
    const carrying = transporters.filter((u) => u.carryingResource === ResourceType.Wood).length;
    const smInput = smResult.building.inputInventory[ResourceType.Wood] ?? 0;

    const totalWood = wcOutput + flagGoods + carrying + smInput;
    expect(totalWood).toBeGreaterThanOrEqual(1);
  });

  it('should complete full chain: Wood → Sawmill → Planks', () => {
    // Place Woodcutter and Sawmill, both active with workers
    const wcResult = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
    const smResult = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);
    if (!wcResult.ok || !smResult.ok) throw new Error('Placement failed');

    wcResult.building.state = BuildingState.Active;
    smResult.building.state = BuildingState.Active;

    const wcWorker = gameState.spawnUnit(UnitType.Woodcutter, { q: 4, r: 4 }, 1);
    wcWorker.state = UnitState.Working;
    gameState.assignWorkerToBuilding(wcWorker.id, wcResult.building.id);

    const smWorker = gameState.spawnUnit(UnitType.SawmillWorker, { q: 6, r: 4 }, 1);
    smWorker.state = UnitState.Working;
    gameState.assignWorkerToBuilding(smWorker.id, smResult.building.id);

    // Create road
    logisticsManager.update(1.0);
    const f1 = roadNetwork.getFlagAt(4, 4)!;
    const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
    const f3 = roadNetwork.getFlagAt(6, 4)!;
    roadNetwork.connectFlags(f1.id, f2.id);
    roadNetwork.connectFlags(f2.id, f3.id);

    // Simulate long enough for: produce Wood (15s) + transport + produce Planks (12s)
    simulate(60);

    // Sawmill should have received Wood and produced Planks
    const planksOutput = smResult.building.outputInventory[ResourceType.Planks] ?? 0;
    const planksAnywhere = planksOutput
      + (f3.goods.filter((g) => g.resource === ResourceType.Planks).length);

    expect(planksAnywhere).toBeGreaterThanOrEqual(1);
  });

  it('should construct a building through resource delivery', () => {
    // Castle with starting resources
    const castleResult = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    if (!castleResult.ok) throw new Error('Castle placement failed');
    initializeCastleResources(castleResult.building);

    // Place a Woodcutter (costs 2 Wood to construct)
    const wcResult = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 9, r: 8 }, 1);
    if (!wcResult.ok) throw new Error('Woodcutter placement failed');

    expect(wcResult.building.state).toBe(BuildingState.Planned);

    // Simulate construction process
    simulate(60);

    // Building should be fully constructed
    expect(wcResult.building.state).toBe(BuildingState.Active);
  });

  it('should spawn transporters for roads connecting buildings', () => {
    gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
    gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);

    logisticsManager.update(1.0); // Auto-create flags

    const f1 = roadNetwork.getFlagAt(4, 4)!;
    const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
    const f3 = roadNetwork.getFlagAt(6, 4)!;
    roadNetwork.connectFlags(f1.id, f2.id);
    roadNetwork.connectFlags(f2.id, f3.id);

    // Let transporters spawn
    simulate(5);

    const transporters = gameState.getAllUnits().filter((u) => u.type === UnitType.Transporter);
    expect(transporters).toHaveLength(2); // One per road segment
  });
});

describe('Integration: Territory & Military', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let territoryManager: TerritoryManager;
  let knightManager: KnightManager;
  let combatManager: CombatManager;
  let attackManager: AttackManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();

    grid = new HexGrid(20, 20);
    for (let q = 0; q < 20; q++) {
      for (let r = 0; r < 20; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }

    gameState = new GameState(grid);
    territoryManager = new TerritoryManager(gameState);
    knightManager = new KnightManager(gameState);
    combatManager = new CombatManager(gameState, knightManager);
    attackManager = new AttackManager(gameState, combatManager, territoryManager);
  });

  it('should recruit knight when Sword+Shield delivered to Guard Hut', () => {
    // Place Castle + Guard Hut
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);

    const hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 12, r: 10 }, 1);
    expect(hut.ok).toBe(true);
    if (!hut.ok) return;
    hut.building.state = BuildingState.Active;

    // Deliver weapons
    addToInventory(hut.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut.building.inputInventory, ResourceType.Shields, 1);

    // Run knight manager
    knightManager.update(2);

    expect(hut.building.knightIds).toHaveLength(1);
    const knight = gameState.getUnit(hut.building.knightIds[0]);
    expect(knight).toBeDefined();
    expect(knight!.type).toBe(UnitType.Knight);
  });

  it('should project territory from Castle and military buildings', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);

    territoryManager.update();

    // Castle projects radius 8
    expect(territoryManager.isOwnedBy(10, 10, 1)).toBe(true);
    expect(territoryManager.isOwnedBy(14, 10, 1)).toBe(true);

    // Place Guard Hut at edge of Castle territory
    const hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 17, r: 10 }, 1);
    expect(hut.ok).toBe(true);
    if (!hut.ok) return;
    hut.building.state = BuildingState.Active;

    territoryManager.markDirty();
    territoryManager.update();

    // Guard Hut extends territory beyond Castle range
    expect(territoryManager.isOwnedBy(19, 10, 1)).toBe(true);
  });

  it('should capture enemy building and flip territory', () => {
    // Player 1 Castle + Guard Hut with knight
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 10 }, 1);

    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 10 }, 1);
    expect(hut1.ok).toBe(true);
    if (!hut1.ok) return;
    hut1.building.state = BuildingState.Active;

    addToInventory(hut1.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut1.building.inputInventory, ResourceType.Shields, 1);
    knightManager.update(2);
    const knightId = hut1.building.knightIds[0];

    // Player 2 Guard Hut (undefended)
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 12, r: 10 }, 2);
    expect(hut2.ok).toBe(true);
    if (!hut2.ok) return;
    hut2.building.state = BuildingState.Active;

    // Calculate initial territory
    territoryManager.update();
    expect(territoryManager.isOwnedBy(12, 10, 2)).toBe(true);

    // Attack!
    const ordered = attackManager.orderAttack(knightId, hut2.building.id);
    expect(ordered).toBe(true);

    // Simulate knight arrival
    const knight = gameState.getUnit(knightId)!;
    knight.coord = { q: 12, r: 10 };
    knight.pathIndex = knight.path.length - 1;

    // Process attack — no defenders, should capture immediately
    attackManager.update();

    // Building captured by player 1
    expect(hut2.building.playerId).toBe(1);

    // Territory should have flipped
    expect(territoryManager.isOwnedBy(12, 10, 1)).toBe(true);
  });

  it('should gate building placement to player territory', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);

    territoryManager.update();

    // Wire up territory check
    gameState.territoryCheck = (q, r, playerId) => territoryManager.isOwnedBy(q, r, playerId);

    // Inside territory — should succeed
    const result1 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 11, r: 10 }, 1);
    expect(result1.ok).toBe(true);

    // Outside territory — should fail
    const result2 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 0, r: 0 }, 1);
    expect(result2.ok).toBe(false);
    if (!result2.ok) expect(result2.error).toBe('outside_territory');
  });
});
