import { BuildingType } from './BuildingType';
import { BuildingState } from './Building';
import type { Building } from './Building';
import { HexGrid } from './HexGrid';
import type { HexCoord } from './HexGrid';
import type { ResourceDeposit } from './HexGrid';
import type { GameState } from './GameState';
import { UnitState } from './Unit';
import type { Unit } from './Unit';
import { UNIT_DEFINITIONS } from './UnitType';
import { findPath } from './Pathfinding';
import { setUnitPath, clearUnitPath } from './Unit';
import { TerrainType } from './TerrainType';

export type GeologistPhase =
  | 'idle_at_hut'
  | 'walking_to_prospect'
  | 'prospecting'
  | 'walking_to_hut';

interface GeologistWorkState {
  phase: GeologistPhase;
  targetCoord: HexCoord | null;
  prospectProgress: number;
  prospectedTiles: Set<string>;
  idleCooldown: number;
}

/** Time in seconds to prospect a single mountain tile */
const PROSPECT_DURATION = 5.0;

/** Cooldown between prospect cycles when idle (seconds) */
const IDLE_COOLDOWN = 2.0;

/** Max BFS radius to search for unprospected mountains */
const MAX_PROSPECT_RADIUS = 10;

/**
 * Manages geologist prospecting behavior for all GeologistHut buildings.
 * Each active hut with a worker runs an independent prospecting state machine.
 */
export class GeologistManager {
  private gameState: GameState;
  private workStates: Map<string, GeologistWorkState> = new Map();

  /** Callback when a deposit is revealed */
  onDepositRevealed: ((coord: HexCoord, deposit: ResourceDeposit) => void) | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  update(deltaTime: number): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.type !== BuildingType.GeologistHut) continue;
      if (building.state !== BuildingState.Active) continue;

      const worker = this.gameState.getWorkerForBuilding(building.id);
      if (!worker || worker.state !== UnitState.Working) continue;

      let ws = this.workStates.get(building.id);
      if (!ws) {
        ws = {
          phase: 'idle_at_hut',
          targetCoord: null,
          prospectProgress: 0,
          prospectedTiles: new Set(),
          idleCooldown: 0,
        };
        this.workStates.set(building.id, ws);
      }

      this.updateGeologist(building, worker, ws, deltaTime);
    }

    // Clean up states for removed buildings
    for (const id of this.workStates.keys()) {
      const building = this.gameState.getBuilding(id);
      if (!building || building.type !== BuildingType.GeologistHut) {
        this.workStates.delete(id);
      }
    }
  }

  private updateGeologist(
    building: Building,
    worker: Unit,
    ws: GeologistWorkState,
    deltaTime: number,
  ): void {
    const grid = this.gameState.getGrid();

    switch (ws.phase) {
      case 'idle_at_hut': {
        ws.idleCooldown -= deltaTime;
        if (ws.idleCooldown > 0) return;

        // Find nearest unprospected mountain
        const target = this.findUnprospectedMountain(building.coord, ws.prospectedTiles, grid);
        if (!target) {
          ws.idleCooldown = IDLE_COOLDOWN;
          return;
        }

        // Pathfind to target
        const path = findPath(grid, building.coord, target);
        if (path.length === 0) {
          ws.prospectedTiles.add(HexGrid.key(target.q, target.r));
          ws.idleCooldown = IDLE_COOLDOWN;
          return;
        }

        ws.targetCoord = target;
        ws.phase = 'walking_to_prospect';
        setUnitPath(worker, path);
        break;
      }

      case 'walking_to_prospect': {
        this.advanceMovement(worker, deltaTime);

        if (worker.pathIndex >= worker.path.length - 1 && worker.path.length > 0) {
          clearUnitPath(worker);
          worker.coord = { ...ws.targetCoord! };
          ws.phase = 'prospecting';
          ws.prospectProgress = 0;
        }
        break;
      }

      case 'prospecting': {
        ws.prospectProgress += deltaTime / PROSPECT_DURATION;

        if (ws.prospectProgress >= 1.0) {
          const target = ws.targetCoord!;
          ws.prospectedTiles.add(HexGrid.key(target.q, target.r));

          // Try to reveal deposit
          const revealed = grid.revealDeposit(target.q, target.r);
          if (revealed) {
            const deposit = grid.getDeposit(target.q, target.r);
            if (deposit) {
              this.onDepositRevealed?.(target, deposit);
            }
          }

          // Walk back to hut
          const pathHome = findPath(grid, target, building.coord);
          if (pathHome.length > 0) {
            ws.phase = 'walking_to_hut';
            setUnitPath(worker, pathHome);
          } else {
            // Can't find path home — just reset
            ws.phase = 'idle_at_hut';
            ws.idleCooldown = IDLE_COOLDOWN;
            worker.coord = { ...building.coord };
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

  /**
   * BFS from hut to find nearest unprospected mountain tile within radius.
   */
  private findUnprospectedMountain(
    origin: HexCoord,
    prospectedTiles: Set<string>,
    grid: HexGrid,
  ): HexCoord | null {
    const visited = new Set<string>();
    const startWrapped = grid.wrap(origin.q, origin.r);
    visited.add(HexGrid.key(startWrapped.q, startWrapped.r));

    let frontier: HexCoord[] = [startWrapped];

    for (let dist = 1; dist <= MAX_PROSPECT_RADIUS; dist++) {
      const nextFrontier: HexCoord[] = [];
      for (const pos of frontier) {
        const neighbors = grid.getNeighbors(pos.q, pos.r);
        for (const neighbor of neighbors) {
          const nw = grid.wrap(neighbor.coord.q, neighbor.coord.r);
          const key = HexGrid.key(nw.q, nw.r);
          if (visited.has(key)) continue;
          visited.add(key);

          if (neighbor.terrain === TerrainType.Mountain && !prospectedTiles.has(key)) {
            return nw;
          }
          nextFrontier.push(nw);
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    return null;
  }

  /** Get the work state for a geologist hut (for UI display) */
  getWorkState(buildingId: string): { phase: GeologistPhase; prospectedCount: number; prospectProgress: number } | null {
    const ws = this.workStates.get(buildingId);
    if (!ws) return null;
    return {
      phase: ws.phase,
      prospectedCount: ws.prospectedTiles.size,
      prospectProgress: ws.prospectProgress,
    };
  }

  /** Serialization: get internal state for save */
  _getState(): {
    workStates: [string, {
      phase: GeologistPhase;
      targetCoord: HexCoord | null;
      prospectProgress: number;
      prospectedTiles: string[];
      idleCooldown: number;
    }][];
  } {
    const entries: [string, {
      phase: GeologistPhase;
      targetCoord: HexCoord | null;
      prospectProgress: number;
      prospectedTiles: string[];
      idleCooldown: number;
    }][] = [];

    for (const [id, ws] of this.workStates) {
      entries.push([id, {
        phase: ws.phase,
        targetCoord: ws.targetCoord,
        prospectProgress: ws.prospectProgress,
        prospectedTiles: Array.from(ws.prospectedTiles),
        idleCooldown: ws.idleCooldown,
      }]);
    }

    return { workStates: entries };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: {
    workStates: [string, {
      phase: GeologistPhase;
      targetCoord: HexCoord | null;
      prospectProgress: number;
      prospectedTiles: string[];
      idleCooldown: number;
    }][];
  }): void {
    this.workStates.clear();
    for (const [id, ws] of state.workStates) {
      this.workStates.set(id, {
        phase: ws.phase,
        targetCoord: ws.targetCoord,
        prospectProgress: ws.prospectProgress,
        prospectedTiles: new Set(ws.prospectedTiles),
        idleCooldown: ws.idleCooldown,
      });
    }
  }
}
