import { HexGrid, HEX_SIZE } from './HexGrid';
import type { HexCoord } from './HexGrid';
import { TerrainType } from './TerrainType';
import { createRng } from './noise';
import type { GameState } from './GameState';
import {
  TREES_MAX_PER_TILE as MAX_TREES_PER_TILE,
  TREES_SAPLING_GROWTH_TIME as SAPLING_GROWTH_TIME,
  TREES_YOUNG_GROWTH_TIME as YOUNG_GROWTH_TIME,
} from './data/balanceConstants';

export interface TreeEntity {
  id: string;
  tileCoord: HexCoord;
  localX: number;
  localZ: number;
  modelType: 'tree_deciduous' | 'tree_conifer';
  growthStage: 'sapling' | 'young' | 'mature';
  growthProgress: number;
  rotationY: number;
  scale: number;
  markedForCut: boolean;
  markedBy: string | null;
}

let nextTreeId = 1;

export function resetTreeIdCounter(): void {
  nextTreeId = 1;
}

export function getTreeIdCounter(): number {
  return nextTreeId;
}

export function setTreeIdCounter(value: number): void {
  nextTreeId = value;
}

/**
 * Manages persistent tree entities across the game world.
 * Trees are created from forest tiles at initialization, and can be
 * added (by foresters) or removed (by woodcutters) during gameplay.
 */
export class TreeManager {
  private trees: Map<string, TreeEntity> = new Map();
  private treesByTile: Map<string, Set<string>> = new Map();
  private growingTrees: Set<string> = new Set();

  /** Callback when any tree is added, removed, or changes growth stage */
  onTreeChanged: (() => void) | null = null;

  /**
   * Initialize tree entities from the map's forest tiles.
   * Replicates the exact same RNG as MapRenderer.getForestPlacements()
   * so trees appear in identical positions.
   */
  initializeFromMap(grid: HexGrid): void {
    this.trees.clear();
    this.treesByTile.clear();
    this.growingTrees.clear();

    for (const tile of grid.getAllTiles()) {
      if (tile.terrain !== TerrainType.Forest) continue;

      const rng = createRng(tile.coord.q * 1000 + tile.coord.r);
      const treeCount = 5 + Math.floor(rng() * 6);

      for (let i = 0; i < treeCount; i++) {
        const isConifer = rng() > 0.5;
        const scale = 0.8 + rng() * 0.4;
        const rotationY = rng() * Math.PI * 2;
        const angle = rng() * Math.PI * 2;
        const dist = rng() * HEX_SIZE * 0.55;

        const localX = Math.cos(angle) * dist;
        const localZ = Math.sin(angle) * dist;

        const id = `tree_${nextTreeId++}`;
        const tree: TreeEntity = {
          id,
          tileCoord: { q: tile.coord.q, r: tile.coord.r },
          localX,
          localZ,
          modelType: isConifer ? 'tree_conifer' : 'tree_deciduous',
          growthStage: 'mature',
          growthProgress: 1.0,
          rotationY,
          scale,
          markedForCut: false,
          markedBy: null,
        };

        this.trees.set(id, tree);
        const tileKey = HexGrid.key(tile.coord.q, tile.coord.r);
        let tileSet = this.treesByTile.get(tileKey);
        if (!tileSet) {
          tileSet = new Set();
          this.treesByTile.set(tileKey, tileSet);
        }
        tileSet.add(id);
      }
    }
  }

  /** Add a new sapling tree */
  addTree(
    coord: HexCoord,
    modelType: 'tree_deciduous' | 'tree_conifer',
    localX: number,
    localZ: number,
    rotationY: number,
    scale: number,
  ): TreeEntity {
    const id = `tree_${nextTreeId++}`;
    const tree: TreeEntity = {
      id,
      tileCoord: { q: coord.q, r: coord.r },
      localX,
      localZ,
      modelType,
      growthStage: 'sapling',
      growthProgress: 0,
      rotationY,
      scale,
      markedForCut: false,
      markedBy: null,
    };

    this.trees.set(id, tree);
    const tileKey = HexGrid.key(coord.q, coord.r);
    let tileSet = this.treesByTile.get(tileKey);
    if (!tileSet) {
      tileSet = new Set();
      this.treesByTile.set(tileKey, tileSet);
    }
    tileSet.add(id);
    this.growingTrees.add(id);
    this.onTreeChanged?.();
    return tree;
  }

  /** Remove a tree by ID. Returns the tree's tile coord, or null if not found. */
  removeTree(id: string): HexCoord | null {
    const tree = this.trees.get(id);
    if (!tree) return null;

    this.trees.delete(id);
    this.growingTrees.delete(id);

    const tileKey = HexGrid.key(tree.tileCoord.q, tree.tileCoord.r);
    const tileSet = this.treesByTile.get(tileKey);
    if (tileSet) {
      tileSet.delete(id);
      if (tileSet.size === 0) {
        this.treesByTile.delete(tileKey);
      }
    }

    this.onTreeChanged?.();
    return { q: tree.tileCoord.q, r: tree.tileCoord.r };
  }

  /** Get a tree entity by ID */
  getTree(id: string): TreeEntity | undefined {
    return this.trees.get(id);
  }

  /** Get all tree entities */
  getAllTrees(): TreeEntity[] {
    return Array.from(this.trees.values());
  }

  /** Get the number of trees on a specific tile */
  getTreeCountOnTile(coord: HexCoord): number {
    const key = HexGrid.key(coord.q, coord.r);
    return this.treesByTile.get(key)?.size ?? 0;
  }

  /** BFS outward from origin to find the nearest unmarked mature tree within maxRadius */
  findNearestMatureTree(
    origin: HexCoord,
    maxRadius: number,
    grid: HexGrid,
  ): TreeEntity | null {
    const visited = new Set<string>();
    visited.add(HexGrid.key(origin.q, origin.r));

    // Check origin tile first
    const originResult = this.findMatureTreeOnTile(origin);
    if (originResult) return originResult;

    let frontier: HexCoord[] = [origin];

    for (let dist = 1; dist <= maxRadius; dist++) {
      const nextFrontier: HexCoord[] = [];
      for (const pos of frontier) {
        const neighbors = grid.getNeighbors(pos.q, pos.r);
        for (const neighbor of neighbors) {
          const key = HexGrid.key(neighbor.coord.q, neighbor.coord.r);
          if (visited.has(key)) continue;
          visited.add(key);

          const result = this.findMatureTreeOnTile(neighbor.coord);
          if (result) return result;

          nextFrontier.push(neighbor.coord);
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    return null;
  }

  /** Find an unmarked mature tree on a specific tile */
  private findMatureTreeOnTile(coord: HexCoord): TreeEntity | null {
    const key = HexGrid.key(coord.q, coord.r);
    const tileSet = this.treesByTile.get(key);
    if (!tileSet) return null;

    for (const treeId of tileSet) {
      const tree = this.trees.get(treeId);
      if (tree && tree.growthStage === 'mature' && !tree.markedForCut) {
        return tree;
      }
    }
    return null;
  }

  /** BFS outward from origin to find a plantable spot within maxRadius */
  findPlantableSpot(
    origin: HexCoord,
    maxRadius: number,
    grid: HexGrid,
    gameState: GameState,
    excludeTiles?: Set<string>,
  ): HexCoord | null {
    const visited = new Set<string>();
    visited.add(HexGrid.key(origin.q, origin.r));

    let frontier: HexCoord[] = [origin];

    for (let dist = 0; dist <= maxRadius; dist++) {
      const tilesToCheck = dist === 0 ? [origin] : [] as HexCoord[];

      if (dist > 0) {
        const nextFrontier: HexCoord[] = [];
        for (const pos of frontier) {
          const neighbors = grid.getNeighbors(pos.q, pos.r);
          for (const neighbor of neighbors) {
            const key = HexGrid.key(neighbor.coord.q, neighbor.coord.r);
            if (visited.has(key)) continue;
            visited.add(key);
            nextFrontier.push(neighbor.coord);
            tilesToCheck.push(neighbor.coord);
          }
        }
        frontier = nextFrontier;
      }

      for (const coord of tilesToCheck) {
        const tile = grid.getTile(coord.q, coord.r);
        if (!tile) continue;
        if (tile.terrain !== TerrainType.Forest && tile.terrain !== TerrainType.Grassland) continue;
        if (this.getTreeCountOnTile(coord) >= MAX_TREES_PER_TILE) continue;
        if (gameState.hasBuildingAt(coord.q, coord.r)) continue;
        const key = HexGrid.key(coord.q, coord.r);
        if (excludeTiles && excludeTiles.has(key)) continue;
        return coord;
      }

      if (frontier.length === 0 && dist > 0) break;
    }

    return null;
  }

  /** Update growth for non-mature trees */
  update(deltaTime: number): void {
    const toRemoveFromGrowing: string[] = [];

    for (const treeId of this.growingTrees) {
      const tree = this.trees.get(treeId);
      if (!tree) {
        toRemoveFromGrowing.push(treeId);
        continue;
      }

      if (tree.growthStage === 'sapling') {
        tree.growthProgress += deltaTime / SAPLING_GROWTH_TIME;
        if (tree.growthProgress >= 1.0) {
          tree.growthStage = 'young';
          tree.growthProgress = 0;
          this.onTreeChanged?.();
        }
      } else if (tree.growthStage === 'young') {
        tree.growthProgress += deltaTime / YOUNG_GROWTH_TIME;
        if (tree.growthProgress >= 1.0) {
          tree.growthStage = 'mature';
          tree.growthProgress = 1.0;
          toRemoveFromGrowing.push(treeId);
          this.onTreeChanged?.();
        }
      } else {
        toRemoveFromGrowing.push(treeId);
      }
    }

    for (const id of toRemoveFromGrowing) {
      this.growingTrees.delete(id);
    }
  }

  /** Unmark all trees reserved by a specific building */
  unmarkTreesForBuilding(buildingId: string): void {
    for (const tree of this.trees.values()) {
      if (tree.markedBy === buildingId) {
        tree.markedForCut = false;
        tree.markedBy = null;
      }
    }
  }

  /** Serialization: get internal state for save */
  _getState(): {
    trees: TreeEntity[];
    nextTreeId: number;
  } {
    return {
      trees: Array.from(this.trees.values()).map((t) => ({ ...t, tileCoord: { ...t.tileCoord } })),
      nextTreeId: getTreeIdCounter(),
    };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { trees: TreeEntity[]; nextTreeId: number }): void {
    setTreeIdCounter(state.nextTreeId);
    this.trees.clear();
    this.treesByTile.clear();
    this.growingTrees.clear();

    for (const t of state.trees) {
      this.trees.set(t.id, t);

      const tileKey = HexGrid.key(t.tileCoord.q, t.tileCoord.r);
      let tileSet = this.treesByTile.get(tileKey);
      if (!tileSet) {
        tileSet = new Set();
        this.treesByTile.set(tileKey, tileSet);
      }
      tileSet.add(t.id);

      if (t.growthStage !== 'mature') {
        this.growingTrees.add(t.id);
      }
    }
  }
}
