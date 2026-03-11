import type { Building } from './Building';
import {
  BuildingState,
  hasAllConstructionResources,
  getRemainingConstructionCost,
  addToInventory,
  removeFromInventory,
  getInventoryAmount,
} from './Building';
import { BUILDING_DEFINITIONS } from './BuildingType';
import type { GameState } from './GameState';
import type { Unit } from './Unit';
import { UnitState, setUnitPath } from './Unit';
import { UnitType } from './UnitType';
import { findPath } from './Pathfinding';

/**
 * Manages building construction lifecycle:
 *   Planned → (deliver resources) → UnderConstruction → (builder works) → Active
 *
 * Resource delivery: pulls directly from Castle output inventory.
 * Produced goods are routed through the flag network by LogisticsManager.
 */
export class ConstructionManager {
  private gameState: GameState;

  /** Track which buildings have a builder assigned (buildingId → unitId) */
  private builderAssignments: Map<string, string> = new Map();

  /** Seconds between resource delivery ticks */
  private static DELIVERY_INTERVAL = 1.0;
  private deliveryCooldown = 0;

  /** Optional callback when a building transitions to Active */
  onBuildingActivated: ((building: Building) => void) | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Update construction each frame.
   * Note: UnitManager handles movement and WalkingToWork→Working transitions.
   * This manager handles resource delivery, builder spawning, and construction progress.
   */
  update(deltaTime: number): void {
    this.deliverConstructionResources(deltaTime);
    this.spawnBuilders();
    this.advanceConstruction(deltaTime);
  }

  /**
   * Simplified resource delivery: pull resources from Castle to Planned buildings.
   * Delivers one resource at a time per building per tick.
   * Handles all players — each player's Castle supplies their own buildings.
   */
  private deliverConstructionResources(deltaTime: number): void {
    this.deliveryCooldown -= deltaTime;
    if (this.deliveryCooldown > 0) return;
    this.deliveryCooldown = ConstructionManager.DELIVERY_INTERVAL;

    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.state !== BuildingState.Planned) continue;

      const remaining = getRemainingConstructionCost(building);
      if (remaining.length === 0) {
        // All resources delivered — transition to UnderConstruction
        building.state = BuildingState.UnderConstruction;
        continue;
      }

      // Find this player's Castle to pull resources from
      const castle = this.gameState.findCastle(building.playerId);
      if (!castle) continue;

      // Deliver one unit of the first needed resource from Castle
      const needed = remaining[0];
      const available = getInventoryAmount(castle.outputInventory, needed.resource);
      if (available > 0) {
        removeFromInventory(castle.outputInventory, needed.resource, 1);
        addToInventory(building.constructionDelivered, needed.resource, 1);

        // Check if this was the last resource
        if (hasAllConstructionResources(building)) {
          building.state = BuildingState.UnderConstruction;
        }
      }
    }
  }

  /**
   * Spawn builder units for buildings that are UnderConstruction but have no builder.
   * Handles all players — each player's Castle spawns their own builders.
   */
  private spawnBuilders(): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.state !== BuildingState.UnderConstruction) continue;
      if (this.builderAssignments.has(building.id)) continue;

      // Find this player's Castle to spawn from
      const castle = this.gameState.findCastle(building.playerId);
      if (!castle) continue;

      // Spawn a builder at the Castle
      const builder = this.gameState.spawnUnit(UnitType.Builder, { ...castle.coord }, building.playerId);
      this.gameState.assignWorkerToBuilding(builder.id, building.id);
      this.builderAssignments.set(building.id, builder.id);

      // Pathfind to construction site
      const path = findPath(this.gameState.getGrid(), castle.coord, building.coord);
      if (path.length > 0) {
        setUnitPath(builder, path);
        builder.state = UnitState.WalkingToWork;
      } else {
        console.warn(
          `[ConstructionManager] No path to building ${building.id} at (${building.coord.q},${building.coord.r})`,
        );
        this.gameState.unassignWorker(builder.id);
        this.gameState.removeUnit(builder.id);
        this.builderAssignments.delete(building.id);
      }
    }
  }

  /**
   * Advance construction progress for buildings with an active builder.
   */
  private advanceConstruction(deltaTime: number): void {
    for (const [buildingId, unitId] of this.builderAssignments) {
      const building = this.gameState.getBuilding(buildingId);
      const builder = this.gameState.getUnit(unitId);

      if (!building || !builder) {
        this.builderAssignments.delete(buildingId);
        continue;
      }

      if (building.state !== BuildingState.UnderConstruction) continue;
      if (builder.state !== UnitState.Working) continue;

      const def = BUILDING_DEFINITIONS[building.type];
      const rate = 1 / def.constructionTime;
      building.constructionProgress += rate * deltaTime;

      if (building.constructionProgress >= 1.0) {
        building.constructionProgress = 1.0;
        building.state = BuildingState.Active;
        this.onBuildingActivated?.(building);
        this.sendBuilderHome(builder, buildingId);
      }
    }
  }

  /**
   * Send a builder back to the Castle after construction is complete.
   */
  private sendBuilderHome(builder: Unit, buildingId: string): void {
    this.builderAssignments.delete(buildingId);
    this.gameState.unassignWorker(builder.id);

    const castle = this.gameState.findCastle(builder.playerId);
    if (!castle) {
      builder.state = UnitState.Idle;
      return;
    }

    const path = findPath(this.gameState.getGrid(), builder.coord, castle.coord);
    if (path.length > 0) {
      setUnitPath(builder, path);
      builder.state = UnitState.WalkingHome;
    } else {
      builder.state = UnitState.Idle;
    }
  }
}
