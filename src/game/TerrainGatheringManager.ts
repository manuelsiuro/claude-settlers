import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState, addToInventory, hasOutputSpace } from './Building';
import type { Building } from './Building';
import type { GameState } from './GameState';
import { UnitState, advanceUnitMovement } from './Unit';
import type { Unit } from './Unit';
import { findPath } from './Pathfinding';
import { setUnitPath, clearUnitPath } from './Unit';
import type { TerrainType } from './TerrainType';
import { HexGrid } from './HexGrid';
import type { HexCoord } from './HexGrid';
import { getEffectiveWorkRadius } from './BuildingUpgrade';
import {
  TERRAIN_GATHERING_WORK_FRACTION,
  TERRAIN_GATHERING_IDLE_COOLDOWN,
} from './data/balanceConstants';

/** Building types handled by their own specialized managers (excluded here) */
const EXCLUDED_TYPES: Set<string> = new Set([
  BuildingType.WoodcutterHut,
  BuildingType.ForesterHut,
  BuildingType.GeologistHut,
]);

export type TerrainGatheringPhase =
  | 'idle_at_building'
  | 'walking_to_terrain'
  | 'gathering'
  | 'walking_to_building'
  | 'depositing';

interface GatheringWorkState {
  phase: TerrainGatheringPhase;
  targetCoord: HexCoord | null;
  gatherProgress: number;
  idleCooldown: number;
}

/**
 * Data-driven manager for terrain-gathering buildings.
 *
 * Handles ANY building where:
 *   - harvestTerrain !== null
 *   - production.inputs.length === 0
 *   - NOT WoodcutterHut, ForesterHut, or GeologistHut (which have specialized managers)
 *
 * State machine per building:
 *   idle_at_building → walking_to_terrain → gathering → walking_to_building → depositing
 */
export class TerrainGatheringManager {
  private gameState: GameState;
  private workStates: Map<string, GatheringWorkState> = new Map();

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /** Check if a building type should be handled by this manager */
  private isTerrainGatherer(building: Building): boolean {
    if (EXCLUDED_TYPES.has(building.type)) return false;
    const def = BUILDING_DEFINITIONS[building.type];
    if (!def.harvestTerrain) return false;
    if (!def.production) return false;
    if (def.production.inputs.length > 0) return false;
    return true;
  }

  update(deltaTime: number): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (!this.isTerrainGatherer(building)) continue;
      if (building.state !== BuildingState.Active) continue;

      const worker = this.gameState.getWorkerForBuilding(building.id);
      if (!worker || worker.state !== UnitState.Working) continue;

      let ws = this.workStates.get(building.id);
      if (!ws) {
        ws = {
          phase: 'idle_at_building',
          targetCoord: null,
          gatherProgress: 0,
          idleCooldown: 0,
        };
        this.workStates.set(building.id, ws);
      }

      this.updateGatherer(building, worker, ws, deltaTime);
    }

    // Clean up states for removed buildings
    for (const id of this.workStates.keys()) {
      const building = this.gameState.getBuilding(id);
      if (!building || !this.isTerrainGatherer(building)) {
        this.workStates.delete(id);
      }
    }
  }

  private updateGatherer(
    building: Building,
    worker: Unit,
    ws: GatheringWorkState,
    deltaTime: number,
  ): void {
    const grid = this.gameState.getGrid();
    const def = BUILDING_DEFINITIONS[building.type];

    switch (ws.phase) {
      case 'idle_at_building': {
        ws.idleCooldown -= deltaTime;
        if (ws.idleCooldown > 0) return;

        // Don't start a new cycle if output is full
        if (!hasOutputSpace(building)) {
          ws.idleCooldown = TERRAIN_GATHERING_IDLE_COOLDOWN;
          return;
        }

        const terrainType = def.harvestTerrain!;
        const radius = getEffectiveWorkRadius(building);

        // Find nearest tile of the target terrain type
        const target = this.findNearestTerrainTile(building.coord, terrainType, radius, grid);
        if (!target) {
          ws.idleCooldown = TERRAIN_GATHERING_IDLE_COOLDOWN;
          return;
        }

        // Pathfind to target tile
        const path = findPath(grid, building.coord, target);
        if (path.length === 0) {
          ws.idleCooldown = TERRAIN_GATHERING_IDLE_COOLDOWN;
          return;
        }

        ws.targetCoord = target;
        ws.phase = 'walking_to_terrain';
        setUnitPath(worker, path);
        break;
      }

      case 'walking_to_terrain': {
        advanceUnitMovement(worker, deltaTime);

        if (worker.pathIndex >= worker.path.length - 1 && worker.path.length > 0) {
          clearUnitPath(worker);

          // Verify target tile still has the right terrain
          const terrainType = def.harvestTerrain!;
          if (ws.targetCoord) {
            const tile = grid.getTile(ws.targetCoord.q, ws.targetCoord.r);
            if (!tile || tile.terrain !== terrainType) {
              // Terrain changed — go back to idle
              ws.targetCoord = null;
              ws.phase = 'idle_at_building';
              ws.idleCooldown = TERRAIN_GATHERING_IDLE_COOLDOWN;
              worker.coord = { ...building.coord };
              return;
            }
            worker.coord = { ...ws.targetCoord };
          }

          ws.phase = 'gathering';
          ws.gatherProgress = 0;
        }
        break;
      }

      case 'gathering': {
        const gatherDuration = def.production!.productionTime * TERRAIN_GATHERING_WORK_FRACTION;
        ws.gatherProgress += deltaTime / gatherDuration;

        if (ws.gatherProgress >= 1.0) {
          // Walk back to building
          const pathHome = findPath(grid, worker.coord, building.coord);
          if (pathHome.length > 0) {
            ws.phase = 'walking_to_building';
            setUnitPath(worker, pathHome);
          } else {
            // Can't path home — teleport and deposit
            worker.coord = { ...building.coord };
            ws.phase = 'depositing';
          }
          ws.targetCoord = null;
        }
        break;
      }

      case 'walking_to_building': {
        advanceUnitMovement(worker, deltaTime);

        if (worker.pathIndex >= worker.path.length - 1 && worker.path.length > 0) {
          clearUnitPath(worker);
          worker.coord = { ...building.coord };
          ws.phase = 'depositing';
        }
        break;
      }

      case 'depositing': {
        // Add output resource to building's outputInventory
        const output = def.production!.outputs[0];
        addToInventory(building.outputInventory, output.resource, output.amount);
        ws.phase = 'idle_at_building';
        ws.idleCooldown = TERRAIN_GATHERING_IDLE_COOLDOWN;
        break;
      }
    }
  }

  /**
   * Find the nearest hex tile of the given terrain type within a radius.
   * Uses BFS outward from the building coordinate.
   */
  private findNearestTerrainTile(
    coord: HexCoord,
    terrainType: TerrainType,
    radius: number,
    grid: HexGrid,
  ): HexCoord | null {
    // Check the building's own tile first
    const startTile = grid.getTile(coord.q, coord.r);
    if (startTile && startTile.terrain === terrainType) return { ...coord };

    const visited = new Set<string>();
    visited.add(HexGrid.key(coord.q, coord.r));

    let frontier: HexCoord[] = [coord];

    for (let dist = 1; dist <= radius; dist++) {
      const nextFrontier: HexCoord[] = [];
      for (const pos of frontier) {
        const neighbors = grid.getNeighbors(pos.q, pos.r);
        for (const neighbor of neighbors) {
          const key = HexGrid.key(neighbor.coord.q, neighbor.coord.r);
          if (visited.has(key)) continue;
          visited.add(key);

          if (neighbor.terrain === terrainType) {
            return { ...neighbor.coord };
          }
          nextFrontier.push(neighbor.coord);
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    return null;
  }

  /** Serialization: get internal state for save */
  _getState(): {
    workStates: [string, {
      phase: TerrainGatheringPhase;
      targetCoord: HexCoord | null;
      gatherProgress: number;
      idleCooldown: number;
    }][];
  } {
    const entries: [string, {
      phase: TerrainGatheringPhase;
      targetCoord: HexCoord | null;
      gatherProgress: number;
      idleCooldown: number;
    }][] = [];

    for (const [id, ws] of this.workStates) {
      entries.push([id, {
        phase: ws.phase,
        targetCoord: ws.targetCoord,
        gatherProgress: ws.gatherProgress,
        idleCooldown: ws.idleCooldown,
      }]);
    }

    return { workStates: entries };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: {
    workStates: [string, {
      phase: TerrainGatheringPhase;
      targetCoord: HexCoord | null;
      gatherProgress: number;
      idleCooldown: number;
    }][];
  }): void {
    this.workStates.clear();
    for (const [id, ws] of state.workStates) {
      this.workStates.set(id, {
        phase: ws.phase,
        targetCoord: ws.targetCoord,
        gatherProgress: ws.gatherProgress,
        idleCooldown: ws.idleCooldown,
      });
    }
  }
}
