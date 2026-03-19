import { BuildingType } from './BuildingType';
import { BuildingState } from './Building';
import type { Building } from './Building';
import { HexGrid, HEX_SIZE } from './HexGrid';
import type { HexCoord } from './HexGrid';
import type { GameState } from './GameState';
import type { TreeManager } from './TreeManager';
import { UnitState } from './Unit';
import type { Unit } from './Unit';
import { UNIT_DEFINITIONS } from './UnitType';
import { findPath } from './Pathfinding';
import { setUnitPath, clearUnitPath } from './Unit';
import { TerrainType } from './TerrainType';
import { createRng } from './noise';
import {
  FORESTER_PLANT_DURATION as PLANT_DURATION,
  FORESTER_IDLE_COOLDOWN as IDLE_COOLDOWN,
  FORESTER_MAX_PLANT_RADIUS as MAX_PLANT_RADIUS,
} from './data/balanceConstants';

export type ForesterPhase =
  | 'idle_at_hut'
  | 'walking_to_spot'
  | 'planting'
  | 'walking_to_hut';

interface ForesterWorkState {
  phase: ForesterPhase;
  targetCoord: HexCoord | null;
  plantProgress: number;
  idleCooldown: number;
  plantedTiles: Set<string>;
}

/** Seed offset for planting RNG to avoid collisions with other systems */
const PLANT_RNG_SEED_OFFSET = 7000;

/**
 * Manages forester planting behavior for all ForesterHut buildings.
 * Each active hut with a worker runs an independent planting state machine.
 */
export class ForesterManager {
  private gameState: GameState;
  private treeManager: TreeManager;
  private workStates: Map<string, ForesterWorkState> = new Map();

  /** Callback when terrain changes (Grassland→Forest on planting) */
  onTerrainChanged: (() => void) | null = null;

  constructor(gameState: GameState, treeManager: TreeManager) {
    this.gameState = gameState;
    this.treeManager = treeManager;
  }

  update(deltaTime: number): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.type !== BuildingType.ForesterHut) continue;
      if (building.state !== BuildingState.Active) continue;

      const worker = this.gameState.getWorkerForBuilding(building.id);
      if (!worker || worker.state !== UnitState.Working) continue;

      let ws = this.workStates.get(building.id);
      if (!ws) {
        ws = {
          phase: 'idle_at_hut',
          targetCoord: null,
          plantProgress: 0,
          idleCooldown: 0,
          plantedTiles: new Set(),
        };
        this.workStates.set(building.id, ws);
      }

      this.updateForester(building, worker, ws, deltaTime);
    }

    // Clean up states for removed buildings
    for (const id of this.workStates.keys()) {
      const building = this.gameState.getBuilding(id);
      if (!building || building.type !== BuildingType.ForesterHut) {
        this.workStates.delete(id);
      }
    }
  }

  private updateForester(
    building: Building,
    worker: Unit,
    ws: ForesterWorkState,
    deltaTime: number,
  ): void {
    const grid = this.gameState.getGrid();

    switch (ws.phase) {
      case 'idle_at_hut': {
        ws.idleCooldown -= deltaTime;
        if (ws.idleCooldown > 0) return;

        // Find a plantable spot
        const spot = this.treeManager.findPlantableSpot(
          building.coord,
          MAX_PLANT_RADIUS,
          grid,
          this.gameState,
          ws.plantedTiles,
        );
        if (!spot) {
          // If no spots found, clear planted history and retry next cycle
          ws.plantedTiles.clear();
          ws.idleCooldown = IDLE_COOLDOWN;
          return;
        }

        // Pathfind to spot
        const path = findPath(grid, building.coord, spot);
        if (path.length === 0) {
          ws.idleCooldown = IDLE_COOLDOWN;
          return;
        }

        ws.targetCoord = spot;
        ws.phase = 'walking_to_spot';
        setUnitPath(worker, path);
        break;
      }

      case 'walking_to_spot': {
        this.advanceMovement(worker, deltaTime);

        if (worker.pathIndex >= worker.path.length - 1 && worker.path.length > 0) {
          clearUnitPath(worker);
          worker.coord = { ...ws.targetCoord! };
          ws.phase = 'planting';
          ws.plantProgress = 0;
        }
        break;
      }

      case 'planting': {
        ws.plantProgress += deltaTime / PLANT_DURATION;

        if (ws.plantProgress >= 1.0) {
          const coord = ws.targetCoord!;

          // Random model type and position
          const rng = createRng(coord.q * PLANT_RNG_SEED_OFFSET + coord.r + Date.now() % 10000);
          const isConifer = rng() > 0.5;
          const modelType: 'tree_deciduous' | 'tree_conifer' = isConifer ? 'tree_conifer' : 'tree_deciduous';
          const scale = 0.8 + rng() * 0.4;
          const rotationY = rng() * Math.PI * 2;
          const angle = rng() * Math.PI * 2;
          const dist = rng() * HEX_SIZE * 0.55;
          const localX = Math.cos(angle) * dist;
          const localZ = Math.sin(angle) * dist;

          // Add tree sapling
          this.treeManager.addTree(coord, modelType, localX, localZ, rotationY, scale);

          // If tile was Grassland, convert to Forest
          const tile = grid.getTile(coord.q, coord.r);
          if (tile && tile.terrain === TerrainType.Grassland) {
            grid.setTile(coord.q, coord.r, TerrainType.Forest, tile.elevation, tile.deposit);
            this.onTerrainChanged?.();
          }

          // Track this tile to avoid immediate re-planting
          ws.plantedTiles.add(HexGrid.key(coord.q, coord.r));

          // Walk back to hut
          const pathHome = findPath(grid, coord, building.coord);
          if (pathHome.length > 0) {
            ws.phase = 'walking_to_hut';
            setUnitPath(worker, pathHome);
          } else {
            worker.coord = { ...building.coord };
            ws.phase = 'idle_at_hut';
            ws.idleCooldown = IDLE_COOLDOWN;
          }
        }
        break;
      }

      case 'walking_to_hut': {
        this.advanceMovement(worker, deltaTime);

        if (worker.pathIndex >= worker.path.length - 1 && worker.path.length > 0) {
          clearUnitPath(worker);
          worker.coord = { ...building.coord };
          ws.phase = 'idle_at_hut';
          ws.idleCooldown = IDLE_COOLDOWN;
        }
        break;
      }
    }
  }

  /** Move a unit along its path (same interpolation logic as UnitManager) */
  private advanceMovement(unit: Unit, deltaTime: number): void {
    if (unit.path.length === 0 || unit.pathIndex >= unit.path.length - 1) return;

    const speed = UNIT_DEFINITIONS[unit.type].moveSpeed;
    unit.moveProgress += speed * deltaTime;

    while (unit.moveProgress >= 1.0 && unit.pathIndex < unit.path.length - 1) {
      unit.moveProgress -= 1.0;
      unit.pathIndex++;
      unit.coord = { ...unit.path[unit.pathIndex] };
    }

    if (unit.pathIndex >= unit.path.length - 1) {
      unit.moveProgress = 0;
      unit.coord = { ...unit.path[unit.path.length - 1] };
    }
  }

  /** Serialization: get internal state for save */
  _getState(): {
    workStates: [string, {
      phase: ForesterPhase;
      targetCoord: HexCoord | null;
      plantProgress: number;
      idleCooldown: number;
      plantedTiles: string[];
    }][];
  } {
    const entries: [string, {
      phase: ForesterPhase;
      targetCoord: HexCoord | null;
      plantProgress: number;
      idleCooldown: number;
      plantedTiles: string[];
    }][] = [];

    for (const [id, ws] of this.workStates) {
      entries.push([id, {
        phase: ws.phase,
        targetCoord: ws.targetCoord,
        plantProgress: ws.plantProgress,
        idleCooldown: ws.idleCooldown,
        plantedTiles: Array.from(ws.plantedTiles),
      }]);
    }

    return { workStates: entries };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: {
    workStates: [string, {
      phase: ForesterPhase;
      targetCoord: HexCoord | null;
      plantProgress: number;
      idleCooldown: number;
      plantedTiles: string[];
    }][];
  }): void {
    this.workStates.clear();
    for (const [id, ws] of state.workStates) {
      this.workStates.set(id, {
        phase: ws.phase,
        targetCoord: ws.targetCoord,
        plantProgress: ws.plantProgress,
        idleCooldown: ws.idleCooldown,
        plantedTiles: new Set(ws.plantedTiles),
      });
    }
  }
}
