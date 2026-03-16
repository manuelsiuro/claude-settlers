import { TerrainType } from './TerrainType';
import type { ResourceType } from './ResourceType';

/**
 * Axial hex coordinates (q, r) using pointy-top hex orientation.
 * Reference: https://www.redblobgames.com/grids/hexagons/
 *
 * Pointy-top: vertex at top/bottom, flat edges at left/right.
 * Neighbors: 6 axial directions.
 *
 * Layout formula (pointy-top):
 *   x = size * sqrt(3) * (q + r/2)
 *   z = size * 3/2 * r
 */
export interface HexCoord {
  q: number;
  r: number;
}

/** Hidden ore deposit on a mountain tile, revealed by geologist prospecting */
export interface ResourceDeposit {
  resource: ResourceType; // 'iron_ore' | 'coal_ore' | 'gold_ore'
  revealed: boolean;      // hidden until geologist prospects
  claimed: boolean;       // true once mine is built
}

export interface HexTile {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
  deposit?: ResourceDeposit;
}

/** Hex size — distance from center to vertex */
export const HEX_SIZE = 1.0;

/** Pointy-top hex dimensions */
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;  // horizontal distance between parallel edges
export const HEX_HEIGHT = 2 * HEX_SIZE;             // vertical distance between top and bottom vertices

/** 6 axial neighbor directions */
const AXIAL_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export class HexGrid {
  readonly width: number;
  readonly height: number;
  private tiles: Map<string, HexTile>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = new Map();
  }

  /** Key for map lookup */
  static key(q: number, r: number): string {
    return `${q},${r}`;
  }

  /** Set a tile at the given coordinate */
  setTile(q: number, r: number, terrain: TerrainType, elevation = 0, deposit?: ResourceDeposit): void {
    const key = HexGrid.key(q, r);
    const tile: HexTile = { coord: { q, r }, terrain, elevation };
    if (deposit) tile.deposit = deposit;
    this.tiles.set(key, tile);
  }

  /** Get the resource deposit on a tile, if any */
  getDeposit(q: number, r: number): ResourceDeposit | undefined {
    const tile = this.getTile(q, r);
    return tile?.deposit;
  }

  /** Reveal a hidden deposit. Returns true if a deposit was revealed. */
  revealDeposit(q: number, r: number): boolean {
    const tile = this.getTile(q, r);
    if (!tile?.deposit || tile.deposit.revealed) return false;
    tile.deposit.revealed = true;
    return true;
  }

  /** Claim a deposit (when mine is built). Returns true if successful. */
  claimDeposit(q: number, r: number): boolean {
    const tile = this.getTile(q, r);
    if (!tile?.deposit || !tile.deposit.revealed || tile.deposit.claimed) return false;
    tile.deposit.claimed = true;
    return true;
  }

  /** Check if coordinates are within grid bounds */
  isInBounds(q: number, r: number): boolean {
    return q >= 0 && q < this.width && r >= 0 && r < this.height;
  }

  /** Get a tile at the given coordinate, or undefined if out of bounds */
  getTile(q: number, r: number): HexTile | undefined {
    if (!this.isInBounds(q, r)) return undefined;
    return this.tiles.get(HexGrid.key(q, r));
  }

  /** Get all tiles */
  getAllTiles(): HexTile[] {
    return Array.from(this.tiles.values());
  }

  /** Get the 6 neighbors of a hex, with world wrapping */
  getNeighbors(q: number, r: number): HexTile[] {
    const neighbors: HexTile[] = [];
    for (const dir of AXIAL_DIRECTIONS) {
      const tile = this.getTile(q + dir.q, r + dir.r);
      if (tile) {
        neighbors.push(tile);
      }
    }
    return neighbors;
  }

  /**
   * @deprecated World wrapping has been removed. Use isInBounds() instead.
   * Returns coords clamped to bounds for backwards compatibility.
   */
  wrap(q: number, r: number): HexCoord {
    return { q, r };
  }

  /**
   * Convert axial hex coord to world position (pointy-top).
   *   x = sqrt(3) * (q + r/2) * size
   *   z = 3/2 * r * size
   */
  static hexToWorld(q: number, r: number): { x: number; z: number } {
    const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
    const z = HEX_SIZE * 1.5 * r;
    return { x, z };
  }

  /** Convert world position to nearest axial hex coord */
  static worldToHex(x: number, z: number): HexCoord {
    const q = (x * Math.sqrt(3) / 3 - z / 3) / HEX_SIZE;
    const r = (z * 2 / 3) / HEX_SIZE;
    return HexGrid.hexRound(q, r);
  }

  /** Round fractional axial coordinates to nearest hex */
  static hexRound(q: number, r: number): HexCoord {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);

    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs - s);

    if (dq > dr && dq > ds) {
      rq = -rr - rs;
    } else if (dr > ds) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  }

  /** @deprecated World wrapping removed. Returns zero vectors. */
  getWrapVectors(): { wrapQ: { x: number; z: number }; wrapR: { x: number; z: number } } {
    return { wrapQ: { x: 0, z: 0 }, wrapR: { x: 0, z: 0 } };
  }

  /**
   * Standard axial hex distance between two coordinates.
   * Uses the cube-coordinate max formula.
   */
  static hexDistance(a: HexCoord, b: HexCoord): number {
    const dq = a.q - b.q;
    const dr = a.r - b.r;
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
  }

  /**
   * @deprecated World wrapping removed. Use hexDistance() instead.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static hexDistanceWrapped(a: HexCoord, b: HexCoord, _width: number, _height: number): number {
    return HexGrid.hexDistance(a, b);
  }

  /**
   * BFS from `coord` outward through hex neighbors,
   * returning the distance to the nearest tile matching `terrain`.
   * If the building's own tile matches, distance is 0.
   * Max search radius defaults to 20.
   */
  findNearestTerrain(coord: HexCoord, terrain: TerrainType, maxRadius = 20): number {
    const startTile = this.getTile(coord.q, coord.r);
    if (startTile && startTile.terrain === terrain) return 0;

    const visited = new Set<string>();
    visited.add(HexGrid.key(coord.q, coord.r));

    let frontier: HexCoord[] = [coord];

    for (let dist = 1; dist <= maxRadius; dist++) {
      const nextFrontier: HexCoord[] = [];
      for (const pos of frontier) {
        const neighbors = this.getNeighbors(pos.q, pos.r);
        for (const neighbor of neighbors) {
          const key = HexGrid.key(neighbor.coord.q, neighbor.coord.r);
          if (visited.has(key)) continue;
          visited.add(key);

          if (neighbor.terrain === terrain) return dist;
          nextFrontier.push(neighbor.coord);
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    return maxRadius;
  }

  /**
   * Check if two coordinates are connected by a contiguous water body.
   * Finds water tiles adjacent to `startCoord`, then BFS through water tiles,
   * returning true if any water tile adjacent to `endCoord` is reached.
   */
  findWaterConnection(startCoord: HexCoord, endCoord: HexCoord): boolean {
    // Find water entry points adjacent to start
    const startWater: HexCoord[] = [];
    for (const n of this.getNeighbors(startCoord.q, startCoord.r)) {
      if (n.terrain === TerrainType.Water) startWater.push(n.coord);
    }
    if (startWater.length === 0) return false;

    // Find water tiles adjacent to end (our targets)
    const endWaterKeys = new Set<string>();
    for (const n of this.getNeighbors(endCoord.q, endCoord.r)) {
      if (n.terrain === TerrainType.Water) endWaterKeys.add(HexGrid.key(n.coord.q, n.coord.r));
    }
    if (endWaterKeys.size === 0) return false;

    // BFS through water tiles
    const visited = new Set<string>();
    const queue: HexCoord[] = [];
    for (const wc of startWater) {
      const k = HexGrid.key(wc.q, wc.r);
      if (endWaterKeys.has(k)) return true;
      visited.add(k);
      queue.push(wc);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const n of this.getNeighbors(current.q, current.r)) {
        if (n.terrain !== TerrainType.Water) continue;
        const k = HexGrid.key(n.coord.q, n.coord.r);
        if (visited.has(k)) continue;
        visited.add(k);
        if (endWaterKeys.has(k)) return true;
        queue.push(n.coord);
      }
    }

    return false;
  }

  /** Total number of tiles */
  get size(): number {
    return this.tiles.size;
  }
}
