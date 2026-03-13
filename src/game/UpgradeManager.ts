import type { Building } from './Building';
import {
  getInventoryAmount,
  removeFromInventory,
  addToInventory,
} from './Building';
import type { GameState } from './GameState';
import type { Unit } from './Unit';
import { UnitState, setUnitPath } from './Unit';
import { UnitType } from './UnitType';
import type { ResourceType } from './ResourceType';
import { findPath } from './Pathfinding';
import {
  canUpgrade,
  getUpgradeCost,
  getUpgradeTime,
} from './BuildingUpgrade';
import type { UpgradeAxis } from './BuildingUpgrade';

/**
 * Manages building upgrade lifecycle:
 *   startUpgrade() → deliver resources from Castle → spawn builder → advance progress → complete
 *
 * Building stays Active during upgrade — production continues uninterrupted.
 * Follows the ConstructionManager pattern.
 */
export class UpgradeManager {
  private gameState: GameState;

  /** Track which buildings have an upgrade builder assigned (buildingId → unitId) */
  private builderAssignments: Map<string, string> = new Map();

  /** Seconds between resource delivery ticks */
  private static DELIVERY_INTERVAL = 1.0;
  private deliveryCooldown = 0;

  /** Optional callback when an upgrade completes */
  onUpgradeComplete: ((building: Building, axis: string) => void) | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /** Serialization: get internal state for save */
  _getState(): {
    builderAssignments: [string, string][];
    deliveryCooldown: number;
  } {
    return {
      builderAssignments: Array.from(this.builderAssignments.entries()),
      deliveryCooldown: this.deliveryCooldown,
    };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: {
    builderAssignments: [string, string][];
    deliveryCooldown: number;
  }): void {
    this.builderAssignments = new Map(state.builderAssignments);
    this.deliveryCooldown = state.deliveryCooldown;
  }

  /**
   * Start an upgrade on a building. Returns true if upgrade was initiated.
   */
  startUpgrade(buildingId: string, axis: UpgradeAxis): boolean {
    const building = this.gameState.getBuilding(buildingId);
    if (!building) return false;
    if (!canUpgrade(building, axis)) return false;

    const currentLevel = building.upgradeLevels[axis] ?? 0;
    const cost = getUpgradeCost(building.type, axis, currentLevel);
    if (!cost) return false;

    building.activeUpgrade = {
      axis,
      targetLevel: currentLevel + 1,
      resourcesDelivered: {},
      constructionProgress: 0,
    };

    return true;
  }

  /**
   * Cancel an active upgrade on a building. Refunds delivered resources to Castle.
   * Returns true if an upgrade was cancelled.
   */
  cancelUpgrade(buildingId: string): boolean {
    const building = this.gameState.getBuilding(buildingId);
    if (!building || !building.activeUpgrade) return false;

    const upgrade = building.activeUpgrade;

    // Refund delivered resources to Castle
    const castle = this.gameState.findCastle(building.playerId);
    if (castle) {
      for (const [resourceStr, amount] of Object.entries(upgrade.resourcesDelivered)) {
        if (amount && amount > 0) {
          addToInventory(castle.outputInventory, resourceStr as ResourceType, amount);
        }
      }
    }

    // If a builder was assigned, send it home
    const builderUnitId = this.builderAssignments.get(buildingId);
    if (builderUnitId) {
      const builder = this.gameState.getUnit(builderUnitId);
      if (builder) {
        this.sendBuilderHome(builder);
      }
      this.builderAssignments.delete(buildingId);
    }

    // Clear the active upgrade
    building.activeUpgrade = null;

    return true;
  }

  /**
   * Update upgrade lifecycle each frame.
   */
  update(deltaTime: number): void {
    this.deliverUpgradeResources(deltaTime);
    this.spawnUpgradeBuilders();
    this.advanceUpgradeConstruction(deltaTime);
  }

  /**
   * Pull resources from Castle to buildings with active upgrades.
   * Delivers one resource at a time per building per tick.
   */
  private deliverUpgradeResources(deltaTime: number): void {
    this.deliveryCooldown -= deltaTime;
    if (this.deliveryCooldown > 0) return;
    this.deliveryCooldown = UpgradeManager.DELIVERY_INTERVAL;

    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (!building.activeUpgrade) continue;
      // Skip if builder already assigned (resources fully delivered)
      if (this.builderAssignments.has(building.id)) continue;

      const currentLevel = building.upgradeLevels[building.activeUpgrade.axis] ?? 0;
      const cost = getUpgradeCost(
        building.type,
        building.activeUpgrade.axis as UpgradeAxis,
        currentLevel,
      );
      if (!cost) continue;

      // Check if all resources are delivered
      const allDelivered = cost.every((c) => {
        const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
        return delivered >= c.amount;
      });

      if (allDelivered) continue; // Will be picked up by spawnUpgradeBuilders

      // Find this player's Castle to pull resources from
      const castle = this.gameState.findCastle(building.playerId);
      if (!castle) continue;

      // Deliver one unit of the first needed resource
      for (const needed of cost) {
        const delivered = getInventoryAmount(building.activeUpgrade.resourcesDelivered, needed.resource);
        if (delivered >= needed.amount) continue;

        const available = getInventoryAmount(castle.outputInventory, needed.resource);
        if (available > 0) {
          removeFromInventory(castle.outputInventory, needed.resource, 1);
          addToInventory(building.activeUpgrade.resourcesDelivered, needed.resource, 1);
        }
        break; // One resource per tick
      }
    }
  }

  /**
   * Spawn builder units for upgrades that have all resources delivered.
   */
  private spawnUpgradeBuilders(): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (!building.activeUpgrade) continue;
      if (this.builderAssignments.has(building.id)) continue;

      const currentLevel = building.upgradeLevels[building.activeUpgrade.axis] ?? 0;
      const cost = getUpgradeCost(
        building.type,
        building.activeUpgrade.axis as UpgradeAxis,
        currentLevel,
      );
      if (!cost) continue;

      // Check all resources delivered
      const allDelivered = cost.every((c) => {
        const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
        return delivered >= c.amount;
      });
      if (!allDelivered) continue;

      // Find Castle to spawn builder from
      const castle = this.gameState.findCastle(building.playerId);
      if (!castle) continue;

      // Spawn builder at Castle
      const builder = this.gameState.spawnUnit(UnitType.Builder, { ...castle.coord }, building.playerId);
      builder.assignedBuildingId = building.id; // Prevents UnitManager orphan cleanup
      this.builderAssignments.set(building.id, builder.id);

      // Pathfind to building
      const path = findPath(this.gameState.getGrid(), castle.coord, building.coord);
      if (path.length > 0) {
        setUnitPath(builder, path);
        builder.state = UnitState.WalkingToWork;
      } else {
        this.gameState.removeUnit(builder.id);
        this.builderAssignments.delete(building.id);
      }
    }
  }

  /**
   * Advance upgrade construction for buildings with an active builder on site.
   */
  private advanceUpgradeConstruction(deltaTime: number): void {
    for (const [buildingId, unitId] of this.builderAssignments) {
      const building = this.gameState.getBuilding(buildingId);
      const builder = this.gameState.getUnit(unitId);

      if (!building || !builder || !building.activeUpgrade) {
        // Cleanup stale assignment
        if (builder) {
          this.sendBuilderHome(builder);
        }
        this.builderAssignments.delete(buildingId);
        continue;
      }

      if (builder.state !== UnitState.Working) continue;

      const upgradeTime = getUpgradeTime(building, building.activeUpgrade.targetLevel);
      const rate = 1 / upgradeTime;
      building.activeUpgrade.constructionProgress += rate * deltaTime;

      if (building.activeUpgrade.constructionProgress >= 1.0) {
        // Complete the upgrade
        const axis = building.activeUpgrade.axis;
        building.upgradeLevels[axis] = building.activeUpgrade.targetLevel;
        building.activeUpgrade = null;

        this.onUpgradeComplete?.(building, axis);
        this.sendBuilderHome(builder);
        this.builderAssignments.delete(buildingId);
      }
    }
  }

  /**
   * Send an upgrade builder back to the Castle.
   */
  private sendBuilderHome(builder: Unit): void {
    builder.assignedBuildingId = null;
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
