import { BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState } from './Building';
import { UnitType } from './UnitType';
import type { GameState } from './GameState';
import { HexGrid } from './HexGrid';

/** Visibility states */
const UNEXPLORED = 0;
const EXPLORED = 1;
const VISIBLE = 2;

/**
 * Manages fog of war visibility per player.
 *
 * Three states per hex:
 *   0 = Unexplored — never seen
 *   1 = Explored   — previously visible, now in fog
 *   2 = Visible    — currently visible by a vision source
 *
 * Vision sources are active military buildings (with visionRadius > 0) and units.
 * Regular units have vision radius 2; knights have vision radius 3.
 *
 * Uses a dirty flag pattern (like TerritoryManager): markDirty() sets the flag,
 * update() recalculates only when dirty.
 */
export class FogOfWarManager {
  private gameState: GameState;
  private visibility: Map<number, Uint8Array>; // playerId → visibility array
  private dirty = true;
  private version = 0;
  private width: number;
  private height: number;

  constructor(gameState: GameState) {
    this.gameState = gameState;
    this.visibility = new Map();
    const grid = gameState.getGrid();
    this.width = grid.width;
    this.height = grid.height;
  }

  /** Mark visibility as needing recalculation */
  markDirty(): void {
    this.dirty = true;
  }

  /** Update visibility if dirty. Call each frame (cheap if clean). */
  update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.recalculate();
    this.version++;
  }

  /** Get the current visibility version (increments on every recalculation) */
  getVersion(): number {
    return this.version;
  }

  /**
   * Get the visibility state for a hex.
   * @returns 0=unexplored, 1=explored, 2=visible
   */
  getVisibility(q: number, r: number, playerId: number): number {
    const arr = this.visibility.get(playerId);
    if (!arr) return UNEXPLORED;
    const grid = this.gameState.getGrid();
    const wrapped = grid.wrap(q, r);
    return arr[this.index(wrapped.q, wrapped.r)];
  }

  /** Check if a hex is currently visible (state 2) */
  isVisible(q: number, r: number, playerId: number): boolean {
    return this.getVisibility(q, r, playerId) === VISIBLE;
  }

  /** Check if a hex has been explored (state 1 or 2) */
  isExplored(q: number, r: number, playerId: number): boolean {
    return this.getVisibility(q, r, playerId) >= EXPLORED;
  }

  /** Get the raw visibility array for a player (for rendering) */
  getVisibilityArray(playerId: number): Uint8Array | undefined {
    return this.visibility.get(playerId);
  }

  /** Serialization: get internal state for save */
  _getState(): { players: { playerId: number; data: string }[]; version: number } {
    const players: { playerId: number; data: string }[] = [];
    for (const [playerId, arr] of this.visibility) {
      // Convert Uint8Array to base64
      let binary = '';
      for (let i = 0; i < arr.length; i++) {
        binary += String.fromCharCode(arr[i]);
      }
      players.push({ playerId, data: btoa(binary) });
    }
    return { players, version: this.version };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { players: { playerId: number; data: string }[]; version: number }): void {
    this.visibility.clear();
    for (const { playerId, data } of state.players) {
      const binary = atob(data);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        arr[i] = binary.charCodeAt(i);
      }
      this.visibility.set(playerId, arr);
    }
    this.version = state.version;
    this.dirty = false;
  }

  /**
   * Recalculate visibility for all players.
   *
   * Algorithm:
   * 1. For each player with visibility data:
   *    a. Reset all VISIBLE(2) → EXPLORED(1) (unexplored stays 0)
   *    b. Collect vision sources:
   *       - Active buildings with visionRadius > 0 belonging to this player
   *       - Units belonging to this player (radius 2, knights radius 3)
   *    c. For each source, BFS flood fill up to radius, marking hexes as VISIBLE(2)
   *    d. BFS wraps coordinates via grid.wrap() and does NOT stop at water
   */
  private recalculate(): void {
    const grid = this.gameState.getGrid();
    const buildings = this.gameState.getAllBuildings();
    const units = this.gameState.getAllUnits();

    // Collect vision sources grouped by player
    const sourcesByPlayer: Map<number, { q: number; r: number; radius: number }[]> = new Map();

    // Building vision sources
    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.visionRadius <= 0) continue;

      let sources = sourcesByPlayer.get(building.playerId);
      if (!sources) {
        sources = [];
        sourcesByPlayer.set(building.playerId, sources);
      }
      sources.push({
        q: building.coord.q,
        r: building.coord.r,
        radius: def.visionRadius,
      });

      // Ensure player has a visibility array
      this.ensurePlayer(building.playerId);
    }

    // Unit vision sources
    for (const unit of units) {
      const radius = unit.type === UnitType.Knight ? 3 : 2;

      let sources = sourcesByPlayer.get(unit.playerId);
      if (!sources) {
        sources = [];
        sourcesByPlayer.set(unit.playerId, sources);
      }
      sources.push({
        q: unit.coord.q,
        r: unit.coord.r,
        radius,
      });

      // Ensure player has a visibility array
      this.ensurePlayer(unit.playerId);
    }

    // For each player, reset visible → explored, then re-mark visible hexes
    for (const [playerId, arr] of this.visibility) {
      // Step 1: Reset all VISIBLE(2) → EXPLORED(1)
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === VISIBLE) {
          arr[i] = EXPLORED;
        }
      }

      // Step 2: BFS from each vision source, marking hexes as VISIBLE(2)
      const sources = sourcesByPlayer.get(playerId);
      if (!sources) continue;

      for (const source of sources) {
        this.floodFillVision(grid, arr, source.q, source.r, source.radius);
      }
    }
  }

  /**
   * BFS flood fill from a source, marking hexes as VISIBLE(2) up to the given radius.
   * Does NOT stop at water. Wraps coordinates via grid.wrap().
   */
  private floodFillVision(
    grid: HexGrid,
    arr: Uint8Array,
    sourceQ: number,
    sourceR: number,
    radius: number,
  ): void {
    const startWrapped = grid.wrap(sourceQ, sourceR);
    const startIdx = this.index(startWrapped.q, startWrapped.r);

    // Mark the source hex as visible
    arr[startIdx] = VISIBLE;

    // BFS queue: [q, r, distance]
    const queue: [number, number, number][] = [[startWrapped.q, startWrapped.r, 0]];
    const visited = new Set<number>();
    visited.add(startIdx);

    while (queue.length > 0) {
      const [q, r, dist] = queue.shift()!;

      if (dist >= radius) continue;

      const neighbors = grid.getNeighbors(q, r);
      for (const neighbor of neighbors) {
        const nq = neighbor.coord.q;
        const nr = neighbor.coord.r;
        const nIdx = this.index(nq, nr);

        if (visited.has(nIdx)) continue;
        visited.add(nIdx);

        // Mark as visible (water does NOT block vision)
        arr[nIdx] = VISIBLE;

        queue.push([nq, nr, dist + 1]);
      }
    }
  }

  /** Convert (q, r) to a flat array index */
  private index(q: number, r: number): number {
    return q * this.height + r;
  }

  /** Ensure a player has a visibility array, creating one if needed */
  private ensurePlayer(playerId: number): Uint8Array {
    let arr = this.visibility.get(playerId);
    if (!arr) {
      arr = new Uint8Array(this.width * this.height);
      this.visibility.set(playerId, arr);
    }
    return arr;
  }
}
