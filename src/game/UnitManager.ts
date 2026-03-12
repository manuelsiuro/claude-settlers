import { BUILDING_DEFINITIONS } from './BuildingType';
import { GameState } from './GameState';
import type { Unit } from './Unit';
import { UnitState, setUnitPath, clearUnitPath } from './Unit';
import { UNIT_DEFINITIONS, WORKER_TO_UNIT_TYPE, UnitType } from './UnitType';
import { findPath } from './Pathfinding';

/**
 * Manages unit spawning, job assignment, and movement updates.
 * Called each frame from the game loop.
 */
export class UnitManager {
  private gameState: GameState;
  private spawnCooldown = 0;

  /** Minimum seconds between serf spawns */
  private static SPAWN_INTERVAL = 2.0;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /** Serialization: get internal state for save */
  _getState(): { spawnCooldown: number } {
    return { spawnCooldown: this.spawnCooldown };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { spawnCooldown: number }): void {
    this.spawnCooldown = state.spawnCooldown;
  }

  /**
   * Main update tick. Call each frame with delta time in seconds.
   * Handles: orphan checks, spawning, assignment, movement progression.
   */
  update(deltaTime: number): void {
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

      // Pick the first building that needs a worker
      const building = needingWorkers[0];
      const def = BUILDING_DEFINITIONS[building.type];
      const unitType = WORKER_TO_UNIT_TYPE[def.worker];
      if (!unitType) continue;

      // Spawn the serf at the Castle
      const unit = this.gameState.spawnUnit(unitType, { ...castle.coord }, playerId);

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
        console.warn(
          `[UnitManager] No path from Castle (${castle.coord.q},${castle.coord.r}) to ${def.label} (${building.coord.q},${building.coord.r}) — unit ${unit.id} stays idle`,
        );
        unit.state = UnitState.Idle;
        this.gameState.unassignWorker(unit.id);
      }

      spawned = true;
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
      const speed = def.moveSpeed;

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
        }
      }
    }
  }

  /**
   * Send a unit home to the Castle (e.g., when building is destroyed).
   */
  sendHome(unit: Unit): void {
    const castle = this.gameState.findCastle(unit.playerId);
    if (!castle) {
      console.warn(`[UnitManager] No castle found for player ${unit.playerId} — unit ${unit.id} cannot go home`);
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
      console.warn(
        `[UnitManager] No path from unit ${unit.id} (${unit.coord.q},${unit.coord.r}) to Castle — unit stays idle`,
      );
      unit.state = UnitState.Idle;
    }
  }
}
