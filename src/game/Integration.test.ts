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
import { BuildingType } from './BuildingType';
import { BuildingState, initializeCastleResources, resetBuildingIdCounter } from './Building';
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
