import { BuildingType } from './BuildingType';
import { BuildingState, addToInventory, hasOutputSpace } from './Building';
import type { Building } from './Building';
import type { GameState } from './GameState';
import type { TreeManager } from './TreeManager';
import { UnitState, advanceUnitMovement } from './Unit';
import type { Unit } from './Unit';
import { ResourceType } from './ResourceType';
import { findPath } from './Pathfinding';
import { setUnitPath, clearUnitPath } from './Unit';
import { TerrainType } from './TerrainType';
import {
  WOODCUTTER_CHOP_DURATION as CHOP_DURATION,
  WOODCUTTER_IDLE_COOLDOWN as IDLE_COOLDOWN,
} from './data/balanceConstants';
import { getEffectiveWorkRadius } from './BuildingUpgrade';

export type WoodcutterPhase =
  | 'idle_at_hut'
  | 'walking_to_tree'
  | 'chopping'
  | 'walking_to_hut'
  | 'depositing';

interface WoodcutterWorkState {
  phase: WoodcutterPhase;
  targetTreeId: string | null;
  chopProgress: number;
  idleCooldown: number;
}

/**
 * Manages woodcutter logging behavior for all WoodcutterHut buildings.
 * Each active hut with a worker runs an independent woodcutting state machine.
 */
export class WoodcutterManager {
  private gameState: GameState;
  private treeManager: TreeManager;
  private workStates: Map<string, WoodcutterWorkState> = new Map();

  /** Callback when terrain changes (Forest→Grassland on last tree removed) */
  onTerrainChanged: (() => void) | null = null;

  constructor(gameState: GameState, treeManager: TreeManager) {
    this.gameState = gameState;
    this.treeManager = treeManager;
  }

  update(deltaTime: number): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.type !== BuildingType.WoodcutterHut) continue;
      if (building.state !== BuildingState.Active) continue;

      const worker = this.gameState.getWorkerForBuilding(building.id);
      if (!worker || worker.state !== UnitState.Working) continue;

      let ws = this.workStates.get(building.id);
      if (!ws) {
        ws = {
          phase: 'idle_at_hut',
          targetTreeId: null,
          chopProgress: 0,
          idleCooldown: 0,
        };
        this.workStates.set(building.id, ws);
      }

      this.updateWoodcutter(building, worker, ws, deltaTime);
    }

    // Clean up states for removed buildings
    for (const id of this.workStates.keys()) {
      const building = this.gameState.getBuilding(id);
      if (!building || building.type !== BuildingType.WoodcutterHut) {
        // Unmark any trees reserved by this building
        this.treeManager.unmarkTreesForBuilding(id);
        this.workStates.delete(id);
      }
    }
  }

  private updateWoodcutter(
    building: Building,
    worker: Unit,
    ws: WoodcutterWorkState,
    deltaTime: number,
  ): void {
    const grid = this.gameState.getGrid();

    switch (ws.phase) {
      case 'idle_at_hut': {
        ws.idleCooldown -= deltaTime;
        if (ws.idleCooldown > 0) return;

        // Don't start a new cycle if output is full
        if (!hasOutputSpace(building)) {
          ws.idleCooldown = IDLE_COOLDOWN;
          return;
        }

        // Find nearest mature tree
        const tree = this.treeManager.findNearestMatureTree(
          building.coord,
          getEffectiveWorkRadius(building),
          grid,
        );
        if (!tree) {
          ws.idleCooldown = IDLE_COOLDOWN;
          return;
        }

        // Mark tree as reserved
        tree.markedForCut = true;
        tree.markedBy = building.id;

        // Pathfind to tree's tile
        const path = findPath(grid, building.coord, tree.tileCoord);
        if (path.length === 0) {
          tree.markedForCut = false;
          tree.markedBy = null;
          ws.idleCooldown = IDLE_COOLDOWN;
          return;
        }

        ws.targetTreeId = tree.id;
        ws.phase = 'walking_to_tree';
        setUnitPath(worker, path);
        break;
      }

      case 'walking_to_tree': {
        advanceUnitMovement(worker, deltaTime);

        if (worker.pathIndex >= worker.path.length - 1 && worker.path.length > 0) {
          clearUnitPath(worker);

          // Verify tree still exists and is mature
          const tree = ws.targetTreeId ? this.treeManager.getTree(ws.targetTreeId) : null;
          if (!tree || tree.growthStage !== 'mature') {
            // Tree gone — go back to idle
            if (ws.targetTreeId) {
              this.treeManager.unmarkTreesForBuilding(building.id);
            }
            ws.targetTreeId = null;
            ws.phase = 'idle_at_hut';
            ws.idleCooldown = IDLE_COOLDOWN;
            worker.coord = { ...building.coord };
            return;
          }

          worker.coord = { ...tree.tileCoord };
          ws.phase = 'chopping';
          ws.chopProgress = 0;
        }
        break;
      }

      case 'chopping': {
        ws.chopProgress += deltaTime / CHOP_DURATION;

        if (ws.chopProgress >= 1.0) {
          const targetId = ws.targetTreeId!;
          const treeCoord = this.treeManager.removeTree(targetId);

          // If no more trees on this tile, convert Forest → Grassland
          if (treeCoord) {
            const treeCount = this.treeManager.getTreeCountOnTile(treeCoord);
            if (treeCount === 0) {
              const tile = grid.getTile(treeCoord.q, treeCoord.r);
              if (tile && tile.terrain === TerrainType.Forest) {
                grid.setTile(treeCoord.q, treeCoord.r, TerrainType.Grassland, tile.elevation, tile.deposit);
                this.onTerrainChanged?.();
              }
            }
          }

          // Walk back to hut
          const pathHome = findPath(grid, worker.coord, building.coord);
          if (pathHome.length > 0) {
            ws.phase = 'walking_to_hut';
            setUnitPath(worker, pathHome);
          } else {
            // Can't path home — teleport and deposit
            worker.coord = { ...building.coord };
            ws.phase = 'depositing';
          }
          ws.targetTreeId = null;
        }
        break;
      }

      case 'walking_to_hut': {
        advanceUnitMovement(worker, deltaTime);

        if (worker.pathIndex >= worker.path.length - 1 && worker.path.length > 0) {
          clearUnitPath(worker);
          worker.coord = { ...building.coord };
          ws.phase = 'depositing';
        }
        break;
      }

      case 'depositing': {
        // Add 1 Wood to building output
        addToInventory(building.outputInventory, ResourceType.Wood, 1);
        ws.phase = 'idle_at_hut';
        ws.idleCooldown = IDLE_COOLDOWN;
        break;
      }
    }
  }

  /** Serialization: get internal state for save */
  _getState(): {
    workStates: [string, {
      phase: WoodcutterPhase;
      targetTreeId: string | null;
      chopProgress: number;
      idleCooldown: number;
    }][];
  } {
    const entries: [string, {
      phase: WoodcutterPhase;
      targetTreeId: string | null;
      chopProgress: number;
      idleCooldown: number;
    }][] = [];

    for (const [id, ws] of this.workStates) {
      entries.push([id, {
        phase: ws.phase,
        targetTreeId: ws.targetTreeId,
        chopProgress: ws.chopProgress,
        idleCooldown: ws.idleCooldown,
      }]);
    }

    return { workStates: entries };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: {
    workStates: [string, {
      phase: WoodcutterPhase;
      targetTreeId: string | null;
      chopProgress: number;
      idleCooldown: number;
    }][];
  }): void {
    this.workStates.clear();
    for (const [id, ws] of state.workStates) {
      this.workStates.set(id, {
        phase: ws.phase,
        targetTreeId: ws.targetTreeId,
        chopProgress: ws.chopProgress,
        idleCooldown: ws.idleCooldown,
      });
    }
  }
}
