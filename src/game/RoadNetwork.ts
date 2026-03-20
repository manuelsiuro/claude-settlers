import type { HexCoord } from './HexGrid';
import { HexGrid } from './HexGrid';
import type { ResourceType } from './ResourceType';

/** A good waiting at a flag to be transported toward its destination */
export interface FlagGood {
  resource: ResourceType;
  /** Final destination flag ID */
  destinationFlagId: string;
}

/**
 * A Flag is a logistics node placed on a hex tile.
 * Goods are picked up and dropped off at Flags.
 * Buildings automatically have a flag at their location.
 */
export interface Flag {
  id: string;
  coord: HexCoord;
  playerId: number;
  /** Goods waiting at this flag to be transported */
  goods: FlagGood[];
  /** Building ID associated with this flag (if any) */
  buildingId: string | null;
}

/**
 * A Road segment connects two adjacent Flags.
 * Only one Transporter operates on each road segment.
 */
export interface Road {
  id: string;
  flagA: string; // Flag ID
  flagB: string; // Flag ID
  /** Unit ID of the transporter assigned to this road, or null */
  transporterId: string | null;
  /** True for harbor water routes (not physical roads) */
  virtual?: boolean;
  /** Road quality level: 0=path, 1=dirt, 2=stone, 3=paved */
  quality: number;
}

let nextFlagId = 1;
let nextRoadId = 1;

/**
 * Manages the flag-and-road logistics network.
 * Flags are nodes; Roads are edges. Together they form a graph
 * that transporters use to move goods between buildings.
 */
export class RoadNetwork {
  private flags: Map<string, Flag> = new Map();
  private flagsByCoord: Map<string, string> = new Map(); // coordKey → flagId
  private roads: Map<string, Road> = new Map();
  /** Adjacency list: flagId → Set of connected flagIds */
  private adjacency: Map<string, Set<string>> = new Map();
  /** Road lookup by flag pair: "flagA:flagB" → roadId (sorted IDs) */
  private roadByFlags: Map<string, string> = new Map();
  private grid: HexGrid;

  constructor(grid: HexGrid) {
    this.grid = grid;
  }

  // ===================================================================
  // Flags
  // ===================================================================

  /** Place a flag at a hex coordinate. Returns the flag or null if invalid. */
  placeFlag(coord: HexCoord, playerId: number): Flag | null {
    if (!this.grid.isInBounds(coord.q, coord.r)) return null;
    const key = HexGrid.key(coord.q, coord.r);

    // Can't place two flags on same tile
    if (this.flagsByCoord.has(key)) return null;

    // Must be on a walkable tile
    const tile = this.grid.getTile(coord.q, coord.r);
    if (!tile || tile.terrain === 'water') return null;

    const flag: Flag = {
      id: `flag_${nextFlagId++}`,
      coord: { q: coord.q, r: coord.r },
      playerId,
      goods: [],
      buildingId: null,
    };

    this.flags.set(flag.id, flag);
    this.flagsByCoord.set(key, flag.id);
    this.adjacency.set(flag.id, new Set());

    return flag;
  }

  /** Get a flag by ID */
  getFlag(id: string): Flag | undefined {
    return this.flags.get(id);
  }

  /** Get the flag at a hex coordinate */
  getFlagAt(q: number, r: number): Flag | undefined {
    if (!this.grid.isInBounds(q, r)) return undefined;
    const key = HexGrid.key(q, r);
    const flagId = this.flagsByCoord.get(key);
    if (!flagId) return undefined;
    return this.flags.get(flagId);
  }

  /** Get all flags */
  getAllFlags(): Flag[] {
    return Array.from(this.flags.values());
  }

  /** Remove a flag and all its connected roads */
  removeFlag(id: string): boolean {
    const flag = this.flags.get(id);
    if (!flag) return false;

    // Remove all connected roads
    const connected = this.adjacency.get(id);
    if (connected) {
      for (const neighborId of connected) {
        const roadKey = this.makeRoadKey(id, neighborId);
        const roadId = this.roadByFlags.get(roadKey);
        if (roadId) {
          this.roads.delete(roadId);
          this.roadByFlags.delete(roadKey);
        }
        // Remove from neighbor's adjacency
        this.adjacency.get(neighborId)?.delete(id);
      }
    }

    this.adjacency.delete(id);
    this.flagsByCoord.delete(HexGrid.key(flag.coord.q, flag.coord.r));
    this.flags.delete(id);
    return true;
  }

  // ===================================================================
  // Roads
  // ===================================================================

  /** Connect two flags with a road. Returns the road or null if invalid. */
  connectFlags(flagAId: string, flagBId: string): Road | null {
    if (flagAId === flagBId) return null;

    const flagA = this.flags.get(flagAId);
    const flagB = this.flags.get(flagBId);
    if (!flagA || !flagB) return null;

    // Check if already connected
    const roadKey = this.makeRoadKey(flagAId, flagBId);
    if (this.roadByFlags.has(roadKey)) return null;

    // Flags must be on neighboring hexes
    if (!this.areNeighbors(flagA.coord, flagB.coord)) return null;

    const road: Road = {
      id: `road_${nextRoadId++}`,
      flagA: flagAId,
      flagB: flagBId,
      transporterId: null,
      quality: 0,
    };

    this.roads.set(road.id, road);
    this.roadByFlags.set(roadKey, road.id);
    this.adjacency.get(flagAId)?.add(flagBId);
    this.adjacency.get(flagBId)?.add(flagAId);

    return road;
  }

  /** Get a road by ID */
  getRoad(id: string): Road | undefined {
    return this.roads.get(id);
  }

  /** Get the road between two flags */
  getRoadBetween(flagAId: string, flagBId: string): Road | undefined {
    const roadKey = this.makeRoadKey(flagAId, flagBId);
    const roadId = this.roadByFlags.get(roadKey);
    if (!roadId) return undefined;
    return this.roads.get(roadId);
  }

  /** Get all roads */
  getAllRoads(): Road[] {
    return Array.from(this.roads.values());
  }

  /** Get all roads connected to a flag */
  getRoadsForFlag(flagId: string): Road[] {
    const connected = this.adjacency.get(flagId);
    if (!connected) return [];

    const roads: Road[] = [];
    for (const neighborId of connected) {
      const roadKey = this.makeRoadKey(flagId, neighborId);
      const roadId = this.roadByFlags.get(roadKey);
      if (roadId) {
        const road = this.roads.get(roadId);
        if (road) roads.push(road);
      }
    }
    return roads;
  }

  /**
   * Check if removing a road would disconnect the road network.
   * Uses BFS to test if flagA and flagB would still be connected
   * via other roads if this road were removed.
   */
  wouldDisconnect(id: string): boolean {
    const road = this.roads.get(id);
    if (!road) return false;

    // Temporarily remove the road from adjacency
    this.adjacency.get(road.flagA)?.delete(road.flagB);
    this.adjacency.get(road.flagB)?.delete(road.flagA);

    // BFS from flagA — can we still reach flagB?
    const visited = new Set<string>();
    const queue: string[] = [road.flagA];
    visited.add(road.flagA);
    let connected = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === road.flagB) {
        connected = true;
        break;
      }
      const neighbors = this.adjacency.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    // Restore the road in adjacency
    this.adjacency.get(road.flagA)?.add(road.flagB);
    this.adjacency.get(road.flagB)?.add(road.flagA);

    return !connected;
  }

  /**
   * Create a virtual road between two flags, skipping the adjacency check.
   * Used by HarborManager for water routes.
   */
  createVirtualRoad(flagAId: string, flagBId: string): Road | null {
    if (flagAId === flagBId) return null;

    const flagA = this.flags.get(flagAId);
    const flagB = this.flags.get(flagBId);
    if (!flagA || !flagB) return null;

    const roadKey = this.makeRoadKey(flagAId, flagBId);
    if (this.roadByFlags.has(roadKey)) return null;

    const road: Road = {
      id: `road_${nextRoadId++}`,
      flagA: flagAId,
      flagB: flagBId,
      transporterId: null,
      virtual: true,
      quality: 0,
    };

    this.roads.set(road.id, road);
    this.roadByFlags.set(roadKey, road.id);
    this.adjacency.get(flagAId)?.add(flagBId);
    this.adjacency.get(flagBId)?.add(flagAId);

    return road;
  }

  /** Remove a virtual road by ID. Returns true if found and removed. */
  removeVirtualRoad(id: string): boolean {
    const road = this.roads.get(id);
    if (!road || !road.virtual) return false;
    return this.removeRoad(id);
  }

  /** Upgrade a road's quality level (0=path, 1=dirt, 2=stone, 3=paved). Returns new quality or -1 if invalid. */
  upgradeRoad(id: string, newQuality: number): number {
    const road = this.roads.get(id);
    if (!road || road.virtual) return -1;
    road.quality = Math.max(0, Math.min(3, newQuality));
    return road.quality;
  }

  /** Remove a road */
  removeRoad(id: string): boolean {
    const road = this.roads.get(id);
    if (!road) return false;

    const roadKey = this.makeRoadKey(road.flagA, road.flagB);
    this.roadByFlags.delete(roadKey);
    this.adjacency.get(road.flagA)?.delete(road.flagB);
    this.adjacency.get(road.flagB)?.delete(road.flagA);
    this.roads.delete(id);
    return true;
  }

  // ===================================================================
  // Graph queries
  // ===================================================================

  /** Get flag IDs connected to a flag */
  getConnectedFlags(flagId: string): string[] {
    const connected = this.adjacency.get(flagId);
    return connected ? Array.from(connected) : [];
  }

  /** Check if two flags are directly connected by a road */
  areConnected(flagAId: string, flagBId: string): boolean {
    return this.adjacency.get(flagAId)?.has(flagBId) ?? false;
  }

  /**
   * Find the shortest path between two flags using BFS on the road network.
   * Returns an array of flag IDs (including start and end), or empty if unreachable.
   */
  findRoute(startFlagId: string, endFlagId: string): string[] {
    if (startFlagId === endFlagId) return [startFlagId];
    if (!this.flags.has(startFlagId) || !this.flags.has(endFlagId)) return [];

    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue: string[] = [startFlagId];
    visited.add(startFlagId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      const neighbors = this.adjacency.get(current);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        parent.set(neighbor, current);

        if (neighbor === endFlagId) {
          // Reconstruct path
          const path: string[] = [endFlagId];
          let node = endFlagId;
          while (parent.has(node)) {
            node = parent.get(node)!;
            path.unshift(node);
          }
          return path;
        }

        queue.push(neighbor);
      }
    }

    return []; // Unreachable
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  /** Check if two hex coords are neighbors (adjacent hexes) */
  private areNeighbors(a: HexCoord, b: HexCoord): boolean {
    const neighbors = this.grid.getNeighbors(a.q, a.r);
    return neighbors.some((n) => n.coord.q === b.q && n.coord.r === b.r);
  }

  /** Create a sorted key for a flag pair (order-independent) */
  private makeRoadKey(flagAId: string, flagBId: string): string {
    return flagAId < flagBId ? `${flagAId}:${flagBId}` : `${flagBId}:${flagAId}`;
  }

  /** Serialization: get all internal state for save */
  _getState(): {
    flags: Flag[];
    roads: Road[];
  } {
    return {
      flags: Array.from(this.flags.values()),
      roads: Array.from(this.roads.values()),
    };
  }

  /** Serialization: restore all internal state from save */
  _loadState(state: {
    flags: Flag[];
    roads: Road[];
  }): void {
    this.flags.clear();
    this.flagsByCoord.clear();
    this.roads.clear();
    this.adjacency.clear();
    this.roadByFlags.clear();

    for (const flag of state.flags) {
      this.flags.set(flag.id, flag);
      const key = HexGrid.key(flag.coord.q, flag.coord.r);
      this.flagsByCoord.set(key, flag.id);
      this.adjacency.set(flag.id, new Set());
    }

    for (const road of state.roads) {
      this.roads.set(road.id, road);
      const roadKey = this.makeRoadKey(road.flagA, road.flagB);
      this.roadByFlags.set(roadKey, road.id);
      this.adjacency.get(road.flagA)?.add(road.flagB);
      this.adjacency.get(road.flagB)?.add(road.flagA);
    }
  }
}

/** Reset ID counters (for testing) */
export function resetRoadNetworkIdCounters(): void {
  nextFlagId = 1;
  nextRoadId = 1;
}

/** Get the current ID counter values (for serialization) */
export function getRoadNetworkIdCounters(): { nextFlagId: number; nextRoadId: number } {
  return { nextFlagId, nextRoadId };
}

/** Set the ID counter values (for deserialization) */
export function setRoadNetworkIdCounters(counters: { nextFlagId: number; nextRoadId: number }): void {
  nextFlagId = counters.nextFlagId;
  nextRoadId = counters.nextRoadId;
}
