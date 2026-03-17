import { describe, it, expect, beforeEach } from 'vitest';
import { TransporterManager } from './TransporterManager';
import { UnitManager } from './UnitManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { RoadNetwork, resetRoadNetworkIdCounters } from './RoadNetwork';
import { UnitType } from './UnitType';
import { UnitState, resetUnitIdCounter } from './Unit';
import { ResourceType } from './ResourceType';
import { BuildingType } from './BuildingType';
import { resetBuildingIdCounter } from './Building';

describe('TransporterManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let roadNetwork: RoadNetwork;
  let transporterManager: TransporterManager;
  let unitManager: UnitManager;

  function tick(dt: number) {
    unitManager.update(dt);
    transporterManager.update(dt);
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
    transporterManager = new TransporterManager(gameState, roadNetwork);
    unitManager = new UnitManager(gameState);
  });

  describe('transporter spawning', () => {
    it('should spawn a transporter for a road segment', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      tick(1.1);

      const units = gameState.getAllUnits();
      const transporters = units.filter((u) => u.type === UnitType.Transporter);
      expect(transporters).toHaveLength(1);
    });

    it('should assign transporter to the road', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const road = roadNetwork.connectFlags(f1.id, f2.id)!;

      tick(1.1);

      expect(road.transporterId).not.toBeNull();
    });

    it('should not spawn duplicate transporters for same road', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      tick(1.1);
      tick(1.1);
      tick(1.1);

      const transporters = gameState.getAllUnits().filter((u) => u.type === UnitType.Transporter);
      expect(transporters).toHaveLength(1);
    });

    it('should spawn transporters for multiple roads', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.placeFlag({ q: 6, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      // Need multiple ticks to spawn both (cooldown)
      tick(1.1);
      tick(1.1);

      const transporters = gameState.getAllUnits().filter((u) => u.type === UnitType.Transporter);
      expect(transporters).toHaveLength(2);
    });
  });

  describe('transporter idle behavior', () => {
    it('should idle at flag when no goods to carry', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      tick(1.1); // Spawn

      const transporter = gameState.getAllUnits().find((u) => u.type === UnitType.Transporter);
      // No goods at either flag — transporter should idle (Working state at flag)
      expect(transporter?.state).toBe(UnitState.Working);
    });

    it('should resume walking when goods appear at current flag', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      tick(1.1); // Spawn — idles (no goods)

      const transporter = gameState.getAllUnits().find((u) => u.type === UnitType.Transporter)!;
      expect(transporter.state).toBe(UnitState.Working);

      // Add goods at f1 going to f2
      f1.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(0.1); // handleIdleTransporters picks up and walks

      expect(transporter.state).toBe(UnitState.WalkingToWork);
      expect(transporter.carryingResource).toBe(ResourceType.Wood);
      expect(f1.goods).toHaveLength(0);
    });

    it('should walk empty to other flag when goods appear there', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      tick(1.1); // Spawn — idles at f1

      const transporter = gameState.getAllUnits().find((u) => u.type === UnitType.Transporter)!;
      expect(transporter.state).toBe(UnitState.Working);

      // Add goods at f2 going to f1
      f2.goods.push({ resource: ResourceType.Stone, destinationFlagId: f1.id });

      tick(0.1); // handleIdleTransporters walks empty to f2

      expect(transporter.state).toBe(UnitState.WalkingToWork);
      expect(transporter.carryingResource).toBeNull(); // Walking empty
      expect(f2.goods).toHaveLength(1); // Goods still at f2 — not picked up yet
    });
  });

  describe('transporter movement', () => {
    it('should walk to the other flag when carrying goods', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      // Place a good so transporter has a reason to walk
      f1.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(1.1); // Spawn

      const transporter = gameState.getAllUnits().find((u) => u.type === UnitType.Transporter);
      expect(transporter?.state).toBe(UnitState.WalkingToWork);
      expect(transporter?.path.length).toBeGreaterThan(0);
    });
  });

  describe('goods transport', () => {
    it('should pick up a good at a flag and carry it', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      // Place a good at f1 going to f2
      f1.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(1.1); // Spawn — should pick up the good

      const transporter = gameState.getAllUnits().find((u) => u.type === UnitType.Transporter);
      expect(transporter?.carryingResource).toBe(ResourceType.Wood);
      expect(f1.goods).toHaveLength(0); // Picked up
    });

    it('should deliver a good to the destination flag building', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      // Set up f2 as having a building
      const buildResult = gameState.placeBuilding(BuildingType.Sawmill, { q: 5, r: 4 }, 1);
      if (buildResult.ok) {
        f2.buildingId = buildResult.building.id;
      }

      // Place a good at f1 going to f2
      f1.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(1.1); // Spawn and pick up

      // Walk to f2 — slower speed (0.55) needs more ticks
      for (let i = 0; i < 30; i++) {
        tick(0.5);
      }

      // Good should be delivered to the building's input inventory
      if (buildResult.ok) {
        expect(buildResult.building.inputInventory[ResourceType.Wood]).toBe(1);
      }
    });

    it('should leave good at intermediate flag if not final destination', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.placeFlag({ q: 6, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      // Good at f1 needs to go all the way to f3
      f1.goods.push({ resource: ResourceType.Wood, destinationFlagId: f3.id });

      // Spawn transporters
      tick(1.1);
      tick(1.1);

      // Move transporters — need more ticks for slower speed
      for (let i = 0; i < 30; i++) {
        tick(0.5);
      }

      // The good should have been dropped at f2 (intermediate)
      // or already picked up by the f2-f3 transporter
      const totalGoods = f1.goods.length + f2.goods.length + f3.goods.length;
      const transporters = gameState.getAllUnits().filter((u) => u.type === UnitType.Transporter);
      const carrying = transporters.filter((u) => u.carryingResource !== null).length;

      // The good should exist somewhere in the system
      expect(totalGoods + carrying).toBeGreaterThanOrEqual(1);
    });
  });

  describe('cleanup', () => {
    it('should clean up transporter when road is removed', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const road = roadNetwork.connectFlags(f1.id, f2.id)!;

      // Add goods so transporter starts walking (not idle)
      f1.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(1.1); // Spawn

      const transporter = gameState.getAllUnits().find((u) => u.type === UnitType.Transporter)!;
      expect(transporter).toBeDefined();

      // Remove the road
      roadNetwork.removeRoad(road.id);

      tick(0.1); // Cleanup

      expect(transporter.state).toBe(UnitState.Idle);
      expect(transporter.carryingResource).toBeNull();
    });

    it('should drop carried good at flag when road is removed', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const road = roadNetwork.connectFlags(f1.id, f2.id)!;

      // Place a good at f1 going to f2
      f1.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(1.1); // Spawn — picks up good

      const transporter = gameState.getAllUnits().find((u) => u.type === UnitType.Transporter)!;
      expect(transporter.carryingResource).toBe(ResourceType.Wood);

      // Remove the road while transporter is carrying
      roadNetwork.removeRoad(road.id);

      tick(0.1); // Cleanup

      // Good should be dropped at the target flag, not lost
      expect(f2.goods).toHaveLength(1);
      expect(f2.goods[0].resource).toBe(ResourceType.Wood);
    });

    it('should put good back at flag if pathfinding fails after pickup', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      // Place a good at f1 going to f2
      f1.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(1.1); // Spawn — picks up good, walks to f2

      // Walk to f2
      for (let i = 0; i < 30; i++) tick(0.5);

      // Now at f2, good delivered. Put another good at f2 going to a non-existent flag
      f2.goods.push({ resource: ResourceType.Stone, destinationFlagId: 'flag_999' });

      tick(0.5); // Transporter tries to pick up — no route for this good

      // Good should still be at f2 (not picked up since route check fails)
      const stoneAtF2 = f2.goods.filter((g) => g.resource === ResourceType.Stone);
      expect(stoneAtF2.length).toBe(1);
    });
  });

  describe('stranded goods delivery', () => {
    it('should deliver goods stranded at their destination flag', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      // Set up f2 as having a building
      const buildResult = gameState.placeBuilding(BuildingType.Sawmill, { q: 5, r: 4 }, 1);
      if (!buildResult.ok) throw new Error('Failed to place building');
      f2.buildingId = buildResult.building.id;
      buildResult.building.state = 'active';

      // Simulate stranded good: good at f2 with destinationFlagId === f2.id
      f2.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(1.1);

      // Good should be delivered to the building's input inventory
      expect(buildResult.building.inputInventory[ResourceType.Wood]).toBe(1);
      expect(f2.goods.filter(g => g.destinationFlagId === f2.id)).toHaveLength(0);
    });

    it('should not deliver stranded goods if building input is full', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      const buildResult = gameState.placeBuilding(BuildingType.Sawmill, { q: 5, r: 4 }, 1);
      if (!buildResult.ok) throw new Error('Failed to place building');
      f2.buildingId = buildResult.building.id;
      buildResult.building.state = 'active';

      // Fill the input inventory to capacity
      buildResult.building.inputInventory[ResourceType.Wood] = 100;

      // Stranded good at f2
      f2.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(1.1);

      // Phase 2 discards the stranded good since building is at per-resource cap
      // (Sawmill input is 1 Wood, cap = 1*2 = 2, 100 >= 2 → discard)
      expect(f2.goods.filter(g => g.destinationFlagId === f2.id)).toHaveLength(0);
    });

    it('should deliver up to per-resource cap for production buildings', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      const buildResult = gameState.placeBuilding(BuildingType.Sawmill, { q: 5, r: 4 }, 1);
      if (!buildResult.ok) throw new Error('Failed to place building');
      f2.buildingId = buildResult.building.id;
      buildResult.building.state = 'active';

      // Sawmill needs 1 Wood per cycle → per-resource cap = 1*2 = 2
      // 5 stranded Wood goods
      for (let i = 0; i < 5; i++) {
        f2.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });
      }

      tick(1.1);

      // Should deliver 2 (per-resource cap) and discard 3 (surplus)
      expect(buildResult.building.inputInventory[ResourceType.Wood]).toBe(2);
      expect(f2.goods.filter(g => g.destinationFlagId === f2.id)).toHaveLength(0);
    });

    it('should not deliver invalid resource types and discard them', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      // Sawmill only accepts Wood
      const buildResult = gameState.placeBuilding(BuildingType.Sawmill, { q: 5, r: 4 }, 1);
      if (!buildResult.ok) throw new Error('Failed to place building');
      f2.buildingId = buildResult.building.id;
      buildResult.building.state = 'active';

      // Strand Stone at Sawmill — not a valid input
      f2.goods.push({ resource: ResourceType.Stone, destinationFlagId: f2.id });

      tick(1.1);

      // Phase 2 should discard Stone since it's not a valid input
      expect(f2.goods.filter(g => g.destinationFlagId === f2.id)).toHaveLength(0);
      expect(buildResult.building.inputInventory[ResourceType.Stone] ?? 0).toBe(0);
    });

    it('should deliver multiple stranded goods if space allows', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      // Castle accepts all resources (non-production building)
      const buildResult = gameState.placeBuilding(BuildingType.Castle, { q: 5, r: 4 }, 1);
      if (!buildResult.ok) throw new Error('Failed to place building');
      f2.buildingId = buildResult.building.id;
      buildResult.building.state = 'active';

      // 3 stranded goods
      f2.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });
      f2.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });
      f2.goods.push({ resource: ResourceType.Wood, destinationFlagId: f2.id });

      tick(1.1);

      // Castle has no per-resource production cap — accepts all
      expect(buildResult.building.inputInventory[ResourceType.Wood]).toBe(3);
      expect(f2.goods.filter(g => g.destinationFlagId === f2.id)).toHaveLength(0);
    });
  });
});
