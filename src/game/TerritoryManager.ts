import { BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState } from './Building';
import type { GameState } from './GameState';
import { HexGrid } from './HexGrid';
import { TerrainType } from './TerrainType';

/**
 * Manages territory influence for all players.
 *
 * Military buildings (Guard Hut, Watchtower, Barracks) and the Castle
 * project hex influence in a radius. The union of all influence hexes
 * for a player forms that player's territory.
 *
 * Territory is recalculated when buildings are placed, captured, or destroyed.
 */
export class TerritoryManager {
  private gameState: GameState;

  /**
   * Territory map: hex coord key → playerId who controls it.
   * A hex can only be controlled by one player (last-write wins when
   * multiple players overlap — closer building takes priority).
   */
  private territory: Map<string, number> = new Map();

  /** Dirty flag — set when buildings change and territory needs recalculation */
  private dirty = true;

  /** Monotonically increasing version — increments on every recalculation */
  private version = 0;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /** Mark territory as needing recalculation */
  markDirty(): void {
    this.dirty = true;
  }

  /** Update territory if dirty. Call each frame (cheap if clean). */
  update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.recalculate();
    this.version++;
  }

  /** Get the current territory version (increments on every recalculation) */
  getVersion(): number {
    return this.version;
  }

  /** Get the player who controls a hex, or null if unclaimed */
  getOwner(q: number, r: number): number | null {
    const grid = this.gameState.getGrid();
    const wrapped = grid.wrap(q, r);
    const key = HexGrid.key(wrapped.q, wrapped.r);
    return this.territory.get(key) ?? null;
  }

  /** Check if a player controls a specific hex */
  isOwnedBy(q: number, r: number, playerId: number): boolean {
    return this.getOwner(q, r) === playerId;
  }

  /** Get all hex coordinates controlled by a player */
  getPlayerTerritory(playerId: number): { q: number; r: number }[] {
    const result: { q: number; r: number }[] = [];
    for (const [key, owner] of this.territory) {
      if (owner === playerId) {
        const [q, r] = key.split(',').map(Number);
        result.push({ q, r });
      }
    }
    return result;
  }

  /** Get the full territory map (for rendering) */
  getTerritoryMap(): ReadonlyMap<string, number> {
    return this.territory;
  }

  /**
   * Recalculate all territory from scratch.
   *
   * Algorithm:
   * 1. Clear the territory map
   * 2. Collect all active buildings with influenceRadius > 0
   * 3. For each building, BFS flood-fill up to its radius
   * 4. Assign hexes to the building's owner, with closer buildings winning ties
   */
  private recalculate(): void {
    this.territory.clear();

    const grid = this.gameState.getGrid();
    const buildings = this.gameState.getAllBuildings();

    // Collect influence sources: { coord, playerId, radius }
    const sources: { q: number; r: number; playerId: number; radius: number }[] = [];

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.influenceRadius <= 0) continue;
      sources.push({
        q: building.coord.q,
        r: building.coord.r,
        playerId: building.playerId,
        radius: def.influenceRadius,
      });
    }

    // Distance map: coordKey → shortest distance from any source of that player
    // Used to resolve overlaps: closer building wins
    const distanceMap: Map<string, { playerId: number; distance: number }> = new Map();

    for (const source of sources) {
      this.floodFill(grid, source, distanceMap);
    }

    // Convert distance map to territory map
    for (const [key, { playerId }] of distanceMap) {
      this.territory.set(key, playerId);
    }
  }

  /**
   * BFS flood fill from a source building.
   * Spreads up to `radius` hexes, stopping at water tiles.
   * Updates distanceMap: closer sources take priority.
   */
  private floodFill(
    grid: HexGrid,
    source: { q: number; r: number; playerId: number; radius: number },
    distanceMap: Map<string, { playerId: number; distance: number }>,
  ): void {
    const startWrapped = grid.wrap(source.q, source.r);
    const startKey = HexGrid.key(startWrapped.q, startWrapped.r);

    // BFS queue: [q, r, distance]
    const queue: [number, number, number][] = [[startWrapped.q, startWrapped.r, 0]];
    const visited = new Set<string>();
    visited.add(startKey);

    // Claim the source hex
    const existing = distanceMap.get(startKey);
    if (!existing || 0 < existing.distance) {
      distanceMap.set(startKey, { playerId: source.playerId, distance: 0 });
    }

    while (queue.length > 0) {
      const [q, r, dist] = queue.shift()!;

      if (dist >= source.radius) continue;

      const neighbors = grid.getNeighbors(q, r);
      for (const neighbor of neighbors) {
        const nKey = HexGrid.key(neighbor.coord.q, neighbor.coord.r);

        if (visited.has(nKey)) continue;
        visited.add(nKey);

        // Water blocks territory expansion
        if (neighbor.terrain === TerrainType.Water) continue;

        const newDist = dist + 1;

        // Only claim if closer than existing claim
        const prev = distanceMap.get(nKey);
        if (!prev || newDist < prev.distance) {
          distanceMap.set(nKey, { playerId: source.playerId, distance: newDist });
        }

        queue.push([neighbor.coord.q, neighbor.coord.r, newDist]);
      }
    }
  }
}
