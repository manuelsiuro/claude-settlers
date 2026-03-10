import type { Building } from './Building';
import { BuildingState } from './Building';
import { BUILDING_DEFINITIONS, BuildingType } from './BuildingType';
import { GameState } from './GameState';
import type { Unit } from './Unit';
import { UnitState, setUnitPath, clearUnitPath } from './Unit';
import { UNIT_DEFINITIONS, WORKER_TO_UNIT_TYPE } from './UnitType';
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

  /**
   * Main update tick. Call each frame with delta time in seconds.
   * Handles: spawning, assignment, movement progression.
   */
  update(deltaTime: number): void {
    this.updateSpawning(deltaTime);
    this.updateMovement(deltaTime);
    this.updateArrival();
  }

  /**
   * Spawn serfs at Castle when buildings need workers.
   * Spawns one serf at a time with a cooldown between spawns.
   */
  private updateSpawning(deltaTime: number): void {
    this.spawnCooldown -= deltaTime;
    if (this.spawnCooldown > 0) return;

    const playerId = 1; // TODO: multi-player support
    const castle = this.findCastle(playerId);
    if (!castle) return;

    // Find buildings that need workers
    const needingWorkers = this.gameState.getBuildingsNeedingWorkers(playerId);
    if (needingWorkers.length === 0) return;

    // Pick the first building that needs a worker
    const building = needingWorkers[0];
    const def = BUILDING_DEFINITIONS[building.type];
    const unitType = WORKER_TO_UNIT_TYPE[def.worker];
    if (!unitType) return;

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
      // No path found — unit stays idle at castle
      unit.state = UnitState.Idle;
      this.gameState.unassignWorker(unit.id);
    }

    this.spawnCooldown = UnitManager.SPAWN_INTERVAL;
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

  /** Find the Castle building for a player */
  private findCastle(playerId: number): Building | undefined {
    return this.gameState
      .getBuildingsByPlayer(playerId)
      .find((b) => b.type === BuildingType.Castle && b.state === BuildingState.Active);
  }

  /**
   * Send a unit home to the Castle (e.g., when building is destroyed).
   */
  sendHome(unit: Unit): void {
    const castle = this.findCastle(unit.playerId);
    if (!castle) return;

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
      unit.state = UnitState.Idle;
    }
  }
}
