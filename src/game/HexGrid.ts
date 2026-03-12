import { TerrainType } from './TerrainType';

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

export interface HexTile {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
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
  setTile(q: number, r: number, terrain: TerrainType, elevation = 0): void {
    const key = HexGrid.key(q, r);
    this.tiles.set(key, { coord: { q, r }, terrain, elevation });
  }

  /** Get a tile, applying world wrapping */
  getTile(q: number, r: number): HexTile | undefined {
    const wrapped = this.wrap(q, r);
    return this.tiles.get(HexGrid.key(wrapped.q, wrapped.r));
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

  /** Wrap coordinates for world wrapping */
  wrap(q: number, r: number): HexCoord {
    const col = ((q % this.width) + this.width) % this.width;
    const row = ((r % this.height) + this.height) % this.height;
    return { q: col, r: row };
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

  /**
   * Compute the world-space wrapping vectors for this grid.
   * wrapQ = offset when shifting by grid.width in q direction
   * wrapR = offset when shifting by grid.height in r direction
   */
  getWrapVectors(): { wrapQ: { x: number; z: number }; wrapR: { x: number; z: number } } {
    const wrapQ = HexGrid.hexToWorld(this.width, 0);
    const wrapR = HexGrid.hexToWorld(0, this.height);
    return { wrapQ, wrapR };
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
   * BFS from `coord` outward through hex neighbors (with world wrapping),
   * returning the distance to the nearest tile matching `terrain`.
   * If the building's own tile matches, distance is 0.
   * Max search radius defaults to 20.
   */
  findNearestTerrain(coord: HexCoord, terrain: TerrainType, maxRadius = 20): number {
    const wrapped = this.wrap(coord.q, coord.r);
    const startTile = this.getTile(wrapped.q, wrapped.r);
    if (startTile && startTile.terrain === terrain) return 0;

    const visited = new Set<string>();
    visited.add(HexGrid.key(wrapped.q, wrapped.r));

    let frontier: HexCoord[] = [wrapped];

    for (let dist = 1; dist <= maxRadius; dist++) {
      const nextFrontier: HexCoord[] = [];
      for (const pos of frontier) {
        for (const dir of AXIAL_DIRECTIONS) {
          const nw = this.wrap(pos.q + dir.q, pos.r + dir.r);
          const key = HexGrid.key(nw.q, nw.r);
          if (visited.has(key)) continue;
          visited.add(key);

          const tile = this.tiles.get(key);
          if (tile && tile.terrain === terrain) return dist;
          nextFrontier.push(nw);
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    return maxRadius;
  }

  /** Total number of tiles */
  get size(): number {
    return this.tiles.size;
  }
}
