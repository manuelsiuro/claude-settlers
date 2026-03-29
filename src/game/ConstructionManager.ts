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
import { logger } from '../util/Logger';
import type { GameState } from './GameState';
import type { Unit } from './Unit';
import { UnitState, setUnitPath } from './Unit';
import { UnitType, UNIT_DEFINITIONS } from './UnitType';
import { findPath } from './Pathfinding';
import type { PopulationManager } from './PopulationManager';

/**
 * Manages building construction lifecycle:
 *   Planned → (deliver resources) → UnderConstruction → (builder works) → Active
 *
 * Resource delivery: pulls directly from Castle output inventory.
 * Produced goods are routed through the flag network by LogisticsManager.
 */
export class ConstructionManager {
  private gameState: GameState;
  private populationManager: PopulationManager;

  /** Track which buildings have a builder assigned (buildingId → unitId) */
  private builderAssignments: Map<string, string> = new Map();

  /** Seconds between resource delivery ticks */
  private static DELIVERY_INTERVAL = 1.0;
  private deliveryCooldown = 0;

  /** Optional callback when a building transitions to Active */
  onBuildingActivated: ((building: Building) => void) | null = null;

  constructor(gameState: GameState, populationManager: PopulationManager) {
    this.gameState = gameState;
    this.populationManager = populationManager;
  }

  /** Serialization: get internal state for save */
  _getState(): { builderAssignments: [string, string][]; deliveryCooldown: number } {
    return {
      builderAssignments: Array.from(this.builderAssignments.entries()),
      deliveryCooldown: this.deliveryCooldown,
    };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { builderAssignments: [string, string][]; deliveryCooldown: number }): void {
    this.builderAssignments = new Map(state.builderAssignments);
    this.deliveryCooldown = state.deliveryCooldown;
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

    const buildings = this.gameState.getAllBuildings()
      .filter(b => b.state === BuildingState.Planned);

    // Sort by completion % descending — finish nearly-done buildings first
    buildings.sort((a, b) => {
      const defA = BUILDING_DEFINITIONS[a.type];
      const defB = BUILDING_DEFINITIONS[b.type];
      const totalA = defA.cost.reduce((sum, c) => sum + c.amount, 0) || 1;
      const totalB = defB.cost.reduce((sum, c) => sum + c.amount, 0) || 1;
      const deliveredA = Object.values(a.constructionDelivered).reduce((s, v) => s + (v ?? 0), 0);
      const deliveredB = Object.values(b.constructionDelivered).reduce((s, v) => s + (v ?? 0), 0);
      return (deliveredB / totalB) - (deliveredA / totalA);
    });

    for (const building of buildings) {
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
  /** Optional callback when a building starts waiting for a builder tool */
  onBuildingWaitingForTool: ((building: Building) => void) | null = null;

  private spawnBuilders(): void {
    const buildings = this.gameState.getAllBuildings();
    // Read builder tool requirement from unit data
    const builderTool = UNIT_DEFINITIONS[UnitType.Builder].requiredTool;

    for (const building of buildings) {
      if (building.state !== BuildingState.UnderConstruction) continue;
      if (this.builderAssignments.has(building.id)) continue;

      // Find this player's Castle to pull tools from
      const castle = this.gameState.findCastle(building.playerId);
      if (!castle) continue;

      // Try to reuse an idle builder before spawning a new one.
      // Idle builders already returned their tool on arrival, so re-acquire from Castle.
      const idleBuilder = this.gameState.getIdleUnitsAtCastle(building.playerId)
        .find(u => u.type === UnitType.Builder);

      if (idleBuilder) {
        // Re-acquire tool from Castle
        if (builderTool) {
          const available = getInventoryAmount(castle.outputInventory, builderTool);
          if (available <= 0) {
            if (!building.waitingForTool) {
              building.waitingForTool = builderTool;
              building.waitingForToolSince = Date.now();
              this.onBuildingWaitingForTool?.(building);
            }
            continue;
          }
          removeFromInventory(castle.outputInventory, builderTool, 1);
          idleBuilder.carriedTool = builderTool;
        }

        building.waitingForTool = null;
        building.waitingForToolSince = null;
        this.gameState.assignWorkerToBuilding(idleBuilder.id, building.id);
        this.builderAssignments.set(building.id, idleBuilder.id);

        const path = findPath(this.gameState.getGrid(), idleBuilder.coord, building.coord);
        if (path.length > 0) {
          setUnitPath(idleBuilder, path);
          idleBuilder.state = UnitState.WalkingToWork;
        } else {
          logger.warn(
            `[ConstructionManager] No path from idle builder to building ${building.id}`,
          );
          this.gameState.unassignWorker(idleBuilder.id);
          this.builderAssignments.delete(building.id);
          if (builderTool) {
            addToInventory(castle.outputInventory, builderTool, 1);
            idleBuilder.carriedTool = null;
          }
        }
        continue;
      }

      // No idle builder available — spawn a new one if population allows
      if (!this.populationManager.canSpawn(building.playerId)) continue;

      // Check tool availability for the builder
      if (builderTool) {
        const available = getInventoryAmount(castle.outputInventory, builderTool);
        if (available <= 0) {
          if (!building.waitingForTool) {
            building.waitingForTool = builderTool;
            building.waitingForToolSince = Date.now();
            this.onBuildingWaitingForTool?.(building);
          }
          continue;
        }
        removeFromInventory(castle.outputInventory, builderTool, 1);
      }

      // Clear waiting state
      building.waitingForTool = null;
      building.waitingForToolSince = null;

      // Spawn a builder at the Castle
      const builder = this.gameState.spawnUnit(UnitType.Builder, { ...castle.coord }, building.playerId);
      if (builderTool) {
        builder.carriedTool = builderTool;
      }
      this.gameState.assignWorkerToBuilding(builder.id, building.id);
      this.builderAssignments.set(building.id, builder.id);

      // Pathfind to construction site
      const path = findPath(this.gameState.getGrid(), castle.coord, building.coord);
      if (path.length > 0) {
        setUnitPath(builder, path);
        builder.state = UnitState.WalkingToWork;
      } else {
        logger.warn(
          `[ConstructionManager] No path to building ${building.id} at (${building.coord.q},${building.coord.r})`,
        );
        this.gameState.unassignWorker(builder.id);
        this.gameState.removeUnit(builder.id);
        this.builderAssignments.delete(building.id);
        // Return tool
        if (builderTool) {
          addToInventory(castle.outputInventory, builderTool, 1);
        }
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
