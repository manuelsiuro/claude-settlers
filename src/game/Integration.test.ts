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
    constructionManager = new ConstructionManager(gameState);
    unitManager = new UnitManager(gameState);
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
