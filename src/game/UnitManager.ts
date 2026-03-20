import { BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState, addToInventory, removeFromInventory, getInventoryAmount } from './Building';
import { GameState } from './GameState';
import type { Unit } from './Unit';
import { UnitState, setUnitPath, clearUnitPath } from './Unit';
import { UNIT_DEFINITIONS, WORKER_TO_UNIT_TYPE, UnitType } from './UnitType';
import { findPath } from './Pathfinding';
import { getMaxWorkers } from './BuildingUpgrade';
import { PopulationManager } from './PopulationManager';
import { logger } from '../util/Logger';
import {
  NIGHT_SPEED_PENALTY_CIVILIAN,
  NIGHT_SPEED_PENALTY_TRANSPORTER,
  NIGHT_SPEED_PENALTY_KNIGHT,
  NIGHT_SPEED_PENALTY_BUILDER,
} from './data/balanceConstants';

/**
 * Manages unit spawning, job assignment, and movement updates.
 * Called each frame from the game loop.
 */
export class UnitManager {
  private gameState: GameState;
  private populationManager: PopulationManager;
  private spawnCooldown = 0;
  private gameTime = 0;

  /** Current nightness level 0.0–1.0 (set by Game each frame) */
  nightness = 0;

  /** Optional callback when a building starts waiting for a tool */
  onBuildingWaitingForTool: ((building: import('./Building').Building) => void) | null = null;

  /** Optional callback when population cap prevents spawning (throttled per player) */
  onPopulationCapReached: ((playerId: number) => void) | null = null;

  /** Last time a pop cap notification was sent per player */
  private lastPopCapNotificationTime: Map<number, number> = new Map();

  /** Minimum seconds between pop cap notifications per player */
  private static POP_CAP_NOTIFY_COOLDOWN = 30.0;

  /** Minimum seconds between serf spawns */
  private static SPAWN_INTERVAL = 2.0;

  constructor(gameState: GameState, populationManager: PopulationManager) {
    this.gameState = gameState;
    this.populationManager = populationManager;
  }

  /** Get night speed penalty for a unit based on its type */
  private getNightSpeedPenalty(unit: import('./Unit').Unit): number {
    if (this.nightness <= 0) return 0;
    const def = UNIT_DEFINITIONS[unit.type];
    let basePenalty: number;
    if (def.category === 'military') {
      basePenalty = NIGHT_SPEED_PENALTY_KNIGHT;
    } else if (unit.type === UnitType.Builder) {
      basePenalty = NIGHT_SPEED_PENALTY_BUILDER;
    } else if (unit.type === UnitType.Transporter) {
      basePenalty = NIGHT_SPEED_PENALTY_TRANSPORTER;
    } else {
      basePenalty = NIGHT_SPEED_PENALTY_CIVILIAN;
    }
    return this.nightness * basePenalty;
  }

  /** Serialization: get internal state for save */
  _getState(): { spawnCooldown: number; gameTime: number } {
    return { spawnCooldown: this.spawnCooldown, gameTime: this.gameTime };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { spawnCooldown: number; gameTime?: number }): void {
    this.spawnCooldown = state.spawnCooldown;
    this.gameTime = state.gameTime ?? 0;
  }

  /**
   * Main update tick. Call each frame with delta time in seconds.
   * Handles: orphan checks, spawning, assignment, movement progression.
   */
  update(deltaTime: number): void {
    this.gameTime += deltaTime;
    this.updateOrphanedUnits();
    this.updateSpawning(deltaTime);
    this.updateMovement(deltaTime);
    this.updateArrival();
  }

  /**
   * Detect units whose assigned building no longer exists (destroyed/removed)
   * and send them home to the Castle.
   * Catches two cases:
   *   1. Unit still has assignedBuildingId but building is gone from GameState
   *   2. Unit is in WalkingToWork/Working but assignedBuildingId was cleared (by removeBuilding)
   */
  private updateOrphanedUnits(): void {
    const units = this.gameState.getAllUnits();

    for (const unit of units) {
      if (unit.state === UnitState.Idle || unit.state === UnitState.WalkingHome) continue;

      // Transporters are managed by TransporterManager, not here
      if (unit.type === UnitType.Transporter) continue;

      const isOrphaned = !unit.assignedBuildingId
        || !this.gameState.getBuilding(unit.assignedBuildingId);

      if (isOrphaned) {
        this.sendHome(unit);
      }
    }
  }

  /**
   * Spawn serfs at Castle when buildings need workers.
   * Spawns one serf per player per cooldown cycle.
   * Handles all players — each player's Castle spawns their own workers.
   */
  private updateSpawning(deltaTime: number): void {
    this.spawnCooldown -= deltaTime;
    if (this.spawnCooldown > 0) return;

    let spawned = false;

    // Get all unique player IDs from buildings
    const playerIds = new Set<number>();
    for (const b of this.gameState.getAllBuildings()) {
      playerIds.add(b.playerId);
    }

    for (const playerId of playerIds) {
      const castle = this.gameState.findCastle(playerId);
      if (!castle) continue;

      // Find buildings that need workers
      const needingWorkers = this.gameState.getBuildingsNeedingWorkers(playerId);
      if (needingWorkers.length === 0) continue;

      // Check population capacity before spawning
      if (!this.populationManager.canSpawn(playerId)) {
        this.notifyPopCap(playerId);
        continue;
      }

      // Pick the first building that needs a worker
      const building = needingWorkers[0];
      const def = BUILDING_DEFINITIONS[building.type];
      const unitType = WORKER_TO_UNIT_TYPE[def.worker];
      if (!unitType) continue;

      // Check tool requirement from unit definition
      const unitDef = UNIT_DEFINITIONS[unitType];
      const requiredTool = unitDef.requiredTool;

      if (requiredTool) {
        const available = getInventoryAmount(castle.outputInventory, requiredTool);
        if (available <= 0) {
          // Tool not available — mark building as waiting
          if (!building.waitingForTool) {
            building.waitingForTool = requiredTool;
            building.waitingForToolSince = this.gameTime;
            this.onBuildingWaitingForTool?.(building);
          }
          continue;
        }
        // Consume tool from Castle
        removeFromInventory(castle.outputInventory, requiredTool, 1);
      }

      // Clear waiting state since we have the tool
      building.waitingForTool = null;
      building.waitingForToolSince = null;

      // Spawn the serf at the Castle
      const unit = this.gameState.spawnUnit(unitType, { ...castle.coord }, playerId);
      if (requiredTool) {
        unit.carriedTool = requiredTool;
      }

      // Assign to building via reverse index
      this.gameState.assignWorkerToBuilding(unit.id, building.id);

      // Pathfind to the building
      const path = findPath(
        this.gameState.getGrid(),
        castle.coord,
        building.coord,
      );

      if (path.length > 0) {
        setUnitPath(unit, path);
        unit.state = UnitState.WalkingToWork;
      } else {
        logger.warn(
          `[UnitManager] No path from Castle (${castle.coord.q},${castle.coord.r}) to ${def.label} (${building.coord.q},${building.coord.r}) — unit ${unit.id} stays idle`,
        );
        unit.state = UnitState.Idle;
        this.gameState.unassignWorker(unit.id);
        // Return tool to Castle if spawn failed
        if (requiredTool) {
          addToInventory(castle.outputInventory, requiredTool, 1);
          unit.carriedTool = null;
        }
      }

      spawned = true;
    }

    // Spawn extra workers for multi-worker buildings (from worker upgrades)
    for (const playerId of playerIds) {
      const castle = this.gameState.findCastle(playerId);
      if (!castle) continue;

      for (const building of this.gameState.getBuildingsByPlayer(playerId)) {
        if (building.state !== BuildingState.Active) continue;
        const maxW = getMaxWorkers(building);
        if (maxW <= 1) continue;
        // Primary worker must exist first
        if (!this.gameState.getWorkerForBuilding(building.id)) continue;
        // Count existing extra workers (filter out removed units)
        const existingExtra = (building.extraWorkerIds ?? []).filter(
          (id) => this.gameState.getUnit(id),
        );
        building.extraWorkerIds = existingExtra;
        if (existingExtra.length >= maxW - 1) continue;

        // Check population capacity for extra workers
        if (!this.populationManager.canSpawn(playerId)) continue;

        const def = BUILDING_DEFINITIONS[building.type];
        const unitType = WORKER_TO_UNIT_TYPE[def.worker];
        if (!unitType) continue;

        // Check tool requirement for extra workers too
        const unitDef = UNIT_DEFINITIONS[unitType];
        const requiredTool = unitDef.requiredTool;
        if (requiredTool) {
          const available = getInventoryAmount(castle.outputInventory, requiredTool);
          if (available <= 0) continue;
          removeFromInventory(castle.outputInventory, requiredTool, 1);
        }

        const extra = this.gameState.spawnUnit(unitType, { ...castle.coord }, playerId);
        if (requiredTool) {
          extra.carriedTool = requiredTool;
        }
        extra.assignedBuildingId = building.id;
        building.extraWorkerIds.push(extra.id);

        const path = findPath(this.gameState.getGrid(), castle.coord, building.coord);
        if (path.length > 0) {
          setUnitPath(extra, path);
          extra.state = UnitState.WalkingToWork;
        } else {
          extra.state = UnitState.Idle;
          extra.assignedBuildingId = null;
          building.extraWorkerIds.pop();
          this.gameState.removeUnit(extra.id);
          // Return tool if spawn failed
          if (requiredTool) {
            addToInventory(castle.outputInventory, requiredTool, 1);
          }
        }
        spawned = true;
      }
    }

    if (spawned) {
      this.spawnCooldown = UnitManager.SPAWN_INTERVAL;
    }
  }

  /**
   * Update movement for all walking units.
   * Advances moveProgress and pathIndex based on unit speed and delta time.
   */
  private updateMovement(deltaTime: number): void {
    const units = this.gameState.getAllUnits();

    for (const unit of units) {
      if (unit.state !== UnitState.WalkingToWork && unit.state !== UnitState.WalkingHome) {
        continue;
      }

      if (unit.path.length === 0 || unit.pathIndex >= unit.path.length - 1) {
        continue;
      }

      const def = UNIT_DEFINITIONS[unit.type];
      const nightPenalty = this.getNightSpeedPenalty(unit);
      const speed = def.moveSpeed * (1 - nightPenalty);

      // Advance moveProgress
      unit.moveProgress += speed * deltaTime;

      // When we complete a segment, advance to next
      while (unit.moveProgress >= 1.0 && unit.pathIndex < unit.path.length - 1) {
        unit.moveProgress -= 1.0;
        unit.pathIndex++;
        unit.coord = { ...unit.path[unit.pathIndex] };
      }

      // Clamp at end
      if (unit.pathIndex >= unit.path.length - 1) {
        unit.moveProgress = 0;
        unit.coord = { ...unit.path[unit.path.length - 1] };
      }
    }
  }

  /**
   * Check if any walking units have arrived at their destination.
   * Transitions them to the appropriate state.
   */
  private updateArrival(): void {
    const units = this.gameState.getAllUnits();

    for (const unit of units) {
      if (unit.state === UnitState.WalkingToWork) {
        // Check if arrived at assigned building
        if (unit.path.length > 0 && unit.pathIndex >= unit.path.length - 1) {
          clearUnitPath(unit);
          unit.state = UnitState.Working;
        }
      } else if (unit.state === UnitState.WalkingHome) {
        // Check if arrived back at castle
        if (unit.path.length > 0 && unit.pathIndex >= unit.path.length - 1) {
          clearUnitPath(unit);
          unit.state = UnitState.Idle;
          this.gameState.unassignWorker(unit.id);
          // Return carried tool to Castle
          if (unit.carriedTool) {
            const castle = this.gameState.findCastle(unit.playerId);
            if (castle) {
              addToInventory(castle.outputInventory, unit.carriedTool, 1);
            }
            unit.carriedTool = null;
          }
          // If pending dismissal, permanently remove the unit
          if (unit.pendingDismissal) {
            this.gameState.removeUnit(unit.id);
          }
        }
      }
    }
  }

  /**
   * Dismiss a unit: mark for removal after it walks home and returns its tool.
   * For transporters, call releaseTransporter first via the provided callback.
   */
  dismissUnit(
    unit: Unit,
    releaseTransporter?: (unitId: string) => void,
  ): void {
    unit.pendingDismissal = true;

    // If transporter, release from road first
    if (unit.type === UnitType.Transporter && releaseTransporter) {
      releaseTransporter(unit.id);
    }

    // If extra worker, remove from building's extraWorkerIds
    if (unit.assignedBuildingId) {
      const building = this.gameState.getBuilding(unit.assignedBuildingId);
      if (building?.extraWorkerIds) {
        const idx = building.extraWorkerIds.indexOf(unit.id);
        if (idx >= 0) building.extraWorkerIds.splice(idx, 1);
      }
    }

    this.sendHome(unit);
  }

  /** Throttled population cap notification per player */
  private notifyPopCap(playerId: number): void {
    const last = this.lastPopCapNotificationTime.get(playerId) ?? 0;
    if (this.gameTime - last < UnitManager.POP_CAP_NOTIFY_COOLDOWN) return;
    this.lastPopCapNotificationTime.set(playerId, this.gameTime);
    this.onPopulationCapReached?.(playerId);
  }

  /**
   * Send a unit home to the Castle (e.g., when building is destroyed).
   */
  sendHome(unit: Unit): void {
    const castle = this.gameState.findCastle(unit.playerId);
    if (!castle) {
      logger.warn(`[UnitManager] No castle found for player ${unit.playerId} — unit ${unit.id} cannot go home`);
      this.gameState.unassignWorker(unit.id);
      unit.state = UnitState.Idle;
      return;
    }

    this.gameState.unassignWorker(unit.id);
    const path = findPath(
      this.gameState.getGrid(),
      unit.coord,
      castle.coord,
    );

    if (path.length > 0) {
      setUnitPath(unit, path);
      unit.state = UnitState.WalkingHome;
    } else {
      logger.warn(
        `[UnitManager] No path from unit ${unit.id} (${unit.coord.q},${unit.coord.r}) to Castle — unit stays idle`,
      );
      unit.state = UnitState.Idle;
    }
  }
}
