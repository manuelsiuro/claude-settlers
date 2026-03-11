import { BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState } from './Building';
import type { Building } from './Building';
import type { GameState } from './GameState';
import type { CombatManager } from './CombatManager';
import type { TerritoryManager } from './TerritoryManager';
import type { Unit } from './Unit';
import { UnitState, setUnitPath, clearUnitPath } from './Unit';
import { UnitType } from './UnitType';
import { findPath } from './Pathfinding';

/**
 * An active attack: a knight walking toward an enemy building.
 */
interface AttackOrder {
  knightId: string;
  targetBuildingId: string;
  /** Once arrived, we process combat */
  arrived: boolean;
}

/**
 * Manages attack orders: knight movement to target, sequential combat,
 * building capture, and territory recalculation.
 *
 * Flow:
 *   1. Player issues attack order (knight → enemy military building)
 *   2. Knight walks to the target building
 *   3. On arrival, fights defenders one by one
 *   4. If all defenders beaten → capture building, flip territory
 *   5. Civilian buildings in new territory change ownership
 */
export class AttackManager {
  private gameState: GameState;
  private combatManager: CombatManager;
  private territoryManager: TerritoryManager;

  /** Active attack orders */
  private attacks: AttackOrder[] = [];

  /** Callback for territory changes (e.g., to update renderer) */
  onTerritoryChanged: (() => void) | null = null;

  /** Callback when a building is captured */
  onBuildingCaptured: ((building: Building, byPlayerId: number) => void) | null = null;

  /** Callback when an attack begins against a building */
  onBuildingUnderAttack: ((building: Building) => void) | null = null;

  constructor(
    gameState: GameState,
    combatManager: CombatManager,
    territoryManager: TerritoryManager,
  ) {
    this.gameState = gameState;
    this.combatManager = combatManager;
    this.territoryManager = territoryManager;
  }

  /**
   * Order a knight to attack an enemy military building.
   * Returns true if the order was valid and issued.
   */
  orderAttack(knightId: string, targetBuildingId: string): boolean {
    const knight = this.gameState.getUnit(knightId);
    if (!knight || knight.type !== UnitType.Knight) return false;

    const target = this.gameState.getBuilding(targetBuildingId);
    if (!target) return false;

    // Target must be an active military building owned by a different player
    const def = BUILDING_DEFINITIONS[target.type];
    if (def.knightSlots <= 0 && def.influenceRadius <= 0) return false;
    if (target.state !== BuildingState.Active) return false;
    if (target.playerId === knight.playerId) return false;

    // Remove knight from its current building
    if (knight.assignedBuildingId) {
      const srcBuilding = this.gameState.getBuilding(knight.assignedBuildingId);
      if (srcBuilding) {
        srcBuilding.knightIds = srcBuilding.knightIds.filter((id) => id !== knightId);
      }
    }

    // Pathfind to target
    const path = findPath(
      this.gameState.getGrid(),
      knight.coord,
      target.coord,
    );

    if (path.length === 0) {
      // Can't reach — return knight to its building
      return false;
    }

    setUnitPath(knight, path);
    knight.state = UnitState.WalkingToWork;
    knight.assignedBuildingId = targetBuildingId;

    this.onBuildingUnderAttack?.(target);

    this.attacks.push({
      knightId,
      targetBuildingId,
      arrived: false,
    });

    return true;
  }

  /**
   * Update attack orders each frame.
   * Checks for arrivals and processes combat.
   */
  update(): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.attacks.length; i++) {
      const attack = this.attacks[i];
      const knight = this.gameState.getUnit(attack.knightId);

      // Knight died or was removed
      if (!knight) {
        toRemove.push(i);
        continue;
      }

      // Target building removed
      const target = this.gameState.getBuilding(attack.targetBuildingId);
      if (!target) {
        // Send knight home
        this.sendKnightHome(knight);
        toRemove.push(i);
        continue;
      }

      // Check if knight has arrived (WalkingToWork → path complete)
      if (knight.state === UnitState.Working || this.hasArrived(knight)) {
        if (knight.state !== UnitState.Working) {
          clearUnitPath(knight);
          knight.state = UnitState.Working;
        }

        // Fight the next defender
        const defenderIds = [...target.knightIds];
        if (defenderIds.length > 0) {
          const defenderId = defenderIds[0];
          const result = this.combatManager.resolveDuel(attack.knightId, defenderId);

          if (!result) {
            toRemove.push(i);
            continue;
          }

          if (result.loserId === attack.knightId) {
            // Attacker lost — attack is over
            toRemove.push(i);
          }
          // If defender lost, the loop continues next tick
        } else {
          // No defenders — capture the building
          this.captureBuilding(target, knight.playerId);

          // Station the attacking knight in the captured building
          knight.assignedBuildingId = target.id;
          knight.state = UnitState.Working;
          target.knightIds.push(knight.id);

          toRemove.push(i);
        }
      }
    }

    // Remove processed attacks (in reverse order to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.attacks.splice(toRemove[i], 1);
    }
  }

  /**
   * Check if a unit has arrived at its destination.
   */
  private hasArrived(unit: { state: string; path: { q: number; r: number }[]; pathIndex: number }): boolean {
    if (unit.state !== UnitState.WalkingToWork) return false;
    return unit.path.length > 0 && unit.pathIndex >= unit.path.length - 1;
  }

  /**
   * Capture a building: change ownership, recalculate territory,
   * and handle civilian buildings in newly captured territory.
   */
  private captureBuilding(building: Building, newPlayerId: number): void {
    const oldPlayerId = building.playerId;
    building.playerId = newPlayerId;

    // Clear remaining knights (shouldn't be any, but safety)
    for (const knightId of building.knightIds) {
      this.combatManager.removeKnightData(knightId);
      this.gameState.removeUnit(knightId);
    }
    building.knightIds = [];

    // Recalculate territory
    this.territoryManager.markDirty();
    this.territoryManager.update();

    // Capture or destroy civilian buildings now in new territory
    this.handleCivilianBuildings(oldPlayerId, newPlayerId);

    this.onBuildingCaptured?.(building, newPlayerId);
    this.onTerritoryChanged?.();
  }

  /**
   * After territory changes, civilian buildings of the old player
   * that are now in the new player's territory change ownership.
   * Buildings outside any territory are destroyed.
   */
  private handleCivilianBuildings(oldPlayerId: number, newPlayerId: number): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.playerId !== oldPlayerId) continue;
      if (building.state !== BuildingState.Active) continue;

      const def = BUILDING_DEFINITIONS[building.type];

      // Skip military buildings (they're captured via combat, not territory)
      if (def.category === 'military' || def.category === 'core') continue;

      // Check if this building is now in the new player's territory
      const owner = this.territoryManager.getOwner(building.coord.q, building.coord.r);

      if (owner === newPlayerId) {
        // Transfer ownership
        building.playerId = newPlayerId;
      }
      // Buildings still in old player's territory stay as-is
    }
  }

  /**
   * Send a knight back home after a failed attack or target removal.
   */
  private sendKnightHome(knight: Unit): void {
    const castle = this.gameState.findCastle(knight.playerId);
    knight.assignedBuildingId = null;

    if (!castle) {
      knight.state = UnitState.Idle;
      return;
    }

    const path = findPath(this.gameState.getGrid(), knight.coord, castle.coord);
    if (path.length > 0) {
      setUnitPath(knight, path);
      knight.state = UnitState.WalkingHome;
    } else {
      knight.state = UnitState.Idle;
    }
  }

  /** Get the number of active attacks */
  getActiveAttackCount(): number {
    return this.attacks.length;
  }
}
