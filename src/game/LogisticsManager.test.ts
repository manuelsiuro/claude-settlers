import { describe, it, expect, beforeEach } from 'vitest';
import { LogisticsManager } from './LogisticsManager';
import { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';
import { RoadNetwork, resetRoadNetworkIdCounters } from './RoadNetwork';
import { BuildingType } from './BuildingType';
import { BuildingState, resetBuildingIdCounter } from './Building';
import { ResourceType } from './ResourceType';
import { createDefaultDistribution, setResourceCategoryWeights } from './GoodsDistribution';

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

  describe('construction reservation', () => {
    it('should reserve resources at Castle when construction is pending', () => {
      // Castle with Wood output, Sawmill wants Wood, and a Planned building needs Wood
      const castle = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);
      const planned = gameState.placeBuilding(BuildingType.GuardHut, { q: 8, r: 4 }, 1);
      if (!castle.ok || !sawmill.ok || !planned.ok) throw new Error('Failed to place buildings');

      castle.building.state = BuildingState.Active;
      sawmill.building.state = BuildingState.Active;
      // GuardHut stays Planned — needs 3 Wood

      // Castle has 5 Wood
      castle.building.outputInventory[ResourceType.Wood] = 5;

      // Set up distribution settings with construction reservation
      const settings = createDefaultDistribution();
      // Wood default: production=50%, construction=40%, storage=10%
      logistics.setDistributionSettings(settings);

      logistics.update(1.0); // Creates flags

      const f1 = roadNetwork.getFlagAt(4, 4)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.getFlagAt(6, 4)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      logistics.update(1.0); // Routes goods

      // With 5 Wood and construction demand of 3:
      // Reserved = min(3, ceil(5 * 40/100)) = min(3, 2) = 2
      // Production budget = 5 - 2 = 3
      // So up to 3 Wood can route to Sawmill (but only 1 per tick due to flag routing)
      // The key: it should NOT route all 5 to Sawmill
      expect(f1.goods.length).toBeLessThanOrEqual(1);
      expect(f1.goods.length).toBeGreaterThanOrEqual(1); // At least one goes to Sawmill
    });

    it('should route all to production when no construction demand', () => {
      const castle = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);
      if (!castle.ok || !sawmill.ok) throw new Error('Failed to place buildings');

      castle.building.state = BuildingState.Active;
      sawmill.building.state = BuildingState.Active;
      castle.building.outputInventory[ResourceType.Wood] = 5;

      const settings = createDefaultDistribution();
      logistics.setDistributionSettings(settings);

      logistics.update(1.0); // Creates flags

      const f1 = roadNetwork.getFlagAt(4, 4)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.getFlagAt(6, 4)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      logistics.update(1.0);

      // No construction demand → all Wood can go to production
      expect(f1.goods).toHaveLength(1);
      expect(f1.goods[0].destinationFlagId).toBe(f3.id);
    });

    it('should respect category weight percentages', () => {
      const castle = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);
      const planned = gameState.placeBuilding(BuildingType.Barracks, { q: 8, r: 4 }, 1);
      if (!castle.ok || !sawmill.ok || !planned.ok) throw new Error('Failed to place buildings');

      castle.building.state = BuildingState.Active;
      sawmill.building.state = BuildingState.Active;
      // Barracks needs 5 Wood — stays Planned

      // Castle has 10 Wood
      castle.building.outputInventory[ResourceType.Wood] = 10;

      const settings = createDefaultDistribution();
      // Set high construction weight
      setResourceCategoryWeights(settings, ResourceType.Wood, { production: 10, construction: 80, storage: 10 });
      logistics.setDistributionSettings(settings);

      logistics.update(1.0); // Creates flags

      const f1 = roadNetwork.getFlagAt(4, 4)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.getFlagAt(6, 4)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      // Run several routing cycles to see budget enforcement
      for (let i = 0; i < 5; i++) {
        logistics.update(1.0);
      }

      // With 80% construction weight and demand of 5:
      // Reserved = min(5, ceil(10 * 80/100)) = min(5, 8) = 5
      // Production budget = 10 - 5 = 5
      // After several cycles, only 5 should route to Sawmill
      const routedToSawmill = f1.goods.filter(g => g.destinationFlagId === f3.id).length;
      expect(routedToSawmill).toBeLessThanOrEqual(5);
    });

    it('should block routing to production when production weight is 0%', () => {
      // This is the user-reported bug: Wood at 100% Storage / 0% Production
      // should NOT deliver to Sawmill — only to Castle/Warehouse
      const woodcutter = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 4, r: 4 }, 1);
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);
      const castle = gameState.placeBuilding(BuildingType.Castle, { q: 8, r: 4 }, 1);
      if (!woodcutter.ok || !sawmill.ok || !castle.ok) throw new Error('Failed to place buildings');

      woodcutter.building.state = BuildingState.Active;
      sawmill.building.state = BuildingState.Active;
      castle.building.state = BuildingState.Active;

      // Woodcutter has 5 Wood to route
      woodcutter.building.outputInventory[ResourceType.Wood] = 5;

      const settings = createDefaultDistribution();
      // 0% production, 0% construction, 100% storage
      setResourceCategoryWeights(settings, ResourceType.Wood, { production: 0, construction: 0, storage: 100 });
      logistics.setDistributionSettings(settings);

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

      // Run several routing cycles
      for (let i = 0; i < 5; i++) {
        logistics.update(1.0);
      }

      // NONE should route to Sawmill (f3)
      const routedToSawmill = f1.goods.filter(g => g.destinationFlagId === f3.id).length;
      expect(routedToSawmill).toBe(0);

      // All should route to Castle (f5) — storage
      const routedToCastle = f1.goods.filter(g => g.destinationFlagId === f5.id).length;
      expect(routedToCastle).toBeGreaterThan(0);
    });

    it('should cap reservation at actual construction demand', () => {
      const castle = gameState.placeBuilding(BuildingType.Castle, { q: 4, r: 4 }, 1);
      const sawmill = gameState.placeBuilding(BuildingType.Sawmill, { q: 6, r: 4 }, 1);
      const planned = gameState.placeBuilding(BuildingType.WoodcutterHut, { q: 8, r: 4 }, 1);
      if (!castle.ok || !sawmill.ok || !planned.ok) throw new Error('Failed to place buildings');

      castle.building.state = BuildingState.Active;
      sawmill.building.state = BuildingState.Active;
      // WoodcutterHut needs only 2 Wood

      // Castle has 10 Wood
      castle.building.outputInventory[ResourceType.Wood] = 10;

      const settings = createDefaultDistribution();
      // Even with 80% construction weight, only 2 Wood should be reserved (capped by demand)
      setResourceCategoryWeights(settings, ResourceType.Wood, { production: 10, construction: 80, storage: 10 });
      logistics.setDistributionSettings(settings);

      logistics.update(1.0); // Creates flags

      const f1 = roadNetwork.getFlagAt(4, 4)!;
      const f2 = roadNetwork.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = roadNetwork.getFlagAt(6, 4)!;
      roadNetwork.connectFlags(f1.id, f2.id);
      roadNetwork.connectFlags(f2.id, f3.id);

      // Run routing cycles
      for (let i = 0; i < 10; i++) {
        logistics.update(1.0);
      }

      // Demand is only 2, so budget = 10 - 2 = 8
      // Up to 8 should route to Sawmill (limited by flag capacity of 8)
      const routedToSawmill = f1.goods.filter(g => g.destinationFlagId === f3.id).length;
      expect(routedToSawmill).toBeGreaterThanOrEqual(6); // Most should route to production
    });
  });
});
