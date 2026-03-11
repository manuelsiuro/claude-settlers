import { describe, it, expect, beforeEach } from 'vitest';
import { LogisticsManager } from './LogisticsManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { RoadNetwork, resetRoadNetworkIdCounters } from './RoadNetwork';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { ResourceType } from './ResourceType';

describe('LogisticsManager', () => {
  let grid: HexGrid;
  let gameState: GameState;
  let roadNetwork: RoadNetwork;
  let logistics: LogisticsManager;

  beforeEach(() => {
    resetBuildingIdCounter();
    resetRoadNetworkIdCounters();

    grid = new HexGrid(16, 16);
    for (let q = 0; q < 16; q++) {
      for (let r = 0; r < 16; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }

    gameState = new GameState(grid);
    roadNetwork = new RoadNetwork(grid);
    logistics = new LogisticsManager(gameState, roadNetwork);
  });

  describe('auto-flag creation', () => {
    it('should create a flag for a placed building', () => {
      gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);

      logistics.update(1.0);

      const flag = roadNetwork.getFlagAt(8, 8);
      expect(flag).toBeDefined();
      expect(flag!.buildingId).toBe('building_1');
    });

    it('should link existing flag to building', () => {
      const flag = roadNetwork.placeFlag({ q: 8, r: 8 }, 1)!;
      gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);

      logistics.update(1.0);

      expect(flag.buildingId).toBe('building_1');
    });

    it('should create flags for all buildings', () => {
      gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 8 }, 1);
      gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 10, r: 8 }, 1);

      logistics.update(1.0);

      expect(roadNetwork.getFlagAt(8, 8)).toBeDefined();
      expect(roadNetwork.getFlagAt(10, 8)).toBeDefined();
    });
  });

  describe('output routing', () => {
    it('should move output from building to flag when destination exists', () => {
      // Woodcutter with Wood output → Sawmill that needs Wood input
      const woodcutter = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);

      if (!woodcutter.ok || !sawmill.ok) throw new Error('Failed to place buildings');

      // Make both active
      woodcutter.building.state = BuildingState.Active;
      sawmill.building.state = BuildingState.Active;

      // Add Wood to woodcutter's output
      woodcutter.building.outputInventory[ResourceType.Wood] = 2;

      // Create flags and connect them
      logistics.update(1.0); // Creates flags

      const f1 = roadNetwork.getFlagAt(4, 4)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.getFlagAt(6, 4)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      logistics.update(1.0); // Routes goods

      // One Wood should be at the flag, destined for the sawmill
      expect(f1.goods).toHaveLength(1);
      expect(f1.goods[0].resource).toBe(ResourceType.Wood);
      expect(f1.goods[0].destinationFlagId).toBe(f3.id);
      expect(woodcutter.building.outputInventory[ResourceType.Wood]).toBe(1);
    });

    it('should not route if no destination needs the resource', () => {
      const woodcutter = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      if (!woodcutter.ok) throw new Error('Failed to place building');

      woodcutter.building.state = BuildingState.Active;
      woodcutter.building.outputInventory[ResourceType.Wood] = 1;

      logistics.update(1.0); // Creates flag but no destination
      logistics.update(1.0);

      const flag = roadNetwork.getFlagAt(4, 4)!;
      expect(flag.goods).toHaveLength(0);
      expect(woodcutter.building.outputInventory[ResourceType.Wood]).toBe(1);
    });

    it('should not route to disconnected buildings', () => {
      const woodcutter = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 10, r: 10 }, 1);
      if (!woodcutter.ok || !sawmill.ok) throw new Error('Failed to place buildings');

      woodcutter.building.state = BuildingState.Active;
      sawmill.building.state = BuildingState.Active;
      woodcutter.building.outputInventory[ResourceType.Wood] = 1;

      logistics.update(1.0); // Creates flags (not connected)
      logistics.update(1.0);

      const flag = roadNetwork.getFlagAt(4, 4)!;
      expect(flag.goods).toHaveLength(0);
    });

    it('should route to Castle as storage fallback', () => {
      const woodcutter = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      const castle = gameState.placeBuilding(BuildingType.Castle, { q: 6, r: 4 }, 1);
      if (!woodcutter.ok || !castle.ok) throw new Error('Failed to place buildings');

      woodcutter.building.state = BuildingState.Active;
      castle.building.state = BuildingState.Active;
      woodcutter.building.outputInventory[ResourceType.Fish] = 1;

      logistics.update(1.0); // Creates flags

      const f1 = roadNetwork.getFlagAt(4, 4)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.getFlagAt(6, 4)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      logistics.update(1.0);

      // Fish should route to Castle (no building needs Fish as input here)
      // Wait — IronMine needs Fish. But no IronMine placed, so Castle is fallback.
      expect(f1.goods).toHaveLength(1);
      expect(f1.goods[0].destinationFlagId).toBe(f3.id);
    });

    it('should not exceed flag capacity', () => {
      const woodcutter = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      const castle = gameState.placeBuilding(BuildingType.Castle, { q: 6, r: 4 }, 1);
      if (!woodcutter.ok || !castle.ok) throw new Error('Failed to place buildings');

      woodcutter.building.state = BuildingState.Active;
      castle.building.state = BuildingState.Active;
      woodcutter.building.outputInventory[ResourceType.Wood] = 20;

      logistics.update(1.0); // Creates flags

      const f1 = roadNetwork.getFlagAt(4, 4)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.getFlagAt(6, 4)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      // Run multiple routing cycles
      for (let i = 0; i < 5; i++) {
        logistics.update(1.0);
      }

      // Flag should not exceed 8 goods
      expect(f1.goods.length).toBeLessThanOrEqual(8);
    });

    it('should prefer production buildings over storage', () => {
      const woodcutter = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);
      const castle = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 4 }, 1);
      if (!woodcutter.ok || !sawmill.ok || !castle.ok) throw new Error('Failed to place buildings');

      woodcutter.building.state = BuildingState.Active;
      sawmill.building.state = BuildingState.Active;
      castle.building.state = BuildingState.Active;
      woodcutter.building.outputInventory[ResourceType.Wood] = 1;

      logistics.update(1.0); // Creates flags

      const f1 = roadNetwork.getFlagAt(4, 4)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.getFlagAt(6, 4)!;
      const f4 = roadNetwork.placeFlag({ q: 7, r: 4 }, 1)!;
      const f5 = roadNetwork.getFlagAt(8, 4)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);
      roadNetwork.connectFlags(f3.id, f4.id);
      roadNetwork.connectFlags(f4.id, f5.id);

      logistics.update(1.0);

      // Should route to sawmill (needs Wood), not Castle
      expect(f1.goods).toHaveLength(1);
      expect(f1.goods[0].destinationFlagId).toBe(f3.id);
    });

    it('should not over-supply a building', () => {
      const woodcutter = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);
      if (!woodcutter.ok || !sawmill.ok) throw new Error('Failed to place buildings');

      woodcutter.building.state = BuildingState.Active;
      sawmill.building.state = BuildingState.Active;

      // Sawmill already has 2 Wood (2x the per-cycle amount of 1)
      sawmill.building.inputInventory[ResourceType.Wood] = 2;
      woodcutter.building.outputInventory[ResourceType.Wood] = 1;

      logistics.update(1.0); // Creates flags

      const f1 = roadNetwork.getFlagAt(4, 4)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.getFlagAt(6, 4)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      logistics.update(1.0);

      // Should not route — sawmill already has 2x input
      expect(f1.goods).toHaveLength(0);
    });
  });
});
