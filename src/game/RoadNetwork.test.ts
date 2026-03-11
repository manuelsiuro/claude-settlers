import { describe, it, expect, beforeEach } from 'vitest';
import { RoadNetwork, resetRoadNetworkIdCounters } from './RoadNetwork';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';

describe('RoadNetwork', () => {
  let grid: HexGrid;
  let network: RoadNetwork;

  beforeEach(() => {
    resetRoadNetworkIdCounters();

    grid = new HexGrid(16, 16);
    for (let q = 0; q < 16; q++) {
      for (let r = 0; r < 16; r++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.5);
      }
    }
    grid.setTile(5, 5, TerrainType.Water, 0.1);

    network = new RoadNetwork(grid);
  });

  describe('flags', () => {
    it('should place a flag on a valid tile', () => {
      const flag = network.placeFlag({ q: 4, r: 4 }, 1);
      expect(flag).not.toBeNull();
      expect(flag!.id).toBe('flag_1');
      expect(flag!.coord).toEqual({ q: 4, r: 4 });
      expect(flag!.playerId).toBe(1);
    });

    it('should not place a flag on water', () => {
      const flag = network.placeFlag({ q: 5, r: 5 }, 1);
      expect(flag).toBeNull();
    });

    it('should not place two flags on the same tile', () => {
      network.placeFlag({ q: 4, r: 4 }, 1);
      const second = network.placeFlag({ q: 4, r: 4 }, 1);
      expect(second).toBeNull();
    });

    it('should get flag by ID', () => {
      const flag = network.placeFlag({ q: 4, r: 4 }, 1);
      expect(network.getFlag(flag!.id)).toBe(flag);
    });

    it('should get flag at coordinate', () => {
      const flag = network.placeFlag({ q: 4, r: 4 }, 1);
      expect(network.getFlagAt(4, 4)).toBe(flag);
    });

    it('should return undefined for empty coordinate', () => {
      expect(network.getFlagAt(4, 4)).toBeUndefined();
    });

    it('should get all flags', () => {
      network.placeFlag({ q: 4, r: 4 }, 1);
      network.placeFlag({ q: 6, r: 6 }, 1);
      expect(network.getAllFlags()).toHaveLength(2);
    });

    it('should remove a flag', () => {
      const flag = network.placeFlag({ q: 4, r: 4 }, 1);
      expect(network.removeFlag(flag!.id)).toBe(true);
      expect(network.getFlag(flag!.id)).toBeUndefined();
      expect(network.getFlagAt(4, 4)).toBeUndefined();
    });

    it('should wrap coordinates when placing flags', () => {
      const flag = network.placeFlag({ q: 20, r: 20 }, 1); // wraps to (4, 4) on 16x16
      expect(flag).not.toBeNull();
      expect(flag!.coord).toEqual({ q: 4, r: 4 });
    });
  });

  describe('roads', () => {
    it('should connect two adjacent flags', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!; // neighbor in hex grid
      const road = network.connectFlags(f1.id, f2.id);
      expect(road).not.toBeNull();
      expect(road!.flagA).toBe(f1.id);
      expect(road!.flagB).toBe(f2.id);
      expect(road!.transporterId).toBeNull();
    });

    it('should not connect non-adjacent flags', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 8, r: 8 }, 1)!; // too far
      const road = network.connectFlags(f1.id, f2.id);
      expect(road).toBeNull();
    });

    it('should not connect a flag to itself', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      expect(network.connectFlags(f1.id, f1.id)).toBeNull();
    });

    it('should not create duplicate roads', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      network.connectFlags(f1.id, f2.id);
      const duplicate = network.connectFlags(f1.id, f2.id);
      expect(duplicate).toBeNull();
    });

    it('should not create duplicate roads (reverse order)', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      network.connectFlags(f1.id, f2.id);
      const duplicate = network.connectFlags(f2.id, f1.id);
      expect(duplicate).toBeNull();
    });

    it('should get road between two flags', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      const road = network.connectFlags(f1.id, f2.id)!;
      expect(network.getRoadBetween(f1.id, f2.id)).toBe(road);
      expect(network.getRoadBetween(f2.id, f1.id)).toBe(road); // order independent
    });

    it('should get all roads for a flag', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = network.placeFlag({ q: 4, r: 5 }, 1)!;
      network.connectFlags(f1.id, f2.id);
      network.connectFlags(f1.id, f3.id);
      expect(network.getRoadsForFlag(f1.id)).toHaveLength(2);
      expect(network.getRoadsForFlag(f2.id)).toHaveLength(1);
    });

    it('should remove a road', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      const road = network.connectFlags(f1.id, f2.id)!;
      expect(network.removeRoad(road.id)).toBe(true);
      expect(network.getRoadBetween(f1.id, f2.id)).toBeUndefined();
      expect(network.areConnected(f1.id, f2.id)).toBe(false);
    });

    it('should remove connected roads when flag is removed', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      network.connectFlags(f1.id, f2.id);
      network.removeFlag(f1.id);
      expect(network.getAllRoads()).toHaveLength(0);
      expect(network.getRoadsForFlag(f2.id)).toHaveLength(0);
    });
  });

  describe('graph queries', () => {
    it('should check if two flags are connected', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      expect(network.areConnected(f1.id, f2.id)).toBe(false);
      network.connectFlags(f1.id, f2.id);
      expect(network.areConnected(f1.id, f2.id)).toBe(true);
    });

    it('should get connected flag IDs', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = network.placeFlag({ q: 4, r: 5 }, 1)!;
      network.connectFlags(f1.id, f2.id);
      network.connectFlags(f1.id, f3.id);

      const connected = network.getConnectedFlags(f1.id);
      expect(connected).toHaveLength(2);
      expect(connected).toContain(f2.id);
      expect(connected).toContain(f3.id);
    });
  });

  describe('route finding (BFS)', () => {
    it('should find direct route between connected flags', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      network.connectFlags(f1.id, f2.id);

      const route = network.findRoute(f1.id, f2.id);
      expect(route).toEqual([f1.id, f2.id]);
    });

    it('should find route through intermediate flags', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 5, r: 4 }, 1)!;
      const f3 = network.placeFlag({ q: 6, r: 4 }, 1)!;
      network.connectFlags(f1.id, f2.id);
      network.connectFlags(f2.id, f3.id);

      const route = network.findRoute(f1.id, f3.id);
      expect(route).toEqual([f1.id, f2.id, f3.id]);
    });

    it('should return empty for unreachable flags', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 8, r: 8 }, 1)!;
      // No road between them

      const route = network.findRoute(f1.id, f2.id);
      expect(route).toEqual([]);
    });

    it('should return single element for same start and end', () => {
      const f1 = network.placeFlag({ q: 4, r: 4 }, 1)!;
      expect(network.findRoute(f1.id, f1.id)).toEqual([f1.id]);
    });

    it('should find shortest path in a network', () => {
      // Create a diamond: f1-f2-f4 and f1-f3-f4
      const f1 = network.placeFlag({ q: 8, r: 4 }, 1)!;
      const f2 = network.placeFlag({ q: 9, r: 4 }, 1)!;
      const f3 = network.placeFlag({ q: 8, r: 5 }, 1)!;
      const f4 = network.placeFlag({ q: 9, r: 5 }, 1)!;

      network.connectFlags(f1.id, f2.id);
      network.connectFlags(f2.id, f4.id);
      network.connectFlags(f1.id, f3.id);
      network.connectFlags(f3.id, f4.id);

      // Both paths are length 2, BFS finds the first one
      const route = network.findRoute(f1.id, f4.id);
      expect(route).toHaveLength(3);
      expect(route[0]).toBe(f1.id);
      expect(route[2]).toBe(f4.id);
    });
  });
});
