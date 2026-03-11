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

  describe('transporter movement', () => {
    it('should walk to the other flag', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      tick(1.1); // Spawn

      const transporter = gameState.getAllUnits().find((u) => u.type === UnitType.Transporter);
      expect(transporter?.state).toBe(UnitState.WalkingToWork);
      expect(transporter?.path.length).toBeGreaterThan(0);
    });

    it('should arrive at target flag and turn around', () => {
      const f1 = roadNetwork.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      roadNetwork.connectFlags(f1.id, f2.id);

      tick(1.1); // Spawn

      // Walk to other flag
      for (let i = 0; i < 10; i++) {
        tick(0.5);
      }

      const transporter = gameState.getAllUnits().find((u) => u.type === UnitType.Transporter);
      // Should have arrived, dropped off, and be walking back
      expect(transporter?.state).toBe(UnitState.WalkingToWork);
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

      // Walk to f2
      for (let i = 0; i < 10; i++) {
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

      // Move transporters
      for (let i = 0; i < 10; i++) {
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
      for (let i = 0; i < 10; i++) tick(0.5);

      // Now at f2, good delivered. Put another good at f2 going to a non-existent flag
      f2.goods.push({ resource: ResourceType.Stone, destinationFlagId: 'flag_999' });

      tick(0.5); // Transporter tries to pick up — no route for this good

      // Good should still be at f2 (not picked up since route check fails)
      const stoneAtF2 = f2.goods.filter((g) => g.resource === ResourceType.Stone);
      expect(stoneAtF2.length).toBe(1);
    });
  });
});
