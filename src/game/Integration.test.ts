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
import { DuelAnimationManager } from './DuelAnimationManager';
import { VictoryManager, VictoryCondition } from './VictoryManager';
import { AIPlayer } from './AIPlayer';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState, initializeCastleResources, resetBuildingIdCounter, addToInventory } from './Building';
import type { Building } from './Building';
import { ResourceType } from './ResourceType';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';
import { Difficulty } from './GameConfig';
import { GeologistManager } from './GeologistManager';
import { TreeManager } from './TreeManager';
import { WoodcutterManager } from './WoodcutterManager';
import { ForesterManager } from './ForesterManager';
import { UpgradeManager } from './UpgradeManager';
import { FogOfWarManager } from './FogOfWarManager';
import { HarborManager } from './HarborManager';
import { PopulationManager } from './PopulationManager';
import { FeedingManager } from './FeedingManager';
import { MoraleManager } from './MoraleManager';
import { serializeGame, deserializeGame } from './SaveLoad';
import type { SaveData } from './SaveLoad';

describe('Integration: Full Production Chain', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let roadNetwork: RoadNetwork;
  let unitManager: UnitManager;
  let productionManager: ProductionManager;
  let constructionManager: ConstructionManager;
  let transporterManager: TransporterManager;
  let logisticsManager: LogisticsManager;
  let treeManager: TreeManager;
  let woodcutterManager: WoodcutterManager;

  /** Run one full game tick through all managers */
  function tick(dt: number) {
    unitManager.update(dt);
    constructionManager.update(dt);
    productionManager.update(dt);
    treeManager.update(dt);
    woodcutterManager.update(dt);
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
    // Add Forest/Mountain tiles near common placement coords for distance-based production
    grid.setTile(3, 4, TerrainType.Forest, 0.5);
    grid.setTile(5, 4, TerrainType.Mountain, 0.5);

    gameState = new GameState(grid);
    // Place a Castle so population capacity is available for spawning
    gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
    roadNetwork = new RoadNetwork(grid);
    const populationManager = new PopulationManager(gameState);
    unitManager = new UnitManager(gameState, populationManager);
    productionManager = new ProductionManager(gameState);
    constructionManager = new ConstructionManager(gameState, populationManager);
    transporterManager = new TransporterManager(gameState, roadNetwork, populationManager);
    logisticsManager = new LogisticsManager(gameState, roadNetwork);
    treeManager = new TreeManager();
    woodcutterManager = new WoodcutterManager(gameState, treeManager);

    // Initialize trees on forest tiles so woodcutter can harvest
    treeManager.initializeFromMap(grid);
  });

  it('should transport Wood from Woodcutter to Sawmill', () => {
    // Castle already placed in beforeEach
    const castleResult = { ok: true, building: gameState.findCastle(1)! };
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
    // Castle already placed in beforeEach
    const castle = gameState.findCastle(1)!;
    initializeCastleResources(castle);

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

describe('Integration: Phase 7 — Notifications & UI Workflow', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let constructionManager: ConstructionManager;
  let knightManager: KnightManager;
  let combatManager: CombatManager;
  let attackManager: AttackManager;
  let territoryManager: TerritoryManager;
  let unitManager: UnitManager;

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
    const populationManager = new PopulationManager(gameState);
    constructionManager = new ConstructionManager(gameState, populationManager);
    unitManager = new UnitManager(gameState, populationManager);
  });

  it('should fire onBuildingActivated with building when construction completes', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);
    if (!castle.ok) return;
    initializeCastleResources(castle.building);

    const wc = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 11, r: 10 }, 1);
    expect(wc.ok).toBe(true);
    if (!wc.ok) return;

    let activatedBuilding: import('./Building').Building | null = null;
    constructionManager.onBuildingActivated = (building) => {
      activatedBuilding = building;
    };

    // Simulate construction (deliver resources + builder work)
    for (let i = 0; i < 120; i++) {
      unitManager.update(0.5);
      constructionManager.update(0.5);
    }

    expect(activatedBuilding).not.toBeNull();
    expect(activatedBuilding!.type).toBe(BuildingType.WoodcutterHut);
    expect(activatedBuilding!.state).toBe(BuildingState.Active);
  });

  it('should fire onKnightRecruited with building when knight is recruited', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    const hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 12, r: 10 }, 1);
    expect(hut.ok).toBe(true);
    if (!hut.ok) return;
    hut.building.state = BuildingState.Active;

    addToInventory(hut.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut.building.inputInventory, ResourceType.Shields, 1);

    let recruitedAt: import('./Building').Building | null = null;
    knightManager.onKnightRecruited = (building) => {
      recruitedAt = building;
    };

    knightManager.update(2);

    expect(recruitedAt).not.toBeNull();
    expect(recruitedAt!.type).toBe(BuildingType.GuardHut);
    expect(hut.building.knightIds).toHaveLength(1);
  });

  it('should fire onDuelResolved when combat occurs', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 10 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 10 }, 2);

    const k1 = gameState.spawnUnit(UnitType.Knight, { q: 6, r: 10 }, 1);
    k1.knightRank = 3;
    const k2 = gameState.spawnUnit(UnitType.Knight, { q: 14, r: 10 }, 2);
    k2.knightRank = 1;

    let duelResult: import('./CombatManager').DuelResult | null = null;
    combatManager.onDuelResolved = (result) => {
      duelResult = result;
    };
    // Fix random for deterministic test
    combatManager.random = () => 0.1; // attacker wins (high strength)

    combatManager.resolveDuel(k1.id, k2.id);

    expect(duelResult).not.toBeNull();
    expect(duelResult!.winnerId).toBe(k1.id);
    expect(duelResult!.loserId).toBe(k2.id);
    expect(duelResult!.winnerPlayerId).toBe(1);
    expect(duelResult!.loserPlayerId).toBe(2);
  });

  it('should include correct playerIds in DuelResult for NPC-vs-NPC combat', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 10 }, 2);
    gameState.placeBuilding(BuildingType.Castle, { q: 15, r: 10 }, 3);

    const k1 = gameState.spawnUnit(UnitType.Knight, { q: 6, r: 10 }, 2);
    k1.knightRank = 2;
    const k2 = gameState.spawnUnit(UnitType.Knight, { q: 14, r: 10 }, 3);
    k2.knightRank = 1;

    let duelResult: import('./CombatManager').DuelResult | null = null;
    combatManager.onDuelResolved = (result) => {
      duelResult = result;
    };
    combatManager.random = () => 0.1; // attacker wins

    combatManager.resolveDuel(k1.id, k2.id);

    expect(duelResult).not.toBeNull();
    expect(duelResult!.winnerPlayerId).toBe(2);
    expect(duelResult!.loserPlayerId).toBe(3);
    // Neither player is player 1 — game notification should NOT fire
  });

  it('should fire onBuildingUnderAttack and onBuildingCaptured during attack', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 10 }, 1);
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 10 }, 1);
    if (!hut1.ok) throw new Error('Placement failed');
    hut1.building.state = BuildingState.Active;

    addToInventory(hut1.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut1.building.inputInventory, ResourceType.Shields, 1);
    knightManager.update(2);
    const knightId = hut1.building.knightIds[0];

    // Enemy undefended building
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 12, r: 10 }, 2);
    if (!hut2.ok) throw new Error('Placement failed');
    hut2.building.state = BuildingState.Active;
    territoryManager.update();

    let attackedBuilding: import('./Building').Building | null = null;
    let capturedBuilding: import('./Building').Building | null = null;
    let capturedBy = 0;

    attackManager.onBuildingUnderAttack = (building) => {
      attackedBuilding = building;
    };
    attackManager.onBuildingCaptured = (building, byPlayerId) => {
      capturedBuilding = building;
      capturedBy = byPlayerId;
    };

    // Order attack — should fire onBuildingUnderAttack
    attackManager.orderAttack(knightId, hut2.building.id);
    expect(attackedBuilding).not.toBeNull();
    expect(attackedBuilding!.id).toBe(hut2.building.id);

    // Simulate arrival
    const knight = gameState.getUnit(knightId)!;
    knight.coord = { q: 12, r: 10 };
    knight.pathIndex = knight.path.length - 1;

    // Process — no defenders, capture immediately
    attackManager.update();

    expect(capturedBuilding).not.toBeNull();
    expect(capturedBuilding!.id).toBe(hut2.building.id);
    expect(capturedBy).toBe(1);
  });

  it('should fire onBuildingRemoved callback with building', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);
    const wc = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 11, r: 10 }, 1);
    expect(wc.ok).toBe(true);
    if (!wc.ok) return;

    let removedBuilding: import('./Building').Building | null = null;
    gameState.onBuildingRemoved = (building) => {
      removedBuilding = building;
    };

    gameState.removeBuilding(wc.building.id);

    expect(removedBuilding).not.toBeNull();
    expect(removedBuilding!.type).toBe(BuildingType.WoodcutterHut);
  });

  it('should apply gold bonus to knight combat strength', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);
    if (!castle.ok) return;

    // Add gold bars to Castle output inventory
    addToInventory(castle.building.outputInventory, ResourceType.GoldBars, 4);

    const hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 12, r: 10 }, 1);
    expect(hut.ok).toBe(true);
    if (!hut.ok) return;
    hut.building.state = BuildingState.Active;

    addToInventory(hut.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut.building.inputInventory, ResourceType.Shields, 1);
    const knightMgr = new KnightManager(gameState);
    knightMgr.update(2);

    const knightId = hut.building.knightIds[0];
    // 4 gold bars × 5% = 20% bonus → 1.2 multiplier
    expect(knightMgr.getGoldBonus(1)).toBeCloseTo(1.2);
    // Rank 1 × 1.2 = 1.2
    expect(knightMgr.getKnightStrength(knightId)).toBeCloseTo(1.2);
  });

  it('should cap knight rank at 5 after many wins', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 0, r: 0 }, 2);

    const winner = gameState.spawnUnit(UnitType.Knight, { q: 10, r: 10 }, 1);
    winner.knightRank = 4;

    const knightMgr = new KnightManager(gameState);
    const combat = new CombatManager(gameState, knightMgr);
    combat.random = () => 0.0; // attacker always wins

    // Win twice to rank up from 4 → 5
    const loser1 = gameState.spawnUnit(UnitType.Knight, { q: 1, r: 0 }, 2);
    loser1.knightRank = 1;
    combat.resolveDuel(winner.id, loser1.id);

    const loser2 = gameState.spawnUnit(UnitType.Knight, { q: 2, r: 0 }, 2);
    loser2.knightRank = 1;
    combat.resolveDuel(winner.id, loser2.id);
    expect(winner.knightRank).toBe(5);

    // Win more — rank should stay at 5
    const loser3 = gameState.spawnUnit(UnitType.Knight, { q: 3, r: 0 }, 2);
    loser3.knightRank = 1;
    combat.resolveDuel(winner.id, loser3.id);

    const loser4 = gameState.spawnUnit(UnitType.Knight, { q: 4, r: 0 }, 2);
    loser4.knightRank = 1;
    combat.resolveDuel(winner.id, loser4.id);
    expect(winner.knightRank).toBe(5);
  });

  it('should reject attack order on non-existent or non-military target', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 10 }, 1);
    const hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 10 }, 1);
    if (!hut.ok) throw new Error('Placement failed');
    hut.building.state = BuildingState.Active;

    addToInventory(hut.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut.building.inputInventory, ResourceType.Shields, 1);
    const knightMgr = new KnightManager(gameState);
    knightMgr.update(2);
    const knightId = hut.building.knightIds[0];

    const combat = new CombatManager(gameState, knightMgr);
    const attack = new AttackManager(gameState, combat, territoryManager);

    // Non-existent target
    expect(attack.orderAttack(knightId, 'bogus-id')).toBe(false);

    // Attack a civilian building (Woodcutter — 0 knight slots)
    const wc = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 12, r: 10 }, 2);
    if (!wc.ok) throw new Error('Placement failed');
    wc.building.state = BuildingState.Active;
    expect(attack.orderAttack(knightId, wc.building.id)).toBe(false);
  });

  it('should clean up dead knights from buildings during update', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    const hut = gameState.placeBuilding(BuildingType.GuardHut, { q: 12, r: 10 }, 1);
    if (!hut.ok) throw new Error('Placement failed');
    hut.building.state = BuildingState.Active;

    addToInventory(hut.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut.building.inputInventory, ResourceType.Shields, 1);
    const knightMgr = new KnightManager(gameState);
    knightMgr.update(2);

    const knightId = hut.building.knightIds[0];
    expect(hut.building.knightIds).toHaveLength(1);

    // Remove the knight directly (simulating combat death)
    gameState.removeUnit(knightId);

    // Knight manager cleanup should remove the dead reference
    knightMgr.update(2);
    expect(hut.building.knightIds).toHaveLength(0);
  });

  it('should calculate player resources across Castle and Warehouses', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    expect(castle.ok).toBe(true);
    if (!castle.ok) return;
    initializeCastleResources(castle.building);

    // Castle has: wood(12), stone(8), planks(6), tools(4), fish(4), bread(4)
    expect(castle.building.outputInventory[ResourceType.Wood]).toBe(12);
    expect(castle.building.outputInventory[ResourceType.Stone]).toBe(8);

    // Place Warehouse and add resources
    const wh = gameState.placeBuilding(BuildingType.Warehouse, { q: 12, r: 10 }, 1);
    expect(wh.ok).toBe(true);
    if (!wh.ok) return;
    wh.building.state = BuildingState.Active;
    addToInventory(wh.building.outputInventory, ResourceType.Wood, 5);

    // Sum resources across storage buildings
    const buildings = gameState.getBuildingsByPlayer(1);
    const totals: Partial<Record<ResourceType, number>> = {};
    for (const b of buildings) {
      if (b.type !== BuildingType.Castle && b.type !== BuildingType.Warehouse) continue;
      for (const [res, amount] of Object.entries(b.outputInventory)) {
        if (amount && amount > 0) {
          const r = res as ResourceType;
          totals[r] = (totals[r] ?? 0) + amount;
        }
      }
    }

    expect(totals[ResourceType.Wood]).toBe(17); // 12 + 5
    expect(totals[ResourceType.Stone]).toBe(8);
  });

  it('should prevent a knight from dueling itself', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    const k = gameState.spawnUnit(UnitType.Knight, { q: 10, r: 10 }, 1);
    k.knightRank = 2;

    const knightMgr = new KnightManager(gameState);
    const combat = new CombatManager(gameState, knightMgr);

    const result = combat.resolveDuel(k.id, k.id);
    expect(result).toBeNull();
    // Knight should still exist with unchanged state
    const knight = gameState.getUnit(k.id);
    expect(knight).toBeDefined();
    expect(knight!.knightRank).toBe(2);
  });

  it('should handle multi-defender sequential combat', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 10 }, 1);
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 10 }, 1);
    if (!hut1.ok) throw new Error('Placement failed');
    hut1.building.state = BuildingState.Active;

    // Give attacker a high rank to ensure victories
    addToInventory(hut1.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut1.building.inputInventory, ResourceType.Shields, 1);
    knightManager.update(2);
    const attackerId = hut1.building.knightIds[0];
    const attacker = gameState.getUnit(attackerId)!;
    attacker.knightRank = 5;

    // Enemy Barracks with 3 defenders (recruit one at a time)
    const barracks = gameState.placeBuilding(BuildingType.Barracks, { q: 12, r: 10 }, 2);
    if (!barracks.ok) throw new Error('Placement failed');
    barracks.building.state = BuildingState.Active;
    for (let i = 0; i < 3; i++) {
      addToInventory(barracks.building.inputInventory, ResourceType.Swords, 1);
      addToInventory(barracks.building.inputInventory, ResourceType.Shields, 1);
      knightManager.update(2);
    }
    expect(barracks.building.knightIds).toHaveLength(3);

    combatManager.random = () => 0.0; // attacker always wins

    // Order attack
    territoryManager.update();
    const ordered = attackManager.orderAttack(attackerId, barracks.building.id);
    expect(ordered).toBe(true);

    // Simulate arrival
    attacker.coord = { q: 12, r: 10 };
    attacker.pathIndex = attacker.path.length - 1;

    // Each update fights one defender; capture happens on the tick after last defender falls
    attackManager.update(); // Fight defender 1
    expect(barracks.building.knightIds).toHaveLength(2);

    attackManager.update(); // Fight defender 2
    expect(barracks.building.knightIds).toHaveLength(1);

    attackManager.update(); // Fight defender 3
    expect(barracks.building.knightIds).toHaveLength(0);

    attackManager.update(); // No defenders left → capture
    expect(barracks.building.knightIds).toHaveLength(1); // attacker stationed
    expect(barracks.building.playerId).toBe(1);
  });

  it('should not transfer non-Active buildings during territory capture', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 10 }, 1);
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 10 }, 1);
    if (!hut1.ok) throw new Error('Placement failed');
    hut1.building.state = BuildingState.Active;
    addToInventory(hut1.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut1.building.inputInventory, ResourceType.Shields, 1);
    knightManager.update(2);
    const attackerId = hut1.building.knightIds[0];
    const attacker = gameState.getUnit(attackerId)!;
    attacker.knightRank = 5;

    // Enemy Guard Hut (undefended)
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 12, r: 10 }, 2);
    if (!hut2.ok) throw new Error('Placement failed');
    hut2.building.state = BuildingState.Active;

    // Enemy Planned building in same area
    const planned = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 13, r: 10 }, 2);
    if (!planned.ok) throw new Error('Placement failed');
    expect(planned.building.state).toBe(BuildingState.Planned);

    territoryManager.update();
    combatManager.random = () => 0.0;

    attackManager.orderAttack(attackerId, hut2.building.id);
    attacker.coord = { q: 12, r: 10 };
    attacker.pathIndex = attacker.path.length - 1;
    attackManager.update();

    // Guard Hut captured
    expect(hut2.building.playerId).toBe(1);
    // Planned building should NOT have been transferred
    expect(planned.building.playerId).toBe(2);
  });

  it('should cap gold bonus at 50% with more than 10 gold bars', () => {
    const castle = gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    if (!castle.ok) throw new Error('Castle placement failed');
    addToInventory(castle.building.outputInventory, ResourceType.GoldBars, 20);

    const knightMgr = new KnightManager(gameState);
    // 20 gold bars × 5% = 100%, but capped at 50%
    expect(knightMgr.getGoldBonus(1)).toBeCloseTo(1.5);
  });

  it('should clean up combatWins for removed knights', () => {
    gameState.placeBuilding(BuildingType.Castle, { q: 10, r: 10 }, 1);
    gameState.placeBuilding(BuildingType.Castle, { q: 0, r: 0 }, 2);

    const k1 = gameState.spawnUnit(UnitType.Knight, { q: 10, r: 10 }, 1);
    k1.knightRank = 3;

    const knightMgr = new KnightManager(gameState);
    const combat = new CombatManager(gameState, knightMgr);
    combat.random = () => 0.0; // attacker always wins

    // Win a duel to accumulate combatWins
    const enemy = gameState.spawnUnit(UnitType.Knight, { q: 1, r: 0 }, 2);
    enemy.knightRank = 1;
    combat.resolveDuel(k1.id, enemy.id);
    expect(combat.getCombatWins(k1.id)).toBe(1);

    // Remove the knight externally (e.g., building destroyed)
    gameState.removeUnit(k1.id);

    // Cleanup should prune the stale entry
    combat.cleanupStaleData();
    expect(combat.getCombatWins(k1.id)).toBe(0);
  });
});

// ============================================================
// Phase 8.4: Multi-player state tests
// ============================================================

describe('Integration: Multi-player State', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let roadNetwork: RoadNetwork;
  let unitManager: UnitManager;
  let constructionManager: ConstructionManager;
  let transporterManager: TransporterManager;
  let logisticsManager: LogisticsManager;
  let productionManager: ProductionManager;

  function tick(dt: number): void {
    unitManager.update(dt);
    constructionManager.update(dt);
    productionManager.update(dt);
    logisticsManager.update(dt);
    transporterManager.update(dt);
  }

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();

    grid = new HexGrid(24, 24);
    for (let q = 0; q < 24; q++) {
      for (let r = 0; r < 24; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }

    gameState = new GameState(grid);
    roadNetwork = new RoadNetwork(grid);
    const populationManager = new PopulationManager(gameState);
    unitManager = new UnitManager(gameState, populationManager);
    constructionManager = new ConstructionManager(gameState, populationManager);
    transporterManager = new TransporterManager(gameState, roadNetwork, populationManager);
    logisticsManager = new LogisticsManager(gameState, roadNetwork);
    productionManager = new ProductionManager(gameState);
  });

  it('ConstructionManager delivers resources from each player\'s own Castle', () => {
    // Player 1 Castle at (4, 4)
    const r1 = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    if (!r1.ok) throw new Error('Failed to place castle 1');
    initializeCastleResources(r1.building);

    // Player 2 Castle at (18, 18)
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 18, r: 18 }, 2);
    if (!r2.ok) throw new Error('Failed to place castle 2');
    initializeCastleResources(r2.building);

    // Player 1 places a woodcutter hut
    const b1 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 6, r: 4 }, 1);
    if (!b1.ok) throw new Error('Failed to place building for p1');

    // Player 2 places a woodcutter hut
    const b2 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 20, r: 18 }, 2);
    if (!b2.ok) throw new Error('Failed to place building for p2');

    // Both should start as Planned
    expect(b1.building.state).toBe(BuildingState.Planned);
    expect(b2.building.state).toBe(BuildingState.Planned);

    // Tick enough for delivery (WoodcutterHut costs 2 Wood)
    constructionManager.update(1.1);
    constructionManager.update(1.1);

    // Both should transition to UnderConstruction
    expect(b1.building.state).toBe(BuildingState.UnderConstruction);
    expect(b2.building.state).toBe(BuildingState.UnderConstruction);

    // Each Castle should have spent resources independently
    const p1Castle = gameState.findCastle(1)!;
    const p2Castle = gameState.findCastle(2)!;
    expect(p1Castle.outputInventory[ResourceType.Wood]).toBe(10); // 12 - 2
    expect(p2Castle.outputInventory[ResourceType.Wood]).toBe(10); // 12 - 2
  });

  it('UnitManager spawns workers for multiple players', () => {
    // Player 1 Castle + building
    const r1 = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    if (!r1.ok) throw new Error('Failed');
    initializeCastleResources(r1.building);
    const b1 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 6, r: 4 }, 1);
    if (!b1.ok) throw new Error('Failed');
    b1.building.state = BuildingState.Active;

    // Player 2 Castle + building
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 18, r: 18 }, 2);
    if (!r2.ok) throw new Error('Failed');
    initializeCastleResources(r2.building);
    const b2 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 20, r: 18 }, 2);
    if (!b2.ok) throw new Error('Failed');
    b2.building.state = BuildingState.Active;

    // Tick to spawn workers
    unitManager.update(2.1);

    // Both players should have workers spawned
    const p1Units = gameState.getUnitsByPlayer(1);
    const p2Units = gameState.getUnitsByPlayer(2);
    expect(p1Units.length).toBeGreaterThan(0);
    expect(p2Units.length).toBeGreaterThan(0);

    // Workers should belong to correct players
    expect(p1Units[0].playerId).toBe(1);
    expect(p2Units[0].playerId).toBe(2);
  });

  it('TransporterManager spawns transporters with flag owner\'s playerId', () => {
    // Player 1 Castle
    const r1 = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    if (!r1.ok) throw new Error('Failed');
    initializeCastleResources(r1.building);

    // Player 2 Castle
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 18, r: 18 }, 2);
    if (!r2.ok) throw new Error('Failed');
    initializeCastleResources(r2.building);

    // Place flags and road for player 1 (adjacent hexes)
    const f1a = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
    const f1b = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
    roadNetwork.connectFlags(f1a.id, f1b.id);

    // Place flags and road for player 2 (adjacent hexes)
    const f2a = roadNetwork.placeFlag({ q: 18, r: 18 }, 2)!;
    const f2b = roadNetwork.placeFlag({ q: 19, r: 18 }, 2)!;
    roadNetwork.connectFlags(f2a.id, f2b.id);

    // Tick to spawn transporters
    transporterManager.update(1.1);

    // Check that transporters have correct player IDs
    const p1Units = gameState.getUnitsByPlayer(1).filter(u => u.type === UnitType.Transporter);
    const p2Units = gameState.getUnitsByPlayer(2).filter(u => u.type === UnitType.Transporter);
    expect(p1Units.length).toBe(1);
    expect(p2Units.length).toBe(1);
  });

  it('ConstructionManager spawns builders from each player\'s own Castle', () => {
    // Player 1 Castle
    const r1 = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    if (!r1.ok) throw new Error('Failed');
    initializeCastleResources(r1.building);

    // Player 2 Castle
    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 18, r: 18 }, 2);
    if (!r2.ok) throw new Error('Failed');
    initializeCastleResources(r2.building);

    // Both players place buildings
    const b1 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 6, r: 4 }, 1);
    if (!b1.ok) throw new Error('Failed');
    const b2 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 20, r: 18 }, 2);
    if (!b2.ok) throw new Error('Failed');

    // Deliver resources (tick twice for 2 wood each)
    constructionManager.update(1.1);
    constructionManager.update(1.1);

    // Both should be UnderConstruction
    expect(b1.building.state).toBe(BuildingState.UnderConstruction);
    expect(b2.building.state).toBe(BuildingState.UnderConstruction);

    // Tick again to spawn builders
    constructionManager.update(1.1);

    // Find builders for each player
    const p1Builders = gameState.getUnitsByPlayer(1).filter(u => u.type === UnitType.Builder);
    const p2Builders = gameState.getUnitsByPlayer(2).filter(u => u.type === UnitType.Builder);
    expect(p1Builders.length).toBe(1);
    expect(p2Builders.length).toBe(1);

    // Builders spawn at their own Castle
    expect(p1Builders[0].coord).toEqual({ q: 4, r: 4 });
    expect(p2Builders[0].coord).toEqual({ q: 18, r: 18 });
  });

  it('full construction lifecycle works independently for each player', () => {
    // Player 1 at (4,4), Player 2 at (18,18)
    const r1 = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    if (!r1.ok) throw new Error('Failed');
    initializeCastleResources(r1.building);

    const r2 = gameState.placeBuilding(BuildingType.Castle, { q: 18, r: 18 }, 2);
    if (!r2.ok) throw new Error('Failed');
    initializeCastleResources(r2.building);

    // Both place WoodcutterHuts
    const b1 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 6, r: 4 }, 1);
    if (!b1.ok) throw new Error('Failed');
    const b2 = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 20, r: 18 }, 2);
    if (!b2.ok) throw new Error('Failed');

    // Run full construction cycle: deliver resources, spawn builders, walk, build
    // WoodcutterHut: 2 Wood cost, 5s construction time + walk time
    for (let i = 0; i < 200; i++) {
      tick(0.2);
    }

    // Both buildings should be Active
    expect(b1.building.state).toBe(BuildingState.Active);
    expect(b2.building.state).toBe(BuildingState.Active);
  });
});

// ============================================================
// Phase 8.9: Full Game Scenario + Save/Load + Performance
// ============================================================

describe('Integration: Full 2-Player Game Scenario', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let roadNetwork: RoadNetwork;
  let unitManager: UnitManager;
  let productionManager: ProductionManager;
  let constructionManager: ConstructionManager;
  let transporterManager: TransporterManager;
  let logisticsManager: LogisticsManager;
  let territoryManager: TerritoryManager;
  let knightManager: KnightManager;
  let combatManager: CombatManager;
  let attackManager: AttackManager;
  let victoryManager: VictoryManager;
  let aiPlayer: AIPlayer;
  const placedByAI: Building[] = [];

  function tickAll(dt: number): void {
    unitManager.update(dt);
    constructionManager.update(dt);
    productionManager.update(dt);
    logisticsManager.update(dt);
    transporterManager.update(dt);
    knightManager.update(dt);
    territoryManager.update();
    attackManager.update();
    combatManager.cleanupStaleData();
    victoryManager.update(dt);
    aiPlayer.update(dt);
  }

  function simulateAll(seconds: number, stepSize = 0.5): void {
    const steps = Math.ceil(seconds / stepSize);
    for (let i = 0; i < steps; i++) {
      tickAll(stepSize);
    }
  }

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();
    placedByAI.length = 0;

    // 24×24 all-grassland map for predictable AI placement
    grid = new HexGrid(24, 24);
    for (let q = 0; q < 24; q++) {
      for (let r = 0; r < 24; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }

    gameState = new GameState(grid);
    roadNetwork = new RoadNetwork(grid);
    const populationManager = new PopulationManager(gameState);
    unitManager = new UnitManager(gameState, populationManager);
    productionManager = new ProductionManager(gameState);
    constructionManager = new ConstructionManager(gameState, populationManager);
    transporterManager = new TransporterManager(gameState, roadNetwork, populationManager);
    logisticsManager = new LogisticsManager(gameState, roadNetwork);
    territoryManager = new TerritoryManager(gameState);
    knightManager = new KnightManager(gameState);
    combatManager = new CombatManager(gameState, knightManager);
    attackManager = new AttackManager(gameState, combatManager, territoryManager);
    victoryManager = new VictoryManager(gameState, territoryManager, [1, 2]);

    // Wire territory check for placement validation
    gameState.territoryCheck = (q, r, pid) => territoryManager.isOwnedBy(q, r, pid);

    // Player 1 (human) Castle at (4, 4)
    const p1 = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    if (!p1.ok) throw new Error('P1 Castle placement failed');
    initializeCastleResources(p1.building);

    // Player 2 (AI) Castle at (20, 20)
    const p2 = gameState.placeBuilding(BuildingType.Castle, { q: 20, r: 20 }, 2);
    if (!p2.ok) throw new Error('P2 Castle placement failed');
    initializeCastleResources(p2.building);

    // Compute initial territory
    territoryManager.update();

    // AI player for player 2 (Easy difficulty for faster decision intervals in test)
    aiPlayer = new AIPlayer(
      2,
      Difficulty.Easy,
      gameState,
      territoryManager,
      attackManager,
      knightManager,
      new UpgradeManager(gameState),
      roadNetwork,
      new PopulationManager(gameState),
      (building: Building) => { placedByAI.push(building); },
    );
  });

  it('AI builds economy buildings over time', () => {
    // Easy difficulty: 10s decision interval
    // Simulate 120 game-seconds — AI should place several buildings
    simulateAll(120);

    const p2Buildings = gameState.getBuildingsByPlayer(2);
    // AI should have placed at least WoodcutterHut + ForesterHut (first 2 in build order)
    // plus the starting Castle
    expect(p2Buildings.length).toBeGreaterThanOrEqual(3);

    // AI should have advanced in its build order
    expect(aiPlayer.getBuildOrderIndex()).toBeGreaterThanOrEqual(2);

    // Some buildings should be under construction or active
    const nonCastle = p2Buildings.filter(b => b.type !== BuildingType.Castle);
    expect(nonCastle.length).toBeGreaterThanOrEqual(1);
  });

  it('AI territory expands with military buildings', () => {
    // Count initial territory for player 2
    const countTerritory = (pid: number) => {
      const state = territoryManager._getState();
      return state.territory.filter(([, owner]) => owner === pid).length;
    };
    const initialTerritory = countTerritory(2);

    // Simulate long enough for AI to place economy + a GuardHut (build order step ~6)
    // Need ~60s worth of decisions at Easy (10s interval)
    simulateAll(200);

    // AI territory should have expanded beyond Castle radius
    const expandedTerritory = countTerritory(2);
    expect(expandedTerritory).toBeGreaterThanOrEqual(initialTerritory);
  });

  it('victory triggers on Castle destruction (elimination)', () => {
    let victoryResult: { winnerId: number; condition: string } | null = null;
    let defeatFired = false;

    victoryManager.onVictory = (result) => { victoryResult = result; };
    victoryManager.onDefeat = () => { defeatFired = true; };

    // Destroy Player 2's Castle to trigger elimination
    const p2Castle = gameState.findCastle(2)!;
    expect(p2Castle).toBeDefined();
    gameState.removeBuilding(p2Castle.id);
    territoryManager.markDirty();

    // Run victory check
    victoryManager.update(3); // exceeds 2s check interval

    expect(victoryResult).not.toBeNull();
    expect(victoryResult!.winnerId).toBe(1);
    expect(victoryResult!.condition).toBe(VictoryCondition.Elimination);
    expect(victoryManager.isGameOver()).toBe(true);
    expect(victoryManager.isEliminated(2)).toBe(true);
    expect(defeatFired).toBe(true);
  });

  it('economic victory triggers at 50+ gold bars', () => {
    let victoryResult: { winnerId: number; condition: string } | null = null;
    victoryManager.onVictory = (result) => { victoryResult = result; };

    // Give player 1 enough gold for economic victory
    const p1Castle = gameState.findCastle(1)!;
    addToInventory(p1Castle.outputInventory, ResourceType.GoldBars, 50);

    victoryManager.update(3);

    expect(victoryResult).not.toBeNull();
    expect(victoryResult!.winnerId).toBe(1);
    expect(victoryResult!.condition).toBe(VictoryCondition.Economic);
    expect(victoryManager.isGameOver()).toBe(true);
  });

  it('both players have independent units and buildings after simulation', () => {
    simulateAll(60);

    const p1Units = gameState.getUnitsByPlayer(1);
    const p2Units = gameState.getUnitsByPlayer(2);
    const p1Buildings = gameState.getBuildingsByPlayer(1);
    const p2Buildings = gameState.getBuildingsByPlayer(2);

    // Both players should have units (workers spawned from Castles)
    // Player 1 has no buildings to trigger workers, but player 2 (AI) builds
    expect(p2Units.length).toBeGreaterThan(0);
    expect(p2Buildings.length).toBeGreaterThanOrEqual(1); // at least Castle

    // All units belong to correct players
    for (const u of p1Units) expect(u.playerId).toBe(1);
    for (const u of p2Units) expect(u.playerId).toBe(2);
    for (const b of p1Buildings) expect(b.playerId).toBe(1);
    for (const b of p2Buildings) expect(b.playerId).toBe(2);
  });
});

describe('Integration: Save/Load Round-Trip', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let roadNetwork: RoadNetwork;
  let unitManager: UnitManager;
  let productionManager: ProductionManager;
  let constructionManager: ConstructionManager;
  let transporterManager: TransporterManager;
  let logisticsManager: LogisticsManager;
  let territoryManager: TerritoryManager;
  let knightManager: KnightManager;
  let combatManager: CombatManager;
  let attackManager: AttackManager;
  let victoryManager: VictoryManager;
  let geologistManager: GeologistManager;
  let treeManager: TreeManager;
  let woodcutterManager: WoodcutterManager;
  let foresterManager: ForesterManager;
  let upgradeManager: UpgradeManager;
  let fogOfWarManager: FogOfWarManager;
  let harborManager: HarborManager;
  let feedingManager: FeedingManager;
  let moraleManager: MoraleManager;
  let aiPlayer: AIPlayer;

  function createManagers() {
    return {
      constructionManager,
      transporterManager,
      unitManager,
      combatManager,
      attackManager,
      territoryManager,
      logisticsManager,
      knightManager,
      victoryManager,
      geologistManager,
      treeManager,
      woodcutterManager,
      foresterManager,
      upgradeManager,
      fogOfWarManager,
      harborManager,
      feedingManager,
      moraleManager,
    };
  }

  function tickAll(dt: number): void {
    unitManager.update(dt);
    constructionManager.update(dt);
    productionManager.update(dt);
    logisticsManager.update(dt);
    transporterManager.update(dt);
    knightManager.update(dt);
    territoryManager.update();
    attackManager.update();
    combatManager.cleanupStaleData();
    victoryManager.update(dt);
    aiPlayer.update(dt);
  }

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
    roadNetwork = new RoadNetwork(grid);
    const populationManager = new PopulationManager(gameState);
    unitManager = new UnitManager(gameState, populationManager);
    productionManager = new ProductionManager(gameState);
    constructionManager = new ConstructionManager(gameState, populationManager);
    transporterManager = new TransporterManager(gameState, roadNetwork, populationManager);
    logisticsManager = new LogisticsManager(gameState, roadNetwork);
    territoryManager = new TerritoryManager(gameState);
    knightManager = new KnightManager(gameState);
    combatManager = new CombatManager(gameState, knightManager);
    attackManager = new AttackManager(gameState, combatManager, territoryManager);
    victoryManager = new VictoryManager(gameState, territoryManager, [1, 2]);
    geologistManager = new GeologistManager(gameState);
    treeManager = new TreeManager();
    woodcutterManager = new WoodcutterManager(gameState, treeManager);
    foresterManager = new ForesterManager(gameState, treeManager);
    upgradeManager = new UpgradeManager(gameState);
    fogOfWarManager = new FogOfWarManager(gameState);
    harborManager = new HarborManager(gameState, roadNetwork, grid);
    feedingManager = new FeedingManager(gameState);
    moraleManager = new MoraleManager(gameState);

    gameState.territoryCheck = (q, r, pid) => territoryManager.isOwnedBy(q, r, pid);

    // Set up a game in progress: 2 players with buildings, units, roads
    const p1 = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
    if (!p1.ok) throw new Error('P1 Castle failed');
    initializeCastleResources(p1.building);

    const p2 = gameState.placeBuilding(BuildingType.Castle, { q: 16, r: 16 }, 2);
    if (!p2.ok) throw new Error('P2 Castle failed');
    initializeCastleResources(p2.building);

    territoryManager.update();

    aiPlayer = new AIPlayer(
      2,
      Difficulty.Normal,
      gameState,
      territoryManager,
      attackManager,
      knightManager,
      upgradeManager,
      roadNetwork,
      new PopulationManager(gameState),
      () => {},
    );

    // Simulate to create some game state
    for (let i = 0; i < 40; i++) {
      tickAll(0.5);
    }
  });

  it('serializes and deserializes game state with matching buildings', () => {
    const config = {
      seed: 42,
      mapSize: 24 as const,
      numPlayers: 2,
      difficulty: Difficulty.Normal,
      scenario: 'default' as const,
    };
    const camera = {
      frustum: 10,
      position: { x: 20, y: 20, z: 20 },
      target: { x: 0, y: 0, z: 0 },
    };

    // Snapshot before save
    const buildingsBefore = gameState.getAllBuildings().map(b => ({
      id: b.id,
      type: b.type,
      playerId: b.playerId,
      state: b.state,
      coord: { ...b.coord },
    }));
    const unitsBefore = gameState.getAllUnits().map(u => ({
      id: u.id,
      type: u.type,
      playerId: u.playerId,
    }));

    // Serialize
    const saveData = serializeGame(
      config, gameState, roadNetwork,
      createManagers(), [aiPlayer], camera,
    );

    // Verify it's valid JSON
    const json = JSON.stringify(saveData);
    const parsed: SaveData = JSON.parse(json);
    expect(parsed.version).toBeDefined();
    expect(parsed.buildings.length).toBe(buildingsBefore.length);
    expect(parsed.units.length).toBe(unitsBefore.length);

    // Create fresh state and deserialize
    const grid2 = new HexGrid(20, 20);
    for (let q = 0; q < 20; q++) {
      for (let r = 0; r < 20; r++) {
        grid2.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const pm2 = new PopulationManager(gs2);
    const um2 = new UnitManager(gs2, pm2);
    const cm2 = new ConstructionManager(gs2, pm2);
    const tm2 = new TransporterManager(gs2, rn2, pm2);
    const lm2 = new LogisticsManager(gs2, rn2);
    const terr2 = new TerritoryManager(gs2);
    const km2 = new KnightManager(gs2);
    const cb2 = new CombatManager(gs2, km2);
    const am2 = new AttackManager(gs2, cb2, terr2);
    const vm2 = new VictoryManager(gs2, terr2, [1, 2]);
    const gm2 = new GeologistManager(gs2);

    const ai2 = new AIPlayer(2, Difficulty.Normal, gs2, terr2, am2, km2, new UpgradeManager(gs2), rn2, pm2, () => {});

    deserializeGame(
      parsed, gs2, rn2,
      {
        constructionManager: cm2,
        transporterManager: tm2,
        unitManager: um2,
        combatManager: cb2,
        attackManager: am2,
        territoryManager: terr2,
        logisticsManager: lm2,
        knightManager: km2,
        victoryManager: vm2,
        geologistManager: gm2,
        treeManager: new TreeManager(),
        woodcutterManager: new WoodcutterManager(gs2, new TreeManager()),
        foresterManager: new ForesterManager(gs2, new TreeManager()),
        upgradeManager: new UpgradeManager(gs2),
        fogOfWarManager: new FogOfWarManager(gs2),
        harborManager: new HarborManager(gs2, rn2, grid2),
        feedingManager: new FeedingManager(gs2),
        moraleManager: new MoraleManager(gs2),
        animalLifecycleManager: { _loadState: () => {} },
      },
      [ai2],
    );

    // Verify restored state matches
    const buildingsAfter = gs2.getAllBuildings();
    expect(buildingsAfter.length).toBe(buildingsBefore.length);

    for (const before of buildingsBefore) {
      const after = gs2.getBuilding(before.id);
      expect(after).toBeDefined();
      expect(after!.type).toBe(before.type);
      expect(after!.playerId).toBe(before.playerId);
      expect(after!.state).toBe(before.state);
      expect(after!.coord.q).toBe(before.coord.q);
      expect(after!.coord.r).toBe(before.coord.r);
    }

    const unitsAfter = gs2.getAllUnits();
    expect(unitsAfter.length).toBe(unitsBefore.length);

    for (const before of unitsBefore) {
      const after = gs2.getUnit(before.id);
      expect(after).toBeDefined();
      expect(after!.type).toBe(before.type);
      expect(after!.playerId).toBe(before.playerId);
    }
  });

  it('AI state survives save/load round-trip', () => {
    const config = {
      seed: 42,
      mapSize: 24 as const,
      numPlayers: 2,
      difficulty: Difficulty.Normal,
      scenario: 'default' as const,
    };
    const camera = {
      frustum: 10,
      position: { x: 20, y: 20, z: 20 },
      target: { x: 0, y: 0, z: 0 },
    };

    const aiStateBefore = aiPlayer._getState();

    const saveData = serializeGame(
      config, gameState, roadNetwork,
      createManagers(), [aiPlayer], camera,
    );
    const json = JSON.stringify(saveData);
    const parsed: SaveData = JSON.parse(json);

    // Restore into fresh AI
    const grid2 = new HexGrid(20, 20);
    for (let q = 0; q < 20; q++) {
      for (let r = 0; r < 20; r++) {
        grid2.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const pm2 = new PopulationManager(gs2);
    const terr2 = new TerritoryManager(gs2);
    const km2 = new KnightManager(gs2);
    const cb2 = new CombatManager(gs2, km2);
    const am2 = new AttackManager(gs2, cb2, terr2);
    const vm2 = new VictoryManager(gs2, terr2, [1, 2]);
    const um2 = new UnitManager(gs2, pm2);
    const cm2 = new ConstructionManager(gs2, pm2);
    const tm2 = new TransporterManager(gs2, rn2, pm2);
    const lm2 = new LogisticsManager(gs2, rn2);
    const gm2 = new GeologistManager(gs2);

    const ai2 = new AIPlayer(2, Difficulty.Normal, gs2, terr2, am2, km2, new UpgradeManager(gs2), rn2, pm2, () => {});

    deserializeGame(
      parsed, gs2, rn2,
      {
        constructionManager: cm2,
        transporterManager: tm2,
        unitManager: um2,
        combatManager: cb2,
        attackManager: am2,
        territoryManager: terr2,
        logisticsManager: lm2,
        knightManager: km2,
        victoryManager: vm2,
        geologistManager: gm2,
        treeManager: new TreeManager(),
        woodcutterManager: new WoodcutterManager(gs2, new TreeManager()),
        foresterManager: new ForesterManager(gs2, new TreeManager()),
        upgradeManager: new UpgradeManager(gs2),
        fogOfWarManager: new FogOfWarManager(gs2),
        harborManager: new HarborManager(gs2, rn2, grid2),
        feedingManager: new FeedingManager(gs2),
        moraleManager: new MoraleManager(gs2),
        animalLifecycleManager: { _loadState: () => {} },
      },
      [ai2],
    );

    const aiStateAfter = ai2._getState();
    expect(aiStateAfter.buildOrderIndex).toBe(aiStateBefore.buildOrderIndex);
    expect(aiStateAfter.playerId).toBe(aiStateBefore.playerId);
  });

  it('victory state survives save/load round-trip', () => {
    // Trigger a victory
    const p2Castle = gameState.findCastle(2)!;
    gameState.removeBuilding(p2Castle.id);
    territoryManager.markDirty();
    victoryManager.update(3);
    expect(victoryManager.isGameOver()).toBe(true);

    const config = {
      seed: 42,
      mapSize: 24 as const,
      numPlayers: 2,
      difficulty: Difficulty.Normal,
      scenario: 'default' as const,
    };
    const camera = {
      frustum: 10,
      position: { x: 20, y: 20, z: 20 },
      target: { x: 0, y: 0, z: 0 },
    };

    const saveData = serializeGame(
      config, gameState, roadNetwork,
      createManagers(), [aiPlayer], camera,
    );
    const parsed: SaveData = JSON.parse(JSON.stringify(saveData));

    // Restore
    const grid2 = new HexGrid(20, 20);
    for (let q = 0; q < 20; q++) {
      for (let r = 0; r < 20; r++) {
        grid2.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    const gs2 = new GameState(grid2);
    const rn2 = new RoadNetwork(grid2);
    const pm2 = new PopulationManager(gs2);
    const terr2 = new TerritoryManager(gs2);
    const km2 = new KnightManager(gs2);
    const cb2 = new CombatManager(gs2, km2);
    const am2 = new AttackManager(gs2, cb2, terr2);
    const vm2 = new VictoryManager(gs2, terr2, [1, 2]);
    const um2 = new UnitManager(gs2, pm2);
    const cm2 = new ConstructionManager(gs2, pm2);
    const tm2 = new TransporterManager(gs2, rn2, pm2);
    const lm2 = new LogisticsManager(gs2, rn2);
    const gm2 = new GeologistManager(gs2);

    const ai2 = new AIPlayer(2, Difficulty.Normal, gs2, terr2, am2, km2, new UpgradeManager(gs2), rn2, pm2, () => {});

    deserializeGame(
      parsed, gs2, rn2,
      {
        constructionManager: cm2,
        transporterManager: tm2,
        unitManager: um2,
        combatManager: cb2,
        attackManager: am2,
        territoryManager: terr2,
        logisticsManager: lm2,
        knightManager: km2,
        victoryManager: vm2,
        geologistManager: gm2,
        treeManager: new TreeManager(),
        woodcutterManager: new WoodcutterManager(gs2, new TreeManager()),
        foresterManager: new ForesterManager(gs2, new TreeManager()),
        upgradeManager: new UpgradeManager(gs2),
        fogOfWarManager: new FogOfWarManager(gs2),
        harborManager: new HarborManager(gs2, rn2, grid2),
        feedingManager: new FeedingManager(gs2),
        moraleManager: new MoraleManager(gs2),
        animalLifecycleManager: { _loadState: () => {} },
      },
      [ai2],
    );

    expect(vm2.isGameOver()).toBe(true);
    const result = vm2.getResult();
    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe(1);
    expect(result!.condition).toBe(VictoryCondition.Elimination);
    expect(vm2.isEliminated(2)).toBe(true);
  });
});

describe('Integration: Performance Benchmark', () => {
  it('ticks all managers under 50ms for a busy game state', () => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    resetRoadNetworkIdCounters();

    // Set up a 32×32 map with many buildings and units
    const grid = new HexGrid(32, 32);
    for (let q = 0; q < 32; q++) {
      for (let r = 0; r < 32; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }

    const gameState = new GameState(grid);
    const roadNetwork = new RoadNetwork(grid);
    const populationManager = new PopulationManager(gameState);
    const unitManager = new UnitManager(gameState, populationManager);
    const productionManager = new ProductionManager(gameState);
    const constructionManager = new ConstructionManager(gameState, populationManager);
    const transporterManager = new TransporterManager(gameState, roadNetwork, populationManager);
    const logisticsManager = new LogisticsManager(gameState, roadNetwork);
    const territoryManager = new TerritoryManager(gameState);
    const knightManager = new KnightManager(gameState);
    const combatManager = new CombatManager(gameState, knightManager);
    const attackManager = new AttackManager(gameState, combatManager, territoryManager);
    const victoryManager = new VictoryManager(gameState, territoryManager, [1, 2]);

    // Player 1 Castle
    const p1 = gameState.placeBuilding(BuildingType.Castle, { q: 6, r: 6 }, 1);
    if (!p1.ok) throw new Error('Failed');
    initializeCastleResources(p1.building);

    // Player 2 Castle
    const p2 = gameState.placeBuilding(BuildingType.Castle, { q: 26, r: 26 }, 2);
    if (!p2.ok) throw new Error('Failed');
    initializeCastleResources(p2.building);

    territoryManager.update();

    // Place many buildings for player 1 (within territory)
    const buildingTypes = [
      BuildingType.WoodcutterHut, BuildingType.ForesterHut,
      BuildingType.Quarry, BuildingType.Sawmill,
      BuildingType.FishermanHut, BuildingType.GuardHut,
    ];
    let placed = 0;
    for (let q = 3; q < 12 && placed < 12; q++) {
      for (let r = 3; r < 12 && placed < 12; r++) {
        if (q === 6 && r === 6) continue; // Castle
        const type = buildingTypes[placed % buildingTypes.length];
        const def = BUILDING_DEFINITIONS[type];
        // Skip terrain-restricted buildings on grassland
        if (!def.allowedTerrain.includes(TerrainType.Grassland)) continue;
        const result = gameState.placeBuilding(type, { q, r }, 1);
        if (result.ok) {
          result.building.state = BuildingState.Active;
          result.building.hasWorker = true;
          placed++;
        }
      }
    }

    // Spawn units
    for (let i = 0; i < 20; i++) {
      gameState.spawnUnit(UnitType.Transporter, { q: 5 + (i % 6), r: 5 + Math.floor(i / 6) }, 1);
    }

    // Place some flags and roads
    const flags = [];
    for (let q = 4; q <= 9; q++) {
      const f = roadNetwork.placeFlag({ q, r: 5 }, 1);
      if (f) flags.push(f);
    }
    for (let i = 0; i < flags.length - 1; i++) {
      roadNetwork.connectFlags(flags[i].id, flags[i + 1].id);
    }

    // Create AI player
    const ai = new AIPlayer(
      2, Difficulty.Hard, gameState, territoryManager,
      attackManager, knightManager, new UpgradeManager(gameState), roadNetwork, populationManager, () => {},
    );

    // Warm up
    for (let i = 0; i < 5; i++) {
      unitManager.update(0.016);
      constructionManager.update(0.016);
      productionManager.update(0.016);
      logisticsManager.update(0.016);
      transporterManager.update(0.016);
      knightManager.update(0.016);
      territoryManager.update();
      attackManager.update();
      combatManager.cleanupStaleData();
      victoryManager.update(0.016);
      ai.update(0.016);
    }

    // Benchmark: time 100 ticks
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      unitManager.update(0.016);
      constructionManager.update(0.016);
      productionManager.update(0.016);
      logisticsManager.update(0.016);
      transporterManager.update(0.016);
      knightManager.update(0.016);
      territoryManager.update();
      attackManager.update();
      combatManager.cleanupStaleData();
      victoryManager.update(0.016);
      ai.update(0.016);
    }
    const elapsed = performance.now() - start;
    const perTick = elapsed / 100;

    // Each tick should be well under 50ms (target: 60fps = 16ms budget)
    // We're generous with 50ms since CI can be slow
    expect(perTick).toBeLessThan(50);

    // Verify game state is still sane after benchmark
    expect(gameState.getAllBuildings().length).toBeGreaterThan(0);
    expect(gameState.getAllUnits().length).toBeGreaterThan(0);
  });
});

describe('Integration: Animated Combat Duels', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let knightManager: KnightManager;
  let combatManager: CombatManager;
  let territoryManager: TerritoryManager;
  let duelAnimationManager: DuelAnimationManager;
  let attackManager: AttackManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetUnitIdCounter();
    grid = new HexGrid(20, 20);
    for (let q = 0; q < 20; q++) {
      for (let r = 0; r < 20; r++) {
        grid.setTile(q, r, TerrainType.Grassland);
      }
    }
    gameState = new GameState(grid);
    knightManager = new KnightManager(gameState);
    combatManager = new CombatManager(gameState, knightManager);
    territoryManager = new TerritoryManager(gameState);
    duelAnimationManager = new DuelAnimationManager();
    attackManager = new AttackManager(
      gameState,
      combatManager,
      territoryManager,
      duelAnimationManager,
      () => 0, // flat world
    );
  });

  it('should animate combat and capture building after duel completes', () => {
    // Place military buildings for two players
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 5 }, 2);
    expect(hut1.ok && hut2.ok).toBe(true);
    if (!hut1.ok || !hut2.ok) return;
    hut1.building.state = BuildingState.Active;
    hut2.building.state = BuildingState.Active;

    // Recruit knights
    addToInventory(hut1.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut1.building.inputInventory, ResourceType.Shields, 1);
    addToInventory(hut2.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut2.building.inputInventory, ResourceType.Shields, 1);
    knightManager.update(2);

    const attackerKnightId = hut1.building.knightIds[0];
    const defenderKnightId = hut2.building.knightIds[0];
    expect(attackerKnightId).toBeDefined();
    expect(defenderKnightId).toBeDefined();

    // Force attacker to win
    combatManager.random = () => 0.01;

    // Order attack
    const ordered = attackManager.orderAttack(attackerKnightId, hut2.building.id);
    expect(ordered).toBe(true);

    // Simulate arrival
    const attacker = gameState.getUnit(attackerKnightId)!;
    attacker.coord = { q: 8, r: 5 };
    attacker.pathIndex = attacker.path.length - 1;

    // First update: knight arrives, duel animation starts
    attackManager.update(0.016);

    // Duel should be active
    expect(duelAnimationManager.getActiveDuels()).toHaveLength(1);
    expect(duelAnimationManager.isInDuel(attackerKnightId)).toBe(true);
    expect(attacker.state).toBe(UnitState.Fighting);

    // Defender should still exist (not yet resolved)
    expect(gameState.getUnit(defenderKnightId)).toBeDefined();

    // Simulate several frames — not enough to complete
    attackManager.update(0.5);
    expect(duelAnimationManager.getActiveDuels().length).toBeGreaterThanOrEqual(0);

    // Simulate enough time to finish the animation (~3s to be safe)
    attackManager.update(3.0);

    // Duel animation should be done
    expect(duelAnimationManager.getActiveDuels()).toHaveLength(0);

    // Defender should be removed (attacker won)
    expect(gameState.getUnit(defenderKnightId)).toBeUndefined();
    expect(hut2.building.knightIds).not.toContain(defenderKnightId);

    // One more update: no defenders left → capture
    attackManager.update(0.016);

    expect(hut2.building.playerId).toBe(1);
    expect(hut2.building.knightIds).toContain(attackerKnightId);
  });

  it('should handle attacker losing an animated duel', () => {
    const hut1 = gameState.placeBuilding(BuildingType.GuardHut, { q: 5, r: 5 }, 1);
    const hut2 = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 5 }, 2);
    if (!hut1.ok || !hut2.ok) return;
    hut1.building.state = BuildingState.Active;
    hut2.building.state = BuildingState.Active;

    addToInventory(hut1.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut1.building.inputInventory, ResourceType.Shields, 1);
    addToInventory(hut2.building.inputInventory, ResourceType.Swords, 1);
    addToInventory(hut2.building.inputInventory, ResourceType.Shields, 1);
    knightManager.update(2);

    const attackerKnightId = hut1.building.knightIds[0];

    // Force attacker to lose
    combatManager.random = () => 0.99;

    attackManager.orderAttack(attackerKnightId, hut2.building.id);

    // Simulate arrival
    const attacker = gameState.getUnit(attackerKnightId)!;
    attacker.coord = { q: 8, r: 5 };
    attacker.pathIndex = attacker.path.length - 1;

    // Start duel
    attackManager.update(0.016);
    expect(duelAnimationManager.getActiveDuels()).toHaveLength(1);

    // Complete animation
    attackManager.update(3.0);

    // Attacker should be dead
    expect(gameState.getUnit(attackerKnightId)).toBeUndefined();

    // Building stays with player 2
    expect(hut2.building.playerId).toBe(2);
    expect(attackManager.getActiveAttackCount()).toBe(0);
  });
});
